/**
 * dashboard.js — Lógica del Panel Principal (odómetro, progreso aceite, acciones rápidas)
 */

// ─── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Redirigir si no está registrado
    if (!window.Storage?.estaRegistrada()) {
        window.location.replace('registro.html');
        return;
    }

    await window.Notif?.registrarSW();
    renderDashboard();
    verificarAlertas();
});

// ─── Renderizado principal ────────────────────────────────────────────────────
function renderDashboard() {
    const moto = window.Storage.obtenerMoto();
    if (!moto) return;

    // ─ Header
    document.getElementById('moto-nombre-header').textContent = `${moto.marca} ${moto.modelo}`;
    document.getElementById('moto-fecha-sub').textContent = `Último cambio: ${window.Storage.formatearFecha(moto.fechaUltimoCambio)}`;

    // ─ Odómetro principal
    document.getElementById('odo-km').textContent = moto.kmActual.toLocaleString('es-CO');
    document.getElementById('odo-moto').textContent = `${moto.marca} ${moto.modelo}${moto.anio ? ` · ${moto.anio}` : ''}${moto.cilindraje ? ` (${moto.cilindraje}cc)` : ''}`;

    // ─ Barra de progreso del aceite
    const pct = window.Storage.calcularPorcentajeAceite(moto);
    const pctDisplay = Math.max(0, Math.min(pct, 100)); // clamp 0-100 para la barra visual

    const barraFill = document.getElementById('oil-bar-fill');
    const pctText = document.getElementById('oil-pct-text');
    const pctOdoMeta = document.getElementById('oil-pct-meta');

    if (barraFill) {
        barraFill.style.width = pctDisplay + '%';
        barraFill.className = 'progress-bar-fill ' + claseBarraPorPct(pct);
    }
    if (pctText) {
        pctText.textContent = pct + '%';
        pctText.style.color = colorPorPct(pct);
    }
    if (pctOdoMeta) {
        pctOdoMeta.textContent = pct <= 0 ? 'Aceite Vencido' : 'Vida útil del aceite';
    }

    // ─ Info km bajo barra
    document.getElementById('km-ultimo-cambio').textContent = moto.kmUltimoCambio.toLocaleString('es-CO');
    document.getElementById('km-proximo-cambio').textContent = moto.kmProximoCambio.toLocaleString('es-CO');

    // ─ Stats
    const kmRestantes = window.Storage.calcularKmRestantes(moto);
    document.getElementById('stat-km-restantes').textContent = Math.abs(kmRestantes).toLocaleString('es-CO');
    document.getElementById('stat-intervalo').textContent = moto.intervalo.toLocaleString('es-CO');
    document.getElementById('stat-ultimo-cambio').textContent = window.Storage.formatearFecha(moto.fechaUltimoCambio);

    const mantenimientos = window.Storage.obtenerMantenimientos();
    document.getElementById('stat-eventos').textContent = mantenimientos.length;

    // ─ Estimador inteligente
    renderEstimador(moto);

    // ─ Historial reciente
    renderHistorialReciente();
}

// ─── Clases y colores de la barra según porcentaje ───────────────────────────
function claseBarraPorPct(pct) {
    if (pct > 50) return 'good';
    if (pct > 25) return 'mid';
    if (pct > 0) return 'low';
    return 'danger';
}

function colorPorPct(pct) {
    if (pct > 50) return 'var(--accent-green)';
    if (pct > 25) return 'var(--accent-yellow)';
    if (pct > 0) return 'var(--accent-orange)';
    return 'var(--accent-red)';
}

// ─── Alertas visuales ────────────────────────────────────────────────────────
function verificarAlertas() {
    const moto = window.Storage.obtenerMoto();
    if (!moto) return;

    const kmR = window.Storage.calcularKmRestantes(moto);
    const pct = window.Storage.calcularPorcentajeAceite(moto);
    const alertEl = document.getElementById('alert-banner');

    if (!alertEl) return;

    if (kmR <= 0) {
        alertEl.className = 'alert-banner danger-alert visible';
        alertEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>¡Cambio de aceite vencido hace <strong>${Math.abs(kmR).toLocaleString()} km</strong>! Requiere cambio urgente.</span>
    `;
    } else if (pct <= 10) {
        alertEl.className = 'alert-banner warn-alert visible';
        alertEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>Próximo cambio cerca: solo restan <strong>${kmR.toLocaleString()} km</strong>.</span>
    `;
    } else {
        alertEl.className = 'alert-banner';
    }

    // Push local & email con Brevo en background
    window.Notif?.verificarAlertas(moto);
    window.Brevo?.verificarYEnviarAlerta(moto);
}

// ─── Estimador de fecha ───────────────────────────────────────────────────────
function renderEstimador(moto) {
    const est = window.Storage.estimarFechaProximoCambio(moto);

    document.getElementById('est-km-dia').textContent = est.kmDia ? `${est.kmDia} km/día` : 'Sin datos';
    document.getElementById('est-dias').textContent = est.diasRestantes !== null ? `${est.diasRestantes} días` : '—';
    document.getElementById('est-fecha').textContent = est.fechaEstimada || 'Acumula más registros';
}

// ─── Historial reciente ────────────────────────────────────────────────────────
function renderHistorialReciente() {
    const container = document.getElementById('historial-reciente');
    if (!container) return;

    const mants = window.Storage.obtenerMantenimientos().slice(0, 5);
    const historial = window.Storage.obtenerHistorial().slice(0, 5);

    // Combinar y ordenar descendentemente por fecha
    const todos = [...mants, ...historial].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

    if (!todos.length) {
        container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <p>Sin registros todavía. Actualiza tu kilometraje o registra un mantenimiento.</p>
      </div>`;
        return;
    }

    container.innerHTML = todos.map(e => `
    <div class="recent-item">
      <div class="recent-icon ${iconoColorPorTipo(e.tipo)}">
        ${iconoSVGPorTipo(e.tipo)}
      </div>
      <div class="recent-info">
        <p class="recent-title">${e.titulo || 'Actualización de km'}</p>
        <p class="recent-meta">${window.Storage.formatearFecha(e.fecha)}</p>
      </div>
      <span class="recent-km">${(e.km || 0).toLocaleString()} km</span>
    </div>
  `).join('');
}

function iconoColorPorTipo(tipo) {
    const mapa = { aceite: 'stat-icon orange', falla: 'stat-icon', servicio: 'stat-icon blue', cambio_aceite: 'stat-icon orange' };
    return mapa[tipo] || 'stat-icon';
}

function iconoSVGPorTipo(tipo) {
    if (tipo === 'aceite' || tipo === 'cambio_aceite') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L8 9H4l8 13 8-13h-4L12 2z"/></svg>`;
    if (tipo === 'falla') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`;
    if (tipo === 'servicio') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/></svg>`;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
}

// ─── Modal: Actualizar Kilometraje Manual ──────────────────────────────────────
window.abrirModalKm = function () {
    const moto = window.Storage.obtenerMoto();
    const overlay = document.getElementById('modal-km');
    if (!overlay || !moto) return;

    document.getElementById('input-km-nuevo').value = moto.kmActual;
    overlay.classList.add('active');
    setTimeout(() => document.getElementById('input-km-nuevo')?.focus(), 250);
};

window.cerrarModalKm = function () {
    document.getElementById('modal-km')?.classList.remove('active');
};

window.guardarKm = async function () {
    const input = document.getElementById('input-km-nuevo');
    const km = parseInt(input?.value, 10);
    const moto = window.Storage.obtenerMoto();

    if (isNaN(km) || km < (moto?.kmActual || 0)) {
        showToast('El km debe ser mayor o igual al actual (' + (moto?.kmActual || 0).toLocaleString() + ' km)', 'warning');
        return;
    }

    window.Storage.actualizarKilometraje(km);
    cerrarModalKm();
    showToast(`Kilometraje actualizado: ${km.toLocaleString()} km`, 'success');
    renderDashboard();
    verificarAlertas();
};

// ─── OCR desde Dashboard ──────────────────────────────────────────────────────
window.usarOCRDashboard = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const km = await window.OCR?.flujoOCR(file);
        if (km !== null && !isNaN(km)) {
            const moto = window.Storage.obtenerMoto();
            if (km >= (moto?.kmActual || 0)) {
                window.Storage.actualizarKilometraje(km);
                showToast(`Kilometraje actualizado por OCR: ${km.toLocaleString()} km`, 'success');
                renderDashboard();
                verificarAlertas();
            } else {
                showToast(`El valor detectado (${km.toLocaleString()} km) es menor al actual (${(moto?.kmActual || 0).toLocaleString()} km).`, 'warning');
            }
        }
    };
    input.click();
};

// ─── Cambio de aceite HOY ─────────────────────────────────────────────────────
window.registrarCambioHoy = function () {
    const moto = window.Storage.obtenerMoto();
    if (!moto) return;

    const nuevoProximo = moto.kmActual + moto.intervalo;
    if (!confirm(`¿Confirmas que cambiaste el aceite hoy a los ${moto.kmActual.toLocaleString()} km?\n\nEl próximo objetivo se establecerá en ${nuevoProximo.toLocaleString()} km.`)) {
        return;
    }

    const motoActualizada = window.Storage.registrarCambioAceite();
    showToast('✅ ¡Cambio de aceite registrado! Ciclo reiniciado.', 'success');

    // Enviar notificación Push y Email
    window.Notif?.notificar(
        '✅ Cambio de Aceite Registrado',
        `Nuevo ciclo iniciado a los ${moto.kmActual.toLocaleString()} km. Próximo objetivo: ${nuevoProximo.toLocaleString()} km`,
        { tag: 'aceite-hoy' }
    );

    window.Brevo?.enviarAlertaEmail('mantenimiento', motoActualizada, {
        titulo: 'Cambio de Aceite Realizado',
        detalle: `Cambio de aceite registrado a los ${moto.kmActual.toLocaleString()} km. Próximo objetivo: ${nuevoProximo.toLocaleString()} km.`,
    });

    renderDashboard();
    verificarAlertas();
};
