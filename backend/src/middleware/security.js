/**
 * security.js — Middlewares de seguridad: Helmet, CORS y Rate Limiting
 */

import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from '../config.js';

/**
 * Middleware de Helmet para cabeceras HTTP seguras
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // Permitir consumir APIs desde frontend estático
  crossOriginEmbedderPolicy: false,
});

/**
 * Middleware de CORS para permitir orígenes autorizados
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (por ejemplo, herramientas CLI, Postman o mobile webviews) en desarrollo
    if (!origin) {
      if (!config.isProduction) return callback(null, true);
      return callback(null, true); // O cambiar a false en producción estricta si se desea
    }

    // Comprobar si el origen está en la lista permitida
    const isAllowed = config.security.allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (origin === allowed) return true;

      // Normalizar en caso de que allowed contenga rutas o barras finales
      let normalizedAllowed = allowed;
      try {
        if (allowed.startsWith('http://') || allowed.startsWith('https://')) {
          normalizedAllowed = new URL(allowed).origin;
        }
      } catch (_) {}
      if (origin === normalizedAllowed) return true;
      if (allowed.startsWith(origin)) return true;

      // Compatibilidad con subdominios de github.io o puertos localhost
      if (allowed.includes('github.io') && origin.endsWith('.github.io')) return true;
      if (origin === 'https://ruzoe.github.io') return true;
      if (allowed.startsWith('http://localhost') && origin.startsWith('http://localhost')) return true;
      if (allowed.startsWith('http://127.0.0.1') && origin.startsWith('http://127.0.0.1')) return true;
      return false;
    });

    if (isAllowed || !config.isProduction) {
      return callback(null, true);
    } else {
      return callback(new Error(`Origen CORS no autorizado: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 horas de caché para preflight
});

/**
 * Rate Limiter Global: 100 peticiones cada 15 minutos por IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Demasiadas solicitudes desde esta dirección IP. Inténtalo más tarde.',
  },
});

/**
 * Rate Limiter Estricto para solicitudes de verificación: 5 peticiones cada 15 minutos por IP
 */
export const verificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Has alcanzado el límite de solicitudes de códigos. Espera 15 minutos antes de volver a intentar.',
  },
});

/**
 * Rate Limiter para intentos de confirmación de código: 10 intentos cada 10 minutos
 */
export const confirmationRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Demasiados intentos de validación fallidos. Espera 10 minutos.',
  },
});

/**
 * Rate Limiter para envío de correos de alerta: 10 alertas por hora por IP
 */
export const alertEmailRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Límite de envío de alertas por hora alcanzado.',
  },
});
