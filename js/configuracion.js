/**
 * configuracion.js — Lógica para gestión de motocicleta, verificación de correo y notificaciones.
 * Integrado con el backend centralizado de Brevo.
 */

let intervaloSeleccionado = 1500;
let temporizadorExpiracion = null;
let temporizadorReenvio = null;
let segundosRestantesExpiracion = 600; // 10 minutos
let segundosRestantesReenvio = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Si no hay moto registrada, redirigir a registro
    if (!window.Storage?.estaRegistrada()) {
        window.location.replace('registro.html');
        return;
    }

    cargarDatosMoto();
    cargarDatosEmail();
    comprobarEstadoServidor();
    actualizarEstadoNotificaciones();
    initIntervalButtons();
});

// ─── 1. Motocicleta ───────────────────────────────────────────────────────────
function cargarDatosMoto() {
    const moto = window.Storage.obtenerMoto();
    if (!moto) return;

    document.getElementById('cfg-marca').value = moto.marca || '';
    document.getElementById('cfg-modelo').value = moto.modelo || '';
    document.getElementById('cfg-anio').value = moto.anio || '';
    document.getElementById('cfg-cilindraje').value = moto.cilindraje || '';
    document.getElementById('cfg-km-actual').value = moto.kmActual || 0;

    intervaloSeleccionado = moto.intervalo || 1500;
    document.getElementById('cfg-intervalo-custom').value = intervaloSeleccionado;
    seleccionarBotonIntervalo(intervaloSeleccionado);
}

function initIntervalButtons() {
    document.querySelectorAll('.interval-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const km = parseInt(btn.dataset.km, 10);
            intervaloSeleccionado = km;
            seleccionarBotonIntervalo(km);
            const custom = document.getElementById('cfg-intervalo-custom');
            if (custom) custom.value = km;
        });
    });

    const customInput = document.getElementById('cfg-intervalo-custom');
    if (customInput) {
        customInput.addEventListener('input', () => {
            const val = parseInt(customInput.value, 10);
            if (val > 0) {
                intervaloSeleccionado = val;
                seleccionarBotonIntervalo(val);
            }
        });
    }
}

function seleccionarBotonIntervalo(km) {
    document.querySelectorAll('.interval-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.km, 10) === km);
    });
}

window.guardarMotoConfig = function () {
    const marca = document.getElementById('cfg-marca')?.value.trim();
    const modelo = document.getElementById('cfg-modelo')?.value.trim();
    const anio = document.getElementById('cfg-anio')?.value.trim();
    const cilindraje = document.getElementById('cfg-cilindraje')?.value.trim();
    const kmActual = parseInt(document.getElementById('cfg-km-actual')?.value, 10);
    const intervalo = parseInt(document.getElementById('cfg-intervalo-custom')?.value, 10);

    if (!marca || !modelo) {
        showToast('Marca y modelo son obligatorios', 'warning');
        return;
    }

    if (isNaN(intervalo) || intervalo <= 0) {
        showToast('Ingresa un intervalo válido en km', 'warning');
        return;
    }

    window.Storage.actualizarDatosMoto({
        marca,
        modelo,
        anio,
        cilindraje,
        kmActual,
        intervalo,
    });

    showToast('✅ Datos de la motocicleta guardados', 'success');
};

// ─── 2. Estado del Servidor Centralizado ───────────────────────────────────────
async function comprobarEstadoServidor() {
    const dot = document.getElementById('server-status-dot');
    const text = document.getElementById('server-status-text');
    const senderBadge = document.getElementById('server-sender-badge');

    if (!dot || !text) return;

    try {
        const estado = await window.Brevo.verificarEstadoServidor();

        if (estado.ok) {
            dot.className = 'status-dot online';
            text.textContent = 'Servicio de Correo en Línea';
            text.style.color = 'var(--text-primary)';
            if (senderBadge) {
                senderBadge.className = 'badge badge-green';
                senderBadge.textContent = estado.senderName || 'Moto Oil Tracker';
            }
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'Servidor sin conexión con Brevo';
            text.style.color = 'var(--accent-red)';
            if (senderBadge) {
                senderBadge.className = 'badge badge-red';
                senderBadge.textContent = 'Desconectado';
            }
        }
    } catch (e) {
        dot.className = 'status-dot offline';
        text.textContent = 'Servicio no disponible';
        text.style.color = 'var(--accent-red)';
    }
}

// ─── 3. Correo Electrónico del Usuario y Verificación ─────────────────────────
function cargarDatosEmail() {
    const config = window.Storage.obtenerConfig();
    document.getElementById('cfg-email-usuario').value = config.emailUsuario || '';
    document.getElementById('cfg-nombre-usuario').value = config.nombreUsuario || '';
    actualizarBannerEmail();

    // Sincronizar en segundo plano con el backend si hay correo guardado
    if (config.emailUsuario) {
        window.Brevo.consultarEstadoVerificacion(config.emailUsuario).then(res => {
            if (res.ok && res.verified !== config.emailVerificado) {
                config.emailVerificado = res.verified;
                window.Storage.guardarConfig(config);
                actualizarBannerEmail();
            }
        });
    }
}

function actualizarBannerEmail() {
    const config = window.Storage.obtenerConfig();
    const banner = document.getElementById('email-verification-banner');
    const statusText = document.getElementById('email-banner-status');
    const detailText = document.getElementById('email-banner-detail');
    const badge = document.getElementById('email-status-badge');
    const btnVerificar = document.getElementById('btn-verificar-email');
    const btnTest = document.getElementById('btn-test-email');

    if (!banner || !badge) return;

    if (!config.emailUsuario) {
        banner.className = 'email-verification-banner unconfigured';
        badge.className = 'badge';
        badge.textContent = 'Sin configurar';
        statusText.textContent = 'Correo no registrado';
        detailText.textContent = 'Ingresa tu correo para recibir las alertas.';
        if (btnVerificar) btnVerificar.style.display = 'inline-flex';
        if (btnTest) btnTest.disabled = true;
    } else if (config.emailVerificado) {
        banner.className = 'email-verification-banner verified';
        badge.className = 'badge badge-green';
        badge.textContent = '✓ Verificado';
        statusText.textContent = config.emailUsuario;
        detailText.textContent = `Habilitado para recibir alertas desde ${window.Storage.formatearFecha(config.fechaVerificacion || new Date())}`;
        if (btnVerificar) btnVerificar.style.display = 'none'; // Ya verificado
        if (btnTest) btnTest.disabled = false;
    } else {
        banner.className = 'email-verification-banner pending';
        badge.className = 'badge badge-yellow';
        badge.textContent = '⏳ Pendiente';
        statusText.textContent = config.emailUsuario;
        detailText.textContent = 'Requiere confirmación de código de 6 dígitos.';
        if (btnVerificar) btnVerificar.style.display = 'inline-flex';
        if (btnTest) btnTest.disabled = true;
    }
}

window.guardarDatosEmail = function () {
    const email = document.getElementById('cfg-email-usuario')?.value.trim();
    const name = document.getElementById('cfg-nombre-usuario')?.value.trim();

    if (!email) {
        showToast('Ingresa una dirección de correo válida', 'warning');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('El formato del correo no es válido (ej. usuario@gmail.com)', 'warning');
        return;
    }

    const config = window.Storage.obtenerConfig();
    const correoCambio = config.emailUsuario.toLowerCase() !== email.toLowerCase();

    config.emailUsuario = email;
    config.nombreUsuario = name || 'Piloto';

    // Si el usuario cambió de correo, revocar el estado verificado anterior
    if (correoCambio) {
        config.emailVerificado = false;
        config.verificationToken = '';
        config.fechaVerificacion = null;
    }

    window.Storage.guardarConfig(config);
    actualizarBannerEmail();
    showToast(correoCambio ? 'Correo guardado. Ahora solicítalo verificar.' : 'Datos actualizados con éxito.', 'success');
};

// ─── 4. Flujo de Verificación con Código de 6 Dígitos ─────────────────────────
window.iniciarVerificacionEmail = async function () {
    const email = document.getElementById('cfg-email-usuario')?.value.trim();
    const name = document.getElementById('cfg-nombre-usuario')?.value.trim() || 'Piloto';

    if (!email) {
        showToast('Escribe tu correo antes de solicitar la verificación', 'warning');
        document.getElementById('cfg-email-usuario')?.focus();
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Ingresa un correo electrónico con formato válido', 'warning');
        return;
    }

    // Guardar automáticamente datos actuales
    guardarDatosEmail();

    const btnVerificar = document.getElementById('btn-verificar-email');
    const originalText = btnVerificar ? btnVerificar.innerHTML : '';
    if (btnVerificar) {
        btnVerificar.disabled = true;
        btnVerificar.innerHTML = '<span class="spinner"></span> Enviando...';
    }

    try {
        const respuesta = await window.Brevo.solicitarCodigoVerificacion(email, name);

        if (respuesta.ok) {
            document.getElementById('modal-destinatario-email').textContent = email;
            document.getElementById('input-codigo-6').value = '';
            abrirModalCodigo();
            iniciarCuentaRegresiva(600); // 10 minutos
            iniciarCooldownReenvio(60);   // 60 segundos
            showToast('Código de 6 dígitos enviado. Revisa tu correo.', 'info');
        } else {
            showToast(`Error: ${respuesta.error}`, 'error');
            if (respuesta.cooldownRemaining) {
                iniciarCooldownReenvio(respuesta.cooldownRemaining);
                abrirModalCodigo();
            }
        }
    } catch (e) {
        showToast('No se pudo conectar con el servidor para enviar el código.', 'error');
    } finally {
        if (btnVerificar) {
            btnVerificar.disabled = false;
            btnVerificar.innerHTML = originalText;
        }
    }
};

window.abrirModalCodigo = function () {
    const modal = document.getElementById('modal-codigo-verificacion');
    if (!modal) return;
    modal.classList.add('active');
    setTimeout(() => document.getElementById('input-codigo-6')?.focus(), 250);
};

window.cerrarModalCodigo = function () {
    document.getElementById('modal-codigo-verificacion')?.classList.remove('active');
};

function iniciarCuentaRegresiva(segundosTotales) {
    clearInterval(temporizadorExpiracion);
    segundosRestantesExpiracion = segundosTotales;

    actualizarTextoTimer();
    temporizadorExpiracion = setInterval(() => {
        segundosRestantesExpiracion -= 1;
        actualizarTextoTimer();
        if (segundosRestantesExpiracion <= 0) {
            clearInterval(temporizadorExpiracion);
            const timerEl = document.getElementById('timer-cuenta-regresiva');
            if (timerEl) {
                timerEl.textContent = '⚠️ Código expirado';
                timerEl.style.color = 'var(--accent-red)';
            }
        }
    }, 1000);
}

function actualizarTextoTimer() {
    const timerEl = document.getElementById('timer-cuenta-regresiva');
    if (!timerEl) return;
    const m = Math.floor(segundosRestantesExpiracion / 60);
    const s = segundosRestantesExpiracion % 60;
    timerEl.textContent = `⏱️ Expira en: ${m}:${s < 10 ? '0' : ''}${s}`;
    timerEl.style.color = 'var(--text-muted)';
}

function iniciarCooldownReenvio(segundos) {
    clearInterval(temporizadorReenvio);
    segundosRestantesReenvio = segundos;
    const btnReenviar = document.getElementById('btn-reenviar-codigo');

    if (!btnReenviar) return;

    btnReenviar.disabled = true;
    btnReenviar.textContent = `Reenviar (${segundosRestantesReenvio}s)`;

    temporizadorReenvio = setInterval(() => {
        segundosRestantesReenvio -= 1;
        if (segundosRestantesReenvio <= 0) {
            clearInterval(temporizadorReenvio);
            btnReenviar.disabled = false;
            btnReenviar.textContent = 'Reenviar código';
        } else {
            btnReenviar.textContent = `Reenviar (${segundosRestantesReenvio}s)`;
        }
    }, 1000);
}

window.reenviarCodigoVerificacion = async function () {
    const config = window.Storage.obtenerConfig();
    const btnReenviar = document.getElementById('btn-reenviar-codigo');
    if (btnReenviar) btnReenviar.disabled = true;

    showToast('Reenviando nuevo código...', 'info');
    const respuesta = await window.Brevo.solicitarCodigoVerificacion(config.emailUsuario, config.nombreUsuario);

    if (respuesta.ok) {
        iniciarCuentaRegresiva(600);
        iniciarCooldownReenvio(60);
        showToast('Nuevo código de 6 dígitos enviado.', 'success');
    } else {
        showToast(`Error: ${respuesta.error}`, 'error');
        if (respuesta.cooldownRemaining) {
            iniciarCooldownReenvio(respuesta.cooldownRemaining);
        }
    }
};

window.confirmarCodigoVerificacion = async function () {
    const config = window.Storage.obtenerConfig();
    const input = document.getElementById('input-codigo-6');
    const code = input?.value.trim();

    if (!code || !/^\d{6}$/.test(code)) {
        showToast('Ingresa el código numérico completo de 6 dígitos', 'warning');
        input?.focus();
        return;
    }

    const btnConfirmar = document.getElementById('btn-confirmar-codigo');
    const originalText = btnConfirmar ? btnConfirmar.innerHTML : '';
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<span class="spinner"></span> Validando...';
    }

    try {
        const respuesta = await window.Brevo.confirmarCodigo(config.emailUsuario, code);

        if (respuesta.ok) {
            clearInterval(temporizadorExpiracion);
            clearInterval(temporizadorReenvio);
            cerrarModalCodigo();
            actualizarBannerEmail();
            showToast('🎉 ¡Correo verificado con éxito! Alertas activadas.', 'success');
        } else {
            showToast(`Error: ${respuesta.error}`, 'error');
            input.value = '';
            input.focus();
        }
    } catch (e) {
        showToast('Error de red al intentar verificar el código.', 'error');
    } finally {
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = originalText;
        }
    }
};

// ─── 5. Envío de Correo de Prueba ─────────────────────────────────────────────
window.probarEnvioEmail = async function () {
    const btn = document.getElementById('btn-test-email');
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enviando correo de prueba...';

    try {
        const resultado = await window.Brevo.enviarEmailPrueba();

        if (resultado.ok) {
            showToast('✅ Correo de prueba enviado con éxito. Revisa tu bandeja.', 'success');
        } else {
            showToast(`Error: ${resultado.error}`, 'error');
        }
    } catch (e) {
        showToast(`Error de conexión: ${e.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// ─── 6. Notificaciones Push ───────────────────────────────────────────────────
function actualizarEstadoNotificaciones() {
    const badge = document.getElementById('notif-status-badge');
    const btnActivar = document.getElementById('btn-activar-notif');
    if (!badge) return;

    if (!('Notification' in window)) {
        badge.className = 'badge badge-red';
        badge.textContent = 'No soportado';
        if (btnActivar) btnActivar.disabled = true;
        return;
    }

    if (Notification.permission === 'granted') {
        badge.className = 'badge badge-green';
        badge.textContent = 'Activo';
        if (btnActivar) {
            btnActivar.innerHTML = '✓ Concedido';
            btnActivar.disabled = true;
        }
    } else if (Notification.permission === 'denied') {
        badge.className = 'badge badge-red';
        badge.textContent = 'Bloqueado';
        if (btnActivar) {
            btnActivar.innerHTML = 'Bloqueado';
            btnActivar.disabled = true;
        }
    } else {
        badge.className = 'badge badge-yellow';
        badge.textContent = 'Pendiente';
        if (btnActivar) {
            btnActivar.innerHTML = 'Activar Push';
            btnActivar.disabled = false;
        }
    }
}

window.activarNotificacionesUI = async function () {
    const res = await window.Notif?.activarNotificaciones();
    actualizarEstadoNotificaciones();
    if (res) {
        showToast('¡Notificaciones Push activadas con éxito!', 'success');
    }
};

window.probarNotificacionPush = async function () {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        const ok = await window.Notif?.solicitarPermiso();
        actualizarEstadoNotificaciones();
        if (!ok) {
            showToast('Primero debes permitir las notificaciones en tu navegador', 'warning');
            return;
        }
    }

    const moto = window.Storage.obtenerMoto();
    await window.Notif?.notificar(
        '🏍️ Alerta de Prueba MotoTracker',
        `Esta es una notificación de prueba para tu ${moto?.marca || ''} ${moto?.modelo || 'moto'}. ¡Todo funciona al 100%!`,
        { tag: 'test-notif' }
    );
    showToast('Notificación enviada al dispositivo', 'info');
};

// ─── 7. Respaldo y Restauración ───────────────────────────────────────────────
window.exportarRespaldo = function () {
    const jsonStr = window.Storage.exportarDatos();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `mototracker_backup_${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Copia de seguridad descargada', 'success');
};

window.importarRespaldo = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const ok = window.Storage.importarDatos(e.target.result);
        if (ok) {
            showToast('✅ Datos restaurados con éxito. Recargando...', 'success');
            setTimeout(() => window.location.reload(), 1200);
        } else {
            showToast('Error: archivo de respaldo inválido o dañado', 'error');
        }
    };
    reader.readAsText(file);
};

window.reiniciarDatosApp = function () {
    const confirmacion = prompt('⚠️ ATENCIÓN: Esta acción borrará todos tus datos, kilometrajes e historial.\n\nEscribe "BORRAR" para confirmar:');
    if (confirmacion === 'BORRAR') {
        window.Storage.resetearTodo();
        showToast('Datos eliminados. Redirigiendo...', 'info');
        setTimeout(() => {
            window.location.replace('../index.html');
        }, 1000);
    } else if (confirmacion !== null) {
        showToast('Acción cancelada. No se borró ningún dato.', 'info');
    }
};
