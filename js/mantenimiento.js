/**
 * mantenimiento.js — Lógica de la bitácora de mantenimientos y taller
 * Integrado con el sistema centralizado de alertas por correo Brevo.
 */

// ─── Estado ───────────────────────────────────────────────────────────────────
let filtroActivo = 'todos';
let tipoSeleccionado = 'servicio';
let cambioAceiteRequerido = false;

// ─── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!window.Storage?.estaRegistrada()) {
        window.location.replace('registro.html');
        return;
    }

    renderStats();
    renderEventos();
    initFiltros();
    initModalForm();
});

// ─── Stats y resumen ─────────────────────────────────────────────────────────
function renderStats() {
    const todos = window.Storage.obtenerMantenimientos();

    const porTipo = { aceite: 0, falla: 0, servicio: 0, otro: 0 };
    todos.forEach(m => { if (porTipo[m.tipo] !== undefined) porTipo[m.tipo]++; });

    setIfExists('stat-total', todos.length);
    setIfExists('stat-aceites', porTipo.aceite);
    setIfExists('stat-fallas', porTipo.falla);
}

function setIfExists(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
function initFiltros() {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filtroActivo = chip.dataset.filtro || 'todos';
            renderEventos();
        });
    });
}

// ─── Lista de eventos ─────────────────────────────────────────────────────────
function renderEventos() {
    const container = document.getElementById('eventos-lista');
    if (!container) return;

    let eventos = window.Storage.obtenerMantenimientos();

    if (filtroActivo !== 'todos') {
        eventos = eventos.filter(e => e.tipo === filtroActivo);
    }

    if (!eventos.length) {
        container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <p>Sin eventos registrados. Toca <strong>+</strong> para agregar uno.</p>
      </div>`;
        return;
    }

    container.innerHTML = eventos.map(evt => `
    <div class="event-card" id="evt-${evt.id}">
      <div class="event-icon-wrap ${evt.tipo}">
        ${iconoEvento(evt.tipo)}
      </div>
      <div class="event-body">
        <div class="event-title-row">
          <span class="event-title">${evt.titulo}</span>
          <span class="event-km">${(evt.km || 0).toLocaleString()} km</span>
        </div>
        ${evt.detalle ? `<p class="event-desc">${evt.detalle}</p>` : ''}
        <div class="event-footer">
          <span class="event-date">${window.Storage.formatearFecha(evt.fecha)}</span>
          <span class="badge ${badgePorTipo(evt.tipo)}">${labelPorTipo(evt.tipo)}</span>
          ${evt.requiereCambioAceite ? '<span class="badge badge-orange">🛢 Cambio Aceite</span>' : ''}
        </div>
      </div>
      <button class="btn-delete-event" onclick="eliminarEvento(${evt.id})" title="Eliminar registro">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
      </button>
    </div>
  `).join('');
}

function iconoEvento(tipo) {
    const icons = {
        aceite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L8 9H4l8 13 8-13h-4L12 2z"/></svg>`,
        falla: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        servicio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/></svg>`,
        otro: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    };
    return icons[tipo] || icons.otro;
}

function badgePorTipo(tipo) {
    const mapa = { aceite: 'badge-orange', falla: 'badge-red', servicio: 'badge-blue', otro: '' };
    return mapa[tipo] || '';
}

function labelPorTipo(tipo) {
    const mapa = { aceite: 'Aceite', falla: 'Falla', servicio: 'Servicio', otro: 'Otro' };
    return mapa[tipo] || tipo;
}

// ─── Eliminar evento ──────────────────────────────────────────────────────────
window.eliminarEvento = function (id) {
    if (!confirm('¿Eliminar este registro de mantenimiento?')) return;
    window.Storage.eliminarMantenimiento(id);
    renderEventos();
    renderStats();
    showToast('Registro eliminado', 'info');
};

// ─── Modal: Nuevo evento ──────────────────────────────────────────────────────
function initModalForm() {
    document.querySelectorAll('.tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            tipoSeleccionado = btn.dataset.tipo;

            if (tipoSeleccionado === 'aceite') {
                cambioAceiteRequerido = true;
                document.getElementById('toggle-switch')?.classList.add('on');
            }

            const tituloInput = document.getElementById('campo-titulo');
            if (tituloInput && !tituloInput.value) {
                const defaults = { aceite: 'Cambio de Aceite', falla: 'Falla Mecánica', servicio: 'Servicio de Taller', otro: 'Mantenimiento General' };
                tituloInput.placeholder = defaults[tipoSeleccionado] || '';
            }

            actualizarBannerRecalculo();
        });
    });

    const toggleEl = document.getElementById('toggle-cambio-aceite');
    const toggleSw = document.getElementById('toggle-switch');
    if (toggleEl && toggleSw) {
        toggleEl.addEventListener('click', () => {
            cambioAceiteRequerido = !cambioAceiteRequerido;
            toggleSw.classList.toggle('on', cambioAceiteRequerido);
            actualizarBannerRecalculo();
        });
    }

    const inputKm = document.getElementById('campo-evt-km');
    if (inputKm) {
        inputKm.addEventListener('input', actualizarBannerRecalculo);
        const moto = window.Storage.obtenerMoto();
        if (moto) inputKm.value = moto.kmActual;
    }
}

function actualizarBannerRecalculo() {
    const banner = document.getElementById('recalc-banner');
    const inputKm = document.getElementById('campo-evt-km');
    const moto = window.Storage.obtenerMoto();

    if (!banner || !moto) return;

    const km = parseInt(inputKm?.value, 10);

    if (cambioAceiteRequerido && km > 0) {
        const nuevoObjetivo = km + moto.intervalo;
        banner.classList.add('visible');
        banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      Nuevo próximo objetivo: <strong>${nuevoObjetivo.toLocaleString()} km</strong> (al momento del taller + intervalo)
    `;
    } else {
        banner.classList.remove('visible');
    }
}

// ─── Abrir / Cerrar modal ─────────────────────────────────────────────────────
window.abrirModalNuevo = function () {
    const moto = window.Storage.obtenerMoto();
    if (!moto) return;

    cambioAceiteRequerido = false;
    tipoSeleccionado = 'servicio';

    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.tipo-btn[data-tipo="servicio"]')?.classList.add('selected');
    document.getElementById('toggle-switch')?.classList.remove('on');
    document.getElementById('recalc-banner')?.classList.remove('visible');

    const inputKm = document.getElementById('campo-evt-km');
    if (inputKm) inputKm.value = moto.kmActual;

    const titulo = document.getElementById('campo-titulo');
    if (titulo) { titulo.value = ''; titulo.placeholder = 'ej. Revisión de frenos, kit de arrastre'; }

    const detalle = document.getElementById('campo-detalle');
    if (detalle) detalle.value = '';

    const fechaInput = document.getElementById('campo-fecha');
    if (fechaInput) fechaInput.value = new Date().toISOString().slice(0, 10);

    document.getElementById('modal-nuevo-evento')?.classList.add('active');
};

window.cerrarModalNuevo = function () {
    document.getElementById('modal-nuevo-evento')?.classList.remove('active');
};

window.guardarEvento = async function () {
    const moto = window.Storage.obtenerMoto();
    if (!moto) return;

    const titulo = document.getElementById('campo-titulo')?.value.trim();
    const km = parseInt(document.getElementById('campo-evt-km')?.value, 10);
    const detalle = document.getElementById('campo-detalle')?.value.trim();
    const fecha = document.getElementById('campo-fecha')?.value;

    if (!titulo) { showToast('Ingresa el título del mantenimiento', 'warning'); return; }
    if (isNaN(km) || km <= 0) { showToast('Ingresa el kilometraje válido del evento', 'warning'); return; }

    const datos = {
        tipo: tipoSeleccionado,
        titulo,
        km,
        detalle,
        fecha: fecha ? new Date(fecha + 'T12:00:00').toISOString() : new Date().toISOString(),
        requiereCambioAceite: cambioAceiteRequerido,
    };

    const { evento, motoActualizada } = window.Storage.agregarMantenimiento(datos);

    // Enviar confirmación por correo vía backend si el usuario tiene correo verificado
    if (motoActualizada) {
        window.Brevo?.enviarAlertaEmail('mantenimiento', motoActualizada, {
            titulo: evento.titulo,
            detalle: evento.detalle || `Trabajo registrado a los ${evento.km.toLocaleString()} km.`,
        });

        if (cambioAceiteRequerido) {
            window.Notif?.notificar(
                '🛢️ Cambio de Aceite Registrado',
                `Se recalculó el próximo objetivo a los ${(km + moto.intervalo).toLocaleString()} km`,
                { tag: 'aceite-recalculado' }
            );
        }
    }

    cerrarModalNuevo();
    renderEventos();
    renderStats();

    const msg = cambioAceiteRequerido
        ? `✅ Mantenimiento guardado. Próximo cambio: ${(km + moto.intervalo).toLocaleString()} km`
        : '✅ Mantenimiento registrado en la bitácora';
    showToast(msg, 'success');
};
