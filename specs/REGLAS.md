# Reglas del examen práctico y parámetros del teórico

Entregable de F01-T03. Fecha: 2026-10-11; §7 (D6–D9) y §9 actualizados en F04-T03 (2026-10-12). Estado: **transcripción completa del protocolo, conciliada con la ficha; discrepancias y vacíos localizados; criterios de disparo del juego fijados.**

Este documento es la fuente de verdad del motor de evaluación (F03-T04, F04-T03 a F04-T05) y de la configuración del simulacro teórico (F05-T05). Prevalece sobre las cifras citadas en `PROPUESTA.md` y en el plan. Los datos estructurados están en `catalog/rules.json`, y la tabla de fallas de este documento se genera desde ese archivo.

Las referencias «PDF n» son páginas físicas de `fuentes/pdf/protocolo.pdf`, salvo que se indique otra fuente.

## 1. Fuentes y vigencia

| Fuente | Edición | Verificación |
|---|---|---|
| Protocolo de examen práctico de idoneidad conductiva, clase B.1 (`fuentes/pdf/protocolo.pdf`, 42 páginas) | 14/09/2023 | Es idéntico (SHA-256 `65f1dd9f…`) al PDF que enlaza hoy la página oficial del examen práctico (descarga del 2026-10-11). |
| Edición anterior del mismo protocolo, firmada en GEDO como IF-2023-03797340-GCABA-DGDEI | 13/01/2023 | La misma página oficial también la enlaza (SHA-256 `951bbcac8e89d7ff4391ee4dc751076be32a96aa085067f5bbb93205239bffd6`, no versionada). La comparación palabra por palabra del texto extraído muestra **texto normativo idéntico**: solo cambian los encabezados GEDO y la hoja de firmas. No hay diferencias de edición que resolver en las reglas. Las láminas de circuitos del anexo III son imágenes y se comparan en F01-T04. |
| Manual de procedimientos de la DGHC (Disposición 860/2023, IF-2023-32868603-GCABA-DGHC) | 09/2023 | Parámetros del teórico (§8). Descargado del Boletín Oficial; no versionado. |
| Informe final de gestión de la DGHC (IF-2024-05928354-GCABA-AJG) | 31/01/2024 | Parámetros del teórico (§8). Descargado del Boletín Oficial; no versionado. |

El 2026-10-11 también se comprobó que el manual (`MANUAL_Vehiculo_4Ruedas_2023 SA.pdf`), la guía de siniestros y el documento de recorridos (`final manual.pdf`, 03/2026) que publica hoy el sitio oficial tienen el mismo SHA-256 que los de `fuentes/manifest.json`. Esto prueba que son las versiones publicadas, no su vigencia jurídica.

## 2. Mapa del protocolo

| Páginas PDF | Contenido | Uso |
|---|---|---|
| 1–4 | Tapa, portada e índice | No instructivo |
| 5 | Presentación: examen B.1 en vía pública, vehículos con doble comando | Contexto |
| 6 | Objetivo y aspectos evaluados; suspensión por clima | §3 |
| 7 | Consideraciones generales: requisitos, luces bajas, doble comando, interrupciones | §3, §4 |
| 8 | Reglas obligatorias para aspirantes; velocidad de examen 30/45 km/h | §3 |
| 9–10 | Etapa I y comienzo de la etapa II; corte por 8 puntos antes de circular; circuito de 15 min | §3, §4 |
| 11–12 | Etapa II: maniobrabilidad, primeros 100 m, circulación, intersecciones, giros, cambio de carril | §3 |
| 13 | Etapa III: estacionamiento paralelo, finalización y descenso | §3 |
| 14 | Forma de evaluación: tipos de falla, puntaje, aprobación, interrupción | §4 |
| 15–17 | Ficha de evaluación (80 filas) | §5 |
| 18–20 | Anexo I, gráficos 1–3: instrumental, tablero, postura, espejos, cinturón | §3 |
| 21 | Anexo I, gráfico 4: cajón de 6 m con franjas de 15, 25 y 50 cm | §6 |
| 22–33 | Anexo II: definición y forma de evaluación de cada falla | §5 |
| 34–40 | Anexo III: circuitos de examen (comunas 2–7 y 9–15) | F01-T04 |
| 41–42 | Contratapa | No instructivo |

## 3. Desarrollo del examen

**Condiciones generales (PDF 6–8).**

- **Vehículo y aspirante:** vehículo con doble comando (freno y embrague) del lado del acompañante. Aspirante habilitado para B.1 (desde los 17 años, con los requisitos del art. 3.2.8 f de la Ley 2148), con el teórico aprobado y sin signos de alcohol ni de sustancias psicoactivas.
- **Durante todo el examen:**
  - luces bajas encendidas;
  - obedecer al examinador/a y a la autoridad de tránsito;
  - no usar equipos de comunicación, auriculares ni reproductores de video, ni siquiera con el vehículo detenido;
  - límite de examen de **30 km/h en calles y 45 km/h en avenidas**, o el límite más restrictivo que fijen la señalización o la normativa.
- **Desaprobación:** queda desaprobado quien sigue indicaciones de terceros no autorizados (PDF 8) y quien pide interrumpir el examen (PDF 8).
- **Interrupción por conducta (PDF 7):** el examen se interrumpe y se desaprueba ante conductas riesgosas por inseguridad, miedo o pánico.
- **Clima (PDF 6):** se recomienda suspender el examen si el clima impide hacerlo con seguridad. Es una suspensión, no una falla.
- **Volver a rendir (PDF 14):** se rinden las tres etapas completas.

**Etapa I — Comprobaciones previas (PDF 9–10).**

1. **Familiarización sin falla:** el/la examinador/a muestra los comandos de iluminación e instrumental, y el/la aspirante puede probar pedalera y caja y hacer preguntas.
2. **Evaluación:** se hace con el vehículo detenido en el cajón, el motor apagado y la llave en contacto. Comprende:
   - reconocer la pedalera, la caja, las luces (de posición, bajas, altas, direccionales y balizas) y el instrumental (desempañador, limpiaparabrisas, bocina, luneta térmica, AC/CA);
   - regular asiento, apoyacabezas y espejos;
   - colocarse el cinturón;
   - desbloquear: caja en neutro (manual) o en P/N (automática) y freno de mano liberado antes de moverse.
3. **Referencias de postura (gráfico 3, PDF 20):**
   - manos a las 9:15 y brazos semiflexionados (10:10);
   - piernas semiflexionadas con el pedal a fondo;
   - apoyacabezas con la parte superior a la altura de la cabeza y el centro a la altura de los ojos;
   - el lado interno del espejo lateral muestra el comienzo del vehículo, reflejando solo el 10% de su parte trasera;
   - cinturón con la banda superior por la clavícula y la inferior sobre la cadera.

**Etapa II — Circulación en tránsito (PDF 10–12).**

1. **Corte previo:** si al llegar a esta etapa ya suma **8 puntos o más**, no sale a circular. El examen se interrumpe y queda desaprobado (PDF 10).
2. **Maniobrabilidad dentro del cajón (PDF 11):**
   - **Retroceder 30 cm** sin mover el volante. En manual, solo con el embrague, sin acelerador ni freno (puede frenar al final); en automática, regulando solo con el freno.
   - **Avanzar 30 cm** en primera o D, sin girar el volante y en una sola maniobra.
3. **Salida del cajón (PDF 11):** con direccional, chequeando los espejos (puede girar la cabeza) y en forma fluida. La salida admite hasta dos maniobras: retroceso, y giro con avance.
4. **Primeros 100 m (PDF 11, 31):** a no más de 30 km/h, en segunda (manual) o en D (automática). El/la examinador/a avisa cuándo empieza y cuándo termina la prueba.
5. **Circuito (PDF 10):**
   - recorrido preestablecido de unos **15 minutos**, por vías con máximas de 20 a 60 km/h;
   - ante cortes o desvíos, el/la examinador/a indica una alternativa que conserve el circuito.
6. **Qué se evalúa (PDF 11–12):**
   - dominio de los mandos;
   - posición en el carril y velocidades máxima, mínima y precautoria;
   - distancia de 2 s;
   - semáforos y señales;
   - vehículos de emergencia;
   - uso de las dos manos en el volante y de la bocina;
   - detención antes de la línea;
   - no bloquear el cruce;
   - prioridades;
   - PARE con detención completa;
   - giros desde el carril correcto, con direccional 30 m antes y reduciendo la velocidad;
   - cambios de carril solo donde está permitido, con espejos y direccional 3 s antes.

**Etapa III — Estacionamiento paralelo y descenso (PDF 13, 24–25).**

1. **Aviso:** cien metros antes, el/la examinador/a indica que va a estacionar.
2. **Maniobra:** circula por el carril contiguo al cajón y enciende las balizas al menos 3 s antes de detenerse en doble fila. Hasta 3 maniobras:
   1. alinearse;
   2. retroceder girando a la derecha y luego a la izquierda para ingresar;
   3. posicionarse avanzando.
3. **Posición final:** centrado y paralelo, a unos **20 cm** del cordón, sin subir a la vereda ni tocar los elementos.
4. **Finalización:** avisa que terminó; deja la caja en N (manual) o en P (automática), con freno de mano. Después apaga las luces bajas y el motor, retira la llave, bloquea la dirección y baja mirando el espejo antes de abrir la puerta.

## 4. Puntaje, resultado e interrupción

| Tipo | Puntos | Definición (PDF 14) |
|---|---:|---|
| Leve | 1 | Desconocimiento o comportamiento que no incumple normas, o falta leve señalada para corregir. |
| Deficiente baja | 2 | Manejo incorrecto de los mandos o incumplimiento que obstaculiza a otras personas usuarias. |
| Deficiente alta | 3 | Impericia en la maniobrabilidad o incumplimiento que obstaculiza notablemente, sin llegar a ser eliminatorio. |
| Eliminatoria | 8 | Incapacidad total de dominar el vehículo o falta de apego a las normas que genera peligro potencial. |

- **Acumulación:** el puntaje se acumula en todo el examen, sin importar la etapa (PDF 14).
- **Aprobado:** solo si se **completan las tres etapas** con un total **≤ 7**. Con **≥ 8**, desaprobado. Una eliminatoria desaprueba por sí sola (PDF 14).
- **Resultado e interrupción son estados distintos.** Interrumpen el examen, y el/la examinador/a toma el control:
  - eliminatorias a–k y q (PDF 33);
  - cualquier uso del doble comando por emergencia o para evitar una colisión o un atropello (PDF 7). Esto incluye los escalamientos de las deficientes altas e, l, n, o y p;
  - llegar con 8 puntos o más a la circulación (PDF 10);
  - conducción temeraria (PDF 14);
  - inseguridad, miedo o pánico (PDF 7);
  - pedido del aspirante (PDF 8).
- **Desaprueban sin interrumpir:** las eliminatorias l, m, n, o, p y r se consignan, el examen sigue y la descalificación se informa al terminar (PDF 32–33).

Modelo para el motor de reglas:

```text
ExamState = { stage: I|II|III, points: int, faults: Fault[], interrupted: bool, interruptionCause?, examinerControl: bool }
Result    = APPROVED     si las etapas I, II y III se completaron y points <= 7
          = DISAPPROVED  en cualquier otro caso (points >= 8, interrupción, pedido del aspirante, indicaciones de terceros)
```

## 5. Catálogo de fallas

69 ítems del anexo II, cada uno con un id estable en `catalog/rules.json`. La ficha tiene 80 filas porque algunas conductas aparecen en más de una etapa o grupo; el juego las trata como **una sola regla** con varios contextos. Ejemplos: «Cruza con el semáforo en rojo» figura en «Durante la circulación» y en «Cruce en intersecciones», y los roces y el subir al cordón figuran en las etapas II y III. Las conductas marcadas con ⚠ tienen discrepancias (§7).

Políticas de repetición, según el texto del anexo II:

- **una vez:** una sola falla aunque haya varios errores (p. ej., «independientemente de la cantidad de errores», PDF 22 y 25);
- **cada vez:** una falla por ocurrencia («cada vez que esto ocurra», PDF 23, 26–28);
- **por episodio:** si el error persiste sin que lo advierta, el/la examinador/a observa «sin considerarlo una nueva falla» (PDF 23);
- **control único:** la conducta se evalúa en un único momento del examen;
- **no especifica:** el protocolo no dice si se repite; ver §7, decisión D3.

### Leves (1 punto)

| Ítem | Conducta (ficha) | Etapa | Repetición | Interrumpe | Páginas |
|---|---|---|---|---|---|
| a | No reconoce el sistema de iluminación (luces de posición, bajas, altas, direccionales y balizas) | I | una vez | no | 9, 15, 22 |
| b | No reconoce el instrumental (desempañadores, limpiaparabrisas, bocina, luneta térmica, AC/CA) | I | una vez | no | 9, 15, 22 |
| c | No regula el asiento en caso de ser necesario | I | una vez | no | 9, 15, 22 |
| d | No regula apoyacabezas en caso de ser necesario | I | una vez | no | 9, 15, 22 |
| e | No verifica que la caja de cambios esté sin cambio (punto neutro/parking) | I | control único | no | 10, 15, 22, 23 |
| f | Inicia la marcha con el freno de mano colocado | I | por episodio | no | 10, 15, 23 |
| g | Arranque excedido en tiempo | II | por episodio | no | 15, 16, 23 |
| h | Intenta poner en marcha el motor cuando está encendido | II | por episodio | no | 15, 16, 23 |
| i | Roza el cordón con la rueda | II/III | cada vez | no | 15, 17, 23 |
| j | No utiliza la luz direccional correspondiente antes de salir | II | control único | no | 11, 15, 23 |
| k | Detención innecesaria | II | no especifica | no | 16, 23 |
| l | Circula por debajo de la velocidad mínima sin necesidad o demanda del tránsito | II | no especifica | no | 16, 23, 24 |
| m | Toca la bocina innecesariamente o no lo hace cuando fuese necesario | II | no especifica | no | 16, 24 |
| n | Pasa la loma de burro, el reductor de velocidad o la cuneta, de manera imprudente, dando saltos o rozando la carrocería | II | no especifica | no | 16, 24 |
| o | No mantiene la velocidad precautoria | II | no especifica | no | 16, 24 |
| p | No circula correctamente por el carril correspondiente | II | no especifica | no | 12, 16, 24 |
| q | Se ubica en el carril de giro y señaliza la maniobra pero a menos de 30 mts de la bocacalle | II | no especifica | no | 12, 17, 24 |
| r | Estaciona en más de 3 maniobras (1-alinearse; 2-girar y retroceder; 3-posicionamiento) | III | una vez | no | 13, 17, 24, 25 |
| s | Posición final del vehículo descentrada y/o inclinada dentro del cajón | III | una vez | no | 13, 17, 25 |
| t | Finaliza la maniobra entre el cordón y la primera delimitación | III | una vez | no | 13, 17, 21, 25 |
| u | Finaliza la maniobra sobre la segunda delimitación | III | una vez | no | 13, 17, 21, 25 |
| v | No apaga las luces bajas del vehículo | III | control único | no | 17, 25 |
| w | No coloca en punto neutro (manual) o en posición de estacionamiento "P" (automático) | III | control único | no | 13, 17, 25 |
| x | No acciona el freno de mano | III | control único | no | 13, 17, 25 |
| y | No apaga el motor, no quita la llave y no bloquea la dirección | III | una vez | no | 13, 17, 25 |

### Deficientes bajas (2 puntos)

| Ítem | Conducta (ficha) | Etapa | Repetición | Interrumpe | Páginas |
|---|---|---|---|---|---|
| a | Hace uso incorrecto del cinturón de seguridad ⚠ | I | una vez | no | 10, 15, 26 |
| b | Arranque brusco o a saltos | II | cada vez | no | 15, 16, 26 |
| c | Aceleración en vacío | II | cada vez | no | 15, 16, 26 |
| d | Apagado del motor | II | cada vez | no | 15, 16, 26 |
| e | Frenada innecesaria | II | no especifica | no | 16, 26 |
| f | No conduce con ambas manos sobre el volante, salvo al accionar algún comando o necesidad | II | cada vez | no | 12, 16, 26 |
| g | No acciona las luces direccionales correspondientes | II | cada vez | no | 12, 17, 26 |
| h | No utiliza las luces direccionales o utiliza las incorrectas | II | cada vez | no | 12, 17, 27 |
| i | No advierte con anticipación la maniobra utilizando balizas | III | control único | no | 13, 17, 27 |
| j | No mira el tránsito antes de descender del vehículo | III | control único | no | 13, 17, 27 |

### Deficientes altas (3 puntos)

| Ítem | Conducta (ficha) | Etapa | Repetición | Interrumpe | Páginas |
|---|---|---|---|---|---|
| a | No controla la posición de los espejos retrovisores | I | control único | no | 10, 15, 27 |
| b | No logra retroceder 30 cm. | II | control único | no | 11, 15, 27 |
| c | No logra avanzar 30 cm. | II | control único | no | 11, 15, 27, 28 |
| d | Roza los elementos de demarcación del cajón | II/III | cada vez | no | 15, 17, 28 |
| e | No chequea los espejos o no gira la cabeza para verificar una salida segura | II | control único | si interviene el doble comando | 11, 15, 28 |
| f | Supera la velocidad de examen | II | no especifica | no | 8, 10, 16, 28 |
| g | No mantiene la distancia mínima de seguridad | II | no especifica | no | 12, 16, 28 |
| h | Se detiene invadiendo la senda peatonal o traspasando la línea de detención | II | no especifica | no | 12, 16, 28 |
| i | Bloquea, parcial o totalmente, la encrucijada. | II | no especifica | no | 12, 16, 28, 29 |
| j | No respeta las señales de Pare y/o Ceda el paso | II | no especifica | no | 12, 16, 29 |
| k | No respeta la prioridad de paso en esquinas no semaforizadas | II | no especifica | no | 12, 16, 29 |
| l | No cede el paso a peatones y a ciclistas que se encuentren cruzando | II | no especifica | si interviene el doble comando | 12, 16, 17, 29 |
| m | No reduce la velocidad para efectuar el cruce con seguridad en esquinas no semaforizadas | II | no especifica | no | 12, 16, 17, 29 |
| n | No se ubica en el carril más próximo al sector donde se pretenda girar ⚠ | II | no especifica | si interviene el doble comando | 12, 17, 29 |
| o | No verifica mediante el uso de espejos la aproximación de otro vehículo al realizar la maniobra | II | no especifica | si interviene el doble comando | 12, 17, 29 |
| p | No chequea los espejos retrovisores y/o no gira la cabeza | III | no especifica | si interviene el doble comando | 13, 17, 29, 30 |

### Eliminatorias (8 puntos)

| Ítem | Conducta (ficha) | Etapa | Repetición | Interrumpe | Páginas |
|---|---|---|---|---|---|
| a | No reconoce pedalera (embrague, freno y acelerador) | I | una vez | sí | 9, 15, 30 |
| b | No sabe reconocer o manipular la caja de cambios | I | una vez | sí | 9, 15, 30 |
| c | No se coloca el cinturón de seguridad o se lo quita durante el examen | I | una vez | sí | 10, 15, 30 |
| d | Se sube al cordón; golpea o derriba los elementos de delimitación del cajón de estacionamiento | II/III | una vez | sí | 13, 15, 17, 30, 31 |
| e | No obedece órdenes e indicaciones de la autoridad de control de tránsito | II | una vez | sí | 8, 11, 16, 31 |
| f | No sigue indicaciones de seguridad del evaluador | II | una vez | sí | 8, 11, 16, 31 |
| g | No respeta la indicación de marcha durante la primer cuadra | II | una vez | sí | 11, 16, 31 |
| h | No mantiene el control del vehículo | II | una vez | sí | 16, 31 |
| i | Realiza maniobras temerarias que generan riesgo o incidentes de tránsito | II | una vez | sí | 14, 16, 31, 32 |
| j | Circula por vías, carriles o sentidos no permitidos | II | una vez | sí | 12, 16, 32 |
| k | Cruza con el semáforo en rojo | II | una vez | sí | 12, 16, 32 |
| l | Supera la velocidad máxima | II | una vez | no (se informa al final) | 12, 16, 32 |
| m | Utiliza celular, auriculares y/o reproductores de video durante la conducción | II | una vez | no (se informa al final) | 8, 12, 16, 32 |
| n | No cede el paso a vehículos de emergencia | II | una vez | no (se informa al final) | 12, 16, 32 |
| o | No respeta la demarcación horizontal que prohíbe la maniobra (línea continua) | II | una vez | no (se informa al final) | 12, 17, 32, 33 |
| p | Sobrepasa por la derecha o en zonas prohibidas | II | una vez | no (se informa al final) | 12, 17, 33 |
| q | Estaciona en más de 2 intentos | III | una vez | sí | 13, 17, 33 |
| r | Finaliza la maniobra por fuera de la segunda delimitación | III | una vez | no (se informa al final) | 17, 21, 33 |

## 6. Parámetros numéricos

| Parámetro | Valor | Fuente |
|---|---|---|
| Límite de examen | 30 km/h en calles; 45 km/h en avenidas; menor si la vía lo fija | PDF 8, 10, 28 |
| Primeros 100 m | ≤ 30 km/h, en 2.ª (manual) o en D (automática) | PDF 11, 31 |
| Desplazamientos en el cajón | retroceder 30 cm; avanzar 30 cm | PDF 11, 27 |
| Salida del cajón | hasta 2 maniobras (retroceso; giro y avance) | PDF 11 |
| Direccional para girar | 30 m antes de la bocacalle; carril de giro ≥ 30 m antes | PDF 12, 24, 26 |
| Direccional para cambiar de carril o sobrepasar | ≥ 3 s antes | PDF 12, 27 |
| Distancia de seguridad | 2 s | PDF 28 |
| Balizas para estacionar | ≥ 3 s antes de detenerse en doble fila | PDF 13, 27 |
| Aviso de estacionamiento | 100 m antes del cajón | PDF 24 |
| Cajón | 6 m de largo; 1.ª línea de 15 a 25 cm del cordón (correcto); 2.ª línea de 25 a 50 cm (leve); fuera de la 2.ª, más de 50 cm (eliminatoria); objetivo ~20 cm | PDF 13, 21, 25, 33 |
| Inclinación | falla si los dos ejes difieren > 30 cm respecto del cordón | PDF 25 |
| Maniobras e intentos de estacionamiento | > 3 maniobras: leve; > 2 intentos: eliminatoria | PDF 24–25, 33 |
| Duración del recorrido | ~15 min (no es contrarreloj) | PDF 10 |
| Máximas de las vías del circuito | entre 20 y 60 km/h | PDF 10 |

## 7. Discrepancias, vacíos y decisiones

**Discrepancias del propio protocolo.**

| Id | Caso | Detalle | Decisión |
|---|---|---|---|
| X1 | Cinturón mal colocado | La ficha (PDF 15) y el encabezado del anexo (PDF 26) dicen deficiente baja, 2 puntos; el cuerpo del ítem dice «una (1) falla leve» (PDF 26). | Se adopta **deficiente baja (2)**: ficha y encabezado coinciden, y la ficha es el instrumento de puntaje (PDF 15). Mostrarlo como discrepancia de la fuente en la devolución. |
| X2 | No ubicarse en el carril más próximo para girar | La ficha (PDF 17) y el encabezado (PDF 27) dicen deficiente alta, 3 puntos; el cuerpo dice «falla eliminatoria» (PDF 29). | Se adopta **deficiente alta (3)**, escalando a eliminatoria con interrupción si interviene el doble comando, como dice el mismo ítem. Mismo criterio que X1. |
| X3 | Línea que prohíbe cambiar de carril | PDF 12 menciona «líneas continuas blancas o doble línea amarilla»; la eliminatoria o (PDF 33) solo nombra líneas continuas blancas. | Se aplica a ambas demarcaciones, porque PDF 12 enumera los dos casos en que no puede hacerse. Señalarlo como interpretación. |
| X4 | Dispositivos con el vehículo detenido | PDF 8 los prohíbe aun detenido; la eliminatoria m (PDF 32) habla de usarlos «durante la conducción». | Se puntúa la eliminatoria solo durante la conducción y el uso detenido se muestra como advertencia. Señalarlo como interpretación. |
| X6 | Espejos y giro de cabeza al salir del cajón | La ficha (PDF 15) y el anexo (PDF 28) dicen «no chequea los espejos **o** no gira la cabeza»; el desarrollo (PDF 11, 28) exige los espejos y presenta el giro de cabeza como eventual («en caso de necesitarlo»). | No chequear los espejos **siempre** es falla (def. alta e); no girar la cabeza solo lo es cuando la situación lo requiere (p. ej., un punto ciego con tránsito que se acerca). Una salida sin espejos nunca queda sin puntuar. |
| X7 | Espejo al descender | PDF 13 («mirando por el espejo retrovisor antes de abrir la puerta») y PDF 27 («deberá mirar por el espejo retrovisor lateral izquierdo») exigen el espejo; la frase de falla de PDF 27, «no observa a través del espejo retrovisor y/o gira la cabeza», es ambigua. | No mirar el espejo **siempre** es falla (def. baja j); girar la cabeza es un complemento y no lo reemplaza. |
| X5 | «Primera cuadra» frente a 100 m | La ficha dice «primer cuadra» (PDF 16); el anexo y la etapa II dicen 100 m (PDF 11, 31). | Rige **100 m**, la medida explícita. |

**Vacíos: el protocolo no fija un valor.**

| Id | Caso | Tratamiento en el juego |
|---|---|---|
| V1 | Exactamente 15, 25 o 50 cm del cordón | t: «menos de 15»; u: «más de 25 y menos de 50»; r: «más de 50». Los valores exactos 15 y 25 quedan dentro de la 1.ª línea (correcto). **50 cm exactos no está definido**; se asigna a la 2.ª línea (leve), el resultado menos severo compatible con ambos textos, y se documenta en la devolución. En `rules.json`, `parkingBands` fija la partición: `< 15` t; `[15, 25]` correcto; `(25, 50]` u; `> 50` r. El validador exige que las franjas cubran todas las distancias sin huecos ni solapes. |
| V2 | Tolerancia de «retroceder/avanzar 30 cm» | El protocolo solo dice «mayor o menor a 30 cm». Se usa un parámetro `displacementToleranceCm`, fijado en F03-T04 en **10 cm** (`GAME_PARAMETERS`, `src/exam/session.ts`), y se muestra como **aproximación del juego**, no como regla oficial. |
| V3 | «Descentrado» | Sin umbral numérico. Desde F04-T04: la posición final está descentrada cuando el centro de la carrocería queda a más de **0,5 m** del centro del cajón a lo largo del cordón (`PARKING.offCentreM`, `src/exam/parking.ts`); 0,5 m exactos no es falla. Es una aproximación del juego, como V2. |
| V4 | Salida del cajón con más de 2 maniobras | PDF 11 la define como no fluida, pero no hay falla en la ficha ni en el anexo. No se puntúa; la devolución lo informa como observación. |
| V5 | Ancho del cajón | El gráfico 4 da 6 m de largo y franjas, pero no el ancho del espacio ni la distancia entre vallas. Se toma de la geometría del circuito en F01-T04 o se registra como aproximación. |
| V6 | Repetición «no especifica» | Ver D3. |
| V7 | Velocidad de examen frente a máxima de la vía | Son fallas distintas (f: 3 puntos; l: 8). El protocolo no dice si un mismo exceso consigna ambas. Ver D2. |

**Decisiones del proyecto.** No son reglas del protocolo; se identifican así en la interfaz.

- **D1.** Una conducta que aparece en varias filas de la ficha es una sola regla; se consigna según el contexto en que ocurre, nunca dos veces por el mismo hecho.
- **D2.** Un episodio de exceso de velocidad consigna **l** (eliminatoria) si supera la máxima de la vía; si solo supera el límite de examen, consigna **f**. No se suman ambas por el mismo episodio. Como l ya desaprueba, el resultado es el mismo; la decisión solo evita una devolución duplicada.
- **D3.** Las reglas con repetición «no especifica» se consignan **una vez por episodio distinto**. Un episodio termina cuando la conducta se corrige o cambia el contexto (otra cuadra, otra intersección, otra maniobra). El criterio es configurable y se muestra en la devolución.
- **D5.** El corte de 8 puntos antes de la circulación (PDF 10, «si al llegar a esta etapa») se aplica en el juego hasta que el auto se mueve por primera vez en la etapa II (0,2 m/s); a partir de ahí los puntos se acumulan y se informan al final (PDF 14). Es una interpretación del proyecto: el protocolo no fija el instante exacto.
- **D4.** Los parámetros de aproximación (V2, V3) y la interpretación de la observación (mirar espejos o girar la cabeza según la orientación de la cámara y el espejo seleccionado) se presentan como práctica virtual, como establece la propuesta (§4).
- **D6 (F04-T03).** Los umbrales de disparo de las fallas de circulación que el protocolo enuncia sin cifra («velocidad precautoria», «reduce la velocidad», «distancia mínima», «detención innecesaria», «velocidad mínima», «bloquea la encrucijada», «pasa el lomo de burro de manera imprudente», «pierde el control», «maniobra temeraria») son decisiones del juego, listadas en §9 con su valor, y se muestran en la devolución como aproximaciones. Cambiarlos no cambia el protocolo.
- **D7 (F04-T03).** La toma de control por doble comando (PDF 7) se dispara cuando el auto ya no puede evitar por frenado a un actor que tiene de frente (§9). Eleva a eliminatoria, con interrupción atribuida al examinador, la última deficiente alta escalable consignada en los últimos 10 s (e, l, n, o); si no hay ninguna, consigna la eliminatoria i (maniobra temeraria) con la misma interrupción. Un atropello real de peatón o ciclista eleva la alta l del mismo episodio; un choque contra un vehículo consigna la eliminatoria i. En todos los casos la causa registrada de la interrupción es `examiner`, no `fault`. La toma de control se aplica aunque una falta del mismo paso ya haya interrumpido: esa falta se consigna, se suma la elevación o la eliminatoria i y la interrupción se atribuye al examinador.
- **D8 (F04-T03).** Un episodio de velocidad (D2, D3) termina al volver por debajo del límite o al entrar en otro tramo del recorrido; cada tramo es un contexto distinto. La línea continua de la eliminatoria o es el borde izquierdo de la calzada de examen de Av. Cabildo, junto al Metrobús (X3); circular sobre el Metrobús o sobre la ciclovía es la eliminatoria j (carril exclusivo), igual que ir a contramano. Cruzar la línea y además entrar al Metrobús consigna o y j: son dos hechos (la maniobra prohibida y la circulación por un carril exclusivo).
- **D9 (F04-T03).** Con el cajón de F04-T01 a 20 m del inicio del tramo 1 (aproximación declarada en CIUDAD.md), los primeros 100 m terminan unos 3 m después de la línea de Av. Cabildo. Las reglas de la esquina rigen igual durante los primeros 100 m; solo la velocidad se juzga por la eliminatoria g en vez de f/l (D1), siempre con el máximo de 30 km/h de la consigna, aunque esos últimos metros ya estén sobre Cabildo (45 km/h). Si el relevamiento mueve el cajón, el examinador no cambia.
- **D10 (F04-T04).** El aviso de estacionamiento se da **100 m antes de la línea delantera del cajón**, medidos en distancia de vuelta (`circuit.bay.frontS`, PDF 24), solo cuando el auto ya entró al último tramo. Con el cajón a 20 m del inicio del tramo 1, el aviso llega todavía sobre Vuelta de Obligado (tramo 8), unos 80 m antes de la esquina de Quesada; la etapa II sigue juzgándose hasta esa esquina y el aviso permanece en el HUD con la distancia. Al entrar al tramo 1 termina la etapa II y empieza la fase de estacionamiento con su propia indicación. Si el relevamiento mueve el cajón, el aviso se mueve con él.
- **D11 (F04-T04).** La **doble fila** es la primera detención en doble fila dentro de la zona del cajón: entre 8 m antes y 12 m después de su centro a lo largo del cordón, con el centro de la carrocería a no más de 5 m a la izquierda de la línea central del cajón; ahí se juzgan las balizas (baja i: encendidas sin cortes desde al menos 3 s antes de esa detención; 3 s exactos cumple). «En el cajón» es tener el centro a menos de 1 m de su línea central y dentro de su largo más 2 m; «en doble fila» es tenerlo a 1,2 m o más a la izquierda. Una detención antes de la zona, o dentro del cajón mismo (entrando de frente), no empieza la maniobra.
- **D12 (F04-T04).** **Maniobras:** la alineación en doble fila es la primera; avanzar antes de la primera marcha atrás sigue siendo alinearse; desde la primera marcha atrás, cada cambio de sentido con movimiento (más de 0,05 m/s) es una maniobra nueva; una pausa en el mismo sentido no lo es. La cuarta consigna la leve r, una sola vez. **Intentos:** uno, más uno cada vez que el auto, habiendo estado en el cajón, vuelve a la doble fila; el tercero consigna la eliminatoria q e interrumpe. Un segundo intento suma maniobras (sacar el auto y volver a entrar), así que lleva también la leve r: son dos hechos distintos (PDF 24–25 y 33).
- **D13 (F04-T04).** El cajón de la ciudad no tiene vallas: las **líneas pintadas** de sus extremos hacen de elementos de demarcación, en el tramo que va desde el borde del cordón hasta 1,2 m hacia la calzada (`MARKER_REACH_M`, donde estarían los postes). Cada vez que la carrocería empieza a pisar una es un roce (alta d, por ocurrencia); si lo hace a 1 m/s o más es un golpe (eliminatoria d, interrumpe), el mismo umbral que los postes de la etapa I (`markerKnockSpeedMps`). El cordón sigue siendo el colisionador de F04-T01: tocarlo por debajo de 1 m/s es la leve i y por encima, subirse a la vereda (eliminatoria d), como en la etapa I. La posición final se mide desde el lado derecho de la carrocería hasta el borde del cordón en cada eje (PDF 21), redondeada a la milésima de centímetro para que el ruido de coma flotante no cambie de franja (V1); cada eje se clasifica por `parkingBands` y cada regla distinta se consigna una vez (un eje a menos de 15 cm y el otro sobre la segunda franja consignan t y u). La inclinación es una diferencia entre ejes mayor a 30 cm (30 cm exactos no es falla).
- **D14 (F04-T04).** La maniobra termina cuando el aspirante **avisa** («Terminé de estacionar», PDF 13) con el auto detenido; el aviso en movimiento se ignora. El aviso se toma solo después de la marcha atrás de un intento empezado en doble fila; antes se ignora, como en movimiento. El chequeo de espejos de la alta p pide dos momentos (PDF 13: «al momento de detenerse en doble fila como así también antes y durante toda la maniobra de marcha atrás»): una mirada a un espejo lateral (D4) o un giro completo de la cabeza hacia atrás (más de 2 rad, PDF 29) entre la detención en doble fila y el comienzo de la marcha atrás, y otra durante la marcha atrás; una mirada posterior no cuenta. «Durante toda» la marcha atrás se aproxima con una mirada mientras dura. Un episodio por intento. El descenso se juzga de una vez al abrir la puerta (acción nueva «Abrir la puerta y bajar»): caja en N (manual) o P (automática), freno de mano, luces bajas apagadas (las de posición pueden quedar), motor apagado con la llave retirada —el juego no tiene mando de bloqueo de dirección: la llave afuera con el motor apagado equivale a bloquearla— y una mirada al espejo izquierdo (X7; el espejo derecho o girar la cabeza no la reemplazan). Quitarse el cinturón durante la maniobra es la eliminatoria c; después de la posición final se permite, porque hay que bajar. Dos aproximaciones del tránsito acompañan la maniobra: a menos de 25 m del cajón, los actores dejan 8 m detrás de un auto que va a menos de 2,5 m/s y no se le acercan mientras retrocede hacia ellos; y ningún peatón baja del cordón delante del auto que arranca a menos de 6 m de la senda.
- **D15 (F04-T05).** **Ayudas por modo.** Lo que el examinador dice en voz alta se muestra en todos los modos: la consigna de cada fase (PDF 9–13), la indicación de la próxima esquina (PDF 12: el giro se indica antes de la esquina) y el aviso de estacionar 100 m antes del cajón (PDF 24); el tramo y la calle actuales también, como sustituto del cartel de la calle que la ciudad no tiene. Todo lo demás es una ayuda que el aspirante real no recibe y se oculta en el modo **rendir**: los puntos y la lista de fallas en vivo (el protocolo los informa al terminar, PDF 14), el aviso del control que viene («semáforo en rojo a N m», PARE, esquina sin semáforo, lomo de burro, ambulancia), el límite de examen y la máxima de la vía, las mediciones del cajón (30 cm, maniobras de salida, máxima en los primeros 100 m), el estado del semáforo en el tablero, los contadores de maniobras e intentos, la distancia al cordón y la lista «Para bajar». Los modos **recorrer**, **practicar** y **aprender** muestran esas ayudas del tablero y el **paso a paso** (F04-T05-FIX01): qué hacer en la fase actual y con qué teclas, junto al examinador, y la lista de pasos de las etapas en juego; **aprender** agrega, por fase, qué reglas y umbrales se evalúan, y explica cada falla al momento. La **referencia de teclas** (qué hace cada tecla y cómo responden pedales, volante, caja y vista) se muestra en los cuatro modos, también en rendir: es del juego y no del examen, porque el aspirante real ya maneja los mandos físicos. Las teclas de la guía son las que el jugador configuró. La interrupción y la toma de control (D7) rigen igual en los cuatro modos. Practicar una sola etapa nunca aprueba ni desaprueba: el resultado queda pendiente, porque aprobar exige las tres etapas (PDF 14). El modo aprender no se guarda en la bitácora; los otros tres sí.

## 8. Examen teórico

| Parámetro | Valor | Fuentes |
|---|---|---|
| Cantidad de preguntas | 40, tomadas al azar de un banco por tipo de examen | Disp. 860/2023, p. 96; informe 2024, p. 17 («pasó de 30 a 40»); página oficial «nueva modalidad» |
| Formato | opción múltiple con tres opciones y una sola correcta | Disp. 860/2023, p. 96; página oficial de material de estudio |
| Aprobación | ≥ 85%, es decir 34 de 40 correctas | Disp. 860/2023, p. 96; página «nueva modalidad» («34 de 40») |
| Tiempo | **45 minutos**. Discrepancia: el informe 2024 dice que «se redujo de 45 a 40 minutos». | 45: Disp. 860/2023, p. 96, y página oficial de material de estudio (consultada el 2026-10-11). 40: informe 2024, p. 17. |
| Intentos | 3 por clase y trámite; 5 días hábiles de espera tras reprobar | Disp. 860/2023, p. 96 |
| Tipo para B | «Teórico 3: todas las subclases B» | Disp. 860/2023, p. 96 |

**Decisión sobre el tiempo:** el simulacro usa **45 minutos por defecto**, porque coinciden la norma de procedimiento y la página oficial vigente de material de estudio. Además ofrece **40 minutos** como variante «más exigente», que remite al informe 2024. Los tres parámetros (preguntas, umbral y tiempo) son configuración versionada con su fuente (`catalog/theory-exam.json`, desde F05-T05), y la interfaz no los presenta como certificados. El simulacro es propio y no es el banco oficial.

Fuentes web consultadas el 2026-10-11:

- [Material de estudio para examen teórico](https://buenosaires.gob.ar/infraestructura/movilidad/curso-de-educacion-vial-para-otorgamiento-de-licencia/material-de-estudio-para-examen-teorico)
- [Conocé la nueva modalidad de otorgamiento de licencias](https://buenosaires.gob.ar/gcaba_historico/licenciasdeconducir/conoce-la-nueva-modalidad-de-otorgamiento-de-licencias-de-conducir)
- [Examen práctico](https://buenosaires.gob.ar/gobierno/licencias-de-conducir/examen-practico)
- [Disposición 860/2023, anexo](https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-DIS-UPFYDT-DGHC-860-23-ANX.pdf)
- [Informe final de gestión, anexo](https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-RES-SECGVC-SECGVC-109-24-ANX.pdf)
- [Nota de 2019](https://buenosaires.gob.ar/gcaba_historico/noticias/se-renovo-la-forma-de-obtener-la-licencia-de-conducir-en-buenos-aires): versión anterior de 30 preguntas y 45 minutos; solo se usa como antecedente.

## 9. Lo que el juego aproxima

El protocolo evalúa conductas físicas que el juego solo puede representar: la mirada, la postura, las manos en el volante y la regulación del asiento. Como establece la propuesta (§4), esas fallas se evalúan con acciones virtuales y se identifican como práctica, no como equivalente al examen real. También son decisiones del juego, y no del protocolo, los criterios de disparo siguientes (D6 y D7), implementados en `src/exam/circulation.ts` (`CIRCULATION`) y probados en `src/exam/circulation.test.ts` y `src/exam/street.test.ts` (F04-T03). Cada valor se muestra en la devolución como aproximación.

| Conducta (ítem) | Fuente del ítem (`fuentes/pdf/protocolo.pdf`, PDF) | Criterio del juego (cifras: D6) | Episodio (D3) |
|---|---|---|---|
| Distancia de 2 s (alta g) | 12, 16, 28 | brecha al vehículo de adelante en movimiento (> 1 m/s) dividida por la velocidad propia menor a 2 s durante más de 1,5 s seguidos, con el auto a más de 2 m/s | tramo |
| Detención pasando la línea o la senda (alta h) | 12, 16, 28 | al detenerse, el paragolpes delantero entre 0,1 y 4,5 m después de una línea de detención, o dentro de una senda; se juzga el frente, no la cola, porque hay sendas de controles consecutivos a menos de un largo de auto | cada detención |
| Bloquea la encrucijada (alta i) | 12, 16, 28, 29 | 2 s detenido con la carrocería sobre la calzada de la calle cruzada, salvo que esté cediendo a un peatón en una senda a menos de 6 m (por la vuelta, o en línea recta cuando al doblar la distancia por la vuelta, que recorre el enlace de la esquina, es de hasta 12 m) | encrucijada |
| PARE (alta j) | 12, 16, 29 | cruzar la línea sin haber llegado a 0 m/s a menos de 3 m antes de ella, o con un vehículo cruzando el pavimento de conflicto | encrucijada |
| Prioridad sin semáforo (alta k) | 12, 16, 29 | cruzar la línea con un vehículo cruzando el pavimento de conflicto, o con uno que llega por la derecha a menos de 20 m de su propia línea a más de 0,5 m/s | encrucijada |
| Peatones y ciclistas (alta l) | 12, 16, 17, 29 | entrar en movimiento en una senda con un peatón sobre ella, o en el pavimento de conflicto con un ciclista cruzándolo (rumbo entre 45° y 135° del propio); escalable por D7 | senda o encrucijada |
| Reducir antes de girar o de un cruce sin semáforo (alta m) | 12, 16, 17, 29 | a menos de 12 m de la línea de una esquina de giro o de un cruce con prioridad de la derecha, a más de 20 km/h; en un PARE rige j | encrucijada |
| Carril de giro (alta n) | 12, 17, 29 | en calles de más de un carril, cruzar la línea de la esquina desde un carril que no es el más próximo al lado del giro; escalable por D7 | encrucijada |
| Espejos al cambiar de carril (alta o) | 12, 17, 29 | cambio de carril (el centro de la carrocería pasa a otro carril, alineado con la calle y a más de 20 m de la esquina) sin una mirada al espejo del lado (D4) en los 5 s previos; escalable por D7 | cada cambio |
| Direccional al cambiar de carril (baja h) | 12, 17, 27 | cambio de carril con la direccional de ese lado encendida hace menos de 3 s | cada cambio |
| Direccional de giro (baja g, leve q) | 12, 17, 24, 26 | al cruzar la línea de la esquina: sin direccional o con la del lado contrario, baja g; con la correcta encendida a menos de 30 m de la línea, leve q | encrucijada |
| Carril (leve p) | 12, 16, 24 | carrocería fuera de su carril por más de 0,5 m durante 3 s, alineada, en movimiento, asentada en la cuadra y lejos de la esquina; en calles de un carril el carril es toda la calzada | tramo |
| Detención innecesaria (leve k) | 16, 23 | 1 s detenido sin línea a menos de 8 m, vehículo a menos de 12 m, senda ocupada a menos de 15 m, semáforo en rojo o amarillo a menos de 30 m ni vehículo de emergencia | cada detención |
| Velocidad mínima (leve l) | 16, 23, 24 | menos de 10 km/h durante 8 s con la vía libre 30 m adelante (sin cruce, vehículo ni senda ocupada); no en los primeros 100 m | tramo |
| Bocina (leve m) | 16, 24 | presionarla sin vehículo ni senda ocupada a menos de 15 m ni peatón a menos de 15 m; la omisión no se evalúa | cada toque |
| Lomo de burro (leve n) | 16, 24 | pasar el reductor del tramo 6 a más de 20 km/h; la simulación no modela el salto | cada reductor |
| Velocidad precautoria (leve o) | 16, 24 | a menos de 15 m de una senda con un peatón, a más de 20 km/h y sin frenar (freno < 0,2) durante 0,5 s | senda |
| Pérdida de control (eliminatoria h) | 16, 31 | aceleración lateral v²·tan(δ)/batalla mayor a 6 m/s² durante 0,3 s (modelo cinemático sin deslizamiento) | — |
| Maniobra temeraria (eliminatoria i) | 7, 14, 16, 31, 32 | choque contra un vehículo, colectivo o ambulancia, o toma de control sin falla escalable (D7) | — |
| Carriles y sentidos (eliminatoria j) | 12, 16, 32 | 1 s alineado sobre la ciclovía (borde izquierdo de la carrocería 0,5 m más allá de la calzada) o sobre el Metrobús, o 1 s a contramano (más de 120° del sentido de la calle, a más de 1 m/s) | tramo |
| Línea continua (eliminatoria o) | 12, 17, 32, 33 | 0,5 s alineado con el borde izquierdo de la carrocería 0,5 m más allá de la calzada de examen de Av. Cabildo (D8) | tramo |
| Sobrepaso (eliminatoria p) | 12, 17, 33 | un vehículo que estaba adelante en la propia línea queda a la izquierda (sobrepaso por la derecha), o a la derecha mientras la carrocería está sobre una encrucijada o una senda (sobrepaso en zona prohibida), y luego atrás | — |
| Vehículo de emergencia (eliminatoria n) | 12, 16, 32 | la ambulancia del tramo 3 pasa sin que el auto esté cediendo: bajar a 10 km/h o correrse 0,7 m a la derecha del centro del carril derecho, sostenido mientras ella está a menos de 30 m detrás (un momento lento cuando estaba lejos no cuenta). La ambulancia se rinde tras 6 s detenida; si estuvo al menos 4 s detenida detrás sin que el auto cediera, también se consigna | — |
| Indicación del examinador (eliminatoria f) | 8, 11, 16, 31 | después de cruzar la línea de una esquina, superar la caja de la encrucijada en el propio rumbo sin entrar al tramo siguiente, o salir del recorrido (más de 14 m de su línea) durante 3 s en movimiento | — |
| Toma de control (D7) | 7 | actor de frente dentro del ancho de la carrocería cuya aproximación exige más de 7 m/s² para no tocarlo, con velocidad de cierre mayor a 1,5 m/s. Se aplica aunque una falta del mismo paso ya interrumpa (cruzar en rojo hacia un auto): se consignan todas, se suma la elevación o la temeraria y la interrupción es del examinador. El freno del examinador actúa desde el paso siguiente | — |

**Etapa III (F04-T04)**, implementada en `src/exam/parking.ts` (`PARKING`) y probada en `src/exam/parking.test.ts` (sintética) y `src/exam/parkingStreet.test.ts` (con guion sobre la ciudad). Decisiones D10–D14 de §7.

| Conducta (ítem) | Fuente del ítem (`fuentes/pdf/protocolo.pdf`, PDF) | Criterio del juego | Episodio |
|---|---|---|---|
| Aviso | 24 | 100 m antes de la línea delantera del cajón, en el último tramo (D10) | — |
| Balizas (baja i) | 13, 17, 27 | encendidas sin cortes 3 s o más antes de la primera detención en la zona del cajón (D11) | control único |
| Maniobras (leve r) | 13, 17, 24, 25 | la cuarta maniobra según D12 | una vez |
| Intentos (eliminatoria q) | 13, 17, 33 | el tercer intento según D12 | una vez |
| Espejos al retroceder (alta p) | 13, 17, 29, 30 | sin mirada a un espejo lateral ni giro completo de la cabeza entre la alineación y el fin de la marcha atrás | `attempt-n` |
| Roce o golpe de la demarcación (alta d, eliminatoria d) | 13, 15, 17, 28, 30, 31 | pisar el tramo de la línea pintada junto al cordón, por debajo o por encima de 1 m/s (D13) | cada vez |
| Cordón (leve i, eliminatoria d) | 13, 15, 17, 23, 30, 31 | contacto con el colisionador del cordón por debajo o por encima de 1 m/s, como en la etapa I | cada vez / una vez |
| Franjas (leve t, leve u, eliminatoria r) | 13, 17, 21, 25, 33 | lado derecho a cada eje contra el borde del cordón; `parkingBands` (V1) | una vez cada una |
| Inclinada o descentrada (leve s) | 13, 17, 25 | ejes a más de 30 cm entre sí, o centro a más de 0,5 m del centro del cajón (V3) | una vez |
| Descenso (leves v, w, x, y; baja j) | 13, 17, 25, 27 | al abrir la puerta, según D14 | control único |

**Modos y ficha (F04-T05)**, implementados en `src/exam/modes.ts`, `src/exam/card.ts` y `src/exam/session.ts` (`createPracticeSession`) y probados en `modes.test.ts`, `card.test.ts`, `practice.test.ts` y `parkingStreet.test.ts`. Decisión D15 de §7. Aproximaciones propias de los modos: la práctica de la etapa III empieza 18 m dentro de Vuelta de Obligado con el motor en marcha y la primera detención ya juzgada; la práctica de la etapa II empieza en el cajón con el motor apagado; la ficha asigna cada falla a la etapa en que se consignó (no por su instante, que coincide con el cambio de fase en la preparación); el resultado de una práctica queda pendiente.

Lo que **no se evalúa** y por qué: las dos manos en el volante (baja f: el volante se maneja con teclas, no hay modelo de manos); el celular, auriculares y reproductores (eliminatoria m: no existen en el habitáculo); la autoridad de control de tránsito (eliminatoria e: no hay agentes en la escena); el arranque excedido en tiempo (leve g) y el arranque brusco y la aceleración en vacío (bajas b, c), que siguen como en F03-T04; la omisión de bocina (parte de la leve m). En la etapa III no se modela el bloqueo de la dirección como mando propio (equivale a retirar la llave, D14), ni el examinador que baja a verificar la distancia (la medición es geométrica), ni que la puerta abierta alcance a un ciclista (solo se exige la mirada al espejo, baja j).

## 10. Cómo validar

```bash
npm run validate:content   # estructura y coherencia de catalog/rules.json (y del resto de los catálogos)
npm test                   # pruebas de los validadores (src/content/validateRules.test.ts)
```

El validador comprueba:

- puntos por severidad (1/2/3/8) y umbrales 7/8;
- el conjunto **exacto** de los 69 ítems del anexo (leves a–y, def. bajas a–j, def. altas a–p, eliminatorias a–r), con ids coherentes: si falta uno, falla;
- que las franjas de distancia al cordón (`parkingBands`) cubran de 0 a ∞ sin huecos ni solapes, y que apunten a reglas existentes;
- que solo las eliminatorias interrumpan y que los escalamientos sean eliminatorias con interrupción;
- políticas de repetición válidas;
- al menos una fila de ficha por regla;
- referencias dentro de las 42 páginas del protocolo.
