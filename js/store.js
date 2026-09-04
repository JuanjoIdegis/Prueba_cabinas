/**
 * Store y Sincronización de Datos para Cabina de Pruebas (Fluidra)
 * Integrado con GitHub API (idegis/test_cabinas), soporte offline y servidor local
 */

const Store = {
  data: {
    version: "1.0.0",
    puestos: ["A", "B", "C", "D", "E", "F"],
    slots: {}
  },

  githubConfig: {
    owner: "JuanjoIdegis",
    repo: "Prueba_cabinas",
    branch: "main",
    filePath: "database.json",
    token: localStorage.getItem("github_token") || ""
  },

  githubSha: null,
  isOnline: true,
  isGitHubConnected: false,
  lastSyncTime: null,
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  notify() {
    this.listeners.forEach(fn => fn(this.data));
  },

  async init() {
    // 1. Cargar desde caché local de inmediato (pantalla instantánea)
    const cached = localStorage.getItem("cabina_equipos_db");
    if (cached) {
      try {
        this.data = JSON.parse(cached);
        this.notify();
      } catch (e) {
        console.warn("Caché local corrupto:", e);
      }
    }

    // 2. Obtener datos frescos desde GitHub o servidor local
    await this.fetchData();

    // 3. Sincronización periódica en segundo plano cada 10 segundos
    setInterval(() => {
      this.fetchData(true);
    }, 10000);
  },

  async fetchData(silent = false) {
    let loaded = false;

    // A. Intentar con GitHub API si tenemos token o si el repo es público
    try {
      const headers = { "Accept": "application/vnd.github.v3+json" };
      if (this.githubConfig.token) {
        headers["Authorization"] = `Bearer ${this.githubConfig.token}`;
      }

      const url = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.githubConfig.filePath}?ref=${this.githubConfig.branch}&_t=${Date.now()}`;
      const res = await fetch(url, { headers, cache: "no-store" });

      if (res.ok) {
        const ghJson = await res.json();
        this.githubSha = ghJson.sha;
        this.isGitHubConnected = true;

        // Decodificar Base64 seguro con UTF-8
        const rawContent = ghJson.content.replace(/\s/g, "");
        const binaryString = atob(rawContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const decodedText = new TextDecoder("utf-8").decode(bytes);
        const remoteData = JSON.parse(decodedText);

        this.applyRemoteData(remoteData);
        this.lastSyncTime = new Date();
        this.isOnline = true;
        loaded = true;
        return;
      }
    } catch (err) {
      if (!silent) console.warn("No se pudo consultar GitHub API directa:", err);
    }

    // B. Intentar leer database.json estático (GitHub Pages sirve database.json directamente)
    if (!loaded) {
      try {
        const staticUrl = `./database.json?_t=${Date.now()}`;
        const res = await fetch(staticUrl, { cache: "no-store" });
        if (res.ok) {
          const remoteData = await res.json();
          this.applyRemoteData(remoteData);
          this.isOnline = true;
          loaded = true;
          return;
        }
      } catch (e) {
        // Fallback
      }
    }

    // C. Intentar servidor REST local (/api/equipos) si está activo
    if (!loaded) {
      try {
        const res = await fetch("/api/equipos", { cache: "no-store" });
        if (res.ok) {
          const remoteData = await res.json();
          this.applyRemoteData(remoteData);
          this.isOnline = true;
          loaded = true;
          return;
        }
      } catch (err) {
        // Sin conexión
      }
    }

    if (!loaded) {
      this.isOnline = false;
    }
  },

  applyRemoteData(remoteData) {
    if (!remoteData || !remoteData.slots) return;

    // Fusión inteligente: Solo sobrescribir una bahía si el dato remoto es más reciente
    let hasChanges = false;
    if (!this.data.slots) this.data.slots = {};

    Object.keys(remoteData.slots).forEach(slotId => {
      const remoteSlot = remoteData.slots[slotId];
      const localSlot = this.data.slots[slotId];

      if (!localSlot) {
        this.data.slots[slotId] = remoteSlot;
        hasChanges = true;
      } else {
        const remoteTime = remoteSlot.updated_at ? new Date(remoteSlot.updated_at).getTime() : 0;
        const localTime = localSlot.updated_at ? new Date(localSlot.updated_at).getTime() : 0;

        // Si el remoto es estrictamente más reciente que nuestra copia local
        if (remoteTime > localTime) {
          this.data.slots[slotId] = remoteSlot;
          hasChanges = true;
        }
      }
    });

    // Fusión de histórico
    if (remoteData.historico && Array.isArray(remoteData.historico)) {
      if (!this.data.historico) this.data.historico = [];
      const existingIds = new Set(this.data.historico.map(h => h.id));
      remoteData.historico.forEach(h => {
        if (!existingIds.has(h.id)) {
          this.data.historico.push(h);
          hasChanges = true;
        }
      });
      this.data.historico.sort((a, b) => new Date(b.fecha_registro || 0) - new Date(a.fecha_registro || 0));
    }

    if (hasChanges) {
      localStorage.setItem("cabina_equipos_db", JSON.stringify(this.data));
      this.notify();
    }
  },

  async updateSlot(slotData) {
    const slotId = slotData.slot_id || `${slotData.puesto}${slotData.slot}`;

    if (!this.data.slots) this.data.slots = {};
    const prev = this.data.slots[slotId];

    // Si ya había un equipo registrado y se cambia el nombre del equipo, archivar el anterior
    if (prev && prev.equipo && prev.equipo.trim() && slotData.equipo && prev.equipo.trim() !== slotData.equipo.trim()) {
      if (!this.data.historico) this.data.historico = [];
      this.data.historico.unshift({
        id: "hist_" + Date.now(),
        slot_id: slotId,
        puesto: slotId[0],
        slot: parseInt(slotId.substring(1), 10),
        equipo: prev.equipo,
        modelo: prev.modelo || "",
        sw: prev.sw || "",
        validacion: prev.validacion || "",
        iot: prev.iot || "",
        prueba: prev.prueba || "",
        responsable: prev.responsable || "",
        f_inicio: prev.f_inicio || "",
        f_final: prev.f_final || new Date().toISOString().slice(0, 10),
        descripcion: prev.descripcion || "",
        imagen: prev.imagen || "",
        motivo_cierre: `Reemplazado por ${slotData.equipo}`,
        fecha_registro: new Date().toISOString()
      });
    }

    this.data.slots[slotId] = {
      ...this.data.slots[slotId],
      ...slotData,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem("cabina_equipos_db", JSON.stringify(this.data));
    this.notify();

    // Guardar en GitHub
    const syncResult = await this.saveToGitHub(`Actualizar bahía ${slotId} (${slotData.equipo || slotData.estado})`);

    // Intentar también servidor local si está corriendo
    try {
      fetch("/api/equipos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...slotData, slot_id: slotId })
      }).catch(() => {});
    } catch (e) {}

    return syncResult;
  },

  async liberarSlot(slotId, motivo = "Ensayo finalizado / Liberado") {
    if (!this.data.slots || !this.data.slots[slotId]) return;

    const prev = this.data.slots[slotId];

    // Archivar automáticamente en el histórico si tenía equipo asignado
    if (prev.equipo && prev.equipo.trim()) {
      if (!this.data.historico) this.data.historico = [];
      this.data.historico.unshift({
        id: "hist_" + Date.now(),
        slot_id: slotId,
        puesto: slotId[0],
        slot: parseInt(slotId.substring(1), 10),
        equipo: prev.equipo,
        modelo: prev.modelo || "",
        sw: prev.sw || "",
        validacion: prev.validacion || "",
        iot: prev.iot || "",
        prueba: prev.prueba || "",
        responsable: prev.responsable || "",
        f_inicio: prev.f_inicio || "",
        f_final: prev.f_final || new Date().toISOString().slice(0, 10),
        descripcion: prev.descripcion || "",
        imagen: prev.imagen || "",
        motivo_cierre: motivo,
        fecha_registro: new Date().toISOString()
      });
    }

    const puesto = slotId[0];
    const slotNum = parseInt(slotId.substring(1), 10);

    this.data.slots[slotId] = {
      puesto,
      slot: slotNum,
      estado: "libre",
      equipo: "",
      modelo: "",
      sw: "",
      validacion: "",
      iot: "",
      prueba: "",
      responsable: "",
      f_inicio: "",
      f_final: "",
      descripcion: "",
      imagen: "",
      updated_at: new Date().toISOString()
    };

    localStorage.setItem("cabina_equipos_db", JSON.stringify(this.data));
    this.notify();

    const syncResult = await this.saveToGitHub(`Archivar e histórico bahía ${slotId} (${prev.equipo || 'Libre'})`);

    try {
      fetch("/api/equipos/liberar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId })
      }).catch(() => {});
    } catch (e) {}

    return syncResult;
  },

  exportHistoricoCSV() {
    const hist = this.data.historico || [];
    if (hist.length === 0) return null;

    const headers = ["Puesto", "Bahía", "Equipo", "Modelo", "Versión SW", "Validación", "IoT", "Tipo de Prueba", "Responsable", "Fecha Inicio", "Fecha Fin", "Motivo Cierre", "Fecha Registro", "Descripción"];
    const rows = hist.map(h => [
      h.puesto || "",
      h.slot_id || "",
      `"${(h.equipo || "").replace(/"/g, '""')}"`,
      `"${(h.modelo || "").replace(/"/g, '""')}"`,
      `"${(h.sw || "").replace(/"/g, '""')}"`,
      `"${(h.validacion || "").replace(/"/g, '""')}"`,
      `"${(h.iot || "").replace(/"/g, '""')}"`,
      `"${(h.prueba || "").replace(/"/g, '""')}"`,
      `"${(h.responsable || "").replace(/"/g, '""')}"`,
      h.f_inicio || "",
      h.f_final || "",
      `"${(h.motivo_cierre || "").replace(/"/g, '""')}"`,
      h.fecha_registro || "",
      `"${(h.descripcion || "").replace(/"/g, '""')}"`
    ]);

    return "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
  },

  async saveToGitHub(commitMessage) {
    const token = this.githubConfig.token;

    if (!token) {
      console.log("No hay GitHub Token configurado; los cambios quedan guardados en este dispositivo.");
      return { success: true, localOnly: true, message: "Guardado localmente. Configura un token de GitHub en Ajustes (⚙️) para sincronizar en la nube." };
    }

    try {
      // Si no tenemos el SHA actual del archivo, obtenerlo primero
      if (!this.githubSha) {
        const getUrl = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.githubConfig.filePath}?ref=${this.githubConfig.branch}&_t=${Date.now()}`;
        const getRes = await fetch(getUrl, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github.v3+json"
          }
        });
        if (getRes.ok) {
          const getJson = await getRes.json();
          this.githubSha = getJson.sha;
        }
      }

      // Codificar contenido a Base64 con UTF-8
      const jsonString = JSON.stringify(this.data, null, 2);
      const utf8Bytes = new TextEncoder().encode(jsonString);
      let binaryStr = "";
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryStr += String.fromCharCode(utf8Bytes[i]);
      }
      const contentBase64 = btoa(binaryStr);

      const putUrl = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.githubConfig.filePath}`;
      const payload = {
        message: commitMessage || "Actualizar seguimiento de equipos cabina",
        content: contentBase64,
        branch: this.githubConfig.branch
      };
      if (this.githubSha) {
        payload.sha = this.githubSha;
      }

      const putRes = await fetch(putUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (putRes.ok) {
        const putJson = await putRes.json();
        this.githubSha = putJson.content ? putJson.content.sha : null;
        this.isGitHubConnected = true;
        this.lastSyncTime = new Date();
        return { success: true, github: true };
      } else {
        const errJson = await putRes.json().catch(() => ({}));
        console.error("Error GitHub API:", errJson);
        return { success: false, error: errJson.message || "Error al subir a GitHub" };
      }
    } catch (err) {
      console.error("Fallo de red conectando con GitHub:", err);
      return { success: false, error: err.message };
    }
  },

  setGitHubToken(token) {
    this.githubConfig.token = (token || "").trim();
    if (this.githubConfig.token) {
      localStorage.setItem("github_token", this.githubConfig.token);
    } else {
      localStorage.removeItem("github_token");
    }
    return this.fetchData();
  },

  /**
   * Comprime una imagen a resolución óptima (máx 1100px) y formato WebP/JPEG
   */
  compressImage(file, maxWidth = 1100, maxHeight = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/webp", quality);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};
