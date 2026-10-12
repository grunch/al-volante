# Contenido pedagógico: autoría, revisión y cobertura

Entregable de la fase 5 (iniciada el 2026-10-12). Define cómo se convierten las unidades del catálogo (`COBERTURA.md`) en actividades, cómo se revisa cada unidad contra la fuente, qué significa cada estado y qué se decidió ante cada discrepancia. El estado vivo de las tareas está en `ESTADO_IMPLEMENTACION.md`.

## Archivos

| Archivo | Contenido |
|---|---|
| `catalog/activities/<fuente>-<sección>.json` | Actividades de una sección (`manual-ch1`, `manual-glossary`, `siniestros-s1`…). Una actividad vive en el archivo de la sección de **su primera unidad**; el validador lo exige. |
| `catalog/figures.json` | Recortes de páginas de los PDF oficiales: fuente, página, caja en fracciones de la página, descripción accesible y unidades que ilustran. |
| `../public/figures/*.png` | Imágenes de esos recortes, generadas con `node scripts/crop-figures.ts` (requiere poppler e ImageMagick). Se versionan porque la aplicación estática las sirve. |
| `catalog/signs.json` (`box`) y `../public/signs/*.png` | Recorte de cada señal en su página, sin el rótulo impreso que la nombra (desde F05-T02); el mismo script genera las imágenes. Una señal que no admite pregunta lleva `consultationReason`. |
| `catalog/units.json` | Las unidades, con su estado y, si son de consulta, `consultationReason`. Las correcciones de la revisión quedan en el propio registro y se anotan en `notes`. |
| `catalog/pages.json` y `units.json` del protocolo y los recorridos | Desde F05-T04, las cuatro fuentes están clasificadas página por página (categoría `exam`), con unidades `protocolo.*` y `recorridos.*`. |

Las figuras recortan el mismo material oficial que el repositorio ya incluye en `fuentes/pdf/` para estudio (ver README): no son material propio ni oficial del proyecto.

## Estados y tratamiento

Escala común (`COBERTURA.md`): `pending` → `transcribed` → `reviewed` → `implemented` → `tested`. En la fase 5 cada estado tiene un significado verificable, que `validateTreatment` controla:

| Estado | Significado | Regla del validador |
|---|---|---|
| `transcribed` | Extraída en F01-T02, sin revisar unidad por unidad. | — |
| `reviewed` | Contrastada contra la **imagen** de su página (y el texto extraído), con las correcciones aplicadas. | Una unidad de consulta tiene que estar al menos revisada. |
| `implemented` | Revisada y con tratamiento: practicada por una actividad revisada o declarada de **consulta** con su motivo. | Sin actividad ni motivo de consulta, no puede estar `implemented`. |
| `tested` | Practicada por actividades revisadas, que la prueba de recorrido del catálogo responde bien y mal variante por variante. | Solo las actividades llevan a `tested`; una unidad practicada no puede quedar por debajo de `implemented`. |

- Las actividades en borrador (`draft`) no cuentan como cobertura.
- Cada actividad cita al menos una página de **cada** unidad que practica (trazabilidad de la devolución).
- Las señales siguen la misma escala a través de las actividades de identificación.
- `src/content/catalogPlaythrough.test.ts` es la «prueba» de `tested`: muestra cada variante con alguna semilla sin revelar la respuesta, responde cada opción (o el orden correcto e invertido, o cada camino de la escena) y comprueba la corrección y la devolución.

**Consulta.** Una unidad queda como consulta cuando su contenido no se puede evaluar con justicia (datos de contacto, listados que pueden estar desactualizados o contenido que depende de un dato excluido por una decisión). Se estudia en su página de sección y en la biblioteca, con el motivo visible. No se evalúa ni cuenta para el dominio.

## Método de revisión

1. Por cada unidad, se mira la imagen de su página (`pdftoppm`, 80–90 ppp; recortes a más resolución cuando hace falta) y el texto extraído (`pdftotext -layout`). El texto solo pierde infografías, tablas y rótulos.
2. Se corrige el título, el resumen o los datos clave que no sean fieles a la página. No se agrega conocimiento externo. La corrección queda anotada en `notes` («Revisada contra PDF n (F05-Txx): …»).
3. Se escriben las actividades y se decide el tratamiento de cada unidad.
4. El trabajo de cada tarea se reparte en lotes por páginas, que escriben subagentes con una guía común. El autor integra los lotes, corre los validadores y revisa por muestreo contra la fuente. Ningún lote modifica el repositorio directamente.

## Reglas de autoría

- **Tipos:** `single-choice` para definiciones y datos; `ordering` solo para procedimientos cuyo orden fija la fuente; `decision` para conductas en situación; `sign-identification` para señales (desde F05-T02): una variante por señal, con distractores del mismo grupo y, cuando el capítulo 3 da la conducta, preguntas de aplicación.
- **Largo de las opciones:** la correcta no supera en más de 10 caracteres a la más larga de las incorrectas (se delataría).
- **Texto para quien juega:** sin ids internos (decisiones, issues, archivos). Vale para enunciados, opciones y devoluciones, y también para los motivos de consulta, que se muestran en la página de sección y en el catálogo de señales (ver «Consulta»).
- **Una sola respuesta defendible** según la página citada. Distractores plausibles pero claramente incorrectos para quien estudió esa página; sin «todas/ninguna de las anteriores» ni opciones que se delaten por su largo.
- **Devolución por opción:** la correcta confirma y explica; cada incorrecta dice por qué no y cuál es el dato correcto. La `explanation` enseña la regla completa con su cita.
- **Español rioplatense con voseo**, claro y breve. Ids y claves en inglés.
- **No se pregunta** por URLs, teléfonos (salvo los de emergencia verificados), correos, direcciones, números de artículo, fechas de normas ni estadísticas exactas.
- **Glosario:** «diccionario interactivo»; los distractores son definiciones de otros términos del mismo glosario.
- **Figuras:** solo las que enseñan (infografías, tablas, diagramas), mostradas con la devolución porque pueden contener la respuesta. Cada una tiene descripción accesible con sus datos.
- El banco es propio, revisado contra las fuentes; no se presenta como oficial ni afirma vigencia normativa que no se verificó.

## Decisiones sobre discrepancias

Política (`COBERTURA.md`): ninguna pregunta depende de un dato no resuelto. Cuando dos fuentes difieren se evalúa lo que comparten o la versión verificada, y la diferencia se explica citando ambas. Las verificaciones externas indican fecha y fuente.

Citas: «manual PDF n» y «guía PDF n» son páginas físicas de `fuentes/pdf/manual.pdf` y `fuentes/pdf/siniestros.pdf`. Dentro de una decisión, «PDF n» sin otra indicación es del manual.

### F05-T01

- **D-T01-1 Velocidad en calles de prioridad peatón / convivencia** (manual PDF 26, ficha 10 km/h vs nota 20 km/h): no evaluar esa velocidad. Sí se evalúa qué es cada tipo de calle y quién puede circular.
- **D-T01-2 Áreas con prioridad peatonal** (PDF 28: seis áreas en el texto, dos en el mapa): no evaluar el listado de áreas.
- **D-T01-3 «Cuatro autos menos»** (PDF 41): no evaluar la cantidad; sí el concepto de compartir el auto.
- **D-T01-4 Teléfonos de emergencia** (manual PDF 52: 107 y luego 911; guía PDF 7, 9, 10: 911): verificado el 12/10/2026 en el sitio oficial ([página del SAME](https://buenosaires.gob.ar/gcaba_historico/salud/informacion-para-los-ciudadanos/same), «Teléfonos útiles»): **107 = SAME (emergencias médicas)** y **911 = Policía**. Se puede evaluar: con heridos, llamar al 107 (SAME) para la emergencia médica y al 911 para dar intervención a la policía. No evaluar que el 911 «centraliza Policía Federal» (desactualizado: en CABA la seguridad está a cargo de la Policía de la Ciudad).
- **D-T01-5 Balizas portátiles** (manual PDF 51 vs guía PDF 8): en ciudad ambas fuentes coinciden en 30 m y 60 m detrás del vehículo; eso se evalúa. Las distancias en ruta (50/100 m vs ~90 m) y la ubicación delante/detrás en ruta no se evalúan.
- **D-T01-6 Túneles y estructura Proteger-Alertar-Socorrer** (solo manual PDF 51–53): se evalúa citando el manual; la guía no lo contradice, solo lo omite.
- **D-T01-7 Primeros auxilios** (manual PDF 53 con excepciones vs guía PDF 10 sin excepciones): rige el manual (material del examen de la categoría B); la guía no lo contradice, es menos detallada. Se puede evaluar la regla general (no mover a la persona herida, no retirarle el casco) y las excepciones del manual citándolo.
- **D-T01-8 Datos a recabar, vehículo estacionado, testigos** (manual PDF 53–54 vs guía PDF 11–12): evaluar lo que comparten; lo exclusivo de una fuente se evalúa solo citándola expresamente («según la guía…») y sin contradecir a la otra.
- **D-T01-9 Contactos de organismos y ONG** (manual PDF 54–55, guía PDF 22–23): no evaluar teléfonos, correos, sitios ni nombres exactos de oficinas. Lo evaluable es la existencia y función de esos espacios; los datos de contacto quedan como consulta.
- **D-T01-10 Alcohol del principiante** (PDF 47: 0,0 g/l durante los dos años): evaluable (cualquier norma posterior de alcohol cero no lo cambia). Los límites generales de alcohol (cap. 4) no son de este lote.
- **D-T01-11 Cédulas del vehículo** (PDF 47–48, vigencias y colores ambiguos): no evaluar vigencias ni colores de cédula; sí que el vehículo debe circular con su documentación.
- **D-T01-12 VTV** (PDF 49): los plazos y la frecuencia de la VTV en CABA están cambiando (búsqueda del 12/10/2026: fuentes periodísticas contradictorias sobre la primera verificación y la vigencia, y una reforma legislativa de estado incierto; no se encontró una página oficial actualizada), y la infografía por terminación de patente no asigna diciembre ni enero. No evaluar plazos, frecuencias ni calendario; sí qué es la VTV y para qué sirve, según el manual.
- **D-T01-13 Unidad fija y Código Penal** (PDF 44–45): evaluar los tipos de responsabilidad y sus ejemplos; no evaluar el valor de la unidad fija, números de artículo ni años de pena.
- **D-T01-14 Estadísticas** (PDF 15, OSV 2022 sin año de referencia): solo conceptos (quiénes son los usuarios más afectados), atribuyéndolos al informe que cita el manual; no evaluar porcentajes ni cifras.
- **D-T01-15 Plan de seguridad vial 2020-2023 y referencias a sitios** (PDF 15–18 y notas al pie): no evaluar.
- **D-T01-16 Guía, plazos de reclamo** (guía PDF 14: 3 años ante el tercero, 1 año ante la propia aseguradora; 72 h para avisar, que coincide con el manual PDF 53): evaluable citando la guía.
- **D-T01-17 Guía, proceso penal** (PDF 17–21: fuero, querella, transferencia de 2018): evaluar solo conceptos generales (qué es la mediación, la demanda civil, la denuncia penal); no evaluar fueros, códigos procesales ni la transferencia.
- **D-T01-18 Scoring** (manual PDF 55: 20 puntos iniciales, curso de 4 puntos, reasignación del 50 % y de 10 puntos, inhabilitación de 60 días a 5 años): evaluable. Verificado el 12/10/2026: la [página oficial del sistema de evaluación permanente de conductores](https://buenosaires.gob.ar/jefaturadegabinete/movilidad/licencias-de-conducir/scoring) confirma los 20 puntos iniciales; la recuperación de puntos y los plazos de inhabilitación coinciden en notas periodísticas de 2026 y no se confirmaron en una página oficial.

### F05-T02

- **D-T02-1 Cordón amarillo** (manual PDF 60: «prohibición de estacionar durante las 24 horas»; manual PDF 196: «prohibición de estacionar, pudiendo detenerse»): se evalúa solo lo que comparten, que el cordón amarillo prohíbe estacionar. No se evalúa si se puede detener ni el «24 horas». El cordón anaranjado (solo manual PDF 60) se evalúa citando esa página.
- **D-T02-2 Estacionar en pasajes** (PDF 84: el texto lo prohíbe en pasajes de calzada de hasta 4,5 m y la infografía en todos): se evalúa la prohibición en pasajes de calzada de hasta 4,5 m, que ambas incluyen; no se pregunta por pasajes más anchos.
- **D-T02-3 Referencias erradas** («Anexo V», «Ley 2449», PDF 58, 59, 77): no se pregunta por números de anexo, ley ni artículo.
- **D-T02-4 Velocidades** (PDF 72–74): se evalúan los límites generales de CABA (20/40/60/100) y los de fuera de CABA que da el manual, citándolo; la velocidad de calles de convivencia queda fuera (D-T01-1). Las excepciones por avenida (Corrientes, Gral. Paz, Figueroa Alcorta, etc.) no se evalúan: la propia página dice que la autoridad las modifica por tramos y pueden haber cambiado; se estudian como consulta en la unidad.
- **D-T02-5 Excepción 2 de la prioridad de la derecha** (PDF 64): se evalúa el contenido (en un cruce ferroviario sin semáforo tiene prioridad quien sale del paso a nivel), no el título.
- **D-T02-6 Tercera luz de freno** (PDF 68): solo rótulo; no se evalúa su función.
- **D-T02-7 Infografía de supervivencia** (PDF 69, «IMPACTO A»): los pictogramas son personas a pie; se evalúa como probabilidad de que sobreviva una persona a pie atropellada, «según la infografía del manual».
- **D-T02-8 Distancia de detención** (PDF 70): valen las cifras rotuladas, no el largo de las barras.
- **D-T02-9 «Velocidad mínima de la arteria» cerca de escuelas** (PDF 74): sin cifra; no se evalúa un número.
- **D-T02-10 Macrocentro** (PDF 84): sin límites definidos; no se evalúan.
- **D-T02-11 Cajón azul** (PDF 87): se evalúa el máximo de 30 minutos «salvo otra indicación»; el «24 horas» de la señal es el horario del espacio.
- **D-T02-12 Anexo IV, ilegibles** (placas de acarreo y de tarifa, PDF 185 y 189) e **incompletos** («Barreras ferroviarias», PDF 186): ninguna pregunta depende de lo ilegible. Una señal cuyo dibujo está incompleto queda de consulta (`implemented` con `consultationReason`).
- **D-T02-13 «ENCRUCIJADA (Bifurcación)»** (PDF 187, dos dibujos distintos con el mismo rótulo): no se usan como respuestas distintas entre sí.
- **D-T02-14 Subtítulos** (PDF 61 frente al anexo): para agrupar señales valen los subtítulos del anexo IV.
- **D-T02-15 Sin significado en la fuente** (estacionamiento ordenado con reloj verde o naranja, PDF 189; «Preferencia de avance», PDF 186): se evalúa el nombre de la señal, no un significado que la fuente no da.
- **D-T02-16 Estrellas amarillas** (PDF 192): se evalúa que marcan el lugar donde murió una persona en un siniestro vial, según la página; no la leyenda del ejemplo (edad o fecha).
- **D-T02-17 «Acérquese a la parada…»** (PDF 194): vale la leyenda dibujada en la señal.
- **D-T02-18 Luz amarilla** (PDF 64: «detenerse si aún no se ha iniciado el cruce»; PDF 197: detenerse «si no se llega a transponer la encrucijada antes del cambio a rojo»): se evalúa solo el caso en que coinciden (todavía no empezaste a cruzar y no llegarías antes del rojo); la explicación cita las dos.

### F05-T03

- **D-T03-1 Alcohol** (PDF 91, Ley 2148: 0,5 g/l general, 0,20 motociclistas, 0,00 principiantes y profesionales; «ACOMPAÑANTE 0.50» sin explicar): la Ley nacional 27.714 de alcohol cero rige en rutas nacionales y en las jurisdicciones que adhieren; no se encontró confirmación oficial de que la Ciudad haya adherido ni de que mantenga sus límites (búsqueda del 12/10/2026: solo notas de prensa de hasta 2023 que dicen que mantenía los suyos). Se evalúa el 0,0 g/l de principiantes y profesionales (válido con cualquiera de las dos normas) y los efectos del alcohol; **no** se evalúan los límites de 0,5 y 0,2 ni el del acompañante: quedan en la unidad como consulta, con la advertencia en la explicación.
- **D-T03-2 Distracciones** (PDF 96): ejemplos como cambiar el CD o mirar un DVD están desactualizados; se evalúa el concepto (todo lo que saca la vista, las manos o la atención de la conducción), no esos aparatos como respuesta.
- **D-T03-3 Capítulo 5, cifras de la infografía de viajes de mujeres y línea por SMS** (PDF 100): no se evalúan porcentajes ni números de contacto.
- **D-T03-4 Ralentí de 5 minutos** (PDF 102): relación causal ambigua; se evalúan las recomendaciones de conducción eficiente sin la cifra de 5 minutos.
- **D-T03-5 Elementos de seguridad** (PDF 106 los llama «adicionales», PDF 119–120 los presenta como obligatorios): se evalúa lo que dice la sección específica (PDF 119–120), sin preguntar si son «adicionales u obligatorios».
- **D-T03-6 Fecha del neumático** (PDF 108): se evalúa cómo se lee el código (semana y año), no la equivalencia «tercera semana de abril».
- **D-T03-7 Espejos laterales, 10 %** (PDF 110): se evalúa que el propio vehículo apenas debe verse en el espejo lateral, sin la cifra si la pregunta depende de la ambigüedad.
- **D-T03-8 Niños en asientos delanteros** (PDF 114, combinación ambigua de 12 años, 1,50 m y 36 kg; nota con 10 años de la ley nacional): se evalúan solo casos que cumplen todas las condiciones a la vez (por ejemplo, un chico de 7 años viaja atrás con su SRI), no los casos frontera ni el límite nacional.
- **D-T03-9 Contramarcha del SRI** (PDF 115 frente a 116): se evalúa que los bebés viajan a contramarcha en los primeros grupos, no el corte exacto de edad o peso.
- **D-T03-10 Objetos sueltos** (PDF 117, «hasta 40 veces su peso» y un ejemplo de ~41): se evalúa el concepto (en un choque a 50 km/h un objeto suelto multiplica muchas veces su peso y se vuelve un proyectil); la cifra solo en la explicación.
- **D-T03-11 Cristales laminados o templados** (PDF 118): no se evalúa cuál se rompe en pedazos pequeños.
- **D-T03-12 Cuarta de enganche** (PDF 121): se evalúa que en la Ciudad un vehículo particular no puede remolcar a otro.
- **D-T03-13 Tercera fila del SRI** (PDF 116): no se evalúa.

### F05-T04

Los anexos II (transporte de pasajeros/as, categoría D) y III (carga, categorías C/E) son **material complementario**: no forman parte del material de la licencia B (manual PDF 3) y su progreso se muestra aparte. Cada `explanation` aclara que es contenido para profesionales cuando la regla no aplica a un auto.

- **D-T04-1 Diferencias con el anexo I** (frenos cada 6 meses o una vez al año, carga de neumáticos, 2 mm en gran porte, recapados, espejos, cinturón, apoyacabeza, cristales, matafuegos, botiquín; issues 142–156): se evalúa lo que el anexo II o III dice para su categoría, atribuyéndolo («en vehículos de transporte de pasajeros…»); no se pregunta qué anexo tiene razón ni se usa la regla de un anexo para otra categoría.
- **D-T04-2 Fecha del neumático** (PDF 127, «tercera semana de abril»): como D-T03-6, solo cómo se lee el código.
- **D-T04-3 Espejo 10 %** (PDF 130): no se evalúa la cifra para gran porte.
- **D-T04-4 Postura, cadera bajo las rodillas** (PDF 139 y 161): sentido dudoso; no se evalúa.
- **D-T04-5 Paseo del Bajo** (PDF 149 frente a 168 y al glosario; 12 t «superior» o «igual o mayor»; 5 o 9 puntos): se evalúa que es de circulación exclusiva y obligatoria para tránsito pesado y ómnibus de larga distancia; no los umbrales ni la lista de puntos.
- **D-T04-6 Mapa de hospitales** (PDF 150, rótulo dudoso): no se evalúa.
- **D-T04-7 Camión N1 frente a «más de 3.500 kg»** (PDF 153–154): no se evalúa el peso que define un camión.
- **D-T04-8 Red de tránsito pesado** (PDF 168: kilómetros, calles, barrios, Ley 6401): cifras sin vigencia comprobada; no se evalúan. Sí qué es la red y que el tránsito pesado debe circular por ella.
- **D-T04-9 Espejo interno del camión** (PDF 173 frente a 174): no se evalúa si existe.
- **D-T04-10 Airbag «no obligatorio»** (PDF 178): no se evalúa.
- **D-T04-11 Carga y descarga sin horarios** (PDF 166): no se evalúan franjas.
- **D-T04-12 Datos de colectivos y taxis** (PDF 141–142: horarios de detención fuera de parada, asientos reservados, edades): referencias normativas sin vigencia comprobada; se evalúan solo las conductas de seguridad (no los números).
- Teléfonos, URLs y normas citadas: no se evalúan (consulta).

- **D-T04-13 Lectura de D-T04-5:** «la lista de puntos» es la lista (cuántos puntos y cuáles). Se evalúan las reglas sueltas que los dos anexos comparten, citando su página: no detenerse, avisar a AUSA si el vehículo queda averiado, desvío solo ante una contingencia que impide circular, y los 60 km/h (que coinciden con el capítulo 3, PDF 72). Los avisos 5 a 8, que solo están en la lista del anexo III (sustancias peligrosas, cargas excepcionales, acompañantes y área del Bajo), quedan como consulta.
- **D-T04-14 Airbag «no obligatorio»:** D-T04-10 alcanza también a PDF 114 (anexo I) y 133 (anexo II), que repiten la frase.
- **D-T04-15 Requisitos de la licencia profesional** (PDF 125: 21 años, más de 1 año en la clase B, mayores de 65; LINTI para servicios interjurisdiccionales): se evalúan atribuidos al manual («el manual indica…»), como contenido para profesionales, sin afirmar vigencia.
- **D-T04-16 Protocolo:** su contenido se practica al volante en el examen del juego (`#/examen`, con las reglas de `REGLAS.md`). Por eso sus unidades son de consulta, salvo las reglas generales que conviene saber de memoria: velocidades de examen (30 y 45 km/h), puntos por tipo de falla, aprobado con hasta 7 puntos y las tres etapas completas, diferencia entre desaprobar e interrumpir, y maniobras frente a intentos de estacionamiento. Esas se evalúan con los datos de `REGLAS.md`, citando la página del protocolo, y cada una tiene su propia unidad (`protocolo.general.exam-speed-limits`, `protocolo.general.fail-or-interrupt`, `protocolo.annex2.belt-and-red-light`, `protocolo.annex2.parking-maneuvers-and-attempts` y `protocolo.evaluation.scoring-and-result`): las unidades que reúnen todas las fallas de un tipo o toda una etapa son de consulta, para que el progreso no dé por dominado lo que no se practicó.
- **D-T04-17 Circuitos:** todas las unidades de circuitos son de consulta (el juego reconstruye solo el recorrido A de la Comuna 13). Vale la edición 2026 de los recorridos; el anexo III del protocolo (2023) se muestra como antecedente. Las secuencias se transcribieron desde la imagen, porque el texto extraído invierte A y B en las comunas 2, 10, 11 y 13. Comuna 13 A coincide con `RECORRIDO.md`. Los nombres de calles se copian como los escribe cada lámina.

#### Circuitos: protocolo 2023 frente a recorridos 2026

En todas las láminas, el «Estacionamiento» de 2023 pasa a llamarse «Inicio de examen práctico» en 2026. En 2023 había un solo recorrido numerado por comuna; en 2026 hay A y B. ACA Libertador solo existe en 2026.

| Comuna | Páginas (2023 → 2026) | Qué cambia |
|---|---|---|
| 2 | PDF 34 → 6 | Después de Juncal, 2023 sigue por Arenales y Paraná; 2026 va por Av. Callao. |
| 3 | PDF 34 → 7 | Mismo circuito; el inicio pasa de Moreno del 2320 al 2350 a Pichincha 338. |
| 4 | PDF 35 → 8 | 2023 pasaba por Wenceslao Villafañe y Jovellanos; 2026 va directo a Arzobispo Espinosa. La sede pasa a «Punto de Atención Ciudadana 4». |
| 5 | PDF 35 → 9 | Sin cambios en el recorrido A. |
| 6 | PDF 36 → 10 | Portugal pasa a «E. Acevedo»; después de Yatay, 2023 sigue por Tte. Gral. Juan Domingo Perón y 2026 por Potosí y Ramos Mejía. |
| 7 | PDF 36 → 11 | Subsede de Emilio Mitre 981 a 956 e inicio de Tejedor 1100 a 1084. El alternativo de los viernes de 2023 no existe en 2026. |
| 9 | PDF 37 → 12 | Mismo circuito; el inicio pasa de Moreto 700 a Mozart 850. |
| 10 | PDF 37 → 13 | Mismo circuito; el inicio pasa de Mercedes al 200 a Bacacay 3993. |
| 11 | PDF 38 → 14 | Sede de Av. Francisco Beiró 4580 a «Sede Licencias», Av. Francisco Beiró 4629; después de Benito Juárez, 2023 sigue por Navarro y 2026 por Simbrón, Desaguadero y José Pedro Varela. |
| 12 | PDF 38 → 15 | 2026 elimina el tramo Blanco Encalada – Lugones; el inicio pasa de Av. Monroe al 4200 a Av. Monroe 4237. |
| 13, 14 y 15 | PDF 39–40 → 16–18 | Misma secuencia; solo cambia el rótulo del inicio. |

Observaciones nuevas de F05-T01 (agregadas a `catalog/issues.json`, que pasa de 206 a 214): límite de 13 m entre calle y avenida (glosario PDF 5–6), pictogramas de PDF 23 y 29, horario de la calle prioridad peatón (PDF 26 y 29), edad de 12 años en veredas (PDF 33), picadas como contravención (PDF 45), balizas en doble sentido (manual PDF 51 frente a guía PDF 8) y documentos a intercambiar (manual PDF 53 frente a guía PDF 7). Ninguna pregunta depende de ellas. F05-T04 agrega 14 (243): clases de distancia superpuestas (PDF 125), la coma de PDF 128, requisitos del transporte escolar (PDF 143), «Pi y Margal» (PDF 150), el orden de las acciones antes de maniobrar (PDF 173), las repeticiones de PDF 178 y 180, y en los documentos del examen la nota sin llamada (protocolo PDF 6), la cota casi ilegible (PDF 21), el selector sin «L» (PDF 30 frente a 19) y cuatro de los recorridos (tapa, Comuna 12, Comuna 14 y ACA Libertador). F05-T03 agrega 3 más (229): ABS «no obligatorio» (PDF 107), el paréntesis de PDF 100 y el orden de luz de giro y velocidad de PDF 110 frente a PDF 75. F05-T02 agrega 12 (226 en total): banquina en PDF 60, mínimos de PDF 73, señal de ciclovía de PDF 32 frente a PDF 185, oblea de PDF 87, cheurones de niebla (PDF 79), diagramas de PDF 77, contracurva y curva en «S» (PDF 187), fondo azul de fin de prescripción (PDF 186 frente a 61), luz amarilla (PDF 64 frente a 197), carril de emergencia (PDF 63 frente a 196), erratas de PDF 195–196 y semáforos de PDF 197.

## Cobertura por tarea

| Tarea | Secciones | Unidades | Probadas | De consulta | Actividades nuevas | Figuras |
|---|---|---:|---:|---:|---:|---:|
| F05-T01 | Presentación, glosario, introducción, cap. 1–2 y guía de siniestros | 260 | 254 | 6 | 105 (351 variantes) | 23 |
| F05-T02 | Cap. 3 y anexo IV, con el catálogo visual de señales | 153 | 151 | 2 | 128 (573 variantes) | 28 |
| F05-T03 | Cap. 4–5 y anexo I, con la inspección del auto («Mi garaje») | 107 | 106 | 1 | 59 (192 variantes) | 17 |
| F05-T04 | Anexos II–III (complementario), protocolo y recorridos (consulta) | 233 | 186 | 47 | 94 (308 variantes) | 60 |

Señales (F05-T02): 354 de las 355 recortadas de su página y revisadas (`name`, `meaning` solo cuando la fuente lo da, y `visual`, que es el texto alternativo y no delata la respuesta); 350 `tested` por actividades de identificación y 4 de consulta (las tres luces intermitentes, que un dibujo fijo no distingue de la luz fija, y «Barreras ferroviarias», incompleta en el PDF). La restante (PDF 91, ícono de principiante de la tabla de alcohol) se recortó y practica en F05-T03: las 355 tienen recorte y tratamiento.

En F05-T04, de las 185 unidades de los anexos II y III se revisaron todas contra la imagen (17 correcciones; 177 probadas y 8 de consulta), y el protocolo (42 páginas) y los recorridos (19) pasan a estar clasificados página por página, con 48 unidades nuevas (9 probadas y 39 de consulta) y una figura por lámina de circuito, de 2026 y de 2023.

Además, en F05-T01 se revisaron contra sus páginas las 14 unidades (cap. 1, 3 y anexo IV) y las 4 señales que practican las 8 actividades de la fase 2; quedan `tested`.

## Simulacro teórico y auditoría global (F05-T05)

- **Banco del simulacro:** las variantes de opción única y de identificación de señales de las secciones de la licencia B (introducción, capítulos 1–5 y anexos I y IV). Para que una variante entre tiene que ofrecer al menos dos opciones incorrectas: el examen muestra tres opciones. Una actividad entra solo si **todas** sus unidades son de esas secciones: las variantes no indican su fuente, así que una actividad que también practica la guía (por ejemplo, las de siniestros del capítulo 2) podría preguntar un dato de fuera del teórico B. El glosario, la guía, los anexos II y III y los documentos del examen no entran, porque no son material del teórico B (manual PDF 3).
- **Reparto por tema:** proporcional a las unidades de cada sección, con al menos una pregunta por sección. Una prueba de integración compone hojas con el banco real: 40 preguntas, todas las secciones representadas y una sola opción correcta de tres.
- **Parámetros:** 40 preguntas, 34 para aprobar, 45 minutos (40 como variante), con sus fuentes en `REGLAS.md` §8 y en la propia configuración (`catalog/theory-exam.json`). Cantidad, formato y umbral: Disposición 860/2023 (DGHC), anexo, p. 96. Tiempo: 45 minutos en esa misma disposición (anexo, p. 96) y en la página oficial de material de estudio; 40 minutos en el informe final de gestión 2024 (IF-2024-05928354-GCABA-AJG), p. 17. Los dos documentos se descargaron del Boletín Oficial y no están versionados en `fuentes/` (ver `REGLAS.md`, tabla de fuentes). La interfaz cita la fuente de cada tiempo y no declara vigente a ninguno.
- **Auditoría global** (fin de la fase 5): 753 de 753 unidades tratadas (697 practicadas y 56 de consulta), 355 de 355 señales tratadas y recortadas y ninguna página sin clasificar en las cuatro fuentes (285 páginas). `npm run validate:content` imprime este resumen y una prueba de integración lo exige.

## Cómo validar

```bash
npm run validate:content                              # esquemas, referencias, figuras, estados de tratamiento y auditoría global (falla si hay brechas)
npx vitest run src/content                            # validadores, recorrido del catálogo y política de contenido
node scripts/crop-figures.ts [id …]                   # regenera recortes de figuras y señales (poppler e ImageMagick)
```

