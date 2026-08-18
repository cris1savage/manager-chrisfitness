# Chris Fitness · Panel de Control

App real (Next.js + Supabase) con login seguro, datos guardados en base de
datos, y acceso desde cualquier ordenador para ti y tu socia. Mismo stack que
ya usas en `chrisfitness.online/comunidad`, así que el flujo de despliegue te
sonará.

## Novedades de este ajuste (la más reciente)

- **Sincronización con Google Calendar**: lo que se programa en el
  Calendario del panel (crear, editar, borrar) se sincroniza solo con el
  Google Calendar de cada cuenta conectada. Cada uno conecta el suyo desde
  Cuenta y Seguridad → Google Calendar. Ver la sección "Google Calendar"
  más abajo para la configuración (requiere un proyecto en Google Cloud,
  más sencillo que lo de Meta porque no hace falta pasar revisión para
  solo 2 usuarios).

## Novedades de este ajuste (la más reciente)

- **Bug arreglado en Guiones**: el editor de texto no tenía forma de quitar
  un título o negrita una vez aplicados — había que borrar y reescribir.
  Añadido un botón "Aa" en la barra de formato que quita el formato del
  bloque seleccionado y vuelve al texto normal.
- **Historial unificado**: Mensual y Semanal ya no son dos secciones en el
  menú — ahora es una sola página (`/historial`) con un selector arriba
  para cambiar de vista. Menos ruido en la barra lateral, misma información.
- **"Ver más" en vez de lista infinita**: el historial ahora muestra 8 filas
  y un botón para cargar más — así dentro de 1-2 años no tienes una lista
  interminable en la pantalla.
- **Gráfico de líneas en vez de barras**: para comparar facturación e
  inversión en anuncios a lo largo del tiempo, una línea se lee mejor que
  columnas — se ve la tendencia de un vistazo.

## Novedades de este ajuste (la más reciente)

- **Guiones fusionado con Banco de ideas**: ya no son dos secciones
  separadas. Ahora Guiones tiene 4 etapas — Idea → Borrador → Listo →
  Grabado — y se añade igual que Contactos (formulario rápido arriba,
  pestañas por etapa). Una idea suelta es simplemente un guion en su
  primera etapa; lo abres cuando quieras escribirlo de verdad. El Banco de
  ideas antiguo se migra solo la primera vez que pegues el `schema.sql`
  (nada se pierde, tus ideas pasan a ser guiones en etapa "Idea").
- **Historial semanal** (`/historial-semanal`), aparte del mensual a
  propósito: inversión en ads, altas y facturación semana a semana, para
  el pulso a corto plazo. El mensual sigue siendo el de referencia para
  tendencias reales — el semanal es más ruidoso por diseño, úsalo para
  "¿cómo voy esta semana?", no para sacar conclusiones grandes.

## Novedades de este ajuste (la más reciente)

- **Historial mensual** (`/historial`): un resumen automático de cada mes
  (inversión en ads, contactos nuevos, clientes nuevos, facturación,
  beneficio, clientes activos, contenido subido, tareas cumplidas), con un
  gráfico comparando facturación vs. inversión y el % de cambio respecto al
  mes anterior. Se actualiza solo cada día vía el mismo aviso diario que ya
  tenías — el mes en curso se ve marcado como "En curso" y en cuanto cambia
  de mes, esa fila queda congelada como historial para siempre.
  Al pegar el `schema.sql`, se rellenan también los últimos 12 meses con
  datos reales que ya tenías (inversión reconstruida por fechas, altas,
  ventas, contenido, tareas — todo a partir de fechas reales ya guardadas).

## Novedades de este ajuste (la más reciente)

- **Bug arreglado (importante)**: `schema.sql` tenía dos instrucciones que
  borraban y recreaban las tablas de **Anuncios** y **Objetivos** enteras
  cada vez que se volvía a pegar el archivo — eran de cuando cambiamos su
  estructura hace tiempo, y se quedaron ahí por error, borrando esos datos
  en cada actualización futura. Ya no pasa: a partir de ahora, pegar
  `schema.sql` nunca borra nada que ya tengas creado, en ninguna tabla.

## Novedades de este ajuste (la más reciente)

- **Rendimiento real de anuncios (manual)**: en cada anuncio puedes copiar
  impresiones, clics y CTR desde Meta Ads Manager de vez en cuando (el CTR
  se calcula solo si pones impresiones + clics, pero puedes sobrescribirlo).
  No hay conexión directa con Meta — esto es a mano, a propósito, para no
  meterte en la complejidad de conectar la cuenta de verdad. Se refleja en
  el Dashboard (impresiones totales y CTR medio del mes) y el análisis con
  IA de Anuncios ya lo tiene en cuenta si lo has rellenado.

## Novedades de este ajuste (la más reciente)

- **Documentos** (`/documentos`): sube archivos (PDFs, imágenes...) y
  visualízalos directamente desde la web sin descargarlos — botón "Ver"
  abre un visor dentro de la propia app. Usa el almacenamiento de Supabase,
  privado (solo vosotros dos tenéis acceso).
- **Análisis de anuncios con IA**: en Anuncios, botón "Analizar anuncios"
  — bajo demanda, solo cuando tú lo pulsas, nunca automático — te da un
  análisis breve de qué campaña funciona mejor y qué hacer a continuación,
  usando tus datos reales de gasto/clientes/ROI.

## Novedades de este ajuste (la más reciente)

- **Asistente de IA en Contactos**: dentro de cada ficha, icono de estrellas
  (✨) junto al de notas. Pegas lo que te ha escrito esa persona y te
  sugiere 3 respuestas distintas (usa el nombre, la etapa, el origen y las
  notas de esa ficha como contexto), con botón de copiar. Requiere tu propia
  clave de Anthropic — ver la sección "Asistente de IA" del README.

## Novedades de este ajuste (la más reciente)

- **Anuncios con objetivo**: cada campaña ahora tiene un objetivo (Visitas,
  Mensajes, Web, Interacción, Seguidores, Otro), igual que en Meta Ads.
- **Atribución de contactos a un anuncio en concreto**: en Contactos, el
  origen ahora incluye "Anuncio" — al elegirlo, seleccionas de qué campaña
  viene esa persona. Si luego pasa a Cliente, en la página de Anuncios verás
  cuántos clientes, cuánto facturado y el ROI real de esa campaña en
  concreto (no solo el total mezclado del mes, que sigue en el Dashboard).

## Novedades de este ajuste (la más reciente)

- **Bug del Calendario arreglado (importante)**: los días se veían
  desplazados una columna (ej. un lunes aparecía como martes). La causa era
  que la app convertía las fechas a formato UTC, y España va por delante de
  UTC, así que cada fecha se corría un día hacia atrás. Ya usa siempre la
  fecha local del navegador — no hace falta hacer nada para que funcione,
  solo subir el código nuevo.
- **Categorías de contenido editables**: antes eran 4 fijas (Reel, Historia,
  Video, TikTok). Ahora desde el Calendario (botón "Editar categorías" junto
  a la leyenda) puedes añadir nuevas, cambiarles el color, o borrarlas. Se
  usan igual en Guiones y Vídeos.
- **Tareas repetitivas**: en `/tareas`, apartado "Tareas repetitivas" al
  final — creas una rutina (diaria, semanal en un día concreto, o mensual
  en un día del mes) y se genera sola cada vez que toca, sin que tengas que
  crearla a mano. Se apoya en el mismo aviso diario que ya tenías programado.

## Novedades de este ajuste (la más reciente)

- **Programar en Calendario, cuando tú decidas**: en `/videos` (y también
  dentro de cada guion), cuando un vídeo llega a la fase **Editado** o
  **Programado**, aparece el botón "Programar en Calendario". Eliges la
  fecha y ahí sí se crea la entrada — antes de esa fase, el botón no
  aparece, porque no tiene sentido programar algo que aún no está listo.
  Puedes quitarlo del Calendario cuando quieras sin borrar el vídeo.

## Novedades de este ajuste (la más reciente)

- **Vídeos desacoplado del Calendario**: un vídeo creado en Guiones (o
  suelto desde `/videos`) ya NO se crea como fila del Calendario — vive
  solo en su propia tabla. Si quieres que algo aparezca en el Calendario,
  lo añades allí aparte, a mano.
- **Añadir vídeos sueltos** desde `/videos`, sin necesidad de pasar por un
  guion (el desplegable "Guion" es opcional, puedes dejarlo en "Sin guion").
- ⚠️ Los vídeos que ya tenías creados (los que sí estaban como filas del
  Calendario) se migran solos a la tabla nueva la próxima vez que pegues el
  `schema.sql` — no se pierden, y no se duplican en tu racha/total del
  Dashboard (ya lo tuve en cuenta al hacer el cambio).

## Novedades de este ajuste (la más reciente)

- **Vídeos** (`/videos`): todos los vídeos de tus guiones en un solo sitio,
  como el pipeline de Contactos pero para producción — filtras por fase
  (Guion / Grabado / Editado / Programado), les añades notas, y al marcarlos
  "subido" desaparecen de la vista de trabajo. No se borran de verdad: siguen
  contando para tu racha y tus estadísticas del Dashboard, solo dejan de
  estorbar visualmente. Hay una pestaña "Subidos" para verlos si los buscas.
- **Canal** (`/canal`): un chat sencillo entre las dos cuentas para enlaces
  y avisos puntuales, sin depender de WhatsApp.
- **Tareas personales**: por defecto cada uno ve solo "Mis tareas" (las que
  tiene asignadas), con un botón para ver "Todas" si hace falta. El widget
  del Dashboard también es personal ahora — cada cuenta ve sus propias
  tareas pendientes y su propio % de cumplimiento, no las de la otra.

## Novedades de este ajuste (la más reciente)

- **Notificaciones push personales**: cada cuenta activa la suya desde
  Cuenta y Seguridad. Un aviso al día (sobre las 9:00) con las tareas
  pendientes de esa cuenta en los próximos 3-4 días — no solo las de hoy.
  Ana no ve tus avisos ni tú los suyos. Requiere un par de pasos de
  configuración en Vercel, ver la sección "Notificaciones push" más abajo.
- **Tareas con hora**: además de la fecha, ahora se les puede poner una hora
  concreta.
- **Guiones → Vídeos programados**: cada vídeo tiene ahora un estado de
  producción (Guion → Grabado → Editado → Programado), independiente de si
  ya está "subido" (eso se sigue marcando con el check, como publicar de
  verdad en redes).

## Novedades de este ajuste

- **Bug arreglado**: en Guiones, hacer clic en un guion ya creado no abría el
  editor (el botón "Nuevo guion" sí funcionaba, por eso solo parecía que se
  podía crear). Era un fallo en el componente de tarjeta que no dejaba pasar
  el clic. Ya está corregido en toda la web, no solo en Guiones.
- **Tareas**: el tic para marcarlas como hechas ahora es más claro (casilla
  más grande, se rellena de verde con un check al completarla).
- **Resumen semanal**: ahora tiene dos pestañas — Tareas (como antes) y
  Contenido, que muestra qué se subió y qué quedó pendiente del calendario
  esa semana.
- **Objetivos**: ahora se pueden editar (título, tipo, período, meta) con el
  lápiz, no solo borrar. Cuando se completan, se marcan con "Completado 🎉".
- **Guiones → Vídeos programados**: dentro de cada guion puedes añadir
  vídeos sueltos con su propia fecha — al ponerle fecha, aparece solo en el
  Calendario. Márcalo como subido desde ahí o desde el Calendario, es la
  misma ficha.
- **Descargar guion en PDF**: botón de descarga con cabecera de marca
  (logo + "Chris Fitness · Guion de contenido").
- **Contactos → Clientes activos automático**: al mover un contacto a la
  etapa "Cliente", se crea su ficha en Clientes activos sola (antes había
  que hacerlo a mano en los dos sitios).

## Novedades de este ajuste

- **Bug arreglado (importante)**: cuando marcabas un contacto como "Cliente"
  antes de que existiera el disparador automático, nunca se creaba su ficha
  en Clientes activos. Este `schema.sql` incluye un "backfill" que rescata
  a esos contactos ya existentes la próxima vez que lo pegues en Supabase.
- **Clientes activos**: ahora eliges duración (Mensual / 3 meses / 6 meses /
  Anual / Personalizada) y la fecha de renovación se calcula sola. Además
  hay un aviso arriba de la página cuando alguien renueva en ≤7 días.
- **Buscador en Contactos**: por nombre o @usuario, encima del formulario.
- **Móvil optimizado**: los formularios de Anuncios, Contactos y
  Recompensas/Referidos ya no obligan a hacer scroll horizontal — los
  campos se apilan verticalmente en pantallas pequeñas.
- **Objetivo "Clientes activos (total)"**: nuevo tipo de objetivo en el
  Dashboard para poner una meta de clientes activos en cartera (no solo
  ventas del mes) y ver el círculo subir según los vayas consiguiendo.

## Novedades de este ajuste

- **Bug arreglado**: en Guiones, "Guardar" no cerraba el editor, así que se
  quedaba "pillado" hasta salir a mano. Ya vuelve a la lista al guardar.
- **Plantillas de mensajes** (`/plantillas`): mensajes que copias y pegas
  (primer contacto, seguimiento, post-llamada), organizados por categoría,
  editables por los dos, con botón de copiar directo.
- **Equipo** (`/equipo`): comparativa de lo que ha hecho cada cuenta esta
  semana — tareas cumplidas/pendientes, contactos movidos, contenido
  subido, ventas cerradas. Las dos cuentas ven las dos columnas.

## Novedades de este ajuste

- **Racha de contenido en el Dashboard** 🔥: días seguidos subiendo algo del
  calendario, más un contador que suma sin reiniciarse nunca de todo lo
  subido en total. El color del icono cambia según la racha (cian → ámbar
  a partir de 3 días → verde a partir de 7).

## Novedades de este ajuste

- **Guiones con formato de verdad**: barra con botones de Título, Subtítulo,
  Negrita y Lista (en vez de un cuadro de texto plano), pestaña de "Vista
  previa" para verlo ya formateado, y contador de palabras. El PDF ahora
  respeta ese mismo formato (títulos y negrita reales, no asteriscos sueltos).
  Sintaxis: `# título`, `## subtítulo`, `**negrita**`, `- lista`.

## Novedades de este ajuste

- **Guiones: editor de texto enriquecido de verdad**: ya no se ven los
  símbolos `#`, `##`, `**` — seleccionas texto y le das a Título, Subtítulo,
  Negrita o Lista, y se aplica el formato ahí mismo mientras escribes, como
  en Google Docs. El PDF también refleja ese mismo formato real.
  Aviso: usa una función de edición nativa del navegador que en algún caso
  puntual del móvil puede comportarse un poco raro (cursor); si da guerra,
  se puede revertir a la versión anterior sin perder los guiones ya escritos.
  Los guiones antiguos (con `#`/`**` guardados como texto) se siguen
  mostrando bien, se convierten solos la primera vez que los abres.

## Cambio grande de esta versión: Contactos unificado

Antes había 5 secciones separadas (Leads, Conversaciones, Invitaciones,
Videollamadas, Ventas) donde tenías que anotar a la misma persona varias
veces según avanzaba. Ahora es **una sola ficha por persona** en
`/contactos`, con un desplegable de etapa:

**Frío → Contactado → Llamada agendada → Realizada → Cliente → Perdido**

Cuando mueves a alguien a "Cliente", aparecen los campos de programa e
importe, y esa venta se refleja sola en `/ventas` y en el Dashboard.

⚠️ Las tablas antiguas (leads, conversations, etc.) se quedan intactas en la
base de datos por si quieres rescatar algo a mano, pero la app ya no las usa.

## Resto de novedades

- **Anuncios con cálculo automático**: fecha de inicio + inversión diaria,
  el gasto acumulado se calcula solo. Botón de pausar para que deje de sumar.
- **Calendario**: ahora se puede editar una entrada ya creada, con notas, y
  tipos Reel Instagram / Historia Instagram / Video YouTube / TikTok. Vista
  de Día añadida además de Semana y Mes.
- **Tareas**: al completarlas se registra cuándo, para ver el cumplimiento
  semanal en `/resumen` (nueva página) con un círculo de % y el detalle de
  cumplidas/no cumplidas. También hay un widget de tareas en el Dashboard.
- **Objetivos personalizables** en el Dashboard: creas tus propios objetivos
  (ventas, facturación, inversión en ads, clientes nuevos, o manual).
- **Guiones** (`/guiones`): biblioteca organizada por categoría para
  escribir, leer y corregir guiones entre los dos.
- **Cuenta y Seguridad** (`/seguridad`): ahora incluye cambiar tu nombre y
  rol, además de la verificación en dos pasos.

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com → **New project** (elige región Europa).
2. Cuando esté listo, entra en **SQL Editor** → **New query**.
3. Pega todo el contenido de `supabase/schema.sql` y dale a **Run**.
   Esto crea las tablas, la seguridad por fila (RLS) y el disparador que
   crea automáticamente un perfil cuando invitas a alguien.
4. Ve a **Authentication → Providers** y asegúrate de que **Email** esté
   activado. En **Authentication → Settings**, desactiva "Allow new users to
   sign up" — así nadie puede crearse una cuenta salvo que tú la invites.

4. Ve a **Authentication → Settings** y comprueba que **Multi-Factor
   Authentication (TOTP)** esté activado (suele venir activado por defecto).
   Esto es lo que permite el paso 2 de "Seguridad" dentro de la app.

## 2. Crear las dos cuentas (tú y tu socia)

1. **Authentication → Users → Add user → Create new user**.
2. Crea tu cuenta con tu email y una contraseña segura.
3. Repite para tu socia, con su propio email y contraseña.
4. (Opcional) En **Authentication → Users**, edita cada usuario y en
   `raw_user_meta_data` añade algo así para que el nombre y el rol salgan
   bien en el panel desde el primer login:
   ```json
   { "display_name": "Chris", "role_title": "Entrenador" }
   ```
   Si no lo haces, el panel usará la parte del email antes de la @ y podrás
   cambiarlo luego desde la tabla `profiles` en Supabase.

Cada una entra con su propio email/contraseña, gestionado por Supabase
(cifrado real, no texto plano), y la sesión funciona desde cualquier
navegador u ordenador.

## 3. Conectar las claves

1. En Supabase: **Project Settings → API**.
2. Copia **Project URL** y **anon public key**.
3. Copia `.env.local.example` como `.env.local` y rellena:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

## 4. Probar en local (opcional)

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — te llevará a `/login`.

## 5. Desplegar en Vercel

1. Sube esta carpeta a un repo de GitHub.
2. En Vercel: **New Project** → importa el repo.
3. En **Environment Variables**, añade las mismas dos variables del paso 3.
4. Deploy. Cuando termine, tendrás tu URL (puedes ponerle un dominio propio,
   por ejemplo `panel.chrisfitness.online`, desde **Vercel → Domains**).

## 6. Notificaciones push (opcional pero recomendado)

Requiere 3 variables de entorno más en Vercel, además de las dos de Supabase:

1. **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`** y **`VAPID_PRIVATE_KEY`**: ya vienen
   generadas en `.env.local.example` — cópialas tal cual, no hace falta
   crear nada nuevo. (Si algún día quieres regenerarlas, es con el paquete
   `web-push`, pero no es necesario.)
2. **`CRON_SECRET`**: también viene un valor listo en `.env.local.example`,
   o invéntate el tuyo (cualquier texto largo). Protege el aviso diario para
   que solo Vercel pueda activarlo.
3. **`SUPABASE_SERVICE_ROLE_KEY`**: en Supabase → **Project Settings → API**
   → pestaña **"Publishable and secret API keys"** → sección **Secret keys**
   (la que empieza distinto a la publishable, a veces llamada `service_role`).
   ⚠️ Esta es la clave que nunca debe estar en el navegador — aquí solo la
   usa el servidor, es correcto y seguro.

Añade las 4 en Vercel → Environment Variables (Production, Preview y
Development) y vuelve a hacer **Redeploy**.

El archivo `vercel.json` ya incluye el aviso diario programado a las 7:00
UTC (~9:00 en España en horario de verano). Vercel lo activa solo al
desplegar — no hay que configurar nada más ahí. Si prefieres otra hora,
cambia `"0 7 * * *"` en `vercel.json` (formato cron: minuto hora * * *).

**Cómo lo usa cada uno:** desde el panel, en **Cuenta y Seguridad**, cada
cuenta pulsa "Activar notificaciones". Es individual — tú activas la tuya,
Ana la suya, y cada uno recibe solo sus propias tareas.

⚠️ En iPhone, las notificaciones push de una web solo funcionan si el panel
está instalado en la pantalla de inicio (ver "Instalar como app" más abajo)
y se abre desde ese icono, no desde Safari directamente.

## 7. Asistente de IA en Contactos (opcional)

1. Ve a **console.anthropic.com** → inicia sesión o crea una cuenta → **API
   Keys** → **Create Key**. Copia el valor (empieza por `sk-ant-...`).
2. En Vercel → Environment Variables, añade:
   - **`ANTHROPIC_API_KEY`**: pega la clave que acabas de crear. Márcala
     como "Sensitive" — esta sí es una clave que debe quedarse en el
     servidor, no lleva `NEXT_PUBLIC_`.
   - **`ANTHROPIC_MODEL`** (opcional): déjalo vacío para usar el modelo por
     defecto, o pon `claude-haiku-4-5-20251001` si prefieres respuestas más
     rápidas y baratas en vez de la calidad por defecto.
3. Redeploy.

**Coste:** es de pago por uso (no una suscripción), y para este tipo de
mensajes cortos el gasto es de céntimos por cada tanda de sugerencias — no
debería notarse en la factura salvo que lo uséis muchísimo. Puedes ver el
consumo real en console.anthropic.com → Usage.

**Cómo se usa:** en Contactos, dentro de cada ficha, el icono de estrellas
(✨) junto al de notas. Pegas lo que te ha escrito esa persona y te da 3
respuestas distintas, usando como contexto el nombre, la etapa, el origen y
las notas guardadas de esa ficha.

## 8. Google Calendar (opcional)

Más sencillo que lo de Meta Ads: para una app de uso interno con pocas
cuentas, Google no exige pasar por su proceso largo de verificación — basta
con dejarla en modo "Prueba" y añadir vuestros emails como usuarios de prueba.

1. Ve a **console.cloud.google.com** → crea un proyecto nuevo (o usa uno
   existente) → dale un nombre, ej. "Chris Fitness Panel".
2. Menú → **APIs y servicios** → **Biblioteca** → busca "Google Calendar
   API" → **Habilitar**.
3. Menú → **APIs y servicios** → **Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**
   - Nombre de la app, tu email de soporte, etc. (lo básico)
   - En **Público objetivo** / **Estado de publicación**, déjalo en
     **Prueba** (no lo publiques)
   - En **Usuarios de prueba**, añade tu email y el de Ana
4. Menú → **APIs y servicios** → **Credenciales** → **Crear credenciales**
   → **ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**
   - En **URIs de redireccionamiento autorizados**, añade:
     `https://TU-DOMINIO/api/google/callback` (con tu dominio real, ej.
     `https://panel.chrisfitness.online/api/google/callback`)
   - Copia el **ID de cliente** y el **Secreto del cliente**
5. En Vercel → Environment Variables, añade:
   - **`GOOGLE_CLIENT_ID`**: el ID de cliente
   - **`GOOGLE_CLIENT_SECRET`**: el secreto (márcala como "Sensitive")
   - **`NEXT_PUBLIC_APP_URL`**: la URL de tu panel ya desplegado, sin barra
     al final (ej. `https://panel.chrisfitness.online`)
6. Redeploy.

**Cómo se usa:** cada uno entra en Cuenta y Seguridad → Google Calendar →
"Conectar Google Calendar", autoriza una vez, y listo. A partir de ahí, todo
lo que se cree, edite o borre en el Calendario del panel se sincroniza solo
con su Google Calendar. Si los dos lo conectáis, lo que programa uno
aparece también en el Google del otro.

⚠️ Como está en modo "Prueba" (no publicada), Google puede pedir reautorizar
cada 7 días en algunos casos — si un día deja de sincronizar, solo hay que
volver a pulsar "Conectar" en Cuenta y Seguridad.

## Novedades de esta versión

- **Registro de actividad**: cada alta, edición o borrado en Leads, Ventas,
  Anuncios, Calendario, etc. queda anotado solo (vía triggers en la base de
  datos, así no depende de que ninguna pantalla "se acuerde" de registrarlo).
  Se ve en un feed en el propio Dashboard.
- **ROI y coste por lead/venta**: calculado solo cada mes a partir de tu
  inversión en anuncios y tus ventas — coste por lead, coste por venta, y
  ROI de anuncios en %.
- **Resumen semanal en pantalla**: comparación de los últimos 7 días contra
  los 7 anteriores (leads, conversaciones, videollamadas, ventas, ingresos,
  inversión en ads), sin envíos por email.
- **Instalable como app (PWA)**: desde el móvil, "Añadir a pantalla de
  inicio" (Safari/Chrome) y os queda un icono como una app normal, a
  pantalla completa.
- **Verificación en dos pasos, opcional**: cada cuenta puede activar la suya
  desde `/seguridad` (código de una app autenticadora tipo Google
  Authenticator o Authy). No es obligatoria ni afecta a la otra cuenta —
  cada uno decide si la quiere.

## Instalar como app en el móvil

1. Abre la web desplegada desde Safari (iPhone) o Chrome (Android).
2. Safari: botón compartir → "Añadir a pantalla de inicio".
   Chrome: menú (⋮) → "Instalar app" o "Añadir a pantalla de inicio".
3. Os queda un icono de "Chris Fitness" que abre el panel a pantalla
   completa, sin barra de navegador.

## Cómo está organizado

- `app/(app)/` — todas las páginas protegidas (dashboard, calendario, leads,
  ventas, etc.). Si no hay sesión, `middleware.js` redirige a `/login`.
- `lib/config.js` — aquí están definidas las columnas de cada sección
  (Leads, Ventas, Anuncios...). Si algún día quieres añadir un campo nuevo a
  una tabla, se hace aquí + una columna nueva en Supabase.
- `components/CrmSection.jsx` — la tabla genérica que usan Leads,
  Conversaciones, Invitaciones, Videollamadas, Ventas, Anuncios y Referidos.
  Cada fila muestra un badge con las iniciales de quién la creó (tú o tu
  socia), y todo se sincroniza en tiempo real entre las dos cuentas.
- `supabase/schema.sql` — estructura completa de la base de datos.

## Seguridad

- Las contraseñas las gestiona Supabase Auth (hash seguro, no texto plano).
- No hay registro público: solo entra quien tú invites desde Supabase.
- Row Level Security está activado en todas las tablas: solo cuentas
  autenticadas (las dos vuestras) pueden leer o escribir datos.
- Aun así, esto es una app de dos usuarios de confianza, no un sistema
  bancario — no guardéis contraseñas de otras webs en "Datos importantes".

## Añadir más gente en el futuro

Si algún día quieres dar acceso a alguien más (por ejemplo un ayudante),
solo tienes que invitarlo desde **Authentication → Users** en Supabase; el
perfil se crea solo.
