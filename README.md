# ARI

Sitio web de prueba (HTML simple) conectado a **Firebase**, con el código en **GitHub** y desplegado automáticamente con **Vercel**.

Por ahora es solo una página vacía de prueba que confirma si la conexión con Firebase funciona. A partir de aquí se puede ir construyendo el resto del sitio.

## Estructura

- `index.html` — página de prueba. Muestra si logró conectar con Firebase.
- `scripts/build-config.js` — genera `firebase-config.json` a partir de variables de entorno durante el build (así las claves no quedan escritas en el código).
- `vercel.json` — le dice a Vercel cómo construir y servir el sitio.
- `.env.example` — plantilla de las variables de entorno que hay que configurar.

## 1. Crear el proyecto en Firebase

1. Ir a https://console.firebase.google.com/ e iniciar sesión con tu cuenta de Google.
2. Crear un proyecto nuevo (ej. "ari").
3. Dentro del proyecto, ir a **Configuración del proyecto** (ícono de engranaje) > **Tus apps**.
4. Agregar una app **Web** (ícono `</>`), ponerle un nombre.
5. Firebase te va a mostrar un objeto `firebaseConfig` con valores como `apiKey`, `authDomain`, `projectId`, etc. Vas a necesitar esos valores en el paso 3.

Si más adelante quieres usar Firestore/Auth/Storage, actívalos desde el menú lateral de la consola de Firebase (por ahora no es necesario, la página de prueba solo intenta conectar).

## 2. Subir el proyecto a GitHub

Este repositorio ya está conectado a GitHub (`xPixelIvanx/ARI`). Solo falta hacer commit y push de estos archivos (ver más abajo, o pídele a Claude que lo haga).

## 3. Conectar el repositorio con Vercel

1. Ir a https://vercel.com/ e iniciar sesión (puedes usar tu cuenta de GitHub).
2. Click en **Add New… > Project**.
3. Seleccionar el repositorio `xPixelIvanx/ARI` e importarlo.
4. Vercel va a detectar el `vercel.json` automáticamente. No hace falta tocar el framework preset (dejar "Other").
5. Antes de darle a "Deploy", ir a **Environment Variables** y cargar las mismas variables del `firebaseConfig` de Firebase:

   | Nombre | Valor (de Firebase) |
   |---|---|
   | `FIREBASE_API_KEY` | `apiKey` |
   | `FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `FIREBASE_PROJECT_ID` | `projectId` |
   | `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `FIREBASE_APP_ID` | `appId` |
   | `FIREBASE_MEASUREMENT_ID` | `measurementId` (opcional) |

6. Click en **Deploy**. Cada vez que hagas push a la rama principal en GitHub, Vercel va a redeployar automáticamente.

## 4. Probar en local (opcional)

```bash
cp .env.example .env
# completar .env con los valores de Firebase
export $(cat .env | xargs) && npm run build
# esto genera firebase-config.json
# luego abrir index.html con un servidor local, por ejemplo:
npx serve .
```

## Siguientes pasos

- Definir qué va a tener la página (fotos, mensajes, contador de días, etc.).
- Si se necesita guardar datos (mensajes, fotos, etc.), activar Firestore/Storage en la consola de Firebase y agregar el código correspondiente en `index.html` o en archivos nuevos.
