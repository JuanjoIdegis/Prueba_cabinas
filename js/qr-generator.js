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

  renderPrintSheet(containerId, type = "puestos") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const baseUrl = this.getBaseUrl();
    const puestos = Store.data.puestos || ["A", "B", "C", "D", "E", "F"];

    const sheet = document.createElement("div");
    sheet.className = "print-sheet";

    if (type === "puestos") {
      puestos.forEach(p => {
        const card = document.createElement("div");
        card.className = "print-card";
        card.style.cssText = `
          border: 2px dashed #334155;
          padding: 1.5rem;
          border-radius: 12px;
          background: #ffffff;
          color: #0f172a;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.8rem;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        `;

        const targetUrl = `${baseUrl}/?puesto=${p}`;

        card.innerHTML = `
          <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">
            FLUIDRA · CABINA DE PRUEBAS
          </div>
          <div style="font-size: 2.5rem; font-weight: 900; font-family: 'JetBrains Mono', monospace; line-height: 1;">
            PUESTO ${p}
          </div>
          <div id="qr-target-puesto-${p}" style="margin: 0.5rem 0;"></div>
          <div style="font-size: 0.75rem; font-family: monospace; color: #475569; word-break: break-all;">
            ${targetUrl}
          </div>
          <div style="font-size: 0.72rem; color: #0284c7; font-weight: 600;">
            Escanear con el móvil para gestionar bahías 1, 2, 3, 4
          </div>
        `;

        sheet.appendChild(card);

        // Renderizar QR en el elemento creado
        setTimeout(() => {
          const el = document.getElementById(`qr-target-puesto-${p}`);
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
      // Modo por slots individuales (24 slots A1 a F4)
      puestos.forEach(p => {
        for (let s = 1; s <= 4; s++) {
          const slotId = `${p}${s}`;
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
          `;

          const targetUrl = `${baseUrl}/?puesto=${p}&slot=${s}`;

          card.innerHTML = `
            <div style="font-size: 0.7rem; font-weight: 700; color: #475569;">FLUIDRA CABINA</div>
            <div style="font-size: 1.6rem; font-weight: 800; font-family: monospace;">BAHÍA ${slotId}</div>
            <div id="qr-target-slot-${slotId}" style="margin: 0.3rem 0;"></div>
            <div style="font-size: 0.65rem; color: #64748b;">Puesto ${p} - Slot ${s}</div>
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
  }
};
