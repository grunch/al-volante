# Estado de implementación

Registro operativo exigido por `PLAN_IMPLEMENTACION.md` §6. Actualizar en cada PR y al cerrar cada fase.

Última actualización: 2026-10-12 (correctivo F04-T05-FIX01, #36, con `main` en `f3d2f60`).

## Fase activa

- **Fase 2 — Base web, datos y aprendizaje inicial: tareas fusionadas en `main`.** El usuario fusionó #7–#10 (21:18–21:21 UTC), #11 (T05) dentro de `f02-t02-fix01` (`5dfdd10`), #12 (`493e5f7`), #13 (`1a842bf`, 22:24) y #14 (`07af269`, 22:46) el 2026-10-11. El correctivo F02-T02-FIX03 (#15) también está fusionado (`d7db55c`).
- Mensaje de inicio (2026-10-11): «fusionada toda la fase 1, ahora comienza con la fase 2, no pares hasta terminar todos los PRs de esa fase, lee bien la documentacion para que tengas todos los aspectos y contexto antes de implementar el codigo».
- **Fase 3 — Auto e interior: tareas fusionadas.** #16–#20 y el correctivo #21 están en `main` (`89791fc`). La descripción histórica de cada tarea conserva sus revisiones y limitaciones.
- **Fase 4 — Comuna 13 A y examen práctico completo: tareas fusionadas.** #22 (`3c7aca2`), #23 (`a3c5e15`), #24 (`d919f98`), #25 (`cefe7b2`) y #26 (`b36fe55`) están en `main` (2026-10-12). Las CI de las dos últimas fusiones quedaron canceladas y `main` tenía rojas las vueltas guionadas: lo repara el correctivo F04-T04-FIX01 ([#27](https://github.com/grunch/al-volante/pull/27)).
- **Fase 5 — Todo el contenido y simulacros teóricos: tareas fusionadas.** F05-T05 ([#33](https://github.com/grunch/al-volante/pull/33)) se integró en `main` con `9dd6d9e`. Mensaje de inicio (2026-10-12): «mejor comienza a implementar la fase 5, desde la tarea 1 hasta la ultima, no te detengas hasta completar la fase 5». Método, estados y decisiones del contenido en `CONTENIDO.md`.
- **F04-T01-FIX02 — experiencia de conducción:** rama `f04-t01-fix02-driving-realism`, base `main` actualizada a `9dd6d9e`, worktree independiente; [#34](https://github.com/grunch/al-volante/pull/34), implementación `404ea74`, validación local previa aprobada; integración de #33 verificada localmente; fusionado en `main` (`f3d2f60`). Pedido puntual posterior a #31; no inicia fase 6.
- **F04-T05-FIX01 — guía de manejo del examen práctico:** [#36](https://github.com/grunch/al-volante/pull/36), rama `f04-t05-fix01-driving-guide`, abierto. Pedido puntual del usuario; no inicia fase 6. Detalle en la sección de la tarea.
- **F04-T01-FIX01 — referencias visuales, fusionado en `9bc0257`:** [#31](https://github.com/grunch/al-volante/pull/31), en worktree independiente, rama `f04-t01-fix01-street-reference`. Partió de `b36fe55` e incorporó `main` hasta `693f692` para resolver conflictos documentales y conservar #27–#30 y #32; no toca el worktree de Opus.
- **F04-T01-FIX04 — E2E con margen para WebGL por software:** rama `f04-t01-fix04-e2e-budgets`, desde `main` (`f3d2f60`). Repara la CI roja de `main` tras #34 (tiempos de reloj justos, sin error de código); #35 y #36 lo integran.
- Fases 6–7: no iniciadas.
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
| F02-T02-FIX03 | `f02-t02-fix03` | `main` | #14 (fusionado) | #15 | fusionada (`d7db55c`) |

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
| F03-T01 | `f03-t01-simulation` | `main` | F02 (fusionada, con #15) | #16 | fusionada (`0fce7c2`) |
| F03-T02 | `f03-t02-transmission` | `f03-t01-simulation` (#16) | T01 (#16) | #17 | fusionada (`e49dc5b`) |
| F03-T03 | `f03-t03-cockpit` | `main` (`e49dc5b`) | T02 fusionada (#17) | [#18](https://github.com/grunch/al-volante/pull/18) | fusionada por el usuario (2026-10-12) |
| F03-T04 | `f03-t04-evaluation` | `f03-t03-cockpit` (#18) | T03 (#18) | [#19](https://github.com/grunch/al-volante/pull/19) | fusionada por el usuario (`7cb9f82`, 2026-10-12) |
| F03-T05 | `f03-t05-first-block` | `f03-t04-evaluation` (#19) | T04 (#19) | [#20](https://github.com/grunch/al-volante/pull/20) | fusionada por el usuario (`afb3b01`, 2026-10-12) |
| F03-T05-FIX01 | `f03-t05-fix01` | `main` (`afb3b01`) | #20 (fusionado) | [#21](https://github.com/grunch/al-volante/pull/21) | fusionado en `main` (`89791fc`) |

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
  - `npm run check` con 252 pruebas;
  - `npm run test:e2e` con 30 pruebas: automática hasta D con arrastre, manual con salida con embrague y acelerador, y vista sin foco.
- Revisiones: se piden después de revisar los findings de T01 y T02 (indicación del usuario).
- Findings de la revisión automática de Codex al abrir #17 (5485441891), aplicados con pruebas:
  - Desde la pista no se podía sacar la llave, así que el procedimiento final no se podía completar: K ahora recorre el ciclo completo (contacto, arranque, apagado y sacar la llave). La E2E manual termina con el freno de mano, N, el motor apagado y la llave afuera.
  - La salida con el freno de mano se volvía a informar al detenerse y arrancar otra vez sin soltarlo. REGLAS la define por episodio: ahora la marca solo se reinicia al soltar o volver a poner el freno de mano.
  - Comentario y nombres de prueba con expresiones en español: pasan a inglés y citan los ids de regla (`rule.minor.f-handbrake-on-start`, `rule.low.d-engine-stall`).
- Después del rebase sobre los findings de T01, la vista usa la misma función de cuadro (`driveFrame`) con el auto completo: rampas por paso fijo, comandos antes de los pasos y teclas liberadas al perder el foco la ventana.


### F03-T03 — Habitáculo, espejos e instrumental

- Inicio explícito posterior al cierre de T01/T02; se conservó `main` limpia y se trabajó en la rama de tarea existente.
- Resultado: habitáculo procedural, vista desde el conductor, volante/tablero animados, tres espejos de la escena, mirada, asiento/apoyacabezas, cinturón, instrumental, teclado reasignable y controles en pantalla.
- Fuentes: `specs/fuentes/pdf/protocolo.pdf`, PDF 9–10 y 18–20. Ajustes y dimensiones identificados como aproximaciones; sin evaluación todavía.
- Verificaciones: `npm run check` pasó con 268 pruebas y cobertura de 95,07 % en sentencias / 88,89 % en ramas. `npx playwright test --workers=1` pasó: 34 E2E, cero fallos o reintentos. El ajuste final de sentido visual del volante/agujas tiene cuatro pruebas de escena aprobadas y cuatro E2E de revalidación visual aprobadas.
- Capturas inspeccionadas: se corrigieron orientación del espejo interior y obstrucción del volante por la carrocería provisional.
- Revisión Codex 5485745268: aplicaba la pérdida de toques entre cuadros. Corregida con retención hasta el siguiente paso fijo; los cuadros sin pasos conservan el pulso y la pérdida de foco lo descarta. La bocina se representa al menos durante el cuadro que consume el pulso. No se reconstruye la duración exacta de eventos entre cuadros.
- Revisión CodeRabbit 5485752374: aplicaba la búsqueda global de `body`. Corregida limitándola al auto; prueba de regresión con un obstáculo homónimo.
- Verificación de ambas correcciones: `npm run check` aprobado, 279 pruebas, cobertura 95,32 % de sentencias / 89,02 % de ramas. Además, 10 E2E de habitáculo y conducción aprobados en Chromium de escritorio y móvil, con un worker. La CI anterior (`da59c65`) aprobó comprobaciones estáticas y falló E2E con tiempos agotados; no se declara CI aprobada para la corrección.
- Corrección del check E2E, solicitada por el usuario: la ejecución remota 38189874721 (`20cefc5`) agotó el tiempo en el muestreo de 60 cuadros y en interacciones del habitáculo/conducción. Se serializan navegadores en CI, se separa el perfilado (hasta 60 cuadros con ventana de 5 segundos) y las maniobras esperan tiempo de simulación. La secuencia de conducción tiene un presupuesto de 60 segundos. No se eliminan aserciones ni se cambia la simulación.
- Validación de la corrección E2E: lint, formato y tipos aprobados; build de producción y 36 E2E aprobados en modo CI, sin reintentos. El intento local previo con dos workers también pasó (10 E2E): no se reprodujo el fallo remoto. El resultado de la nueva ejecución remota se consulta en #18.
- CI de `5d3a843`: ambos jobs aprobados en la ejecución 38190546993, con 36 E2E aprobados (3,1 minutos).
- Nueva revisión Codex 5485804952 (`5d3a843`): aplicaba la ausencia de activación por click semántico en los mandos sostenidos. Se agregó un pulso para click con `detail=0`; los clics de puntero no duplican su secuencia. La prueba de regresión falló antes del cambio y pasa después; otra prueba verifica que un clic de puntero no agrega un pulso. `npm run check`: 281 pruebas aprobadas, cobertura 95,37 % de sentencias / 89,12 % de ramas. Revalidación de 12 E2E de habitáculo/conducción aprobada en modo CI sin reintentos.
- Siguiente acción vigente: monitorear #18 y resolver findings aplicables antes de pedir nuevas revisiones. T04 y T05 quedan pendientes de autorización.

### F03-T04 — Motor de evaluación, familiarización, etapa I, 30 cm y salida

- Inicio: pedido del usuario del 2026-10-11, «ya hay un PR del F03 T03, ahora haz T04 en adelante hasta terminar la fase 3». Apilado sobre `f03-t03-cockpit` (#18).
- Alcance: `src/exam/scoring.ts` (libro de fallas: puntos, repetición, escalamiento, interrupción, resultado) y `src/exam/session.ts` (examinador virtual: familiarización, reconocimiento con semilla, preparación, desbloqueo, retroceso y avance de 30 cm, salida del cajón); observador por paso fijo en `driveFrame`; `DrivingCanvas` con `prepared` y `onObservation`; página `#/examen` con examinador, puntos, mediciones, fallas y resultado parcial. Detalle y límites en ARQUITECTURA, «Evaluación del examen».
- Aceptación:
  - **Secuencia completa comprobable:** `session.test.ts` recorre familiarización → reconocimiento → preparación → desbloqueo → 30 cm atrás y adelante → salida, en manual y automática, con el auto y el habitáculo reales paso a paso.
  - **Reglas de repetición e interrupción:** `scoring.test.ts` cubre una vez, control único, cada vez, por episodio (D3), escalamiento, interrupción por eliminatoria, corte con 8 puntos y pedido del aspirante; `session.test.ts` comprueba el corte antes de moverse, el cinturón, el freno de mano por episodio, el calado, el roce y el derribo de un poste.
  - **Puntuación verificada para este alcance:** cada falla cita su regla de `rules.json`, con sus puntos; la interfaz muestra el texto de la ficha y la política.
- Aproximaciones declaradas (REGLAS.md V2 y D4; `GAME_PARAMETERS`): tolerancia de 10 cm, umbrales de volante, roce/derribo, giro de cabeza y movimiento. No son reglas del protocolo y la interfaz lo dice.
- Verificación local: `npm run check` con 298 pruebas (cobertura 95,2 % sentencias / 88,8 % ramas), contenido OK y build OK; `npx playwright test --workers=1` con 36 E2E (incluye `tests/e2e/exam.spec.ts`).
- Revisiones: Codex y CodeRabbit solicitados al abrir el PR; se registran al llegar.
- Revisión de Codex sobre `6d4732e` (5 findings, todos aplicados con prueba):
  - Caja en el reconocimiento (P1): los controles solo pasan a la posición vecina, así que pedir D desde P puntuaba la R intermedia como error, y faltaban 2.ª–5.ª. Ahora la caja se pide completa y de vuelta a N/P, en orden; una marcha en camino no es respuesta y una que se aleja es la eliminatoria b.
  - Cordón (P1): todo contacto con el cordón era eliminatorio; ahora, por debajo de 1 m/s es el roce de la rueda (leve i) y por encima, subirse a la vereda (aproximación declarada).
  - Freno en los 30 cm manuales (P2): frenar antes del final (moverse más de 5 cm después de pisarlo) falla la maniobra.
  - Espejos (P2): girar del todo la cabeza ya no cuenta; cuenta mirar un espejo lateral (0,25–0,9 rad), con botones y teclas nuevos (U y P), según X6.
  - Auto al empezar el reconocimiento (P2): la página lo vuelve a poner con motor apagado y llave en contacto.
- Revisión de CodeRabbit sobre `db1a9d1` (6 findings, todos aplicados):
  - El corte de 8 puntos «antes de moverse» era una interpretación presentada como regla: ahora es la decisión D5 de REGLAS.md §7, y ARQUITECTURA cita `protocolo.pdf` con páginas.
  - CONTINUIDAD decía «0,5 rad de giro de cabeza»; ahora dice el rango real (0,25–0,9).
  - La página mostraba «resultado parcial» con 8 puntos o más sin interrupción; ahora usa `resultOf` y muestra «Desaprobado».
  - Apagar un instrumento o las balizas contaba como respuesta equivocada; ahora solo cuenta encenderlos.
  - Faltaban los textos de 2.ª a 5.ª y la consigna de R hablaba de embrague en la automática; ahora cada marcha tiene texto y la ayuda depende de la caja.
- Segunda revisión de Codex sobre `db1a9d1` (4 findings, todos aplicados con prueba):
  - Arrancar en cambio con el embrague pisado no registraba la falta de no verificar neutro; ahora `engine-started` también la consigna según la última marcha.
  - El avance de 30 cm aprobaba en segunda; ahora exige primera (o D) y el retroceso exige R.
  - Los ajustes hechos en la familiarización sobrevivían al reinicio del habitáculo; ahora se olvidan al empezar el reconocimiento.
  - Un solo espejo bastaba; ahora hay que regular los tres (PDF 9).

### F03-T05 — Primer tramo real y cruce con semáforo, vehículo y peatón

- Apilado sobre `f03-t04-evaluation` (#19), por el mismo pedido del usuario.
- Alcance: `src/sim/scenario.ts` (semáforo y actores con guion), `src/sim/tracks/firstBlock.ts` (Quesada hasta Av. Cabildo, tramo 1 del recorrido A), escenario avanzado en el bucle de manejo y dibujado en la escena, fases `firstMetres`, `approach` y `turn` del examinador, y devolución básica en `#/examen`. Detalle y límites en ARQUITECTURA, «Primer tramo y cruce».
- Aceptación:
  - **Sesión jugable desde la preparación hasta el cruce:** la página de examen usa el primer tramo; `street.test.ts` recorre con el auto, el habitáculo y el escenario reales desde el cajón hasta la avenida.
  - **Prioridades, giro y detención con consecuencias verificables:** peatón en la senda (alta l; atropello escalado a eliminatoria), vehículo que cruza (eliminatoria i al tocarlo), rojo (eliminatoria k), detención pasada la línea (alta h), bloqueo de la encrucijada (alta i), direccional ausente o tardía (baja g, leve q), seguir de largo (eliminatoria f), primeros 100 m (eliminatoria g); cada caso con prueba.
- Aproximaciones declaradas (ARQUITECTURA; `GAME_PARAMETERS`): margen de 1 km/h, marcha exigida por encima de 15 km/h, 2 s para bloquear el cruce, 70° para dar el giro por hecho, ciclo del semáforo y actores del guion.
- Verificación local: `npm run check` con 343 pruebas (cobertura 95,3 % sentencias / 88,8 % ramas), contenido OK y build OK; `npx playwright test --workers=1` con 36 E2E.
- Revisiones: Codex y CodeRabbit solicitados al abrir el PR; se registran al llegar.
- Segunda revisión de Codex sobre `cc7d424` (5 findings): uno ya estaba resuelto por #19 (`resultOf` en la página); los otros cuatro llegaron con #20 ya fusionado y se corrigen en F03-T05-FIX01 (ver abajo).
- Revisión de Codex sobre `25101d8` (3 findings, todos aplicados con prueba):
  - Máxima vial y límite de examen (P1): eran iguales, así que 35 km/h en Quesada desaprobaba por l. Ahora el tramo lleva el límite de examen (30/45) y la máxima propia de la vía (40/60 según OSM, a confirmar en F04-T01); por encima del límite pero bajo la máxima es la alta f.
  - Actor por ciclo (P1): el auto que cruza volvía a salir dentro del mismo rojo al terminar su recorrido; ahora recuerda el ciclo en que corrió y sale una vez por ciclo.
  - Direccional (P2): apagarla o cambiarla de lado olvida el episodio; al cruzar la línea se exige que siga encendida y que su episodio haya empezado 30 m antes.
- Re-apilado sobre #19 después de sus correcciones y del avance de #18.

### F03-T05-FIX01 — Correctivo de los findings tardíos de #20

- Origen: segunda revisión de Codex sobre `cc7d424` en #20, que llegó con el PR ya fusionado (`afb3b01`). Rama desde `main`.
- Correcciones, cada una con prueba:
  - Atropello tras entrar en la senda (P1): la alta l del episodio `crosswalk` ya registrada bloqueaba la escalada; ahora `recordFault` eleva esa misma falta a eliminatoria (8 puntos, interrupción) en vez de agregar otra.
  - Exceso que llega a la máxima vial (P2): la alta f del episodio se retira (`withdrawFault`) y queda solo la eliminatoria l (D2).
  - Episodios de velocidad (P2): corregir el exceso cierra el episodio y volver a exceder abre otro (`speed-n`, D3).
  - Suelo y grilla (P2): la escena los dimensiona y centra según los obstáculos y marcas del mundo (mínimo 200 m, margen de 60 m), así el cruce de Av. Cabildo tiene pavimento.
- Revisión de Codex sobre `ef2ad7e` (1 finding, aplicado con prueba): tras superar la máxima vial, bajar a 35 km/h sin salir del exceso volvía a registrar la alta f del mismo episodio; ahora la sesión recuerda el episodio que recibió la eliminatoria y no vuelve a puntuar f en él (D2).
- Revisión de Codex sobre `0d6e4fc` (1 finding, aplicado con prueba): un exceso sostenido al pasar de la calle al giro conservaba el episodio; ahora la identidad del episodio incluye la fase, así que cambiar de contexto vial abre otro (D3), y la alta f vuelve a contar en la avenida aunque la calle haya recibido la eliminatoria l.
- Verificación: `npm run check` con 347 pruebas (cobertura 95,3 % / 88,9 %), contenido OK, build OK; E2E del examen.

## Tareas de la fase 4

| Tarea | Rama | Base | PR | Estado |
|---|---|---|---|---|
| F04-T01 | `f04-t01-city` | `main` (`89791fc`) | [#22](https://github.com/grunch/al-volante/pull/22) | fusionada en `main` (`3c7aca2`); findings de `9dc94d3` y `5b07456` corregidos |
| F04-T02 | `f04-t02-traffic` | `main` | [#23](https://github.com/grunch/al-volante/pull/23) | fusionada en `main` (`a3c5e15`); findings de `a5b9496`, `f53b7f3`, `50ce70f` y `d2c563a` corregidos |
| F04-T03 | `f04-t03-examiner` | `main` | [#24](https://github.com/grunch/al-volante/pull/24) | fusionada en `main` (`d919f98`); findings de `f4d7c6f`, `eaf60ce` y `cf9d690` corregidos |
| F04-T04 | `f04-t04-parking` | `main` (#24 fusionado) | [#25](https://github.com/grunch/al-volante/pull/25) | fusionada en `main` (`cefe7b2`); findings de `f2624a4`, `b551baa` y siguientes corregidos |
| F04-T05 | `f04-t05-modes` | `f04-t04-parking` (#25) | [#26](https://github.com/grunch/al-volante/pull/26) | fusionada en `main` (`b36fe55`); findings de `f7b9398` y siguientes corregidos |
| F04-T04-FIX01 | `f04-t04-fix01` | `main` (`b36fe55`) | [#27](https://github.com/grunch/al-volante/pull/27) | fusionado en `main` (`367b484`); findings de Codex (`3327a92`, `bbea36a`, `7c010ff`) y CodeRabbit (`e048648`) resueltos |
| F04-T05-FIX01 | `f04-t05-fix01-driving-guide` | `main` (`9dd6d9e`) | [#36](https://github.com/grunch/al-volante/pull/36) | abierto: guía de manejo del examen práctico; revisiones solicitadas |

### F04-T01 — Ciudad y recorrido completo

- Resultado: explorador de los ocho tramos (1506,8 m: `loopLengthM` de `route/comuna13-a.json`, calculado sobre la geometría OSM y verificado en [RECORRIDO.md](RECORRIDO.md) §4 y §6; secuencia oficial: `fuentes/pdf/recorridos.pdf`, PDF 16, y `fuentes/pdf/protocolo.pdf`, PDF 39), mapa métrico, carga por sectores, componentes visuales reutilizables, carriles/ciclovías según subtramo, controles con evidencia, entrada por tramo y conducción con el habitáculo existente. Detalle en [CIUDAD.md](CIUDAD.md).
- Se inspeccionaron en navegador la cuadra, la vista completa y el habitáculo. Se corrigió el parpadeo de superficies en la vista general ajustando la precisión de profundidad.
- Autoprueba de conducción: el modelo real recorre el circuito con dirección limitada, a 120 Hz, sin contactos con cordones; no acredita circulación legal ni evaluación completa.
- Validación sobre la base que incluye #21: `npm run check` aprobado con 364 pruebas, cobertura 95,23 % en sentencias / 88,92 % en ramas, catálogo y build. Suite completa de 44 E2E aprobada sin reintentos; después de los ajustes finales, ocho E2E de recorrido/examen aprobados. La prueba unitaria del examen ahora espera el inicio del bucle antes de enviar teclas, evitando la carrera con el montaje diferido.
- Rendimiento medido en Chromium 153/SwiftShader, Ryzen 7 4800H: media de 178,13 ms por cuadro en escritorio y 138,85 ms en Pixel 7 emulado. No cumple 60 FPS en este entorno por software ni certifica un teléfono real; detalles y condiciones en `CIUDAD.md`.
- Pendientes explícitos: no hay relevamiento nuevo de PARE, reductor, carriles, máximas o cajón. La pantalla mantiene las evidencias y aproximaciones. Semáforos apagados y sin tránsito/evaluación completa en esta tarea.
- PR #22 abierto con implementación `ab68fd2` y registro `9dc94d3`; CodeRabbit automático y Codex solicitado. Sin excepción de cuota aplicada.
- Revisiones sobre `9dc94d3` (etapa B, 2026-10-12): CI verde (unitarias, catálogo, build y E2E). Codex, 1 finding: la vista en carga tenía `role="img"` y ocultaba el estado vivo «Construyendo el barrio…»; ahora el rol de imagen se aplica solo en `ready`, con prueba que falla sin el cambio. CodeRabbit, 3 findings, todos corregidos: referencias trazables de cada dato en `CIUDAD.md` (catálogo, OSM/GCBA, protocolo) separando dato respaldado de aproximación; fila de #21 sincronizada como fusionada; cita del gráfico 4 (protocolo PDF 21) para los 6 m del cajón en `RECORRIDO.md` §10.
- Revisión de CodeRabbit sobre `5b07456` (CI verde en ese commit), 3 findings, corregidos: la vista vuelve a «cargando» al reconstruirse (otro tramo, circuito completo u otro renderizador) y no conserva `ready`, con prueba que falla sin el cambio; la longitud distingue cálculo OSM y secuencia oficial (recorridos PDF 16, protocolo PDF 39); fila y registro de #22 sin referencias obsoletas. Pendiente: la revisión de seguimiento de Codex y CodeRabbit sobre este commit.

### F04-T02 — Tránsito del circuito

- Apilado sobre `f04-t01-city` (#22), por el pedido «ya está el pr de F04 T01, haz el resto de tareas de esta fase». Orden obligatorio: #22 → [#23](https://github.com/grunch/al-volante/pull/23).
- Alcance: `src/traffic/` (red de encrucijadas, aproximaciones, sendas y trayectorias; planes de semáforo por semilla; autos, colectivos, bicicletas y peatones con seguimiento, semáforos, PARE, prioridad de la derecha y peatones; `lookAhead` para el examinador y los conductores de prueba), `TrafficSnapshot`/`TrafficSource` en `scenario.ts` con `World.traffic` y `trafficOf`, bucle de manejo genérico, lámparas encendidas y actores en la escena de la ciudad, semilla en `#/recorrido`. Detalle en ARQUITECTURA, «Tránsito del circuito».
- Aceptación:
  - **Actores interactúan coherentemente:** pruebas `stops at a red light before the line and goes on green`, `comes to a full stop at a STOP sign, waits, then goes`, `keeps a following distance behind a slower vehicle`, `follows the car itself`, `yields to a vehicle crossing from the right … and goes when it has priority`, `yields to the car when it comes from the right, and proceeds once the car has stopped and lost priority`, `lets pedestrians cross a signalled crosswalk only on its walk phase`, `lets pedestrians step off an unsignalled crosswalk only in a gap, and vehicles stop for them`, `keeps bicycles on the cycle track`, `keeps every vehicle at or below the speed of its lane`, `reports a contact once`, `never shows green to both streets`.
  - **Cruces y tránsito no bloquean indefinidamente una conducción válida:** `completes the lap with traffic on, obeying the lights, without touching anyone and never waiting a full cycle` (`src/traffic/lap.test.ts`): la vuelta completa con la semilla 1, sin contactos, sin cruzar en rojo, con detenciones en rojo y ninguna espera mayor a 36 s; `is reproducible` para la semilla.
- Aproximaciones declaradas (ARQUITECTURA): ciclo 14/3/19 s con 1 s de todo rojo; espera de 1 s en PARE; 20 m o 4 s para considerar que alguien llega; 1,5 s detenido para perder la prioridad (excepción 4 del manual, PDF 64); 8 s anti-bloqueo; aceleraciones y frenados de los actores; velocidades de contexto, Metrobús y bicicleta; densidad de un vehículo cada 120 m; fase peatonal = rojo de su calle; brecha peatonal de 15 m; sentidos de las calles de contexto, doble mano del Metrobús, Congreso y ciclovía; prolongaciones de 15 m; líneas de detención geométricas (la pintura de tres semáforos de media cuadra queda para F04-T03).
- Verificación local: `npm run check` aprobado con 391 pruebas (cobertura 95,95 % sentencias / 90,72 % ramas), contenido OK y build OK. Playwright: `npx playwright test --workers=1` con 46 E2E aprobados (escritorio y Pixel 7 emulado), incluido el caso nuevo de tránsito; ciudad y examen aprobados también por separado (10).
- PR #23 abierto con implementación `f4d4ccb` (reescrita al rebasar sobre #22) y registro `a5b9496`; correcciones de la etapa B en `f53b7f3` y siguientes. Sin excepción de cuota aplicada.
- Para F04-T03: consumir `TrafficSnapshot.lights` (estado por control), `lookAhead` (semáforo, cruce, senda y vehículo de adelante con distancias y cajas de conflicto), `poses` con `inside(zona)` y los eventos `actor-contact` de cualquier tipo de actor; `Approach.rule`/`group` dan la regla de cada cruce. `light` solo resume la luz que el auto enfrenta en el recorrido.
- Revisiones sobre `a5b9496` (etapa B, 2026-10-12). CI: la prueba `keeps bicycles on the cycle track beside the road` superaba los 5 s por defecto en el runner (6,9 s); ahora tiene 30 s, como las otras simulaciones largas. E2E verde. Codex, 4 findings, todos corregidos: (1) los cabezales de las tres sendas semaforizadas de Cabildo no se dibujaban ni encendían; ahora `isSignalControl` incluye `crossing-traffic_signals` en la creación y el encendido; (2) los dos sentidos de la ciclovía compartían la línea central; cada uno usa su mitad derecha, y quien viene de frente ya no cuenta como vehículo de adelante (separadas 1,3 m, dos bicicletas enfrentadas se trababan y la vuelta legal no terminaba); (3) las mallas de los peatones terminados se acumulaban; se liberan cuando su id sale del estado; (4) `CIUDAD.md` aún decía que solo T01 estaba autorizada. Pruebas nuevas de escena y red que fallan sin los cambios. CodeRabbit no revisó (límite de reseñas gratuitas); se vuelve a pedir.
- Segunda revisión de Codex sobre `f53b7f3`, 2 findings, corregidos: `lookAhead().leader` podía devolver un auto que cruzaba perpendicular delante (o venía de frente) y medir su brecha con el largo en vez de su extensión sobre el eje del auto; ahora solo cuenta quien va en el sentido del recorrido o del auto (hasta 60°), y sobre la línea del recorrido, mientras el auto también va por ella (después de cambiar de carril, la línea es otro carril), se lo sigue a lo largo de la vuelta (un filtro solo por el rumbo del auto perdía al auto que dobla adelante y la vuelta legal chocaba); prueba nueva `lookahead.test.ts` que falla sin el cambio; y este registro ya no dice que la CI y las revisiones están pendientes. CodeRabbit sigue pendiente por límite de cuota; la CI unitaria quedó verde tras las correcciones y corre de nuevo con este push.
- Tercera revisión de Codex sobre `50ce70f`, 1 finding (P1), corregido: tras 8 s cediendo, un actor fijaba `forcedStopS` y dejaba de mirar el cruce, así que avanzaba sobre el auto calado o sobre otro actor detenido en la encrucijada. Ahora el anti-bloqueo resuelve solo esperas mutuas (todos los que lo retienen son actores detenidos antes de su propia línea de ese cruce, con desempate determinista) y nunca pasa sobre el auto ni sobre quien está en el pavimento, tampoco después de empezar a pasar. Para que las esperas mutuas no se trabaran, quien ya cruza no toma como vehículo de adelante a un actor detenido en su línea de ese cruce (las bicicletas de la ciclovía quedaban enfrentadas con autos en su línea en Congreso y en la esquina de Quesada, y antes se resolvía atravesándolas). Pruebas nuevas que fallan sin el cambio: auto calado en la esquina de Quesada (el actor espera en su línea más de 8 s y sigue al despejarse) y auto que sigue llegando por la derecha más de 8 s (el actor no le quita la prioridad). Sonda local, no versionada: semillas 1–3, 400 s, auto lejos y calado en cada una de las 15 encrucijadas. Pasos por anti-bloqueo 1218 → 665, superposiciones entre actores 704 → 514 y contactos con el auto 3 → 3; estos tres son superposiciones de arranque, a 0,01 s, de la sonda que pone el auto sobre un actor. Con el auto lejos no queda ningún actor trabado. Con el auto calado, la cola de ese cruce lo espera, porque los actores no cambian de carril ni sobrepasan.
- Revisión de CodeRabbit sobre `d2c563a`, 7 findings. Seis corregidos y uno ajustado:
  - (1) Una aproximación con prioridad cedía ante quien llegaba a un PARE por su derecha, actor o auto. Ahora el PARE pierde la prioridad aunque venga por la derecha (`manual.pdf`, PDF 64, excepción 1). En la red actual el único caso, Iberá en Cuba, tiene el PARE a la izquierda; la prueba usa la esquina de Quesada con un PARE agregado.
  - (2) En la vuelta cíclica, el `break` por distancia cortaba el recorrido de `path.stops` antes de las detenciones que envuelven al final, y los autos podían pasar sin frenar el PARE de Vuelta de Obligado, justo antes del cierre. Ahora sigue con `continue`; prueba nueva.
  - (3) Al borrar la semilla en `#/recorrido`, el campo aplicaba la semilla 0. Ahora el campo admite quedar vacío mientras se edita, aplica solo enteros válidos y al salir vuelve a la última semilla.
  - (4) La prueba de peatones no exigía que el vehículo frenara. Ahora usa la senda sin semáforo de salida de Cuba, sin línea de detención justo antes (la de Quesada está a 1,5 m de un PARE), programa al peatón cuando el vehículo está a 25 m y exige que se detenga ante la senda; falla sin el frenado ante peatones.
  - (5, 6) Citas de `manual.pdf` (PDF 64 y 71) en las reglas de ARQUITECTURA y CIUDAD.
  - (7) Ajustado: la Fase 4 decía que T03–T05 seguían apiladas mientras la tabla no las registraba. Ahora la descripción y la tabla registran #24–#26, que ya existen, en lugar de «se crearán» como sugería la revisión.

### F04-T03 — Examinador del circuito y reglas de circulación

- Apilado sobre `f04-t02-traffic` (#23) hasta que #22 y #23 se fusionaron en `main`; desde entonces apunta a `main` e incorporó esa fusión.
- Alcance: `src/exam/circuit.ts` (circuito derivado de la ciudad y la red: tramos, esquinas con giro, cruces con regla, sendas, reductor, Metrobús, línea continua), `src/exam/circulation.ts` (juez puro de la etapa II con todas las reglas de circulación, umbrales `CIRCULATION`, avisos e instrucciones), `session.ts` (fases `firstMetres` → `circulation`, salida medida en el marco de la pose inicial, toma de control, contactos con causa `examiner`), `scoring.ts` (`cause` del reporte; todo escalamiento interrumpe como `examiner`), `src/traffic/emergency.ts` (ambulancia por vuelta) y una extensión mínima del tránsito (peatones de sendas semaforizadas no bajan frente al auto), `lookAhead` con tolerancia lateral, `DrivingCanvas` con `halted`, `ExamDrive`, `#/examen` sobre la ciudad con semilla, HUD de tramo/indicación/aviso/límites y devolución con la regla que interrumpe. Detalle en ARQUITECTURA «Examinador del circuito (F04-T03)».
- Aceptación:
  - **Cada regla del alcance tiene evidencia:** tabla regla → criterio → fuente → episodio → prueba en ARQUITECTURA; `src/exam/circulation.test.ts` (21 casos sintéticos: prioridad, 2 s, sobrepaso, peatones/ciclistas, precautoria, toma de control, bocina, emergencia, cambios de carril, carril, ciclovía, Metrobús, línea continua, contramano, reductor, mínima, detención innecesaria, primeros 100 m sin velocidad), `src/exam/street.test.ts` (16 casos con guion sobre la ciudad con tránsito: vuelta limpia de los ocho tramos, primeros 100 m correctos y con exceso en automática y manual, velocidad f/l con D2 y D3, rojo, línea, bloqueo, direccionales, seguir de largo, PARE, reducir, ambulancia, toma de control, atropello escalado, choque, pérdida de control, HUD), `src/exam/circuit.test.ts` (4 casos de derivación).
  - **Distinción entre 30/45 y máxima vial:** `street.road` expone `examKmh` (30 calles, 45 Cabildo) y `postedKmh` (OSM: 40/60/30, fuente única sin confirmar) por calle; la vuelta limpia lo comprueba por tramo (45/60 en Cabildo, 30/40 en Guayra, 30/30 en Cuba) y el HUD los muestra separados.
  - **Toma de control cuando corresponde:** D7 en REGLAS.md §7; pruebas «the examiner takes the dual controls» (sintética y con sesión: eliminatoria i con causa `examiner`, atropello que eleva la alta l a 8 puntos, choque) y el canvas frena el auto (`halted`).
- Lo que no se evalúa (dos manos, dispositivos, autoridad de tránsito, omisión de bocina) y por qué está en REGLAS.md §9 y en ARQUITECTURA.
- Aproximaciones nuevas (REGLAS.md §7 D6–D9 y §9): umbrales de cada regla, ambulancia (tramo 3, 90 m detrás, 50 km/h, 2,4 m a la izquierda, 6 s de paciencia), toma de control a más de 7 m/s² de frenado necesario, los primeros 100 m terminan unos 3 m después de la línea de Cabildo por la posición del cajón de F04-T01 (D9), el frente del auto decide la detención sobre senda, los actores no reaccionan a la ambulancia.
- Verificación local: `npm run check` aprobado con 422 pruebas (cobertura 96,03 % sentencias / 90,52 % ramas / 95,27 % funciones / 96,93 % líneas), contenido OK y build OK. Playwright: `exam.spec.ts` y `city.spec.ts` con `--workers=1`, 12 E2E aprobados (escritorio y Pixel 7 emulado), incluido el caso nuevo del HUD del circuito; suite completa `npx playwright test --workers=1`: 48 E2E aprobados sin reintentos. La vuelta limpia con guion tarda unos 33 s reales (359 s simulados).
- PR [#24](https://github.com/grunch/al-volante/pull/24) abierto con implementación `e2b683d`, apilado sobre #23. Codex solicitado con `@codex review`; CodeRabbit automático. Los resultados de cada revisión y de la CI se registran abajo, con sus correcciones. Sin excepción de cuota aplicada.
- Revisiones sobre `f4d7c6f` (etapa B, 2026-10-12). CI: «turning without the signal…» superó 30 s en el runner (34 s) y la prueba de bicicletas de #23 sus 5 s; las simulaciones largas de `street.test.ts` pasan a 90–120 s. El E2E «drives from a route entry…» se cortó a los 60 s propios con el navegador cerrado; ahora tiene 120 s. Codex, 3 findings, todos corregidos: (1) ceder a la ambulancia quedaba fijado por cualquier instante lento desde que aparecía; ahora se exige mientras está a menos de 30 m detrás y hasta que pasa; (2) `legsEntered` contaba cualquier cambio de tramo; solo cuenta el siguiente en orden (`createStreet` acepta un tramo inicial); (3) la toma de control se perdía si una falta del mismo paso ya interrumpía; `settleCirculation` consigna todas, aplica la toma y atribuye la interrupción al examinador. CodeRabbit, 8 findings y 1 fuera del diff, todos corregidos: fuentes con archivo en la tabla de ARQUITECTURA y columna «Fuente» en REGLAS §9; nota vigente de las líneas de detención en CIUDAD; fila de la ambulancia alineada con el código (6 s de paciencia, 4 s detenida, carril derecho); la alta e se registra como escalable al salir del cajón; la introducción ya no promete todas las fallas; el freno del examinador se lee antes de cada paso (`halted` como función); el HUD muestra la luz solo con un semáforo adelante («sin semáforo cerca» si no). Cada corrección de código tiene prueba que falla sin ella. Al rebasar sobre las correcciones de #23, la vuelta limpia marcaba «bloquea la encrucijada» esperando a un peatón en la senda de salida de la esquina 7→8: la excepción de ceder a la senda ahora mide también la distancia en línea recta al doblar (`yieldingLinkM`, la misma que traía F04-T04).
- Revisión de Codex sobre `cf9d690` (2026-10-12), 2 findings, corregidos: (1) P1, en los primeros 100 m el máximo salía de la calle actual y en los últimos metros, ya sobre Cabildo, admitía 46 km/h sin la eliminatoria g; ahora es siempre 30 km/h, como dice la consigna (protocolo PDF 11, 31; REGLAS §5.4 y D9), con prueba nueva que falla sin el cambio («keeps the 30 km/h instruction…»); (2) P2, este registro todavía decía que la CI y las revisiones estaban pendientes después de registrarlas. Con #22 y #23 ya fusionados, #24 pasó a apuntar a `main` y tenía conflictos: se incorporó `main` (`a3c5e15`) con un merge, sin reescribir commits ya citados en las respuestas. Los conflictos fueron solo de documentación: CIUDAD conserva las citas del manual de #23 y la nota de T03, y ESTADO, el estado real de la pila. El código de #23 (anti-bloqueo mutuo, PARE sin prioridad, detenciones al cierre de la vuelta, campo de semilla) se fusionó sin conflictos de texto. Con ese tránsito, la vuelta limpia de T03 marcaba la alta l en la esquina de Cuba y Quesada: el auto esperaba a mitad del giro a un peatón de la senda de salida, y una bicicleta de la ciclovía, todavía antes de su línea, no lo veía cruzando porque estaba a solo ~32° de la aproximación (el umbral eran 45°); al arrancar le cortaba el paso. Ahora el auto cuenta como quien cruza en cuanto gira más de 22,5° sobre el pavimento, y la bicicleta lo espera en su línea. Prueba nueva en `traffic.test.ts` que falla sin el cambio; la vuelta limpia vuelve a pasar sin fallas.

### F04-T04 — Estacionamiento y descenso

- Apilado sobre `f04-t03-examiner` (#24) hasta que #22, #23 y #24 se fusionaron en `main`; desde entonces [#25](https://github.com/grunch/al-volante/pull/25) apunta a `main` e incorporó esa fusión.
- Alcance: `src/exam/parking.ts` (juez puro de la etapa III: balizas, doble fila, maniobras, intentos, mirada en la marcha atrás, marcas del cajón, distancia viva al cordón, posición final por `parkingBands`, inclinación y centrado, descenso), `src/exam/circuit.ts` (`ParkingBay` derivado de la ciudad: centro, cordón, marcas de 1,2 m desde el cordón, distancia de vuelta de la línea delantera), `session.ts` (fases `parking` → `leaving` → `finished`, `Session.parking`, `Session.bands`, eventos del auto en la etapa III, cinturón, miradas, puerta), `circulation.ts`/`street.ts` (aviso de 100 m `parkingAheadM`; excepción de ceder a una senda por distancia recta al doblar), habitáculo (`door` como toggle, tecla `G`, botón «Abrir la puerta y bajar»), `traffic.ts` (8 m detrás de un auto lento junto al cajón, espera si retrocede, ningún peatón delante del auto que arranca a menos de 6 m), `#/examen` (botón «Terminé de estacionar», HUD de estacionamiento, distancia al cordón, lista «Para bajar», resultado aprobado/desaprobado) y la copia en `es-AR.ts`. Detalle en ARQUITECTURA «Estacionamiento y descenso (F04-T04)».
- Aceptación:
  - **Evaluación de ambas transmisiones:** `src/exam/parkingStreet.test.ts` «a clean exam parks in three manoeuvres within the first band, gets out properly and is approved» corre para `automatic` y `manual` sobre la ciudad con el tránsito de la semilla 1: vuelta completa, estacionamiento en 3 maniobras y 1 intento, ejes entre 15 y 25 cm, centrado, descenso completo, 0 puntos, `completedStages` I/II/III y `resultOf` aprobado. El descenso con omisiones se prueba en manual (w, x, v) y en automática (y, j); el juez puro prueba N y P (`parking.test.ts`).
  - **Casos frontera documentados y comprobados:** listados en ARQUITECTURA (15, 25 y 50 cm exactos; 14,9/25,1/50,1; 30 cm exactos entre ejes y 30,5; 0,5 m de descentrado y 0,51; balizas 3 s exactos, 2,9 s, nunca y con corte; 3 maniobras y la cuarta; 2 intentos y el tercero; marca a 0,99 y 1 m/s; puerta con motor en marcha o llave puesta; espejo derecho o cabeza en vez del izquierdo) y en `parking.test.ts`.
  - Tabla regla → criterio → fuente PDF → episodio → prueba en ARQUITECTURA; decisiones D10–D14 y V3 en REGLAS.md §7, criterios en §9.
- Aproximaciones declaradas: zona del cajón y doble fila (D11), cuenta de maniobras e intentos (D12), marcas pintadas como vallas de 1,2 m y mismos umbrales de 1 m/s que la etapa I (D13), fin de la maniobra por aviso, bloqueo de dirección = llave afuera con motor apagado, cinturón permitido después de la posición final, lugar de 8 m detrás del auto y peatones que esperan (D14), descentrado a 0,5 m (V3), excepción de ceder por distancia recta al doblar (`yieldingLinkM`). El cajón sigue sin vallas físicas y sin relevamiento (CIUDAD.md).
- Verificación local: `npm run check` aprobado con 454 pruebas (cobertura 96,02 % sentencias / 90,56 % ramas / 94,78 % funciones / 96,89 % líneas), contenido OK y build OK. Playwright: suite completa `npx playwright test --workers=1`, 50 E2E aprobados sin reintentos (escritorio y Pixel 7 emulado, 4,2 min), incluido el caso nuevo del HUD de la etapa III y del mando de la puerta. El examen completo con guion tarda unos 35 s reales por transmisión (unos 395 s simulados).
- PR [#25](https://github.com/grunch/al-volante/pull/25) abierto con implementación `0e8c677` (reescrita al rebasar sobre #24), apilado sobre #24. Sin excepción de cuota aplicada.
- Revisiones sobre `f2624a4` (etapa B, 2026-10-12). CI: solo fallaron las pruebas heredadas de #23/#24 (bicicletas a 5 s, giro sin direccional a 30 s), corregidas en esas ramas; las simulaciones de `parkingStreet.test.ts` pasan a 120 s y el examen completo a 300 s (107 s medidos en el runner). Codex, 2 findings, corregidos: (1) en la etapa III los eventos del auto (calar, arrancar con el motor en marcha o con un cambio, moverse con freno de mano) puntuaban faltas que la ficha ubica en las etapas I o II; ahora solo puntúan las reglas cuya ficha incluye la III (roce y subida al cordón, marcas), y los contactos con actores siguen valiendo siempre como intervención del examinador; (2) agregar la puerta descartaba las teclas guardadas; ahora la acción nueva toma su tecla por defecto si está libre. CodeRabbit, 2 findings, corregidos: «protocolo PDF n» en la tabla de ARQUITECTURA (y columna «Fuente» en la tabla de la etapa III de REGLAS) y la definición de doble fila del texto de aproximaciones alineada con `PARKING` (zona de −8 a +12 m y hasta 5 m a la izquierda; doble fila a 1,2 m o más). Al rebasar, la excepción de ceder a la senda al doblar (`yieldingLinkM`) y la espera de la prueba «standing on the avenue…» pasaron a #24, donde pertenece la regla. Con la cesión sostenida a la ambulancia de #24, el conductor de prueba cede hasta que la ambulancia pasa la carrocería entera (antes dejaba de ceder al tenerla al lado y la vuelta manual fallaba). Pruebas nuevas que fallan sin cada cambio.
- Revisión de Codex sobre `b551baa` (2026-10-12), 4 findings, corregidos: (1) P1, el intento empezaba con cualquier detención en la zona, también dentro del cajón entrando de frente, y el aviso de terminado se aceptaba sin marcha atrás: ahora solo la detención en doble fila empieza la maniobra (D11) y «Terminé» se ignora hasta la marcha atrás de un intento empezado (D14); (2) P1, la antigüedad de las balizas empezaba con la fase de estacionamiento aunque el aviso llega en el tramo 8: `noteHazards` la lleva desde la circulación; (3) P1, una sola mirada en cualquier momento cubría la alta p: ahora se piden la detención en doble fila (antes de retroceder) y la marcha atrás, por separado, y una mirada posterior no cuenta (protocolo PDF 13; D14); el conductor de prueba mira también durante la marcha atrás; (4) P2, ARQUITECTURA decía que calado, arranque con el motor en marcha y freno de mano se juzgan en la etapa III, pero `scoredInPhase` los deja fuera. Pruebas nuevas: en `parking.test.ts`, la detención dentro del cajón, las balizas desde el último tramo y los dos momentos de espejos (las de doble fila y espejos fallan sin su cambio); en `parkingStreet.test.ts`, «Terminé» antes de la marcha atrás y la antigüedad de las balizas al empezar la etapa III. Con #22–#24 ya fusionados, #25 apunta a `main` e incorporó esa fusión con un merge (`a7ca9a0`); los conflictos fueron solo de documentación.
- Para F04-T05: la sesión termina en `finished` con `completedStages` I/II/III y `resultOf` aprobado/desaprobado; `Session.parking.final` (frontCm, rearCm, alongM), `parking.manoeuvres/attempts`, `measurements` de la etapa I y `street` dan la ficha por etapa; `ledger.faults` lleva `atS`, así cada falla se puede asignar a su etapa por el instante de cada cambio de fase. Un modo que salte etapas debe crear la sesión en la fase deseada (`enter`) con `completedStages` vacío: `resultOf` quedará `pending`. No se persisten intentos todavía (contrato `Attempt`, `kind: 'driving'`).

### F04-T04-FIX01 — Vuelta guionada trabada en Cuba y Quesada

- Hallazgo (2026-10-12, al empezar la fase 5): las CI de `main` después de fusionar #25 (`cefe7b2`) y #26 (`b36fe55`) quedaron canceladas por las fusiones seguidas, y `main` tenía rojas siete pruebas de la vuelta completa: la vuelta legal de `street.test.ts` y los casos de examen completo de `parkingStreet.test.ts`. La falla aparece en `a7ca9a0`, cuando se integró `main` (#22–#24) en la rama de F04-T04: los cambios de tiempos del conductor de prueba de T04 llevaron a la semilla 1 a una situación que las pruebas de #24 no recorrían.
- Causas:
  - **Espera mutua con el auto:** el auto quedaba detenido con el frente en la línea de Cuba ante Quesada esperando a una bicicleta de la ciclovía que ya doblaba dentro del cruce; la bicicleta tomaba al auto como obstáculo en su corredor y lo esperaba a él. Entre actores esa espera ya estaba resuelta (`waitsAtLineFor`); faltaba para el auto. `carWaitsAtLineFor` (`src/traffic/traffic.ts`): el auto quieto con el frente en su línea (tolerancia de la línea) de un cruce que el actor ya atraviesa no es su obstáculo, porque lo espera; salvo que su carrocería esté sobre la trayectoria real del actor en los próximos metros (curvas incluidas), en cuyo caso el actor no avanza hacia él.
  - **Conductor de prueba que no cede a ciclistas:** con caja manual, el auto doblaba a la izquierda hacia Quesada y alcanzaba a una bicicleta que seguía derecho por la ciclovía de su izquierda (contacto, eliminatoria por la falla l escalada: no ceder el paso a ciclistas que cruzan al girar, `protocolo.pdf`, PDF 12, 16, 17 y 29; prioridad del ciclista, `manual.pdf`, PDF 35). El conductor de `src/test/circuitDriver.ts` ahora espera en la línea, antes de doblar, a los ciclistas que vienen por el lado del giro y a los que van a cruzar el pavimento que va a atravesar. Las distancias que usa para reconocerlos (hasta 25 m detrás, a menos de 8 m hacia el lado del giro, proyección de hasta 3 s) son **heurísticas del guion de pruebas**, no umbrales del protocolo ni de la evaluación, que no cambian.
- Pruebas: nueva `traffic.test.ts` «rides on across the corner past the car standing at its own line…», que falla sin el cambio (la bicicleta no avanza) y pasa con él; `street.test.ts`, `parkingStreet.test.ts`, `practice.test.ts` y `src/traffic` aprobadas (73 pruebas en 8 archivos).

- Revisiones (etapa de correcciones del PR):
  - Codex sobre `3327a92`: el lado del giro no tenía distancia lateral máxima → corregido en `ba64169` (`CYCLIST_LATERAL_M`, 8 m).
  - CodeRabbit sobre `e048648`, 3 findings: heurísticas sin fuente en este registro → corregido en `ba64169`; cesión tras el PARE → retirado por CodeRabbit (la condición es la misma de `main` y el PARE ya exige vía libre antes de salir); limitar `carWaitsAtLineFor` con `corridorGap` → no se aplicó tal cual porque recrea la espera mutua (la prueba nueva falla con ese cambio); se atendió la preocupación de fondo con `carOnPathAhead` en `ba64169`, y CodeRabbit lo aceptó.
  - Codex sobre `bbea36a`: la fase 4 seguía como pendiente en este registro → corregido en `bbea36a`; sobre `7c010ff`: faltaba la contraparte en `CONTINUIDAD.md` → corregido en `7c010ff`; registrar estas rondas y el total de 73 pruebas → corregido en el commit siguiente.

### F04-T05 — Modos, recorrido entero y ficha por etapa

- Apilado sobre `f04-t04-parking` (#25). Orden obligatorio: #22 → #23 → #24 → #25 → [#26](https://github.com/grunch/al-volante/pull/26).
- Alcance: `src/exam/modes.ts` (modos `learn`/`practice`/`run`/`exam` del contrato `Attempt`, slugs de la URL, política de ayudas `aidsOf`, posición y arranque de cada práctica), `session.ts` (`scope`, `transitions`, `createPracticeSession` por etapa, `completeStage` solo dentro del alcance, `Fault.stage` asignada al consignar), `scoring.ts` (`Fault.stage`), `src/exam/card.ts` (`buildCard`: ficha por etapa con fallas, subtotales, total y veredicto), `src/progress/model.ts` (`createDrivingAttempt`), `ProgressProvider` (`recordAttempt`), `logbook.ts` (`drivingLog`) y `DrivingSection.tsx`, `#/examen` (selector de modo y de etapa en la consulta del hash, tablero por ayudas, panel guiado del modo aprender, ficha al terminar, guardado del intento), inicio con la sección «Al volante» y la copia en `es-AR.ts`. Detalle en ARQUITECTURA «Modos, recorrido completo y ficha (F04-T05)».
- Aceptación:
  - **Tres etapas consecutivas:** `parkingStreet.test.ts` «the card of the clean exam shows the three stages completed and approved, and its run/exam attempt stores that» (sobre el examen limpio ya guionado: etapas I, II y III completas y encadenadas por las transiciones, ficha aprobada con 0 puntos, intento `driving` válido para el esquema y para `attemptErrors`).
  - **Aprobado solo al completar con hasta 7 puntos:** `card.test.ts` (aprobado con 0 y con 7; desaprobado con 8 sin interrupción, por eliminatoria sin interrupción, por interrupción del examinador y por eliminatoria que interrumpe; pendiente con una sola etapa; fallas repartidas entre etapas en el instante exacto del cambio de fase) y `practice.test.ts` (etapa I sola y etapa III sola desde el tramo 8 con estacionamiento limpio: `pending` con esa etapa completa y la II sin marcar).
  - **Sin ayudas impropias en rendir:** D15 en REGLAS.md §7; `modes.test.ts` (ninguna ayuda en `exam`, todas en `learn`, las del tablero en `practice`/`run`); `exam.test.tsx` «hides every aid in the exam mode…» (sin puntos, aviso, límites, semáforo, contadores, cordón ni lista de fallas; quedan la consigna, la próxima indicación y el tramo); E2E «offers the four modes and hides every aid in the exam mode…».
  - Página: selector de modos por URL, modo aprender con panel de ayudas, práctica de la etapa III desde el tramo 8 con el motor en marcha, ficha por etapa al terminar, intento guardado en el almacén (y no guardado en aprender), bitácora con los manejos, inicio con los cuatro modos (`exam.test.tsx`, 13 casos).
- Hallazgo corregido de paso: con el 3D en marcha no se podía salir de `#/examen` ni de `#/recorrido` por el menú (ni cambiar de modo por la URL): las lecturas del tablero, urgentes y cada cuadro, interrumpían la transición de React Router sin fin. `DrivingCanvas` las emite ahora con `startTransition`; E2E de regresión en `exam.spec.ts`. Es un defecto preexistente de F03-T03/F04-T01 que esta tarea necesitaba resuelto para el selector de modos; se registra acá y no en un correctivo aparte porque la fase sigue en etapa A.
- Decisiones: D15 (ayudas por modo) y las aproximaciones de los modos en REGLAS.md §9; el modo por defecto es `recorrer`; la práctica de la etapa II empieza en el cajón con el motor apagado, la de la III 18 m dentro de Vuelta de Obligado con el motor en marcha; cada falla lleva su etapa en vez de deducirla por el tiempo (las fallas de la preparación comparten `timeS` con el paso a `unlock`); `subjectId` = `route.comuna13-a`; aprender no se guarda; salir de la página a mitad del examen no guarda nada.
- Verificación local: `npm run check` aprobado con 486 pruebas (cobertura 95,85 % sentencias / 90,30 % ramas / 94,54 % funciones / 96,77 % líneas), contenido OK y build OK. Playwright: suite completa `npx playwright test --workers=1`, 56 E2E aprobados sin reintentos (escritorio y Pixel 7 emulado, 5,2 min), incluidos los tres casos nuevos (modos y tablero sin ayudas, práctica de la etapa III y modo aprender, salir de la página durante la conducción).
- PR [#26](https://github.com/grunch/al-volante/pull/26) abierto con implementación `6ba3b0d` (reescrita al rebasar sobre #25), apilado sobre #25. Sin excepción de cuota aplicada.
- Revisiones sobre `f7b9398` (etapa B, 2026-10-12). CI: las fallas eran las heredadas de #23/#24, corregidas allí. Codex, 3 findings, corregidos: (1) una práctica que terminaba con 8 puntos, interrumpida o pedida por el aspirante salía «desaprobado» y se guardaba con `correct: false`; `buildCard` deja pendiente toda sesión que no abarca las tres etapas (D15); (2) en la práctica de la etapa III, el tramo 8 manejado en `circulation` caía en la etapa II, fuera de alcance; `stageOf` asigna las fases anteriores al alcance a su primera etapa, en la ficha y en las fallas; (3) el paso a `recognition` no quedaba en `transitions` ni en los eventos del intento; ahora entra con `enter`. Pruebas nuevas en `card.test.ts` que fallan sin cada cambio. Al rebasar se integraron la toma de control síncrona, el semáforo según el aviso y el cierre idempotente de #24 con los modos (las ayudas siguen ocultas en «rendir»). CodeRabbit no revisó por cuota; se vuelve a pedir.
- CI sobre `83562c4`: el E2E «offers the four modes…» agotó sus 30 s en el runner sin un error de la página. La traza muestra cada comprobación a ~1,3 s por el render por software y el pedido de interrupción empezando a los 26 s. El bloque de modos tiene ahora 120 s, como el E2E de manejo de la ciudad; local: 12 E2E de `exam.spec.ts` aprobados (escritorio y Pixel 7 emulado).
- Para la fase 5 y F06-T01: la sesión terminada queda en `sessionRef` de `ExamPage` y se persiste como `Attempt` `driving` con `events` (`phase`, `stage-completed`, `interruption`, `finished`) y `faults`; no se graban entradas ni estados por paso, así que la repetición (F06-T01) necesita su propia grabación. Los modos se eligen por URL; un reintento desde un estado intermedio debe crear la sesión con `enter` en la fase deseada y restaurar auto, cabina, tránsito (`TrafficState`) y `Session` completos.

### F04-T05-FIX01 — Guía de manejo del examen práctico

- Pedido del usuario (2026-10-12): «incluye intrucciones clara para el manejo en el examen practico». Es un correctivo de F04-T05 (modos y panel guiado), no inicia la fase 6. Base `main` (`9dd6d9e`), rama `f04-t05-fix01-driving-guide`.
- Problema: la página `#/examen` no explicaba cómo manejar. Las teclas solo aparecían en el modo aprender, como una línea por fase, y dos indicaciones eran incorrectas. El espejo izquierdo se indicaba con «U o J», pero J gira toda la cabeza (1,3 rad), fuera del rango del espejo (0,25–0,9 rad, D4/X6), y no cuenta: seguirla daba la falla de espejos en la salida del cajón y en el descenso. Además, «R» se leía como una tecla, cuando es la marcha a la que se llega con Q.
- Resultado:
  - «Qué hacer ahora», junto a la consigna del examinador: la acción concreta de la fase actual con sus teclas, según la caja elegida.
  - «Cómo manejar en el examen» (desplegable, antes de la vista): la referencia de teclas, en los cuatro modos, y el paso a paso de las etapas en juego, con el paso actual marcado (`aria-current="step"`). La referencia explica pedales, volante, caja, llave, luces, espejos frente a giro de cabeza, vista y puerta.
  - Los textos usan las teclas que el jugador configuró: `DrivingCanvas` informa sus asignaciones (`onBindingsChange`) y `keyNames` las nombra.
  - Cada paso dice lo que la sesión juzga: el selector «Iluminación» para no pasar por una luz intermedia en el reconocimiento, la dirección hacia la marcha pedida, el embrague o el freno solos en los 30 cm, la direccional y el espejo antes de moverse, las balizas 3 s antes de la doble fila y la mirada antes de retroceder y durante el retroceso.
- Decisión (D15 actualizada en REGLAS.md §7): el paso a paso es una ayuda nueva, `steps`. Se muestra en aprender, practicar y recorrer, y se oculta en rendir. La referencia de teclas se ve en los cuatro modos porque es del juego y no del examen. El panel del modo aprender conserva «Qué se evalúa ahora» y la última falla; su antiguo «Cómo hacerlo» pasa a ser el paso a paso.
- Hallazgo de jugabilidad, sin corregir en este PR y comunicado al usuario: los 30 cm en manual son muy difíciles con el teclado. Se midió con una sonda temporal sobre la simulación real y `stepControls`, que no queda versionada. Si se suelta Shift hasta el final, el auto retrocede unos 10 cm y se cala. Si se vuelve a pisar Shift después de que el auto empieza a moverse, la medición depende de la demora:

  | Demora | Retroceso | Avance |
  |---|---|---|
  | 0,1 s | 7 cm | 8 cm |
  | 0,15 s | — | 28 cm |
  | 0,2 s | 35 cm | 74 cm |
  | 0,3 s | se cala | se cala |

  El margen útil es de unos 0,05 s. En la automática, volver a frenar unos 0,65–0,8 s después de que el auto se mueve da 20–40 cm en los dos sentidos; a los 0,95 s, el avance llega a 44 cm. La guía indica «unos tres cuartos de segundo» y avisa que en manual la maniobra es fina. Resolverlo requiere un cambio de controles o una lectura de la distancia en vivo, que queda a decisión del usuario.
- Verificación local:
  - `npm run check`: lint, formato, tipos, 1375 de 1375 pruebas (cobertura 96,09 % de sentencias, 90,55 % de ramas, 95,24 % de funciones y 97,09 % de líneas), contenido OK y build OK.
  - `npx playwright test tests/e2e/exam.spec.ts --workers=1`: 12 de 12 E2E (escritorio y Pixel 7 emulado).
  - Navegador (Chromium de Playwright, 1280×900 y 412×915): la guía abierta, «Qué hacer ahora» y el modo rendir sin paso a paso; sin desborde horizontal ni errores de consola.
- PR [#36](https://github.com/grunch/al-volante/pull/36), implementación `d73a185`. CodeRabbit: automática al abrir el PR; no revisó por el límite de revisiones incluidas («Review limit reached») y se vuelve a pedir cuando se libere. Codex: completada sobre `d2e7386` (revisión 5496225183), con dos findings documentales, ambos corregidos: faltaba la entrada en CONTINUIDAD y este registro daba F05-T05 por abierta (la integración de `main` trae la fila y la fase activa al día, y se actualizaron #34 y los bloqueos).
- Integración de `main` (`f3d2f60`, con #34) por merge, sin reescribir historia. El único conflicto fue este registro. #34 cambió el volante con teclas: a más velocidad gira menos, y al soltar la tecla vuelve al centro más despacio que antes. La referencia de teclas dice que gira menos cuanto más rápido se va. Pedales, embrague y freno no cambiaron, así que las mediciones de los 30 cm siguen valiendo.

## Correctivo F04-T01-FIX02 — Experiencia de conducción

- Pedido: conducción más real tras fusionar #31; revisar otra vez las fotos, con Blender disponible si fuera necesario. Rama `f04-t01-fix02-driving-realism`, base `9bc0257`, worktree independiente. Alcance en [EXPERIENCIA_CONDUCCION.md](EXPERIENCIA_CONDUCCION.md); se resolvió con geometría y texturas originales generadas desde código, sin dependencias nuevas.
- Implementación: entrada de volante sensible a velocidad, cámara amortiguada y movimiento reducido, cabina e instrumental, pantalla completa, materiales de calle y vegetación, siluetas de tránsito. Sin cambiar reglas, tolerancias ni parámetros físicos del vehículo.
- Revisión independiente local: completada sobre el diff de implementación. Finding P3: las manijas sobresalían 1–2,5 cm de la caja de los vehículos; corregido desplazándolas hacia adentro. Pruebas de contorno de auto, colectivo, emergencia, peatón y bicicleta aprobadas. Seguimiento independiente del diff final completado sin findings pendientes. Codex GitHub: completada sin observaciones sobre `404ea74` (2026-10-12 20:02 UTC) en [#34](https://github.com/grunch/al-volante/pull/34). CodeRabbit: solicitada automáticamente, pendiente por límite horario de revisiones; el check «Review rate limited» no cuenta como revisión completada.
- Verificación local: `npm run check` aprobado (Node 24.21.0): 1.350 pruebas en 68 archivos; cobertura de líneas 96,51 %, ramas 90,30 %; lint, formato, tipos, contenido y build aprobados. La suite general se inició antes de la última optimización de agrupación de actores; las 24 regresiones afectadas y de pantalla completa se ejecutaron después y pasaron. 32 E2E de ciudad, cabina, examen y pista aprobados en Chromium con GPU (escritorio y móvil). Capturas y condiciones de rendimiento en [EXPERIENCIA_CONDUCCION.md](EXPERIENCIA_CONDUCCION.md#comparación-visual). CI de `edce114`: lint, tipos, unitarias, catálogo y build aprobados; E2E cancelado.
- Actualización de base (2026-10-12): se incorpora `main` (`9dd6d9e`, #33) mediante merge, sin reescribir historia. Conflictos solo en este registro, resueltos conservando F05-T05 y F04-T01-FIX02; los textos del teórico y la conducción se integran sin conflictos. Validación de integración aprobada: lint, formato, tipos, build, catálogo y 51 pruebas focalizadas de aplicación, teórico, controles y cabina. Se comprobó que cada archivo conserva los cambios de su rama de origen y que el archivo compartido de textos contiene ambas incorporaciones. CI completa pendiente sobre el merge.

## Correctivo F04-T01-FIX04 — E2E con margen para WebGL por software

- Pedido del usuario (2026-10-12): «revisa los comentarios en los PRs, resuelve conflictos si los hay, y si falla ci checks arregla». Rama `f04-t01-fix04-e2e-budgets`, desde `main` (`f3d2f60`).
- Problema: la CI de `main` después de fusionar #34 (`f3d2f60`) y la de #35 cancelaron el E2E. Fallaron tres pruebas:
  - `city.spec.ts`, «drives from a route entry…»: no llegaba a 3 m en 20 s;
  - `cockpit.spec.ts`, «prepares the cabin…»: superó los 30 s por defecto;
  - `exam.spec.ts`, «offers the four modes…»: superó los 120 s.

  Con los reintentos, el job pasó sus 20 min y se canceló. No es un error de código: el árbol de `f3d2f60` es idéntico al de `12434c0`, cuya corrida del PR #34 pasó las 66 pruebas sin reintentos en 13,4 min, en paralelo con la que falló. Son presupuestos de reloj justos para el render por software, y fallan con un runner más lento.
- Medición local (Chromium de Playwright, WebGL por software):
  - unos 600–700 ms por cuadro, igual antes (`9dd6d9e`) y después de #34, así que #34 no encareció el render;
  - recorrer los 3 m lleva 2,2 s simulados y 14,8 s de reloj, de los 20 s;
  - «offers the four modes…» tarda unos 72 s, de los 120 s.
- Arreglo: los mismos asertos con más tiempo de reloj. 60 s para los 3 m, 90 s por prueba del habitáculo (y 30 s para que la vista esté lista, como en las demás specs), 240 s para el bloque del examen y 30 min para el job E2E.
- Siguiente: integrar este correctivo en #35 y #36, cuyas CI dependen de él.

## Correctivo F04-T01-FIX01 — Entorno basado en referencias

- Pedido: incorporar las imágenes cronológicas del recorrido y trabajar en un worktree para preservar la fase 5 de Opus. Base `main` (`b36fe55`), rama `f04-t01-fix01-street-reference`; [#31](https://github.com/grunch/al-volante/pull/31), implementación `5f8f226`. Correcciones de revisión en `42fc914`, que incorpora `main` (`78b5cee`, #27–#28). Segunda actualización con `8a6b51a` (#29–#30) al volver a avanzar la base; todos los conflictos eran documentales. Tercera actualización con `693f692` (#32) al avanzar nuevamente la base.
- Entrega: fachadas diferenciadas por tramo, balcones y plantas bajas, casas y esquinas bajas, arboleda, refugios/barandas del Metrobús, placas de calles, vallas del cajón, materiales y luz de día. Las 35 referencias están inventariadas en [REFERENCIAS_VISUALES.md](REFERENCIAS_VISUALES.md). No se redistribuyen las capturas originales ni se cambian física, reglas o catálogo.
- Pruebas antes de incorporar `78b5cee`: lint, formato, tipos, validador de contenido y build aprobados. Suite general con Node 24.21.0 y dos workers: **500 aprobadas y 17 fallidas**, en `street.test.ts` y `parkingStreet.test.ts`; fallan la vuelta completa (`condition not met in 600 s`) y sus preparaciones de estacionamiento, incluida una falta de prioridad. No declarar `npm run check` aprobado. La prueba de vuelta completa reproduce el mismo error sobre `main` (`b36fe55`), sin cambios gráficos, con Node 24.21.0: 1 fallida y 16 omitidas por el filtro (142,8 s).
- Revisión Codex independiente local con GPT-6.1 Sol, esfuerzo high: completada sobre el diff de trabajo; 8 pruebas focalizadas aprobadas, sin findings iniciales. La suite final de ciudad pasa sus 21 pruebas. Se amplió después la comprobación visual del pavimento de Quesada y se ajustó el plano de fondo para no ocultarlo. El seguimiento independiente de fondo, sombras y tejados dio conformidad. Codex GitHub: completada sobre `5f8f226`, revisión [5494732545](https://github.com/grunch/al-volante/pull/31#pullrequestreview-5494732545); la respuesta inicial de configuración quedó superada por esa revisión. CodeRabbit: solicitada automáticamente, pendiente por límite de revisiones incluidas (respuesta del 2026-10-12 18:35 UTC, próxima revisión en 34 minutos). No se presenta el límite de CodeRabbit como una revisión completada.
- Findings de Codex 5494732545, ambos aplican: timeout global de 120 s para todos los casos de ciudad/examen (180 s en la conducción por teclado), y despeje de la luminaria en su posición final tras desplazarla 4 m. La regresión nueva detectó seis piezas sobre Iberá/Cuba antes del cambio; después pasan las 9 pruebas de entorno/escena. Se conservan árboles válidos y se omiten únicamente luminarias sin despeje. Seguimiento y E2E de la corrección pendientes.
- Integración de `main`: conflictos únicamente en estado/continuidad, resueltos conservando #27 y F05-T01; sin cambios en el worktree de Opus. Lint, formato, tipos/build y catálogo `93afd404` aprobados tras incorporar la base; cobertura completa en curso.
- Navegador: capturas de los ocho tramos y habitáculo, sin errores de consola en el recorrido de capturas. Ronda final sobre `5f8f226`: **20/20 E2E aprobadas**, escritorio y Pixel 7, sin reintentos (11,8 min). Se redujo geometría oculta y costo de sombras; las esperas contemplan la compilación de shaders en software. Tras incorporar `main` se revalidan los checks afectados. No se acredita 60 FPS.

## Tareas de la fase 5

| Tarea | Rama | Base | PR | Estado |
|---|---|---|---|---|
| F05-T01 | `f05-t01-content` | `f04-t04-fix01` (#27) | [#28](https://github.com/grunch/al-volante/pull/28) | fusionada en `main` (`78b5cee`); Codex sin observaciones; CodeRabbit no llegó a revisar por la cuota |
| F05-T02 | `f05-t02-signs` | `f05-t01-content` (#28) | [#29](https://github.com/grunch/al-volante/pull/29) | fusionada en `main` (`77a46dc`); findings de Codex (1) y CodeRabbit (3) corregidos |
| F05-T03 | `f05-t03-garage` | `f05-t02-signs` (#29) | [#30](https://github.com/grunch/al-volante/pull/30) | fusionada en `main` (`8a6b51a`); finding de Codex corregido; CodeRabbit no llegó a revisar por la cuota |
| F05-T04 | `f05-t04-complement` | `f05-t03-garage` (#30) | [#32](https://github.com/grunch/al-volante/pull/32) | fusionada en `main` (`693f692`); findings de Codex (3) corregidos en `0b8cdcc`; CodeRabbit no llegó a revisar por la cuota |
| F05-T05 | `f05-t05-theory` | `main` (`9bc0257`) | [#33](https://github.com/grunch/al-volante/pull/33) | fusionada en `main` (`9dd6d9e`); findings de Codex y CodeRabbit corregidos |

### F05-T01 — Glosario, introducción, capítulos 1–2 y guía de siniestros

- Primera tarea de la fase, apilada sobre F04-T04-FIX01 (#27), que repara la vuelta guionada rota en `main`; sin ese correctivo la CI de esta tarea no puede quedar en verde.
- Alcance:
  - **Infraestructura de contenido para toda la fase:** actividades en un archivo por sección (`specs/catalog/activities/<fuente>-<sección>.json`, cargados con `import.meta.glob`), catálogo de figuras (`specs/catalog/figures.json`, recortes en `public/figures/` con `scripts/crop-figures.ts`), `consultationReason` en las unidades, validadores `activityFileErrors`, `validateFigures` y `validateTreatment`, prueba de recorrido de todo el catálogo (`catalogPlaythrough.test.ts`), prueba de política de contenido (`catalogPolicy.test.ts`, que reemplaza la prueba de temas excluidos de la fase 2) y prueba de cobertura de las secciones terminadas.
  - **Interfaz:** «La ciudad te pregunta» por secciones del recorrido de aprendizaje (`?seccion=`); la página de cada sección muestra sus actividades, las que practican cada unidad, el motivo de las unidades de consulta y las figuras; la devolución muestra las figuras después de responder; la presentación y el material a estudiar entran al grupo de consulta del mapa.
  - **Contenido:** las 260 unidades de presentación, glosario, introducción, capítulos 1–2 y guía de siniestros revisadas contra la imagen de su página (22 correcciones), 105 actividades nuevas (77 de opción única, 22 escenas de decisión y 6 de ordenar; 351 variantes) y 23 figuras. 254 unidades quedan `tested` y 6 de consulta (`implemented`). Las 14 unidades y 4 señales que usaban las 8 actividades de la fase 2 se revisaron contra sus páginas y quedan `tested`.
  - **Decisiones:** D-T01-1 a D-T01-18 en `CONTENIDO.md` (verificaciones del 12/10/2026: 107 SAME y 911 Policía en el sitio oficial; scoring de 20 puntos; régimen cambiante de la VTV). 8 observaciones nuevas en `issues.json` (214 en total).
- Método: cinco lotes por páginas escritos por subagentes con una guía común, sin tocar el repositorio; el autor los integró, reequilibró 28 variantes cuya opción correcta se delataba por su largo, reescribió los motivos de consulta para quien juega y revisó por muestreo los datos contra el texto y la imagen de las páginas (PDF 26, 29, 33, 38, 45–47, 53 y las de los recortes).

### F05-T02 — Capítulo 3 y anexo IV, con el catálogo visual de señales

- Apilada sobre `f05-t01-content` (#28). Orden: #27 → #28 → este PR.
- Alcance:
  - **Señales:** `box` y `consultationReason` en `signs.json`; `scripts/crop-figures.ts` recorta también las señales (`public/signs/`, 180 ppp, sin metadatos para que los recortes sean reproducibles); `SignGraphic` muestra el recorte cuando no hay dibujo vectorial; validadores de recortes de señales y de tratamiento de señales de consulta; página `#/senales` (catálogo visual por familia y grupo) enlazada desde la biblioteca y las páginas con señales.
  - **Contenido:** las 153 unidades del capítulo 3 y del anexo IV revisadas contra la imagen (21 correcciones), 354 señales recortadas y revisadas, 128 actividades nuevas (59 de identificación de señales, 35 de opción única, 25 escenas y 9 de ordenar; 573 variantes) y 28 figuras. 151 unidades `tested` y 2 de consulta (excepciones de velocidad por avenida, chat de estacionamiento); 350 señales `tested` y 4 de consulta (tres luces intermitentes y «Barreras ferroviarias»).
  - **Decisiones:** D-T02-1 a D-T02-18 en `CONTENIDO.md`; 12 observaciones nuevas en `issues.json` (226). Tres variantes de la fase 2 reequilibradas (la correcta se delataba por el largo), la variante de luz amarilla rehecha según D-T02-18 y la descripción de una figura de PDF 61 corregida en `pages.json`.
  - **Pruebas:** la de recorrido del catálogo comprueba la estructura de lo que se muestra (sin claves que revelen la respuesta) en lugar de buscar texto; la de política de contenido distingue el cordón amarillo permitido (prohíbe estacionar) del no resuelto (detenerse, 24 horas); prueba de cobertura de señales.
- Método: seis lotes por páginas (tres del capítulo 3 y tres del anexo IV) con guía común y detector de señales por segmentación de imagen; revisión del autor con heurísticas sobre todas las variantes y hojas de contacto rotuladas de recortes.

### F05-T03 — Capítulos 4–5, anexo I e inspección del auto («Mi garaje»)

- PR [#30](https://github.com/grunch/al-volante/pull/30), apilado sobre `f05-t02-signs` (#29). Orden: #27 → #28 → #29 → #30.
- Alcance:
  - **Contenido:** las 107 unidades de los capítulos 4 (capacidad natural) y 5 (actitud) y del anexo I (automóviles particulares) revisadas contra la imagen (17 correcciones), 59 actividades nuevas (30 de opción única, 25 escenas, 3 de ordenar y 1 de identificación; 192 variantes) y 17 figuras. 106 unidades `tested` y 1 de consulta: el límite general de alcohol de 0,5 g/l (D-T03-1). La señal de PDF 91 (ícono de principiante de la tabla de alcohol) recortada y practicada: las 355 señales tienen recorte y tratamiento.
  - **Inspección del auto:** escenas de revisión antes de salir (neumáticos, frenos, luces, espejos, cinturones, sillitas, elementos de seguridad, equipaje y mascotas) en el anexo I.
  - **«Mi garaje»** (`#/garaje`): la práctica de la etapa I del examen y la pista de prueba (asiento, apoyacabezas, espejos, cinturón) y las actividades de revisión del anexo I. El espacio del inicio deja de estar «Próximamente».
  - **Decisiones:** D-T03-1 a D-T03-13 en `CONTENIDO.md` (alcohol: solo se evalúa el 0,0 g/l de principiantes y profesionales, porque no se pudo confirmar si en la Ciudad rige la ley nacional de alcohol cero o la Ley 2148; búsqueda del 12/10/2026). 3 observaciones nuevas (229). La prueba de política de contenido controla que ninguna respuesta correcta use los límites de 0,5 o 0,2 g/l.
- Método: tres lotes por páginas con la guía común y la de la tarea; revisión del autor con heurísticas sobre todas las variantes.

### F05-T04 — Anexos II–III, protocolo y recorridos

- PR [#32](https://github.com/grunch/al-volante/pull/32), apilado sobre `f05-t03-garage` (#30). Orden: #27 → #28 → #29 → #30 → #32.
- Alcance:
  - **Anexos II y III (material complementario):** las 185 unidades revisadas contra la imagen (17 correcciones), 82 actividades nuevas y 47 figuras. 177 unidades `tested` y 8 de consulta (tablas de autopistas, mapa de hospitales, tarifas y los avisos del Paseo del Bajo que solo lista el anexo III).
  - **Protocolo y recorridos:** pasan a estar clasificados página por página (42 y 19 páginas, categoría `exam`), con 48 unidades nuevas. 9 de ellas tienen actividad: las reglas generales del examen, cada una en su propia unidad y con los datos de `REGLAS.md`, y la presentación de los recorridos. Las otras 39 son de consulta: lo que se practica al volante (las etapas y las listas de fallas), los gráficos del anexo I y los 14 circuitos de 2026 y 7 de 2023, con una figura por lámina. 12 actividades nuevas y 13 figuras del protocolo.
  - **Mapa de aprendizaje:** nuevo grupo «Examen práctico: protocolo y recorridos». La página de cada fuente muestra su clasificación también en el protocolo y los recorridos.
  - **Validación:** las cuatro fuentes son auditadas: toda página clasificada una vez.
  - **Decisiones:** D-T04-1 a D-T04-17 en `CONTENIDO.md`, con la comparación de circuitos de 2023 y 2026. 14 observaciones nuevas (243).
- Método: seis lotes por páginas (O–R anexos, S protocolo, T recorridos) con la guía común y la de la tarea; revisión del autor (resúmenes de figuras de PDF 158 y 166 corregidos tras mirar las imágenes).

### F05-T05 — Simulacros teóricos y auditoría global

- PR [#33](https://github.com/grunch/al-volante/pull/33), fusionado en `main` (`9dd6d9e`, 2026-10-12); partió de `9bc0257`, con #27, F05-T01 a T04 y el correctivo #31 ya fusionados.
- Alcance:
  - **«Sala de examen»** (`#/teorico`): simulacro del teórico B con la configuración versionada de `catalog/theory-exam.json`: 40 preguntas de tres opciones, 34 para aprobar y 45 minutos (40 como variante más exigente), con fuente por parámetro (`REGLAS.md` §8).
    - La hoja se reparte por tema según las unidades de cada sección y es reproducible por semilla.
    - El temporizador la entrega solo al vencer.
    - El resultado da el diagnóstico por tema y por concepto, con enlaces para practicar lo fallado.
    - El espacio del inicio deja de estar «Próximamente».
  - **Bitácora:** sección de simulacros, con fecha, puntaje y resultado. Los simulacros se guardan como intentos y no entrenan conceptos.
  - **Auditoría global:** `auditCoverage` y su prueba de integración. Resultado: 753 de 753 unidades tratadas (697 practicadas, 56 de consulta), 355 de 355 señales tratadas y recortadas y ninguna página sin clasificar en las cuatro fuentes. Reemplaza las listas de secciones tratadas de las tareas anteriores.
- Verificación local, sobre `main` con #31 (`9bc0257`) y los arreglos de las revisiones (`54b0674`):
  - `npm run check`: lint, formato y tipos aprobados; 1360 de 1361 pruebas. La que falló es `track.test.tsx`, inestable con la CPU cargada; sola pasa (3 de 3).
  - Como `check` se corta en las pruebas, `validate:content` y el build se corrieron aparte: los dos OK, con la auditoría sin brechas.
  - La cobertura de esa corrida no se informó por el fallo. La corrida anterior, con 1352 de 1352 pruebas, dio 96,07 % de sentencias, 90,34 % de ramas, 95,11 % de funciones y 97,06 % de líneas.
  - Playwright: suite completa `npx playwright test --workers=1`, 66 E2E aprobados (14,1 min), incluido el de la sala de examen.
  - CI sobre `54b0674`: unitarias, catálogo, build y E2E aprobados.
- Cierre de la fase: cobertura total auditable y simulacros disponibles. El dominio personal (bitácora) se distingue de la disponibilidad del contenido (mapa y auditoría).

## Pila y orden de fusión

La pila de la etapa A (`main ← F02-T01 ← … ← F02-T05`) quedó toda en `main`: T01–T04 (#7–#10), F02-T01-FIX01 (#12), F02-T02-FIX01 con T05 (#13, que incluye #11) y F02-T02-FIX02 (#14). F02-T02-FIX03 (#15) también está fusionado en `main` (`d7db55c`). F03-T01–T05 (#16–#20) y el correctivo #21 están fusionados. F04-T01 (#22), F04-T02 ([#23](https://github.com/grunch/al-volante/pull/23)) y F04-T03 ([#24](https://github.com/grunch/al-volante/pull/24)) están fusionados en `main` (`3c7aca2`, `a3c5e15` y `d919f98`). F04-T04 ([#25](https://github.com/grunch/al-volante/pull/25)) y F04-T05 ([#26](https://github.com/grunch/al-volante/pull/26)) también (`cefe7b2` y `b36fe55`). El correctivo F04-T04-FIX01 ([#27](https://github.com/grunch/al-volante/pull/27)) y F05-T01 ([#28](https://github.com/grunch/al-volante/pull/28)) también están fusionados (`367b484`, `78b5cee`).

Fase 5: la pila `main ← F04-T04-FIX01 (#27) ← F05-T01 ← F05-T02 ← F05-T03 ← F05-T04` quedó toda en `main` (#27, #28, #29, #30 y #32, fusionados en ese orden el 2026-10-12). El correctivo visual #31 se fusionó después (`9bc0257`) y F05-T05 partió de ese `main`; #33 ya está fusionado en `9dd6d9e`.

## Bloqueos

El correctivo #31 ya fue fusionado por el usuario en `9bc0257` y F04-T01-FIX02 (#34) en `f3d2f60`. F04-T05-FIX01 (#36): no fusionar sin checks aprobados y findings resueltos; CodeRabbit está limitado por cuota. Los fallos de la base `b36fe55` pertenecen al registro histórico de #31.

## Siguiente acción

La fase 4, la fase 5 (F05-T05, #33 en `main`, `9dd6d9e`) y los correctivos #31 y F04-T01-FIX02 ([#34](https://github.com/grunch/al-volante/pull/34), `f3d2f60`) están fusionados. En curso: el correctivo F04-T05-FIX01 ([#36](https://github.com/grunch/al-volante/pull/36), guía de manejo del examen práctico), pedido por el usuario; resolver los findings de Codex y CodeRabbit. La fase 6 requiere orden explícita del usuario.

### Cierre de la fase 4 contra el plan

«Examen completo jugable en A, con reglas transcritas implementadas y comprobadas. Los criterios que el juego solo aproxima se explican al usuario.»

- **Examen completo jugable en A:** cumplido y fusionado (#22–#26). Las tres etapas se juegan seguidas en `#/examen` (recorrer y rendir), con tránsito y semáforos por semilla (T02), el examinador y las reglas de circulación (T03), el estacionamiento y el descenso (T04), los modos y la ficha (T05).
- **Reglas transcritas implementadas y comprobadas:** cada regla del alcance tiene criterio, fuente y prueba en las tablas de ARQUITECTURA (T03 y T04). No se evalúan, y se dice por qué en REGLAS.md §9: las dos manos en el volante (baja f), los dispositivos (eliminatoria m), la autoridad de tránsito (eliminatoria e), la omisión de bocina, el arranque excedido en tiempo (leve g) y el arranque brusco y la aceleración en vacío (bajas b, c).
- **Lo que el juego solo aproxima se explica al usuario:** los umbrales sin cifra del protocolo (D6–D14, V2, V3), las ayudas por modo (D15) y las aproximaciones de los modos están en REGLAS.md §7 y §9, en el texto «Aproximaciones del juego» de la página del examen y, al terminar, en la ficha como «aproximaciones que pudieron influir».
- **Queda aproximado y sin relevamiento** (CIUDAD.md): la posición exacta del cajón, los anchos, PARE, reductor y máximas de la vía (OSM, fuente única). El rendimiento gráfico medido en T01 no acredita 60 FPS por software. Las revisiones visuales en navegador se limitaron a los E2E en T03–T05.

## Decisiones que no deben reinterpretarse

- Repo destino, visibilidad pública y revisores fueron confirmados por el usuario el 2026-10-11; no volver a preguntar.
- Versiones de dependencias: exactas y con al menos dos semanas de publicadas al elegirlas; TypeScript 6.0.x porque `typescript-eslint` no admite TypeScript 7 (ver ARQUITECTURA.md).
- Ver también «Hallazgos que no deben perderse» en `CONTINUIDAD.md`.
