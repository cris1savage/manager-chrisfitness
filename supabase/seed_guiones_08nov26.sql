-- ---------------------------------------------------------------------------
-- CARGA DE GUIONES · "GUIONES 08NOV26" (28 reels)
--
-- Crea cada guion en Guiones (con su texto) y su vídeo en Vídeos, enlazados,
-- con el reel de referencia. Fase según el color del PDF:
--   azul    → 'Grabado'  (columna "Por editar")
--   naranja → 'Guion'    (columna "Recámara", sin grabar)
--   verde   → 'Grabado'  (nº 2; color sin definir, revisar)
--
-- Requiere antes la columna videos.reference_url (sección "PRODUCCIÓN DE
-- VÍDEOS" al final de schema.sql). Se puede ejecutar varias veces: si un
-- guion con el mismo título ya existe, no se vuelve a crear.
-- ---------------------------------------------------------------------------
with data(n, title, stage, ref, content) as (values
  (1, 'El error de muñeca en press', 'Grabado', 'https://www.instagram.com/p/DRAfarREmtN/',
   $c$<p>Este error en press banca te está robando kilos y te va a destrozar la muñeca.</p><p>Barra en los dedos, muñeca doblada hacia atrás (mal).<br>Rota la mano hacia dentro al agarrar para que la barra caiga en la base de la palma, encima del antebrazo (bien). Repite las dos versiones en cámara.</p><p>Guárdalo y pruébalo en tu próxima sesión de pecho.</p>$c$),
  (2, '5 errores en la prensa', 'Grabado', 'https://www.instagram.com/p/DdjU3KAhg4e/',
   $c$<p>5 errores en prensa que haces seguro.</p><p>1) Despegar el glúteo abajo<br>2) Bloquear rodillas arriba<br>3) Rodillas hacia dentro<br>4) Recorrido a medias por meter más peso<br>5) Talones levantados</p><p>¿Quieres entrenar conmigo? Comenta PLAN</p>$c$),
  (3, 'La trayectoria de la barra en banca', 'Grabado', 'https://www.instagram.com/p/DZC--MLM8_T/',
   $c$<p>La barra NO baja en línea recta.</p><p>Bajar y subir vertical carga el hombro. La barra baja en ligera curva a la parte media-baja del pecho y sube en curva hacia encima de los hombros. Dibuja la J en pantalla.</p><p>¿Lo hacías bien? Dime en comentarios.</p>$c$),
  (4, 'No sientes la espalda en remo en polea', 'Grabado', 'https://www.instagram.com/p/De9_W1tqKeJ/',
   $c$<p>Si haces remo y no sientes la espalda, mira esto.</p><p>Error 1: te impulsas con el cuerpo para mover más peso.<br>Error 2: tiras con los bíceps.<br>Solución: torso quieto, codos hacia atrás y pegados, junta escápulas un segundo.</p><p>Pruébalo y me cuentas.</p>$c$),
  (5, 'Llevas meses con el mismo peso', 'Grabado', 'https://www.instagram.com/p/DfDIYToKRVQ/',
   $c$<p>Si llevas meses levantando lo mismo, estás estancado.<br>Explica la sobrecarga progresiva con un ejemplo: 3x8 con 60 kg; cuando sacas 3x12, subes a 62,5 kg y vuelves a 8.</p><p>Enseña tu libreta o la app.</p><p>Comenta RUTINA y te explico cómo aplicarlo.</p>$c$),
  (6, '¿Cuánto entrenar cada músculo?', 'Grabado', 'https://www.instagram.com/p/DQuepDyki32/',
   $c$<p>Entrenar cada músculo una vez por semana es perder el tiempo.</p><p>Frecuencia 2 da mejores resultados que el típico día de pecho, día de espalda… para el mismo volumen semanal. Pon un ejemplo de torso-pierna.</p><p>¿Tú qué rutina haces?</p>$c$),
  (7, '100 abdominales no te quitan la barriga', 'Guion', 'https://www.instagram.com/p/DTwJCQwkUiy/',
   $c$<p>No vas a quitarte la barriga haciendo 100 abdominales.</p><p>La grasa abdominal se pierde con déficit calórico y movimiento diario. Calcula tus calorías, réstale 300-500 y suma 8.000-10.000 pasos al día.</p><p>Comenta GRASA y te ayudo con tu caso.</p>$c$),
  (8, 'No puedes quemar grasa de una zona', 'Grabado', 'https://www.instagram.com/p/Dbq438IqafB/',
   $c$<p>Perder grasa de una zona concreta no es posible.</p><p>Entonces, ¿cómo hay gente que la pierde justo en las zonas difíciles?</p><p>Porque saben lo que funciona: déficit sostenido, fuerza y paciencia, porque esa grasa es la última en irse.</p><p>Escribe GRASA y te mando el vídeo completo.</p>$c$),
  (9, 'Para hacer un déficit calórico', 'Guion', 'https://www.instagram.com/p/DWJm4fqD0Hr/',
   $c$<p>Para hacer un déficit calórico NO tienes que…</p><p>Dejar de comer carbohidratos por completo<br>Cenar solo ensaladas<br>Hacer cardio en ayunas</p><p>¿Cuál te creías tú?</p>$c$),
  (10, 'Sigue al plan, no a tu estado de ánimo', 'Guion', 'https://www.instagram.com/p/DRK67QnDFoE/',
   $c$<p>Síguete al plan, no a tu estado de ánimo.</p><p>Hay días que no te apetece. Da igual. El plan no pregunta cómo te sientes. Los que cambian su físico no son los más motivados, son los que vienen igual.</p><p>Mándaselo a quien hoy no quería venir.</p>$c$),
  (11, 'Nunca lo olvides', 'Guion', 'https://www.instagram.com/p/DSzmXIwDKRL/',
   $c$<p>Texto en pantalla sobre plano entrenando solo: Nadie va a venir a salvarte. Ni tu jefe, ni tu pareja, ni la motivación. Solo tú.</p><p>Con música triste o lenta.</p>$c$),
  (12, 'Lengua al fallo', 'Guion', 'https://www.instagram.com/p/DX8Znerullo/',
   $c$<p>Las caras que pones en la última rep, a cámara lenta, con canción pop de fondo. Plano cerrado a la cara.</p>$c$),
  (13, 'Todo es alto en proteína', 'Guion', 'https://www.instagram.com/p/Dak_rqLoHJh/',
   $c$<p>Ref: fit.ismael · 41,2 mil me gusta · público como el tuyo.</p><p>Propuesta: sketch en el súper o la cocina: «Galletas altas en proteína», «pizza alta en proteína», «cerveza alta en proteína»… cada vez más exagerado. Remate: «O te comes unos huevos y ya.»</p>$c$),
  (14, 'Tienes que evitar entrar en el bucle del culturista', 'Guion', 'https://www.instagram.com/p/DfX9S_6j0Hj/',
   $c$<p>(Sin guion todavía: ver el reel de referencia.)</p>$c$),
  (15, 'Te cuesta respirar en el remo T', 'Grabado', 'https://www.instagram.com/p/DfFCEhMNS-C/',
   $c$<p>(Sin guion escrito: ver el reel de referencia.)</p>$c$),
  (16, 'Tríceps con cuerda', 'Grabado', 'https://www.instagram.com/p/DTDqHlkiFS2/',
   $c$<p>(Sin guion escrito: ver el reel de referencia.)</p>$c$),
  (17, 'Sentadilla: dónde colocar la barra', 'Guion', null,
   $c$<p>(Sin guion ni referencia todavía.)</p>$c$),
  (18, 'Elevaciones laterales con maneral de remo neutro', 'Grabado', null,
   $c$<p>(Sin guion ni referencia escritos.)</p>$c$),
  (19, 'Descansos largos vs descansos cortos', 'Guion', 'https://www.instagram.com/p/DRBDHcFjw8c/',
   $c$<p>(Sin guion todavía: ver el reel de referencia.)</p>$c$),
  (20, 'Evita hacer día de pecho, día de espalda…', 'Grabado', 'https://www.instagram.com/p/DWU6bhEAa0K/',
   $c$<p><b>Gancho (0-5 s)</b> con cortes rápidos, uno por cada día de entrenamiento: «Deja de hacer día de pecho, día de espalda, día de brazos, día de piernas, día de hombros…»</p><p><b>Problema (5-14 s):</b> «Típicamente conocido como bro split. Así es como la mayoría ha entrenado: cada músculo una vez por semana. En su lugar, intenta esta rutina de 5 días para transformar tu cuerpo.» En pantalla: la tabla lunes-viernes con un músculo por día, y luego un antes/después.</p><p><b>La rutina (14-48 s)</b> con texto en pantalla y clips de cada ejercicio:<br>Día 1, empuje: 3 ejercicios de pecho, 2 de hombros y 2 de tríceps.<br>Día 2, jalón: 3 ejercicios de espalda, 1 de trapecios, 1 de deltoides posterior y 2 de bíceps.<br>Día 3, pierna: 1 de sentadilla (barra o hack), 1 de peso muerto o empuje de cadera, 1 prensa de piernas, 1 curl de isquios, 1 de aislamiento para glúteos o piernas, según lo que te falte.<br>Día 4: descanso.<br>Día 5: repites empuje.<br>Día 6: repites jalón.</p><p><b>Cierre de la rutina (49-56 s):</b> «Día 7, domingo, descansas. El día 1 de la semana siguiente toca pierna, y así sucesivamente. Vas intercalando.»</p><p><b>CTA (56-61 s)</b>, con el móvil en la mano: «Comenta "VAMOS" y te enseño la nueva forma de perder grasa y ganar músculo al mismo tiempo.»</p>$c$),
  (21, 'Cuerda o maneral', 'Grabado', 'https://www.instagram.com/p/DNqXKf8C0vO/',
   $c$<p>(Sin guion escrito: ver el reel de referencia.)</p>$c$),
  (22, 'Curl de bíceps bien y mal… remo prono bien y mal…', 'Guion', 'https://www.instagram.com/p/DYe0oe6M42P/',
   $c$<p>Curl de bíceps bien y mal<br>Remo prono bien y mal<br>Remo neutro bien y mal<br>Pecho bien y mal</p>$c$),
  (23, 'Top 5 mejores compras de gimnasio que merecen la pena', 'Grabado', 'https://www.instagram.com/p/DbTa09ptfGb/',
   $c$<p>Straps<br>Pre entreno<br>Cinturón de avión<br>Pulsera o reloj de actividad para medir el descanso y pasos</p>$c$),
  (24, 'Polea abajo y polea arriba', 'Grabado', 'https://www.instagram.com/p/DTbmPMlDRXK/',
   $c$<p>(Sin guion escrito: ver el reel de referencia.)</p>$c$),
  (25, 'Gympin', 'Guion', 'https://www.instagram.com/p/DaIBmdlt4Pc/',
   $c$<p>(Sin guion todavía: ver el reel de referencia.)</p>$c$),
  (26, 'Movilidad y calentamiento', 'Guion', 'https://www.instagram.com/p/Ddzm964MZ8A/',
   $c$<p>(Sin guion todavía: ver el reel de referencia.)</p>$c$),
  (27, 'Mejores hidratos de carbono para entrenar', 'Grabado', 'https://www.instagram.com/p/DT-z1LBiA1m/',
   $c$<p>0-4 s · Título «MEJORES CARBOHIDRATOS PARA ENTRENAR»<br>4-9 s · 5: tortitas de arroz<br>9-14 s · 4: miel<br>14-21 s · 3: dátiles<br>21-27 s · 2: plátano<br>27-34 s · 1: crema de arroz</p>$c$),
  (28, 'Abdomen en polea o abdomen en banco', 'Guion', 'https://www.instagram.com/p/DU6MQ-oCJ0z/',
   $c$<p>(Sin guion todavía: ver el reel de referencia.)</p>$c$)
),
new_scripts as (
  insert into public.scripts (title, category, content, status, created_at, updated_at)
  select d.title, 'Reels gym 8 nov', d.content,
         case when d.stage = 'Guion' then 'Listo' else 'Grabado' end,
         now() + (d.n || ' milliseconds')::interval, now()
  from data d
  where not exists (select 1 from public.scripts s where s.title = d.title)
  returning id, title
)
insert into public.videos (title, type, production_status, script_id, reference_url, created_at)
select d.title, 'reel_ig', d.stage, ns.id, d.ref, now() + (d.n || ' milliseconds')::interval
from data d
join new_scripts ns on ns.title = d.title;
