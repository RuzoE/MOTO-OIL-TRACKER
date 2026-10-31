# 🏍️ Moto Oil Tracker — Sistema de Control y Notificaciones con Brevo API v3

Aplicación web progresiva (**PWA**) y responsiva (mobile-first) para el control de kilometraje, cambio de aceite y mantenimiento preventivo de motocicletas, con arquitectura de **notificaciones por correo centralizadas** mediante la **API REST v3 de Brevo**.

---

## 🏛️ Arquitectura del Sistema

```text
moto-oil-tracker/
├── index.html                   (Landing de entrada y redirección PWA)
├── manifest.json                (Configuración PWA, tema oscuro, iconos)
├── sw.js                        (Service Worker para caché offline y push local)
├── html/
│   ├── registro.html            (Onboarding en 3 pasos con OCR Tesseract.js)
│   ├── dashboard.html           (Panel principal, odómetro, estimador y acciones)
│   ├── mantenimiento.html       (Bitácora de taller y recálculo automático)
│   └── configuracion.html       (Ajustes de moto, Push y verificación de correo)
├── css/
│   ├── global.css               (Design tokens Dark Automotive, reset, fuentes)
│   ├── registro.css             (Estilos del onboarding)
│   ├── dashboard.css            (Estilos del odómetro y barra de porcentaje)
│   ├── mantenimiento.css        (Estilos de la bitácora y chips de filtrado)
│   └── configuracion.css        (Estilos de ajustes, modal de 6 dígitos)
├── js/
│   ├── storage.js               (Gestor de localStorage sin secretos ni credenciales)
│   ├── ocr.js                   (Motor OCR con Tesseract.js v5 vía CDN)
│   ├── notifications.js         (Gestor Web Push Notifications API)
│   ├── brevo.js                 (Cliente frontend hacia el microservicio backend)
│   ├── registro.js              (Lógica del onboarding)
│   ├── dashboard.js             (Lógica de odómetro y alertas automáticas)
│   ├── mantenimiento.js        (Lógica de taller y confirmaciones por correo)
│   └── configuracion.js        (Lógica de verificación de correo con código de 6 dígitos)
└── backend/
    ├── package.json             (Dependencias: Express, Helmet, CORS, Rate-Limit, Dotenv)
    ├── .env.example             (Plantilla de variables de entorno)
    ├── .env                     (Variables locales con API Key de Brevo)
    ├── data/                    (Almacenamiento persistente de correos verificados)
    │   └── verifications.json
    ├── tests/                   (Suite de 12 pruebas obligatorias ejecutables)
    │   └── run_all_tests.js
    └── src/
        ├── config.js            (Validador de entorno y credenciales)
        ├── db.js                (Hashes HMAC-SHA-256 de 6 dígitos y control de duplicados)
        ├── server.js            (Servidor Express y middlewares de seguridad)
        ├── middleware/
        │   ├── security.js      (Helmet, CORS y Rate Limiters)
        │   └── validator.js     (Validación RFC de emails y códigos)
        ├── routes/
        │   ├── verifyRoutes.js  (Endpoints de solicitud y confirmación de código)
        │   └── emailRoutes.js   (Endpoints de prueba y envío de alertas)
        ├── services/
        │   └── brevoService.js  (Cliente oficial Brevo v3: /account y /smtp/email)
        └── templates/
            └── emailTemplates.js (Plantillas HTML Dark Automotive responsive)
```

---

## 🔒 Seguridad y Protección de la API Key

- **Una sola API Key de Brevo:** Pertenece al administrador y se define en las variables de entorno del servidor (`backend/.env`).
- **Cero secretos en el cliente:** El frontend (HTML/CSS/JS) y `localStorage` **no contienen ni conocen la API Key**.
- **Validación de Códigos con Hashing:** Los códigos de 6 dígitos nunca se guardan en texto plano; se utiliza **HMAC-SHA-256 con salt único**.
- **Caducidad e Intentos:** Vencimiento a los 10 minutos, límite de 5 intentos y tiempo de espera (*cooldown*) de 60 segundos entre reenvíos.
- **Protección contra Abuso:** Limitadores de tasa por IP (`rateLimit`), cabeceras HTTP de protección (`helmet`) y control de duplicados en 24 horas.

---

## 🚀 Puesta en Marcha Local

### 1. Requisitos Previos
- Node.js versión 18 o superior.
- Una cuenta gratuita en [Brevo](https://www.brevo.com/).
- Tu API Key v3 de Brevo generada en: **Brevo > Configuración > SMTP & API > Claves API**.
- Tu correo verificado como remitente en: **Brevo > Remitentes e IP**.

### 2. Configurar el Backend
1. Ingresa a la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Edita el archivo `.env` con tus credenciales reales:
   ```env
   PORT=3000
   BREVO_API_KEY=xkeysib-tu_clave_real_de_brevo
   BREVO_SENDER_EMAIL=tu_correo_de_registro_en_brevo@gmail.com
   BREVO_SENDER_NAME=Moto Oil Tracker
   ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000
   TOKEN_SECRET=un_secreto_aleatorio_seguro_de_32_caracteres
   NODE_ENV=development
   ```
4. Inicia el servidor backend:
   ```bash
   npm start
   ```
   *(Verás el mensaje indicando que el servidor está escuchando en `http://localhost:3000`)*.

### 3. Iniciar el Frontend
Abre `index.html` con un servidor estático local (por ejemplo con la extensión **Live Server** de VS Code o ejecutando `npx serve .` en la raíz).

---

## 🌐 Despliegue en Producción

### Frontend (GitHub Pages)
1. Sube los archivos a un repositorio de GitHub.
2. En GitHub ve a **Settings > Pages**.
3. Selecciona la rama principal (`main`) y carpeta `/root`.
4. Tu sitio web quedará disponible en: `https://tu-usuario.github.io/tu-repositorio/`.

### Backend (Render, Railway o VPS)
1. Crea un nuevo Web Service en [Render](https://render.com/) o [Railway](https://railway.app/).
2. Conecta tu repositorio y selecciona el directorio raíz de construcción: `backend`.
3. Comando de inicio: `npm start`.
4. En la sección de **Environment Variables** agrega:
   - `BREVO_API_KEY`: tu clave secreta de Brevo.
   - `BREVO_SENDER_EMAIL`: tu remitente verificado en Brevo.
   - `BREVO_SENDER_NAME`: `Moto Oil Tracker`.
   - `ALLOWED_ORIGINS`: `https://tu-usuario.github.io`.
   - `NODE_ENV`: `production`.
5. En la aplicación web del usuario, la URL del backend se conectará automáticamente.

---

## 🧪 Ejecución de Pruebas

Para correr la suite completa de 12 pruebas obligatorias automatizadas:

```bash
node backend/tests/run_all_tests.js
```
