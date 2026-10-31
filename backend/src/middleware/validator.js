/**
 * validator.js — Validación y sanitización de datos de entrada
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Valida y normaliza una dirección de correo electrónico
 * @param {string} email
 * @returns {{ valid: boolean, email: string, error?: string }}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, email: '', error: 'El correo electrónico es requerido.' };
  }

  const normalized = email.trim().toLowerCase();

  if (normalized.length > 254) {
    return { valid: false, email: '', error: 'El correo excede la longitud máxima permitida.' };
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, email: '', error: 'El formato del correo electrónico no es válido.' };
  }

  return { valid: true, email: normalized };
}

/**
 * Sanitiza texto simple para prevenir inyección en correos HTML
 * @param {string} str
 * @returns {string}
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

/**
 * Valida un código de verificación de 6 dígitos numéricos
 * @param {string|number} code
 * @returns {boolean}
 */
export function validateCodeFormat(code) {
  if (!code) return false;
  const strCode = String(code).trim();
  return /^\d{6}$/.test(strCode);
}

/**
 * Middleware para validar el cuerpo de la petición de verificación
 */
export function validateVerificationRequest(req, res, next) {
  const { email, name } = req.body || {};
  const validation = validateEmail(email);

  if (!validation.valid) {
    return res.status(400).json({ ok: false, error: validation.error });
  }

  req.validatedEmail = validation.email;
  req.sanitizedName = sanitizeText(name || 'Piloto');
  next();
}

/**
 * Middleware para validar la confirmación del código
 */
export function validateConfirmationRequest(req, res, next) {
  const { email, code } = req.body || {};
  const emailValidation = validateEmail(email);

  if (!emailValidation.valid) {
    return res.status(400).json({ ok: false, error: emailValidation.error });
  }

  if (!validateCodeFormat(code)) {
    return res.status(400).json({
      ok: false,
      error: 'El código de verificación debe ser numérico de 6 dígitos (ej. 123456).',
    });
  }

  req.validatedEmail = emailValidation.email;
  req.cleanCode = String(code).trim();
  next();
}
