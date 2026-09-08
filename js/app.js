/**
 * Aplicación de Seguimiento de Equipos en Cabina de Pruebas (Fluidra)
 * Gestión de 7 Zonas: Cabinas Test (A-J), Planta Piloto Cabina, Laboratorio, Cellguard 1-2, EC 1-2
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let currentPlantaFilter = "zona1"; // 'all' | 'zona1' | 'zona2' | 'zona3' | 'zona4' | 'zona5' | 'zona6' | 'zona7'
let currentPuestoFilter = "all";
let currentStatusFilter = "all";
let searchQuery = "";
let currentEditSlotId = null;
let currentTempImageData = null;

function reloadApp() {
  const brandIcon = document.querySelector(".brand-icon");
  if (brandIcon) {
    brandIcon.style.transform = "rotate(360deg)";
  }
  showToast("🔄 Recargando aplicación...", "info");

  setTimeout(() => {
    // Si la URL tenía parámetros (?puesto=F, etc.), volver a la raíz limpia y recargar
    if (window.location.search || window.location.hash) {
      window.location.href = window.location.pathname;
    } else {
      window.location.reload();
    }
  }, 200);
}

async function forceAppCacheRefresh() {
  const brandIcon = document.querySelector(".brand-icon");
  if (brandIcon) brandIcon.style.transform = "rotate(720deg)";
  showToast("🔄 Vaciando caché y cargando la última versión...", "info");

  try {
    // 1. Desregistrar todos los service workers activos
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }

    // 2. Borrar cachés locales del navegador
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
      }
    }
  } catch (err) {
    console.warn("Error al limpiar cachés:", err);
  }

  // 3. Forzar recarga con parámetro único anticaché
  setTimeout(() => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    window.location.href = `${origin}${path}?_build_refresh=${Date.now()}`;
  }, 400);
}

async function checkForNewBuildUpdate() {
  try {
    const res = await fetch(`version.json?_t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const remote = await res.json();
    const currentBadge = document.getElementById("app-build-badge");
    const currentBuild = currentBadge ? currentBadge.dataset.build : null;

    if (currentBuild && remote.build && currentBuild !== remote.build) {
      showToast(`✨ Hay una nueva versión (${remote.display || remote.build}). Pulsa en el número de compilación para actualizarla.`, "warning");
      if (currentBadge) {
        currentBadge.style.background = "rgba(245, 158, 11, 0.25)";
        currentBadge.style.borderColor = "#f59e0b";
        currentBadge.style.color = "#fbbf24";
        currentBadge.innerHTML = `⚠️ Actualizar a ${remote.display || remote.version}`;
      }
    }
  } catch (e) {
    // Silencioso si no hay conexión
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Comprobar si hay nueva compilación en el servidor
  checkForNewBuildUpdate();
  setInterval(checkForNewBuildUpdate, 60000);

  // Inicializar store de datos
  await Store.init();

  // Comprobar parámetros de URL (ej: ?puesto=F&slot=3 o ?puesto=CG1)
  checkUrlParams();

  // Escuchar actualizaciones del store
  Store.subscribe(() => {
    renderApp();
  });

  // Render inicial
  renderApp();
  updateGitHubStatusUI();
  setupEventListeners();

  // Listener en la cabecera completa para recargar si no se pulsa un botón
  const header = document.getElementById("app-main-header");
  if (header) {
    header.addEventListener("click", (e) => {
      if (e.target.closest("button, a, input, select, .metrics-bar, .metric-tag")) {
        return;
      }
      reloadApp();
    });
  }

  setupPWA();
});

function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);

  // Soporte para autorizar un móvil vía QR de autorización (?auth=...)
  const auth = urlParams.get("auth") || urlParams.get("token");
  if (auth) {
    Store.setGitHubToken(auth);
    showToast("✅ Dispositivo autorizado con permisos de sincronización Cloud", "success");
    urlParams.delete("auth");
    urlParams.delete("token");
    const cleanSearch = urlParams.toString() ? `?${urlParams.toString()}` : "";
    window.history.replaceState({}, document.title, window.location.pathname + cleanSearch + window.location.hash);
  }

  let puesto = urlParams.get("puesto");
  let slot = urlParams.get("slot");

  // Soporte formato Hash: #puesto=F o #CG1 o #J2
  if (!puesto && window.location.hash) {
    const hashClean = window.location.hash.replace(/^#/, "");
    if (hashClean.includes("puesto=")) {
      const hashParams = new URLSearchParams(hashClean);
      puesto = hashParams.get("puesto");
      slot = hashParams.get("slot");
    } else {
      puesto = hashClean;
    }
  }

  if (puesto) {
    const pInfo = Store.getPuestoInfo(puesto);
    if (pInfo) {
      currentPlantaFilter = pInfo.plantaId;
      currentPuestoFilter = pInfo.id;
      setTimeout(() => {
        showToast(`📍 Mostrando ${pInfo.nombre} (${pInfo.plantaNombre})`, "info");
        if (slot) {
          const slotNum = parseInt(slot, 10);
          if (slotNum >= 1 && slotNum <= (pInfo.slotsCount || 4)) {
            const slotId = pInfo.id.length > 2 || pInfo.id.includes('_') ? `${pInfo.id}_${slotNum}` : `${pInfo.id}${slotNum}`;
            openEditModal(slotId);
          }
        }
      }, 400);
    }
  }
}

function renderApp() {
  renderMetrics();
  renderPlantasNav();
  renderTabs();
  renderPuestos();
}

function renderMetrics() {
  const slots = Store.data.slots || {};
  
  // Si hay una zona seleccionada, filtrar métricas por esa zona
  let relevantPuestoIds = [];
  if (currentPlantaFilter === "all") {
    relevantPuestoIds = Store.data.puestos || [];
  } else {
    relevantPuestoIds = Store.getPuestosByPlanta(currentPlantaFilter).map(p => p.id);
  }

  let libres = 0;
  let disponibles = 0;
  let noTocar = 0;
  let dataloggers = 0;
  let totalSlots = 0;

  relevantPuestoIds.forEach(pId => {
    const pInfo = Store.getPuestoInfo(pId);
    const count = pInfo.slotsCount || 4;
    totalSlots += count;

    for (let s = 1; s <= count; s++) {
      const slotId = (pId.length === 1) ? `${pId}${s}` : `${pId}_${s}`;
      const slot = slots[slotId] || { estado: "libre" };
      const hasAnyData = !!(slot.equipo && slot.equipo.trim()) || !!(slot.modelo && slot.modelo.trim()) || !!(slot.iot && slot.iot.trim()) || !!slot.imagen;
      const isActuallyLibre = (slot.estado === "libre" || !slot.estado) && !hasAnyData;

      if (isActuallyLibre) libres++;
      else if (slot.estado === "no_tocar") noTocar++;
      else disponibles++;

      if (slot.datalogger) dataloggers++;
    }
  });

  const libresEl = document.getElementById("metric-libres");
  const dispEl = document.getElementById("metric-disponibles") || document.getElementById("metric-en-uso");
  const noTocarEl = document.getElementById("metric-no-tocar");
  const dataloggersEl = document.getElementById("metric-dataloggers");
  const totalEl = document.getElementById("metric-total");

  if (libresEl) libresEl.textContent = libres;
  if (dispEl) dispEl.textContent = disponibles;
  if (noTocarEl) noTocarEl.textContent = noTocar;
  if (dataloggersEl) dataloggersEl.textContent = dataloggers;
  if (totalEl) totalEl.textContent = `${totalSlots - libres}/${totalSlots}`;
}

function renderPlantasNav() {
  const container = document.getElementById("plantas-nav");
  if (!container) return;

  const plantas = Store.getPlantas();

  let totalGlobal = 0;
  plantas.forEach(pl => {
    totalGlobal += pl.puestos.reduce((acc, p) => acc + (p.slotsCount || 4), 0);
  });

  const activePlanta = plantas.find(p => p.id === currentPlantaFilter);

  let html = `
    <div class="zone-bar-wrapper">
      <!-- Selector desplegable principal de zona -->
      <div class="zone-dropdown-box">
        <label for="zona-select-dropdown" class="zone-select-label">📍 ZONA SELECCIONADA:</label>
        <select id="zona-select-dropdown" class="zone-select-dropdown" title="Cambiar zona de trabajo">
          <option value="all" ${currentPlantaFilter === 'all' ? 'selected' : ''}>
            🏢 Todas las Zonas (${totalGlobal} en total)
          </option>
  `;

  plantas.forEach((pl, idx) => {
    const totalCount = pl.puestos.reduce((acc, p) => acc + (p.slotsCount || 4), 0);
    html += `
      <option value="${pl.id}" ${currentPlantaFilter === pl.id ? 'selected' : ''}>
        ${pl.icono || '🏢'} ${escapeHtml(pl.nombre)} (${totalCount})
      </option>
    `;
  });

  html += `
        </select>
        ${activePlanta ? `
          <button class="btn-icon" onclick="openRenameZonaModal('${activePlanta.id}', '${escapeHtml(activePlanta.nombre)}')" title="Renombrar esta zona (${escapeHtml(activePlanta.nombre)})" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); border-radius: var(--radius-sm); cursor: pointer; color: #fff; font-size: 0.74rem; padding: 0.4rem 0.65rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;">
            ✏️ Renombrar Zona
          </button>
        ` : ''}
      </div>

      <!-- Botón de configuración de nombres a la derecha -->
      <div class="zone-edit-action">
        <button class="btn btn-secondary" style="font-size: 0.76rem; padding: 0.4rem 0.8rem; white-space: nowrap;" onclick="openEditPuestosModal()" title="Personalizar y editar nombres de todas las zonas y puestos">
          ⚙️ Configurar Nombres
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  const dropdown = document.getElementById("zona-select-dropdown");
  if (dropdown) {
    dropdown.addEventListener("change", (e) => {
      currentPlantaFilter = e.target.value;
      currentPuestoFilter = "all";
      renderApp();
    });
  }
}

function renderTabs() {
  const container = document.getElementById("tabs-puestos");
  if (!container) return;

  const puestos = (currentPlantaFilter === "all")
    ? (Store.data.puestos || []).map(pid => Store.getPuestoInfo(pid))
    : Store.getPuestosByPlanta(currentPlantaFilter);

  const slots = Store.data.slots || {};

  let html = `
    <button class="tab-btn ${currentPuestoFilter === 'all' ? 'active' : ''}" data-puesto="all">
      Todos los Puestos
      <span class="tab-badge">${puestos.length}</span>
    </button>
  `;

  puestos.forEach(p => {
    let ocupados = 0;
    const count = p.slotsCount || 4;
    for (let s = 1; s <= count; s++) {
      const slotId = p.id.length > 2 || p.id.includes('_') ? `${p.id}_${s}` : `${p.id}${s}`;
      const slot = slots[slotId];
      if (slot && slot.estado !== "libre" && slot.equipo) ocupados++;
    }

    html += `
      <button class="tab-btn ${currentPuestoFilter === p.id ? 'active' : ''}" data-puesto="${p.id}" title="${p.nombre}">
        ${p.nombre}
        <span class="tab-badge" style="${ocupados > 0 ? 'color: var(--accent-cyan)' : ''}">${ocupados}/${count}</span>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentPuestoFilter = btn.dataset.puesto;
      container.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderPuestos();
    });
  });
}

function renderPuestos() {
  const container = document.getElementById("puestos-grid");
  if (!container) return;

  container.classList.toggle("mode-compact-view", areAllCollapsed);

  const allPuestos = (currentPlantaFilter === "all")
    ? (Store.data.puestos || [])
    : Store.getPuestosByPlanta(currentPlantaFilter).map(p => p.id);

  const puestosToShow = currentPuestoFilter === "all" ? allPuestos : [currentPuestoFilter];

  let html = "";

  puestosToShow.forEach(puestoId => {
    html += renderPuestoCard(puestoId);
  });

  if (html === "") {
    html = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-dim);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No se encontraron resultados con los filtros aplicados</p>
        <button class="btn btn-secondary" onclick="resetFilters()">Restablecer filtros</button>
      </div>
    `;
  }

  container.innerHTML = html;
  attachCardEvents();
}

let explicitlyExpandedPuestos = new Set();
let explicitlyCollapsedPuestos = new Set();
let areAllCollapsed = true; // Por defecto vista limpia y recogida

function renderPuestoCard(puestoId) {
  const pInfo = Store.getPuestoInfo(puestoId);
  const slots = Store.data.slots || {};
  const slotsCount = pInfo.slotsCount || 4;

  let hasMatchingSlots = false;
  const slotCardsHtml = [];
  const baySummaries = [];
  let libresCount = 0;
  let enUsoCount = 0;
  let noTocarCount = 0;

  for (let slotNum = 1; slotNum <= slotsCount; slotNum++) {
    const slotId = pInfo.id.length > 2 || pInfo.id.includes('_') ? `${pInfo.id}_${slotNum}` : `${pInfo.id}${slotNum}`;
    const slotData = slots[slotId] || { puesto: pInfo.id, slot: slotNum, estado: "libre" };
    const estado = slotData.estado || "libre";
    const hasAnyData = !!(slotData.equipo && slotData.equipo.trim()) || !!(slotData.modelo && slotData.modelo.trim()) || !!(slotData.iot && slotData.iot.trim()) || !!slotData.imagen || !!(slotData.descripcion && slotData.descripcion.trim());
    const isActuallyLibre = (estado === "libre") && !hasAnyData;

    if (isActuallyLibre) libresCount++;
    else if (estado === "no_tocar") noTocarCount++;
    else enUsoCount++;

    baySummaries.push({
      slotId,
      slotNum,
      estado: isActuallyLibre ? "libre" : (estado === "no_tocar" ? "no_tocar" : "en_uso_disponible"),
      equipo: slotData.equipo || (slotData.iot ? `IoT: ${slotData.iot}` : (slotData.imagen ? 'Con Foto' : '')),
      modelo: slotData.modelo || "",
      datalogger: !!slotData.datalogger
    });

    if (currentStatusFilter !== "all") {
      if (estado !== currentStatusFilter) continue;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchable = [
        slotData.equipo, slotData.modelo, slotData.sw, slotData.validacion,
        slotData.iot, slotData.prueba, slotData.responsable, slotData.descripcion, slotId, pInfo.nombre
      ].filter(Boolean).join(" ").toLowerCase();

      if (!searchable.includes(q)) continue;
    }

    hasMatchingSlots = true;
    slotCardsHtml.push(renderSlotCard(slotData, slotId));
  }

  if (!hasMatchingSlots && (currentStatusFilter !== "all" || searchQuery)) {
    return "";
  }

  // Determinar si este puesto debe estar recogido
  let isCollapsed = areAllCollapsed;
  // Si el puesto tiene equipos conectados, mantenerlo DESPLEGADO por defecto para visibilidad directa
  if (slotsCount - libresCount > 0) {
    isCollapsed = false;
  }
  if (explicitlyExpandedPuestos.has(pInfo.id)) isCollapsed = false;
  else if (explicitlyCollapsedPuestos.has(pInfo.id)) isCollapsed = true;

  // Si hay búsqueda activa o se ha seleccionado un puesto concreto, expandir automáticamente
  if (searchQuery || currentPuestoFilter !== "all") {
    isCollapsed = false;
  }

  return `
    <div class="puesto-card ${isCollapsed ? 'collapsed' : ''}" id="puesto-card-${pInfo.id}">
      <!-- Cabecera del Puesto -->
      <div class="instrument-panel">
        <div class="instrument-top">
          <div class="puesto-title" onclick="togglePuestoCollapse('${pInfo.id}')" style="cursor: pointer;">
            <div class="puesto-letter" style="${pInfo.id.length > 2 ? 'font-size: 1.1rem;' : ''}">${pInfo.id}</div>
            <div class="puesto-meta">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h2 style="margin: 0;">${pInfo.nombre.toUpperCase()}</h2>
                <button class="btn-icon" onclick="event.stopPropagation(); openRenameSinglePuestoModal('${pInfo.id}', '${pInfo.nombre}')" title="Editar nombre de este puesto" style="background: transparent; border: none; cursor: pointer; opacity: 0.6; font-size: 0.85rem; padding: 0.2rem;">✏️</button>
              </div>
              <span>${pInfo.plantaIcono || '🏢'} ${pInfo.plantaNombre} · ${slotsCount - libresCount}/${slotsCount} ocupados</span>
            </div>
          </div>
          <div class="instrument-tools" style="display: flex; gap: 0.4rem; align-items: center;">
            <button class="btn-collapse-toggle" id="btn-toggle-${pInfo.id}" onclick="togglePuestoCollapse('${pInfo.id}')" title="Plegar / Desplegar este puesto">
              <span>${isCollapsed ? '▼ Desplegar' : '▲ Recoger'}</span>
            </button>
            <button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem;" onclick="openPuestoQRModal('${pInfo.id}')" title="Generar QR de este puesto">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              QR Puesto
            </button>
          </div>
        </div>

        <!-- Tira de Resumen en vista limpia / recogida -->
        <div class="puesto-summary-strip" onclick="togglePuestoCollapse('${pInfo.id}')" style="cursor: pointer;" title="Haz clic para ${isCollapsed ? 'desplegar' : 'recoger'}">
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; flex: 1; align-items: center;">
            ${baySummaries.map(b => {
              const label = b.equipo ? `${b.equipo}` : (b.estado === 'libre' ? 'Libre' : (b.estado === 'no_tocar' ? 'No Tocar' : 'En Uso'));
              const displayName = (b.slotId && b.slotId.length <= 2) ? b.slotId : `B${b.slotNum}`;
              return `
                <span class="bay-mini-pill ${b.estado}" title="${b.slotId}: ${b.equipo || b.estado}${b.datalogger ? ' (Datalogger conectado)' : ''}">
                  <span class="dot ${b.estado}" style="width: 7px; height: 7px;"></span>
                  <span><strong>${displayName}:</strong> ${escapeHtml(label.length > 18 ? label.slice(0, 16) + '...' : label)}${b.datalogger ? ' <span style="color: #38bdf8; font-size: 0.7rem;" title="Datalogger activo">📊</span>' : ''}</span>
                </span>
              `;
            }).join("")}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-dim); display: flex; align-items: center; gap: 0.5rem;">
            ${noTocarCount > 0 ? `<span style="color: #fb7185; font-weight: 600;">🔴 ${noTocarCount}</span>` : ''}
            ${enUsoCount > 0 ? `<span style="color: #fbbf24;">🟡 ${enUsoCount}</span>` : ''}
            ${libresCount > 0 ? `<span style="color: #34d399;">🟢 ${libresCount}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Bahías Físicas (Desplegables) -->
      <div class="slots-container">
        ${slotCardsHtml.join("")}
      </div>
    </div>
  `;
}

function togglePuestoCollapse(puestoId) {
  const card = document.getElementById(`puesto-card-${puestoId}`);
  if (!card) return;

  const isCurrentlyCollapsed = card.classList.contains("collapsed");
  if (isCurrentlyCollapsed) {
    card.classList.remove("collapsed");
    explicitlyExpandedPuestos.add(puestoId);
    explicitlyCollapsedPuestos.delete(puestoId);
  } else {
    card.classList.add("collapsed");
    explicitlyCollapsedPuestos.add(puestoId);
    explicitlyExpandedPuestos.delete(puestoId);
  }

  const btn = document.getElementById(`btn-toggle-${puestoId}`);
  if (btn) {
    btn.innerHTML = `<span>${!isCurrentlyCollapsed ? '▼ Desplegar' : '▲ Recoger'}</span>`;
  }
}

function toggleAllCardsCollapse() {
  areAllCollapsed = !areAllCollapsed;
  explicitlyExpandedPuestos.clear();
  explicitlyCollapsedPuestos.clear();

  const btnLabel = document.getElementById("btn-toggle-all-cards-text");
  if (btnLabel) {
    btnLabel.textContent = areAllCollapsed ? "🔽 Desplegar Todo" : "🔼 Recoger Todo";
  }

  renderPuestos();
}

function renderSlotCard(slot, slotId) {
  const hasEquipment = !!(slot.equipo && slot.equipo.trim());
  const hasAnyData = hasEquipment || !!(slot.modelo && slot.modelo.trim()) || !!(slot.sw && slot.sw.trim()) || !!(slot.iot && slot.iot.trim()) || !!(slot.prueba && slot.prueba.trim()) || !!(slot.responsable && slot.responsable.trim()) || !!(slot.descripcion && slot.descripcion.trim()) || !!slot.imagen;

  let estado = slot.estado || "libre";
  if (estado === "libre" && hasAnyData) {
    estado = "en_uso_disponible";
  }
  const isLibre = (estado === "libre") && !hasAnyData;

  const statusLabel = {
    "libre": "🟢 Libre",
    "en_uso_disponible": "🟡 En uso (Disponible)",
    "no_tocar": "🔴 No Tocar"
  }[estado] || "🟢 Libre";

  const displayTitle = slot.equipo || (slot.iot ? `Equipo ${slot.iot}` : (hasAnyData ? `Equipo ${slotId}` : 'Sin identificador'));

  return `
    <div class="slot-card state-${estado}" id="card-slot-${slotId}">
      <div class="slot-header">
        <div style="display: flex; align-items: center; gap: 0.45rem;">
          <span class="slot-badge-num">${slotId}</span>
          <label class="datalogger-check-pill ${slot.datalogger ? 'checked' : ''}" onclick="event.stopPropagation();" title="Marcar o desmarcar Datalogger conectado en ${slotId}">
            <input type="checkbox" ${slot.datalogger ? 'checked' : ''} onchange="toggleDataloggerDirectly('${slotId}', this.checked)" />
            <span>📊 Datalogger</span>
          </label>
        </div>
        <span class="slot-status-pill ${estado}">${statusLabel}</span>
      </div>

      ${isLibre ? `
        <div class="slot-empty-view">
          <div class="slot-empty-icon" onclick="openEditModal('${slotId}')" title="Haz clic para conectar un equipo en ${slotId}">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div class="slot-empty-text" onclick="openEditModal('${slotId}')" title="Haz clic para conectar un equipo en ${slotId}">
            Sin equipo conectado.<br>Disponible para pruebas.
          </div>
          <div class="slot-empty-actions">
            <button class="btn btn-slot connect" onclick="openEditModal('${slotId}')">
              ➕ Conectar Equipo
            </button>
            <button class="btn btn-slot btn-slot-hist-empty" onclick="openHistoricoModal('${slotId}')" title="Ver historial de ensayos en ${slotId}">
              📜 Historial
            </button>
          </div>
        </div>
      ` : `
        <div class="slot-body">
          ${slot.imagen ? `
            <div class="equipment-thumb has-image" onclick="openImageViewer('${slot.imagen}', '${escapeHtml(displayTitle)}')" title="Ver foto ampliada">
              <img src="${slot.imagen}" alt="${escapeHtml(displayTitle)}" loading="lazy" />
            </div>
          ` : `
            <div class="equipment-thumb" onclick="openEditModal('${slotId}')" title="Clic para conectar o añadir foto">
              <div class="no-img">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Foto</span>
              </div>
            </div>
          `}

          <div class="equipment-info">
            <div class="eq-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
            <div class="eq-model" title="${slot.modelo || ''}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><rect x="8" y="10" width="14" height="10" rx="2"/></svg>
              ${slot.modelo || 'Modelo no especificado'}
            </div>
            <div class="eq-test" title="${slot.prueba || ''}">${slot.prueba || 'Prueba en curso'}</div>

            <div class="eq-meta-tags">
              ${slot.datalogger ? `<span class="meta-chip datalogger" title="Datalogger conectado">📊 Datalogger Conectado</span>` : ''}
              ${slot.sw ? `<span class="meta-chip sw" title="Versión de SW">SW: ${slot.sw}</span>` : ''}
              ${slot.iot ? `<span class="meta-chip iot" title="ID / Conectividad IoT">${slot.iot}</span>` : ''}
              ${slot.responsable ? `<span class="meta-chip user" title="Responsable">👤 ${slot.responsable}</span>` : ''}
              ${slot.validacion ? `<span class="meta-chip" title="Validación">Val: ${slot.validacion}</span>` : ''}
            </div>
          </div>
        </div>

        ${slot.descripcion ? `
          <div style="font-size: 0.72rem; color: var(--text-dim); background: rgba(0,0,0,0.25); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); border-left: 2px solid rgba(255,255,255,0.1); line-height: 1.3;">
            ${slot.descripcion}
          </div>
        ` : ''}

        <div class="slot-dates">
          <span>📅 Ini: ${slot.f_inicio || '--'}</span>
          <span>Fin: ${slot.f_final || '--'}</span>
        </div>

        <div class="slot-actions-group">
          <div class="slot-actions-row primary">
            <button class="btn-slot" onclick="openEditModal('${slotId}')">
              ✏️ Editar
            </button>
            <button class="btn-slot btn-fin-ensayo" onclick="confirmarFinalizarPrueba('${slotId}')" title="Concluir el ensayo actual: se archiva en histórico y se limpian fechas, manteniendo el equipo y foto en el puesto">
              🏁 Fin Ensayo
            </button>
          </div>
          <div class="slot-actions-row secondary">
            <button class="btn-slot" onclick="openTrackEquipmentModal('${escapeHtml((slot.iot && slot.iot.trim()) || (slot.equipo && slot.equipo.trim()) || slotId)}')" title="Rastrear trazabilidad e histórico por matrícula IoT">
              🔎 Rastrear
            </button>
            <button class="btn-slot" onclick="openSlotQRModal('${slotId}')" title="Generar QR de ${slotId}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              QR
            </button>
            <button class="btn-slot" onclick="openHistoricoModal('${slotId}')" title="Ver historial de ensayos en ${slotId}">
              📜 Historial
            </button>
            <button class="btn-slot btn-retirar" onclick="confirmarLiberar('${slotId}')" title="Desconectar y retirar el equipo completamente (slot queda vacío)">
              🚪 Retirar
            </button>
          </div>
        </div>
      `}
    </div>
  `;
}

function attachCardEvents() {
  // Los eventos onclick están integrados en las plantillas
}

async function toggleDataloggerDirectly(slotId, isChecked) {
  try {
    showToast(`Datalogger ${isChecked ? 'conectado 📊' : 'desconectado'} en ${slotId}`, isChecked ? "success" : "info");
    await Store.toggleDatalogger(slotId, isChecked);
  } catch (err) {
    console.error("Error al actualizar estado de datalogger:", err);
  }
}

/* Modales y Edición */
function openEditModal(slotId) {
  currentEditSlotId = slotId;
  const parsed = Store._parseSlotId(slotId, {});
  const slotData = (Store.data.slots && Store.data.slots[slotId]) || {
    puesto: parsed.puesto,
    slot: parsed.slot,
    estado: "libre"
  };

  const pInfo = Store.getPuestoInfo(slotData.puesto);
  document.getElementById("modal-edit-slot-title").textContent = `Editar ${slotId} (${pInfo.nombre})`;

  // Rellenar campos del formulario
  document.getElementById("form-equipo").value = slotData.equipo || "";
  document.getElementById("form-modelo").value = slotData.modelo || "";
  document.getElementById("form-sw").value = slotData.sw || "";
  document.getElementById("form-validacion").value = slotData.validacion || "";
  document.getElementById("form-iot").value = slotData.iot || "";
  const dataloggerCheck = document.getElementById("form-datalogger");
  if (dataloggerCheck) dataloggerCheck.checked = !!slotData.datalogger;
  document.getElementById("form-prueba").value = slotData.prueba || "";
  document.getElementById("form-responsable").value = slotData.responsable || "";
  document.getElementById("form-f-inicio").value = slotData.f_inicio || "";
  document.getElementById("form-f-final").value = slotData.f_final || "";
  document.getElementById("form-descripcion").value = slotData.descripcion || "";

  // Estado
  setModalStateRadio(slotData.estado || "libre");

  // Imagen
  currentTempImageData = slotData.imagen || "";
  updateImagePreview(currentTempImageData);

  document.getElementById("edit-slot-modal").classList.add("active");
}

function closeEditModal() {
  document.getElementById("edit-slot-modal").classList.remove("active");
  currentEditSlotId = null;
  currentTempImageData = null;
}

function setModalStateRadio(estado) {
  document.querySelectorAll(".state-radio-card").forEach(card => {
    const val = card.dataset.value;
    if (val === estado) {
      card.classList.add("selected");
      card.querySelector("input").checked = true;
    } else {
      card.classList.remove("selected");
      card.querySelector("input").checked = false;
    }
  });
}

function updateImagePreview(src) {
  const preview = document.getElementById("edit-image-preview");
  if (src) {
    preview.innerHTML = `<img src="${src}" alt="Foto equipo" />`;
  } else {
    preview.innerHTML = `<span class="placeholder">📷</span>`;
  }
}

async function handleImageFile(file) {
  if (!file) return;
  try {
    showToast("Comprimiendo y optimizando foto...", "info");
    const compressedDataUrl = await Store.compressImage(file);
    currentTempImageData = compressedDataUrl;
    updateImagePreview(compressedDataUrl);
    const approxKB = Math.round((compressedDataUrl.length * 3 / 4) / 1024);
    showToast(`Foto optimizada con éxito (${approxKB} KB)`, "success");
  } catch (e) {
    console.error(e);
    showToast("Error al procesar imagen", "error");
  }
}

async function saveSlotForm() {
  if (!currentEditSlotId) return;

  const targetSlotId = currentEditSlotId;
  const parsed = Store._parseSlotId(targetSlotId, {});
  const puesto = parsed.puesto;
  const slot = parsed.slot;

  // Obtener estado seleccionado
  let estado = "libre";
  const selectedRadio = document.querySelector(".state-radio-card.selected");
  if (selectedRadio) {
    estado = selectedRadio.dataset.value;
  }

  const equipo = document.getElementById("form-equipo").value.trim();
  const modelo = document.getElementById("form-modelo").value.trim();
  const sw = document.getElementById("form-sw").value.trim();
  const validacion = document.getElementById("form-validacion").value.trim();
  const iot = document.getElementById("form-iot").value.trim();
  const datalogger = document.getElementById("form-datalogger") ? document.getElementById("form-datalogger").checked : false;
  const prueba = document.getElementById("form-prueba").value.trim();
  const responsable = document.getElementById("form-responsable").value.trim();
  const f_inicio = document.getElementById("form-f-inicio").value;
  const f_final = document.getElementById("form-f-final").value;
  const descripcion = document.getElementById("form-descripcion").value.trim();
  const imagen = currentTempImageData || "";

  // Si se introduce cualquier dato y el estado sigue siendo "libre", cambiar automáticamente a en_uso_disponible
  const hasAnyData = !!equipo || !!modelo || !!sw || !!validacion || !!iot || !!prueba || !!responsable || !!descripcion || !!imagen || datalogger;
  if (hasAnyData && estado === "libre") {
    estado = "en_uso_disponible";
  }

  let finalEquipo = equipo;
  if (!finalEquipo && hasAnyData) {
    if (iot) finalEquipo = iot;
    else if (modelo) finalEquipo = modelo;
    else finalEquipo = `Equipo ${targetSlotId}`;
  }

  const slotData = {
    slot_id: targetSlotId,
    puesto,
    slot,
    estado,
    equipo: finalEquipo,
    modelo,
    sw,
    validacion,
    iot,
    datalogger,
    prueba,
    responsable,
    f_inicio,
    f_final,
    descripcion,
    imagen
  };

  closeEditModal();
  showToast(`Guardando ${targetSlotId}...`, "info");

  const syncResult = await Store.updateSlot(slotData);
  if (syncResult && syncResult.github) {
    showToast(`✅ ${targetSlotId} sincronizado en GitHub`, "success");
  } else if (syncResult && syncResult.localOnly) {
    showToast(`⚠️ ${targetSlotId} guardado SOLO en este móvil (Falta autorizar GitHub)`, "warning");
  } else {
    showToast(`✅ ${targetSlotId} actualizado`, "success");
  }
}

async function confirmarFinalizarPrueba(slotId) {
  const slot = (Store.data.slots && Store.data.slots[slotId]) || {};
  const nombreEquipo = slot.equipo || (slot.iot ? `Equipo ${slot.iot}` : slotId);
  const pruebaActual = slot.prueba ? `"${slot.prueba}"` : "el ensayo actual";

  const confirmMsg = `¿Dar por FINALIZADO ${pruebaActual} en ${slotId} (${nombreEquipo})?\n\n` +
    `✅ Se guardará en el Histórico con fecha fin de hoy.\n` +
    `📌 El equipo, fotos, código IoT y notas de carátula se MANTIENEN en el puesto.\n` +
    `🔄 Se limpian las fechas para iniciar el siguiente ensayo cuando quieras.`;

  if (confirm(confirmMsg)) {
    showToast(`Archivando ensayo de ${slotId}...`, "info");
    const syncResult = await Store.finalizarPruebaSlot(slotId);
    if (syncResult && syncResult.github) {
      showToast(`✅ Ensayo archivado. ${nombreEquipo} continúa conectado en ${slotId}.`, "success");
    } else {
      showToast(`Ensayo archivado en Histórico (Guardado localmente)`, "info");
    }
  }
}

async function finalizarPruebaDesdeModal() {
  if (!currentEditSlotId) return;
  const slotId = currentEditSlotId;
  closeEditModal();
  await confirmarFinalizarPrueba(slotId);
}

async function confirmarLiberar(slotId) {
  const slot = (Store.data.slots && Store.data.slots[slotId]) || {};
  const nombreEquipo = slot.equipo || (slot.iot ? `Equipo ${slot.iot}` : slotId);
  if (confirm(`¿RETIRAR y dejar totalmente VACÍO el puesto ${slotId} (${nombreEquipo})?\n\n• El equipo y fotos se archivarán en el Histórico.\n• El puesto quedará LIBRE para conectar otro equipo nuevo desde cero.`)) {
    const syncResult = await Store.liberarSlot(slotId);
    if (syncResult && syncResult.github) {
      showToast(`✅ ${slotId} retirado y archivado en GitHub (Puesto Libre)`, "warning");
    } else {
      showToast(`${slotId} retirado y archivado en el Histórico`, "warning");
    }
  }
}

/* Visor de Imágenes a Pantalla Completa */
function openImageViewer(src, title = "Foto del Equipo") {
  if (!src || src.includes("undefined") || src.includes("null")) return;
  const modal = document.getElementById("image-viewer-modal");
  if (!modal) return;
  document.getElementById("viewer-img-title").textContent = title;
  document.getElementById("viewer-img-src").src = src;
  modal.classList.add("active");
}

function closeImageViewer() {
  const modal = document.getElementById("image-viewer-modal");
  if (modal) {
    modal.classList.remove("active");
    const img = document.getElementById("viewer-img-src");
    if (img) img.src = "";
  }
}

/* Modal Conexión Móvil */
function openMobileConnectModal() {
  const modal = document.getElementById("mobile-connect-modal");
  if (!modal) return;

  // Determinar la URL para que el móvil se conecte
  let url = window.location.href.split("#")[0].split("?")[0];
  if (Store.networkInfo && Store.networkInfo.network_url) {
    url = Store.networkInfo.network_url;
  }

  // Incluir token de autorización para que el móvil se autorice automáticamente con 1 solo escaneo
  const token = Store.githubConfig.token;
  let qrUrl = url;
  if (token && window.location.hostname.includes("github.io")) {
    qrUrl = `${url}?auth=${encodeURIComponent(token)}`;
  }

  const urlEl = document.getElementById("mobile-url-text");
  if (urlEl) urlEl.textContent = url;

  const badgeEl = document.getElementById("mobile-ip-badge");
  if (badgeEl) {
    if (window.location.hostname.includes("github.io")) {
      badgeEl.textContent = "🌐 Acceso Cloud GitHub Pages (Autorización Rápida)";
    } else {
      badgeEl.textContent = `Host: ${window.location.hostname}`;
    }
  }

  const qrContainer = document.getElementById("mobile-qr-canvas");
  if (qrContainer) {
    qrContainer.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qrContainer, {
        text: qrUrl,
        width: 220,
        height: 220,
        colorDark: "#0f172a",
        colorLight: "#ffffff"
      });
    }
  }

  modal.classList.add("active");
}

function closeMobileConnectModal() {
  const modal = document.getElementById("mobile-connect-modal");
  if (modal) modal.classList.remove("active");
}

/* Escáner de Códigos QR con Cámara */
function openQRScannerModal() {
  const modal = document.getElementById("qr-scanner-modal");
  modal.classList.add("active");

  QRScanner.start("qr-video-element", (result) => {
    closeQRScannerModal();
    if (result.puesto && result.slot) {
      const slotId = (result.puesto.length > 2 || result.puesto.includes('_')) ? `${result.puesto}_${result.slot}` : `${result.puesto}${result.slot}`;
      showToast(`Código detectado: ${slotId}`, "success");
      openEditModal(slotId);
    } else if (result.puesto) {
      showToast(`Puesto ${result.puesto} seleccionado`, "success");
      currentPuestoFilter = result.puesto;
      renderApp();
    } else {
      showToast(`QR detectado: ${result.raw}`, "warning");
    }
  });
}

function closeQRScannerModal() {
  QRScanner.stop();
  document.getElementById("qr-scanner-modal").classList.remove("active");
}

/* Carteles QR para Imprimir */
function openQRPrintModal(mode = "todos") {
  const modal = document.getElementById("qr-print-modal");
  const titleEl = document.getElementById("qr-print-modal-title");
  const subEl = document.getElementById("qr-print-modal-subtitle");
  const filterLabel = document.getElementById("print-modal-filter-label");
  const buttonsContainer = document.getElementById("print-filter-buttons");

  if (titleEl) titleEl.textContent = "Carteles QR para Paneles de Cabina";
  if (subEl) subEl.textContent = "Imprime y pega los carteles para acceder directamente con la cámara del móvil";
  if (filterLabel) filterLabel.textContent = "Selecciona qué carteles generar:";
  if (buttonsContainer) {
    buttonsContainer.innerHTML = `
      <button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="QRGenerator.renderPrintSheet('print-sheet-container', 'todos')">🏢 Todos los Puestos (Zonas 1 a 7)</button>
      <button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="QRGenerator.renderPrintSheet('print-sheet-container', 'zona1')">⚡ Zona 1: Cabinas Test (A - J)</button>
      <button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="QRGenerator.renderPrintSheet('print-sheet-container', 'pilotos')">🧪 Zonas 2 a 7: Plantas Piloto</button>
      <button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="QRGenerator.renderPrintSheet('print-sheet-container', 'slots')">🏷️ Identificadores Individuales (A1 - EC2_4)</button>
    `;
  }

  modal.classList.add("active");
  QRGenerator.renderPrintSheet("print-sheet-container", mode);
}

function closeQRPrintModal() {
  document.getElementById("qr-print-modal").classList.remove("active");
}

function openPuestoQRModal(puestoId) {
  const p = Store.getPuestoInfo(puestoId);
  if (!p) {
    openQRPrintModal("todos");
    return;
  }

  const modal = document.getElementById("qr-print-modal");
  const titleEl = document.getElementById("qr-print-modal-title");
  const subEl = document.getElementById("qr-print-modal-subtitle");
  const filterLabel = document.getElementById("print-modal-filter-label");
  const buttonsContainer = document.getElementById("print-filter-buttons");

  if (titleEl) titleEl.textContent = `Carteles QR: ${p.nombre} (${p.id})`;
  if (subEl) subEl.textContent = `Cartel general del ${p.nombre} y sus identificadores individuales`;
  if (filterLabel) filterLabel.textContent = `Opciones para ${p.id}:`;

  const count = p.slotsCount || 4;
  const rangeStr = p.id.length > 2 || p.id.includes('_') ? `${p.id}_1 a ${p.id}_${count}` : `${p.id}1 a ${p.id}${count}`;

  if (buttonsContainer) {
    buttonsContainer.innerHTML = `
      <button class="btn btn-primary" style="font-size: 0.75rem;" onclick="QRGenerator.renderPrintSheet('print-sheet-container', 'single_puesto_completo', '${puestoId}')">📑 Puesto Completo (${p.id} + ${rangeStr})</button>
      <button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="QRGenerator.renderPrintSheet('print-sheet-container', 'single_puesto', '${puestoId}')">📌 Solo Puesto ${p.id}</button>
      <button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="QRGenerator.renderPrintSheet('print-sheet-container', 'single_puesto_slots', '${puestoId}')">🏷️ Solo Posiciones (${rangeStr})</button>
      <button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="openQRPrintModal('todos')">🏢 Ver todos los puestos...</button>
    `;
  }

  modal.classList.add("active");
  QRGenerator.renderPrintSheet("print-sheet-container", "single_puesto_completo", puestoId);
}

function openSlotQRModal(slotId) {
  const parsed = Store._parseSlotId(slotId, {});
  const p = Store.getPuestoInfo(parsed.puesto);

  const modal = document.getElementById("qr-print-modal");
  const titleEl = document.getElementById("qr-print-modal-title");
  const subEl = document.getElementById("qr-print-modal-subtitle");
  const filterLabel = document.getElementById("print-modal-filter-label");
  const buttonsContainer = document.getElementById("print-filter-buttons");

  if (titleEl) titleEl.textContent = `Código QR: ${slotId}`;
  if (subEl) subEl.textContent = `Acceso directo y cartel para la posición ${slotId} (${p ? p.nombre : ''})`;
  if (filterLabel) filterLabel.textContent = `Opciones:`;

  if (buttonsContainer) {
    buttonsContainer.innerHTML = `
      <button class="btn btn-primary" style="font-size: 0.75rem;" onclick="QRGenerator.renderPrintSheet('print-sheet-container', 'single_slot', '${slotId}')">🏷️ Solo ${slotId}</button>
      ${p ? `<button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="openPuestoQRModal('${p.id}')">📑 Ver Puesto ${p.id} completo</button>` : ''}
      <button class="btn btn-secondary" style="font-size: 0.75rem;" onclick="openQRPrintModal('todos')">🏢 Ver todos los puestos...</button>
    `;
  }

  modal.classList.add("active");
  QRGenerator.renderPrintSheet("print-sheet-container", "single_slot", slotId);
}

/* Edición y Personalización de Nombres de Zonas y Puestos */
function openEditZonasModal() {
  openEditPuestosModal();
}

/* Modal Ajustes y Sincronización */
function openSyncModal() {
  document.getElementById("sync-modal").classList.add("active");
  const tokenInput = document.getElementById("github-token-input");
  const urlInput = document.getElementById("qr-base-url-input");
  
  if (tokenInput) tokenInput.value = Store.githubConfig.token || "";
  if (urlInput) urlInput.value = QRGenerator.getBaseUrl();
  updateGitHubStatusUI();
}

function closeSyncModal() {
  document.getElementById("sync-modal").classList.remove("active");
}

function updateGitHubStatusUI() {
  const badge = document.getElementById("github-status-badge");
  const headerBadge = document.getElementById("cloud-sync-status-badge");
  const authBanner = document.getElementById("cloud-auth-banner");

  const hasToken = !!(Store.githubConfig.token && Store.githubConfig.token.trim());

  if (badge) {
    if (hasToken) {
      badge.textContent = "🟢 Conectado (Escritura activa)";
      badge.style.background = "rgba(16, 185, 129, 0.2)";
      badge.style.color = "#34d399";
    } else {
      badge.textContent = "🟡 Solo Lectura / Local (Sin token)";
      badge.style.background = "rgba(245, 158, 11, 0.2)";
      badge.style.color = "#fbbf24";
    }
  }

  if (headerBadge) {
    if (hasToken) {
      headerBadge.innerHTML = "☁️ Cloud OK";
      headerBadge.title = "Conectado a GitHub: sincronización en la nube activa";
      headerBadge.style.background = "rgba(16, 185, 129, 0.25)";
      headerBadge.style.color = "#34d399";
      headerBadge.style.border = "1px solid rgba(16, 185, 129, 0.5)";
    } else {
      headerBadge.innerHTML = "⚠️ Solo Local";
      headerBadge.title = "Dispositivo NO conectado a GitHub: pulsa aquí para autorizarlo";
      headerBadge.style.background = "rgba(239, 68, 68, 0.25)";
      headerBadge.style.color = "#f87171";
      headerBadge.style.border = "1px solid rgba(239, 68, 68, 0.5)";
    }
  }

  if (authBanner) {
    authBanner.style.display = hasToken ? "none" : "block";
  }
}

async function saveGitHubSettings() {
  const tokenInput = document.getElementById("github-token-input");
  const token = tokenInput ? tokenInput.value.trim() : "";

  Store.setGitHubToken(token);
  updateGitHubStatusUI();

  if (token) {
    showToast("Probando conexión con idegis/test_cabinas...", "info");
    const testResult = await Store.saveToGitHub("Verificación de conexión desde la app");
    if (testResult.success) {
      showToast("✅ Conectado con éxito a GitHub. Sincronización activa.", "success");
      updateGitHubStatusUI();
    } else {
      showToast(`⚠️ Token guardado, pero GitHub devolvió: ${testResult.error || 'Verifica permisos'}`, "warning");
    }
  } else {
    showToast("Token eliminado. Modo lectura activa.", "info");
  }
}

async function testGitHubConnection() {
  showToast("Consultando GitHub API...", "info");
  await Store.fetchData();
  if (Store.isGitHubConnected) {
    showToast("✅ Conexión con idegis/test_cabinas confirmada.", "success");
  } else {
    showToast("⚠️ No se pudo verificar con GitHub. Comprueba el token o la red.", "warning");
  }
  updateGitHubStatusUI();
}

function saveBaseUrlSetting() {
  const urlInput = document.getElementById("qr-base-url-input");
  if (urlInput && urlInput.value.trim()) {
    QRGenerator.setBaseUrl(urlInput.value.trim());
    showToast("✅ URL base de carteles QR guardada correctamente.", "success");
  }
}

async function syncNowFromDevice() {
  if (!Store.githubConfig.token) {
    showToast("⚠️ Este móvil no tiene el token configurado. Abre el enlace de autorización o pégalo en Ajustes.", "error");
    return;
  }
  showToast("☁️ Conectando con GitHub y subiendo datos de este dispositivo...", "info");
  const res = await Store.saveToGitHub("Sincronización manual forzada desde dispositivo");
  if (res && res.github) {
    showToast("✅ ¡Todos los datos y fotos de este móvil se han guardado con éxito en GitHub!", "success");
  } else if (res && res.localOnly) {
    showToast("⚠️ Falta token en este dispositivo.", "error");
  } else {
    showToast("⚠️ Fallo al subir a GitHub: " + (res.error || "comprueba conexión"), "error");
  }
}

function exportDatabaseJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(Store.data, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `database_cabina_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Descargando copia database.json...", "success");
}

function importDatabaseJSON(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.slots) {
        Store.applyRemoteData(parsed);
        await Store.saveToGitHub("Importar copia de seguridad database.json");
        showToast("✅ Base de datos importada y sincronizada correctamente.", "success");
      } else {
        showToast("El archivo JSON no tiene el formato esperado.", "danger");
      }
    } catch (err) {
      showToast("Error al parsear el archivo JSON.", "danger");
    }
  };
  reader.readAsText(file);
}

/* ==========================================================================
   CONFIGURACIÓN Y EDICIÓN DE NOMBRES DE ZONAS Y PUESTOS
   ========================================================================== */

function openEditPuestosModal() {
  const container = document.getElementById("edit-puestos-container");
  if (!container) return;

  const plantas = Store.getPlantas();
  let html = `
    <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 0.8rem 1rem; margin-bottom: 1rem; font-size: 0.8rem; color: #bae6fd; display: flex; align-items: center; gap: 0.6rem;">
      <span style="font-size: 1.2rem;">💡</span>
      <span>Aquí puedes editar los nombres identificativos de las <strong>7 Zonas</strong> y de todos los <strong>Puestos</strong>. Al guardar, los cambios se sincronizan en la nube y se reflejan en pantalla y carteles QR.</span>
    </div>
  `;

  plantas.forEach((pl, zIdx) => {
    const totalSlotsInZone = pl.puestos.reduce((acc, p) => acc + (p.slotsCount || 4), 0);
    html += `
      <div class="edit-zone-card" style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.1rem; margin-bottom: 1rem;">
        <!-- Edición del Nombre de la Zona -->
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <span style="font-size: 1.5rem;">${pl.icono || '🏢'}</span>
          <div style="flex: 1;">
            <label style="display: block; font-size: 0.7rem; text-transform: uppercase; color: var(--accent-cyan); font-weight: 700; margin-bottom: 0.25rem;">
              Nombre de la Zona ${zIdx + 1} (${pl.puestos.length} puestos · ${totalSlotsInZone} en total)
            </label>
            <input type="text" class="form-input zone-name-input" data-zone-id="${pl.id}" value="${escapeHtml(pl.nombre)}" placeholder="Ej: Zona ${zIdx + 1}: Nombre descriptivo" style="font-size: 0.95rem; font-weight: 700; color: #fff; background: rgba(0,0,0,0.35); border-color: rgba(56,189,248,0.3);" />
          </div>
        </div>

        <!-- Puestos asignados a esta zona -->
        <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.5rem; font-weight: 700; letter-spacing: 0.05em;">
          Puestos de trabajo configurados:
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem;">
    `;

    pl.puestos.forEach(p => {
      html += `
        <div style="background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); padding: 0.6rem 0.8rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: 800; color: var(--accent-cyan); background: rgba(56,189,248,0.15); padding: 0.1rem 0.45rem; border-radius: 4px;">
              ID: ${p.id}
            </span>
            <span style="font-size: 0.7rem; color: var(--text-dim);">
              ${p.slotsCount || 4} posiciones
            </span>
          </div>
          <input type="text" class="form-input puesto-name-input" data-puesto-id="${p.id}" value="${escapeHtml(p.nombre)}" placeholder="Nombre del puesto" style="font-size: 0.82rem; padding: 0.35rem 0.6rem;" />
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  const modal = document.getElementById("edit-puestos-modal");
  if (modal) modal.classList.add("active");
}

function closeEditPuestosModal() {
  const modal = document.getElementById("edit-puestos-modal");
  if (modal) modal.classList.remove("active");
}

async function savePuestosConfig() {
  const container = document.getElementById("edit-puestos-container");
  if (!container) return;

  const currentPlantas = JSON.parse(JSON.stringify(Store.getPlantas()));

  // 1. Recoger nombres de Zonas
  container.querySelectorAll(".zone-name-input").forEach(input => {
    const zoneId = input.dataset.zoneId;
    const newName = input.value.trim();
    if (newName) {
      const pl = currentPlantas.find(z => z.id === zoneId);
      if (pl) pl.nombre = newName;
    }
  });

  // 2. Recoger nombres de Puestos
  container.querySelectorAll(".puesto-name-input").forEach(input => {
    const puestoId = input.dataset.puestoId;
    const newName = input.value.trim();
    if (newName) {
      for (const pl of currentPlantas) {
        const p = pl.puestos.find(item => item.id === puestoId);
        if (p) {
          p.nombre = newName;
          break;
        }
      }
    }
  });

  closeEditPuestosModal();
  showToast("💾 Guardando nombres de zonas y puestos...", "info");

  await Store.updatePuestosConfig(currentPlantas);
  renderApp();
  showToast("✅ Nombres de zonas y puestos actualizados y sincronizados.", "success");
}

async function openRenameSinglePuestoModal(puestoId, currentNombre) {
  const nuevoNombre = prompt(`Editar nombre del puesto "${puestoId}":`, currentNombre || `Puesto ${puestoId}`);
  if (nuevoNombre !== null && nuevoNombre.trim() && nuevoNombre.trim() !== currentNombre) {
    showToast(`Guardando nuevo nombre para puesto ${puestoId}...`, "info");
    await Store.updatePuestoNombre(puestoId, nuevoNombre.trim());
    renderApp();
    showToast(`✅ Puesto renombrado a "${nuevoNombre.trim()}"`, "success");
  }
}

async function openRenameZonaModal(zonaId, currentNombre) {
  const nuevoNombre = prompt(`Editar nombre de la Zona:`, currentNombre);
  if (nuevoNombre !== null && nuevoNombre.trim() && nuevoNombre.trim() !== currentNombre) {
    showToast("Guardando nuevo nombre de zona...", "info");
    await Store.updateZonaNombre(zonaId, nuevoNombre.trim());
    renderApp();
    showToast(`✅ Zona renombrada a "${nuevoNombre.trim()}"`, "success");
  }
}

/* UI Listeners */
function setupEventListeners() {
  // Buscador
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderPuestos();
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && searchInput.value.trim()) {
        openTrackEquipmentModal(searchInput.value.trim());
      }
    });
  }

  // Buscador de rastreador global
  const trackInput = document.getElementById("track-search-input");
  if (trackInput) {
    trackInput.addEventListener("input", () => {
      performEquipmentTracking();
    });
    trackInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") performEquipmentTracking();
    });
  }

  // Filtro de estados
  document.querySelectorAll(".filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentStatusFilter = pill.dataset.status;
      renderPuestos();
    });
  });

  // Selector de radio de estado en modal
  document.querySelectorAll(".state-radio-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".state-radio-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
    });
  });

  // Input de imagen (subir archivo)
  const fileInput = document.getElementById("file-input");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0]);
      }
    });
  }

  // Input de cámara
  const cameraInput = document.getElementById("camera-input");
  if (cameraInput) {
    cameraInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0]);
      }
    });
  }

  // Botón fecha "Hoy"
  const btnHoy = document.getElementById("btn-set-today");
  if (btnHoy) {
    btnHoy.addEventListener("click", () => {
      const today = new Date().toISOString().split("T")[0];
      document.getElementById("form-f-inicio").value = today;
    });
  }

  // Buscador de Histórico
  const histSearch = document.getElementById("historico-search-input");
  if (histSearch) {
    histSearch.addEventListener("input", (e) => {
      currentHistoricoSearch = e.target.value;
      renderHistorico();
    });
  }
}

function resetFilters() {
  currentPuestoFilter = "all";
  currentStatusFilter = "all";
  searchQuery = "";
  const input = document.getElementById("search-input");
  if (input) input.value = "";
  document.querySelectorAll(".filter-pill").forEach((p, idx) => {
    if (idx === 0) p.classList.add("active");
    else p.classList.remove("active");
  });
  renderApp();
}

/* ==========================================================================
   RASTREADOR GLOBAL DE EQUIPOS (TRAZABILIDAD Y HISTORIAL DE PUESTOS)
   ========================================================================== */
let currentTrackedQuery = "";

function openTrackEquipmentModal(initialQuery = "") {
  const modal = document.getElementById("track-equipment-modal");
  if (!modal) return;

  const searchInput = document.getElementById("track-search-input");
  renderTrackQuickChips();

  if (initialQuery && initialQuery.trim()) {
    if (searchInput) searchInput.value = initialQuery.trim();
    currentTrackedQuery = initialQuery.trim();
    performEquipmentTracking();
  } else {
    if (searchInput) searchInput.value = "";
    currentTrackedQuery = "";
    renderTrackResults(null);
  }

  modal.classList.add("active");
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 150);
  }
}

function closeTrackEquipmentModal() {
  const modal = document.getElementById("track-equipment-modal");
  if (modal) modal.classList.remove("active");
}

function clearTrackSearch() {
  const searchInput = document.getElementById("track-search-input");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("track-clear-btn");
  if (clearBtn) clearBtn.style.display = "none";
  currentTrackedQuery = "";
  renderTrackQuickChips();
  renderTrackResults(null);
  if (searchInput) searchInput.focus();
}

function renderTrackQuickChips() {
  const container = document.getElementById("track-quick-chips");
  if (!container) return;

  const known = Store.getAllKnownEquipments();
  if (known.length === 0) {
    container.innerHTML = `<span style="font-size: 0.72rem; color: var(--text-dim);">No hay matrículas registradas aún</span>`;
    return;
  }

  container.innerHTML = known.slice(0, 16).map(eq => {
    const chipQuery = eq.iot || eq.nombre;
    const label = eq.iot ? `🏷️ IoT: ${escapeHtml(eq.iot)}` : `⚡ ${escapeHtml(eq.nombre)}`;
    const sub = (eq.iot && eq.equipo && eq.equipo !== eq.iot) ? ` (${escapeHtml(eq.equipo)})` : (eq.modelo ? ` (${escapeHtml(eq.modelo)})` : '');
    return `
      <button class="eq-track-chip ${currentTrackedQuery.toLowerCase() === chipQuery.toLowerCase() ? 'active' : ''}" onclick="selectTrackChip('${escapeHtml(chipQuery)}')">
        <span>${eq.is_connected ? '🟢' : '⚪'}</span>
        <span>${label}</span>
        ${sub ? `<small style="opacity: 0.65; font-size: 0.72rem;">${sub}</small>` : ''}
      </button>
    `;
  }).join("");
}

function selectTrackChip(eqName) {
  const input = document.getElementById("track-search-input");
  if (input) input.value = eqName;
  currentTrackedQuery = eqName;
  performEquipmentTracking();
}

function performEquipmentTracking() {
  const input = document.getElementById("track-search-input");
  const clearBtn = document.getElementById("track-clear-btn");
  const query = (input ? input.value : "").trim();
  currentTrackedQuery = query;

  if (clearBtn) clearBtn.style.display = query ? "block" : "none";

  renderTrackQuickChips();

  if (!query) {
    renderTrackResults(null);
    return;
  }

  const tracking = Store.trackEquipment(query);
  renderTrackResults(tracking);
}

function renderTrackResults(tracking) {
  const container = document.getElementById("track-results-container");
  const summaryLabel = document.getElementById("track-results-summary");
  const exportBtn = document.getElementById("btn-export-track-csv");

  if (!container) return;

  if (!tracking) {
    if (exportBtn) exportBtn.style.display = "none";
    if (summaryLabel) summaryLabel.textContent = "Escribe el nombre o modelo de un equipo para ver dónde ha estado y su estado actual.";
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
        <div style="font-size: 2.5rem; margin-bottom: 0.8rem; opacity: 0.5;">🔎</div>
        <div style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem; color: #fff;">Rastreador y Auditoría de Equipos</div>
        <p style="font-size: 0.85rem; max-width: 480px; margin: 0 auto; line-height: 1.5;">
          Esta búsqueda revisa todos los puestos de <strong>Planta Cabina (A a J)</strong>, <strong>Planta Piloto (Cellguard y EC)</strong> y el <strong>Histórico Completo</strong> de ensayos anteriores.
        </p>
      </div>
    `;
    return;
  }

  const { query, activeLocations, historyLocations, totalCount } = tracking;

  if (totalCount === 0) {
    if (exportBtn) exportBtn.style.display = "none";
    if (summaryLabel) summaryLabel.textContent = `No se encontraron registros para "${query}".`;
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
        <div style="font-size: 2.2rem; margin-bottom: 0.8rem; opacity: 0.5;">🔍❓</div>
        <div style="font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; color: #fff;">Sin resultados para "${escapeHtml(query)}"</div>
        <p style="font-size: 0.82rem; max-width: 440px; margin: 0 auto;">
          No se ha encontrado ningún equipo conectado ni en el histórico que coincida con ese nombre, modelo o responsable.
        </p>
      </div>
    `;
    return;
  }

  if (exportBtn) exportBtn.style.display = "block";
  if (summaryLabel) {
    summaryLabel.textContent = `Resultados para "${query}": ${activeLocations.length} activa(s) y ${historyLocations.length} estancia(s) archivada(s).`;
  }

  let html = "";

  // 1. SECCIÓN: DÓNDE ESTÁ AHORA MISMO
  html += `
    <div style="margin-bottom: 0.5rem;">
      <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
        <span>📍</span>
        <span>UBICACIÓN ACTUAL (EN ESTE MOMENTO)</span>
      </h4>
  `;

  if (activeLocations.length > 0) {
    activeLocations.forEach(loc => {
      const isCritico = loc.estado === "no_tocar";
      html += `
        <div class="track-active-banner ${isCritico ? 'no_tocar' : ''}">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 2rem;">${loc.planta_icono || '📍'}</div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.4); padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; color: #38bdf8;">
                  ${loc.planta_nombre} · ${loc.puesto_nombre} · ${loc.slot_id}
                </span>
                <span class="badge-status ${loc.estado === 'no_tocar' ? 'badge-danger' : 'badge-success'}" style="font-size: 0.72rem;">
                  ${loc.estado === 'no_tocar' ? '🔴 No Tocar (Crítico)' : '🟢 En Uso'}
                </span>
              </div>
              <div style="font-size: 1.1rem; font-weight: 700; color: #fff; margin-top: 0.2rem;">
                ${escapeHtml(loc.equipo)}
                ${loc.modelo ? `<span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">· ${escapeHtml(loc.modelo)}</span>` : ''}
              </div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.35rem; font-size: 0.72rem;">
                ${loc.sw ? `<span class="meta-chip sw">SW: ${escapeHtml(loc.sw)}</span>` : ''}
                ${loc.iot ? `<span class="meta-chip iot">IoT: ${escapeHtml(loc.iot)}</span>` : ''}
                ${loc.responsable ? `<span class="meta-chip user">👤 ${escapeHtml(loc.responsable)}</span>` : ''}
                ${loc.f_inicio ? `<span class="meta-chip">📅 Conectado desde: ${loc.f_inicio}</span>` : ''}
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-primary" onclick="goToSlotAndHighlight('${loc.planta_id}', '${loc.slot_id}')" style="font-size: 0.8rem; padding: 0.45rem 0.9rem;">
              👉 Ver ${loc.slot_id}
            </button>
          </div>
        </div>
      `;
    });
  } else {
    html += `
      <div class="track-inactive-banner">
        <span style="font-size: 1.4rem;">⚪</span>
        <div>
          <strong style="color: #fff; display: block; margin-bottom: 0.15rem;">Actualmente NO está conectado en ningún puesto</strong>
          <span>El equipo no se encuentra en uso activo. Consulta su historial abajo para ver dónde estuvo.</span>
        </div>
      </div>
    `;
  }

  html += `</div>`;

  // 2. SECCIÓN: HISTORIAL CRONOLÓGICO DE DÓNDE HA ESTADO
  html += `
    <div style="margin-top: 1rem;">
      <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
        <span>📜</span>
        <span>HISTORIAL DE PUESTOS Y ENSAYOS (${historyLocations.length} estancias registradas)</span>
      </h4>
  `;

  if (historyLocations.length > 0) {
    html += `<div class="track-timeline">`;
    historyLocations.forEach(item => {
      html += `
        <div class="track-timeline-item">
          <div class="track-timeline-node"></div>
          <div class="track-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.4rem;">
              <div>
                <span style="font-family: var(--font-mono); font-size: 0.75rem; background: #1e293b; color: #38bdf8; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700; border: 1px solid rgba(56,189,248,0.25);">
                  ${item.planta_nombre || 'Cabina'} · ${item.puesto_nombre || `Puesto ${item.puesto}`} · ${item.slot_id}
                </span>
                <strong style="font-size: 0.95rem; color: #fff; margin-left: 0.4rem;">${escapeHtml(item.equipo || 'Equipo')}</strong>
                ${item.modelo ? `<span style="color: var(--text-dim); font-size: 0.82rem;">· ${escapeHtml(item.modelo)}</span>` : ''}
              </div>
              <span style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">
                Archivado: ${item.fecha_registro ? item.fecha_registro.slice(0, 10) : '--'}
              </span>
            </div>

            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.4rem 0;">
              ${item.sw ? `<span class="meta-chip sw">SW: ${escapeHtml(item.sw)}</span>` : ''}
              ${item.iot ? `<span class="meta-chip iot">IoT: ${escapeHtml(item.iot)}</span>` : ''}
              ${item.responsable ? `<span class="meta-chip user">👤 ${escapeHtml(item.responsable)}</span>` : ''}
              ${item.prueba ? `<span class="meta-chip" style="background: rgba(56,189,248,0.12); color: #38bdf8;">Ensayo: ${escapeHtml(item.prueba)}</span>` : ''}
              ${item.motivo_cierre ? `<span class="meta-chip" style="background: rgba(244,63,94,0.12); color: #f43f5e;">Cierre: ${escapeHtml(item.motivo_cierre)}</span>` : ''}
            </div>

            ${item.descripcion ? `
              <div style="font-size: 0.75rem; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 0.4rem 0.6rem; border-radius: 4px; border-left: 2px solid rgba(255,255,255,0.15); margin-bottom: 0.4rem;">
                ${escapeHtml(item.descripcion)}
              </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--text-dim); margin-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.35rem;">
              <span>📅 Período de estancia: <strong>${item.f_inicio || '--'}</strong> al <strong>${item.f_final || '--'}</strong></span>
              ${item.imagen ? `
                <button class="btn-slot" onclick="openImageViewer('${item.imagen}', '${escapeHtml(item.equipo)}')" style="font-size: 0.7rem; padding: 0.15rem 0.4rem;">
                  📷 Ver Foto de Instalación
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  } else {
    html += `
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px dashed rgba(255, 255, 255, 0.08); border-radius: var(--radius-md); padding: 1rem; text-align: center; color: var(--text-dim); font-size: 0.8rem;">
        No hay registros en el histórico previo para este equipo.
      </div>
    `;
  }

  html += `</div>`;

  container.innerHTML = html;
}

function goToSlotAndHighlight(plantaId, slotId) {
  closeTrackEquipmentModal();

  // Cambiar planta activa si es necesario
  if (currentPlantaFilter !== "all" && currentPlantaFilter !== plantaId) {
    currentPlantaFilter = plantaId;
  }
  currentPuestoFilter = "all";
  renderApp();

  // Buscar la tarjeta de la bahía y resaltarla
  setTimeout(() => {
    const card = document.querySelector(`.slot-card[data-slot-id="${slotId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.remove("slot-highlight-pulse");
      void card.offsetWidth;
      card.classList.add("slot-highlight-pulse");
    }
  }, 250);
}

function exportTrackedEquipmentCSV() {
  if (!currentTrackedQuery) return;
  const csvData = Store.exportEquipmentAuditCSV(currentTrackedQuery);
  if (!csvData) {
    showToast("No hay datos para exportar de este equipo.", "warning");
    return;
  }

  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const sanitizedName = currentTrackedQuery.replace(/[^a-zA-Z0-9_-]/g, "_");
  link.setAttribute("download", `rastreo_equipo_${sanitizedName}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Ficha de trazabilidad descargada correctamente", "success");
}

/* HISTÓRICO DE ENSAYOS Y EQUIPOS */
let currentHistoricoPuesto = "all";
let currentHistoricoSlot = null;
let currentHistoricoSearch = "";

function openHistoricoModal(slotId = null) {
  currentHistoricoSlot = slotId;
  currentHistoricoSearch = "";
  const modal = document.getElementById("historico-modal");
  const searchInput = document.getElementById("historico-search-input");
  if (searchInput) searchInput.value = "";

  if (slotId) {
    const pInfo = Store.getPuestoInfo(slotId.split("_")[0] || slotId[0]);
    currentHistoricoPuesto = slotId.split("_")[0] || slotId[0];
    document.getElementById("historico-modal-title").textContent = `Historial de ${slotId} (${pInfo.nombre})`;
  } else {
    currentHistoricoPuesto = "all";
    document.getElementById("historico-modal-title").textContent = "Historial General de la Cabina";
  }

  renderHistoricoPills();
  renderHistorico();
  modal.classList.add("active");
}

function renderHistoricoPills() {
  const container = document.getElementById("historico-puesto-pills");
  if (!container) return;

  const plantas = Store.getPlantas();
  let html = `<button class="filter-pill ${currentHistoricoPuesto === 'all' ? 'active' : ''}" data-puesto="all" onclick="filterHistoricoByPuesto('all')">Todos</button>`;

  plantas.forEach(pl => {
    pl.puestos.forEach(p => {
      html += `<button class="filter-pill ${currentHistoricoPuesto === p.id ? 'active' : ''}" data-puesto="${p.id}" onclick="filterHistoricoByPuesto('${p.id}')" title="${pl.nombre} · ${p.nombre}">${p.id}</button>`;
    });
  });

  container.innerHTML = html;
}

function closeHistoricoModal() {
  document.getElementById("historico-modal").classList.remove("active");
}

function filterHistoricoByPuesto(puesto) {
  currentHistoricoPuesto = puesto;
  currentHistoricoSlot = null; // Reiniciar filtro por slot específico al cambiar de puesto
  const pInfo = Store.getPuestoInfo(puesto);
  document.getElementById("historico-modal-title").textContent = puesto === "all" ? "Historial General de la Cabina" : `Historial de ${pInfo.nombre}`;
  document.querySelectorAll("#historico-puesto-pills .filter-pill").forEach(pill => {
    if (pill.dataset.puesto === puesto) pill.classList.add("active");
    else pill.classList.remove("active");
  });
  renderHistorico();
}

function renderHistorico() {
  const container = document.getElementById("historico-list-container");
  const countLabel = document.getElementById("historico-count-label");
  if (!container) return;

  const historico = Store.data.historico || [];

  // Filtrar
  const filtered = historico.filter(item => {
    // Filtro puesto / bahía
    if (currentHistoricoSlot && item.slot_id !== currentHistoricoSlot) return false;
    if (currentHistoricoPuesto !== "all" && item.puesto !== currentHistoricoPuesto) return false;

    // Filtro búsqueda
    if (currentHistoricoSearch) {
      const q = currentHistoricoSearch.toLowerCase();
      const searchable = [
        item.equipo, item.modelo, item.sw, item.validacion, item.iot,
        item.prueba, item.responsable, item.descripcion, item.slot_id, item.motivo_cierre
      ].filter(Boolean).join(" ").toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    return true;
  });

  if (countLabel) countLabel.textContent = `Registros encontrados: ${filtered.length} (Total en archivo: ${historico.length})`;

  // Banner para mostrar el equipo conectado actualmente si estamos consultando una bahía específica
  let activeSlotBannerHtml = "";
  if (currentHistoricoSlot && Store.data.slots && Store.data.slots[currentHistoricoSlot]) {
    const activeSlot = Store.data.slots[currentHistoricoSlot];
    const isOccupied = (activeSlot.estado && activeSlot.estado !== "libre") || (activeSlot.equipo && activeSlot.equipo.trim());
    if (isOccupied) {
      activeSlotBannerHtml = `
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.1)); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-md); padding: 0.9rem 1.1rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge-status ${activeSlot.estado === 'no_tocar' ? 'badge-danger' : 'badge-success'}" style="font-size: 0.72rem;">
                ${activeSlot.estado === 'no_tocar' ? '🔴 Ensayo Crítico (No Tocar)' : '🟢 Ensayo Actual en Curso'}
              </span>
              <span style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 800; color: #38bdf8;">
                ${currentHistoricoSlot}
              </span>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">
              Conectado desde: <strong>${activeSlot.f_inicio || 'En curso'}</strong>
            </span>
          </div>

          <div style="display: flex; gap: 0.8rem; align-items: flex-start; margin-top: 0.4rem;">
            ${activeSlot.imagen ? `
              <div style="width: 60px; height: 60px; border-radius: var(--radius-sm); overflow: hidden; background: #0b0f19; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1);">
                <img src="${activeSlot.imagen}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto actual" />
              </div>
            ` : ''}
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 1.05rem; font-weight: 700; color: #fff;">
                ${escapeHtml(activeSlot.equipo || 'Equipo sin nombre')}
                ${activeSlot.modelo ? `<span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">· ${escapeHtml(activeSlot.modelo)}</span>` : ''}
              </div>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.35rem;">
                ${activeSlot.datalogger ? `<span class="meta-chip datalogger" style="font-size: 0.68rem;">📊 Datalogger Conectado</span>` : ''}
                ${activeSlot.sw ? `<span class="meta-chip sw" style="font-size: 0.68rem;">SW: ${escapeHtml(activeSlot.sw)}</span>` : ''}
                ${activeSlot.iot ? `<span class="meta-chip iot" style="font-size: 0.68rem;">IoT: ${escapeHtml(activeSlot.iot)}</span>` : ''}
                ${activeSlot.responsable ? `<span class="meta-chip user" style="font-size: 0.68rem;">👤 ${escapeHtml(activeSlot.responsable)}</span>` : ''}
                ${activeSlot.prueba ? `<span class="meta-chip" style="font-size: 0.68rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8;">Ensayo: ${escapeHtml(activeSlot.prueba)}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  if (filtered.length === 0) {
    container.innerHTML = activeSlotBannerHtml + `
      <div style="text-align: center; padding: 2.2rem 1rem; color: var(--text-dim); background: rgba(15, 23, 42, 0.35); border-radius: var(--radius-md); border: 1px dashed rgba(255,255,255,0.08);">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem; opacity: 0.6;">📜</div>
        <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.3rem;">
          No hay ensayos anteriores archivados en ${currentHistoricoSlot ? currentHistoricoSlot : 'esta vista'}
        </div>
        <p style="font-size: 0.78rem; max-width: 440px; margin: 0 auto 1rem auto; line-height: 1.4;">
          Cada vez que un ensayo finaliza y pulsas <strong>"Liberar"</strong>, el equipo queda archivado permanentemente aquí con sus fechas, responsable y fotos para auditoría.
        </p>
        <button class="btn btn-secondary btn-sm" onclick="filterHistoricoByPuesto('all')" style="font-size: 0.76rem;">
          🌐 Ver Historial General de toda la Cabina
        </button>
      </div>
    `;
    return;
  }

  const archiveHeader = activeSlotBannerHtml
    ? `<h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.6rem; letter-spacing: 0.05em;">📜 Ensayos Anteriores Finalizados (${filtered.length})</h4>`
    : "";

  container.innerHTML = activeSlotBannerHtml + archiveHeader + filtered.map(item => `
    <div style="background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); padding: 0.9rem 1.1rem; display: flex; gap: 1rem; align-items: flex-start; transition: all 0.2s ease;">
      <!-- Thumbnail de Foto informativo -->
      <div style="width: 72px; height: 72px; border-radius: var(--radius-sm); overflow: hidden; background: #0b0f19; flex-shrink: 0; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
        ${item.imagen ? `
          <img src="${item.imagen}" style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHtml(item.equipo || '')}" />
        ` : `
          <span style="font-size: 1.5rem; opacity: 0.4;">📦</span>
        `}
      </div>

      <!-- Info del Ensayo -->
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
          <div>
            <span style="font-family: var(--font-mono); font-size: 0.8rem; background: #334155; color: #38bdf8; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 800; margin-right: 0.4rem;">
              ${item.slot_id}
            </span>
            <strong style="font-size: 1rem; color: #fff;">${item.equipo || 'Sin nombre'}</strong>
            <span style="color: var(--text-dim); font-size: 0.85rem; margin-left: 0.4rem;">· ${item.modelo || 'Modelo N/D'}</span>
          </div>
          <span style="font-size: 0.7rem; color: var(--text-dim); font-family: var(--font-mono);">
            Archivado: ${item.fecha_registro ? item.fecha_registro.slice(0, 10) : '--'}
          </span>
        </div>

        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.45rem 0;">
          ${item.datalogger ? `<span class="meta-chip datalogger" style="font-size: 0.68rem;">📊 Datalogger</span>` : ''}
          ${item.sw ? `<span class="meta-chip sw" style="font-size: 0.68rem;">SW: ${item.sw}</span>` : ''}
          ${item.iot ? `<span class="meta-chip iot" style="font-size: 0.68rem;">IoT: ${item.iot}</span>` : ''}
          ${item.responsable ? `<span class="meta-chip user" style="font-size: 0.68rem;">👤 ${item.responsable}</span>` : ''}
          ${item.prueba ? `<span class="meta-chip" style="font-size: 0.68rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8;">Ensayo: ${item.prueba}</span>` : ''}
          ${item.motivo_cierre ? `<span class="meta-chip" style="font-size: 0.68rem; background: rgba(244, 63, 94, 0.15); color: #f43f5e;">${item.motivo_cierre}</span>` : ''}
        </div>

        ${item.descripcion ? `
          <div style="font-size: 0.75rem; color: var(--text-muted); background: rgba(0,0,0,0.25); padding: 0.35rem 0.6rem; border-radius: 4px; border-left: 2px solid rgba(255,255,255,0.15); margin-bottom: 0.4rem;">
            ${item.descripcion}
          </div>
        ` : ''}

        <div style="font-size: 0.72rem; color: var(--text-dim); display: flex; gap: 1rem;">
          <span>📅 Periodo Ensayo: ${item.f_inicio || '--'} al ${item.f_final || '--'}</span>
        </div>
      </div>
    </div>
  `).join("");
}

function downloadHistoricoCSV() {
  const csvData = Store.exportHistoricoCSV();
  if (!csvData) {
    showToast("No hay registros en el histórico para exportar.", "warning");
    return;
  }

  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `historico_cabina_fluidra_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("Descargando archivo CSV de histórico...", "success");
}

function showToast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
