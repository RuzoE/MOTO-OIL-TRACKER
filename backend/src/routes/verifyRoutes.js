/**
 * verifyRoutes.js — Endpoints para solicitud y validación de códigos de 6 dígitos
 */

import { Router } from 'express';
import {
  createVerification,
  verifyCode,
  getEmailStatus,
  generateSixDigitCode,
} from '../db.js';
import { sendVerificationCodeEmail } from '../services/brevoService.js';
import {
  validateVerificationRequest,
  validateConfirmationRequest,
  validateEmail,
} from '../middleware/validator.js';
import {
  verificationRateLimiter,
  confirmationRateLimiter,
} from '../middleware/security.js';

const router = Router();

/**
 * POST /api/verify/request
 * Solicita la generación y envío de un código de 6 dígitos por correo
 */
router.post('/request', verificationRateLimiter, validateVerificationRequest, async (req, res) => {
  const email = req.validatedEmail;
  const name = req.sanitizedName;

  // Generar código numérico de 6 dígitos
  const code = generateSixDigitCode();

  // Registrar en la base de datos con hash y salt
  const dbResult = createVerification(email, code, name);

  if (!dbResult.ok) {
    return res.status(429).json({
      ok: false,
      error: dbResult.error,
      cooldownRemaining: dbResult.cooldownRemaining,
    });
  }

  // Enviar correo mediante Brevo API v3
  const emailResult = await sendVerificationCodeEmail(email, name, code);

  if (!emailResult.ok) {
    return res.status(502).json({
      ok: false,
      error: `No se pudo enviar el correo de verificación: ${emailResult.error}`,
    });
  }

  return res.json({
    ok: true,
    message: `Código de verificación de 6 dígitos enviado exitosamente a ${email}`,
    expiresInMinutes: 10,
    cooldownSeconds: 60,
  });
});

/**
 * POST /api/verify/confirm
 * Verifica el código ingresado por el usuario
 */
router.post('/confirm', confirmationRateLimiter, validateConfirmationRequest, (req, res) => {
  const email = req.validatedEmail;
  const code = req.cleanCode;

  const result = verifyCode(email, code);

  if (!result.ok) {
    return res.status(400).json({
      ok: false,
      error: result.error,
    });
  }

  return res.json({
    ok: true,
    message: '¡Correo electrónico verificado exitosamente!',
    email,
    name: result.name,
    verificationToken: result.verificationToken,
  });
});

/**
 * GET /api/verify/status/:email
 * Consulta el estado actual de verificación de un correo
 */
router.get('/status/:email', (req, res) => {
  const validation = validateEmail(req.params.email);

  if (!validation.valid) {
    return res.status(400).json({ ok: false, error: validation.error });
  }

  const status = getEmailStatus(validation.email);

  return res.json({
    ok: true,
    email: validation.email,
    ...status,
  });
});

export default router;
