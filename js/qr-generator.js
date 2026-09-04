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
    } else if (type === "piloto") {
      puestosToPrint = (Store.data.puestos || []).filter(pid => pid !== "A" && pid !== "B" && pid !== "C" && pid !== "D" && pid !== "E" && pid !== "F" && pid !== "G" && pid !== "H" && pid !== "I" && pid !== "J").map(pid => Store.getPuestoInfo(pid));
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
            Escanear para gestionar bahías 1 a ${p.slotsCount || 4}
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
      // Modo por slots individuales de todas las plantas
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
            <div style="font-size: 1.3rem; font-weight: 800; font-family: monospace; line-height: 1.1;">BAHÍA ${slotId}</div>
            <div id="qr-target-slot-${slotId}" style="margin: 0.3rem 0;"></div>
            <div style="font-size: 0.65rem; color: #64748b;">${p.nombre} - Bahía ${s}</div>
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
