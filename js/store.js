/**
 * Store y Sincronización de Datos para Cabina de Pruebas (Fluidra)
 * Integrado con GitHub API (idegis/test_cabinas), soporte offline y servidor local
 */

const Store = {
  data: {
    version: "2.0.0",
    plantas: [
      {
        id: "zona1",
        nombre: "Zona 1: Cabinas Test",
        icono: "⚡",
        puestos: [
          { id: "A", nombre: "Puesto A", slotsCount: 4 },
          { id: "B", nombre: "Puesto B", slotsCount: 4 },
          { id: "C", nombre: "Puesto C", slotsCount: 4 },
          { id: "D", nombre: "Puesto D", slotsCount: 4 },
          { id: "E", nombre: "Puesto E", slotsCount: 4 },
          { id: "F", nombre: "Puesto F", slotsCount: 4 },
          { id: "G", nombre: "Puesto G", slotsCount: 4 },
          { id: "H", nombre: "Puesto H", slotsCount: 4 },
          { id: "I", nombre: "Puesto I", slotsCount: 4 },
          { id: "J", nombre: "Puesto J", slotsCount: 4 }
        ]
      },
      {
        id: "zona2",
        nombre: "Zona 2: Planta Piloto Cabina test",
        icono: "🧪",
        puestos: [
          { id: "PCAB", nombre: "Piloto Cabina Test", slotsCount: 4 }
        ]
      },
      {
        id: "zona3",
        nombre: "Zona 3: Planta piloto Laboratorio",
        icono: "🔬",
        puestos: [
          { id: "PLAB", nombre: "Piloto Laboratorio", slotsCount: 4 }
        ]
      },
      {
        id: "zona4",
        nombre: "Zona 4: Planta Piloto Cellguard 1",
        icono: "🔋",
        puestos: [
          { id: "CG1", nombre: "Planta Piloto Cellguard 1", slotsCount: 5 }
        ]
      },
      {
        id: "zona5",
        nombre: "Zona 5: Planta Piloto Cellguard 2",
        icono: "🔋",
        puestos: [
          { id: "CG2", nombre: "Planta Piloto Cellguard 2", slotsCount: 5 }
        ]
      },
      {
        id: "zona6",
        nombre: "Zona 6: Planta Piloto EC (Golpes Ariete 1)",
        icono: "🌊",
        puestos: [
          { id: "EC1", nombre: "Planta Piloto EC (Golpes Ariete 1)", slotsCount: 4 }
        ]
      },
      {
        id: "zona7",
        nombre: "Zona 7: Planta Piloto EC (Golpes Ariete 2)",
        icono: "🌊",
        puestos: [
          { id: "EC2", nombre: "Planta Piloto EC (Golpes Ariete 2)", slotsCount: 4 }
        ]
      }
    ],
    puestos: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "PCAB", "PLAB", "CG1", "CG2", "EC1", "EC2"],
    slots: {},
    historico: []
  },

  getPlantas() {
    return this.data.plantas || [];
  },

  getPuestosByPlanta(plantaId) {
    const plantas = this.getPlantas();
    const planta = plantas.find(p => p.id === plantaId);
    return planta ? planta.puestos : [];
  },

  getPuestoInfo(puestoId) {
    const plantas = this.getPlantas();
    for (const pl of plantas) {
      const p = pl.puestos.find(item => item.id === puestoId);
      if (p) return { ...p, plantaId: pl.id, plantaNombre: pl.nombre, plantaIcono: pl.icono };
    }
    return { id: puestoId, nombre: `Puesto ${puestoId}`, slotsCount: 4, plantaId: "zona1", plantaNombre: "Zona 1: Cabinas Test", plantaIcono: "⚡" };
  },

  async updatePuestosConfig(updatedPlantas) {
    this.data.plantas = updatedPlantas;
    this.data.puestos = [].concat(...updatedPlantas.map(pl => pl.puestos.map(p => p.id)));
    localStorage.setItem("cabina_equipos_db", JSON.stringify(this.data));
    this.notify();
    return await this.saveToGitHub("Actualizar nombres de zonas y puestos");
  },

  async updateZonaNombre(zonaId, nuevoNombre) {
    const pl = (this.data.plantas || []).find(z => z.id === zonaId);
    if (pl) {
      pl.nombre = nuevoNombre;
      localStorage.setItem("cabina_equipos_db", JSON.stringify(this.data));
      this.notify();
      return await this.saveToGitHub(`Renombrar ${zonaId} a ${nuevoNombre}`);
    }
  },

  async updatePuestoNombre(puestoId, nuevoNombre) {
    for (const pl of (this.data.plantas || [])) {
      const p = pl.puestos.find(item => item.id === puestoId);
      if (p) {
        p.nombre = nuevoNombre;
        localStorage.setItem("cabina_equipos_db", JSON.stringify(this.data));
        this.notify();
        return await this.saveToGitHub(`Renombrar puesto ${puestoId} a ${nuevoNombre}`);
      }
    }
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
    // 1. Cargar desde caché local de inmediato con auto-migración a 7 Zonas
    const cached = localStorage.getItem("cabina_equipos_db");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const defaultPlantas = this.data.plantas;
        const defaultPuestos = this.data.puestos;

        // Si el caché local tiene menos de 7 zonas o versión antigua
        if (!parsed.plantas || !Array.isArray(parsed.plantas) || parsed.plantas.length < 7) {
          console.log("Migrando caché local a versión 2.0.0 (7 Zonas completas)...");
          parsed.plantas = defaultPlantas;
          parsed.puestos = defaultPuestos;
          parsed.version = "2.0.0";
          if (!parsed.slots) parsed.slots = {};

          defaultPlantas.forEach(pl => {
            pl.puestos.forEach(p => {
              for (let s = 1; s <= (p.slotsCount || 4); s++) {
                const sId = (p.id.length === 1) ? `${p.id}${s}` : `${p.id}_${s}`;
                if (!parsed.slots[sId]) {
                  parsed.slots[sId] = {
                    puesto: p.id,
                    slot: s,
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
                    updated_at: ""
                  };
                }
              }
            });
          });
          localStorage.setItem("cabina_equipos_db", JSON.stringify(parsed));
        }

        this.data = parsed;
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

    // Sincronización de plantas y configuración de puestos
    if (remoteData.plantas && Array.isArray(remoteData.plantas)) {
      const plantasStrNew = JSON.stringify(remoteData.plantas);
      const plantasStrOld = JSON.stringify(this.data.plantas || []);
      if (plantasStrNew !== plantasStrOld) {
        this.data.plantas = remoteData.plantas;
        this.data.puestos = [].concat(...remoteData.plantas.map(pl => pl.puestos.map(p => p.id)));
        hasChanges = true;
      }
    }

    if (hasChanges) {
      localStorage.setItem("cabina_equipos_db", JSON.stringify(this.data));
      this.notify();
    }
  },

  _parseSlotId(slotId, slotData = null) {
    let puesto = slotData?.puesto;
    let slotNum = slotData?.slot;
    if (!puesto || !slotNum) {
      if (slotId.includes("_")) {
        const parts = slotId.split("_");
        puesto = parts[0];
        slotNum = parseInt(parts[1], 10) || 1;
      } else {
        puesto = slotId.slice(0, -1);
        slotNum = parseInt(slotId.slice(-1), 10) || 1;
      }
    }
    const puestoInfo = this.getPuestoInfo(puesto);
    return {
      puesto,
      slot: slotNum,
      puesto_nombre: puestoInfo.nombre,
      planta_id: puestoInfo.plantaId,
      planta_nombre: puestoInfo.plantaNombre,
      planta_icono: puestoInfo.plantaIcono
    };
  },

  async updateSlot(slotData) {
    const slotId = slotData.slot_id || `${slotData.puesto}${slotData.slot}`;
    const parsed = this._parseSlotId(slotId, slotData);

    if (!this.data.slots) this.data.slots = {};
    const prev = this.data.slots[slotId];

    // Si ya había un equipo registrado y se cambia el nombre del equipo, archivar el anterior
    if (prev && prev.equipo && prev.equipo.trim() && slotData.equipo && prev.equipo.trim() !== slotData.equipo.trim()) {
      if (!this.data.historico) this.data.historico = [];
      this.data.historico.unshift({
        id: "hist_" + Date.now(),
        slot_id: slotId,
        puesto: parsed.puesto,
        puesto_nombre: parsed.puesto_nombre,
        planta_id: parsed.planta_id,
        planta_nombre: parsed.planta_nombre,
        slot: parsed.slot,
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
      puesto: parsed.puesto,
      slot: parsed.slot,
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
    const parsed = this._parseSlotId(slotId, prev);

    // Archivar automáticamente en el histórico si estaba en uso, no tocar o tenía datos
    const estabaOcupado = prev && (
      (prev.estado && prev.estado !== "libre") ||
      (prev.equipo && prev.equipo.trim()) ||
      (prev.responsable && prev.responsable.trim()) ||
      (prev.prueba && prev.prueba.trim())
    );

    if (estabaOcupado) {
      if (!this.data.historico) this.data.historico = [];
      this.data.historico.unshift({
        id: "hist_" + Date.now(),
        slot_id: slotId,
        puesto: parsed.puesto,
        puesto_nombre: parsed.puesto_nombre,
        planta_id: parsed.planta_id,
        planta_nombre: parsed.planta_nombre,
        slot: parsed.slot,
        equipo: (prev.equipo && prev.equipo.trim()) || (prev.estado === "no_tocar" ? "Ensayo Crítico (No Tocar)" : "Equipo en prueba"),
        modelo: prev.modelo || "",
        sw: prev.sw || "",
        validacion: prev.validacion || "",
        iot: prev.iot || "",
        prueba: prev.prueba || (prev.estado === "no_tocar" ? "Ensayo Crítico / No Manipular" : "Ensayo"),
        responsable: prev.responsable || "No especificado",
        f_inicio: prev.f_inicio || "",
        f_final: prev.f_final || new Date().toISOString().slice(0, 10),
        descripcion: prev.descripcion || "",
        imagen: prev.imagen || "",
        motivo_cierre: motivo,
        fecha_registro: new Date().toISOString()
      });
    }

    this.data.slots[slotId] = {
      puesto: parsed.puesto,
      slot: parsed.slot,
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

  trackEquipment(query) {
    if (!query || !query.trim()) return null;
    const q = query.trim().toLowerCase();

    // 1. Buscar en bahías activas en todas las plantas
    const activeLocations = [];
    if (this.data.slots) {
      Object.entries(this.data.slots).forEach(([slotId, slot]) => {
        if (!slot || slot.estado === "libre" && !slot.equipo) return;
        const matches = (
          (slot.equipo && slot.equipo.toLowerCase().includes(q)) ||
          (slot.modelo && slot.modelo.toLowerCase().includes(q)) ||
          (slot.sw && slot.sw.toLowerCase().includes(q)) ||
          (slot.iot && slot.iot.toLowerCase().includes(q)) ||
          (slot.prueba && slot.prueba.toLowerCase().includes(q)) ||
          (slot.responsable && slot.responsable.toLowerCase().includes(q))
        );
        if (matches) {
          const parsed = this._parseSlotId(slotId, slot);
          activeLocations.push({
            slot_id: slotId,
            puesto: parsed.puesto,
            puesto_nombre: parsed.puesto_nombre,
            planta_id: parsed.planta_id,
            planta_nombre: parsed.planta_nombre,
            planta_icono: parsed.planta_icono,
            slot_numero: parsed.slot,
            estado: slot.estado || "en_uso_disponible",
            equipo: slot.equipo,
            modelo: slot.modelo,
            sw: slot.sw,
            validacion: slot.validacion,
            iot: slot.iot,
            prueba: slot.prueba,
            responsable: slot.responsable,
            f_inicio: slot.f_inicio,
            f_final: slot.f_final,
            descripcion: slot.descripcion,
            imagen: slot.imagen,
            is_active: true
          });
        }
      });
    }

    // 2. Buscar en el histórico
    const historyLocations = [];
    if (this.data.historico && Array.isArray(this.data.historico)) {
      this.data.historico.forEach(item => {
        const matches = (
          (item.equipo && item.equipo.toLowerCase().includes(q)) ||
          (item.modelo && item.modelo.toLowerCase().includes(q)) ||
          (item.sw && item.sw.toLowerCase().includes(q)) ||
          (item.iot && item.iot.toLowerCase().includes(q)) ||
          (item.prueba && item.prueba.toLowerCase().includes(q)) ||
          (item.responsable && item.responsable.toLowerCase().includes(q)) ||
          (item.slot_id && item.slot_id.toLowerCase().includes(q))
        );
        if (matches) {
          const parsed = this._parseSlotId(item.slot_id, item);
          historyLocations.push({
            ...item,
            puesto_nombre: item.puesto_nombre || parsed.puesto_nombre,
            planta_id: item.planta_id || parsed.planta_id,
            planta_nombre: item.planta_nombre || parsed.planta_nombre,
            planta_icono: item.planta_icono || parsed.planta_icono,
            is_active: false
          });
        }
      });
    }

    return {
      query,
      activeLocations,
      historyLocations,
      totalCount: activeLocations.length + historyLocations.length
    };
  },

  getAllKnownEquipments() {
    const map = new Map();
    // Equipos en bahías activas
    if (this.data.slots) {
      Object.entries(this.data.slots).forEach(([slotId, s]) => {
        if (s && s.equipo && s.equipo.trim() && s.estado !== "libre") {
          const key = s.equipo.trim();
          if (!map.has(key)) {
            const parsed = this._parseSlotId(slotId, s);
            map.set(key, {
              nombre: key,
              modelo: s.modelo || "",
              is_connected: true,
              slot_id: slotId,
              planta_nombre: parsed.planta_nombre,
              puesto_nombre: parsed.puesto_nombre
            });
          }
        }
      });
    }
    // Equipos en histórico
    if (this.data.historico && Array.isArray(this.data.historico)) {
      this.data.historico.forEach(h => {
        if (h && h.equipo && h.equipo.trim()) {
          const key = h.equipo.trim();
          if (!map.has(key)) {
            map.set(key, {
              nombre: key,
              modelo: h.modelo || "",
              is_connected: false,
              slot_id: h.slot_id,
              planta_nombre: h.planta_nombre || "Cabina",
              puesto_nombre: h.puesto_nombre || `Puesto ${h.puesto}`
            });
          }
        }
      });
    }
    return Array.from(map.values());
  },

  exportEquipmentAuditCSV(equipmentName) {
    const tracking = this.trackEquipment(equipmentName);
    if (!tracking || tracking.totalCount === 0) return null;

    const headers = ["Tipo Registro", "Planta", "Puesto", "Bahía", "Equipo", "Modelo", "Versión SW", "Validación", "IoT", "Tipo de Prueba", "Responsable", "Fecha Inicio", "Fecha Fin", "Motivo Cierre / Estado", "Descripción"];
    const rows = [];

    tracking.activeLocations.forEach(a => {
      rows.push([
        "ACTUALMENTE EN USO",
        `"${(a.planta_nombre || '').replace(/"/g, '""')}"`,
        `"${(a.puesto_nombre || a.puesto || '').replace(/"/g, '""')}"`,
        a.slot_id || "",
        `"${(a.equipo || '').replace(/"/g, '""')}"`,
        `"${(a.modelo || '').replace(/"/g, '""')}"`,
        `"${(a.sw || '').replace(/"/g, '""')}"`,
        `"${(a.validacion || '').replace(/"/g, '""')}"`,
        `"${(a.iot || '').replace(/"/g, '""')}"`,
        `"${(a.prueba || '').replace(/"/g, '""')}"`,
        `"${(a.responsable || '').replace(/"/g, '""')}"`,
        a.f_inicio || "",
        a.f_final || "",
        `"Activo (${a.estado || 'en_uso'})"`,
        `"${(a.descripcion || '').replace(/"/g, '""')}"`
      ]);
    });

    tracking.historyLocations.forEach(h => {
      rows.push([
        "HISTÓRICO",
        `"${(h.planta_nombre || '').replace(/"/g, '""')}"`,
        `"${(h.puesto_nombre || h.puesto || '').replace(/"/g, '""')}"`,
        h.slot_id || "",
        `"${(h.equipo || '').replace(/"/g, '""')}"`,
        `"${(h.modelo || '').replace(/"/g, '""')}"`,
        `"${(h.sw || '').replace(/"/g, '""')}"`,
        `"${(h.validacion || '').replace(/"/g, '""')}"`,
        `"${(h.iot || '').replace(/"/g, '""')}"`,
        `"${(h.prueba || '').replace(/"/g, '""')}"`,
        `"${(h.responsable || '').replace(/"/g, '""')}"`,
        h.f_inicio || "",
        h.f_final || "",
        `"${(h.motivo_cierre || 'Liberado').replace(/"/g, '""')}"`,
        `"${(h.descripcion || '').replace(/"/g, '""')}"`
      ]);
    });

    return "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
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
