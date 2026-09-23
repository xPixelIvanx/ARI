# ARI

Sitio web de prueba (HTML simple) conectado a **Firebase**, con el código en **GitHub** y desplegado automáticamente con **Vercel**.

Por ahora es solo una página vacía de prueba que confirma si la conexión con Firebase funciona. A partir de aquí se puede ir construyendo el resto del sitio.

## Estructura

- `index.html` — página de prueba. Ya tiene cargada la configuración del proyecto Firebase `ariii` y muestra si logró conectar.
- `vercel.json` — configuración mínima para que Vercel sirva el sitio como estático.

No hace falta ningún paso de build ni variables de entorno: los valores de `firebaseConfig` (apiKey, authDomain, etc.) son públicos por diseño, están pensados para vivir en el código del cliente. La seguridad real de los datos se controla desde las **reglas de Firestore/Storage/Auth** en la consola de Firebase, no ocultando estos valores.

## 1. Firebase

Ya está creado y conectado: proyecto `ariii-c43e3`. Si más adelante se necesita guardar datos (mensajes, fotos, etc.), hay que activar Firestore/Storage/Auth desde el menú lateral de https://console.firebase.google.com/ (proyecto `ariii`) y agregar el código correspondiente en `index.html`.

## 2. Conectar el repositorio con Vercel

1. Ir a https://vercel.com/ e iniciar sesión (puedes usar tu cuenta de GitHub).
2. Click en **Add New… > Project**.
3. Seleccionar el repositorio `xPixelIvanx/ARI` e importarlo.
4. Vercel va a detectar que es un sitio estático automáticamente (no hace falta tocar el Framework Preset ni configurar variables de entorno).
5. Click en **Deploy**.
6. Cada vez que se haga push a la rama conectada en GitHub, Vercel va a redesplegar automáticamente.

## 3. Probar en local (opcional)

Al no requerir build, basta con abrir `index.html` con cualquier servidor estático, por ejemplo:

```bash
npx serve .
```

(Abrir el archivo directamente con doble click también funciona, salvo que se quiera activar Analytics, que necesita `http(s)://`.)

## Siguientes pasos

- Definir qué va a tener la página (fotos, mensajes, contador de días, etc.).
- Activar Firestore/Storage/Auth en la consola de Firebase si se necesita guardar o autenticar datos, y configurar las **reglas de seguridad** correspondientes.
