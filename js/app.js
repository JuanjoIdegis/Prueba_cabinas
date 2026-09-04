/**
 * Aplicación de Seguimiento de Equipos en Cabina de Pruebas (Fluidra)
 * Puestos A a F - 4 Bahías por puesto
 */

let currentPuestoFilter = "all";
let currentStatusFilter = "all";
let searchQuery = "";
let currentEditSlotId = null;
let currentTempImageData = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar store de datos
  await Store.init();

  // Comprobar parámetros de URL (ej: ?puesto=F&slot=3)
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

  // También soportar formato Hash (útil en SPAs o redirecciones: #puesto=F o #F2)
  if (!puesto && window.location.hash) {
    const hashClean = window.location.hash.replace(/^#/, "");
    if (hashClean.includes("puesto=")) {
      const hashParams = new URLSearchParams(hashClean);
      puesto = hashParams.get("puesto");
      slot = hashParams.get("slot");
    } else if (/^[A-Fa-f][1-4]?$/.test(hashClean)) {
      puesto = hashClean[0].toUpperCase();
      if (hashClean.length > 1) slot = hashClean[1];
    }
  }

  if (puesto && ["A", "B", "C", "D", "E", "F"].includes(puesto.toUpperCase())) {
    currentPuestoFilter = puesto.toUpperCase();
    setTimeout(() => {
      showToast(`📍 Mostrando módulo físico: Puesto ${puesto.toUpperCase()}`, "info");
      if (slot && [1, 2, 3, 4].includes(parseInt(slot, 10))) {
        openEditModal(`${puesto.toUpperCase()}${slot}`);
      }
    }, 400);
  }
}

function renderApp() {
  renderMetrics();
  renderTabs();
  renderPuestos();
}

function renderMetrics() {
  const slots = Store.data.slots || {};
  const values = Object.values(slots);
  
  let libres = 0;
  let disponibles = 0;
  let noTocar = 0;

  values.forEach(s => {
    if (s.estado === "libre" || !s.estado) libres++;
    else if (s.estado === "en_uso_disponible") disponibles++;
    else if (s.estado === "no_tocar") noTocar++;
  });

  const total = values.length || 24;
  const libresEl = document.getElementById("metric-libres");
  const dispEl = document.getElementById("metric-disponibles");
  const noTocarEl = document.getElementById("metric-no-tocar");
  const totalEl = document.getElementById("metric-total");

  if (libresEl) libresEl.textContent = libres;
  if (dispEl) dispEl.textContent = disponibles;
  if (noTocarEl) noTocarEl.textContent = noTocar;
  if (totalEl) totalEl.textContent = `${total - libres}/${total}`;
}

function renderTabs() {
  const container = document.getElementById("tabs-puestos");
  if (!container) return;

  const puestos = Store.data.puestos || ["A", "B", "C", "D", "E", "F"];
  const slots = Store.data.slots || {};

  let html = `
    <button class="tab-btn ${currentPuestoFilter === 'all' ? 'active' : ''}" data-puesto="all">
      Todos los Puestos
      <span class="tab-badge">A - F</span>
    </button>
  `;

  puestos.forEach(p => {
    // Contar ocupados en este puesto
    let ocupados = 0;
    for (let s = 1; s <= 4; s++) {
      const slot = slots[`${p}${s}`];
      if (slot && slot.estado !== "libre" && slot.equipo) ocupados++;
    }

    html += `
      <button class="tab-btn ${currentPuestoFilter === p ? 'active' : ''}" data-puesto="${p}">
        Puesto ${p}
        <span class="tab-badge" style="${ocupados > 0 ? 'color: var(--accent-cyan)' : ''}">${ocupados}/4</span>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentPuestoFilter = btn.dataset.puesto;
      renderApp();
    });
  });
}

function renderPuestos() {
  const container = document.getElementById("puestos-grid");
  if (!container) return;

  const allPuestos = Store.data.puestos || ["A", "B", "C", "D", "E", "F"];
  const puestosToShow = currentPuestoFilter === "all" ? allPuestos : [currentPuestoFilter];

  let html = "";

  puestosToShow.forEach(puestoLetter => {
    html += renderPuestoCard(puestoLetter);
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

function renderPuestoCard(puesto) {
  const slots = Store.data.slots || {};

  // Filtrar si alguno de sus slots cumple con los filtros activos
  let hasMatchingSlots = false;
  const slotCardsHtml = [1, 2, 3, 4].map(slotNum => {
    const slotId = `${puesto}${slotNum}`;
    const slotData = slots[slotId] || { puesto, slot: slotNum, estado: "libre" };
    
    // Comprobar filtro de estado
    if (currentStatusFilter !== "all") {
      const estado = slotData.estado || "libre";
      if (estado !== currentStatusFilter) return "";
    }

    // Comprobar búsqueda de texto
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchable = [
        slotData.equipo, slotData.modelo, slotData.sw, slotData.validacion,
        slotData.iot, slotData.prueba, slotData.responsable, slotData.descripcion, slotId
      ].filter(Boolean).join(" ").toLowerCase();

      if (!searchable.includes(q)) return "";
    }

    hasMatchingSlots = true;
    return renderSlotCard(slotData, slotId);
  }).join("");

  if (!hasMatchingSlots && (currentStatusFilter !== "all" || searchQuery)) {
    return "";
  }

  return `
    <div class="puesto-card" id="puesto-card-${puesto}">
      <!-- Cabecera del Puesto -->
      <div class="instrument-panel">
        <div class="instrument-top">
          <div class="puesto-title">
            <div class="puesto-letter">${puesto}</div>
            <div class="puesto-meta">
              <h2>PUESTO DE PRUEBAS ${puesto}</h2>
              <span>Capacidad: 4 bahías simultáneas (1, 2, 3, 4)</span>
            </div>
          </div>
          <div class="instrument-tools">
            <button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem;" onclick="openPuestoQRModal('${puesto}')" title="Generar QR de este puesto">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              QR Puesto ${puesto}
            </button>
          </div>
        </div>
      </div>

      <!-- Bahías Físicas (1 Superior Izq, 2 Inferior Izq, 3 Superior Der, 4 Inferior Der) -->
      <div class="slots-container">
        ${slotCardsHtml}
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
          <button class="btn btn-slot connect" onclick="openEditModal('${slotId}')">
            ➕ Conectar Equipo
          </button>
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
          <button class="btn-slot" style="color: var(--accent-rose);" onclick="confirmarLiberar('${slotId}')" title="Desconectar y liberar">
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
  showToast(`Guardando bahía ${currentEditSlotId}...`, "success");

  await Store.updateSlot(slotData);
  showToast(`Bahía ${currentEditSlotId} actualizada`, "success");
}

function confirmarLiberar(slotId) {
  if (confirm(`¿Estás seguro de liberar la bahía ${slotId}? Se borrarán los datos del equipo conectado.`)) {
    Store.liberarSlot(slotId);
    showToast(`Bahía ${slotId} liberada`, "warning");
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
