/**
 * emailTemplates.js — Plantillas de correo HTML profesionales y responsive
 * Diseño Dark Automotive consistente con Moto Oil Tracker
 */

/**
 * Plantilla base contenedora Dark Automotive
 */
function layoutBase({ titulo, emoji, colorAcento, contenidoHtml }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d0f;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6;color:#f1f1f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0f;padding:28px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal (máx 520px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#16161d;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
          
          <!-- Encabezado con degradado de acento -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg, ${colorAcento} 0%, #ea580c 100%);padding:32px 20px 26px;">
              <div style="font-size:46px;line-height:1;margin-bottom:10px;">${emoji}</div>
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${titulo}</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);font-weight:500;">Moto Oil Tracker · Sistema de Notificaciones</p>
            </td>
          </tr>

          <!-- Cuerpo del correo -->
          <tr>
            <td style="padding:28px 24px;">
              ${contenidoHtml}
            </td>
          </tr>

          <!-- Pie de página -->
          <tr>
            <td style="padding:18px 24px 22px;background-color:#101015;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#8e8e9f;">
                Este correo fue enviado de forma automática y segura a través de <strong>Moto Oil Tracker</strong>.
              </p>
              <p style="margin:0;font-size:11px;color:#555566;">
                Por favor no respondas a este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plantilla 1: Código de Verificación de 6 Dígitos
 */
export function getVerificationCodeTemplate(code, name = 'Piloto') {
  const contenido = `
    <p style="margin:0 0 16px;font-size:15px;color:#d4d4dc;">
      Hola, <strong>${name}</strong>:
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;">
      Has solicitado vincular este correo electrónico para recibir alertas sobre el cambio de aceite y mantenimiento preventivo de tu motocicleta.
    </p>

    <!-- Caja del Código de 6 dígitos -->
    <div style="background-color:#1c1c26;border:2px dashed #f97316;border-radius:14px;padding:24px 16px;text-align:center;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#f97316;font-weight:700;">
        Tu Código de Verificación
      </p>
      <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#ffffff;text-shadow:0 0 12px rgba(249,115,22,0.4);">
        ${code}
      </div>
      <p style="margin:10px 0 0;font-size:12px;color:#8e8e9f;">
        ⏱️ Válido durante <strong>10 minutos</strong>.
      </p>
    </div>

    <p style="margin:0 0 12px;font-size:13px;color:#8e8e9f;">
      Introduce este código de seis dígitos en la sección de ajustes de Moto Oil Tracker para activar tu suscripción de alertas.
    </p>
    <p style="margin:0;font-size:12px;color:#6b7280;">
      Si no solicitaste este código, puedes ignorar este mensaje de forma segura.
    </p>
  `;

  return layoutBase({
    titulo: 'Verifica tu Correo Electrónico',
    emoji: '🔐',
    colorAcento: '#f97316',
    contenidoHtml: contenido,
  });
}

/**
 * Plantilla 2: Correo de Prueba Operativa
 */
export function getTestEmailTemplate(name = 'Piloto') {
  const fecha = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const contenido = `
    <p style="margin:0 0 16px;font-size:15px;color:#d4d4dc;">
      Hola, <strong>${name}</strong>:
    </p>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;">
      ¡Excelente noticia! La conexión centralizada con Brevo API v3 está funcionando al <strong>100%</strong>.
    </p>

    <!-- Ficha informativa -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1c1c26;border-radius:12px;border:1px solid rgba(255,255,255,0.06);margin-bottom:20px;">
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#9ca3af;">Estado:</td>
        <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#22c55e;font-weight:700;" align="right">✓ Conexión Activa</td>
      </tr>
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#9ca3af;">Servicio:</td>
        <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#f1f1f5;font-weight:600;" align="right">Brevo REST v3 Centralizado</td>
      </tr>
      <tr>
        <td style="padding:14px 18px;font-size:13px;color:#9ca3af;">Fecha de prueba:</td>
        <td style="padding:14px 18px;font-size:13px;color:#f1f1f5;font-family:monospace;" align="right">${fecha}</td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#8e8e9f;">
      A partir de este momento recibirás recordatorios cuando el odómetro de tu moto se aproxime a la fecha de cambio o cuando registres un mantenimiento en taller.
    </p>
  `;

  return layoutBase({
    titulo: 'Prueba de Conexión Exitosa',
    emoji: '🚀',
    colorAcento: '#22c55e',
    contenidoHtml: contenido,
  });
}

/**
 * Plantilla 3: Alertas de Mantenimiento y Cambio de Aceite
 */
export function getMaintenanceAlertTemplate({ tipo, moto, extra = {} }) {
  const kmRestantes = (moto.kmProximoCambio || 0) - (moto.kmActual || 0);
  const esUrgente = kmRestantes <= 0;

  const config = {
    urgent: {
      color: '#ef4444',
      emoji: '🚨',
      titulo: '¡Cambio de Aceite Urgente!',
      subtitulo: 'Has superado el límite de kilometraje recomendado.',
    },
    warning: {
      color: '#eab308',
      emoji: '⚠️',
      titulo: 'Próximo Cambio de Aceite Cerca',
      subtitulo: `Solo restan ${Math.abs(kmRestantes).toLocaleString()} km para realizar el cambio.`,
    },
    mantenimiento: {
      color: '#3b82f6',
      emoji: '🔧',
      titulo: `Mantenimiento: ${extra.titulo || 'Servicio en Taller'}`,
      subtitulo: 'Se ha registrado una nueva entrada en la bitácora de tu moto.',
    },
  };

  const estilo = config[tipo] || config.warning;

  const contenido = `
    <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">
      Vehículo Registrado
    </p>
    <p style="margin:0 0 20px;font-size:19px;font-weight:800;color:#ffffff;">
      ${moto.marca || 'Motocicleta'} ${moto.modelo || ''} ${moto.anio ? `· ${moto.anio}` : ''}
    </p>

    <!-- Ficha de Kilometrajes -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1c1c26;border-radius:14px;border:1px solid rgba(255,255,255,0.06);margin-bottom:20px;text-align:center;">
      <tr>
        <td style="padding:16px 8px;border-right:1px solid rgba(255,255,255,0.06);width:33.3%;">
          <div style="font-size:10px;text-transform:uppercase;color:#8e8e9f;margin-bottom:4px;font-weight:600;">Km Actual</div>
          <div style="font-size:20px;font-weight:800;color:#f1f1f5;font-family:monospace;">${(moto.kmActual || 0).toLocaleString()}</div>
        </td>
        <td style="padding:16px 8px;border-right:1px solid rgba(255,255,255,0.06);width:33.3%;">
          <div style="font-size:10px;text-transform:uppercase;color:#8e8e9f;margin-bottom:4px;font-weight:600;">Objetivo</div>
          <div style="font-size:20px;font-weight:800;color:${estilo.color};font-family:monospace;">${(moto.kmProximoCambio || 0).toLocaleString()}</div>
        </td>
        <td style="padding:16px 8px;width:33.3%;">
          <div style="font-size:10px;text-transform:uppercase;color:#8e8e9f;margin-bottom:4px;font-weight:600;">Restantes</div>
          <div style="font-size:20px;font-weight:800;color:${esUrgente ? '#ef4444' : '#f1f1f5'};font-family:monospace;">
            ${Math.abs(kmRestantes).toLocaleString()} ${esUrgente ? '⬆' : ''}
          </div>
        </td>
      </tr>
    </table>

    ${extra.detalle ? `
      <div style="background-color:#1c1c26;border-left:4px solid ${estilo.color};border-radius:6px;padding:12px 16px;margin-bottom:20px;">
        <div style="font-size:11px;text-transform:uppercase;color:#8e8e9f;margin-bottom:3px;font-weight:600;">Detalles del trabajo:</div>
        <div style="font-size:13px;color:#d4d4dc;">${extra.detalle}</div>
      </div>
    ` : ''}

    ${esUrgente ? `
      <div style="background-color:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#ef4444;">
        ⚠️ El aceite ha superado su vida útil. Te recomendamos programar tu cambio de aceite a la brevedad para cuidar el motor de tu moto.
      </div>
    ` : ''}

    <p style="margin:0;font-size:13px;color:#8e8e9f;text-align:center;">
      ${estilo.subtitulo}
    </p>
  `;

  return layoutBase({
    titulo: estilo.titulo,
    emoji: estilo.emoji,
    colorAcento: estilo.color,
    contenidoHtml: contenido,
  });
}
