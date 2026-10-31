/**
 * config.js — Carga y validación estricta de variables de entorno del servidor
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde .env ubicado en la raíz del backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Credenciales Centralizadas de Brevo (NUNCA expuestas al cliente)
  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    senderEmail: process.env.BREVO_SENDER_EMAIL || '',
    senderName: process.env.BREVO_SENDER_NAME || 'Moto Oil Tracker',
    apiUrl: 'https://api.brevo.com/v3/smtp/email',
  },

  // Seguridad y control de acceso
  security: {
    tokenSecret: process.env.TOKEN_SECRET || 'fallback_secret_mototracker_change_in_prod',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean),
    codeExpirationMinutes: 10,
    maxVerificationAttempts: 5,
    minResendCooldownSeconds: 60,
  },
};

/**
 * Valida la configuración esencial para el envío de correos
 * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
 */
export function validateConfig() {
  const warnings = [];
  const errors = [];

  if (!config.brevo.apiKey || config.brevo.apiKey.includes('reemplaza-con-tu-api-key')) {
    const msg = 'BREVO_API_KEY no está configurada o contiene el valor de ejemplo.';
    if (config.isProduction) errors.push(msg);
    else warnings.push(msg);
  }

  if (!config.brevo.senderEmail || config.brevo.senderEmail.includes('@mototracker.local')) {
    const msg = 'BREVO_SENDER_EMAIL debe ser un correo verificado en tu cuenta de Brevo.';
    if (config.isProduction) errors.push(msg);
    else warnings.push(msg);
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

export default config;
