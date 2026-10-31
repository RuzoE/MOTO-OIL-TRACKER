/**
 * notifications.js — Gestor de Web Push Notifications API
 * Solicita permisos, registra el Service Worker y envía notificaciones locales.
 */

// ─── Registro del Service Worker ─────────────────────────────────────────────

/**
 * Registra el Service Worker si el navegador lo soporta.
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
async function registrarSW() {
    if (!('serviceWorker' in navigator)) {
        console.warn('[Notif] Service Workers no soportados en este navegador');
        return null;
    }
    try {
        const swUrl = location.pathname.includes('/html/') ? '../sw.js' : './sw.js';
        const registration = await navigator.serviceWorker.register(swUrl);
        console.log('[Notif] SW registrado con éxito');
        return registration;
    } catch (err) {
        console.warn('[Notif] Error registrando SW:', err);
        return null;
    }
}

// ─── Permiso para notificaciones ─────────────────────────────────────────────

/**
 * Solicita permiso de notificaciones al usuario.
 * @returns {Promise<boolean>} - true si se concedió el permiso
 */
async function solicitarPermiso() {
    if (!('Notification' in window)) {
        if (window.showToast) window.showToast('Tu navegador no soporta la API de notificaciones', 'warning');
        return false;
    }

    if (Notification.permission === 'granted') return true;

    if (Notification.permission === 'denied') {
        if (window.showToast) window.showToast('Las notificaciones están bloqueadas en los ajustes del navegador', 'warning');
        return false;
    }

    try {
        const permiso = await Notification.requestPermission();
        if (permiso === 'granted') {
            if (window.showToast) window.showToast('¡Notificaciones activadas! 🔔', 'success');
            return true;
        } else {
            if (window.showToast) window.showToast('Notificaciones denegadas por el usuario', 'warning');
            return false;
        }
    } catch (e) {
        console.error('[Notif] Error solicitando permiso:', e);
        return false;
    }
}

// ─── Enviar notificación local ────────────────────────────────────────────────

/**
 * Muestra una notificación local usando el Service Worker o la API de Notification directa.
 * @param {string} titulo
 * @param {string} cuerpo
 * @param {Object} opciones
 */
async function notificar(titulo, cuerpo, opciones = {}) {
    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') {
        const permitido = await solicitarPermiso();
        if (!permitido) return;
    }

    const targetUrl = opciones.url || (location.pathname.includes('/html/') ? './dashboard.html' : './html/dashboard.html');

    const opcionesBase = {
        body: cuerpo,
        icon: 'https://api.iconify.design/mdi/motorbike.svg?color=%23f97316&width=192&height=192',
        badge: 'https://api.iconify.design/mdi/motorbike.svg?color=%23f97316&width=96&height=96',
        vibrate: [200, 100, 200],
        tag: opciones.tag || 'mototracker-alert',
        renotify: true,
        data: { url: targetUrl },
        ...opciones,
    };

    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                await reg.showNotification(titulo, opcionesBase);
                return;
            }
        }
    } catch (e) {
        console.warn('[Notif] Fallback a Notification directa:', e);
    }

    // Fallback: objeto Notification en el navegador
    try {
        new Notification(titulo, opcionesBase);
    } catch (err) {
        console.error('[Notif] No se pudo mostrar la notificación:', err);
    }
}

// ─── Chequeo de alertas de kilometraje ────────────────────────────────────────

/**
 * Evalúa el estado del aceite y envía notificación si es necesario.
 * @param {Object} moto - Objeto moto de Storage
 */
async function verificarAlertas(moto) {
    if (!moto) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const kmRestantes = moto.kmProximoCambio - moto.kmActual;
    const pct = Math.round((kmRestantes / moto.intervalo) * 100);

    if (kmRestantes <= 0) {
        await notificar(
            '🚨 ¡Cambio de Aceite Urgente!',
            `Tu ${moto.marca} ${moto.modelo} superó el límite por ${Math.abs(kmRestantes).toLocaleString()} km. ¡Llévala al taller!`,
            { tag: 'moto-urgente' }
        );
    } else if (pct <= 10) {
        await notificar(
            '⚠️ Cambio de Aceite Próximo',
            `Solo te quedan ${kmRestantes.toLocaleString()} km para el próximo cambio de aceite de tu ${moto.modelo}`,
            { tag: 'moto-warning' }
        );
    }
}

/**
 * Activa notificaciones y guarda la preferencia en config
 */
async function activarNotificaciones() {
    const concedido = await solicitarPermiso();
    if (concedido) {
        await registrarSW();
        const config = window.Storage?.obtenerConfig() || {};
        config.notifPush = true;
        window.Storage?.guardarConfig(config);
    }
    return concedido;
}

// ─── Exportar ────────────────────────────────────────────────────────────────
window.Notif = {
    registrarSW,
    solicitarPermiso,
    notificar,
    verificarAlertas,
    activarNotificaciones,
};
