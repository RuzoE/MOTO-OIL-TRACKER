/**
 * db.js — Almacén persistente seguro para verificación de correos y control de duplicados
 * Utiliza hashes criptográficos SHA-256 con salt para proteger los códigos.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'verifications.json');

// Estructura en memoria respaldada en disco
let db = {
  pendingVerifications: {}, // email -> { codeHash, salt, expiresAt, attempts, createdAt }
  verifiedEmails: {},       // email -> { verifiedAt, verificationToken, name }
  sentAlerts: {},           // alertKey -> { sentAt, kmActual, tipo }
};

/**
 * Inicializa el directorio de datos y carga el archivo JSON persistente
 */
export function initDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      db = {
        pendingVerifications: parsed.pendingVerifications || {},
        verifiedEmails: parsed.verifiedEmails || {},
        sentAlerts: parsed.sentAlerts || {},
      };
      console.log(`[DB] Base de datos cargada: ${Object.keys(db.verifiedEmails).length} correos verificados`);
    } else {
      persistDB();
      console.log('[DB] Base de datos persistente inicializada en', DB_FILE);
    }
  } catch (err) {
    console.error('[DB] Error inicializando base de datos:', err);
  }
}

/**
 * Guarda de forma atómica en disco para evitar corrupción de datos
 */
function persistDB() {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[DB] Error guardando base de datos:', err);
  }
}

/**
 * Genera un hash criptográfico SHA-256 con salt para un código
 */
function hashWithSalt(value, salt) {
  return crypto
    .createHmac('sha256', config.security.tokenSecret)
    .update(`${value}:${salt}`)
    .digest('hex');
}

/**
 * Genera un código aleatorio de 6 dígitos numéricos
 */
export function generateSixDigitCode() {
  const num = crypto.randomInt(100000, 999999);
  return String(num);
}

/**
 * Registra o reemplaza una solicitud de verificación para un correo
 * @param {string} email
 * @param {string} code - Código de 6 dígitos
 * @param {string} name - Nombre del usuario
 * @returns {{ ok: boolean, error?: string, cooldownRemaining?: number }}
 */
export function createVerification(email, code, name) {
  const now = Date.now();
  const existing = db.pendingVerifications[email];

  // Comprobar cooldown de reenvío (ej. 60 segundos)
  if (existing) {
    const elapsedSeconds = Math.floor((now - existing.createdAt) / 1000);
    const cooldown = config.security.minResendCooldownSeconds;
    if (elapsedSeconds < cooldown) {
      return {
        ok: false,
        error: `Espera ${cooldown - elapsedSeconds} segundos antes de solicitar un nuevo código.`,
        cooldownRemaining: cooldown - elapsedSeconds,
      };
    }
  }

  // Generar salt único por cada solicitud
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = hashWithSalt(code, salt);
  const expiresAt = now + config.security.codeExpirationMinutes * 60 * 1000;

  db.pendingVerifications[email] = {
    codeHash,
    salt,
    expiresAt,
    attempts: 0,
    createdAt: now,
    name: name || 'Piloto',
  };

  persistDB();
  return { ok: true };
}

/**
 * Comprueba un código ingresado por el usuario
 * @param {string} email
 * @param {string} inputCode
 * @returns {{ ok: boolean, error?: string, verificationToken?: string }}
 */
export function verifyCode(email, inputCode) {
  const now = Date.now();
  const record = db.pendingVerifications[email];

  if (!record) {
    return {
      ok: false,
      error: 'No hay ninguna solicitud de verificación pendiente para este correo o ya fue confirmada.',
    };
  }

  // Verificar si expiró (10 minutos)
  if (now > record.expiresAt) {
    delete db.pendingVerifications[email];
    persistDB();
    return {
      ok: false,
      error: 'El código de verificación ha expirado (validez de 10 minutos). Solicita uno nuevo.',
    };
  }

  // Incrementar intentos y verificar límite (5 intentos)
  record.attempts += 1;
  if (record.attempts > config.security.maxVerificationAttempts) {
    delete db.pendingVerifications[email];
    persistDB();
    return {
      ok: false,
      error: 'Has superado el límite de intentos fallidos. Debes solicitar un código nuevo.',
    };
  }

  const computedHash = hashWithSalt(inputCode, record.salt);

  if (computedHash !== record.codeHash) {
    persistDB();
    const remaining = config.security.maxVerificationAttempts - record.attempts;
    return {
      ok: false,
      error: `Código incorrecto. Te quedan ${remaining} intento(s).`,
    };
  }

  // Código correcto: generar token firmado de verificación
  const tokenPayload = `${email}:${record.name}:${now}`;
  const verificationToken = crypto
    .createHmac('sha256', config.security.tokenSecret)
    .update(tokenPayload)
    .digest('hex');

  // Registrar correo como verificado
  db.verifiedEmails[email] = {
    verifiedAt: new Date(now).toISOString(),
    verificationToken,
    name: record.name,
  };

  // Limpiar solicitud pendiente
  delete db.pendingVerifications[email];
  persistDB();

  return {
    ok: true,
    verificationToken,
    name: record.name,
  };
}

/**
 * Verifica si un correo está validado en la base de datos
 * @param {string} email
 * @param {string} [token] - Token opcional para autenticar al cliente
 * @returns {boolean}
 */
export function isEmailVerified(email, token = null) {
  if (!email) return false;
  const record = db.verifiedEmails[email.toLowerCase().trim()];
  if (!record) return false;

  if (token && record.verificationToken !== token) {
    return false;
  }

  return true;
}

/**
 * Obtiene el estado actual de verificación de un correo
 * @param {string} email
 * @returns {{ verified: boolean, verifiedAt?: string, hasPending: boolean, cooldown?: number }}
 */
export function getEmailStatus(email) {
  const normalized = email.toLowerCase().trim();
  const verifiedRecord = db.verifiedEmails[normalized];
  const pendingRecord = db.pendingVerifications[normalized];

  if (verifiedRecord) {
    return {
      verified: true,
      verifiedAt: verifiedRecord.verifiedAt,
      name: verifiedRecord.name,
      hasPending: false,
    };
  }

  if (pendingRecord) {
    const elapsed = Math.floor((Date.now() - pendingRecord.createdAt) / 1000);
    const cooldown = Math.max(0, config.security.minResendCooldownSeconds - elapsed);
    return {
      verified: false,
      hasPending: true,
      expiresAt: pendingRecord.expiresAt,
      cooldown,
    };
  }

  return {
    verified: false,
    hasPending: false,
  };
}

/**
 * Previene el envío de alertas duplicadas
 * @param {string} email
 * @param {string} alertType
 * @param {number} kmActual
 * @returns {boolean} true si ya fue enviada una alerta idéntica recientemente
 */
export function isDuplicateAlert(email, alertType, kmActual) {
  const alertKey = `${email}:${alertType}:${kmActual}`;
  const record = db.sentAlerts[alertKey];

  if (!record) return false;

  // Si se envió hace menos de 24 horas para este mismo kilometraje y tipo
  const now = Date.now();
  const hoursSince = (now - record.sentAt) / (1000 * 60 * 60);
  return hoursSince < 24;
}

/**
 * Registra que una alerta fue enviada exitosamente
 */
export function recordAlertSent(email, alertType, kmActual) {
  const alertKey = `${email}:${alertType}:${kmActual}`;
  db.sentAlerts[alertKey] = {
    sentAt: Date.now(),
    kmActual,
    tipo: alertType,
  };

  // Limpiar alertas con más de 30 días para mantener el archivo ligero
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const key of Object.keys(db.sentAlerts)) {
    if (now - db.sentAlerts[key].sentAt > thirtyDaysMs) {
      delete db.sentAlerts[key];
    }
  }

  persistDB();
}
