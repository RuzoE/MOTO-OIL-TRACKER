/**
 * registro.js — Lógica del onboarding de la motocicleta (3 pasos)
 * Paso 1: Datos de la moto | Paso 2: Intervalo y km | Paso 3: Confirmación
 */

// ─── Estado del formulario ────────────────────────────────────────────────────
let step = 1;
const data = { marca: '', modelo: '', anio: '', cilindraje: '', intervalo: 1500, kmInicial: 0 };

// ─── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Si ya está registrado, ir directo al dashboard
    if (window.Storage?.estaRegistrada()) {
        window.location.replace('dashboard.html');
        return;
    }

    initStepDots();
    initIntervalButtons();
    initKmInput();
    initPhotoZone();
    initNavButtons();
    actualizarUI();
});

// ─── Control de pasos del formulario ──────────────────────────────────────────
function irAPaso(nuevo) {
    if (nuevo < 1 || nuevo > 3) return;
    if (nuevo > step && !validarPasoActual()) return;

    step = nuevo;
    actualizarUI();
}

function actualizarUI() {
    // Secciones activas
    document.querySelectorAll('.step-section').forEach((sec, idx) => {
        sec.classList.toggle('active', idx + 1 === step);
    });

    // Indicador Stepper
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx + 1 === step);
        dot.classList.toggle('completed', idx + 1 < step);
        if (idx + 1 < step) dot.innerHTML = svgCheck();
        else dot.textContent = idx + 1;
    });

    document.querySelectorAll('.step-line').forEach((line, idx) => {
        line.classList.toggle('completed', idx + 1 < step);
    });

    // Botones Siguiente / Atrás
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (btnPrev) btnPrev.style.display = step === 1 ? 'none' : '';
    if (btnNext) btnNext.textContent = step === 3 ? '✓ Guardar y comenzar' : 'Siguiente →';

    // Paso 3: Rellenar resumen
    if (step === 3) llenarResumen();
}

function svgCheck() {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>`;
}

// ─── Validaciones ─────────────────────────────────────────────────────────────
function validarPasoActual() {
    if (step === 1) return validarPaso1();
    if (step === 2) return validarPaso2();
    return true;
}

function validarPaso1() {
    const marca = document.getElementById('campo-marca')?.value.trim();
    const modelo = document.getElementById('campo-modelo')?.value.trim();
    const anio = document.getElementById('campo-anio')?.value.trim();

    if (!marca) { showToast('Ingresa la marca de la moto (ej. Bajaj)', 'warning'); return false; }
    if (!modelo) { showToast('Ingresa el modelo de la moto (ej. Pulsar NS160)', 'warning'); return false; }

    data.marca = marca;
    data.modelo = modelo;
    data.anio = anio;
    data.cilindraje = document.getElementById('campo-cilindraje')?.value.trim() || '';
    return true;
}

function validarPaso2() {
    const kmVal = document.getElementById('campo-km')?.value;
    const km = parseInt(kmVal, 10);

    if (kmVal === '' || isNaN(km) || km < 0) {
        showToast('Ingresa el kilometraje actual del odómetro (o 0 si es nueva)', 'warning');
        return false;
    }

    data.kmInicial = km;
    return true;
}

// ─── Botones de Intervalo (Preset) ───────────────────────────────────────────
function initIntervalButtons() {
    document.querySelectorAll('.interval-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            data.intervalo = parseInt(btn.dataset.km, 10);

            const inputCustom = document.getElementById('campo-intervalo-custom');
            if (inputCustom) inputCustom.value = data.intervalo;
        });
    });

    const inputCustom = document.getElementById('campo-intervalo-custom');
    if (inputCustom) {
        inputCustom.addEventListener('input', () => {
            const val = parseInt(inputCustom.value, 10);
            if (val > 0) {
                data.intervalo = val;
                document.querySelectorAll('.interval-btn').forEach(b => {
                    b.classList.toggle('selected', parseInt(b.dataset.km, 10) === val);
                });
            }
        });
    }
}

// ─── Input de Kilometraje Manual ──────────────────────────────────────────────
function initKmInput() {
    const input = document.getElementById('campo-km');
    if (!input) return;
    input.addEventListener('input', () => {
        const val = parseInt(input.value, 10);
        data.kmInicial = (!isNaN(val) && val >= 0) ? val : 0;
    });
}

// ─── Foto y OCR ───────────────────────────────────────────────────────────────
function initPhotoZone() {
    const fileInput = document.getElementById('file-input');
    const photoZone = document.getElementById('photo-zone');
    const btnCamara = document.getElementById('btn-camara');
    const btnGaleria = document.getElementById('btn-galeria');

    if (photoZone) {
        photoZone.addEventListener('click', () => fileInput?.click());
        photoZone.addEventListener('dragover', (e) => { e.preventDefault(); photoZone.classList.add('dragover'); });
        photoZone.addEventListener('dragleave', () => photoZone.classList.remove('dragover'));
        photoZone.addEventListener('drop', (e) => {
            e.preventDefault();
            photoZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) procesarFoto(file);
        });
    }

    if (btnCamara) {
        btnCamara.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fileInput) {
                fileInput.accept = 'image/*';
                fileInput.capture = 'environment';
                fileInput.click();
            }
        });
    }

    if (btnGaleria) {
        btnGaleria.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fileInput) {
                fileInput.accept = 'image/*';
                fileInput.removeAttribute('capture');
                fileInput.click();
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) procesarFoto(file);
        });
    }
}

async function procesarFoto(file) {
    const previewImg = document.getElementById('preview-img');

    if (previewImg) {
        previewImg.src = URL.createObjectURL(file);
        previewImg.style.display = 'block';
    }

    if (!window.OCR) {
        showToast('Motor OCR no disponible. Ingresa el km manualmente.', 'warning');
        return;
    }

    const kmConfirmado = await window.OCR.flujoOCR(file);

    if (kmConfirmado !== null && !isNaN(kmConfirmado)) {
        const inputKm = document.getElementById('campo-km');
        if (inputKm) {
            inputKm.value = kmConfirmado;
            data.kmInicial = kmConfirmado;
        }
        showToast(`Kilometraje detectado: ${kmConfirmado.toLocaleString()} km`, 'success');
    }
}

// ─── Stepper Dots (Click para retroceder) ────────────────────────────────────
function initStepDots() {
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            if (idx + 1 <= step) irAPaso(idx + 1);
        });
    });
}

// ─── Botones de Navegación ────────────────────────────────────────────────────
function initNavButtons() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    btnPrev?.addEventListener('click', () => irAPaso(step - 1));
    btnNext?.addEventListener('click', () => {
        if (step < 3) irAPaso(step + 1);
        else guardarMoto();
    });
}

// ─── Resumen Final (Paso 3) ───────────────────────────────────────────────────
function llenarResumen() {
    const campos = {
        'res-marca': `${data.marca} ${data.modelo}`.trim(),
        'res-anio': data.anio || '—',
        'res-cilin': data.cilindraje ? `${data.cilindraje} cc` : '—',
        'res-km': `${(data.kmInicial || 0).toLocaleString('es-CO')} km`,
        'res-intervalo': `Cada ${data.intervalo.toLocaleString('es-CO')} km`,
        'res-proximo': `${((data.kmInicial || 0) + data.intervalo).toLocaleString('es-CO')} km`,
    };

    Object.entries(campos).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    });
}

// ─── Guardar en LocalStorage y Redirigir ───────────────────────────────────────
async function guardarMoto() {
    if (!validarPaso2()) return;

    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
        btnNext.disabled = true;
        btnNext.innerHTML = '<span class="spinner"></span> Guardando...';
    }

    try {
        window.Storage.inicializarMoto({
            marca: data.marca,
            modelo: data.modelo,
            anio: data.anio,
            cilindraje: data.cilindraje,
            kmActual: data.kmInicial,
            intervalo: data.intervalo,
        });

        // Registrar SW en segundo plano
        await window.Notif?.registrarSW();

        showToast('¡Moto registrada exitosamente! 🏍️', 'success');

        setTimeout(() => {
            window.location.replace('dashboard.html');
        }, 1200);
    } catch (e) {
        console.error('[Registro] Error al guardar:', e);
        showToast('Error al guardar. Intenta nuevamente.', 'error');
        if (btnNext) {
            btnNext.disabled = false;
            btnNext.textContent = '✓ Guardar y comenzar';
        }
    }
}
