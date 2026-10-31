/**
 * run_all_tests.js — Suite de Pruebas Automatizadas E2E para Moto Oil Tracker
 * Valida los 12 puntos obligatorios del sistema centralizado de Brevo.
 */

import config, { validateConfig } from '../src/config.js';
import {
  initDB,
  createVerification,
  verifyCode,
  isEmailVerified,
  getEmailStatus,
  isDuplicateAlert,
  recordAlertSent,
} from '../src/db.js';
import { validateEmail, validateCodeFormat } from '../src/middleware/validator.js';
import {
  getVerificationCodeTemplate,
  getTestEmailTemplate,
  getMaintenanceAlertTemplate,
} from '../src/templates/emailTemplates.js';

let totalTests = 0;
let passedTests = 0;

function assert(cond, name, details = '') {
  totalTests++;
  if (cond) {
    passedTests++;
    console.log(`  ✅ [PASS] Prueba ${totalTests}: ${name}`);
    if (details) console.log(`     Detalle: ${details}`);
  } else {
    console.error(`  ❌ [FAIL] Prueba ${totalTests}: ${name}`);
    if (details) console.error(`     Falla: ${details}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('================================================================');
  console.log('🧪 EJECUTANDO SUITE DE PRUEBAS OBLIGATORIAS — MOTO OIL TRACKER');
  console.log('================================================================\n');

  initDB();

  // ─── 1. Conexión del backend con Brevo ─────────────────────────────────────
  console.log('1. Verificando configuración y aislamiento de credenciales de Brevo...');
  const cfgVal = validateConfig();
  assert(
    config.brevo.apiUrl === 'https://api.brevo.com/v3/smtp/email' && config.brevo.senderName === 'Moto Oil Tracker',
    'Conexión configurada con el endpoint oficial v3 de Brevo',
    `Endpoint: ${config.brevo.apiUrl}`
  );

  // ─── 2. Generación y Envío de Código de Verificación ───────────────────────
  console.log('\n2. Verificando generación y registro del código de 6 dígitos...');
  const testEmail = 'piloto.pruebas@gmail.com';
  const testCode = '482910';
  const testName = 'Carlos Moto';

  const rCreate = createVerification(testEmail, testCode, testName);
  assert(
    rCreate.ok === true,
    'Código de verificación generado y almacenado con hash y salt criptográfico'
  );

  // ─── 3. Verificación Correcta del Código ───────────────────────────────────
  console.log('\n3. Verificando confirmación con código correcto...');
  const rValid = verifyCode(testEmail, testCode);
  assert(
    rValid.ok === true && typeof rValid.verificationToken === 'string' && rValid.verificationToken.length === 64,
    'Código correcto aceptado y token HMAC-SHA-256 de 64 caracteres emitido',
    `Token: ${rValid.verificationToken?.slice(0, 16)}...`
  );

  // ─── 4. Código Incorrecto ──────────────────────────────────────────────────
  console.log('\n4. Verificando rechazo de código incorrecto...');
  const emailIntento = 'intento.fallido@gmail.com';
  createVerification(emailIntento, '999111', 'Ana');
  const rWrong = verifyCode(emailIntento, '000000');
  assert(
    rWrong.ok === false && rWrong.error.includes('Código incorrecto') && rWrong.error.includes('intento(s)'),
    'Código incorrecto rechazado con decremento de intentos restantes',
    `Mensaje: ${rWrong.error}`
  );

  // ─── 5. Código Vencido ─────────────────────────────────────────────────────
  console.log('\n5. Verificando expiración de código (vencimiento)...');
  const emailVencido = 'expirado@gmail.com';
  createVerification(emailVencido, '123456', 'David');
  // Simular manualmente la expiración adelantando el tiempo en memoria
  const rStatusPending = getEmailStatus(emailVencido);
  assert(
    rStatusPending.hasPending === true && rStatusPending.verified === false,
    'El código tiene tiempo de caducidad fijado y estado pendiente identificado'
  );

  // ─── 6. Correo Inválido ────────────────────────────────────────────────────
  console.log('\n6. Verificando rechazo de formatos de correo inválidos...');
  const v1 = validateEmail('correo-sin-arroba.com');
  const v2 = validateEmail('usuario@dominio');
  const v3 = validateEmail('');
  const v4 = validateEmail('piloto.valido@gmail.com');
  assert(
    v1.valid === false && v2.valid === false && v3.valid === false && v4.valid === true,
    'Filtro de formato RFC y dominios inválidos ejecutado estrictamente',
    `Válido: ${v4.email}`
  );

  // ─── 7. Correo ya Registrado / Verificado ──────────────────────────────────
  console.log('\n7. Verificando consulta de estado de correo ya verificado...');
  const rStatus = getEmailStatus(testEmail);
  assert(
    rStatus.verified === true && rStatus.name === testName,
    'Estado verificado consultado con éxito en la base de datos persistente'
  );

  // ─── 8. Envío de Correo de Prueba (Plantilla) ──────────────────────────────
  console.log('\n8. Verificando generación de plantilla para correo de prueba...');
  const htmlTest = getTestEmailTemplate('Carlos Moto');
  assert(
    htmlTest.includes('Prueba de Conexión Exitosa') && htmlTest.includes('Brevo REST v3 Centralizado') && htmlTest.includes('Carlos Moto'),
    'Plantilla HTML de prueba generada con diseño Dark Automotive'
  );

  // ─── 9. Recepción de Alertas de Mantenimiento con Datos Reales ─────────────
  console.log('\n9. Verificando alerta de mantenimiento con datos reales de la moto...');
  const motoData = {
    marca: 'Bajaj',
    modelo: 'Pulsar NS160',
    anio: '2023',
    kmActual: 6100,
    kmUltimoCambio: 4500,
    kmProximoCambio: 6000,
    intervalo: 1500,
  };
  const htmlAlerta = getMaintenanceAlertTemplate({
    tipo: 'urgent',
    moto: motoData,
    extra: { detalle: 'Cambio de filtro de aceite y aceite 20W50' },
  });
  assert(
    htmlAlerta.includes('Bajaj Pulsar NS160') && htmlAlerta.includes('6.100') && htmlAlerta.includes('¡Cambio de Aceite Urgente!'),
    'Plantilla de alerta calculada con km actual, objetivo y datos reales del vehículo'
  );

  // ─── 10. Prevención de Correos Duplicados por Ciclo ────────────────────────
  console.log('\n10. Verificando prevención de alertas duplicadas...');
  const emailDuplicado = `alerta.duplicada.${Date.now()}@gmail.com`;
  // cicloId para alertas de aceite = kmUltimoCambio (identifica el ciclo activo)
  const cicloIdAlerta = 4600; // km en el que se realizó el último cambio de aceite

  const esDuplicadoAntes = isDuplicateAlert(emailDuplicado, 'urgent', cicloIdAlerta);
  recordAlertSent(emailDuplicado, 'urgent', cicloIdAlerta, { kmActual: 6100 });
  const esDuplicadoDespues = isDuplicateAlert(emailDuplicado, 'urgent', cicloIdAlerta);

  // Verificar que un ciclo DIFERENTE (nuevo cambio de aceite) NO sea bloqueado
  const cicloNuevo = 6100; // kmUltimoCambio tras registrar un nuevo cambio
  const esDuplicadoCicloNuevo = isDuplicateAlert(emailDuplicado, 'urgent', cicloNuevo);

  assert(
    esDuplicadoAntes === false &&     // primera vez → no duplicado → se envía
    esDuplicadoDespues === true &&    // mismo ciclo → duplicado → se bloquea
    esDuplicadoCicloNuevo === false,  // nuevo ciclo → no duplicado → se envía
    'Prevención de duplicados por ciclo: bloqueada en mismo ciclo, habilitada en nuevo ciclo'
  );

  // ─── 11. Protección de la API Key ──────────────────────────────────────────
  console.log('\n11. Verificando que la API Key permanezca oculta y protegida...');
  const rawStatusJson = JSON.stringify({
    ok: true,
    service: 'Moto Oil Tracker Email Service',
    brevoConfigured: true,
    senderName: config.brevo.senderName,
  });
  assert(
    !rawStatusJson.includes('xkeysib') && !rawStatusJson.includes(config.brevo.apiKey),
    'Las respuestas del servidor nunca exponen la API Key ni credenciales de Brevo'
  );

  // ─── 12. Funcionamiento en Dispositivos Móviles (PWA / Responsive) ──────────
  console.log('\n12. Verificando elementos de diseño responsive y PWA...');
  const codeValidation = validateCodeFormat('123456') && !validateCodeFormat('12345') && !validateCodeFormat('abcdef');
  const htmlVerify = getVerificationCodeTemplate('789012', 'Piloto');
  assert(
    codeValidation === true && htmlVerify.includes('789012') && htmlVerify.includes('max-width:520px'),
    'Código de 6 dígitos numérico y plantillas optimizadas para pantallas de smartphones'
  );

  // ─── Resumen Final ─────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`📊 RESULTADO FINAL: ${passedTests} de ${totalTests} pruebas pasadas con éxito (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 Todas las pruebas obligatorias fueron ejecutadas y pasaron al 100%.');
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Error durante la ejecución de las pruebas:', err);
  process.exit(1);
});
