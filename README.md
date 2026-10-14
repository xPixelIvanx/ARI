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

## Modo edición (temporal)

Abre la página con `?editar` al final y toca **✎ Editar**. Al tocar **Publicar**, los cambios (textos, fotos, canciones, música) se suben a Firestore y la página normal los muestra en cuanto se recarga, sin esperar a Vercel. En *Canciones* basta pegar el link de Spotify para que se llenen el nombre y la portada.

La página normal lee lo publicado en Firestore (`edicion/contenido`); si Firestore no responde en 4 s, usa `js/config.js` como respaldo.

Para quitar el editor al terminar: borrar `js/editor.js`, `css/editor.css` y las líneas marcadas `modo edición` en `js/main.js`.

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

## Login con Google y estadísticas

Las tres páginas piden iniciar sesión con Google (`js/session.js`, estilo en `css/auth.css`). Con `?editar` no se pide login ni se registra nada.

Al crearse la cuenta se guarda `usuarios/{uid}` en Firestore, y después se va actualizando:

- `aperturas`: cuántas veces se abrió una página (total y por página en `paginas.<página>.aperturas`).
- `segundos`: tiempo total con la pestaña visible (y por página en `paginas.<página>.segundos`).
- `apartados.<página>_<apartado>`: segundos dentro de cada apartado (`regalo_carta`, `regalo_recuerdos`, `proximo_pregunta`, `intro`, etc.; en el carrusel, el folleto al frente).

Para activarlo en Firebase:

1. **Authentication > Sign-in method**: activar *Google*.
2. **Authentication > Settings > Authorized domains**: agregar el dominio de Vercel.
3. **Firestore > Rules**: pegar el contenido de `firestore.rules` y publicar (cada persona solo lee/escribe su propio documento).

Las estadísticas se ven en la consola de Firebase > Firestore > `usuarios`.
