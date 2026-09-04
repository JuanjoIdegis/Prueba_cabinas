/**
 * Aplicación de Seguimiento de Equipos en Cabina de Pruebas (Fluidra)
 * Soporte Multi-Planta: Planta Cabina (Puestos A-J) y Planta Piloto Laboratorio (Cellguard 1-2, EC 1-2)
 */

let currentPlantaFilter = "cabina"; // 'cabina' | 'piloto' | 'all'
let currentPuestoFilter = "all";
let currentStatusFilter = "all";
let searchQuery = "";
let currentEditSlotId = null;
let currentTempImageData = null;

document.addEventListener("DOMContentLoaded", async () => {
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
  setupEventListeners();
  setupPWA();
});

function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
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
  
  // Si hay una planta seleccionada, filtrar métricas por esa planta
  let relevantPuestoIds = [];
  if (currentPlantaFilter === "all") {
    relevantPuestoIds = Store.data.puestos || [];
  } else {
    relevantPuestoIds = Store.getPuestosByPlanta(currentPlantaFilter).map(p => p.id);
  }

  let libres = 0;
  let disponibles = 0;
  let noTocar = 0;
  let totalSlots = 0;

  relevantPuestoIds.forEach(pId => {
    const pInfo = Store.getPuestoInfo(pId);
    const count = pInfo.slotsCount || 4;
    totalSlots += count;

    for (let s = 1; s <= count; s++) {
      const slotId = pId.length > 2 || pId.includes('_') ? `${pId}_${s}` : `${pId}${s}`;
      const slot = slots[slotId] || { estado: "libre" };

      if (slot.estado === "libre" || !slot.estado) libres++;
      else if (slot.estado === "en_uso_disponible") disponibles++;
      else if (slot.estado === "no_tocar") noTocar++;
    }
  });

  const libresEl = document.getElementById("metric-libres");
  const dispEl = document.getElementById("metric-disponibles");
  const noTocarEl = document.getElementById("metric-no-tocar");
  const totalEl = document.getElementById("metric-total");

  if (libresEl) libresEl.textContent = libres;
  if (dispEl) dispEl.textContent = disponibles;
  if (noTocarEl) noTocarEl.textContent = noTocar;
  if (totalEl) totalEl.textContent = `${totalSlots - libres}/${totalSlots}`;
}

function renderPlantasNav() {
  const container = document.getElementById("plantas-nav");
  if (!container) return;

  const plantas = Store.getPlantas();

  let html = `
    <div class="plantas-tabs">
      <button class="plant-btn ${currentPlantaFilter === 'all' ? 'active' : ''}" data-planta="all">
        🏢 Todas las Zonas
      </button>
  `;

  plantas.forEach(pl => {
    const totalBahias = pl.puestos.reduce((acc, p) => acc + (p.slotsCount || 4), 0);
    html += `
      <button class="plant-btn ${currentPlantaFilter === pl.id ? 'active' : ''}" data-planta="${pl.id}">
        <span>${pl.icono || '🏢'}</span>
        <span>${pl.nombre}</span>
        <span class="tab-badge" style="font-size: 0.72rem; margin-left: 0.35rem;">${pl.puestos.length} puestos (${totalBahias} bahías)</span>
      </button>
    `;
  });

  html += `
    </div>
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <button class="btn btn-secondary" style="font-size: 0.76rem; padding: 0.4rem 0.8rem;" onclick="openEditPuestosModal()" title="Personalizar y editar nombres de puestos">
        ✏️ Editar Nombres de Puestos
      </button>
    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll(".plant-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentPlantaFilter = btn.dataset.planta;
      currentPuestoFilter = "all";
      renderApp();
    });
  });
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
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No se encontraron bahías con los filtros aplicados</p>
        <button class="btn btn-secondary" onclick="resetFilters()">Restablecer filtros</button>
      </div>
    `;
  }

  container.innerHTML = html;
  attachCardEvents();
}

function renderPuestoCard(puestoId) {
  const pInfo = Store.getPuestoInfo(puestoId);
  const slots = Store.data.slots || {};
  const slotsCount = pInfo.slotsCount || 4;

  let hasMatchingSlots = false;
  const slotCardsHtml = [];

  for (let slotNum = 1; slotNum <= slotsCount; slotNum++) {
    const slotId = pInfo.id.length > 2 || pInfo.id.includes('_') ? `${pInfo.id}_${slotNum}` : `${pInfo.id}${slotNum}`;
    const slotData = slots[slotId] || { puesto: pInfo.id, slot: slotNum, estado: "libre" };

    if (currentStatusFilter !== "all") {
      const estado = slotData.estado || "libre";
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

  return `
    <div class="puesto-card" id="puesto-card-${pInfo.id}">
      <!-- Cabecera del Puesto -->
      <div class="instrument-panel">
        <div class="instrument-top">
          <div class="puesto-title">
            <div class="puesto-letter" style="${pInfo.id.length > 2 ? 'font-size: 1.1rem;' : ''}">${pInfo.id}</div>
            <div class="puesto-meta">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h2 style="margin: 0;">${pInfo.nombre.toUpperCase()}</h2>
                <button class="btn-icon" onclick="openRenameSinglePuestoModal('${pInfo.id}', '${pInfo.nombre}')" title="Editar nombre de este puesto" style="background: transparent; border: none; cursor: pointer; opacity: 0.6; font-size: 0.85rem; padding: 0.2rem;">✏️</button>
              </div>
              <span>${pInfo.plantaIcono || '🏢'} ${pInfo.plantaNombre} · Capacidad: ${slotsCount} bahías</span>
            </div>
          </div>
          <div class="instrument-tools">
            <button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem;" onclick="openPuestoQRModal('${pInfo.id}')" title="Generar QR de este puesto">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              QR Puesto
            </button>
          </div>
        </div>
      </div>

      <!-- Bahías Físicas -->
      <div class="slots-container">
        ${slotCardsHtml.join("")}
      </div>
    </div>
  `;
}

function renderSlotCard(slot, slotId) {
  const estado = slot.estado || "libre";
  const isLibre = estado === "libre";
  const hasEquipment = !!slot.equipo;

  const statusLabel = {
    "libre": "🟢 Libre",
    "en_uso_disponible": "🟡 En uso (Disponible)",
    "no_tocar": "🔴 No Tocar"
  }[estado] || "🟢 Libre";

  return `
    <div class="slot-card state-${estado}" id="card-slot-${slotId}">
      <div class="slot-header">
        <span class="slot-badge-num">BAHÍA ${slotId}</span>
        <span class="slot-status-pill ${estado}">${statusLabel}</span>
      </div>

      ${isLibre && !hasEquipment ? `
        <div class="slot-empty-view">
          <div class="slot-empty-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div class="slot-empty-text">Bahía sin equipo conectado.<br>Disponible para pruebas.</div>
          <div style="display: flex; gap: 0.4rem; justify-content: center;">
            <button class="btn btn-slot connect" onclick="openEditModal('${slotId}')">
              ➕ Conectar Equipo
            </button>
            <button class="btn btn-slot" onclick="openHistoricoModal('${slotId}')" title="Ver historial de ensayos en esta bahía">
              📜 Historial
            </button>
          </div>
        </div>
      ` : `
        <div class="slot-body">
          <div class="equipment-thumb" onclick="openImageViewer('${slot.imagen || 'app/img/cabina_puesto_f.png'}', '${slot.equipo || slotId}')">
            ${slot.imagen ? `
              <img src="${slot.imagen}" alt="${slot.equipo}" loading="lazy" />
            ` : `
              <div class="no-img">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Foto</span>
              </div>
            `}
          </div>

          <div class="equipment-info">
            <div class="eq-title" title="${slot.equipo || ''}">${slot.equipo || 'Sin identificador'}</div>
            <div class="eq-model" title="${slot.modelo || ''}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><rect x="8" y="10" width="14" height="10" rx="2"/></svg>
              ${slot.modelo || 'Modelo no especificado'}
            </div>
            <div class="eq-test" title="${slot.prueba || ''}">${slot.prueba || 'Prueba en curso'}</div>

            <div class="eq-meta-tags">
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

        <div class="slot-actions">
          <button class="btn-slot" onclick="openEditModal('${slotId}')">
            ✏️ Editar
          </button>
          <button class="btn-slot" onclick="openSlotQRModal('${slotId}')" title="Generar QR de esta bahía">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            QR
          </button>
          <button class="btn-slot" onclick="openHistoricoModal('${slotId}')" title="Ver historial de ensayos en esta bahía">
            📜 Historial
          </button>
          <button class="btn-slot" style="color: var(--accent-rose);" onclick="confirmarLiberar('${slotId}')" title="Desconectar y archivar en histórico">
            Liberar
          </button>
        </div>
      `}
    </div>
  `;
}

function attachCardEvents() {
  // Los eventos onclick están integrados en las plantillas
}

/* Modales y Edición */
function openEditModal(slotId) {
  currentEditSlotId = slotId;
  const slotData = (Store.data.slots && Store.data.slots[slotId]) || {
    puesto: slotId[0],
    slot: parseInt(slotId.substring(1), 10),
    estado: "libre"
  };

  document.getElementById("modal-edit-slot-title").textContent = `Editar Bahía ${slotId} (Puesto ${slotData.puesto}, Slot ${slotData.slot})`;

  // Rellenar campos del formulario
  document.getElementById("form-equipo").value = slotData.equipo || "";
  document.getElementById("form-modelo").value = slotData.modelo || "";
  document.getElementById("form-sw").value = slotData.sw || "";
  document.getElementById("form-validacion").value = slotData.validacion || "";
  document.getElementById("form-iot").value = slotData.iot || "";
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
    showToast("Comprimiendo imagen...", "success");
    const compressedDataUrl = await Store.compressImage(file);
    currentTempImageData = compressedDataUrl;
    updateImagePreview(compressedDataUrl);
    showToast("Imagen lista", "success");
  } catch (e) {
    console.error(e);
    showToast("Error al procesar imagen", "error");
  }
}

async function saveSlotForm() {
  if (!currentEditSlotId) return;

  const puesto = currentEditSlotId[0];
  const slot = parseInt(currentEditSlotId.substring(1), 10);

  // Obtener estado seleccionado
  let estado = "libre";
  const selectedRadio = document.querySelector(".state-radio-card.selected");
  if (selectedRadio) {
    estado = selectedRadio.dataset.value;
  }

  const equipo = document.getElementById("form-equipo").value.trim();

  // Si se introduce equipo y el estado sigue siendo "libre", cambiar automáticamente a en_uso_disponible
  if (equipo && estado === "libre") {
    estado = "en_uso_disponible";
  }

  const slotData = {
    slot_id: currentEditSlotId,
    puesto,
    slot,
    estado,
    equipo,
    modelo: document.getElementById("form-modelo").value.trim(),
    sw: document.getElementById("form-sw").value.trim(),
    validacion: document.getElementById("form-validacion").value.trim(),
    iot: document.getElementById("form-iot").value.trim(),
    prueba: document.getElementById("form-prueba").value.trim(),
    responsable: document.getElementById("form-responsable").value.trim(),
    f_inicio: document.getElementById("form-f-inicio").value,
    f_final: document.getElementById("form-f-final").value,
    descripcion: document.getElementById("form-descripcion").value.trim(),
    imagen: currentTempImageData || ""
  };

  closeEditModal();
  showToast(`Guardando bahía ${currentEditSlotId}...`, "info");

  const syncResult = await Store.updateSlot(slotData);
  if (syncResult && syncResult.github) {
    showToast(`✅ Bahía ${currentEditSlotId} sincronizada en GitHub`, "success");
  } else if (syncResult && syncResult.localOnly) {
    showToast(`💾 Bahía ${currentEditSlotId} guardada localmente (Añade token en ⚙️ para GitHub)`, "info");
  } else {
    showToast(`Bahía ${currentEditSlotId} actualizada`, "success");
  }
}

async function confirmarLiberar(slotId) {
  if (confirm(`¿Estás seguro de liberar la bahía ${slotId}? El equipo actual se archivará en el Histórico de ensayos.`)) {
    const syncResult = await Store.liberarSlot(slotId);
    if (syncResult && syncResult.github) {
      showToast(`✅ Bahía ${slotId} liberada y archivada en GitHub`, "warning");
    } else {
      showToast(`Bahía ${slotId} liberada y archivada en el Histórico`, "warning");
    }
  }
}

/* Visor de Imágenes a Pantalla Completa */
function openImageViewer(src, title = "Foto del Equipo") {
  const modal = document.getElementById("image-viewer-modal");
  document.getElementById("viewer-img-title").textContent = title;
  document.getElementById("viewer-img-src").src = src;
  modal.classList.add("active");
}

function closeImageViewer() {
  document.getElementById("image-viewer-modal").classList.remove("active");
}

/* Modal Conexión Móvil */
function openMobileConnectModal() {
  const modal = document.getElementById("mobile-connect-modal");
  const url = Store.networkInfo.network_url || `http://${window.location.hostname}:5050`;
  
  document.getElementById("mobile-url-text").textContent = url;
  document.getElementById("mobile-ip-badge").textContent = `IP: ${Store.networkInfo.ip || window.location.hostname}`;

  const qrContainer = document.getElementById("mobile-qr-canvas");
  qrContainer.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    new QRCode(qrContainer, {
      text: url,
      width: 220,
      height: 220,
      colorDark: "#0f172a",
      colorLight: "#ffffff"
    });
  }

  modal.classList.add("active");
}

function closeMobileConnectModal() {
  document.getElementById("mobile-connect-modal").classList.remove("active");
}

/* Escáner de Códigos QR con Cámara */
function openQRScannerModal() {
  const modal = document.getElementById("qr-scanner-modal");
  modal.classList.add("active");

  QRScanner.start("qr-video-element", (result) => {
    closeQRScannerModal();
    if (result.puesto && result.slot) {
      const slotId = `${result.puesto}${result.slot}`;
      showToast(`Código detectado: Bahía ${slotId}`, "success");
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
function openQRPrintModal(mode = "puestos") {
  const modal = document.getElementById("qr-print-modal");
  modal.classList.add("active");
  QRGenerator.renderPrintSheet("print-sheet-container", mode);
}

function closeQRPrintModal() {
  document.getElementById("qr-print-modal").classList.remove("active");
}

function openPuestoQRModal(puesto) {
  openQRPrintModal("puestos");
}

function openSlotQRModal(slotId) {
  openQRPrintModal("slots");
}

/* Edición y Personalización de Nombres de Puestos */
function openEditPuestosModal() {
  const modal = document.getElementById("edit-puestos-modal");
  const container = document.getElementById("edit-puestos-container");
  if (!container) return;

  const plantas = Store.getPlantas();

  let html = "";
  plantas.forEach(pl => {
    html += `
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.9rem;">
        <h4 style="margin: 0 0 0.8rem 0; color: #38bdf8; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem;">
          <span>${pl.icono || '🏢'}</span>
          <span>${pl.nombre}</span>
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.8rem;">
    `;

    pl.puestos.forEach(p => {
      html += `
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <label style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono); font-weight: 700;">
            ID: ${p.id} (${p.slotsCount || 4} bahías)
          </label>
          <input type="text" class="form-input puesto-name-input" data-planta-id="${pl.id}" data-puesto-id="${p.id}" value="${p.nombre}" style="font-size: 0.82rem; padding: 0.4rem 0.6rem;" />
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  modal.classList.add("active");
}

function closeEditPuestosModal() {
  document.getElementById("edit-puestos-modal").classList.remove("active");
}

async function savePuestosConfig() {
  const inputs = document.querySelectorAll(".puesto-name-input");
  const plantas = JSON.parse(JSON.stringify(Store.getPlantas()));

  inputs.forEach(inp => {
    const plantaId = inp.dataset.plantaId;
    const puestoId = inp.dataset.puestoId;
    const val = inp.value.trim();

    const pl = plantas.find(item => item.id === plantaId);
    if (pl) {
      const p = pl.puestos.find(item => item.id === puestoId);
      if (p && val) {
        p.nombre = val;
      }
    }
  });

  closeEditPuestosModal();
  showToast("Guardando nombres de puestos...", "info");

  const syncResult = await Store.updatePuestosConfig(plantas);
  if (syncResult && syncResult.github) {
    showToast("✅ Nombres de puestos guardados y sincronizados en GitHub", "success");
  } else {
    showToast("✅ Nombres de puestos actualizados correctamente", "success");
  }

  renderApp();
}

async function openRenameSinglePuestoModal(puestoId, currentNombre) {
  const nuevoNombre = prompt(`Introduce el nuevo nombre para el puesto ${puestoId}:`, currentNombre);
  if (nuevoNombre && nuevoNombre.trim() && nuevoNombre.trim() !== currentNombre) {
    const plantas = JSON.parse(JSON.stringify(Store.getPlantas()));
    for (const pl of plantas) {
      const p = pl.puestos.find(item => item.id === puestoId);
      if (p) {
        p.nombre = nuevoNombre.trim();
        break;
      }
    }
    showToast("Actualizando nombre...", "info");
    await Store.updatePuestosConfig(plantas);
    showToast(`✅ Puesto renombrado a "${nuevoNombre.trim()}"`, "success");
    renderApp();
  }
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
  if (!badge) return;

  if (Store.githubConfig.token) {
    badge.textContent = "🟢 Conectado (Escritura activa)";
    badge.style.background = "rgba(16, 185, 129, 0.2)";
    badge.style.color = "#34d399";
  } else {
    badge.textContent = "🟡 Solo Lectura (Sin token)";
    badge.style.background = "rgba(245, 158, 11, 0.2)";
    badge.style.color = "#fbbf24";
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

/* UI Listeners */
function setupEventListeners() {
  // Buscador
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderPuestos();
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
    currentHistoricoPuesto = slotId[0];
    document.getElementById("historico-modal-title").textContent = `Historial de la Bahía ${slotId}`;
  } else {
    currentHistoricoPuesto = "all";
    document.getElementById("historico-modal-title").textContent = "Historial General de la Cabina";
  }

  // Actualizar pills de puesto
  document.querySelectorAll("#historico-puesto-pills .filter-pill").forEach(pill => {
    if (pill.dataset.puesto === currentHistoricoPuesto) pill.classList.add("active");
    else pill.classList.remove("active");
  });

  renderHistorico();
  modal.classList.add("active");
}

function closeHistoricoModal() {
  document.getElementById("historico-modal").classList.remove("active");
}

function filterHistoricoByPuesto(puesto) {
  currentHistoricoPuesto = puesto;
  currentHistoricoSlot = null; // Reiniciar filtro por slot específico al cambiar de puesto
  document.getElementById("historico-modal-title").textContent = puesto === "all" ? "Historial General de la Cabina" : `Historial del Puesto ${puesto}`;
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

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
        <div style="font-size: 2.5rem; margin-bottom: 0.8rem; opacity: 0.5;">📜</div>
        <div style="font-size: 1rem; font-weight: 700; margin-bottom: 0.3rem;">No hay registros históricos ${currentHistoricoSlot ? `para la bahía ${currentHistoricoSlot}` : ''}</div>
        <p style="font-size: 0.8rem; max-width: 420px; margin: 0 auto;">
          Cada vez que un equipo se desconecta (botón "Liberar") o se reemplaza por otro modelo en una bahía, se archiva aquí automáticamente con su foto, software, responsable y fechas.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div style="background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); padding: 0.9rem 1.1rem; display: flex; gap: 1rem; align-items: flex-start; transition: all 0.2s ease;">
      <!-- Thumbnail de Foto -->
      <div style="width: 72px; height: 72px; border-radius: var(--radius-sm); overflow: hidden; background: #0b0f19; flex-shrink: 0; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="openImageViewer('${item.imagen || 'app/img/cabina_puesto_f.png'}', '${item.equipo}')">
        ${item.imagen ? `
          <img src="${item.imagen}" style="width: 100%; height: 100%; object-fit: cover;" alt="${item.equipo}" />
        ` : `
          <span style="font-size: 1.5rem; opacity: 0.4;">📦</span>
        `}
      </div>

      <!-- Info del Ensayo -->
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
          <div>
            <span style="font-family: var(--font-mono); font-size: 0.75rem; background: #334155; color: #38bdf8; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 700; margin-right: 0.4rem;">
              BAHÍA ${item.slot_id}
            </span>
            <strong style="font-size: 1rem; color: #fff;">${item.equipo || 'Sin nombre'}</strong>
            <span style="color: var(--text-dim); font-size: 0.85rem; margin-left: 0.4rem;">· ${item.modelo || 'Modelo N/D'}</span>
          </div>
          <span style="font-size: 0.7rem; color: var(--text-dim); font-family: var(--font-mono);">
            Archivado: ${item.fecha_registro ? item.fecha_registro.slice(0, 10) : '--'}
          </span>
        </div>

        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.45rem 0;">
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
