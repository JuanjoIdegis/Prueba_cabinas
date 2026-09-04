/**
 * Generador e Impresor de Carteles QR para Puestos de Cabina (A-F)
 */

const QRGenerator = {
  getBaseUrl() {
    const custom = localStorage.getItem("cabina_base_url");
    if (custom) return custom.replace(/\/$/, "");
    if (window.location.hostname.includes("github.io")) {
      return window.location.origin + window.location.pathname.replace(/\/$/, "");
    }
    return "https://juanjoidegis.github.io/Prueba_cabinas";
  },

  setBaseUrl(url) {
    if (!url) return;
    localStorage.setItem("cabina_base_url", url.trim().replace(/\/$/, ""));
  },

  renderPrintSheet(containerId, type = "cabina") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const baseUrl = this.getBaseUrl();
    const sheet = document.createElement("div");
    sheet.className = "print-sheet";

    // Determinar qué puestos imprimir
    let puestosToPrint = [];
    if (type && type.startsWith("zona")) {
      puestosToPrint = Store.getPuestosByPlanta(type);
    } else if (type === "cabina") {
      puestosToPrint = Store.getPuestosByPlanta("zona1");
    } else if (type === "piloto" || type === "pilotos") {
      puestosToPrint = (Store.data.puestos || []).filter(pid => !["A","B","C","D","E","F","G","H","I","J"].includes(pid)).map(pid => Store.getPuestoInfo(pid));
    } else {
      puestosToPrint = (Store.data.puestos || []).map(pid => Store.getPuestoInfo(pid));
    }

    if (type !== "slots") {
      puestosToPrint.forEach(p => {
        const card = document.createElement("div");
        card.className = "print-card";
        card.style.cssText = `
          border: 2px dashed #334155;
          padding: 1.4rem;
          border-radius: 12px;
          background: #ffffff;
          color: #0f172a;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.7rem;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          break-inside: avoid;
        `;

        const targetUrl = `${baseUrl}/?puesto=${p.id}`;

        card.innerHTML = `
          <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">
            FLUIDRA · ${p.plantaNombre ? p.plantaNombre.toUpperCase() : 'LABORATORIO'}
          </div>
          <div style="font-size: 1.8rem; font-weight: 900; font-family: 'JetBrains Mono', monospace; line-height: 1.1; margin: 0.2rem 0;">
            ${p.nombre.toUpperCase()}
          </div>
          <div id="qr-target-puesto-${p.id}" style="margin: 0.4rem 0;"></div>
          <div style="font-size: 0.72rem; font-family: monospace; color: #475569; word-break: break-all;">
            ${targetUrl}
          </div>
          <div style="font-size: 0.72rem; color: #0284c7; font-weight: 600;">
            Escanear para gestionar ${p.nombre}
          </div>
        `;

        sheet.appendChild(card);

        setTimeout(() => {
          const el = document.getElementById(`qr-target-puesto-${p.id}`);
          if (el && typeof QRCode !== "undefined") {
            new QRCode(el, {
              text: targetUrl,
              width: 140,
              height: 140,
              colorDark: "#0f172a",
              colorLight: "#ffffff"
            });
          }
        }, 50);
      });
    } else {
      // Modo por identificadores individuales de todas las plantas
      const allPuestos = (Store.data.puestos || []).map(pid => Store.getPuestoInfo(pid));
      allPuestos.forEach(p => {
        const count = p.slotsCount || 4;
        for (let s = 1; s <= count; s++) {
          const slotId = p.id.length > 2 || p.id.includes('_') ? `${p.id}_${s}` : `${p.id}${s}`;
          const card = document.createElement("div");
          card.className = "print-card";
          card.style.cssText = `
            border: 1px dashed #64748b;
            padding: 1rem;
            border-radius: 8px;
            background: #ffffff;
            color: #0f172a;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            break-inside: avoid;
          `;

          const targetUrl = `${baseUrl}/?puesto=${p.id}&slot=${s}`;

          card.innerHTML = `
            <div style="font-size: 0.68rem; font-weight: 700; color: #475569;">FLUIDRA · ${p.plantaNombre || 'CABINA'}</div>
            <div style="font-size: 1.6rem; font-weight: 900; font-family: 'JetBrains Mono', monospace; line-height: 1.1; color: #0f172a;">${slotId}</div>
            <div id="qr-target-slot-${slotId}" style="margin: 0.3rem 0;"></div>
            <div style="font-size: 0.68rem; color: #64748b; font-weight: 600;">${p.nombre} · ${slotId}</div>
          `;

          sheet.appendChild(card);

          setTimeout(() => {
            const el = document.getElementById(`qr-target-slot-${slotId}`);
            if (el && typeof QRCode !== "undefined") {
              new QRCode(el, {
                text: targetUrl,
                width: 110,
                height: 110,
                colorDark: "#0f172a",
                colorLight: "#ffffff"
              });
            }
          }, 50);
        }
      });
    }

    container.appendChild(sheet);
  },

  printDirectly() {
    window.print();
  },

  openInNewPrintWindow() {
    const container = document.getElementById("print-sheet-container");
    if (!container || !container.innerHTML.trim()) {
      alert("No hay carteles QR generados para imprimir.");
      return;
    }

    const printWin = window.open("", "_blank");
    if (!printWin) {
      // Si el navegador bloquea la ventana emergente, recurrir al print normal
      window.print();
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Carteles QR - Cabina y Plantas Fluidra</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      padding: 8mm;
    }
    .print-header {
      text-align: center;
      margin-bottom: 8mm;
      padding-bottom: 3mm;
      border-bottom: 2px solid #e2e8f0;
    }
    .print-header h1 {
      font-size: 15pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .print-header p {
      font-size: 9pt;
      color: #64748b;
      margin-top: 2mm;
    }
    .print-sheet {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10mm;
    }
    .print-card {
      border: 2px dashed #0f172a !important;
      padding: 10mm 6mm !important;
      border-radius: 10px !important;
      background: #ffffff !important;
      color: #0f172a !important;
      text-align: center !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .print-card canvas, .print-card img {
      margin: 6mm auto !important;
      display: block !important;
      max-width: 140px !important;
      max-height: 140px !important;
    }
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
  </style>
</head>
<body>
  <div class="print-header">
    <h1>FLUIDRA LAB · Carteles QR para Paneles</h1>
    <p>Pega cada cartel en su puesto o posición correspondiente para escanear con la app</p>
  </div>
  ${container.innerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  <\/script>
</body>
</html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  }
};
