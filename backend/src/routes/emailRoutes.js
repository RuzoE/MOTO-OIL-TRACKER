/**
 * emailRoutes.js — Rutas de diagnóstico, pruebas de conexión y envío de emails
 *
 * Control de duplicados:
 *  - warning/urgent : clave = email:tipo:kmUltimoCambio  (un ciclo = un cambio de aceite)
 *  - mantenimiento  : clave = email:mantenimiento:eventoId (un registro = una confirmación)
 */

import { Router } from 'express';
import {
  verifyBrevoConnection,
  sendTestNotificationEmail,
  sendAlertEmail,
} from '../services/brevoService.js';
import { validateEmail, sanitizeText } from '../middleware/validator.js';
import { alertEmailRateLimiter } from '../middleware/security.js';
import { isEmailVerified, isDuplicateAlert, recordAlertSent } from '../db.js';

const router = Router();

/**
 * GET /api/brevo/test-connection
 * Verifica si las credenciales de Brevo del servidor son válidas y están activas.
 */
router.get('/test-connection', async (req, res) => {
  const result = await verifyBrevoConnection();

  if (result.ok) {
    return res.json({
      ok: true,
      message: 'Conexión con Brevo API v3 establecida exitosamente.',
      accountEmail: result.accountEmail,
      plan: result.planType,
    });
  } else {
    return res.status(400).json({
      ok: false,
      error: result.error,
    });
  }
});

/**
 * POST /api/email/test
 * Envía un correo de prueba a un destinatario para confirmar la entrega.
 * Protegido por rate-limit y verificación previa de correo.
 */
router.post('/test', alertEmailRateLimiter, async (req, res) => {
  const { email, name, token } = req.body || {};
  const validation = validateEmail(email);

  if (!validation.valid) {
    return res.status(400).json({ ok: false, error: validation.error });
  }

  const cleanEmail = validation.email;
  const cleanName = sanitizeText(name || 'Piloto');

  // Comprobar que el correo esté verificado en el sistema para evitar spam anónimo
  if (!isEmailVerified(cleanEmail, token)) {
    return res.status(403).json({
      ok: false,
      error: 'El correo electrónico no ha sido verificado en Moto Oil Tracker. Por favor completa la verificación de 6 dígitos primero.',
    });
  }

  const result = await sendTestNotificationEmail(cleanEmail, cleanName);

  if (result.ok) {
    return res.json({
      ok: true,
      message: `Correo de prueba enviado con éxito a ${cleanEmail}. Revisa tu bandeja de entrada o spam.`,
      messageId: result.messageId,
    });
  } else {
    return res.status(502).json({
      ok: false,
      error: result.error,
    });
  }
});

/**
 * POST /api/email/alert
 * Envía alertas de mantenimiento y cambio de aceite con control de duplicados por ciclo.
 *
 * Espera en el body:
 *   email, name, token, tipo, moto (con kmUltimoCambio), extra
 *   extra.eventoId  — obligatorio para tipo 'mantenimiento', es el id único del registro
 */
router.post('/alert', alertEmailRateLimiter, async (req, res) => {
  const { email, name, token, tipo, moto, extra } = req.body || {};
  const validation = validateEmail(email);

  if (!validation.valid) {
    return res.status(400).json({ ok: false, error: validation.error });
  }

  const cleanEmail = validation.email;
  const cleanName = sanitizeText(name || 'Piloto');

  // Solo enviar a correos verificados
  if (!isEmailVerified(cleanEmail, token)) {
    return res.status(403).json({
      ok: false,
      error: 'Solo los correos verificados pueden recibir alertas de mantenimiento.',
    });
  }

  // Validar tipo de alerta
  const tiposValidos = ['warning', 'urgent', 'mantenimiento'];
  const cleanTipo = tiposValidos.includes(tipo) ? tipo : 'warning';

  if (!moto || typeof moto !== 'object') {
    return res.status(400).json({
      ok: false,
      error: 'Se requieren los datos del vehículo para confeccionar la alerta.',
    });
  }

  const motoLimpia = {
    marca: sanitizeText(moto.marca || 'Motocicleta'),
    modelo: sanitizeText(moto.modelo || 'Moto'),
    anio: moto.anio || '',
    kmActual: parseInt(moto.kmActual, 10) || 0,
    kmUltimoCambio: parseInt(moto.kmUltimoCambio, 10) || 0,
    kmProximoCambio: parseInt(moto.kmProximoCambio, 10) || 0,
    intervalo: parseInt(moto.intervalo, 10) || 1500,
    fechaUltimoCambio: moto.fechaUltimoCambio || new Date().toISOString(),
  };

  const extraLimpio = {
    titulo: sanitizeText(extra?.titulo || ''),
    detalle: sanitizeText(extra?.detalle || ''),
    eventoId: extra?.eventoId ? String(extra.eventoId) : null,
  };

  // ── Determinación del cicloId para el control de duplicados ──────────────────
  // warning/urgent: se identifica por ciclo = kmUltimoCambio
  //   → un mismo ciclo de aceite solo genera UN warning y UN urgent, sin importar
  //     cuántas veces se recargue el dashboard o se actualice el km.
  // mantenimiento: se identifica por el id único del evento del taller
  //   → un mismo registro real solo genera UNA confirmación.
  let cicloId;
  if (cleanTipo === 'warning' || cleanTipo === 'urgent') {
    cicloId = motoLimpia.kmUltimoCambio;
  } else if (cleanTipo === 'mantenimiento') {
    if (!extraLimpio.eventoId) {
      return res.status(400).json({
        ok: false,
        error: 'Se requiere extra.eventoId para alertas de tipo mantenimiento.',
      });
    }
    cicloId = extraLimpio.eventoId;
  }

  // Prevención de duplicados: comprobar si ya se envió esta alerta en este ciclo
  if (isDuplicateAlert(cleanEmail, cleanTipo, cicloId)) {
    return res.json({
      ok: true,
      duplicateIgnored: true,
      message: `Alerta '${cleanTipo}' ya enviada para el ciclo actual. No se reenvía.`,
    });
  }

  const result = await sendAlertEmail({
    toEmail: cleanEmail,
    toName: cleanName,
    tipo: cleanTipo,
    moto: motoLimpia,
    extra: extraLimpio,
  });

  if (result.ok) {
    // Registrar en el historial solo tras confirmación exitosa de Brevo
    recordAlertSent(cleanEmail, cleanTipo, cicloId, {
      kmActual: motoLimpia.kmActual,
    });

    return res.json({
      ok: true,
      message: 'Alerta enviada correctamente.',
      messageId: result.messageId,
    });
  } else {
    // No registramos como enviada → el cliente puede reintentar
    return res.status(502).json({
      ok: false,
      error: result.error,
    });
  }
});

export default router;
