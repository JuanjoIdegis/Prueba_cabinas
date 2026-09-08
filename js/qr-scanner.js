/**
 * Lector de Códigos QR con Cámara (Móvil iPhone/Android y PC)
 * Utiliza BarcodeDetector nativo cuando está disponible y jsQR como motor universal en iOS Safari
 */

const QRScanner = {
  stream: null,
  videoEl: null,
  isScanning: false,
  animationFrameId: null,
  onScanCallback: null,
  canvas: null,
  ctx: null,

  async start(videoElementId, onResult) {
    this.videoEl = document.getElementById(videoElementId);
    this.onScanCallback = onResult;
    this.isScanning = true;

    // Atributos obligatorios para que iOS Safari reproduzca vídeo inline sin pantalla completa
    if (this.videoEl) {
      this.videoEl.setAttribute("playsinline", "true");
      this.videoEl.setAttribute("webkit-playsinline", "true");
      this.videoEl.muted = true;
    }

    try {
      // Priorizar cámara trasera en móviles ('environment') con resolución óptima
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();

      this.beginDetectionLoop();
      return true;
    } catch (err) {
      console.warn("Error con constraints avanzadas de cámara, probando fallback básico:", err);
      // Fallback básico sin constraints estrictos
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.videoEl.srcObject = this.stream;
        await this.videoEl.play();
        this.beginDetectionLoop();
        return true;
      } catch (e2) {
        console.error("Fallo definitivo al acceder a la cámara:", e2);
        alert("No se pudo acceder a la cámara. Asegúrate de otorgar los permisos de cámara en el navegador de tu móvil.");
        this.stop();
        return false;
      }
    }
  },

  beginDetectionLoop() {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    }

    // Comprobar soporte de BarcodeDetector nativo
    const hasBarcodeDetector = ('BarcodeDetector' in window);
    let barcodeDetector = null;
    if (hasBarcodeDetector) {
      try {
        barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        barcodeDetector = null;
      }
    }

    let lastScanTime = 0;

    const scanFrame = async (timestamp) => {
      if (!this.isScanning || !this.videoEl) return;

      if (this.videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        // Escanear cada ~100ms para lectura inmediata y máxima fluidez sin recalentar el móvil
        if (timestamp - lastScanTime >= 100) {
          lastScanTime = timestamp;

          // Vía 1: BarcodeDetector nativo (Chromium / Android)
          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(this.videoEl);
              if (barcodes && barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                if (code) {
                  this.handleDetectedCode(code);
                  return;
                }
              }
            } catch (e) {}
          }

          // Vía 2: jsQR (Motor universal compatible con iOS Safari / iPhone 11)
          if (typeof jsQR === 'function') {
            try {
              const vWidth = this.videoEl.videoWidth || 640;
              const vHeight = this.videoEl.videoHeight || 480;

              // Redimensionar canvas a un tamaño óptimo (máx 640px) para escaneo ultra rápido
              let scale = 1;
              if (vWidth > 640) {
                scale = 640 / vWidth;
              }
              const scanWidth = Math.floor(vWidth * scale);
              const scanHeight = Math.floor(vHeight * scale);

              if (this.canvas.width !== scanWidth || this.canvas.height !== scanHeight) {
                this.canvas.width = scanWidth;
                this.canvas.height = scanHeight;
              }

              this.ctx.drawImage(this.videoEl, 0, 0, scanWidth, scanHeight);
              const imageData = this.ctx.getImageData(0, 0, scanWidth, scanHeight);

              const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert"
              });

              if (qrResult && qrResult.data) {
                this.handleDetectedCode(qrResult.data);
                return;
              }
            } catch (err) {
              // Frame omitido
            }
          }
        }
      }

      if (this.isScanning) {
        this.animationFrameId = requestAnimationFrame(scanFrame);
      }
    };

    this.animationFrameId = requestAnimationFrame(scanFrame);
  },

  handleDetectedCode(rawText) {
    if (!rawText) return;
    
    // Sonido de confirmación (Beep de escaneo)
    this.playBeepSound();

    // Interpretar formato de código (ej: "PUESTO-F", "SLOT-F3", o URL con parámetro "?puesto=F&slot=3")
    let target = { puesto: null, slot: null };

    if (rawText.includes("?")) {
      try {
        const url = new URL(rawText, window.location.origin);
        target.puesto = url.searchParams.get("puesto");
        target.slot = url.searchParams.get("slot");
      } catch (e) {}
    }

    if (!target.puesto) {
      const matchSlot = rawText.match(/(?:SLOT|slot|Slot)?[:\s-]*([A-Za-z0-9_]+)[_:-]?([1-5])/i);
      if (matchSlot) {
        target.puesto = matchSlot[1].toUpperCase();
        target.slot = parseInt(matchSlot[2], 10);
      } else {
        const matchPuesto = rawText.match(/(?:PUESTO|puesto|Cabina)?[:\s-]*([A-Za-z0-9_]+)/i);
        if (matchPuesto) {
          target.puesto = matchPuesto[1].toUpperCase();
        }
      }
    }

    this.stop();

    if (this.onScanCallback) {
      this.onScanCallback({ raw: rawText, ...target });
    }
  },

  playBeepSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz (La)
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  },

  stop() {
    this.isScanning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }
};
