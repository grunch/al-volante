# Estado de implementación

Registro operativo exigido por `PLAN_IMPLEMENTACION.md` §6. Actualizar en cada PR y al cerrar cada fase.

Última actualización: 2026-10-11.

## Fase activa

- **Fase 2 — Base web, datos y aprendizaje inicial: tareas fusionadas en `main`.** El usuario fusionó #7–#10 (21:18–21:21 UTC), #11 (T05) dentro de `f02-t02-fix01` (`5dfdd10`), #12 (`493e5f7`), #13 (`1a842bf`, 22:24) y #14 (`07af269`, 22:46) el 2026-10-11. Queda el correctivo F02-T02-FIX03 (#15), con el finding de la última revisión de Codex sobre #14, que llegó cuando ya estaba fusionado.
- Mensaje de inicio (2026-10-11): «fusionada toda la fase 1, ahora comienza con la fase 2, no pares hasta terminar todos los PRs de esa fase, lee bien la documentacion para que tengas todos los aspectos y contexto antes de implementar el codigo».
- **Fase 3 — Auto e interior: en curso, etapa A.** Mensaje de inicio (2026-10-11): «ahora comienza la fase 3, pero solo haz solo los dos primeros PRs porque el PR de la t03 es con gpt Astra, no hagas ese, luego de hacer t02 vuelve a t01 y ve si hay findings, haz lo. mismo en t02, pide Review luego». Alcance autorizado: F03-T01 y F03-T02. F03-T03 corresponde a GPT-6 Astra (ESTRATEGIA_MODELOS) y no se hace en esta sesión; F03-T04 y F03-T05 dependen de T03.
- Fases 4–7: no iniciadas. Cada una requiere indicación manual del usuario.
- Modo de trabajo (usuario, 2026-10-11): etapa A, crear todos los PRs de la fase uno por uno y apilados sin esperar revisiones; etapa B, revisar los findings con el usuario y fusionar en orden. Ver `PLAN_IMPLEMENTACION.md` §1–§3.

## Repositorio y revisión

| Dato | Valor |
|---|---|
| Remoto | `git@github.com:grunch/al-volante.git` (https://github.com/grunch/al-volante), público. No versionar rutas del sistema de archivos local. |
| Rama principal | `main` |
| CodeRabbit | GitHub App, plan Advanced. Configuración en `.coderabbit.yaml` (revisa también PRs apilados). Cupo incluido observado: 1 revisión por hora. CLI local `coderabbit` disponible como alternativa. |
| Codex | Comentario `@codex review` en cada PR. Guía de revisión en `AGENTS.md`. CLI local `codex-cli` disponible como alternativa (usar `-c model="gpt-6.1-sol"`). |
| CI | `.github/workflows/ci.yml` (desde F02-T01): lint, formato, tipos, pruebas con cobertura ≥ 80 %, validadores de catálogo, build y E2E con Playwright. |
| Protección de rama | No configurada. Activar «CI» como check obligatorio de `main` es una decisión del usuario (requiere permisos de administración). |

Estados por revisor: `pendiente`, `solicitada`, `completada`, `omitida por tokens agotados`, `bloqueada por integración`.

## Fases cerradas

| Fase | PRs fusionados en `main` | Detalle |
|---|---|---|
| 1 — Fuentes, cobertura y recorrido | #1 (merge `12cf2a8`), #2 (`58cf109`), #3 (`f542d2f`), #4 (`0ff3e63`), #6 F01-T02-FIX01 (`9468184`). #5 (estrategia de modelos, del usuario) entró por la rama de #4 (`d804221`). | [historial/FASE-1.md](historial/FASE-1.md) |

## Tareas de la fase 2

| Tarea | Rama | Base | Depende de | PR | Estado |
|---|---|---|---|---|---|
| F02-T01 | `f02-t01-base` | `main` | F01 (fusionada) | [#7](https://github.com/grunch/al-volante/pull/7) | fusionada (`666cb08`) |
| F02-T02 | `f02-t02-schemas` | `f02-t01-base` (#7) | T01 (#7) | #8 | fusionada (`ac570c3`) |
| F02-T03 | `f02-t03-navigation` | `f02-t02-schemas` (#8) | T02 (#8) | #9 | fusionada (`8a74a53`) |
| F02-T04 | `f02-t04-activities` | `f02-t03-navigation` (#9) | T03 (#9) | #10 | fusionada (`79f8baa`) |
| F02-T01-FIX01 | `f02-t01-fix01` | `main` | T01–T04 (fusionadas) | #12 | fusionada (`493e5f7`) |
| F02-T02-FIX01 | `f02-t02-fix01` | `main` (antes `f02-t01-fix01`) | FIX01 de T01 (#12) | #13 | fusionada (`1a842bf`), con T05 |
| F02-T05 | `f02-t05-progress` | `f02-t02-fix01` (#13) | T04 y los correctivos | #11 | fusionada en `f02-t02-fix01` (`5dfdd10`) y en `main` con #13 |
| F02-T02-FIX02 | `f02-t02-fix02` | `main` | #13 (fusionado) | #14 | fusionada (`07af269`) |
| F02-T02-FIX03 | `f02-t02-fix03` | `main` | #14 (fusionado) | #15 | en revisión (etapa B) |

### F02-T01 — Base web: TypeScript, Vite, React, Three.js y CI

- Alcance: inicializar la aplicación con versiones fijadas, estructura, escena Three.js visible, pruebas (unitarias y E2E) y CI. Arquitectura y comandos en [ARQUITECTURA.md](ARQUITECTURA.md); arranque en el README.
- Resultado: shell accesible (salto al contenido, `lang="es-AR"`), escena del garaje con auto de práctica y cajón de 6 m, carga diferida de Three.js, estado de error sin WebGL y respeto de `prefers-reduced-motion`.
- Verificación local: `npm run check` (lint, formato, tipos, 16 pruebas unitarias con cobertura 99 % de sentencias y 89 % de ramas, validadores de catálogo y build) y `npm run test:e2e` (6 pruebas: escritorio y móvil). Capturas revisadas en 1280×800 y Pixel 7.
- CodeRabbit y Codex: solicitadas al abrir el PR (#7). Ambas completadas sobre `2440f85`.
- Findings resueltos (etapa B):
  - Codex, ancho del cajón: el ancho (2,4 m) queda como `APPROXIMATE_PARKING_BOX_WIDTH_M`, separado del largo verificado (`PARKING_BOX_LENGTH_M`, 6 m; protocolo PDF 21). La fuente no da el ancho (REGLAS V5).
  - Codex, CONTINUIDAD con el estado de la fase 1 obsoleto: corregido; la fase 1 figura como cerrada.
  - CodeRabbit, el cajón medía 6,1 m: las líneas pintadas quedan dentro de los 6 m exteriores, con prueba.
  - CodeRabbit, render continuo con movimiento reducido: se dibuja un solo cuadro y se redibuja al cambiar el tamaño, con prueba.
  - CodeRabbit, `persist-credentials: false` en los dos `checkout` de la CI: aplicado.
  - CodeRabbit, `.nvmrc`: fija una versión exacta que cumple `engines` (24.9.0, y después 24.21.0 por el finding de Codex sobre jsdom).
  - CodeRabbit, README: documenta `--with-deps` para Linux.
  - CodeRabbit, ARQUITECTURA: fecha de publicación de cada versión, y la limitación de TypeScript acotada a `typescript-eslint` 8.70.1 con su rango de `peerDependencies`.
  - CodeRabbit, fila de F02-T01 en este registro: actualizada.
- Segunda revisión de Codex (sobre el merge de #7 en `main`, `666cb08`, revisión 5485013908; corregido en F02-T01-FIX01):
  - Node 24.9.0 quedaba fuera del rango de jsdom 30.1.1 (`^24.15.0`): `.nvmrc` pasa a 24.21.0 (2026-09-07, más de dos semanas) y `engines` a `^24.15.0 || >=26.0.0`, que excluye Node 25 igual que jsdom (finding de Codex en #12).
  - Sin WebGL, el aviso quedaba dentro de un `role="img"`, cuyos descendientes los lectores de pantalla tratan como decorativos: en ese estado el contenedor deja de ser una imagen, con prueba.
  - «Registrá que F02-T01 ya fue fusionada»: aplica. `666cb08` es el merge real de #7 en `main`; las fusiones de #7–#10 quedan registradas en la tabla y en la fase activa.
  - Codex en #8 señaló dos líneas de CONTINUIDAD que todavía decían que no había aplicación ni pruebas: corregidas aquí.

### F02-T02 — Esquemas, validadores y carga de catálogos

- Alcance: esquemas Zod de todos los contratos (fuentes, unidades, actividades, reglas, recorrido, escenario e intento), validación referencial en TypeScript, versión de contenido, cobertura por sección y carga validada de los catálogos de la fase 1. Reemplaza los validadores `.mjs` de la fase 1.
- Resultado: `npm run validate:content` → `Content OK (version a48188f2)`, con 224 páginas, 705 unidades, 355 señales, 206 observaciones, 69 reglas, 8 tramos y 0 actividades (la muestra llega en T04). El manifiesto suma título, edición y procedencia (URL oficial y fecha) para cumplir el contrato `Source`.
- Verificación local: `npm run check` con 52 pruebas unitarias (cobertura 98,7 % de sentencias y 95,5 % de ramas). Incluye los casos portados de los tres validadores, los de actividades y la prueba de integración con los datos reales.
- CodeRabbit y Codex: solicitadas al abrir el PR (#8). Codex completada sobre `22aefa2`. CodeRabbit no revisó por el cupo de 1 revisión por hora; se vuelve a pedir en la etapa B.
- Findings resueltos (etapa B), todos con prueba:
  - Codex, CONTINUIDAD decía que no había software: corregido en #7, y este PR lo hereda.
  - Codex, un desenlace correcto declarado pero inalcanzable dejaba la actividad imposible de ganar: ahora se exige un desenlace correcto alcanzable desde `start`, y también se rechazan los desenlaces que ninguna elección alcanza.
  - Codex, una franja con `lt` y `lte` (o `gt` y `gte`) a la vez engañaba al control de bordes: se rechaza.
  - Codex, citas sin validar contra el manifiesto: las del puntaje (`rules.scoring.refs`) y las del recorrido (`route.sources.route`) ahora se validan. Todas las citas pasan por `refs.ts`, que exige una fuente del manifiesto y una página dentro de su rango. El fixture de integración citaba `recorridos` sin tenerlo en el manifiesto y se corrigió.
- Segunda revisión de Codex (sobre el merge de #8 en `main`, `ac570c3`, revisión 5485016356; corregido en F02-T02-FIX01), con pruebas:
  - Estados técnicos en español: los valores de `status` y `roadType` pasan a inglés en esquemas, catálogos (705 unidades, 355 señales, 69 reglas, 8 actividades y el recorrido), validadores y documentación. Tabla: `pending`, `transcribed`, `reviewed`, `implemented`, `tested`; `draft`; `sources-verified`, `single-source`, `discrepancy`, `approximation`, `surveyed`; `street`, `avenue`. Los ids de fuente (`manual`, `protocolo`, `recorridos`, `siniestros`) se mantienen porque son los nombres de los documentos oficiales y aparecen en sus archivos y en las URLs. Versión de contenido: `59fc079b`.
  - CONTINUIDAD con líneas obsoletas: corregido en F02-T01-FIX01.
  - Invariantes del puntaje: `requiresAllStagesCompleted` y `cumulativeAcrossStages` son `true` fijos (protocolo PDF 14), y `maxPointsBeforeCirculation` es 7 fijo (PDF 10).
  - Faltas de un intento sin validar: `attemptErrors` (`src/content/validateAttempt.ts`) exige regla conocida, los puntos de esa regla, un total coherente y ninguna falta en intentos de actividades. La importación de respaldos lo usa desde F02-T05.
  - Procedencia del catálogo de reglas: `edition` y `sha256` se comparan con la entrada `protocolo` del manifiesto.
- Revisión de Codex sobre #13 (`64bf79d`, revisión 5485212704), con pruebas:
  - Una falta alta que escala a eliminatoria vale 8 puntos (protocolo PDF 7): `attemptErrors` acepta los puntos de la escalada.
  - Una regla `once` o `single-check` no puede aparecer dos veces en un intento.
  - `comuna13-a.geojson` conservaba los estados viejos: migrado (17 `single-source`, 4 `sources-verified`, 1 `discrepancy`). Una prueba controla que use el vocabulario del catálogo.

### F02-T03 — Navegación, inicio/garaje, biblioteca y mapa de aprendizaje

- Alcance:
  - rutas con hash e inicio «Mi garaje» con los seis espacios;
  - mapa de aprendizaje (campaña B separada del complemento) y detalle de sección;
  - biblioteca con consulta página por página de las cuatro fuentes (texto extraído y PDF oficial);
  - estados de carga y error, 404, foco y título por pantalla, diseño adaptable.
- Verificación local:
  - `npm run check` con 71 pruebas unitarias (cobertura del 98,3 % en sentencias y 93,5 % en ramas);
  - `npm run test:e2e` con 14 pruebas en escritorio y móvil: navegación completa por teclado con foco en el título, mapa → sección → página 72 con texto y PDF, salto de página y reglas del protocolo, y ausencia de desborde horizontal en pantallas angostas;
  - capturas revisadas del mapa, el visor y el inicio, y contraste de los colores nuevos calculado (≥ 4,5:1).
- CodeRabbit y Codex: solicitadas al abrir el PR (#9). Codex completada sobre `743445a`. CodeRabbit no revisó por el cupo de 1 revisión por hora; se vuelve a pedir en la etapa B.
- Findings resueltos (etapa B), todos con prueba:
  - Codex, el inicio reemplazaba «Mi bitácora» por la Biblioteca entre los seis espacios: ahora son los seis de PROPUESTA §2 (todos «Próximamente» en este PR), y la Biblioteca queda en la navegación y en un botón bajo la introducción.
  - Codex, títulos y descripciones de los espacios dentro del TSX: pasan a `HOME_SPACES` en `src/i18n/es-AR.ts`. Una búsqueda no encontró otros textos visibles incrustados.
  - Codex, una regla con filas de ficha en varias páginas mostraba siempre la primera (por ejemplo, en la página 17 aparecía el texto de la 16): ahora se muestra la fila de la página consultada, y la primera solo se usa como respaldo en páginas que únicamente citan la regla.

### F02-T04 — Motor de actividades y muestra representativa

- Alcance: motor puro y determinista (elección, señales, ordenar y decisión), interfaz accesible de cada tipo, devolución con explicación y fuentes, variantes por semilla y muestra de 8 actividades. No es la campaña completa: llega en la fase 5, y la interfaz lo dice.
- Contenido: velocidades máximas (manual PDF 72), anticipar un giro (PDF 75; protocolo PDF 12), semáforo (PDF 64), señales reglamentarias (PDF 185–186 y 64), prioridad normativa (PDF 58), pasos de un giro (PDF 75), doblar con peatones (PDF 26 y 75; protocolo PDF 29) y vehículo de emergencia (PDF 62–63).
  - Antes de marcarlas `reviewed` (entonces `revisada`), verifiqué cada dato contra la imagen de su página.
  - Excluí los temas con discrepancias abiertas (alcohol, cordón amarillo, calles de convivencia, excepciones de avenida y excepción 2 de la prioridad de la derecha).
- Verificación local:
  - `npm run check` con 93 pruebas unitarias. Incluyen el motor con las actividades reales (determinismo, cobertura de variantes, sin filtrar respuestas, puntaje y rechazos) y la interfaz con contenido real (los cuatro tipos, el registro del resultado, la semilla en la URL y una semilla faltante o mal formada).
  - `npm run test:e2e` con 18 pruebas: señales por teclado hasta la biblioteca, y decisión con otra variante.
  - Captura revisada en móvil.
- Error encontrado por las pruebas y corregido: sin el parámetro, la semilla valía 0 en silencio (`Number(null) === 0`).
- CodeRabbit y Codex: solicitadas al abrir el PR (#10). Codex completada sobre `30131d9`. CodeRabbit no revisó por el cupo de 1 revisión por hora; se vuelve a pedir en la etapa B.
- Findings resueltos (etapa B), todos con prueba:
  - Codex, la explicación de velocidades enseñaba «calles de convivencia, 20 km/h» como dato resuelto, aunque COBERTURA lo tiene como discrepancia abierta (manual PDF 26 frente a PDF 72): se quitó de la explicación y de las 16 devoluciones. Queda «pasajes, 20 km/h» (PDF 72) y una aclaración de por qué ese tema no entra. Una prueba de regresión impide volver a enseñar temas con discrepancias abiertas. Versión de contenido: `beef0241`.
  - Codex, CEDA EL PASO sin leyenda: el dibujo muestra «CEDA EL / PASO» como en el manual PDF 186. Una prueba exige que cada señal dibujada muestre la leyenda que cita su descripción.
  - Codex, «Otra variante» podía repetir la presentación (semillas 10 y 11 de la ambulancia): ahora busca otra variante o, si hay una sola, otro orden.
  - Codex, foco perdido al completar la semilla y al cambiar de variante: el título queda montado y recibe el foco, con pruebas unitarias y E2E.
  - Codex, texto nuevo del inicio dentro del TSX: resuelto con `HOME_SPACES` (#9).

### F02-T05 — Progreso, bitácora, repaso espaciado, IndexedDB y respaldo

- Alcance:
  - intentos registrados con la versión de contenido;
  - dominio por concepto con cajas de Leitner (disponible, practicado y dominado);
  - «Mi bitácora» con repaso recomendado, errores recientes y progreso de la campaña B separado del complemento;
  - IndexedDB con transacciones atómicas;
  - respaldo versionado con importación validada y confirmada.
- Aceptación:
  - El progreso persiste al reiniciar: prueba con IndexedDB simulado (desmontar y volver a montar) y E2E con recarga real.
  - El respaldo restaura los datos: E2E que exporta, importa en un navegador limpio, recarga y encuentra el progreso.
  - Los datos corruptos no destruyen el progreso existente:
    - registros ilegibles en la base, que se apartan sin cambios en `quarantine` y se avisan;
    - respaldos inválidos, demasiado grandes o ilegibles, que se rechazan sin tocar nada;
    - escrituras fallidas, que abortan la transacción;
    - respuestas dadas durante la carga o con la carga fallida, que se guardan igual a partir del valor almacenado;
    - respaldos con contadores imposibles, que se rechazan;
    - en E2E, un respaldo dañado sin efecto después de recargar.
- Verificación local:
  - `npm run check` con 157 pruebas unitarias y de integración (después de resolver los findings);
  - `npm run test:e2e` con 24 pruebas (incluida una con dos pestañas);
  - capturas revisadas: bitácora en móvil sin desborde horizontal e inicio en escritorio.
- Errores encontrados por las pruebas y corregidos:
  - un acierto después de un error subía de caja, y dos aciertos alcanzaban para dominar;
  - con StrictMode quedaba una conexión de IndexedDB sin cerrar.
- CodeRabbit y Codex: solicitadas al abrir el PR (#11). Codex completada sobre `ad80854`. CodeRabbit no revisó por el cupo de 1 revisión por hora; se vuelve a pedir en la etapa B.
- Findings resueltos (etapa B), todos con prueba:
  - Codex, una respuesta dada antes de que terminara la carga se descartaba en silencio: ahora espera en la cola y se guarda al terminar la carga. Si la carga falla, se guarda igual y aparece al reintentar.
  - Codex, un concepto ilegible se pisaba al volver a practicarlo: los registros ilegibles pasan a `quarantine` sin cambios, al cargar o antes de escribir. La base sube a la versión 2, con prueba de migración desde la 1.
  - Codex, un respaldo con contadores imposibles (por ejemplo, 100 aciertos en 0 intentos) se aceptaba: el esquema del concepto exige las invariantes de `updateConcept`, con una prueba que confirma que los estados de secuencias reales siguen siendo válidos.
  - Codex, con dos pestañas una sobrescribía el dominio más nuevo de la otra: cada escritura lee el concepto guardado y calcula el nuevo dentro de la misma transacción.
  - La corrección de los seis espacios del inicio, que estaba en este PR, pasó a #9, donde correspondía.
- Segunda revisión de Codex (sobre `3b92467`, revisión 5485016205), con prueba:
  - Un respaldo con un repaso a décadas de distancia se aceptaba: ahora el próximo repaso tiene que caer dentro del intervalo de su caja y, después de un error, exactamente un día más tarde, como lo programa `updateConcept`.
- Tercera revisión de Codex (sobre `f1e15f0`, revisión 5485052739), con prueba:
  - Un respaldo con la última respuesta y el repaso corridos juntos al futuro se aceptaba: ahora ninguna fecha de progreso puede ser posterior a la exportación, y la exportación no puede ser posterior a la hora del dispositivo que importa. Ambas comparaciones tienen una tolerancia de un día (`CLOCK_TOLERANCE_MS`) para desajustes de reloj.
- Cuarta revisión de Codex (sobre `bcd11dd`, revisión 5485074360), con pruebas:
  - Las fechas de las faltas (`faults[].at`) no se comparaban con la exportación: ahora sí.
  - Con dos pestañas, la copia en memoria de una no veía lo que escribía la otra, así que la bitácora y el respaldo podían quedar incompletos. Ahora cada escritura vuelve a leer lo guardado y avisa a las demás pestañas por `BroadcastChannel`, y el respaldo se arma leyendo la base al exportar. Lo cubren pruebas de integración con dos proveedores, una de ellas sin `BroadcastChannel`, y una E2E con dos pestañas reales.
- Quinta revisión de Codex (sobre `f73b428`, revisión 5485134783), con pruebas:
  - Si el reloj retrocedía (progreso importado de un dispositivo adelantado dentro de la tolerancia), un acierto antes del repaso dejaba un estado que el esquema rechaza, y la recarga lo mandaba a cuarentena. Ahora la hora de la última respuesta nunca retrocede. Además, el almacén se niega a escribir un concepto inválido: la escritura se aborta y la bitácora avisa que no se guardó.
- Validación de faltas al importar (finding de Codex en #8, resuelto con F02-T02-FIX01): un respaldo con faltas de reglas desconocidas, con puntos distintos de los de la regla o con un total incoherente se rechaza con `attemptErrors`.
- Este PR pasó a estar apilado sobre los correctivos (#12 y #13) después de que el usuario fusionó #7–#10.
- Sexta revisión de Codex (sobre `4ac34bc`, revisión 5485234963, que llegó con #11 ya fusionado en `f02-t02-fix01`; corregida en #13), con pruebas:
  - El orden de los intentos ahora también es monotónico: un intento nuevo nunca queda fechado antes del último conocido. Así, un acierto posterior a un fallo importado de un dispositivo adelantado figura como el más reciente.
  - Cronologías imposibles: el esquema del intento exige que termine después de empezar y que sus eventos y faltas caigan dentro de ese intervalo; un respaldo que no lo cumple se rechaza.
  - Aviso de guardado: si una respuesta no se guarda, la actividad lo dice en el momento, y la bitácora cuenta los resultados sin guardar hasta que la persona lo reconoce («Entendido»). Un guardado exitoso posterior ya no borra el aviso.
- Revisión de Codex sobre #13 en `5dfdd10` (5485247029), «Separá F02-T05 de este correctivo»: no aplica tal como está planteado, porque el usuario fusionó #11 en `f02-t02-fix01` y T05 llega a `main` con #13; no queda nada duplicado. Sí aplicaba que la presentación del PR lo dejara claro: el título y la descripción de #13 lo explican y ESTADO lo registra (`4bdf9dd`).
- Revisión de Codex sobre #13 en `502f1e5` (5485297286; llegó con #13 ya fusionado y se corrige en F02-T02-FIX02, #14), con pruebas:
  - La hora monotónica salía de la copia en memoria: con dos pestañas sin `BroadcastChannel`, una podía fechar su respuesta antes que la otra. Ahora el almacén lee la última hora guardada dentro de la transacción de escritura (base versión 3, con índices) y se la pasa a quien arma el intento. Lo cubre una prueba con dos pestañas y relojes distintos, que falla sin la corrección.
  - Intentos de actividad incompletos en un respaldo: `attemptErrors` exige que estén terminados, con una sola respuesta, corrección y puntaje coherentes y sin puntos de examen.
  - CONTINUIDAD y la pila de ESTADO todavía decían que #11 seguía abierto: actualizados. #13 ya se fusionó; el único PR pendiente de la fase 2 es #14 (F02-T02-FIX02).
- Revisión de Codex sobre #14 en `2c20de4` (5485330256), con pruebas:
  - IndexedDB ordena como texto los índices de hora de los intentos, y un respaldo con fechas en otra precisión ISO (por ejemplo, sin milisegundos) desordenaba ese texto. Ahora la importación reescribe todas las fechas en el formato canónico que usa la app (`toISOString`).
  - Una línea de ESTADO decía «solo queda #13»: corregida.
- Revisión de Codex sobre #14 en `9d861f1` (5485344650), con prueba:
  - La migración a la versión 3 creaba los índices sobre las fechas que ya estaban guardadas en v2, sin normalizarlas. Ahora la rama de migración reescribe en formato canónico las fechas de los intentos guardados (inicio, fin, eventos y faltas) dentro de la misma transacción de actualización; si falla, la actualización se cancela.
- Revisión de Codex sobre #14 en `57d043c` (5485364414; llegó con #14 ya fusionado y se corrige en F02-T02-FIX03, #15), con prueba:
  - La migración normalizaba también las fechas de intentos ilegibles, así que la cuarentena ya no guardaba el registro original. Ahora solo se normalizan los intentos que cumplen el esquema.
- Revisión de Codex sobre #15 en `6e8fe7d` (5485379648): las bases que ya migraron a v3 con el código de #14 no vuelven a migrar, y el valor original de esas fechas no se conserva, así que no se puede restaurar. Queda documentado como limitación conocida en ARQUITECTURA: solo cambia el formato de la fecha de esos registros, y afecta bases locales, porque la app no está publicada.
- Revisión de CodeRabbit sobre #15 en `6e8fe7d` (5485380475), 1 finding menor: ARQUITECTURA decía «intentos que se pueden leer» sin aclarar el criterio. **Corregido:** ahora dice que la migración normaliza los intentos que validan con `AttemptSchema`, que es lo que hace `canonicaliseAttempts` en `src/progress/storage.ts`.

## Tareas de la fase 3

| Tarea | Rama | Base | Depende de | PR | Estado |
|---|---|---|---|---|---|
| F03-T01 | `f03-t01-simulation` | `main` | F02 (fusionada, con #15) | #16 | en revisión (etapa B) |
| F03-T02 | `f03-t02-transmission` | `f03-t01-simulation` (#16) | T01 (#16) | #17 | en revisión (etapa B) |
| F03-T03 | — | — | T02 | — | autor asignado: GPT-6 Astra; fuera de esta sesión |
| F03-T04 | — | — | T03 | — | pendiente |
| F03-T05 | — | — | T04 | — | pendiente |

### F03-T01 — Simulación a paso fijo, vehículo, dirección, frenado y colisiones

- Alcance: simulación pura y determinista en `src/sim/`:
  - paso fijo de 1/120 s con acumulador e interpolación;
  - vehículo con modelo bicicleta cinemático, dirección de velocidad limitada y límite de adherencia;
  - frenado calibrado con la tabla del manual (PDF 70);
  - colisiones de cajas orientadas con contacto refinado por bisección y medición de distancias.
  - Además, una pista de prueba en `#/pista` para calibrar y verificar en el navegador.
- Aceptación:
  - **Movimiento independiente de los FPS dentro de tolerancias documentadas:** a 30, 60 y 144 Hz, los estados difieren como máximo en un paso (prueba).
  - **Colisiones y distancias comprobables:** el auto se detiene a menos de 1 cm de la pared, con la velocidad de impacto informada; la distancia a un poste se mide con precisión; el frenado coincide con el manual (pruebas).
- Rapier: evaluado y no adoptado por ahora (ver ARQUITECTURA, «Simulación de manejo»).
- Verificación local:
  - `npm run check` con 221 pruebas;
  - `npm run test:e2e` con 28 pruebas (manejar con el teclado, frenar hasta detenerse, volver al inicio, y que la vista no lea teclas sin foco);
  - capturas revisadas en escritorio y móvil, sin desborde horizontal.
- Limitación documentada: en móvil no se puede manejar todavía; los controles táctiles llegan con F03-T03.
- Revisiones: según la indicación del usuario, se piden después de revisar los findings propios de T01 y T02.
- Findings de la revisión automática de Codex al abrir #16 (5485401092), aplicados con pruebas:
  - Las rampas de pedales y volante avanzaban una vez por cuadro y su valor se aplicaba a todos los pasos del cuadro, así que dependían de los FPS. Ahora avanzan dentro de cada paso fijo. Una prueba exige estados idénticos a 30 y a 120 Hz, y falla sin la corrección; la primera prueba del componente no lo detectaba, porque comparaba con redondeo al centímetro.
  - Al cambiar de pestaña o de aplicación con una tecla apretada, el auto seguía acelerando: ahora las teclas se sueltan también con el `blur` de la ventana y con `visibilitychange`.
  - La velocidad de impacto era la del comienzo del paso: ahora se interpola en el instante del contacto.
- Revisión de Codex sobre `03b2f45` (5485494300), con prueba:
  - La limpieza de la escena solo liberaba mallas, así que la grilla (`GridHelper`, que es un `LineSegments`) quedaba sin liberar al salir de la pista. Ahora también se liberan líneas y puntos.
- Rebasado sobre `main` después de que el usuario fusionó #15.

### F03-T02 — Caja manual y automática, embrague, punto de acople, calado, reversa, llave y freno de mano

- Alcance:
  - tren motriz en `src/sim/powertrain/`: motor con ralentí, freno motor y calado; embrague con punto de acople; caja manual de cinco marchas y R; automática P, R, N y D con convertidor y cambios por velocidad; llave y freno de mano;
  - integración `stepCar` y `command` (`src/sim/car.ts`);
  - eventos para la evaluación;
  - en la pista de prueba: elección de caja, teclas de embrague, cambios, llave y freno de mano, y un panel con rpm, marcha, motor, freno de mano, llave y avisos.
- Aceptación, **procedimientos y restricciones del protocolo reproducibles en ambas transmisiones**. Cada uno tiene prueba (`procedures.test.ts`):
  - etapa I (PDF 9–10);
  - desplazamientos de 30 cm, solo con el embrague en manual y regulando con el freno en automática (PDF 11);
  - primeros 100 m en segunda o D a no más de 30 km/h (PDF 11, 31);
  - calado, salida con el freno de mano y cambios rechazados;
  - final con N o P, freno de mano, motor apagado y llave afuera (PDF 13, 25).
- Errores encontrados por las pruebas y corregidos: cerca de la traba, el sentido del patinamiento del embrague salía del ruido de la diferencia de velocidades y el embrague frenaba en lugar de empujar. Dos procedimientos de prueba eran irreales (salir con el embrague a 0,55 y poco acelerador cala, como en un auto real) y se corrigieron.
- Verificación local:
  - `npm run check` con 247 pruebas;
  - `npm run test:e2e` con 30 pruebas: automática hasta D con arrastre, manual con salida con embrague y acelerador, y vista sin foco.
- Revisiones: se piden después de revisar los findings de T01 y T02 (indicación del usuario).

## Pila y orden de fusión

La pila de la etapa A (`main ← F02-T01 ← … ← F02-T05`) quedó toda en `main`: T01–T04 (#7–#10), F02-T01-FIX01 (#12), F02-T02-FIX01 con T05 (#13, que incluye #11) y F02-T02-FIX02 (#14). Queda F02-T02-FIX03 (#15), desde `main`.

## Bloqueos

Ninguno conocido.

## Siguiente acción

Fase 2: revisar los findings de #15 (F02-T02-FIX03) y fusionarlo; con eso se cierra. Fase 3: revisar los findings de T01 (#16) y de T02 (#17), corregirlos y recién entonces pedir las revisiones de Codex.

## Decisiones que no deben reinterpretarse

- Repo destino, visibilidad pública y revisores fueron confirmados por el usuario el 2026-10-11; no volver a preguntar.
- Versiones de dependencias: exactas y con al menos dos semanas de publicadas al elegirlas; TypeScript 6.0.x porque `typescript-eslint` no admite TypeScript 7 (ver ARQUITECTURA.md).
- Ver también «Hallazgos que no deben perderse» en `CONTINUIDAD.md`.
