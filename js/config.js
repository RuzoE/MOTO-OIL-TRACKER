/**
 * config.js — Configuración centralizada de entorno para el frontend.
 *
 * Regla de selección de la URL del backend:
 *   1. Si el usuario guardó una URL personalizada en localStorage (backendUrl),
 *      se usa esa (permite apuntar a un backend alternativo sin tocar código).
 *   2. Si el hostname actual es localhost / 127.0.0.1, se usa el backend local
 *      (entorno de desarrollo con el servidor corriendo en :3000).
 *   3. En cualquier otro caso (GitHub Pages u otro hosting externo), se usa
 *      la URL de producción de Render.
 *
 * NOTA DE SEGURIDAD: Este archivo no contiene claves de API ni secretos.
 *                    La API Key de Brevo reside exclusivamente en el backend.
 */

const APP_CONFIG = (() => {
    // URL del backend en producción (Render)
    const BACKEND_PROD = 'https://moto-oil-tracker.onrender.com';

    // URL del backend en desarrollo local
    const BACKEND_DEV  = 'http://localhost:3000';

    /**
     * Determina si estamos en un entorno de desarrollo local.
     * Se considera desarrollo cuando el hostname es localhost o 127.0.0.1.
     */
    function esDesarrolloLocal() {
        const h = location.hostname;
        return h === 'localhost' || h === '127.0.0.1';
    }

    /**
     * Resuelve la URL base del backend según la siguiente prioridad:
     *   1. Valor guardado por el usuario en localStorage (backendUrl)
     *   2. BACKEND_DEV si estamos en localhost / 127.0.0.1
     *   3. BACKEND_PROD para cualquier otro host (GitHub Pages, etc.)
     */
    function resolverBackendUrl() {
        try {
            const stored = localStorage.getItem('mt_config');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.backendUrl && parsed.backendUrl.startsWith('http')) {
                    return parsed.backendUrl.replace(/\/+$/, '');
                }
            }
        } catch (_) { /* localStorage puede no estar disponible */ }

        return esDesarrolloLocal() ? BACKEND_DEV : BACKEND_PROD;
    }

    return {
        /** URL de producción (Render) */
        BACKEND_PROD,

        /** URL de desarrollo local */
        BACKEND_DEV,

        /**
         * URL efectiva del backend para la sesión actual.
         * Se evalúa una vez al cargar la página.
         */
        backendUrl: resolverBackendUrl(),

        /** true si estamos en localhost / 127.0.0.1 */
        isDev: esDesarrolloLocal(),
    };
})();

// Exponer al ámbito global para que brevo.js y cualquier otro módulo lo usen
window.APP_CONFIG = APP_CONFIG;
