/**
 * Lector de Códigos QR con Cámara (Móvil y PC)
 * Utiliza BarcodeDetector nativo (acelerado por hardware en Android) y getUserMedia
 */

const QRScanner = {
  stream: null,
  videoEl: null,
  isScanning: false,
  scanInterval: null,
  onScanCallback: null,

  async start(videoElementId, onResult) {
    this.videoEl = document.getElementById(videoElementId);
    this.onScanCallback = onResult;
    this.isScanning = true;

    try {
      // Priorizar cámara trasera en móviles ('environment')
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();

      this.beginDetectionLoop();
      return true;
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      alert("No se pudo acceder a la cámara. Asegúrate de otorgar los permisos en el navegador.");
      this.stop();
      return false;
    }
  },

  beginDetectionLoop() {
    // Si el navegador soporta la API nativa ultrarrápida BarcodeDetector
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      
      const checkFrame = async () => {
        if (!this.isScanning || !this.videoEl) return;
        try {
          if (this.videoEl.readyState >= 2) {
            const barcodes = await barcodeDetector.detect(this.videoEl);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              this.handleDetectedCode(code);
              return;
            }
          }
        } catch (e) {
          // Frame skip
        }
        if (this.isScanning) {
          requestAnimationFrame(checkFrame);
        }
      };
      requestAnimationFrame(checkFrame);
    } else {
      // Fallback básico con canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      this.scanInterval = setInterval(() => {
        if (!this.isScanning || !this.videoEl || this.videoEl.readyState < 2) return;
        canvas.width = this.videoEl.videoWidth || 640;
        canvas.height = this.videoEl.videoHeight || 480;
        ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);
      }, 250);
    }
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

    if (this.onScanCallback) {
      this.onScanCallback({ raw: rawText, ...target });
    }
    this.stop();
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
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
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
