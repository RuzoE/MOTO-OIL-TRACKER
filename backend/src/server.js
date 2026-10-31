/**
 * server.js — Servidor Express para Moto Oil Tracker Backend
 * Arquitectura segura con protección de credenciales centralizadas de Brevo API v3
 */

import express from 'express';
import config, { validateConfig } from './config.js';
import { initDB } from './db.js';
import {
  helmetMiddleware,
  corsMiddleware,
  globalRateLimiter,
} from './middleware/security.js';
import emailRoutes from './routes/emailRoutes.js';
import verifyRoutes from './routes/verifyRoutes.js';

const app = express();

// ─── Inicialización de Base de Datos y Configuración ─────────────────────────
initDB();
const configValidation = validateConfig();

if (configValidation.warnings.length > 0) {
  console.warn('[Server] Advertencias de configuración:');
  configValidation.warnings.forEach(w => console.warn(`  ⚠️  ${w}`));
}

if (!configValidation.valid) {
  console.error('[Server] Errores críticos de configuración:');
  configValidation.errors.forEach(e => console.error(`  ❌  ${e}`));
  if (config.isProduction) {
    console.error('[Server] Deteniendo servidor por errores de configuración en producción.');
    process.exit(1);
  }
}

// ─── Middlewares Globales de Seguridad ───────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(globalRateLimiter);
app.use(express.json({ limit: '50kb' }));

// ─── Endpoint de Salud / Estado del Servicio ─────────────────────────────────
app.get('/api/status', (req, res) => {
  const isBrevoConfigured = Boolean(
    config.brevo.apiKey &&
    !config.brevo.apiKey.includes('reemplaza-con-tu-api-key') &&
    config.brevo.senderEmail &&
    !config.brevo.senderEmail.includes('@mototracker.local')
  );

  res.json({
    ok: true,
    service: 'Moto Oil Tracker Email Service',
    version: '1.0.0',
    brevoConfigured: isBrevoConfigured,
    senderName: config.brevo.senderName,
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ─── Rutas de la API ─────────────────────────────────────────────────────────
app.use('/api/verify', verifyRoutes);
app.use('/api/brevo', emailRoutes);
app.use('/api/email', emailRoutes);

// ─── Middleware para Rutas No Encontradas (404) ───────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({
    ok: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Manejador Global de Errores ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server] Error no controlado:', err.message);

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      ok: false,
      error: 'Acceso bloqueado por política de CORS.',
    });
  }

  res.status(err.status || 500).json({
    ok: false,
    error: config.isProduction
      ? 'Ocurrió un error interno en el servidor.'
      : err.message || 'Error interno.',
  });
});

// ─── Inicio del Servidor ─────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log('===========================================================');
  console.log(`🏍️  Moto Oil Tracker Backend iniciado con éxito`);
  console.log(`📡 Puerto: http://localhost:${config.port}`);
  console.log(`🛡️  Entorno: ${config.nodeEnv}`);
  console.log(`✉️  Remitente configurado: ${config.brevo.senderEmail || 'No definido'}`);
  console.log('===========================================================');
});

process.on('SIGINT', () => {
  console.log('\n[Server] Deteniendo servidor ordenadamente...');
  server.close(() => {
    console.log('[Server] Servidor detenido.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Server] SIGTERM recibido. Deteniendo...');
  server.close(() => process.exit(0));
});

export default app;
