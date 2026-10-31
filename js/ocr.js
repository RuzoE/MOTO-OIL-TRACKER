/**
 * ocr.js — Motor OCR para lectura de odómetro con Tesseract.js
 * Importa Tesseract desde CDN y extrae el número del odómetro.
 */

let tesseractWorker = null;
let ocrIniciado = false;

/**
 * Inicializa el worker de Tesseract (solo la primera vez).
 * @returns {Promise<Tesseract.Worker>}
 */
async function iniciarWorker() {
    if (typeof Tesseract === 'undefined') {
        throw new Error('Tesseract.js no está disponible. Verifica tu conexión a internet.');
    }

    if (tesseractWorker && ocrIniciado) return tesseractWorker;

    // Crear overlay dinámico si no existe en la página
    asegurarOverlayCarga();

    actualizarProgresoOCR('Cargando motor OCR...', 15);

    try {
        // Tesseract.js v5 API
        tesseractWorker = await Tesseract.createWorker('eng', 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round(m.progress * 100);
                    actualizarProgresoOCR(`Analizando odómetro... ${pct}%`, pct);
                } else if (m.status === 'loading tesseract core') {
                    actualizarProgresoOCR('Descargando componentes OCR...', 35);
                } else if (m.status === 'loading language traineddata') {
                    actualizarProgresoOCR('Cargando modelo numérico...', 60);
                }
            },
        });

        // Optimización: modo enfocado a dígitos para odómetros
        await tesseractWorker.setParameters({
            tessedit_char_whitelist: '0123456789',
        });

        ocrIniciado = true;
        return tesseractWorker;
    } catch (err) {
        console.error('[OCR] Error iniciando worker:', err);
        throw err;
    }
}

/**
 * Crea un overlay de progreso en el DOM si no existe uno
 */
function asegurarOverlayCarga() {
    if (document.getElementById('ocr-global-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ocr-global-overlay';
    overlay.className = 'loading-overlay hidden';
    overlay.innerHTML = `
        <div class="loading-icon"></div>
        <p class="ocr-progress-text" style="font-weight:600;font-size:0.95rem;">Procesando imagen...</p>
        <div style="width:180px;height:6px;background:rgba(255,255,255,0.15);border-radius:6px;overflow:hidden;margin-top:0.5rem;">
            <div class="ocr-progress-bar" style="height:100%;width:0%;background:var(--accent-orange);border-radius:6px;transition:width 0.2s;"></div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function actualizarProgresoOCR(texto, pct) {
    document.querySelectorAll('.ocr-progress-text').forEach(el => el.textContent = texto);
    document.querySelectorAll('.ocr-progress-bar').forEach(el => el.style.width = `${pct}%`);
}

/**
 * Pre-procesa una imagen en un canvas para mejorar el reconocimiento OCR.
 * Ajusta resolución y contraste dinámico sin perder escala tonal.
 * @param {HTMLImageElement|HTMLCanvasElement} imgEl
 * @returns {HTMLCanvasElement}
 */
function preprocesarImagen(imgEl) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Escalar manteniendo proporción adecuada
    const naturalW = imgEl.naturalWidth || imgEl.width || 800;
    const naturalH = imgEl.naturalHeight || imgEl.height || 600;

    let targetW = naturalW;
    let targetH = naturalH;
    const maxDim = 1400;

    if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
        } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
        }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    ctx.drawImage(imgEl, 0, 0, targetW, targetH);

    // Contraste adaptativo y conversión a escala de grises
    try {
        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const d = imgData.data;

        // Calcular min y max luminancia para estiramiento de contraste
        let minLum = 255;
        let maxLum = 0;
        const lums = new Uint8Array(d.length / 4);

        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            lums[j] = lum;
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
        }

        const range = maxLum - minLum || 1;

        // Estirar contraste a todo el rango 0-255
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
            const stretched = Math.round(((lums[j] - minLum) / range) * 255);
            d[i] = d[i + 1] = d[i + 2] = stretched;
        }

        ctx.putImageData(imgData, 0, 0);
    } catch (e) {
        console.warn('[OCR] No se pudo aplicar filtro de canvas:', e);
    }

    return canvas;
}

/**
 * Extrae el número del odómetro desde un File de imagen.
 * @param {File} file - Archivo de imagen del odómetro
 * @returns {Promise<{ valor: number|null, texto: string, confianza: number }>}
 */
async function reconocerKilometraje(file) {
    if (!file) return { valor: null, texto: '', confianza: 0 };

    // Mostrar overlays
    asegurarOverlayCarga();
    document.querySelectorAll('.ocr-overlay').forEach(el => el.classList.add('active'));
    const globalOverlay = document.getElementById('ocr-global-overlay');
    if (globalOverlay && !document.querySelector('.ocr-overlay.active')) {
        globalOverlay.classList.remove('hidden');
    }

    let blobUrl = null;

    try {
        blobUrl = URL.createObjectURL(file);
        const imgEl = await cargarImagen(blobUrl);

        actualizarProgresoOCR('Optimizando imagen...', 25);
        const canvas = preprocesarImagen(imgEl);

        const worker = await iniciarWorker();

        actualizarProgresoOCR('Leyendo números...', 50);
        const { data } = await worker.recognize(canvas);

        const textoRaw = data.text || '';
        // Extraer números individuales o agrupados
        const matches = textoRaw.match(/\d+/g) || [];

        // Filtrar números muy cortos (odómetros usualmente tienen 3 a 6 dígitos)
        let candidato = '';
        if (matches.length > 0) {
            // Preferir el de mayor longitud
            candidato = matches.reduce((prev, curr) => curr.length >= prev.length ? curr : prev, '');
        }

        const valor = candidato ? parseInt(candidato, 10) : null;

        return {
            valor: (!isNaN(valor) && valor >= 0) ? valor : null,
            texto: candidato,
            confianza: Math.round(data.confidence || 0),
        };
    } catch (error) {
        console.error('[OCR] Error al procesar imagen:', error);
        if (window.showToast) {
            window.showToast(error.message || 'Error al procesar OCR', 'error');
        }
        return { valor: null, texto: '', confianza: 0 };
    } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        document.querySelectorAll('.ocr-overlay').forEach(el => el.classList.remove('active'));
        if (globalOverlay) globalOverlay.classList.add('hidden');
    }
}

/**
 * Helper: Carga un blob URL en un elemento Image.
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function cargarImagen(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la imagen seleccionada.'));
        img.src = url;
    });
}

/**
 * Muestra un modal de confirmación con el valor detectado por OCR.
 * Permite al usuario editarlo antes de confirmar.
 * @param {number|null} valorDetectado
 * @returns {Promise<number|null>}
 */
function confirmarOCR(valorDetectado) {
    return new Promise((resolve) => {
        // Remover cualquier modal previo
        document.getElementById('ocr-confirm-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.id = 'ocr-confirm-overlay';
        overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <h3 class="modal-title">🔍 Resultado OCR</h3>
          <button class="modal-close" id="ocr-modal-close">✕</button>
        </div>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;">
          ${valorDetectado !== null
            ? 'El sistema detectó este kilometraje. Verifica o ajusta el valor antes de confirmar.'
            : 'No se pudo detectar el número claramente. Ingresa el kilometraje que marca tu moto:'}
        </p>
        <div class="form-group">
          <label class="form-label" for="ocr-km-input">Kilometraje Odómetro</label>
          <div class="km-input-wrapper">
            <input
              type="number"
              class="form-control"
              id="ocr-km-input"
              value="${valorDetectado !== null ? valorDetectado : ''}"
              placeholder="ej. 5200"
              inputmode="numeric"
              style="font-family:var(--font-mono);font-size:1.4rem;font-weight:700;text-align:center;padding-right:3.5rem;"
            />
            <span class="km-unit-badge">km</span>
          </div>
          <p class="form-hint" style="${valorDetectado !== null ? '' : 'color:var(--accent-orange)'}">
            ${valorDetectado !== null
                ? 'Comprueba que coincida con el tablero de tu motocicleta.'
                : '💡 Consejo: Toma la foto de cerca, bien enfocada y con buena iluminación.'}
          </p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-top:1rem;">
          <button class="btn btn-outline" id="ocr-cancel-btn">Cancelar</button>
          <button class="btn btn-primary" id="ocr-confirm-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;"><path d="M20 6L9 17l-5-5"/></svg>
            Confirmar
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(overlay);

        const inputEl = document.getElementById('ocr-km-input');
        inputEl?.focus();

        const cerrar = (valor) => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 250);
            resolve(valor);
        };

        document.getElementById('ocr-confirm-btn')?.addEventListener('click', () => {
            const val = parseInt(inputEl?.value, 10);
            cerrar(isNaN(val) || val < 0 ? null : val);
        });

        document.getElementById('ocr-cancel-btn')?.addEventListener('click', () => cerrar(null));
        document.getElementById('ocr-modal-close')?.addEventListener('click', () => cerrar(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(null); });
    });
}

/**
 * Flujo completo: selección de archivo → OCR → confirmación → valor final.
 * @param {File} file
 * @returns {Promise<number|null>}
 */
async function flujoOCR(file) {
    if (!file) return null;

    if (window.showToast) {
        window.showToast('Iniciando lectura OCR del odómetro...', 'info');
    }

    const resultado = await reconocerKilometraje(file);
    const valorConfirmado = await confirmarOCR(resultado.valor);

    return valorConfirmado;
}

// ─── Exportar ────────────────────────────────────────────────────────────────
window.OCR = {
    flujoOCR,
    reconocerKilometraje,
    confirmarOCR,
};
