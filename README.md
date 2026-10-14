# ARI

Página-regalo hecha en HTML/CSS/JS puro (sin frameworks, carga rápido), conectada a **Firebase** (Analytics), con el código en **GitHub** y desplegada con **Vercel**.

## Qué tiene

1. **Intro misteriosa**: nada arranca hasta que ella toca "Toca para comenzar". Luego aparecen las frases una por una (con tiempo para leerlas) y un sello de lacre que hay que *mantener presionado* para abrir el regalo. Al abrirse, se corre la cortina, caen pétalos y empieza la música.
2. **Hero** con su nombre y un contador en vivo de cuánto tiempo llevan juntos.
3. **Carta**: un sobre animado que se abre y revela la carta.
4. **Recuerdos**: galería de fotos con visor a pantalla completa (se puede deslizar en el celular).
5. **Nuestras canciones**: cada canción es un vinil dentro de su portada; al tocarlo sale girando y aparece la frase. No reproduce audio.
6. **Abre cuando…**: tarjetas que se voltean con mensajes para momentos específicos.
7. **Sorpresa final**: un botón de "no presiones este botón".
8. **Secretos**: el ✦ del pie de página esconde un mensaje, y tocar su nombre 3 veces lanza pétalos.
9. **Música de fondo** con botón flotante para pausar.
10. **Animaciones suaves**: scroll con inercia ([Lenis](https://github.com/darkroomengineering/lenis), incluido en `js/vendor/`, licencia MIT), títulos que aparecen palabra por palabra, fotos que se revelan, parallax en el inicio y contador que sube desde cero.

## Cómo personalizarla

Todo el contenido está en **`js/config.js`**: nombres, fecha de inicio, frases de la intro, carta, fotos, canciones, tarjetas, mensaje final y secreto. No hace falta tocar nada más.

### Fotos

1. Sube las fotos a `assets/fotos/` (ej. `assets/fotos/1.jpg`).
2. En `js/config.js`, en `memories`, pon la ruta en `src` y ajusta `ratio` a la forma de la foto (`"4/5"` vertical, `"1/1"` cuadrada, `"3/2"` horizontal).
3. Idealmente fotos de menos de ~500 KB cada una (puedes comprimirlas en https://squoosh.app) para que cargue rápido.

### Música

Sube un archivo `.mp3` como `assets/musica.mp3`. Si no existe, el botón de música simplemente no aparece.

## Modo edición en vivo (solo admin)

Si entras con la cuenta admin aparece el botón **✎ Editar** (abajo a la izquierda) en todas las páginas. Al tocarlo la página se salta las intros y se edita **directamente sobre ella**:

- **Textos:** tócalos y escribe.
- **Fotos y recuadros de foto:** tócalos y elige una imagen (se achica sola).
- **Listas** (fotos, canciones, tarjetas, párrafos de la carta, promesas…): cada elemento tiene ⠿ (mantén y **arrastra** para moverlo, con mouse o con el dedo), ✎ (todos sus campos) y ✕; debajo hay un botón **+ Agregar**.
- **Ajustes:** lo que no está a la vista (nombres, fecha del contador, frases de la intro, las 5 flores, música, secreto, fecha de la cuenta regresiva).
- **Confirmar cambios** publica en Firestore; ella lo ve al abrir o recargar. Mientras no confirmes, los cambios son un borrador en tu dispositivo. **Descartar** vuelve a lo publicado y **Salir** te deja ver la página como la ve ella.

### Modo creativo

- **＋ Bloque** (barra de abajo, o el botón **＋ Bloque aquí** que hay debajo de cada sección): agrega un título, texto, frase, emoji grande, foto, botón/enlace, separador o espacio, justo donde quieras. Cada bloque tiene ⠿ (arrástralo a donde quieras, incluso a otra sección), 🎨 (opciones), ⧉ duplicar y ✕ quitar.
- **🎨 Estilo:** toca cualquier texto (o un bloque) y cambia su color, tamaño, negrita, cursiva, alineación, tipo de letra y espacios.
- **🙈 Ocultar sección:** esconde cualquier sección completa (en el modo edición se ve atenuada para poder volver a mostrarla).
- **↶ ↷ Deshacer y rehacer** (también Ctrl/Cmd+Z fuera de un texto): cubre agregar, mover, quitar, estilos, fotos y secciones ocultas.
- **Páginas:** la barra tiene atajos a Inicio, Regalo y Próximo (en el menú ⋯); en el carrusel, el admin siempre ve el botón de la cuenta regresiva, aunque todavía no sea la hora.

Los bloques, estilos y secciones ocultas se guardan junto con el resto del contenido (`blocks`, `styles`, `hidden`) y se pintan para todos desde `js/blocks.js`. Solo existen en páginas con `data-ed-root` en su `<main>` (regalo y proximo).

Para agregar una página nueva al sistema: ponle a sus textos `data-ed="ruta"` (y `data-ed-img`, `data-ed-list` / `data-ed-item` si aplica), incluye `session.js` con su `data-page`, y agrega su entrada en `js/edit-schemas.js`. Las páginas escritas a mano en HTML aplican lo publicado con `applyStatic()` (ver `js/carousel.js`).

## Rangos

Colección `roles/{uid}` en Firestore, con el campo `rol`:

- `admin`: puede editar y publicar. El correo del dueño (`exmeu23@gmail.com`) es admin siempre (definido en `firestore.rules`).
- `viewer`: solo ve la página. Es lo que recibe cualquier otra cuenta al iniciar sesión por primera vez.

Para dar permiso de edición a otra cuenta: en la consola de Firebase > Firestore > `roles` > su documento, cambia `rol` a `admin`.

## Firebase

Proyecto `ariii-c43e3`. La configuración está en `js/firebase.js` (son valores públicos por diseño; la seguridad real se controla con las reglas de Firebase).

La página registra eventos en **Analytics** para que sepas cuándo ella la abrió: `gift_opened`, `letter_opened`, `memory_viewed`, `open_when`, `song_opened`, `final_surprise`, `secret_found`. Se ven en la consola de Firebase > Analytics > Events (tardan un rato en aparecer; en *DebugView* se ven casi en tiempo real).

## Vercel

1. https://vercel.com/ → **Add New… > Project** → importar `xPixelIvanx/ARI`.
2. Dejar todo por defecto (sitio estático, sin build ni variables de entorno) → **Deploy**.
3. Cada push a la rama conectada redespliega automáticamente.

## Probar en local

```bash
npx serve .
```

(Hace falta un servidor local porque los scripts son módulos ES; abrir el archivo con doble click no funciona.)

## Carrusel y página de la propuesta

- `index.html` es un carrusel 3D con 3 folletos: el regalo (`regalo.html`), una cuenta regresiva y "Próximamente". La fecha de la cuenta regresiva está en `js/carousel.js` (`PROPUESTA`).
- `proximo.html` es la página de la propuesta: intro de 5 flores que crecen al mantener presionado, y después fotos, promesas y la pregunta.
- **Todo el texto y las fotos de esa página** están en `js/proximo-contenido.js`. Si una foto queda vacía (`""`) se ve un recuadro de muestra; para usar una foto, súbela a `assets/fotos/` y pon la ruta.
- **Música:** si subes `assets/proximo.mp3` se usa ese archivo; si no, suena una melodía suave generada por el navegador.

## Adaptación a cualquier pantalla

Las tres páginas (`index.html`, `regalo.html`, `proximo.html`) se adaptan a celulares (vertical y horizontal), tablets y escritorio, y se pueden usar con zoom:

- **Zoom permitido:** el `viewport` no bloquea el zoom y ningún elemento usa `touch-action: none` ni `pan-y` solos (el carrusel usa `pan-y pinch-zoom`; los botones de mantener presionado usan `pinch-zoom`).
- **Nada se corta:** las intros hacen scroll si la pantalla es muy baja (celular acostado o con zoom), el visor de fotos tiene su propio scroll, y el carrusel agranda sus tarjetas si el contenido lo necesita.
- **Áreas táctiles:** botones y enlaces miden al menos 44 px.
- **Muescas y barras:** los márgenes respetan `env(safe-area-inset-*)`.

## Cuentas, perfil y estadísticas

Todas las páginas piden iniciar sesión con Google (`js/session.js`). La **primera vez** se pide un perfil: nombre y foto (la foto se recorta y se achica a 256 px y se guarda en el propio documento). Se puede editar después desde el chip de la cuenta, arriba a la derecha del carrusel (`js/account.js`), donde también está **Cerrar sesión**.

Cada cuenta tiene `usuarios/{uid}` en Firestore:

- `aperturas`, `sesiones` (una por pestaña), `segundos` (tiempo total con la pestaña visible), `ultimaVisita`.
- `paginas.<página>.{aperturas,segundos}` y `apartados.<página>_<apartado>` (segundos por apartado: `regalo_carta`, `proximo_pregunta`, `index_wrapped`…).
- `dias.<AAAA-MM-DD>` y `horas.<0-23>` (segundos), para saber cuándo viene.
- `acciones.<nombre>`: cosas que hizo (`song_opened`, `open_when`, `final_surprise`, `secret_found`, `proximo_si`…). Cualquier página puede registrar una con `dispatchEvent(new CustomEvent("ari:action", { detail: { name } }))`.

Para activarlo en Firebase: Authentication > Google, dominios autorizados y publicar `firestore.rules`.

### Panel de estadísticas (admin)

Con una cuenta admin, el chip del carrusel tiene **📊 Panel de estadísticas** (`admin.html`): resumen, lista de cuentas en vivo y, por cuenta, tiempo total, sesiones, días activos, hora favorita, tiempo por página y apartado, últimos 30 días, horas del día, acciones y sus premios. También permite cambiar el rango (viewer/admin) y abrir el Wrapped de esa cuenta.

### Wrapped (`wrapped.html`)

Historias a pantalla completa con su tiempo total, visitas, rincón favorito, hora favorita, lo que tocó y **premios de broma** (`awards()` en `js/stats-lib.js`). En el carrusel es la 4.ª tarjeta: aparece una semana antes de la fecha (con cuenta regresiva) y se abre en año nuevo; el admin la ve siempre; la fecha y el mensaje final se cambian desde el modo edición (carrusel > Ajustes, y Wrapped > Ajustes). El admin puede verlo siempre y ver el de cualquier cuenta con `?uid=`.

