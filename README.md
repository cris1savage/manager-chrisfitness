# Chris Fitness · Panel de Control

App real (Next.js + Supabase) con login seguro, datos guardados en base de
datos, y acceso desde cualquier ordenador para ti y tu socia. Mismo stack que
ya usas en `chrisfitness.online/comunidad`, así que el flujo de despliegue te
sonará.

## Cinco mejoras: confirmaciones, nuevo cliente, Ventas por mes, y bajas

- **Confirmación antes de borrar** en Clientes activos y Contactos —
  ahora avisa de que también se pierde el historial de precios/Facturación
  o del AI Closer, según el caso, antes de borrar de verdad.
- **"NUEVO CLIENTE"**: cuando alguien pasa a ser cliente, su tarjeta en
  Clientes activos sale destacada (borde verde con brillo) durante los
  primeros 7 días.
- **Ventas, ahora por mes**: navegador de mes igual que en otras partes
  del panel, para ver las ventas y lo facturado mes a mes, no todo junto.
- **Bajas, por fin visibles**: tenías razón, no existía nada para verlas.
  Ahora Historial cuenta cuántos clientes se dieron de baja cada mes
  (usando la fecha real de cuándo cambiaron a "Finalizado").
- **Historial**: comparación destacada "este mes vs. el anterior"
  (facturación, clientes nuevos, bajas) arriba del todo, y aparte, una
  **proyección plegable** de cuánto podrías facturar según tu inversión en
  ads y tu ratio histórico — claramente marcada como estimación, no
  garantía.

## Cortes de respuesta arreglados en todas las IA, no solo en el AI Closer

- **AI Closer**: se volvió a cortar (esta vez porque el historial completo
  hace que la respuesta sea más larga) — subido el límite bastante más.
- **Revisadas las otras dos rutas de IA por el mismo motivo**, antes de
  que te dieran el mismo problema: "Analizar anuncios" tenía el límite más
  bajo de las tres, y "Organizar semana" también se subió con margen extra.
- **Límite al historial que ve la IA**: con meses de uso, el historial de
  un lead podría crecer sin parar y volver a causar cortes — ahora se
  queda con las 30 entradas más recientes como máximo, avisando cuántas
  se quedaron fuera si las hay.

## Repaso completo del panel de seguridad de Supabase

- **Rendimiento de políticas** (`Auth RLS Initialization Plan`): en varias
  tablas (perfiles, notificaciones push, Google Calendar, y las tres de
  Facturación) el chequeo de usuario se recalculaba por cada fila en vez
  de una vez por consulta. Corregido en todas.
- **Funciones sin restricción de llamada directa**: a las tres funciones
  internas (`handle_new_user`, `log_activity`, `contact_became_client`)
  les quité el permiso de invocarse a mano — solo se disparan como
  disparadores automáticos, que es para lo que existen.
- **Lo que NO hace falta tocar**: los avisos de "RLS Policy Always True"
  en Contactos, Guiones, Tareas, etc. son intencionales — es la parte
  compartida de la app entre las dos cuentas, a propósito.
- **Lo único pendiente de ti**: activar "Leaked Password Protection" en
  Supabase → Authentication → Policies — es un interruptor, no código.

## Aviso de seguridad de Supabase, tapado

- Supabase te avisó (bien) de que las dos tablas-marcador que usé para la
  limpieza de Facturación (`_billing_events_reset_done` y su v2) no tenían
  activada la protección por filas — riesgo real prácticamente nulo (no
  guardan ningún dato, solo un "ya se hizo: sí/no"), pero se corrige igual.
  Pega el `schema.sql` una vez más y el aviso debería desaparecer del
  panel de seguridad de Supabase.

## Corrección al arranque limpio: cada uno en su mes real, no todos en agosto

- El arranque limpio de ayer tenía un fallo: le puso la fecha de **hoy** a
  todo el mundo, sin mirar cuándo le toca renovar de verdad a cada uno —
  por eso Alberto (renueva 21/09) o Urko (renueva 30/09) aparecían como
  "cobrados" en agosto, sin tocarles todavía.
- Corregido: ahora cada cliente arranca con su fecha de renovación real
  menos un ciclo (su duración) — que es cuándo pagó la última vez de
  verdad. Alberto debería aparecer en junio, no en agosto; Urko en marzo,
  no en agosto.
- Otra vez protegido para que pase una sola vez — pega el `schema.sql`
  y revisa Facturación → Mensual y Anual, cada uno debería salir en su mes
  correcto ahora.

## Facturación: limpieza total de los duplicados (esta vez de verdad)

- La barrera anterior solo bloqueaba coincidencias EXACTAS de fecha, pero
  el lío real generó fechas distintas muy próximas entre sí (un cliente
  mensual con dos cobros a solo días de diferencia) — por eso seguías
  viendo dobles.
- Esta vez: se borra el registro de cobros entero y se pone un único punto
  de partida limpio, hoy, para cada cliente activo que ya tiene precio
  puesto. A partir de ahí se acumula bien, sin arrastrar el lío de antes.
- **Protegido para que esto pase una sola vez** — aunque vuelvas a pegar
  este `schema.sql` en el futuro por otra cosa, no te vuelve a borrar nada.
- Después de pegarlo, entra a Facturación → Mensual y Anual: verás menos
  historial que antes (arranca limpio desde hoy), pero sin dobles.

## AI Closer: historial real por lead + preparación de llamada

- **Tres pestañas dentro del AI Closer de cada lead**: Analizar / Historial
  / Preparar llamada — ya no está todo amontonado en una sola pantalla.
- **Historial real, no un solo bloque de texto**: cada vez que analizas
  una conversación, queda como su propia entrada con fecha y quién la
  guardó — nunca se pisa lo anterior. Puedes ver toda la evolución del
  lead de un vistazo.
- **Tus propias notas, ahora con sitio propio**: en la pestaña Historial
  hay un cuadro para apuntar "qué hiciste, qué decidiste" (ej. "le
  llamé, quedamos en que lo piensa hasta el viernes") — queda guardado
  igual que las conversaciones, mezclado en el orden real en que pasó.
- **Análisis menos genérico**: cada vez que analizas o le preguntas "¿Qué
  harías tú?", la IA ve TODO el historial de ese lead (conversaciones +
  tus notas), no solo el fragmento de hoy — así puede señalar patrones
  reales (una objeción que repite, algo que ya le prometiste) en vez de
  darte un consejo que valdría para cualquiera.
- **Preparar llamada**: pestaña nueva — un botón que te da un resumen del
  lead, ángulos a tratar, puntos a mencionar, objeciones esperables, qué
  evitar, y hasta una frase para arrancar la llamada — todo basado en el
  historial real, se destaca especialmente cuando el lead está en
  "Llamada agendada".

## Cobros duplicados: limpiados y bloqueados para siempre

- **Qué pasó**: al pasar del cálculo viejo (días fijos) al nuevo (meses de
  calendario), el aviso corrió con las dos versiones de código en
  distintos momentos, y cada pasada anotó su propio cobro para el mismo
  ciclo — de ahí los importes duplicados que viste en Mensual y Anual.
- **Arreglado en dos partes**:
  1. Al pegar el `schema.sql`, se limpian automáticamente (una sola vez)
     los duplicados que ya existen — se queda solo uno de cada grupo
     idéntico (mismo cliente, misma fecha, mismo importe).
  2. Se añade una barrera permanente en la base de datos: un cliente no
     puede tener dos cobros anotados el mismo día, nunca más, pase lo que
     pase (aunque el aviso corra dos veces por error). El código también
     se cambió para "anotar o ignorar si ya existe" en vez de anotar
     siempre a ciegas.
- Después de pegar el `schema.sql`, entra a Facturación → Mensual y Anual
  y confirma que los números ya cuadran.

## Cálculo de renovación por meses de calendario reales (no días fijos)

- **Bug de raíz corregido**: usaba días fijos (30/90/180/365) como
  aproximación de "1/3/6/12 meses", y eso se iba desviando del día real
  con el tiempo — un cliente que paga el 20/1 con "3 meses" podía acabar
  renovando el 18/4 o el 22/4 en vez del 20/4 exacto. Ahora se calcula con
  meses de calendario de verdad: el mismo día, cada vez, para siempre
  (con el ajuste correcto para meses cortos, ej. 31 de enero + 1 mes → 28
  o 29 de febrero). Corregido en el formulario, en la edición manual, en
  el aviso diario y en el cálculo de facturación.
- **Quitado el cartel de "Renovaciones próximas"** en Clientes activos —
  ya no hace falta, las renovaciones son automáticas de verdad. Se queda
  solo el borde de color en cada tarjeta (rojo si vencida, ámbar si está
  cerca) como aviso discreto, sin el cartel grande ni el botón manual.

## Facturación reorganizada en pestañas — cálculo real, no repartido

- **Tres pestañas, como en Contactos** — Clientes / Mensual / Anual, en
  vez de todo amontonado en una sola pantalla:
  - **Clientes**: solo eso — la lista con el precio y la etiqueta de cada
    cliente. Nada más.
  - **Mensual**: navegas mes a mes, y ves lo que facturaste **de verdad**
    ese mes en concreto, agrupado por duración (mensual/3 meses/6
    meses/anual) — si un cliente es semestral, solo aparece en el mes
    exacto en que le tocó pagar, con el importe completo, no repartido en
    6 partes.
  - **Anual**: navegas año a año, ves los 12 meses uno al lado del otro
    (para comparar cuáles fueron mejores o peores), el total del año, y un
    gráfico de línea con la evolución.
- **Nuevo registro real de cobros** (`billing_events`): cada vez que un
  cliente completa un ciclo de pago (al auto-renovarse, o al ponerle el
  precio por primera vez), queda anotada esa fecha y ese importe — es lo
  que alimenta Mensual y Anual. Solo tú lo ves, igual que el resto de
  Facturación.
- **Corregido**: el botón "Renovar vencidas ahora" ahora usa la clave de
  servicio por dentro, para que el cobro quede bien anotado lo pulse quien
  lo pulse (tú o Ana), sin toparse con el bloqueo de Facturación.
- **Aviso importante**: como esto es un registro nuevo, no hay datos de
  meses anteriores a hoy — se va a ir rellenando solo a partir de ahora,
  cada vez que un cliente renueve de verdad o le pongas precio por primera
  vez.

## Botón para renovar vencidas ahora mismo

- **"Renovar vencidas ahora"** en Clientes activos, dentro del aviso de
  Renovaciones próximas — hace de inmediato lo mismo que el aviso diario
  hace solo una vez al día. Útil hoy porque tienes clientes vencidos desde
  hace tiempo (de antes de que existiera la renovación automática) y no
  hace falta esperar a mañana para que se pongan al día. A partir de ahora,
  el aviso diario los mantiene renovados solo, y este botón queda ahí por
  si algún día quieres forzarlo tú.

## Clientes activos, compartida de nuevo — Facturación sigue solo tuya

- **Ana vuelve a ver Clientes activos** (nombres, programas, fechas,
  renovaciones) — el precio nunca vivió ahí, siempre estuvo en una tabla
  aparte (`client_billing`), así que devolver el acceso a esta página no
  filtra ningún dato de dinero. Su Dashboard también recupera el contador
  de clientes activos y las renovaciones próximas.
- **Facturación no se ha tocado — sigue 100% solo tuya**, con sus tres
  capas de protección intactas (regla en la base de datos, comprobación en
  el servidor, y escondida del menú para quien no sea el propietario).

## Renovación automática + Facturación más pulida

- **Clientes activos se renueva solo**: antes, si pasaba la fecha de
  renovación, se quedaba "vencida" para siempre hasta tocarlo a mano. Ahora
  el aviso diario la va empujando sola, ciclo tras ciclo (mensual/3
  meses/6 meses/anual), hasta que tú pauses o finalices a ese cliente —
  nunca más se queda pillada. Si llevaba tiempo sin mirarlo y se pasaron
  varios ciclos, se pone al día de golpe.
- **Facturación, aviso visual en Clientes activos también**: el mismo
  candado amarillo "Solo tú ves esta página" que ya tenías en Facturación.
- **Números de arriba más "pro"**: los 4 datos clave ahora llevan icono y
  color distinto cada uno (verde, cian, morado, ámbar), igual que el resto
  del panel — menos "letras blancas sueltas", más panel de verdad.
- **Historial mensual/anual, plegado**: ya no se ve de primeras — es un
  desplegable con su propio icono, le das clic cuando quieras verlo. Menos
  agobio al entrar a la página.

## Facturación completa: historial, prorrateo, y un fallo crítico corregido a tiempo

- **⚠️ Fallo grave encontrado y arreglado antes de que llegara a producción**:
  al construir el bloqueo de Facturación, la regla que permite a cada uno
  editar su propio perfil no tenía ninguna restricción sobre qué campos
  podía tocar — así que, tal como iba a quedar, **Ana habría podido
  marcarse a sí misma como propietaria** con una simple actualización
  desde su propia cuenta, dejando inútil toda la protección. Lo detecté
  en la revisión de seguridad que me pediste y lo corregí: ahora esa
  columna (`is_owner`) solo se puede cambiar desde fuera de la app (tú, a
  mano, en Supabase), nunca por la propia cuenta.
- **Clientes activos ahora también es solo tuyo** — nombres, precios, todo.
  Ana deja de ver esa página y sus totales en el Dashboard (contador de
  clientes activos y renovaciones próximas), tal como confirmaste.
- **Prorrateo automático por duración**: si un cliente paga trimestral,
  pones lo que paga cada 3 meses y el equivalente mensual se calcula solo
  (÷3) — usa la misma duración que ya seleccionabas en Clientes activos,
  no hay que repetir el dato.
- **Historial de facturación real** dentro de la propia página de
  Facturación — gráfico y lista mes a mes de lo que facturas de verdad
  (no lo que anotas al cerrar una venta, sino la recurrencia real
  prorrateada). Se rellena solo, día a día, desde ahora — no hay datos de
  antes porque el precio por cliente es información nueva.
- Repetida la revisión de seguridad completa que ya hicimos antes: sin
  claves reales filtradas en el código, sin componentes de navegador
  tocando variables privadas del servidor, `.env.local.example` con solo
  placeholders.

## Facturación privada (solo tú)

- **Nueva página `/facturacion`** — facturación mensual real, ticket medio
  real, proyección anual, quién paga qué (con tu propia etiqueta libre,
  ej. "Precio antiguo"), y altas/bajas de los últimos meses. Editas el
  precio y la etiqueta de cada cliente activo directamente ahí.
- **Protegida de verdad, en tres capas — no solo escondida en el menú**:
  1. La tabla donde vive el precio (`client_billing`) tiene una regla en la
     base de datos que dice "solo visible si la cuenta está marcada como
     propietaria" — es la barrera real, la que importa de verdad.
  2. La propia página comprueba en el servidor que eres el propietario
     antes de mostrar nada, y si no lo eres, te redirige.
  3. El enlace en el menú ni siquiera aparece si no eres el propietario.
- **⚠️ Paso obligatorio, solo tú lo puedes hacer**: en Supabase → SQL
  Editor, ejecuta esto UNA VEZ, cambiando el email por el que usas para
  entrar al panel:
  ```sql
  update public.profiles set is_owner = true
  where id = (select id from auth.users where email = 'tu-email@ejemplo.com');
  ```
  Sin este paso, la página de Facturación no se le mostrará a nadie —
  ni siquiera a ti — porque por defecto nadie es propietario.
- Nota honesta: esta página muestra la **facturación recurrente real**
  (lo que cada cliente paga cada mes, dato que antes no existía en
  ningún sitio). Es distinta del "Ingresos" que ya veías en Dashboard e
  Historial, que se calcula a partir del valor puntual que anotas cuando
  alguien pasa a Cliente en Contactos — ese sigue siendo compartido con
  Ana, y no lo he tocado.

## Lead score visible en la propia lista

- **Badge de puntuación junto al nombre**: en cuanto has analizado a
  alguien con el AI Closer y le has dado a "Guardar en la ficha", su
  puntuación aparece directamente en la tarjeta de Contactos (ej. "58%"),
  coloreada igual que dentro del AI Closer — rojo/🔥 para los más
  calientes, ámbar, cian, gris para los fríos. También se ve el estado
  del lead (ej. "Problema identificado") junto al origen. Así ves de un
  vistazo quién está más avanzado sin tener que abrir cada ficha.

## Bug real arreglado: las capturas no quedaban guardadas

- **Confirmado**: cada análisis del AI Closer va atado al contacto exacto,
  nunca se mezclan entre fichas — añadida una pequeña red de seguridad
  extra en el código, de todas formas.
- **Bug encontrado y arreglado**: cuando subías una captura en vez de
  escribir, la IA la analizaba bien, pero al "Guardar en la ficha" solo
  quedaba lo que habías escrito a mano — lo de la imagen se perdía para la
  próxima vez. Ahora la propia IA transcribe lo que lee en la captura, y
  eso es lo que se guarda en el historial — funciona igual venga de texto
  o de una foto.

## AI Closer ahora en ventana flotante

- **El AI Closer ya no empuja la tarjeta del contacto hacia abajo** — se
  abre en una ventana flotante aparte, con espacio de sobra, sin que la
  lista de Contactos se vea agobiada con todo mezclado. "Lead nuevo con
  IA" también se abre igual, para que sea consistente. Nada de
  funcionalidad cambió, solo dónde vive visualmente.

## AI Closer: seguir sin repetir todo, y capturas de pantalla

- **Ya no hace falta repegar toda la conversación**: si un lead ya tiene
  conversación guardada, aparece plegada arriba ("Conversación guardada de
  esta ficha") y el cuadro de abajo es solo para los mensajes nuevos desde
  la última vez. Al analizar, la IA ve todo el contexto igual que antes;
  al guardar, se une todo junto para la próxima vez.
- **Adjuntar captura de pantalla**: en vez de escribir o copiar/pegar,
  puedes subir directamente una foto de la conversación de Instagram — la
  IA la lee igual. Funciona tanto en el AI Closer de cada ficha como en
  "Lead nuevo con IA".

## Tres arreglos de esta vez

- **Panel centrado en pantallas anchas**: en monitores grandes, el
  contenido se veía pegado a la izquierda con un hueco negro enorme a la
  derecha — faltaba centrarlo dentro del espacio libre junto al menú. Ya
  se ve centrado, tanto en ordenador como en móvil.
- **Editor de Guiones más cómodo**: letra más grande, más espacio entre
  líneas y párrafos, más aire alrededor del texto — se escribe más como
  en un documento de verdad, no como en un bloc de notas.
- **Bug real arreglado en el PDF**: los títulos largos se cortaban en el
  borde de la página en vez de bajar de línea — el texto normal ya lo
  hacía bien, pero los títulos (incluido el de arriba del todo) usaban
  otro código que no envolvía línea. Ahora todos wrappean igual.

## Lead nuevo directo desde la IA

- **"Lead nuevo con IA"** (botón arriba de Contactos): para cuando te
  escribe alguien que todavía no está en tu CRM. Pones el nombre, pegas la
  conversación, analizas, y con "Crear ficha de contacto" se crea ya con
  todo el análisis dentro — no hace falta darlo de alta a mano primero y
  luego volver a abrir el AI Closer. Sigue pidiéndote el nombre (eso no me
  lo invento, tiene que decirlo alguien), pero es un solo paso en vez de dos.

## Ajustes al AI Closer (confirmaciones + robustez)

- **Confirmado**: cada lead tiene su propia ficha aislada — nada se
  mezcla entre contactos. Ahora además, la conversación que pegas se
  guarda dentro de esa misma ficha (no solo el análisis) al pulsar
  "Guardar en la ficha", así la próxima vez que abras a ese lead la
  encuentras ya puesta, lista para editar o actualizar.
- **Límite de respuesta subido bastante** (a 4096, con margen de sobra) —
  el mismo tipo de corte que ya tuvimos en Analizar anuncios y Organizar
  semana, corregido aquí también antes de que diera el mismo problema.
- Revisado con lupa: sin fallos al blindar la pantalla si algún campo
  viniera vacío, y probado con una compilación de producción real de
  las 31 páginas, sin errores.

## Novedades de este ajuste (la más reciente) — AI Closer (MVP)

- **AI Closer**: en Contactos, el icono de estrellas de cada ficha ahora es
  mucho más completo. Pegas la conversación de Instagram y te da: estado
  del lead, lead score (0-100) con motivo, si está listo para cierre o no
  (y por qué), objetivo/problema/situación/objeciones detectados, próximo
  paso, y 3 respuestas sugeridas con el porqué de cada una. Botón "Guardar
  en la ficha" para que quede guardado en ese contacto (nunca automático),
  y si sugiere cambiar de etapa, un botón para aplicarlo con un clic.
- **Botón "¿Qué harías tú?"**: modo coach — te explica qué está pensando
  el lead, qué no deberías hacer, y cuál sería tu siguiente paso, en vez
  de solo darte un mensaje para copiar.
- **Esto es el MVP, sin conexión directa con Instagram** (tal y como
  acordamos): pegas tú la conversación a mano. La integración real con la
  API de Instagram sería una fase futura, más grande, y solo tendría
  sentido si este MVP demuestra que el análisis te aporta de verdad.

## Novedades de este ajuste (la más reciente)

- **"Organiza mi semana" ahora es una conversación de verdad**: si le falta
  algo importante para organizarte bien, te pregunta (máximo 1-2 veces) y
  le contestas ahí mismo, como un chat, antes de que te dé la propuesta
  final. Si ya tiene información suficiente, no pregunta nada — va directa
  a la propuesta, igual que antes.

## Novedades de este ajuste (la más reciente)

- **Tareas con hora también sincronizan con Google Calendar**: se me
  quedó pendiente al construir la vista Semana — ahora sí, cualquier tarea
  con hora puesta (a mano o propuesta por la IA) se crea como evento con
  hora real en tu Google Calendar, no de todo el día. A diferencia del
  Calendario de contenido (que se sincroniza a las dos cuentas), las
  tareas son personales: cada una solo va al Google de la cuenta a la que
  está asignada.
- **Bug arreglado en "Organiza mi semana con IA"**: la respuesta se
  cortaba a media respuesta con peticiones largas. Igual que ya arreglamos
  en "Analizar anuncios" — subido el límite y añadido un rescate por si la
  IA responde con texto extra alrededor del JSON.

## Novedades de este ajuste (la más reciente)

- **Organiza tu semana con IA** (en Tareas → pestaña "Semana"): escribes en
  lenguaje normal lo que necesitas hacer ("grabar 3 reels, llamar a los
  leads fríos, hacer la compra...") y la IA te propone día y hora para cada
  cosa, evitando lo que ya tienes ocupado esa semana. Revisas y ajustas
  antes de confirmar — no se crea nada sin que lo veas primero.
- **Vista semanal por horas**: las tareas con hora puesta se ven como
  bloques en una cuadrícula (6:00 a 23:59), igual que un Google Calendar.
  Las tareas sin hora se ven aparte, arriba de cada día.

## Novedades de este ajuste (la más reciente) — revisión de seguridad

- **Next.js actualizado**: de 14.2.15 a **14.2.35** (la última versión
  parcheada dentro de tu misma rama). Cubre varios fallos conocidos hasta
  diciembre 2025. Probado con una compilación de producción real antes de
  dártelo, no solo revisión de sintaxis.
  - Nota honesta: hay un lote de vulnerabilidades más reciente (julio 2026)
    que Vercel ya no está parcheando en la rama 14.x, solo en la 15.x/16.x.
    Pasar a Next 15 es un salto de versión mayor con algunos cambios de
    código a revisar — no lo he hecho hoy porque merece su propia sesión
    con más pruebas, pero es la mejora pendiente más importante a medio
    plazo. La vulnerabilidad más grave de tu versión actual (bypass de
    autenticación en middleware, CVE-2025-29927) ya está mitigada
    automáticamente por estar desplegado en Vercel.
- **⚠️ Claves rotadas**: `.env.local.example` tenía valores REALES de
  `VAPID_PRIVATE_KEY` y `CRON_SECRET` en vez de texto de relleno — un fallo
  mío de cuando lo generé. Como ese archivo se sube a GitHub, esas claves
  deben darse por expuestas. Te generé unas nuevas (te las pasé en el
  chat) — tienes que actualizarlas en Vercel y volver a desplegar. El
  archivo de ejemplo ya solo tiene placeholders, nunca más valores reales.
- **Fallo corregido en el login de Google Calendar**: el callback confiaba
  en el parámetro `state` sin comprobar que la sesión que completaba el
  proceso fuera realmente esa misma cuenta. Riesgo bajo en la práctica (los
  IDs de usuario son UUID prácticamente imposibles de adivinar), pero
  corregido para no depender solo de eso.
- **Revisado y todo correcto**: ninguna clave real filtrada en el código,
  ningún componente de navegador toca variables privadas del servidor,
  cada ruta del servidor comprueba usuario o clave secreta antes de hacer
  nada, las tablas de tokens (Google, notificaciones) están bloqueadas por
  fila — ni Ana puede leer tus tokens aunque quisiera —, `.env.local` (tus
  claves reales) nunca se sube a GitHub, y el único uso de HTML "crudo" en
  toda la app es el código QR del 2FA, que viene de Supabase, no de nada
  que nadie escriba.

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
