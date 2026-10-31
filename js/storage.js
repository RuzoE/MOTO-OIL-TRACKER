/**
 * storage.js — Manejo centralizado de datos con localStorage
 * Gestiona el estado global de la moto, kilometrajes, historial y configuración de usuario.
 * NOTA DE SEGURIDAD: Nunca almacena credenciales ni claves de API en el cliente.
 */

const DB_KEYS = {
    MOTO: 'mt_moto',
    HISTORIAL: 'mt_historial',
    MANTENIMIENTOS: 'mt_mantenimientos',
    CONFIG: 'mt_config',
};

// ─── Funciones de bajo nivel ──────────────────────────────────────────────────

/** Lee y parsea datos de localStorage */
function leerDB(key, def = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : def;
    } catch (e) {
        console.error('[Storage] Error leyendo', key, e);
        return def;
    }
}

/** Guarda datos serializados en localStorage */
function guardarDB(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('[Storage] Error guardando', key, e);
        return false;
    }
}

// ─── Moto (datos principales y estado) ────────────────────────────────────────

/**
 * Crea y guarda los datos iniciales de la moto al registrarse.
 * @param {Object} datos - { marca, modelo, anio, cilindraje, kmActual, intervalo }
 */
function inicializarMoto(datos) {
    const kmActual = parseInt(datos.kmActual, 10);
    const intervalo = parseInt(datos.intervalo, 10);

    const moto = {
        marca: datos.marca,
        modelo: datos.modelo,
        anio: datos.anio,
        cilindraje: datos.cilindraje,
        kmActual: kmActual,
        kmUltimoCambio: kmActual,
        kmProximoCambio: kmActual + intervalo,
        intervalo: intervalo,
        fechaRegistro: new Date().toISOString(),
        fechaUltimoCambio: new Date().toISOString(),
        historialKm: [{ km: kmActual, fecha: new Date().toISOString(), tipo: 'inicio' }],
    };

    guardarDB(DB_KEYS.MOTO, moto);
    return moto;
}

/** Retorna el objeto moto completo o null si no está registrada */
function obtenerMoto() {
    return leerDB(DB_KEYS.MOTO, null);
}

/**
 * Actualiza los datos de configuración de la moto
 * @param {Object} nuevosDatos
 */
function actualizarDatosMoto(nuevosDatos) {
    const moto = obtenerMoto();
    if (!moto) return null;

    if (nuevosDatos.marca !== undefined) moto.marca = nuevosDatos.marca.trim();
    if (nuevosDatos.modelo !== undefined) moto.modelo = nuevosDatos.modelo.trim();
    if (nuevosDatos.anio !== undefined) moto.anio = nuevosDatos.anio;
    if (nuevosDatos.cilindraje !== undefined) moto.cilindraje = nuevosDatos.cilindraje;

    if (nuevosDatos.intervalo !== undefined) {
        const nuevoIntervalo = parseInt(nuevosDatos.intervalo, 10);
        if (nuevoIntervalo > 0) {
            moto.intervalo = nuevoIntervalo;
            moto.kmProximoCambio = moto.kmUltimoCambio + nuevoIntervalo;
        }
    }

    if (nuevosDatos.kmActual !== undefined) {
        const nuevoKm = parseInt(nuevosDatos.kmActual, 10);
        if (!isNaN(nuevoKm) && nuevoKm >= 0) {
            moto.kmActual = nuevoKm;
            moto.historialKm = moto.historialKm || [];
            moto.historialKm.push({ km: nuevoKm, fecha: new Date().toISOString(), tipo: 'ajuste_manual' });
        }
    }

    guardarDB(DB_KEYS.MOTO, moto);
    return moto;
}

/** Actualiza el kilometraje actual de la moto */
function actualizarKilometraje(nuevoKm) {
    const moto = obtenerMoto();
    if (!moto) return null;

    const kmAnterior = moto.kmActual;
    nuevoKm = parseInt(nuevoKm, 10);

    if (nuevoKm < kmAnterior) {
        console.warn('[Storage] El nuevo km es menor al anterior. Ignorando.');
        return null;
    }

    moto.historialKm = moto.historialKm || [];
    moto.historialKm.push({ km: nuevoKm, fecha: new Date().toISOString(), tipo: 'actualizacion' });

    moto.kmActual = nuevoKm;
    guardarDB(DB_KEYS.MOTO, moto);
    return moto;
}

/**
 * Registra que se realizó un cambio de aceite HOY.
 */
function registrarCambioAceite(kmAlMomento) {
    const moto = obtenerMoto();
    if (!moto) return null;

    const km = kmAlMomento !== undefined ? parseInt(kmAlMomento, 10) : moto.kmActual;
    const now = new Date().toISOString();

    moto.kmActual = km;
    moto.kmUltimoCambio = km;
    moto.kmProximoCambio = km + moto.intervalo;
    moto.fechaUltimoCambio = now;

    moto.historialKm = moto.historialKm || [];
    moto.historialKm.push({ km, fecha: now, tipo: 'cambio_aceite' });

    guardarDB(DB_KEYS.MOTO, moto);

    const historial = leerDB(DB_KEYS.HISTORIAL, []);
    historial.unshift({
        id: Date.now(),
        tipo: 'cambio_aceite',
        km,
        fecha: now,
        titulo: 'Cambio de Aceite',
        detalle: `Próximo cambio en ${moto.kmProximoCambio.toLocaleString()} km`,
    });
    guardarDB(DB_KEYS.HISTORIAL, historial);

    return moto;
}

// ─── Cálculos de estado del aceite ────────────────────────────────────────────

function calcularPorcentajeAceite(moto) {
    if (!moto) return 0;
    const restante = moto.kmProximoCambio - moto.kmActual;
    const pct = Math.round((restante / moto.intervalo) * 100);
    return Math.max(pct, -99);
}

function calcularKmRestantes(moto) {
    if (!moto) return 0;
    return moto.kmProximoCambio - moto.kmActual;
}

function estimarFechaProximoCambio(moto) {
    if (!moto || !moto.historialKm || moto.historialKm.length < 2) {
        return { kmDia: null, fechaEstimada: null, diasRestantes: null };
    }

    const historial = [...moto.historialKm].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const ultimas = historial.slice(-10);

    let totalKm = 0;
    let totalDias = 0;

    for (let i = 1; i < ultimas.length; i++) {
        const diffKm = ultimas[i].km - ultimas[i - 1].km;
        const diffMs = new Date(ultimas[i].fecha) - new Date(ultimas[i - 1].fecha);
        const diffDias = diffMs / (1000 * 60 * 60 * 24);
        if (diffDias > 0 && diffKm >= 0) {
            totalKm += diffKm;
            totalDias += diffDias;
        }
    }

    if (totalDias === 0) return { kmDia: null, fechaEstimada: null, diasRestantes: null };

    const kmDia = totalKm / totalDias;
    const kmRestantes = calcularKmRestantes(moto);
    const diasRestantes = kmDia > 0 ? Math.round(kmRestantes / kmDia) : null;

    let fechaEstimada = null;
    if (diasRestantes !== null) {
        const fechaObj = new Date();
        fechaObj.setDate(fechaObj.getDate() + diasRestantes);
        fechaEstimada = fechaObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    return {
        kmDia: Math.round(kmDia),
        fechaEstimada,
        diasRestantes,
    };
}

function obtenerHistorial() {
    return leerDB(DB_KEYS.HISTORIAL, []);
}

// ─── Mantenimientos (eventos de taller) ───────────────────────────────────────

function agregarMantenimiento(datos) {
    const mantenimientos = obtenerMantenimientos();
    const moto = obtenerMoto();

    const evento = {
        id: Date.now(),
        tipo: datos.tipo,
        titulo: datos.titulo,
        detalle: datos.detalle || '',
        km: parseInt(datos.km, 10),
        fecha: datos.fecha || new Date().toISOString(),
        requiereCambioAceite: datos.requiereCambioAceite || false,
        costo: datos.costo || 0,
    };

    if (evento.requiereCambioAceite && moto) {
        const nuevoObjetivo = evento.km + moto.intervalo;
        moto.kmUltimoCambio = evento.km;
        moto.kmProximoCambio = nuevoObjetivo;
        moto.fechaUltimoCambio = evento.fecha;
        if (evento.km > moto.kmActual) moto.kmActual = evento.km;
        guardarDB(DB_KEYS.MOTO, moto);
    }

    mantenimientos.unshift(evento);
    guardarDB(DB_KEYS.MANTENIMIENTOS, mantenimientos);
    return { evento, motoActualizada: moto };
}

function obtenerMantenimientos() {
    return leerDB(DB_KEYS.MANTENIMIENTOS, []);
}

function eliminarMantenimiento(id) {
    const lista = obtenerMantenimientos().filter(m => m.id !== id);
    guardarDB(DB_KEYS.MANTENIMIENTOS, lista);
}

// ─── Configuración del Usuario (Sin secretos ni API Keys) ────────────────────

/**
 * Retorna la configuración personal del usuario.
 * La API Key de Brevo reside exclusivamente en el backend del administrador.
 */
function obtenerConfig() {
    const raw = leerDB(DB_KEYS.CONFIG, {});

    // Eliminar cualquier residuo antiguo de API keys si existiera por seguridad
    if (raw.brevoApiKey) delete raw.brevoApiKey;
    if (raw.brevoSenderEmail) delete raw.brevoSenderEmail;

    return {
        emailUsuario: raw.emailUsuario || '',
        nombreUsuario: raw.nombreUsuario || '',
        emailVerificado: Boolean(raw.emailVerificado),
        verificationToken: raw.verificationToken || '',
        fechaVerificacion: raw.fechaVerificacion || null,
        notifPush: Boolean(raw.notifPush),
        backendUrl: raw.backendUrl || (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : 'http://localhost:3000'), // Modificable por el usuario o producción
    };
}

/** Guarda la configuración del usuario en localStorage */
function guardarConfig(nuevaConfig) {
    const actual = obtenerConfig();
    const configSanitizada = {
        emailUsuario: (nuevaConfig.emailUsuario !== undefined ? nuevaConfig.emailUsuario : actual.emailUsuario).trim().toLowerCase(),
        nombreUsuario: (nuevaConfig.nombreUsuario !== undefined ? nuevaConfig.nombreUsuario : actual.nombreUsuario).trim(),
        emailVerificado: nuevaConfig.emailVerificado !== undefined ? Boolean(nuevaConfig.emailVerificado) : actual.emailVerificado,
        verificationToken: nuevaConfig.verificationToken !== undefined ? nuevaConfig.verificationToken : actual.verificationToken,
        fechaVerificacion: nuevaConfig.fechaVerificacion !== undefined ? nuevaConfig.fechaVerificacion : actual.fechaVerificacion,
        notifPush: nuevaConfig.notifPush !== undefined ? Boolean(nuevaConfig.notifPush) : actual.notifPush,
        backendUrl: (nuevaConfig.backendUrl !== undefined ? nuevaConfig.backendUrl : actual.backendUrl).trim().replace(/\/+$/, ''),
    };

    guardarDB(DB_KEYS.CONFIG, configSanitizada);
    return configSanitizada;
}

// ─── Respaldo y Restauración ──────────────────────────────────────────────────

function exportarDatos() {
    const datos = {
        version: '2.0',
        fechaExport: new Date().toISOString(),
        moto: obtenerMoto(),
        historial: obtenerHistorial(),
        mantenimientos: obtenerMantenimientos(),
        config: obtenerConfig(),
    };
    return JSON.stringify(datos, null, 2);
}

function importarDatos(jsonString) {
    try {
        const datos = JSON.parse(jsonString);
        if (!datos || (!datos.moto && !datos.mantenimientos)) {
            throw new Error('El archivo no contiene un formato válido de MotoTracker.');
        }

        if (datos.moto) guardarDB(DB_KEYS.MOTO, datos.moto);
        if (datos.historial) guardarDB(DB_KEYS.HISTORIAL, datos.historial);
        if (datos.mantenimientos) guardarDB(DB_KEYS.MANTENIMIENTOS, datos.mantenimientos);
        if (datos.config) guardarConfig(datos.config);

        return true;
    } catch (e) {
        console.error('[Storage] Error al importar:', e);
        return false;
    }
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function estaRegistrada() {
    return obtenerMoto() !== null;
}

function formatearFecha(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function formatearKm(km) {
    return parseInt(km, 10).toLocaleString('es-CO');
}

function resetearTodo() {
    Object.values(DB_KEYS).forEach(k => localStorage.removeItem(k));
}

// ─── Exportar al objeto global ────────────────────────────────────────────────
window.Storage = {
    inicializarMoto,
    obtenerMoto,
    actualizarDatosMoto,
    actualizarKilometraje,
    registrarCambioAceite,
    calcularPorcentajeAceite,
    calcularKmRestantes,
    estimarFechaProximoCambio,
    obtenerHistorial,
    agregarMantenimiento,
    obtenerMantenimientos,
    eliminarMantenimiento,
    obtenerConfig,
    guardarConfig,
    exportarDatos,
    importarDatos,
    estaRegistrada,
    formatearFecha,
    formatearKm,
    resetearTodo,
};
