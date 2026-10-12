# Continuidad del proyecto

Actualizado: 2026-10-12. Estado: fases 1–4 fusionadas (#22–#26 en `main`; el correctivo F04-T04-FIX01, [#27](https://github.com/grunch/al-volante/pull/27), repara las vueltas guionadas que quedaron rojas en `main`); fase 5 (todo el contenido y simulacros teóricos) fusionada, incluido #33 en `9dd6d9e`. Avance por tarea y PR en `ESTADO_IMPLEMENTACION.md`; detalle de la fase 1 en `historial/FASE-1.md`.

## Trabajo puntual activo — F04-T01-FIX03

El usuario confirmó la fusión de #34 y pidió volver a revisar las fotos y mejorar gráficamente calles, árboles, edificios, semáforos, autos y personas **usando Blender**, con un nuevo PR. Rama `f04-t01-fix03-blender-detail`, base `main` en `f3d2f60`, worktree independiente. No inicia fase 6.

Se revisaron de nuevo las 35 referencias cronológicas. `scripts/blender/build_city_kit.py` construye doce familias originales y dos campos de altura en Blender 5.2; `src/assets/blender/city-kit.json` guarda las mallas evaluadas y se consume con agrupación por instancias en la ciudad. Las capturas originales no se incorporan al repositorio. Detalle, aproximaciones, reproducción y comparación visual en [DETALLE_GRAFICO_BLENDER.md](DETALLE_GRAFICO_BLENDER.md). Mantener los modelos dentro de la huella evaluada y las sombras móviles fuera del mapa estático; el ciclista necesita altura visual humana independiente del antiguo anclaje de 1,1 m.

Revisión independiente local completada: corregidos presupuesto del árbol, proporciones del ciclista y normales de las tapas de tubos. `npm run check` aprobado: 1.389 pruebas en 72 archivos, líneas 96,31 %, ramas 89,81 %, lint, formato, tipos, catálogo y build. 32 E2E focalizados aprobados, escritorio y móvil emulado; después del ajuste final del exportador, 29 pruebas afectadas, lint y build aprobados. Dos exportaciones completas dieron archivos idénticos. El detalle aumenta el renderizado local de 4,91 a 9,76 ms por cuadro congelado y el bloque del habitáculo a 533,82 kB gzip; condiciones y límites en el documento gráfico. Próximo paso: abrir el PR, solicitar Codex y CodeRabbit y comprobar la CI remota.

## Correctivo anterior fusionado — F04-T01-FIX02

El usuario confirmó la fusión de [#31](https://github.com/grunch/al-volante/pull/31), merge `9bc0257`, y pidió un manejo más real apoyado nuevamente en las fotos de `recursos/`. Rama `f04-t01-fix02-driving-realism`, base inicial `9bc0257`, actualizada con `main` (`9dd6d9e`, [#33](https://github.com/grunch/al-volante/pull/33) fusionado), worktree independiente. No inicia fase 6 ni modifica el worktree de Opus.

Implementados dirección dosificada según velocidad, inercia visual amortiguada con movimiento reducido, habitáculo nuevo con diales legibles, pantalla completa, asfalto/veredas, copas con hojas y actores reconocibles. Geometría vial, física y evaluación mantienen sus parámetros. Alcance, aproximaciones, procedencia y verificación en [EXPERIENCIA_CONDUCCION.md](EXPERIENCIA_CONDUCCION.md).

Revisión independiente local: una observación sobre manijas fuera del contorno del auto, corregida; prueba nueva cubre contorno y liberación de recursos de los cinco tipos de actor. 32 E2E de ciudad, cabina, examen y pista aprobados en Chromium con GPU, escritorio y móvil. `npm run check` aprobado: 1.350 pruebas en 68 archivos, cobertura de líneas 96,51 %, lint, formato, tipos, catálogo y build. Las 24 regresiones afectadas por la última optimización y pantalla completa también pasaron. [PR #34](https://github.com/grunch/al-volante/pull/34) publicado con implementación `404ea74`; Codex remoto completado sin observaciones sobre `404ea74` y CodeRabbit pendiente por límite horario. Seguimiento independiente local sin findings pendientes. Integración de `9dd6d9e`: conflicto únicamente en el registro operativo, resuelto conservando ambos trabajos. Integración verificada con lint, formato, tipos, build, catálogo y 51 pruebas focalizadas de aplicación, teórico, controles y cabina. CI previa de `edce114`: checks generales aprobados y E2E cancelado. Cierre: el usuario fusionó #34 en `f3d2f60` el 2026-10-12 20:51 UTC. Los checks generales y E2E terminaron aprobados después de la fusión; CodeRabbit seguía pendiente al consultarlo.

## Pedido y alcance de esta etapa

El usuario pide un juego web prolijo y creativo para estudiar TODO el manual y protocolo de licencia B, con práctico de acción 3D desde el interior del auto por Comuna 13 recorrido A. Exige Three.js y specs persistentes para que otro modelo pueda continuar. Solicitó primero una propuesta, mostrársela y escribirla como `.md` en el directorio actual. La propuesta fue aceptada. El usuario pidió ahora un plan por fases: una tarea por PR, creación secuencial, autorrevisión antes de commit/push, revisión adicional por Codex y CodeRabbit salvo agotamiento de tokens, corrección de findings y fusión autónoma cuando esté listo. PRs dependientes abiertos deben apilarse y fusionarse en orden. El inicio de CADA fase requiere indicación manual del usuario; no iniciar la fase 1 con este pedido de planificación.

## Leer primero

0. `ESTADO_IMPLEMENTACION.md`: fase activa, PRs, bloqueos y siguiente acción.
1. `PLAN_IMPLEMENTACION.md`: plan operativo vinculante, 7 fases y 32 tareas/PRs, revisiones y apilado.
2. `../PROPUESTA.md`: propuesta de producto y decisiones de arquitectura.
3. `fuentes/manifest.json`: archivos originales, páginas y hashes.
4. `fuentes/INDICE.md`: índice automatizado por página.
5. PDFs originales en `fuentes/pdf/` (hashes verificados contra `manifest.json`).

El repositorio es `grunch/al-volante`. Las rutas de este proyecto se expresan relativas a la raíz del repo; no registrar rutas del sistema de archivos local en documentos versionados (el repo es público). Desde F02-T01 hay una aplicación web (Vite, React y Three.js) con dependencias fijadas en `package.json`; ver `ARQUITECTURA.md`.

## Hecho

- Inventario de cuatro PDFs educativos: manual 200 páginas, protocolo 42, recorridos 19 y guía de siniestros 24 (`fuentes/manifest.json`, verificado con `pdfinfo`).
- Extracción con `pdftotext -layout`, conservando saltos de página. El protocolo tiene fondo decorativo que contamina la extracción; usar `pdftotext -raw` para mejorar la lectura y renderizar tablas/gráficos.
- Leídos índice, distribución B, etapas, ficha y partes del anexo de fallas. No afirmar que cada párrafo del manual o protocolo está auditado: la revisión integral pedagógica sigue pendiente.
- Inspección visual de página PDF 16 del recorrido y PDF 21 del protocolo (cajón).
- Propuesta escrita; la implementación empezó en la fase 2, con pruebas unitarias, de integración y E2E (ver `ESTADO_IMPLEMENTACION.md`).
- Búsqueda oficial exploratoria del formato teórico: resultados contradictorios respecto del tiempo. Enlaces y estado en propuesta. No se ha certificado vigencia.

## Hallazgos que no deben perderse

Referencias como «protocolo PDF n» indican archivo y página física. Las cifras se localizaron en el texto extraído o en la lámina citada; la transcripción completa y su verificación de casos frontera corresponde a F01-T03 (`REGLAS.md`).

- Ruta literal: Quesada → Av. Cabildo → Guayra → Cuba → Quesada → Cuba → Manuel Ugarte → Vuelta de Obligado → Quesada. Inicio Quesada 2381, sede Cabildo 3067 (recorridos PDF 16). Duración estimada de 15 minutos (recorridos PDF 5).
- Cuba–Quesada–Cuba **resuelto** (F01-T04, `RECORRIDO.md` §3): Cuba está desplazada 66 m en Quesada. Es izquierda por Quesada y derecha para retomar Cuba; no es una repetición ni una vuelta en U. No reabrir sin evidencia cartográfica nueva.
- Manual B: introducción, capítulos 1–5, anexos I y IV (manual PDF 3). Anexos II/III se incluyen como complemento por pedido de TODO.
- Protocolo: 1/2/3/8 puntos; hasta 7 aprobado tras completar etapas; 8 o más desaprobado (protocolo PDF 14). Desaprobación e interrupción son estados distintos (anexo II, protocolo PDF 22–33; transcripto en `REGLAS.md`).
- Límites del examen 30/45 km/h (protocolo PDF 8, 10); infracción de límite de examen no es la misma que máxima vial (anexo II, protocolo PDF 22–33; detalle en `REGLAS.md`).
- Retroceso y avance iniciales de 30 cm con restricciones de pedalera; primeros 100 m en segunda para manual (protocolo PDF 11).
- Más de tres maniobras no equivale a más de dos intentos de estacionamiento (maniobras: protocolo PDF 13, 24; intentos: PDF 17, 33).
- Cajón de 6 m, gráfico con distancias 15, 25 y 50 cm (gráfico 4, protocolo PDF 21, inspección visual) y objetivo aproximado de 20 cm (protocolo PDF 13, 25). Reglas exactas y casos frontera en `REGLAS.md` (vacíos V1–V7); no asumir tolerancias por física.
- Algunas fallas cuentan una vez, otras por repetición; hay excepciones y observaciones del examinador. Transcripción completa en `REGLAS.md` y `specs/catalog/rules.json`.
- Señales e imágenes no se recuperan completas del texto. Renderizar y revisar cada figura.
- Boleta de pago no abierta ni incorporada.

## Fase 1 cerrada

Fusionada en `main` (#1–#4 y #6; detalle en `historial/FASE-1.md`). Resultados que las fases siguientes usan:

- F01-T02: `specs/COBERTURA.md` y `specs/catalog/`, con 224 páginas, 705 unidades, 355 señales y 206 observaciones. Antes de crear contenido sobre un tema hay que resolver sus discrepancias listadas en COBERTURA (alcohol, cordón amarillo, 107/911, balizas, SRI, etc.).
- F01-T03: `specs/REGLAS.md` y `specs/catalog/rules.json`, con 69 reglas conciliadas con la ficha. Discrepancias X1–X5 (cinturón 1 o 2 puntos; carril de giro 3 u 8), vacíos V1–V7 (50 cm exactos, tolerancia de 30 cm) y decisiones D1–D4. Teórico: 40/34, 45 min configurable.
- F01-T04: `specs/RECORRIDO.md` y `specs/route/` (ODbL). Cuba–Quesada–Cuba es un desplazamiento de 66 m. OJO: el texto extraído de recorridos PDF 16 invierte A y B; usar la imagen. Pendiente de relevamiento en F04-T01: posición del cajón, semáforo de Cabildo y Guayra, PARE y máximas de OSM.

**Modo de trabajo indicado por el usuario (2026-10-11):** al iniciarse una fase se crean todos sus PRs, uno por uno y apilados, sin esperar revisiones (etapa A). Después se revisan con el usuario los findings de Codex y CodeRabbit PR por PR y se fusiona en orden (etapa B). Detalle en `PLAN_IMPLEMENTACION.md` §1–§3.

Actualizar este archivo y `ESTADO_IMPLEMENTACION.md` en cada hito.

## Fase 2 fusionada

Iniciada por el usuario el 2026-10-11, con la fase 1 fusionada. Tareas en orden: T01 base web y CI; T02 esquemas y carga de catálogos; T03 navegación, biblioteca y mapa de aprendizaje; T04 motor de actividades con muestra; T05 progreso, bitácora, repaso espaciado y respaldo. Decisiones técnicas en `ARQUITECTURA.md`: versiones exactas con al menos dos semanas de publicadas, TypeScript 6.0 (no 7, por `typescript-eslint`), Three.js sin capa React y escena cargada en forma diferida.

Toda la fase 2 está en `main`: T01–T04 (#7–#10), F02-T01-FIX01 (#12) F02-T02-FIX01 con T05 (#13; #11 se fusionó dentro de esa rama) y F02-T02-FIX02 (#14). El correctivo F02-T02-FIX03 (#15) también está fusionado (`d7db55c`). En #13 los valores técnicos de los catálogos (`status`, `roadType`) pasaron a inglés; los documentos explican cada valor en español.

Decisiones de esta fase que las siguientes no deben reinterpretar:

- **Actividades:** solo se escriben sobre datos sin discrepancias abiertas (alcohol, cordón amarillo, calles de convivencia y excepciones de la prioridad de la derecha quedan fuera hasta resolverse). Cada dato se verifica contra la imagen de su página antes de marcarlo `reviewed` (revisado).
- **Variantes:** se eligen con una semilla, que viaja en la URL (`?semilla=`). El motor es puro y nunca expone la respuesta en la presentación.
- **Dominio:** tres aciertos seguidos y espaciados (cajas de Leitner a 1/3/7/14/30 días; dominado desde la caja 3). Un error reinicia el espaciado. No se presenta ninguna probabilidad de aprobar.
- **Progreso local:** IndexedDB con escrituras atómicas que calculan cada concepto desde el valor guardado. Con varias pestañas, cada escritura se avisa por `BroadcastChannel` y las demás recargan; el respaldo se arma leyendo la base. Las respuestas esperan a que termine la carga. Los registros ilegibles se apartan en `quarantine` sin modificarlos, y los respaldos se validan por completo (incluida la coherencia de los contadores) y se confirman antes de reemplazar nada.
- **Identificadores:** los valores técnicos de los catálogos van en inglés (`transcribed`, `sources-verified`, `street`…); los ids de fuente conservan el nombre del documento oficial.
- **Inicio:** los seis espacios son los de PROPUESTA §2 (el sexto es «Mi bitácora»); la Biblioteca es una pantalla aparte.

## Fase 3 en curso

Iniciada por el usuario el 2026-10-11 para F03-T01 y F03-T02, ahora fusionadas. Después autorizó F03-T03 (habitáculo), según la actualización al final de este documento. Modo pedido: abrir T01 y T02, después revisar sus findings y recién entonces pedir las revisiones. Decisiones de T01 que no deben reinterpretarse:

- **Simulación pura y a paso fijo** (`src/sim/`, 120 Hz): nada depende de los FPS ni de React. La vista solo interpola.
- **Convenciones:** posición = centro del eje trasero; rumbo 0 = +z; positivo = izquierda (+x); velocidad con signo.
- **Calibración:** el frenado sale de la tabla del manual (PDF 70); el resto de las medidas son aproximaciones del juego, documentadas en ARQUITECTURA.
- **Colisiones propias** (cajas orientadas, SAT y bisección): Rapier se reevalúa cuando haya actores dinámicos.
- **Tren motriz (T02):** el motor cala de verdad (por debajo de 450 rpm arrastrado), el embrague muerde justo debajo de 0,75 de recorrido y la automática arrastra en D. La simulación emite eventos físicos (calado, cambio rechazado, salida con el freno de mano…) y la evaluación (T04) los convierte en faltas.
- **Pista de prueba** (`#/pista`): banco de pruebas provisional, reemplazable por el habitáculo y el primer tramo (T03 y T05).

## Validación prevista

Contenido trazable y completo; reglas con casos y excepciones; navegación cartográfica; conducción y espejos reales; repeticiones deterministas; persistencia; sesión integral de navegador y perfil de rendimiento. Desde la fase 2 hay pruebas automáticas (unitarias, de integración y E2E) y CI; el detalle por PR está en `ESTADO_IMPLEMENTACION.md`.

## Modelos y cuota

El usuario confirmó **Anthropic 200 USD y OpenAI 100 USD**, y aclaró que tiene menos tokens en OpenAI. Ver `ESTRATEGIA_MODELOS.md`: **Opus 5.5 como autor habitual, con GPT-6 Astra asignado a F03-T03, F04-T01 y F06-T03; GPT-6.1 Sol reservado prioritariamente para revisión Codex y ayuda focalizada**. Luna solo con cuota sobrante; Fable y usos adicionales de Astra para escalamiento justificado; F07-T01 usa Astra solo si mediciones justifican un diagnóstico complejo de renderizado. La autorrevisión de Astra no sustituye la revisión Codex separada. Esto sustituye la recomendación previa de Sol como autor habitual. No deducir proporciones de tokens ni el nombre comercial del plan por su precio; consultar uso real y sublímites cuando haga falta. No volver a preguntar los importes confirmados. Fuentes oficiales consultadas el 11/10/2026. No inferir cuota incluida desde precios API.

### Actualización: inicio de F03-T03

El usuario autorizó expresamente «haz un git restore . para que trabajes en main limpia y comienza a implementar F03 T03». Se descartó el cambio sin commit de `drivingLoop.test.ts` en el checkout principal y se dejó `main` limpia en `e49dc5b`, que incluye #16 y #17. Se preservó y continuó el trabajo parcial existente en `f03-t03-cockpit`, con esa misma base. Esta autorización reemplaza la exclusión previa de T03; no inicia T04 ni T05.

T03 incorpora interior procedural, cámara desde el conductor, espejos por reflexión de la escena, tablero y volante animados, preparación e instrumental, mirada, teclado reasignable persistente y mandos en pantalla. Detalles y límites en ARQUITECTURA. PR [#18](https://github.com/grunch/al-volante/pull/18), implementación `db33865`. Validación: 268 pruebas, 34 E2E y cuatro E2E adicionales tras el ajuste visual final. Codex y CodeRabbit solicitados; monitorear y resolver findings antes de pedir otra ronda. Las revisiones se registran en ESTADO_IMPLEMENTACION.

El usuario pidió descartar el correctivo local de #16 y pasar a T03. La revisión 5485745268 de #18 retoma la pérdida de pulsaciones entre cuadros: T03 ahora retiene un pulso mínimo hasta un paso fijo, incluso con cuadros sin pasos. Esto evita perder toques, pero no reconstruye sus duraciones exactas. La cámara interior no usa el suavizado de la antigua cámara exterior; ese finding histórico no se declara corregido en #16. CodeRabbit 5485752374 también detectó la búsqueda global de `body`: ahora se limita al modelo del auto. No se implementó el motor de evaluación ni el primer cruce.


### Corrección del check E2E de #18

El usuario informó el fallo de CI sobre `20cefc5`. El log remoto 38189874721 registra tiempos agotados en el muestreo de 60 cuadros y en interacciones; la ejecución local previa con dos workers no reprodujo el fallo. La corrección limita CI a un worker, separa el perfilado de la preparación del habitáculo y lo acota a una ventana de 5 segundos (hasta 60 cuadros), y espera el reloj de simulación para sostener pedales y consumir comandos. Las pruebas de conducción disponen de 60 segundos para completar sus pasos. Verificación local: lint, formato, tipos y build aprobados; 36 E2E aprobados en modo CI sin reintentos. Consultar en #18 el resultado remoto y cualquier revisión posterior. El rendimiento gráfico sigue siendo una limitación explícita; esta corrección no acredita el objetivo de FPS.


La CI de `5d3a843` aprobó ambos jobs (ejecución 38190546993, 36 E2E). Codex 5485804952 detectó que los mandos sostenidos no atendían click semántico sin eventos de puntero/teclado. Se agrega un pulso para `detail=0`, conservando los handlers de sostener para puntero/teclado y evitando un segundo pulso en clics de puntero. Regresión demostrada antes/después; `npm run check` aprobado con 281 pruebas y 12 E2E de habitáculo/conducción aprobados en modo CI sin reintentos.

### Actualización: F03-T04 y F03-T05

El usuario pidió el 2026-10-11: «ya hay un PR del F03 T03, ahora haz T04 en adelante hasta terminar la fase 3». T04 se apila sobre `f03-t03-cockpit` (#18) y T05 sobre T04, sin esperar revisiones (etapa A). Decisiones de T04 que no deben reinterpretarse:

- La evaluación es una máquina de estados pura (`observe`) alimentada por paso fijo, no por cuadro: misma entrada, misma puntuación, a cualquier FPS.
- La ronda de reconocimiento se juzga completa: una respuesta eliminatoria interrumpe cuando el examinador terminó de preguntar, para que la devolución muestre todas las fallas de la ronda.
- El corte de 8 puntos (`protocolo.pdf`, PDF 10) se aplica hasta que el auto se mueve en la etapa II (0,2 m/s); después, los puntos se acumulan y se informan al final (PDF 14). Es la decisión D5 de REGLAS.md §7, una interpretación del proyecto, no una regla del protocolo.
- Las aproximaciones (10 cm de tolerancia, 1 m/s para derribar un poste, mirada al espejo entre 0,25 y 0,9 rad de giro de cabeza) son del juego y están en `GAME_PARAMETERS`; cambiarlas no cambia el protocolo.
- No se persisten intentos de manejo todavía.

Decisiones de T05 que no deben reinterpretarse:

- El cajón del primer tramo está a 127 m de la línea de detención (RECORRIDO.md), así que los primeros 100 m terminan unos 20 m antes de la esquina; el guion de pruebas sale del cajón con un giro corto (35°) y un tramo recto, porque un giro a tope mete la trompa en el cordón izquierdo de una calle de 10 m.
- Un exceso en los primeros 100 m consigna la eliminatoria g (la indicación de marcha), no f ni l (D1: un hecho, una regla). Después de los 100 m rige D2.
- El tránsito que cruza va por la mitad lejana de la avenida, para que solo seguir de largo lo encuentre; el giro a la derecha pega al cordón cercano.
- Las etapas II y III no se completan en la fase 3: el resultado se muestra como parcial.


## Inicio de F04-T01

El usuario indicó «arranca con F04 T01». Solo se ejecuta esa tarea; T02–T05 no se inician. La rama `f04-t01-city` parte de `main` y se actualizó hasta `89791fc`, que incluye #18–#21. El checkout principal conserva sus archivos y `main` limpia.

`#/recorrido` integra exploración por cuadra o circuito completo, mapa métrico, evidencia de fuentes y conducción por los ocho tramos. La geometría sale del catálogo validado sin espejar ni reescalar; los sectores visuales se liberan sin cambiar colisiones. El predio y el primer tramo evaluado mantienen sus pantallas. Arquitectura, límites y fuentes en `CIUDAD.md`.

No confundir circuito geométrico completo con examen completo: tránsito, ciclos de semáforos y evaluación integral siguen en F04-T02–T05. Las máximas, PARE, reductor, anchos y posición exacta del cajón no se certificaron mediante relevamiento; se conservan estados de fuente única, discrepancia o aproximación. Implementación publicada en [#22](https://github.com/grunch/al-volante/pull/22) (`ab68fd2`), con 364 pruebas y 44 E2E aprobados más revalidaciones afectadas. En la etapa B se corrigieron los findings de Codex y CodeRabbit (`5b07456` y siguiente); queda la revisión de seguimiento. El estado vivo está en `ESTADO_IMPLEMENTACION.md`.

## F04-T02: tránsito del circuito

El usuario pidió «ya está el pr de F04 T01, haz el resto de tareas de esta fase»: T02 se apila sobre `f04-t01-city` (#22) sin esperar revisiones; T03–T05 siguen en orden. Decisiones de T02 que no deben reinterpretarse:

- El tránsito es una capa pura y determinista (`src/traffic/`), creada con una semilla y avanzada por paso fijo; la aleatoriedad se consume solo al crearla. Misma semilla y mismas entradas, mismo estado. No introducir aleatoriedad en el paso ni dependencias del cuadro.
- `World.traffic` (fuente genérica) convive con `World.scenario` (guion de F03-T05, adaptado por `scenarioSource`); ambos exponen `TrafficSnapshot`. `#/examen` sigue con el primer tramo guionado; la ciudad no lo reemplaza hasta F04-T03.
- Las reglas de los actores citan el manual (PDF 64 para semáforos, PARE y prioridad de la derecha con su excepción 4; PDF 71 para los dos segundos). Los tiempos (ciclo 14/3/19 s, 1 s en PARE, 8 s anti-bloqueo, 4 s de llegada, 1,5 s para perder prioridad), las velocidades sin fuente y los sentidos de las calles de contexto son aproximaciones del juego y están declarados en ARQUITECTURA; cambiarlos no cambia el protocolo.
- Las líneas de detención del tránsito son geométricas, o la pintada cuando queda más atrás. En Cabildo–Iberá, Cuba–Congreso y Obligado–Congreso la pintura de F04-T01 cae dentro de la transversal: F04-T03 debe alinearla cuando defina la detención evaluada, sin mover la coordenada de fuente del control.
- El examinador de F04-T03 debe leer `lights` (por control) y `lookAhead` (próximo semáforo, cruce con regla y cajas de conflicto, senda y vehículo de adelante); `light` es solo un resumen. Los contactos llegan como `actor-contact` con el tipo de actor (`vehicle`, `bus`, `bicycle`, `pedestrian`).
- PR [#23](https://github.com/grunch/al-volante/pull/23), apilado sobre #22. Etapa B: findings de Codex corregidos (cabezales de sendas, ciclovía por sentido, mallas liberadas, líder solo en el mismo sentido); CodeRabbit pendiente por cuota.
- La vuelta legal de `lap.test.ts` acredita que el tránsito no bloquea una conducción válida con la semilla 1 (sin contactos, sin rojo cruzado, sin esperas mayores a un ciclo); no acredita evaluación ni todas las semillas.

## F04-T03: examinador del circuito

Apilada sobre `f04-t02-traffic` (#23) por el mismo pedido («ya está el pr de F04 T01, haz el resto de tareas de esta fase»). Decisiones de T03 que no deben reinterpretarse:

- El examinador de la etapa II es un juez puro por paso fijo (`judgeCirculation`) sobre un `Circuit` derivado de la ciudad y de la red de tránsito, nunca de coordenadas fijas de una cuadra. `#/examen` corre sobre la ciudad con el tránsito de la semilla; el primer tramo con guion (`firstBlock.ts`) queda solo como fixture del escenario.
- Los umbrales de las reglas de circulación que el protocolo no cifra son decisiones del juego (REGLAS.md §7 D6–D9 y §9, `CIRCULATION`); se muestran como aproximaciones. Cambiarlos no cambia el protocolo ni la fuente.
- La toma de control (D7) se dispara por frenado imposible (> 7 m/s² necesarios) frente a un actor; eleva la última alta escalable (e, l, n, o) o consigna la eliminatoria i, siempre con interrupción de causa `examiner`. Todo escalamiento tiene causa `examiner` (es el doble comando, PDF 7), ya no `fault`.
- Un episodio de velocidad termina al corregir o al cambiar de tramo (D8). La línea continua de la eliminatoria o es el borde izquierdo de la calzada de examen de Cabildo; Metrobús, ciclovía y contramano son la j.
- Con el cajón de F04-T01 a 20 m del inicio del tramo 1, los primeros 100 m terminan unos 3 m después de la línea de Cabildo (D9): las reglas de la esquina rigen dentro de los 100 m y solo la velocidad se juzga por g. No se movió el cajón de T01.
- La ambulancia es un actor `emergency` del tránsito (`src/traffic/emergency.ts`), uno por vuelta en Guayra; los demás actores no la ven. Los peatones de sendas semaforizadas tampoco bajan del cordón frente al auto a menos de 15 m (extensión mínima de T02).
- La etapa II termina al volver al tramo 1 tras el 8 (`verdict.done`): `completedStages` incluye `II` y el resultado queda parcial. F04-T04 debe reemplazar ese `finish` por una fase de estacionamiento y completar la III; F04-T05 integra los modos y la ficha.
- No se evalúan: dos manos en el volante, dispositivos, autoridad de tránsito, omisión de bocina (REGLAS.md §9).
- PR [#24](https://github.com/grunch/al-volante/pull/24), fusionado en `main` (`d919f98`); revisiones y findings en `ESTADO_IMPLEMENTACION.md`.


## F04-T04: estacionamiento y descenso

Apilada sobre `f04-t03-examiner` (#24) por el mismo pedido («ya está el pr de F04 T01, haz el resto de tareas de esta fase»). Decisiones de T04 que no deben reinterpretarse:

- La etapa III es un juez puro por paso fijo (`src/exam/parking.ts`) sobre el marco del cajón derivado de la ciudad (`circuit.bay`), nunca de coordenadas fijas; la sesión pasa de `circulation` a `parking` al volver al tramo 1 (antes terminaba ahí), y de `parking` a `leaving` cuando el aspirante avisa con el auto detenido, y a `finished` al abrir la puerta, con `completedStages` I/II/III.
- Las decisiones D10–D14 y V3 de REGLAS.md §7 (aviso a 100 m sobre el tramo 8, zona del cajón y doble fila, cuenta de maniobras e intentos, marcas pintadas como vallas de 1,2 m desde el cordón con los umbrales de 1 m/s de la etapa I, fin por aviso, descenso juzgado al abrir la puerta, llave afuera como bloqueo de dirección, cinturón libre tras la posición final, descentrado a 0,5 m) son del juego; cambiarlas no cambia el protocolo. 50 cm exactos es la segunda franja (V1); las distancias se redondean a la milésima de centímetro.
- Cada eje se clasifica por `parkingBands` y cada regla distinta se consigna una vez; el chequeo de espejos de la alta p vale por intento (`attempt-n`); la baja j solo acepta el espejo izquierdo (X7).
- El tránsito deja 8 m detrás de un auto a menos de 2,5 m/s a menos de 25 m del cajón y espera si retrocede hacia él; los demás vehículos leen la velocidad del auto como antes (cambiarlo traba esquinas: comprobado con `lap.test.ts`). Ningún peatón baja del cordón delante del auto que arranca a menos de 6 m. La excepción de «ceder a una senda» de la alta i con distancia recta al doblar (`yieldingLinkM`) quedó en F04-T03 (#24), donde está la regla.
- La puerta es un `toggle` del habitáculo (`door`, tecla `G`); no responde al reconocimiento. El HUD muestra maniobras/intentos, distancia al cordón y la lista de descenso.
- El conductor de prueba manual (`circuitDriver.ts`) completa la vuelta limpio desde esta tarea (primera/segunda, embrague, punto de acople, velocidad en curva, espera en el PARE); los dos conductores ceden a peatones en el cordón y ante una senda de salida ocupada. Son fixtures, no el examinador.
- No hubo revisión visual en navegador más allá de los E2E; el cajón sigue sin vallas físicas y sin relevamiento.

**Interfaz para F04-T05.** Un modo que no exija todas las etapas debe crear la sesión directamente en la fase deseada (`enter`) con `completedStages` vacío, así `resultOf` queda `pending` y la ficha no finge un examen completo; «rendir» usa el flujo completo (`createSession(rules, kind, seed, circuit, bands)`). Los datos por etapa viven en la sesión: etapa I en `measurements` (reverseCm, forwardCm, exitManoeuvres, firstMetresTopKmh); etapa II en `street` (tramo, episodios, `legsEntered`); etapa III en `parking` (`manoeuvres`, `attempts`, `kerb`, `final` con frontCm/rearCm/alongM, `leftMirrorChecked`, `doorOpened`); cada falla del `ledger` lleva `atS` y se asigna a su etapa por el instante de cada cambio de fase (registrarlos en la sesión si la ficha los necesita). Para persistir un intento de manejo, el contrato `Attempt` admite `kind: 'driving'` (PROPUESTA §8; `src/progress/model.ts`, `createAttempt`): todavía no se conecta. PR de T04: [#25](https://github.com/grunch/al-volante/pull/25), fusionado en `main` (`cefe7b2`).


## F04-T05: modos, recorrido entero y ficha por etapa

Apilada sobre `f04-t04-parking` (#25), última tarea de la fase 4 (mismo pedido: «haz el resto de tareas de esta fase»). Decisiones de T05 que no deben reinterpretarse:

- Los modos son los del contrato `Attempt` menos `review`: `learn` (aprender), `practice` (practicar), `run` (recorrer), `exam` (rendir), elegidos por la consulta del hash (`?modo=`, `?etapa=`); sin parámetro rige recorrer. La sesión es la misma en los cuatro: las ayudas se ocultan en la interfaz (`aidsOf`, D15), nunca en la evaluación. Lo que el examinador dice (consigna, próxima esquina, aviso de los 100 m) y el tramo actual se ven siempre.
- `Fault.stage` se asigna al consignar la falla por la fase actual; no deducir la etapa por `atS` (las fallas de la preparación comparten el instante del paso a `unlock`, y los comandos tienen `dt` 0). `Session.transitions` da inicio y fin de cada etapa; `Session.scope` dice qué etapas corre la sesión y `completeStage` solo marca las del alcance.
- Una práctica (`createPracticeSession`) empieza en la primera fase de su etapa con `completedStages` vacío: el resultado queda `pending` y la ficha nunca aprueba. Etapa II: en el cajón, motor apagado, llave puesta. Etapa III: `entryPose(city, 8)`, motor en marcha, `movedOff`, primera detención ya juzgada; el aspirante pone la marcha y suelta el freno de mano.
- El intento de manejo (`createDrivingAttempt`) usa `subjectId` `route.<id>`, `startedAt` del reloj de pared al empezar y `finishedAt` de la hora monótona del almacén; todos los instantes se acotan al intervalo. Aprender no se guarda; abandonar la página no guarda. `recordAttempt` del proveedor no entrena conceptos.
- Las lecturas del `DrivingCanvas` (velocímetro, telemetría) se emiten con `startTransition`: como actualizaciones urgentes cada cuadro impedían que React Router completara cualquier navegación mientras el 3D corría (no se podía salir del examen ni del recorrido por el menú). No volver a hacerlas urgentes; si se agrega otra actualización periódica desde el bucle, que sea también una transición.
- La ficha (`buildCard`) decide el veredicto en este orden: aprobado (tres etapas y ≤ 7), pendiente (faltan etapas o la sesión no terminó), interrupción (causa y regla), eliminatoria sin interrupción, 8 puntos o más.

**Interfaz para la fase 5 y F06-T01.** La fase 5 (contenido y simulacros teóricos) no toca el examen práctico. Para la repetición y el reintento (F06-T01): la sesión viva está en `sessionRef` de `ExamPage` y se guarda solo al terminar, como `Attempt` `driving` con eventos de fase, etapas, interrupción y resultado, y las fallas con su instante; no hay grabación de entradas ni de estados por paso, así que F06-T01 debe agregarla (auto, cabina, `TrafficState` del tránsito y `Session` son valores inmutables por paso: un `Driver.clone()` de los tests muestra cómo ramificar). Un reintento desde un estado debe crear la sesión con `enter` en la fase deseada y restaurar los cuatro estados a la vez; el modo rendir debe conservar sus restricciones (D15) también al reintentar. PR de T05: [#26](https://github.com/grunch/al-volante/pull/26), fusionado en `main` (`b36fe55`).

## F04-T04-FIX01: vuelta guionada trabada en Cuba y Quesada

Las CI de las fusiones de #25 y #26 quedaron canceladas y `main` tenía rojas las vueltas guionadas (`street.test.ts` y los exámenes completos de `parkingStreet.test.ts`). PR [#27](https://github.com/grunch/al-volante/pull/27), desde `main`; va antes de los PRs de la fase 5. Decisiones que no deben reinterpretarse:

- **El auto detenido en su línea espera a quien ya cruza** (`carWaitsAtLineFor`, `src/traffic/traffic.ts`): igual que `waitsAtLineFor` entre actores, el auto quieto con el frente en su línea (de 0,6 m pasada a 1,1 m antes) de un cruce que un actor ya atraviesa no es el obstáculo de su corredor recto; sin eso, una bici que dobla dentro del cruce y el auto se esperan para siempre. **Excepción:** si la carrocería del auto está sobre la trayectoria real del actor en los próximos metros (curvas incluidas, `carOnPathAhead`), sigue siendo obstáculo y el actor no avanza hacia él. No usar `corridorGap` para limitar esta excepción: el corredor recto de quien dobla toca el capó aunque su trayectoria no lo haga, y vuelve la espera mutua (comprobado con la prueba «rides on across the corner…»).
- **El conductor de prueba cede a ciclistas** (`src/test/circuitDriver.ts`): antes de la línea espera a los que vienen por el lado del giro y a los que van a cruzar el pavimento que va a atravesar. Las distancias que usa (hasta 25 m detrás, a menos de 8 m hacia el lado del giro, proyección de hasta 3 s) son heurísticas del guion, no umbrales del protocolo; la obligación de ceder es la falla l (`protocolo.pdf`, PDF 12, 16, 17 y 29; manual PDF 35).
- Las vueltas guionadas son sensibles a los tiempos: un cambio del conductor de prueba o del tránsito puede llevar a la semilla 1 a situaciones nuevas. Correr `street.test.ts`, `parkingStreet.test.ts` y `src/traffic` antes de fusionar cualquier cambio de esas capas, y no fusionar con la CI cancelada.

## Fase 5: todo el contenido y simulacros teóricos

Iniciada por el usuario el 2026-10-12 con la fase 4 fusionada: «mejor comienza a implementar la fase 5, desde la tarea 1 hasta la ultima, no te detengas hasta completar la fase 5». Etapa A: T01–T05 apiladas, sin esperar revisiones. El método, los estados y las decisiones están en `CONTENIDO.md`; no reinterpretar:

- **Estados con significado verificable** (`validateTreatment`): `reviewed` = contrastada con la imagen de su página; `implemented` = practicada por una actividad revisada o de consulta con motivo; `tested` = practicada por actividades que la prueba de recorrido del catálogo responde bien y mal. Una unidad de consulta nunca llega a `tested`.
- **Archivos:** una actividad vive en `specs/catalog/activities/<fuente>-<sección>.json` según su primera unidad; las figuras son recortes de los PDF (`figures.json`, `public/figures/`, `scripts/crop-figures.ts`) que se muestran con la devolución.
- **Discrepancias:** ninguna respuesta correcta depende de un dato no resuelto (`catalogPolicy.test.ts` lo controla para las decisiones con patrón detectable). Las decisiones D-T01-* fijan qué se evalúa en cada caso; los datos de contacto, URLs y estadísticas exactas no se evalúan.
- **Lotes:** cada tarea reparte el contenido en lotes por páginas escritos por subagentes con una guía común y fuera del repositorio; el autor integra, valida y revisa contra la fuente. La guía condensada está en `CONTENIDO.md` («Reglas de autoría»).
- **F05-T01** (presentación, glosario, introducción, cap. 1–2 y guía de siniestros): 260 unidades tratadas, 105 actividades y 23 figuras. Estado vivo y PR en `ESTADO_IMPLEMENTACION.md`.
- **F05-T02** (capítulo 3 y anexo IV): 153 unidades y 354 señales tratadas, 128 actividades y 28 figuras. Las señales se muestran con su recorte del manual (`box`, `public/signs/`), salvo las cuatro con dibujo vectorial; `visual` es su texto alternativo y no debe nombrarlas ni explicar lo que no está escrito en ellas. Las luces intermitentes quedan de consulta porque un dibujo fijo no las distingue. Decisiones D-T02-* en `CONTENIDO.md`.
- **F05-T03** (capítulos 4–5 y anexo I): 107 unidades tratadas, 59 actividades y 17 figuras; «Mi garaje» (`#/garaje`) reúne la práctica de la etapa I, la pista de prueba y la revisión del auto. Alcohol: solo se evalúa el 0,0 g/l (D-T03-1); no reinterpretar sin confirmar qué norma rige en la Ciudad.
- **F05-T04** (anexos II–III, protocolo y recorridos): las cuatro fuentes clasificadas página por página (285 páginas, 753 unidades). El protocolo se practica al volante y los circuitos son de consulta (vale la edición 2026; el anexo III de 2023 es antecedente). El texto extraído de los recorridos invierte A y B en varias láminas: transcribir siempre desde la imagen.
- **F05-T05** (simulacros teóricos y auditoría): «Sala de examen» (`#/teorico`) con la configuración de `catalog/theory-exam.json`; los simulacros se guardan en la bitácora y no entrenan conceptos. La auditoría global (`auditCoverage`) deja todo tratado: cualquier unidad o señal nueva tiene que llegar con actividad o motivo de consulta, o la prueba de integración falla.

