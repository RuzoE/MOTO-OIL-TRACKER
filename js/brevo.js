/**
 * brevo.js — Cliente Frontend para el Servicio Centralizado de Brevo
 * Comunica el navegador con el backend seguro de Moto Oil Tracker.
 * NOTA DE SEGURIDAD: Este archivo NO contiene claves de API ni credenciales sensibles.
 *
 * La URL del backend se obtiene de APP_CONFIG (js/config.js), que selecciona
 * automáticamente entre desarrollo local (localhost:3000) y producción (Render).
 */

// ─── Configuración de la URL del Backend ──────────────────────────────────────
/**
 * Devuelve la URL base del backend activo.
 * Prioridad: override en localStorage > APP_CONFIG (dev/prod automático)
 */
function obtenerBackendUrl() {
    // APP_CONFIG se carga desde js/config.js (debe incluirse antes en el HTML)
    if (window.APP_CONFIG) {
        return window.APP_CONFIG.backendUrl;
    }
    // Fallback de emergencia si config.js no cargó por algún motivo
    const h = location.hostname;
    return (h === 'localhost' || h === '127.0.0.1')
        ? 'http://localhost:3000'
        : 'https://moto-oil-tracker.onrender.com';
}

// ─── 1. Verificación del Estado del Servidor ──────────────────────────────────
/**
 * Consulta la disponibilidad del microservicio backend
 * @returns {Promise<{ ok: boolean, brevoConfigured?: boolean, senderName?: string, error?: string }>}
 */
async function verificarEstadoServidor() {
    const baseUrl = obtenerBackendUrl();
    try {
        const response = await fetch(`${baseUrl}/api/status`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
            const data = await response.json();
            return {
                ok: true,
                brevoConfigured: data.brevoConfigured,
                senderName: data.senderName,
                service: data.service,
            };
        } else {
            return { ok: false, error: `Servidor respondió con código ${response.status}` };
        }
    } catch (err) {
        return { ok: false, error: 'No se pudo conectar con el servidor de notificaciones.' };
    }
}

// ─── 2. Sistema de Verificación con Código de 6 Dígitos ───────────────────────

/**
 * Solicita el envío de un código de 6 dígitos al correo del usuario
 * @param {string} email
 * @param {string} name
 * @returns {Promise<{ ok: boolean, message?: string, error?: string, cooldownRemaining?: number }>}
 */
async function solicitarCodigoVerificacion(email, name) {
    const baseUrl = obtenerBackendUrl();
    try {
        const response = await fetch(`${baseUrl}/api/verify/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ email, name }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.ok) {
            return {
                ok: true,
                message: data.message,
                expiresInMinutes: data.expiresInMinutes,
                cooldownSeconds: data.cooldownSeconds,
            };
        } else {
            return {
                ok: false,
                error: data.error || 'No se pudo solicitar el código de verificación.',
                cooldownRemaining: data.cooldownRemaining,
            };
        }
    } catch (err) {
        return {
            ok: false,
            error: 'Error de conexión con el servidor al solicitar el código.',
        };
    }
}

/**
 * Valida el código de 6 dígitos introducido por el usuario
 * @param {string} email
 * @param {string} code
 * @returns {Promise<{ ok: boolean, verificationToken?: string, message?: string, error?: string }>}
 */
async function confirmarCodigo(email, code) {
    const baseUrl = obtenerBackendUrl();
    try {
        const response = await fetch(`${baseUrl}/api/verify/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ email, code }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.ok) {
            // Guardar en Storage local el estado verificado con el token firmado del servidor
            const config = window.Storage?.obtenerConfig() || {};
            config.emailUsuario = email.toLowerCase().trim();
            config.emailVerificado = true;
            config.verificationToken = data.verificationToken;
            config.fechaVerificacion = new Date().toISOString();
            if (data.name) config.nombreUsuario = data.name;
            window.Storage?.guardarConfig(config);

            return {
                ok: true,
                message: data.message,
                verificationToken: data.verificationToken,
            };
        } else {
            return {
                ok: false,
                error: data.error || 'Código incorrecto o expirado.',
            };
        }
    } catch (err) {
        return {
            ok: false,
            error: 'Error de conexión con el servidor al confirmar el código.',
        };
    }
}

/**
 * Consulta el estado de verificación de un correo registrado en el backend
 * @param {string} email
 * @returns {Promise<{ ok: boolean, verified: boolean, verifiedAt?: string }>}
 */
async function consultarEstadoVerificacion(email) {
    if (!email) return { ok: false, verified: false };
    const baseUrl = obtenerBackendUrl();
    try {
        const response = await fetch(`${baseUrl}/api/verify/status/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.ok) {
            return {
                ok: true,
                verified: data.verified,
                verifiedAt: data.verifiedAt,
            };
        }
        return { ok: false, verified: false };
    } catch (e) {
        return { ok: false, verified: false };
    }
}

// ─── 3. Envío de Correo de Prueba ─────────────────────────────────────────────
/**
 * Envía un correo de prueba al correo verificado del usuario
 * @returns {Promise<{ ok: boolean, message?: string, error?: string }>}
 */
async function enviarEmailPrueba() {
    const config = window.Storage?.obtenerConfig() || {};
    if (!config.emailUsuario) {
        return { ok: false, error: 'Debes registrar primero tu correo electrónico personal.' };
    }
    if (!config.emailVerificado) {
        return { ok: false, error: 'Debes verificar tu correo con el código de 6 dígitos antes de probar el envío.' };
    }

    const baseUrl = obtenerBackendUrl();
    try {
        const response = await fetch(`${baseUrl}/api/email/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                email: config.emailUsuario,
                name: config.nombreUsuario || 'Piloto',
                token: config.verificationToken,
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.ok) {
            return { ok: true, message: data.message };
        } else {
            return { ok: false, error: data.error || 'Error enviando correo de prueba.' };
        }
    } catch (err) {
        return { ok: false, error: 'Error de conexión con el servidor de correo.' };
    }
}

// ─── 4. Envío de Alertas de Mantenimiento ──────────────────────────────────────
/**
 * Envía una alerta de cambio de aceite o mantenimiento vía backend
 * @param {string} tipo - 'warning' | 'urgent' | 'mantenimiento'
 * @param {Object} moto - Datos de la motocicleta
 * @param {Object} extra - Información adicional del mantenimiento
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function enviarAlertaEmail(tipo, moto, extra = {}) {
    const config = window.Storage?.obtenerConfig() || {};

    if (!config.emailUsuario || !config.emailVerificado) {
        return { ok: false, error: 'El correo electrónico no está registrado o no ha sido verificado.' };
    }

    const baseUrl = obtenerBackendUrl();
    try {
        const response = await fetch(`${baseUrl}/api/email/alert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                email: config.emailUsuario,
                name: config.nombreUsuario || 'Piloto',
                token: config.verificationToken,
                tipo,
                moto,
                extra,
            }),
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.ok) {
            return { ok: true };
        } else {
            return { ok: false, error: data.error };
        }
    } catch (err) {
        return { ok: false, error: 'Error de red comunicando alerta al servidor.' };
    }
}

// ─── 5. Verificación Automática de Alertas en el Dashboard ────────────────────
//
// Control de duplicados EN EL CLIENTE (primera línea de defensa, sin acceso a red):
//
//   Clave de sesión: tipo_ciclo  donde ciclo = kmUltimoCambio
//   → Si el km actual sube de 5.000 a 5.050 sin cambio de aceite (mismo ciclo),
//     el Set impide llamar al backend una segunda vez.
//   → Al registrar un nuevo cambio de aceite el kmUltimoCambio cambia, por lo que
//     el Set permite el envío del próximo ciclo.
//
// El backend actúa como segunda línea de defensa (clave persistente en disco).
//
const _alertasEnviadasEnSesion = new Set();

async function verificarYEnviarAlerta(moto) {
    if (!moto) return;
    const config = window.Storage?.obtenerConfig() || {};
    if (!config.emailUsuario || !config.emailVerificado) return;

    const kmRestantes = moto.kmProximoCambio - moto.kmActual;

    // cicloId = kmUltimoCambio identifica el ciclo de aceite activo
    const cicloId = moto.kmUltimoCambio;

    if (kmRestantes <= 0) {
        // Aceite vencido — alerta urgente, una por ciclo
        const claveUrgent = `urgent_ciclo_${cicloId}`;
        if (!_alertasEnviadasEnSesion.has(claveUrgent)) {
            _alertasEnviadasEnSesion.add(claveUrgent);
            await enviarAlertaEmail('urgent', moto);
        }
    } else if (kmRestantes <= 100) {
        // Próximo cambio a ≤ 100 km — alerta de advertencia, una por ciclo
        const claveWarn = `warn_ciclo_${cicloId}`;
        if (!_alertasEnviadasEnSesion.has(claveWarn)) {
            _alertasEnviadasEnSesion.add(claveWarn);
            await enviarAlertaEmail('warning', moto);
        }
    }
}

// ─── Exportar al Objeto Global ────────────────────────────────────────────────
window.Brevo = {
    obtenerBackendUrl,
    verificarEstadoServidor,
    solicitarCodigoVerificacion,
    confirmarCodigo,
    consultarEstadoVerificacion,
    enviarEmailPrueba,
    enviarAlertaEmail,
    verificarYEnviarAlerta,
};
