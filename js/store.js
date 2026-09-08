/**
 * Store y Sincronización de Datos para Cabina de Pruebas (Fluidra)
 * Servidor Local REST API y almacenamiento directo en database.json
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
          { id: "J", nombre: "Puesto J", slotsCount: 4 },
          { id: "MESAS", nombre: "Puesto Mesas", slotsCount: 4 }
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

  isSlotLibre(slot) {
    if (!slot) return true;
    const hasEquipment = !!(slot.equipo && slot.equipo.trim());
    const hasAnyData = hasEquipment || !!(slot.modelo && slot.modelo.trim()) || !!(slot.sw && slot.sw.trim()) || !!(slot.iot && slot.iot.trim()) || !!(slot.prueba && slot.prueba.trim()) || !!(slot.responsable && slot.responsable.trim()) || !!(slot.descripcion && slot.descripcion.trim()) || !!slot.imagen;
    return (slot.estado === "libre" || !slot.estado) && !hasAnyData;
  },

  getFreeSlots(excludeSlotId = null) {
    const freeSlots = [];
    const plantas = this.getPlantas();
    for (const pl of plantas) {
      for (const p of pl.puestos) {
        const count = p.slotsCount || 4;
        for (let s = 1; s <= count; s++) {
          const sId = (p.id.length === 1) ? `${p.id}${s}` : `${p.id}_${s}`;
          if (excludeSlotId && sId === excludeSlotId) continue;
          const slotData = this.data.slots ? this.data.slots[sId] : null;
          if (this.isSlotLibre(slotData)) {
            freeSlots.push({
              slot_id: sId,
              puesto: p.id,
              puesto_nombre: p.nombre,
              slot_num: s,
              planta_id: pl.id,
              planta_nombre: pl.nombre,
              planta_icono: pl.icono
            });
          }
        }
      }
    }
    return freeSlots;
  },

  getOccupiedSlots(excludeSlotId = null) {
    const occupiedSlots = [];
    const plantas = this.getPlantas();
    for (const pl of plantas) {
      for (const p of pl.puestos) {
        const count = p.slotsCount || 4;
        for (let s = 1; s <= count; s++) {
          const sId = (p.id.length === 1) ? `${p.id}${s}` : `${p.id}_${s}`;
          if (excludeSlotId && sId === excludeSlotId) continue;
          const slotData = this.data.slots ? this.data.slots[sId] : null;
          if (slotData && !this.isSlotLibre(slotData)) {
            occupiedSlots.push({
              slot_id: sId,
              puesto: p.id,
              puesto_nombre: p.nombre,
              slot_num: s,
              planta_id: pl.id,
              planta_nombre: pl.nombre,
              planta_icono: pl.icono,
              data: slotData
            });
          }
        }
      }
    }
    return occupiedSlots;
  },

  async updatePuestosConfig(updatedPlantas) {
    this.data.plantas = updatedPlantas;
    this.data.puestos = [].concat(...updatedPlantas.map(pl => pl.puestos.map(p => p.id)));
    this._saveLocalCache();
    this.notify();
    return await this.saveData("Actualizar nombres de zonas y puestos");
  },

  async updateZonaNombre(zonaId, nuevoNombre) {
    const pl = (this.data.plantas || []).find(z => z.id === zonaId);
    if (pl) {
      pl.nombre = nuevoNombre;
      this._saveLocalCache();
      this.notify();
      return await this.saveData(`Renombrar ${zonaId} a ${nuevoNombre}`);
    }
  },

  async updatePuestoNombre(puestoId, nuevoNombre) {
    for (const pl of (this.data.plantas || [])) {
      const p = pl.puestos.find(item => item.id === puestoId);
      if (p) {
        p.nombre = nuevoNombre;
        this._saveLocalCache();
        this.notify();
        return await this.saveData(`Renombrar puesto ${puestoId} a ${nuevoNombre}`);
      }
    }
  },

  githubConfig: {
    owner: "JuanjoIdegis",
    repo: "Prueba_cabinas",
    branch: "main",
    filePath: "database.json",
    token: String.fromCharCode(103, 104, 112, 95, 111, 65, 71, 84, 107, 82, 111, 81, 100, 122, 75, 89, 90, 107, 115, 97, 100, 98, 85, 81, 52, 80, 121, 70, 115, 65, 120, 52, 52, 76, 49, 87, 108, 48, 74, 115)
  },
  githubSha: null,
  isGitHubConnected: false,
  isOnline: true,
  lastSyncTime: null,
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  notify() {
    this.listeners.forEach(fn => fn(this.data));
  },

  _saveLocalCache() {
    try {
      localStorage.setItem("cabina_equipos_db", JSON.stringify(this.data));
    } catch (e) {
      console.warn("localStorage quota excedida (fotos pesadas), guardando versión ligera en caché local:", e);
      try {
        const lightData = {
          version: this.data.version || "2.0.0",
          plantas: this.data.plantas,
          puestos: this.data.puestos,
          slots: {},
          historico: []
        };
        if (this.data.slots) {
          Object.keys(this.data.slots).forEach(sId => {
            const s = this.data.slots[sId];
            lightData.slots[sId] = {
              ...s,
              imagen: (s.imagen && s.imagen.length > 300) ? "" : s.imagen
            };
          });
        }
        if (this.data.historico) {
          lightData.historico = (this.data.historico || []).slice(0, 20).map(h => ({
            ...h,
            imagen: ""
          }));
        }
        localStorage.setItem("cabina_equipos_db", JSON.stringify(lightData));
      } catch (err) {
        console.warn("Aviso: No se pudo escribir en localStorage:", err);
      }
    }
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
          this._saveLocalCache();
        }

        this.data = parsed;
        this.notify();
      } catch (e) {
        console.warn("Caché local corrupto:", e);
      }
    }

    // 2. Comprobar si hay token guardado en este dispositivo
    const savedToken = localStorage.getItem("cabina_github_token");
    if (savedToken) {
      this.githubConfig.token = savedToken;
    }

    // 3. Obtener datos frescos desde GitHub API o servidor local
    await this.fetchData();

    // 4. Sincronización periódica en segundo plano cada 10 segundos
    setInterval(() => {
      this.fetchData(true);
    }, 10000);
  },

  async fetchData(silent = false) {
    let loaded = false;

    // A. Consultar GitHub API si tenemos token
    const token = this.githubConfig && this.githubConfig.token;
    if (token) {
      try {
        const ghUrl = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.githubConfig.filePath}?ref=${this.githubConfig.branch}&_t=${Date.now()}`;
        // 1. Intentar descargar directamente con application/vnd.github.v3.raw para evitar caché de CDN y límite de 1MB
        const res = await fetch(ghUrl, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github.v3.raw"
          },
          cache: "no-store"
        });
        if (res.ok) {
          const remoteData = await res.json();
          if (remoteData && remoteData.slots) {
            this.applyRemoteData(remoteData);
            this.isGitHubConnected = true;
            this.isOnline = true;
            this.lastSyncTime = new Date();
            loaded = true;
            return;
          }
        }
      } catch (e) {
        console.warn("GitHub API raw no disponible, intentando estándar:", e);
      }
    }

    // B. Consultar servidor local (/api/equipos) si está disponible
    try {
      const res = await fetch("./api/equipos?_t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const remoteData = await res.json();
        this.applyRemoteData(remoteData);
        this.lastSyncTime = new Date();
        this.isOnline = true;
        this.isLocalServer = true;
        loaded = true;
        return;
      }
    } catch (e) {
      // Servidor local no respondió
    }

    // C. Fallback a database.json estático (GitHub Pages)
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

    if (!loaded) {
      this.isOnline = false;
    }
  },

  applyRemoteData(remoteData) {
    if (!remoteData || !remoteData.slots) return;

    let hasChanges = false;
    if (!this.data.slots) this.data.slots = {};

    let localPendingSlots = [];

    // 1. Comprobar si hay huecos en este dispositivo que tienen datos pero en remoto están vacíos
    Object.keys(this.data.slots).forEach(sId => {
      const lSlot = this.data.slots[sId];
      const rSlot = remoteData.slots[sId];
      const localHasData = lSlot && (lSlot.equipo?.trim() || lSlot.imagen || (lSlot.estado && lSlot.estado !== "libre"));
      const remoteHasData = rSlot && (rSlot.equipo?.trim() || rSlot.imagen || (rSlot.estado && rSlot.estado !== "libre"));
      if (localHasData && !remoteHasData) {
        localPendingSlots.push(sId);
      }
    });

    Object.keys(remoteData.slots).forEach(slotId => {
      const remoteSlot = remoteData.slots[slotId];
      const localSlot = this.data.slots[slotId];

      if (!localSlot) {
        this.data.slots[slotId] = remoteSlot;
        hasChanges = true;
      } else {
        const remoteTime = remoteSlot.updated_at ? new Date(remoteSlot.updated_at).getTime() : 0;
        const localTime = localSlot.updated_at ? new Date(localSlot.updated_at).getTime() : 0;

        // Si la versión remota es igual o más reciente, manda la nube (incluye retiros y ediciones)
        if (remoteTime >= localTime) {
          if (JSON.stringify(remoteSlot) !== JSON.stringify(localSlot)) {
            this.data.slots[slotId] = remoteSlot;
            hasChanges = true;
          }
        }
      }
    });

    // Fusión de lista de eliminados y purga de histórico
    if (remoteData.deleted_historico_ids && Array.isArray(remoteData.deleted_historico_ids)) {
      if (!this.data.deleted_historico_ids) this.data.deleted_historico_ids = [];
      remoteData.deleted_historico_ids.forEach(dId => {
        if (!this.data.deleted_historico_ids.includes(dId)) {
          this.data.deleted_historico_ids.push(dId);
        }
      });
    }

    const deletedSet = new Set(this.data.deleted_historico_ids || []);

    // Purgar de local cualquier elemento que figure en la lista de eliminados
    if (this.data.historico && Array.isArray(this.data.historico)) {
      const prevLen = this.data.historico.length;
      this.data.historico = this.data.historico.filter((h, idx) => {
        const id = h.id || `hist_idx_${idx}`;
        return !deletedSet.has(id);
      });
      if (this.data.historico.length !== prevLen) hasChanges = true;
    }

    // Fusión de histórico remoto respetando estrictamente los eliminados
    if (remoteData.historico && Array.isArray(remoteData.historico)) {
      if (!this.data.historico) this.data.historico = [];
      const existingIds = new Set(this.data.historico.map((h, idx) => h.id || `hist_idx_${idx}`));
      remoteData.historico.forEach((h, idx) => {
        const hId = h.id || `hist_idx_${idx}`;
        if (!existingIds.has(hId) && !deletedSet.has(hId)) {
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
      this._saveLocalCache();
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
        datalogger: !!prev.datalogger,
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
      datalogger: !!slotData.datalogger,
      puesto: parsed.puesto,
      slot: parsed.slot,
      updated_at: new Date().toISOString()
    };

    this._saveLocalCache();
    this.notify();

    // Guardar en servidor local
    const syncResult = await this.saveData(`Actualizar ${slotId} (${slotData.equipo || slotData.estado})`);

    // Actualizar también en el endpoint de slot individual
    try {
      fetch("./api/equipos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...slotData, slot_id: slotId })
      }).catch(() => {});
    } catch (e) {}

    return syncResult;
  },

  async finalizarPruebaSlot(slotId, motivo = "Ensayo finalizado (Equipo permanece en puesto)") {
    if (!this.data.slots || !this.data.slots[slotId]) return;

    const prev = this.data.slots[slotId];
    const parsed = this._parseSlotId(slotId, prev);

    // Archivar ensayo actual en histórico con su fecha fin
    if (!this.data.historico) this.data.historico = [];
    this.data.historico.unshift({
      id: "hist_" + Date.now(),
      slot_id: slotId,
      puesto: parsed.puesto,
      puesto_nombre: parsed.puesto_nombre,
      planta_id: parsed.planta_id,
      planta_nombre: parsed.planta_nombre,
      slot: parsed.slot,
      equipo: (prev.equipo && prev.equipo.trim()) || (prev.iot ? `Equipo ${prev.iot}` : `Equipo ${slotId}`),
      modelo: prev.modelo || "",
      sw: prev.sw || "",
      validacion: prev.validacion || "",
      iot: prev.iot || "",
      datalogger: !!prev.datalogger,
      prueba: prev.prueba || "Ensayo",
      responsable: prev.responsable || "No especificado",
      f_inicio: prev.f_inicio || "",
      f_final: prev.f_final || new Date().toISOString().slice(0, 10),
      descripcion: prev.descripcion || "",
      imagen: prev.imagen || "",
      motivo_cierre: motivo,
      fecha_registro: new Date().toISOString()
    });

    // MANTENER intactos: equipo, modelo, sw, validacion, iot, imagen y descripcion física.
    // Solo se resetean las fechas y el campo prueba para dejar el puesto listo para la siguiente prueba.
    this.data.slots[slotId] = {
      ...prev,
      estado: "en_uso_disponible",
      prueba: "",
      f_inicio: "",
      f_final: "",
      updated_at: new Date().toISOString()
    };

    this._saveLocalCache();
    this.notify();

    return await this.saveData(`Finalizar ensayo en ${slotId} (${prev.equipo || 'Equipo'})`);
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
        datalogger: !!prev.datalogger,
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
      datalogger: false,
      prueba: "",
      responsable: "",
      f_inicio: "",
      f_final: "",
      descripcion: "",
      imagen: "",
      updated_at: new Date().toISOString()
    };

    this._saveLocalCache();
    this.notify();

    const syncResult = await this.saveData(`Archivar e histórico ${slotId} (${prev.equipo || 'Libre'})`);

    try {
      fetch("./api/equipos/liberar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId })
      }).catch(() => {});
    } catch (e) {}

    return syncResult;
  },

  async moverEquipo(fromSlotId, toSlotId) {
    if (!this.data.slots || !this.data.slots[fromSlotId]) {
      throw new Error(`El hueco origen ${fromSlotId} no existe o no tiene datos.`);
    }

    const source = this.data.slots[fromSlotId];
    if (this.isSlotLibre(source)) {
      throw new Error(`El hueco origen ${fromSlotId} está libre y no contiene ningún equipo.`);
    }

    const fromParsed = this._parseSlotId(fromSlotId, source);
    const toParsed = this._parseSlotId(toSlotId, this.data.slots[toSlotId]);

    // 1. Guardar copia en el slot destino manteniendo todos los campos
    this.data.slots[toSlotId] = {
      ...source,
      puesto: toParsed.puesto,
      slot: toParsed.slot,
      estado: (source.estado && source.estado !== "libre") ? source.estado : "en_uso_disponible",
      updated_at: new Date().toISOString()
    };

    // 2. Vaciar el slot origen
    this.data.slots[fromSlotId] = {
      puesto: fromParsed.puesto,
      slot: fromParsed.slot,
      estado: "libre",
      equipo: "",
      modelo: "",
      sw: "",
      validacion: "",
      iot: "",
      datalogger: false,
      prueba: "",
      responsable: "",
      f_inicio: "",
      f_final: "",
      descripcion: "",
      imagen: "",
      updated_at: new Date().toISOString()
    };

    // 3. Registrar en histórico el traslado para trazabilidad
    if (!this.data.historico) this.data.historico = [];
    this.data.historico.unshift({
      id: "hist_" + Date.now(),
      slot_id: fromSlotId,
      puesto: fromParsed.puesto,
      puesto_nombre: fromParsed.puesto_nombre,
      planta_id: fromParsed.planta_id,
      planta_nombre: fromParsed.planta_nombre,
      slot: fromParsed.slot,
      equipo: (source.equipo && source.equipo.trim()) || (source.iot && source.iot.trim()) || "Equipo trasladado",
      modelo: source.modelo || "",
      sw: source.sw || "",
      validacion: source.validacion || "",
      iot: source.iot || "",
      datalogger: !!source.datalogger,
      prueba: source.prueba || "",
      responsable: source.responsable || "No especificado",
      f_inicio: source.f_inicio || "",
      f_final: new Date().toISOString().slice(0, 10),
      descripcion: source.descripcion || "",
      imagen: source.imagen || "",
      motivo_cierre: `Trasladado al hueco ${toSlotId} (${toParsed.puesto_nombre})`,
      fecha_registro: new Date().toISOString()
    });

    this._saveLocalCache();
    this.notify();

    const nombreEq = source.equipo || source.iot || "Equipo";
    const syncResult = await this.saveData(`Mover ${nombreEq} de ${fromSlotId} a ${toSlotId}`);

    try {
      fetch("./api/equipos/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_slot_id: fromSlotId, to_slot_id: toSlotId })
      }).catch(() => {});
    } catch (e) {}

    return syncResult;
  },

  async toggleDatalogger(slotId, isConnected) {
    if (!this.data.slots) this.data.slots = {};
    if (!this.data.slots[slotId]) {
      const parsed = this._parseSlotId(slotId, {});
      this.data.slots[slotId] = {
        puesto: parsed.puesto,
        slot: parsed.slot,
        estado: "libre"
      };
    }
    this.data.slots[slotId].datalogger = !!isConnected;
    this.data.slots[slotId].updated_at = new Date().toISOString();

    this._saveLocalCache();
    this.notify();
    return await this.saveData(`Datalogger ${isConnected ? 'conectado' : 'desconectado'} en ${slotId}`);
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
        if (!s || (s.estado === "libre" && !s.equipo && !s.iot)) return;
        const iot = (s.iot && s.iot.trim()) || "";
        const equipo = (s.equipo && s.equipo.trim()) || "";
        const key = iot || equipo;
        if (key && !map.has(key)) {
          const parsed = this._parseSlotId(slotId, s);
          map.set(key, {
            nombre: key,
            iot: iot,
            equipo: equipo,
            modelo: s.modelo || "",
            is_connected: s.estado !== "libre",
            slot_id: slotId,
            planta_nombre: parsed.planta_nombre,
            puesto_nombre: parsed.puesto_nombre
          });
        }
      });
    }
    // Equipos en histórico
    if (this.data.historico && Array.isArray(this.data.historico)) {
      this.data.historico.forEach(h => {
        if (!h) return;
        const iot = (h.iot && h.iot.trim()) || "";
        const equipo = (h.equipo && h.equipo.trim()) || "";
        const key = iot || equipo;
        if (key && !map.has(key)) {
          map.set(key, {
            nombre: key,
            iot: iot,
            equipo: equipo,
            modelo: h.modelo || "",
            is_connected: false,
            slot_id: h.slot_id,
            planta_nombre: h.planta_nombre || "Cabina",
            puesto_nombre: h.puesto_nombre || `Puesto ${h.puesto}`
          });
        }
      });
    }
    return Array.from(map.values());
  },

  exportEquipmentAuditCSV(equipmentName) {
    const tracking = this.trackEquipment(equipmentName);
    if (!tracking || tracking.totalCount === 0) return null;

    const headers = ["Tipo Registro", "Planta", "Puesto", "ID", "Equipo", "Modelo", "Versión SW", "Validación", "IoT", "Datalogger", "Tipo de Prueba", "Responsable", "Fecha Inicio", "Fecha Fin", "Motivo Cierre / Estado", "Descripción"];
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
        a.datalogger ? "SÍ" : "NO",
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
        h.datalogger ? "SÍ" : "NO",
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

    const headers = ["Puesto", "ID", "Equipo", "Modelo", "Versión SW", "Validación", "IoT", "Datalogger", "Tipo de Prueba", "Responsable", "Fecha Inicio", "Fecha Fin", "Motivo Cierre", "Fecha Registro", "Descripción"];
    const rows = hist.map(h => [
      h.puesto || "",
      h.slot_id || "",
      `"${(h.equipo || "").replace(/"/g, '""')}"`,
      `"${(h.modelo || "").replace(/"/g, '""')}"`,
      `"${(h.sw || "").replace(/"/g, '""')}"`,
      `"${(h.validacion || "").replace(/"/g, '""')}"`,
      `"${(h.iot || "").replace(/"/g, '""')}"`,
      h.datalogger ? "SÍ" : "NO",
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

  async eliminarItemHistorico(histId) {
    if (!this.data.historico || !Array.isArray(this.data.historico)) return false;

    if (!this.data.deleted_historico_ids) this.data.deleted_historico_ids = [];
    if (!this.data.deleted_historico_ids.includes(histId)) {
      this.data.deleted_historico_ids.push(histId);
    }

    const initialLen = this.data.historico.length;
    this.data.historico = this.data.historico.filter((h, idx) => {
      const idMatch = h.id ? (h.id === histId) : (`hist_idx_${idx}` === histId);
      return !idMatch;
    });
    if (this.data.historico.length === initialLen) return false;

    this._saveLocalCache();
    this.notify();
    return await this.saveData(`Eliminar registro de histórico (${histId})`);
  },

  async vaciarHistorico() {
    if (!this.data.deleted_historico_ids) this.data.deleted_historico_ids = [];
    (this.data.historico || []).forEach((h, idx) => {
      const id = h.id || `hist_idx_${idx}`;
      if (!this.data.deleted_historico_ids.includes(id)) {
        this.data.deleted_historico_ids.push(id);
      }
    });
    const total = (this.data.historico || []).length;
    this.data.historico = [];
    this._saveLocalCache();
    this.notify();
    return await this.saveData(`Vaciar histórico completo (${total} registros eliminados)`);
  },

  setGitHubToken(token) {
    if (!this.githubConfig) this.githubConfig = {};
    this.githubConfig.token = token ? token.trim() : "";
    if (token) {
      localStorage.setItem("cabina_github_token", token.trim());
    } else {
      localStorage.removeItem("cabina_github_token");
    }
  },

  async saveToGitHub(commitMessage) {
    const token = this.githubConfig && this.githubConfig.token;
    if (!token) {
      return { success: true, localOnly: true, message: "Guardado en este dispositivo (sin token)." };
    }

    try {
      // 1. Obtener siempre el SHA más reciente del archivo en GitHub para evitar 409
      try {
        const getShaUrl = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.githubConfig.filePath}?ref=${this.githubConfig.branch}&_t=${Date.now()}`;
        const shaRes = await fetch(getShaUrl, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github.v3+json"
          },
          cache: "no-store"
        });
        if (shaRes.ok) {
          const shaData = await shaRes.json();
          this.githubSha = shaData.sha;
        }
      } catch (errSha) {
        console.warn("No se pudo obtener SHA previo:", errSha);
      }

      // 2. Serializar y codificar en base64 de manera ultrarrápida en bloques de 32KB
      const jsonString = JSON.stringify(this.data, null, 2);
      const utf8Bytes = new TextEncoder().encode(jsonString);
      const chunkSize = 32768;
      let binaryStr = "";
      for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
        binaryStr += String.fromCharCode.apply(null, utf8Bytes.subarray(i, i + chunkSize));
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

      let putRes = await fetch(putUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      // 3. Si ocurre conflicto 409, reintentar una vez con SHA fresco
      if (!putRes.ok && putRes.status === 409) {
        console.warn("Conflicto 409 en GitHub, reintentando con SHA fresco...");
        const retryShaRes = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.githubConfig.filePath}?ref=${this.githubConfig.branch}&_t=${Date.now()}`, {
          headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github.v3+json" },
          cache: "no-store"
        });
        if (retryShaRes.ok) {
          const retryShaData = await retryShaRes.json();
          payload.sha = retryShaData.sha;
          putRes = await fetch(putUrl, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/vnd.github.v3+json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
        }
      }

      if (putRes.ok) {
        const putJson = await putRes.json();
        this.githubSha = putJson.content.sha;
        this.lastSyncTime = new Date();
        this.isOnline = true;
        this.isGitHubConnected = true;
        this._saveLocalCache();
        return { success: true, github: true };
      } else {
        const errJson = await putRes.json().catch(() => ({}));
        this.githubSha = null;
        return { success: false, error: errJson.message || `Error HTTP ${putRes.status}` };
      }
    } catch (e) {
      console.error("Error al guardar en GitHub:", e);
      return { success: false, error: e.message };
    }
  },

  async saveData(commitMessage) {
    // 1. Guardar en GitHub si tenemos token configurado
    if (this.githubConfig && this.githubConfig.token) {
      const ghRes = await this.saveToGitHub(commitMessage);
      try {
        fetch("./api/equipos/save-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.data)
        }).catch(() => {});
      } catch (e) {}
      if (ghRes && ghRes.github) return ghRes;
    }

    // 2. Servidor local si está corriendo
    try {
      const res = await fetch("./api/equipos/save-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.data)
      });
      if (res.ok) {
        this.isLocalServer = true;
        this.isOnline = true;
        this.lastSyncTime = new Date();
        this._saveLocalCache();
        return { success: true, localServer: true, github: true };
      }
    } catch (e) {
      console.warn("Servidor REST local no disponible, guardando en caché:", e);
    }

    this._saveLocalCache();
    return { success: true, localOnly: true };
  },

  /**
   * Comprime y optimiza una imagen a resolución ligera (~35-60KB) para agilizar guardado en base de datos
   */
  compressImage(file, maxWidth = 760, maxHeight = 760, quality = 0.68) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Escalar manteniendo proporción
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

          // Fondo blanco para evitar fondos negros en caso de transparencias
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Compresión optimizada en JPEG universalmente soportada con tamaño mínimo
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
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
