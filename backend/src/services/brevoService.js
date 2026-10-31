/**
 * brevoService.js — Servicio de integración oficial con la API REST v3 de Brevo
 * Todas las llamadas se autentican desde el servidor con la clave secreta.
 */

import config from '../config.js';
import {
  getVerificationCodeTemplate,
  getTestEmailTemplate,
  getMaintenanceAlertTemplate,
} from '../templates/emailTemplates.js';

const BREVO_BASE_URL = 'https://api.brevo.com/v3';

/**
 * Verifica la validez de la API Key y la conectividad con Brevo
 * Utiliza el endpoint oficial GET /v3/account
 * @returns {Promise<{ ok: boolean, email?: string, plan?: string, error?: string }>}
 */
export async function verifyBrevoConnection() {
  if (!config.brevo.apiKey || config.brevo.apiKey.includes('reemplaza-con-tu-api-key')) {
    return {
      ok: false,
      error: 'La BREVO_API_KEY no ha sido configurada en las variables de entorno del servidor.',
    };
  }

  try {
    const response = await fetch(`${BREVO_BASE_URL}/account`, {
      method: 'GET',
      headers: {
        'api-key': config.brevo.apiKey.trim(),
        'accept': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        ok: true,
        accountEmail: data.email,
        companyName: data.companyName,
        planType: data.plan?.[0]?.type || 'Standard',
      };
    } else if (response.status === 401) {
      return {
        ok: false,
        error: 'API Key de Brevo rechazada (401 Unauthorized). Verifica la clave en el archivo .env del backend.',
      };
    } else {
      return {
        ok: false,
        error: data.message || `Error de respuesta HTTP ${response.status} desde Brevo.`,
      };
    }
  } catch (err) {
    console.error('[BrevoService] Error de red conectando con Brevo:', err);
    return {
      ok: false,
      error: 'No se pudo conectar con los servidores de Brevo. Verifica la conexión a internet.',
    };
  }
}

/**
 * Envía un correo transaccional utilizando POST /v3/smtp/email
 * @param {Object} params
 * @param {string} params.toEmail
 * @param {string} params.toName
 * @param {string} params.subject
 * @param {string} params.htmlContent
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
export async function sendTransactionalEmail({ toEmail, toName, subject, htmlContent }) {
  if (!config.brevo.apiKey || config.brevo.apiKey.includes('reemplaza-con-tu-api-key')) {
    return {
      ok: false,
      error: 'BREVO_API_KEY no configurada en el servidor.',
    };
  }

  if (!config.brevo.senderEmail || config.brevo.senderEmail.includes('@mototracker.local')) {
    return {
      ok: false,
      error: 'BREVO_SENDER_EMAIL no configurado o no verificado en Brevo.',
    };
  }

  const payload = {
    sender: {
      name: config.brevo.senderName,
      email: config.brevo.senderEmail.trim(),
    },
    to: [
      {
        email: toEmail.trim(),
        name: toName?.trim() || 'Piloto',
      },
    ],
    subject: subject.trim(),
    htmlContent,
  };

  try {
    const response = await fetch(`${BREVO_BASE_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.brevo.apiKey.trim(),
        'accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        ok: true,
        messageId: data.messageId,
      };
    } else {
      console.error('[BrevoService] Error devuelto por Brevo:', response.status, data);
      let userFriendlyError = data.message || `Error ${response.status}`;

      if (response.status === 400 && data.message?.includes('sender')) {
        userFriendlyError = `El remitente '${config.brevo.senderEmail}' no está validado en la cuenta de Brevo. Ve a Brevo > Remitentes para activarlo.`;
      }

      return {
        ok: false,
        error: userFriendlyError,
      };
    }
  } catch (err) {
    console.error('[BrevoService] Error de red enviando correo:', err);
    return {
      ok: false,
      error: 'Error de red al comunicarse con el servicio de correo Brevo.',
    };
  }
}

/**
 * Envía el código de verificación de 6 dígitos
 */
export async function sendVerificationCodeEmail(toEmail, toName, code) {
  const html = getVerificationCodeTemplate(code, toName);
  return sendTransactionalEmail({
    toEmail,
    toName,
    subject: `🔐 Tu código de verificación Moto Oil Tracker: ${code}`,
    htmlContent: html,
  });
}

/**
 * Envía un correo de prueba de servicio
 */
export async function sendTestNotificationEmail(toEmail, toName) {
  const html = getTestEmailTemplate(toName);
  return sendTransactionalEmail({
    toEmail,
    toName,
    subject: '🚀 Prueba de Notificaciones — Moto Oil Tracker',
    htmlContent: html,
  });
}

/**
 * Envía un correo de alerta de mantenimiento o cambio de aceite
 */
export async function sendAlertEmail({ toEmail, toName, tipo, moto, extra = {} }) {
  const html = getMaintenanceAlertTemplate({ tipo, moto, extra });

  const asuntos = {
    urgent: `🚨 ¡Cambio de Aceite Urgente! — ${moto.marca || ''} ${moto.modelo || 'Moto'}`,
    warning: `⚠️ Próximo cambio de aceite cerca — ${moto.marca || ''} ${moto.modelo || 'Moto'}`,
    mantenimiento: `🔧 Mantenimiento registrado: ${extra.titulo || 'Servicio'} — ${moto.modelo || 'Moto'}`,
  };

  return sendTransactionalEmail({
    toEmail,
    toName,
    subject: asuntos[tipo] || asuntos.warning,
    htmlContent: html,
  });
}
