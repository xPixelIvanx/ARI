# ARI

Página-regalo hecha en HTML/CSS/JS puro (sin frameworks, carga rápido), conectada a **Firebase** (Analytics), con el código en **GitHub** y desplegada con **Vercel**.

## Qué tiene

1. **Intro misteriosa**: nada arranca hasta que ella toca "Toca para comenzar". Luego aparecen las frases una por una (con tiempo para leerlas) y un sello de lacre que hay que *mantener presionado* para abrir el regalo. Al abrirse, se corre la cortina, caen pétalos y empieza la música.
2. **Hero** con su nombre y un contador en vivo de cuánto tiempo llevan juntos.
3. **Carta**: un sobre animado que se abre y revela la carta.
4. **Recuerdos**: galería de fotos con visor a pantalla completa (se puede deslizar en el celular).
5. **Abre cuando…**: tarjetas que se voltean con mensajes para momentos específicos.
6. **Sorpresa final**: un botón de "no presiones este botón".
7. **Secretos**: el ✦ del pie de página esconde un mensaje, y tocar su nombre 3 veces lanza pétalos.
8. **Música de fondo** con botón flotante para pausar.
9. **Animaciones suaves**: scroll con inercia ([Lenis](https://github.com/darkroomengineering/lenis), incluido en `js/vendor/`, licencia MIT), títulos que aparecen palabra por palabra, fotos que se revelan, parallax en el inicio y contador que sube desde cero.

## Cómo personalizarla

Todo el contenido está en **`js/config.js`**: nombres, fecha de inicio, frases de la intro, carta, fotos, tarjetas, mensaje final y secreto. No hace falta tocar nada más.

### Fotos

1. Sube las fotos a `assets/fotos/` (ej. `assets/fotos/1.jpg`).
2. En `js/config.js`, en `memories`, pon la ruta en `src` y ajusta `ratio` a la forma de la foto (`"4/5"` vertical, `"1/1"` cuadrada, `"3/2"` horizontal).
3. Idealmente fotos de menos de ~500 KB cada una (puedes comprimirlas en https://squoosh.app) para que cargue rápido.

### Música

Sube un archivo `.mp3` como `assets/musica.mp3`. Si no existe, el botón de música simplemente no aparece.

## Modo edición (temporal)

Abre la página con `?editar` al final (ej. `https://tu-sitio.vercel.app/?editar`). Aparece un botón **✎ Editar** para cambiar textos, fecha del contador, fotos, tarjetas, música, etc.

- Los cambios se guardan como borrador **solo en ese dispositivo**; *Vista previa* recarga la página con ellos.
- *Publicar* los sube a GitHub (necesita un token de GitHub, instrucciones dentro del panel) y Vercel actualiza la página en ~1 minuto.
- Sin `?editar`, la página muestra solo lo publicado.

Para quitarlo al final: borrar `js/editor.js`, `css/editor.css` y las líneas marcadas `modo edición` en `js/main.js`.

## Firebase

Proyecto `ariii-c43e3`. La configuración está en `js/firebase.js` (son valores públicos por diseño; la seguridad real se controla con las reglas de Firebase).

La página registra eventos en **Analytics** para que sepas cuándo ella la abrió: `gift_opened`, `letter_opened`, `memory_viewed`, `open_when`, `final_surprise`, `secret_found`. Se ven en la consola de Firebase > Analytics > Events (tardan un rato en aparecer; en *DebugView* se ven casi en tiempo real).

## Vercel

1. https://vercel.com/ → **Add New… > Project** → importar `xPixelIvanx/ARI`.
2. Dejar todo por defecto (sitio estático, sin build ni variables de entorno) → **Deploy**.
3. Cada push a la rama conectada redespliega automáticamente.

## Probar en local

```bash
npx serve .
```

(Hace falta un servidor local porque los scripts son módulos ES; abrir el archivo con doble click no funciona.)
