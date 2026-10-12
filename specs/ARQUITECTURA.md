# Arquitectura de la aplicación

Fecha: 2026-10-11 (F02-T01). Documento vivo: cada tarea que cambie estructura, dependencias o convenciones lo actualiza.

Concreta la arquitectura de `PROPUESTA.md` §8 para el código. Este documento describe lo que ya está implementado; lo que llega en tareas posteriores se marca como «planificado».

## Pila y versiones

Todas las dependencias están fijadas con versión exacta en `package.json` y `package-lock.json`. Criterio de elección (F02-T01): la versión más reciente de su línea con **al menos dos semanas publicada** y compatible con el resto.

Las fechas de publicación salen del registro de npm (`npm view <paquete> time`) y, para Node.js, de `https://nodejs.org/dist/index.json`. Se verificaron el 2026-10-11, así que el límite era el 2026-09-27.

| Paquete | Versión | Publicada | Uso |
|---|---|---|---|
| Node.js | 24.21.0 (`.nvmrc`; `engines` `^24.15.0 \|\| >=26.0.0`) | 2026-09-07 | Desarrollo, pruebas y CI. El mínimo sale de jsdom 30.1.1 y tres dependencias suyas (`^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`). |
| TypeScript | 6.0.3 | 2026-04-16 | Tipado estricto. **No se usa TypeScript 7**: `typescript-eslint` 8.70.1 declara `peerDependencies.typescript` `>=4.8.4 <6.1.0`. |
| Vite / `@vitejs/plugin-react` | 8.3.1 / 6.1.1 | 2026-09-24 / 2026-08-28 | Servidor de desarrollo y build. |
| React / React DOM | 19.3.0 | 2026-09-09 | Interfaz. |
| Three.js | 0.186.1 | 2026-09-24 | Mundo 3D. Se usa directamente, sin `@react-three/fiber`: la simulación de fases futuras necesita un bucle de paso fijo controlado fuera de React. |
| Vitest / `@vitest/coverage-v8` / jsdom | 5.0.2 / 5.0.2 / 30.1.1 | 2026-09-25 / 2026-09-25 / 2026-09-22 | Pruebas unitarias y de componentes, cobertura. |
| Testing Library (react, dom, user-event, jest-dom) | 16.3.3 / 10.4.2 / 14.6.7 / 6.10.0 | 2026-08-27 / 2026-09-13 / 2026-09-02 / 2026-07-20 | Pruebas de componentes centradas en el comportamiento. |
| Playwright | 1.63.0 | 2026-09-04 | Pruebas E2E en Chromium (escritorio y móvil). |
| ESLint / typescript-eslint / react-hooks | 10.11.0 / 8.70.1 / 7.1.1 | 2026-09-18 / 2026-09-21 / 2026-04-17 | Lint estricto. |
| Prettier | 3.9.9 | 2026-09-23 | Formato del código (no de los `.md` ni de los catálogos). |
| Zod | 4.6.5 | 2026-09-13 | Esquemas de los catálogos de contenido (desde F02-T02). |
| React Router | 8.4.0 | 2026-09-15 | Navegación con URLs con hash (desde F02-T03). |
| idb | 8.0.3 | 2025-05-07 | Envoltorio con promesas de IndexedDB para el progreso (desde F02-T05). La 8.0.4 es del 2026-10-06 y todavía no cumplía las dos semanas. |
| fake-indexeddb | 6.2.5 | 2025-11-07 | IndexedDB en memoria para las pruebas (solo desarrollo). |

## Estructura

```text
index.html                 Documento base (lang es-AR).
src/
  main.tsx                 Punto de entrada.
  app/                     App, tabla de rutas, layout, orden de estudio (learningPath) y pantallas (pages/).
  i18n/es-AR.ts            Textos de la interfaz en español rioplatense, con claves en inglés.
  activities/              Motor de actividades (puro y determinista), PRNG con semilla, componentes de pregunta y señales SVG.
  sim/                     Simulación de manejo: TypeScript puro, paso fijo, vehículo, colisiones y pistas (F03).
  content/                 Esquemas (Zod), validación referencial, versión, cobertura y carga de catálogos.
  practice/                Pista de prueba: vista de manejo (bucle, teclado, telemetría) y controles provisionales.
  progress/                Progreso por concepto (Leitner), bitácora, IndexedDB, respaldo versionado y sus pantallas.
  scene/                   Mundo 3D: escena pura de Three.js y su componente de montaje.
  ui/                      Estilos (tokens de diseño), compuerta de contenido, título de página y hooks compartidos.
  test/                    Configuración y dobles de prueba.
tests/e2e/                 Pruebas de punta a punta con Playwright.
scripts/validate-content.ts Valida los catálogos desde la terminal (Node ≥ 24 ejecuta TypeScript).
specs/                     Documentación, fuentes y catálogos de datos.
.github/workflows/ci.yml   Integración continua.
```

## Datos y validación (F02-T02)

Los catálogos viven en `specs/` (fuentes, páginas, unidades, señales, observaciones, reglas, recorrido y actividades) y son la única fuente de verdad del contenido. `src/content/` los valida en dos niveles:

1. **Estructura** (`schemas.ts`, Zod): un esquema estricto por contrato de PROPUESTA §8 (Source, KnowledgeUnit, Activity, Rule, recorrido/RoadSegment, Scenario y Attempt), más páginas, señales y observaciones. Los errores indican archivo y ruta JSON, por ejemplo `specs/catalog/units.json[0].id: …`.
2. **Referencias cruzadas**:
   - `validateCatalog`: páginas ↔ unidades en ambos sentidos, herencia de sección y categoría, ids únicos y páginas de observaciones;
   - `validateRules`: los 69 ítems exactos del anexo II, puntos por severidad, citas dentro del protocolo (incluidas las del puntaje) y partición de franjas de estacionamiento, sin dos límites del mismo lado en una franja;
   - `validateRoute`: secuencia oficial, continuidad, proyección, longitudes, giros, controles y citas de la fuente del recorrido;
   - `validateActivities`: conceptos y citas existentes, una sola opción correcta, señales conocidas y grafos de decisión sin ciclos ni nodos o desenlaces inalcanzables, con al menos un desenlace correcto alcanzable.
   - Toda cita (`refs.ts`) debe nombrar una fuente del manifiesto y una página dentro de su rango.
   - El catálogo de reglas declara la edición y el `sha256` del protocolo del que salió; ambos tienen que coincidir con el manifiesto.
   - `attemptErrors` (`validateAttempt.ts`) valida un intento contra las reglas: faltas de reglas conocidas con sus puntos (o los de su escalada eliminatoria), sin repetir reglas que cuentan una sola vez, total coherente y ninguna falta en intentos de actividades.

Además:

- `validate.ts` coordina ambos niveles y calcula la **versión de contenido**: un hash FNV-1a de todos los catálogos, que acompañará a cada intento para saber con qué contenido se respondió.
- `coverage.ts` resume por sección cuántas unidades tienen actividades.
- `catalog.ts` carga los catálogos en forma diferida y los valida antes de usarlos.
- La misma validación corre en la CI (`npm run validate:content`) y en la prueba de integración con los datos reales.

Los validadores `.mjs` de la fase 1 fueron reemplazados por estos módulos; sus casos de prueba se portaron a Vitest.

## Navegación y pantallas (F02-T03)

| Ruta | Pantalla |
|---|---|
| `#/` | Inicio, «Mi garaje»: escena 3D y los seis espacios de la propuesta (los que todavía no existen se marcan «Próximamente»). |
| `#/mapa` | Mapa de aprendizaje: campaña B en el orden del «Material a estudiar» (manual PDF 3), consulta (glosario) y material complementario por separado. |
| `#/mapa/:fuente/:sección` | Unidades de una sección, con datos clave y enlaces a sus páginas. |
| `#/actividades` | «La ciudad te pregunta»: muestra de actividades (F02-T04). |
| `#/actividad/:id?semilla=n` | Una actividad; la semilla en la URL reproduce la misma variante y el mismo orden. |
| `#/pista` | Pista de prueba de la simulación (F03-T01): predio cerrado con cajón, cordón y paredes; teclado, velocidad, recorrido y contactos. Provisional hasta el habitáculo (F03-T03). |
| `#/bitacora` | «Mi bitácora»: repaso recomendado, errores recientes, progreso por concepto (campaña B separada del complemento) y respaldo (F02-T05). |
| `#/biblioteca` | Las cuatro fuentes oficiales, con edición, cantidad de páginas y PDF oficial. |
| `#/biblioteca/:fuente/:página` | Una página física: clasificación, resumen, unidades, figuras, señales, observaciones, reglas del examen que la citan (protocolo), texto extraído y enlace al PDF oficial en esa página. |

- **URLs con hash:** funcionan en cualquier hosting estático y sin conexión, sin reescrituras del servidor.
- **Carga del contenido:** `ContentProvider` carga y valida el contenido una sola vez; `ContentGate` muestra los estados de carga y de error (con reintento y detalle técnico).
- **Accesibilidad:** al navegar, `Layout` mueve el foco al título (`h1#page-title`) y `PageTitle` actualiza `document.title`.
- **Carga diferida del texto:** el texto extraído de cada fuente se carga solo al abrir una página de esa fuente.

## Actividades (F02-T04)

- **Motor** (`src/activities/engine.ts`): TypeScript puro, sin React.
  - `presentActivity(activity, seed)` elige la variante y baraja opciones, ítems o elecciones con un PRNG con semilla (Mulberry32). La misma semilla da siempre la misma presentación, y la presentación nunca incluye qué opción es correcta.
  - `nextDistinctSeed` elige la semilla de «Otra variante»: otra variante si la actividad tiene varias o, si no, al menos otro orden. Dos semillas seguidas pueden dar la misma presentación.
  - Al cambiar o completar la semilla, el título de la actividad sigue montado y recibe el foco.
  - `evaluateResponse` puntúa: elección y señales, 0/1; ordenar, crédito parcial por posición; decisión, recorre el grafo hasta el desenlace. Devuelve devolución específica, respuesta correcta, explicación y citas.
  - Una respuesta imposible lanza un error en lugar de puntuarse.
- **Tipos:** `single-choice`, `sign-identification` (señal dibujada en SVG con formas y colores reglamentarios, descripta para lectores de pantalla), `ordering` (botones subir/bajar, sin arrastrar) y `decision` (escena ramificada).
- **Resultados:** `ActivityResultContext` recibe cada intento terminado; F02-T05 lo usa para registrar el progreso.
- **Contenido:** `specs/catalog/activities.json`. Cada actividad cita conceptos (`unitIds`) y páginas (`refs`) y se valida con `validateActivities`. Solo se escriben preguntas sobre datos sin discrepancias abiertas (COBERTURA.md).

## Progreso y bitácora (F02-T05)

- **Intentos:** cada actividad terminada se guarda como `Attempt` (PROPUESTA §8), con la versión de contenido, la variante, la semilla y la respuesta. Así se sabe con qué contenido se respondió.
- **Dominio por concepto** (`src/progress/model.ts`): cajas de Leitner con repasos a 1, 3, 7, 14 y 30 días.
  - Un acierto sube una caja solo si la respuesta anterior también fue correcta y el repaso ya tocaba. Responder antes de tiempo no suma.
  - Un error, o el primer acierto después de un error, vuelve a la caja 1.
  - **Dominado** = caja 3: tres aciertos seguidos y espaciados (día 0, ≥ 1 y ≥ 4). Leer una página o acertar una vez no alcanza (PROPUESTA §3). No se calcula ninguna probabilidad de aprobar.
- **Bitácora** (`src/progress/logbook.ts`, funciones puras):
  - repaso recomendado: primero los errores recientes, después una actividad por concepto vencido (los fallados antes);
  - errores recientes;
  - progreso por grupo del mapa: la campaña B se mide aparte del material complementario (PROPUESTA §6).
- **Persistencia** (`src/progress/storage.ts`): IndexedDB, base `al-volante` (versión 3), almacenes `attempts`, `concepts` y `quarantine`.
  - Cada respuesta se escribe en una sola transacción, que lee el valor guardado de cada concepto y calcula el nuevo dentro de ella. Así, una pestaña nunca pisa el progreso más nuevo que escribió otra. Si algo falla, la transacción se aborta y no queda nada a medias.
  - Las migraciones de la base van en `upgrade`, una rama por versión (`DB_VERSION`). La versión 2 agregó `quarantine`; la 3, índices por inicio y fin de los intentos, para conocer la última hora guardada sin leerlos todos. Como esos índices ordenan como texto, la migración a la 3 reescribe primero en formato canónico las fechas de los intentos guardados que validan con `AttemptSchema`; los que no lo cumplen quedan intactos para que la carga los aparte sin cambios. **Limitación conocida:** una base que ya migró a la versión 3 con el código de #14 (fusionado el 2026-10-11 a las 22:46 y corregido en #15) no vuelve a migrar. Si guardaba un intento ilegible con alguna fecha ISO válida, esa fecha quedó reescrita en formato canónico antes de pasar a cuarentena, y el original no se conserva en ningún lado, así que no se puede restaurar. Solo cambia el formato de esa fecha; el resto del registro se conserva. La app no está publicada, así que el alcance son bases locales de desarrollo.
  - La hora de un intento nuevo nunca es anterior a la del último intento guardado, que el almacén lee dentro de la misma transacción de escritura (también si lo escribió otra pestaña), así que el más reciente sigue siendo el último aunque el reloj vaya atrasado. El esquema del intento exige que termine después de empezar y que sus eventos y faltas caigan dentro de ese intervalo.
  - Cada respuesta informa si se guardó (`SaveOutcome`): si falló, la actividad lo avisa en el momento y la bitácora cuenta los resultados sin guardar hasta que la persona lo reconoce.
  - Antes de escribir, cada concepto calculado se valida con Zod; si no cumple el esquema, la escritura se aborta. Si el reloj retrocede, la hora de la última respuesta no retrocede.
  - Al cargar, cada registro se valida con Zod. Los ilegibles se mueven a `quarantine` exactamente como estaban (almacén, clave y valor), en la misma transacción, y la bitácora avisa cuántos hay. Nunca se borran, y una práctica posterior del mismo concepto tampoco los pisa: si otra pestaña dejó un registro ilegible, también se aparta antes de escribir.
  - Si IndexedDB no está disponible (algunos modos privados), se usa memoria y la bitácora avisa que el progreso no va a durar.
  - `ProgressProvider` encola las respuestas detrás de la carga: una respuesta dada mientras carga se guarda cuando la carga termina, y si la carga falla, se guarda igual y aparece al reintentar.
  - Después de cada escritura, la pestaña vuelve a leer lo guardado y avisa a las demás por `BroadcastChannel` (`al-volante-progress`) para que hagan lo mismo. Así la bitácora de cada pestaña muestra también lo que se respondió en otra.
  - El respaldo se arma leyendo la base en el momento de exportar, no con la copia en memoria, así que siempre contiene todo lo guardado.
- **Respaldo** (`src/progress/backup.ts`): JSON autodescriptivo con `format`, `formatVersion`, `exportedAt` y `contentVersion`.
  - Al importar, primero se valida todo, incluidas las migraciones de formato una versión por vez, los ids duplicados las faltas de cada intento contra las reglas del examen y las invariantes de los intentos de actividad: terminados, una sola respuesta, puntaje y corrección coherentes (`attemptErrors`) y la coherencia de cada concepto: no más aciertos que intentos, una caja que no supere los aciertos y un próximo repaso dentro del intervalo de la caja (exactamente un día después de un error). Ninguna fecha de progreso (último intento, inicio, fin, eventos y faltas) puede ser posterior a la exportación, ni la exportación posterior a la hora del dispositivo que importa, con una tolerancia de un día para desajustes de reloj. Al importar, todas las fechas se reescriben en el formato canónico de la app (`toISOString`), porque los índices de hora ordenan como texto.
  - Después se pide confirmación, y recién entonces se reemplaza el progreso en una sola transacción.
  - Un archivo inválido, demasiado grande (más de 20 MB) o ilegible, o una escritura que falla, dejan el progreso actual intacto.

## Simulación de manejo (F03-T01)

- **Paso fijo** (`src/sim/fixedStep.ts`): 120 pasos por segundo con acumulador.
  - La simulación nunca ve los FPS: los mismos controles durante el mismo tiempo dan los mismos estados a 30 o a 144 Hz. La diferencia máxima es el paso que queda en el acumulador, y hay prueba.
  - Cada cuadro avanza como máximo 0,1 s; el exceso (por ejemplo, una pestaña en segundo plano) se descarta.
  - La vista interpola entre los dos últimos estados.
  - También las rampas de pedales y volante avanzan dentro de cada paso fijo (`src/practice/drivingLoop.ts`), no por cuadro. A 30 y a 120 Hz, con la misma cantidad de pasos, el auto queda **exactamente** igual (prueba).
- **Vehículo** (`vehicle.ts`, `dynamics.ts`): modelo bicicleta cinemático, adecuado a las velocidades bajas del examen.
  - El eje trasero sigue el rumbo y el auto gira a velocidad · tan(dirección) / distancia entre ejes.
  - La dirección gira a velocidad limitada.
  - El giro se limita por la adherencia: a velocidad, el auto subvira en lugar de girar más de lo físicamente posible.
  - Longitudinal: tracción contra freno, rodadura y aire. Las resistencias detienen el auto pero nunca lo hacen retroceder.
  - Convenciones: posición = centro del eje trasero en el plano (x, z); rumbo 0 = mirando a +z; positivo = girar a la izquierda (+x), como una rotación de Three.js sobre +y.
- **Calibración** (aproximación del juego, salvo el frenado):

  | Dato | Valor | Origen |
  |---|---|---|
  | Largo × ancho, distancia entre ejes | 4,30 × 1,75 m; 2,60 m | Auto compacto típico (aproximación) |
  | Dirección máxima, velocidad de giro | 33°, 1 rad/s | Diámetro de giro de unos 10,8 m (aproximación) |
  | Frenado máximo en seco | 9,7 m/s² | Tabla del manual (PDF 70): 10 m desde 50 km/h, 32 m desde 90 y 57 m desde 120 |
  | Adherencia en mojado | 0,5 de la seca | El manual duplica las distancias de frenado en mojado (PDF 70) |
  | Masa, rodadura, Cd·A | 1150 kg; 0,012; 0,67 m² | Valores típicos (aproximación) |

  Las pruebas comprueban el frenado contra la tabla del manual (50 km/h: 10 ± 0,5 m; 90 km/h: 32 ± 1 m; mojado: 20 ± 1 m), el radio de giro, la velocidad de la dirección y el límite de adherencia.
- **Colisiones** (`collision.ts`, `world.ts`): cajas orientadas con prueba de ejes separados (SAT).
  - Si un paso llevaría la carrocería dentro de un obstáculo, una bisección (12 rondas, menos de un milímetro) encuentra el punto de contacto. El auto queda ahí, con velocidad cero, y se informa el contacto con su velocidad de impacto, interpolada en el instante del contacto.
  - Tocar sin penetrar (menos de 0,1 mm) no cuenta.
  - `nearestObstacle` mide la distancia de la carrocería al obstáculo más cercano, para reglas como los 20 cm del cordón.
  - Las marcas pintadas (`markings`) se dibujan pero no chocan.
- **Rapier, evaluado y no adoptado por ahora:** el problema de esta tarea es un auto en un plano contra obstáculos fijos, y una solución propia, pequeña, determinista y con pruebas lo resuelve. `@dimforge/rapier3d-compat` 0.21.0 (2026-09-25) suma un WASM incluido de varios MB (unos 14 MB desempaquetado) y una inicialización asíncrona. Se reevalúa cuando haya actores dinámicos con contactos físicos (tránsito y peatones, F03-T05 y F04).
- **Pista de prueba** (`#/pista`):
  - un predio de 30 × 50 m con un cajón de 6 m entre postes, un cordón, paredes, una grilla de 1 m y las líneas del cajón;
  - teclado provisional con rampas para pedales, embrague y volante, y teclas de comando para llave, freno de mano y cambios (`src/practice/controls.ts`); solo se lee con la vista enfocada, y todas las teclas se sueltan si la vista o la ventana pierden el foco, o si la pestaña se oculta;
  - en F03-T01 la tracción salía de un control simple; F03-T02 lo reemplazó por el tren motriz;
  - en móvil no se puede manejar todavía: los controles táctiles y configurables llegan con el habitáculo (F03-T03).

## Tren motriz (F03-T02)

- **Motor** (`src/sim/powertrain/engine.ts`):
  - curva de par a fondo (95 Nm a 1000 rpm, 130 Nm a 3500 rpm), interpolada;
  - regulador de ralentí que sostiene 850 rpm y agrega hasta 45 Nm cuando el motor baja;
  - fricción interna (freno motor) e inercia;
  - corte de inyección a 6200 rpm;
  - se cala si las ruedas lo arrastran por debajo de 450 rpm.
- **Embrague:** el recorrido del pedal se traduce en enganche. No transmite nada desde el piso hasta 0,75, muerde justo debajo de 0,75 y agarra del todo desde 0,3.
  - Si la diferencia de velocidad entre motor y caja es mínima y el par entra en la capacidad, queda trabado. Si no, patina y pasa su capacidad.
  - Cuando motor y caja giran juntos, el sentido del patinamiento sale del par del motor, no del ruido de la diferencia.
- **Caja manual:** R, N y 1 a 5. Un cambio solo entra con el embrague pisado (al menos 0,85), y la R no entra yendo hacia adelante.
- **Caja automática:** P, R, N y D.
  - Convertidor de par con torque = k · ωe · (ωe − ωg): arrastra en ralentí y retiene cuando las ruedas van más rápido que el motor.
  - En D cambia de 1.ª a 4.ª según la velocidad, con histéresis.
  - Para salir de P hay que pisar el freno, y ni P ni R entran en movimiento.
- **Llave:** afuera, apagada o en contacto, más el arranque. En la pista, K recorre el ciclo completo: contacto, arranque, apagado y sacar la llave.
  - La manual arranca en N o con el embrague pisado; la automática, en P o en N.
  - La llave solo sale con el motor apagado, y en la automática, en P.
- **Retenciones:**
  - freno de mano de 2 m/s², que sostiene el auto en una pendiente del 20 % y permite salir con él puesto por error;
  - traba de estacionamiento en P;
  - motor apagado con una marcha puesta y el embrague suelto.
  - Todas actúan por los neumáticos y juntas no superan la adherencia.
- **Eventos para la evaluación** (F03-T04): arranque, apagado, calado, arranque rechazado, cambio rechazado, marcha engranada, freno de mano, salida con el freno de mano puesto (una vez por episodio: detenerse y volver a salir sin soltarlo es el mismo episodio; soltarlo o volver a ponerlo abre uno nuevo) y llave. La simulación no los juzga.
- **Integración** (`src/sim/car.ts`): `stepCar` convierte los pedales en fuerzas y el mundo mueve el auto. `command` aplica llave, palanca y freno de mano según los pedales del último paso (el embrague decide si entra un cambio).
- **Procedimientos del protocolo reproducidos con pruebas** en las dos cajas (`procedures.test.ts`):
  - etapa I: motor apagado, llave en contacto y freno de mano puesto;
  - arranque permitido y rechazado;
  - retroceder 30 cm solo con el embrague, o en automática regulando con el freno;
  - avanzar 30 cm en primera o D;
  - primeros 100 m en segunda o D a no más de 30 km/h;
  - calado al soltar el embrague sin acelerar;
  - salida con el freno de mano puesto;
  - cambios rechazados;
  - final con N o P, freno de mano, motor apagado y llave afuera.
- **Calibración:** valores de un auto compacto con motor 1.6 a nafta, como aproximación del juego.
  - Relaciones de la manual: R −3,5; 1.ª 3,6; 2.ª 2,1; 3.ª 1,4; 4.ª 1,03; 5.ª 0,82; diferencial 4,1. La automática: 2,9, 1,6, 1 y 0,75, con diferencial 4.
  - Ruedas de 0,3 m, rendimiento del 92 % y embrague de 220 Nm.
  - Resultado: en primera el ralentí lleva el auto a unos 6,5 km/h, y en segunda 30 km/h son unas 2300 rpm.

## Convenciones

- **Idiomas** (`AGENTS.md`): código, nombres y comentarios en inglés; documentación en español; textos para quien juega en español rioplatense, siempre desde `src/i18n/es-AR.ts`. Los valores técnicos de los catálogos (estados, tipos de vía) también van en inglés; los ids de fuente conservan el nombre del documento oficial.
- **Separación de capas**: el mundo 3D (`createGarageScene`) es un módulo puro de Three.js que no conoce React ni el renderer. `SceneCanvas` lo monta, recibe la fábrica del renderer por inyección (para probar sin WebGL) e informa su estado en `data-state` (`loading`, `ready`, `unavailable`).
- **Carga diferida**: Three.js se carga en un chunk separado (`React.lazy`), así la parte teórica no espera el bundle 3D. El shell inicial pesa unos 70 kB comprimidos.
- **Accesibilidad**: salto al contenido, foco visible, `prefers-reduced-motion` (la cámara del garaje deja de moverse), descripción textual de la escena y mensaje alternativo sin WebGL. Contraste verificado: texto noche sobre marfil 14,2:1; turquesa de texto sobre marfil 5,5:1.
- **Paleta** (`src/ui/theme.css`, PROPUESTA §7): azul noche, marfil y turquesa; el amarillo queda reservado para información vial y alertas.

## Calidad y comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Chequeo de tipos y build de producción en `dist/`. |
| `npm run lint` / `npm run format:check` / `npm run typecheck` | Lint, formato y tipos. |
| `npm test` / `npm run test:coverage` | Pruebas unitarias; la cobertura exige ≥ 80 % en líneas, ramas, funciones y sentencias. |
| `npm run test:e2e` | Build, servidor de vista previa y pruebas Playwright. La primera vez: `npx playwright install chromium`. |
| `npm run validate:content` | Valida todos los catálogos con los esquemas y referencias de `src/content/` e imprime la versión y la cobertura. |
| `npm run check` | Todo lo anterior salvo E2E, en el mismo orden que la CI. |

La CI (`.github/workflows/ci.yml`) corre `checks` y `e2e` en cada PR y en `main`. Las actions están fijadas por SHA de commit. Activar la CI como check obligatorio de `main` queda a decisión del usuario.

## Habitáculo y controles (F03-T03)

La pista usa `createCockpitScene`, con cámara en el puesto del conductor, geometría procedural propia, volante ligado al ángulo de dirección y agujas ligadas a velocidad/rpm reales. No hay activos externos nuevos. Dimensiones del interior, campo visual y recorridos de ajustes son aproximaciones visuales, no tolerancias del examen. La cámara no tiene balanceo ni suavizado automático; la mirada se cambia explícitamente con arrastre, botones o teclas.

`cockpit.ts` mantiene un estado inmutable separado del tren motriz: asiento, apoyacabezas, orientación de espejos, mirada, cinturón, iluminación, giros, balizas, limpiaparabrisas, bocina y climatización. Rechaza ajustes no finitos y acota sus recorridos. Los pedales, llave, cambios y freno de mano siguen pasando por `driveFrame` y la simulación de T02. Reiniciar restaura auto y habitáculo; cambiar de caja monta una sesión nueva. El foco perdido libera mandos sostenidos y pendientes.

Los tres espejos son `Reflector` de Three.js y renderizan la misma escena, incluidos sus objetos móviles; no son imágenes ni videos prefijados. Cada espejo tiene una textura de 512×256, sin multisampling, y un pase cuando es visible. Se ocultan los demás espejos durante ese pase para impedir recursión; se liberan sus render targets al desmontar. Los controles modifican físicamente orientación y perspectiva. Las pruebas introducen un actor móvil y verifican que cada render reflejado recibe sus posiciones actualizadas. El predio todavía no contiene tránsito autónomo: corresponde a tareas posteriores.

`bindings.ts` valida las asignaciones guardadas bajo `al-volante.controls.v1`, rechaza duplicados y teclas de navegación reservadas, y restaura defaults ante datos corruptos. Un error de escritura se muestra y mantiene la configuración en memoria. Los controles táctiles usan captura de puntero y permiten mantener pedales simultáneos; también aceptan Enter/Espacio. La activación semántica por click (`detail=0`), sin secuencia de puntero, genera un pulso; los clics de puntero conservan los handlers de sostener y no duplican la activación. `heldInput.ts` conserva cada acción breve hasta un paso fijo real: los cuadros sin pasos no consumen el pulso, y los pasos siguientes leen solamente lo que sigue presionado. La bocina conserva su indicación visual durante el cuadro que consume el pulso. Pérdida de foco y reinicio limpian entradas pendientes. No se reconstruye la duración exacta de los eventos entre cuadros. Esta entrega verifica teclado, mouse y controles en pantalla; no acredita compatibilidad con mandos o volantes físicos.

Fuentes de reconocimiento y preparación: `specs/fuentes/pdf/protocolo.pdf`, páginas PDF 9–10 y gráficos de 18–20. La interfaz enlaza las páginas de la biblioteca. Luces, limpiaparabrisas, cinturón y ajustes tienen representación visual; climatización y bocina tienen estado y testigo explícitos, sin simulación térmica ni audio todavía. No se evalúan postura física, ojos reales, puntuación ni faltas (F03-T04). El refinamiento audiovisual pertenece a F06-T03.

Para verificar: `npm run check` y `npx playwright test --workers=1`. La CI usa un worker para evitar que dos navegadores con espejos activos compitan por el renderizado. Las pruebas E2E del habitáculo guardan capturas frontal/lateral. Una prueba separada registra `frame-timing`: hasta 60 intervalos de render durante una ventana de 5 segundos, cerrada al recibir el siguiente cuadro; el adjunto incluye cantidad real de muestras, duración, viewport y navegador. Una muestra más corta no acredita el objetivo de FPS. Las pruebas de conducción esperan el reloj de simulación (`data-time-s`) para sostener freno y embrague, sin depender de pausas de tiempo real; disponen de 60 segundos para la secuencia completa. Usar el build de producción: correr cobertura junto con Vite en desarrollo puede provocar recargas automáticas de la página por archivos generados y falsear pruebas de foco o conducción. No interpretar emulación de Pixel 7 como medición en ese teléfono físico.

Medición local de referencia de esta entrega: CPU AMD Ryzen 7 4800H (16 hilos), Linux x86_64, Chromium 153 de Playwright, build de producción, un worker, predio detenido con espejos activos, 60 intervalos después de cargar. Escritorio 1280×720, DPR 1: media 61,67 ms (≈16,2 FPS), p95 66,7 ms. Emulación Pixel 7 412×839, DPR 2,625 (render limitado a 2): media 42,52 ms (≈23,5 FPS), p95 50,1 ms. Backend gráfico no identificado. Estos resultados del entorno automatizado no alcanzan el objetivo general de 60/30 FPS ni validan hardware móvil real; optimización y perfilado gráfico siguen pendientes. No hay garantía de rendimiento de dispositivo.

## Evaluación del examen (F03-T04)

- **Libro de fallas** (`src/exam/scoring.ts`): funciones puras sobre `specs/catalog/rules.json`. `recordFault` aplica puntos, política de repetición (REGLAS.md §5: `once` y `single-check` una vez; `per-occurrence` cada vez; `per-episode` y `unspecified` una por episodio, decisión D3, con una clave de episodio que da quien observa), escalamiento a eliminatoria cuando interviene el doble comando e interrupción. `interrupt` registra el corte previo a la circulación, el pedido del aspirante o la toma de control. `resultOf` aprueba solo con las tres etapas completas y ≤ 7 puntos (`protocolo.pdf` PDF 14). Una regla desconocida lanza error: no se puntúa a ciegas.
- **Sesión** (`src/exam/session.ts`): máquina de estados pura, `observe(session, observación) → session`, determinista para las mismas observaciones. Observa comandos del habitáculo, cada paso fijo de la simulación (auto, habitáculo y eventos) y los avisos «listo» y «pedir interrupción». Fases de este alcance: familiarización (sin fallas, PDF 9) → reconocimiento (pedalera, luces e instrumental en orden aleatorio con semilla, y la caja recorrida completa y de vuelta a N o P, vecino por vecino, como un bloque en orden: una marcha en camino a la pedida no es respuesta y una que se aleja de ella es la eliminatoria b; la ronda se juzga completa y una eliminatoria interrumpe al terminarla; al empezar, la página vuelve a poner el auto como exige la etapa I, con motor apagado y llave en contacto, sin importar lo hecho en la familiarización) → preparación (asiento, apoyacabezas y los tres espejos; se puntúan al avisar que terminó; lo ajustado en la familiarización no cuenta, porque el habitáculo vuelve a su estado) → desbloqueo (neutro/P y arranque) → retroceso de 30 cm (en R) → avance de 30 cm (en primera o D) → salida del cajón. Termina al despejar el cajón; el tramo en la calle es F03-T05.
- **Qué se puntúa en este alcance** (anexo II de `specs/fuentes/pdf/protocolo.pdf`, PDF 22–33, con la ficha en PDF 15–17; cada caso con prueba en `session.test.ts`): leves a, b, c, d, e (también cuando el motor arranca en cambio con el embrague pisado), f (por episodio de freno de mano, según el evento de T02), h (por episodio de motor encendido) y j; deficientes bajas d (calado); deficientes altas a, b, c, d y e; eliminatorias a, b, c (al moverse sin cinturón o al quitárselo) y d (subir al cordón o golpear un poste). Corte con 8 puntos antes de moverse (`protocolo.pdf` PDF 10, según la decisión D5 de REGLAS.md §7: el instante exacto es interpretación del proyecto). No se evalúan todavía: g (tiempo de arranque, la simulación arranca al instante), baja a (cinturón mal colocado: el cinturón es puesto/no puesto), baja b y c (arranque brusco, aceleración en vacío) y la salida con más de dos maniobras, que solo se informa (V4).
- **Aproximaciones del juego** (`GAME_PARAMETERS`, mostradas en la interfaz; REGLAS.md §7): tolerancia de ±10 cm en los 30 cm (V2); volante «movido» si supera 0,03 rad; poste rozado por debajo de 1 m/s y derribado por encima; chequeo de espejos registrado al mirar un espejo lateral, un giro de cabeza de entre 0,25 y 0,9 rad (D4; girar del todo la cabeza es solo un complemento, X6; botones y teclas «Mirar el espejo izquierdo/derecho»); cordón tocado por debajo de 1 m/s como roce de la rueda (leve i) y por encima como subirse a la vereda (eliminatoria d), porque el motor de colisiones solo sabe que la carrocería tocó; en manual, frenar durante los 30 cm solo vale para inmovilizar: moverse más de 5 cm después de pisar el freno es regular con él (falla); el auto «se movió» en la etapa II a partir de 0,2 m/s; una maniobra termina tras 0,5 s detenido.
- **Integración**: `driveFrame` acepta un observador por paso fijo y por comando, así la evaluación corre a 120 Hz con la simulación y no depende de los FPS. `DrivingCanvas` recibe `prepared` (la llave en contacto al empezar y al reiniciar) y `onObservation`. La página `#/examen` (`ExamPage`) mantiene la sesión en una referencia, la publica a la cadencia de la telemetría y muestra examinador, puntos, mediciones, fallas con su texto de la ficha y política de repetición, interrupción y resultado parcial. Las fallas de la ficha se nombran con el texto de `rules.json`; la devolución pedagógica completa es F03-T05 y F06.
- **Límites conocidos**: no persiste intentos de manejo (el contrato `Attempt` admite `kind: 'driving'`, se conecta en una tarea posterior); el reconocimiento no exige dejar las luces bajas encendidas (no hay falla en la ficha); el examinador no «ve» tránsito, por lo que el giro de cabeza no escala a eliminatoria en el predio.

## Primer tramo y cruce (F03-T05)

- **Escenario** (`src/sim/scenario.ts`): semáforo de ciclo fijo (`lightAt`) y actores con guion, cinemáticos y deterministas: cada uno va en línea recta de `from` a `to` a velocidad constante cuando se dispara su gatillo (el auto alcanza una z, o una fase del semáforo, una vez o en cada ciclo). `stepScenario` avanza el estado, informa los actores que la carrocería empieza a solapar (una vez por episodio de contacto) y expone `inside(zona)` para reglas de sendas y encrucijadas. Los actores no reaccionan al auto.
- **Mundo** (`src/sim/tracks/firstBlock.ts`): tramo 1 del recorrido A (RECORRIDO.md): Quesada de mano única, 127 m desde el frente del cajón hasta la línea de detención, límite 30 km/h, semáforo en la esquina y giro a la derecha a Av. Cabildo (45 km/h). Son del recorrido la longitud, los límites, el semáforo y el giro; son aproximaciones del juego el ancho de calle (10 m) y de avenida (24 m), las fachadas, la senda, el ciclo del semáforo (10 s verde, 3 s amarillo, 20 s rojo) y los actores: un peatón que baja del cordón izquierdo cuando el auto está a 30 m de la línea y un auto que cruza por la mitad lejana de la avenida una vez por cada rojo de Quesada (el actor recuerda en qué ciclo del semáforo corrió, así no vuelve a salir dentro del mismo rojo). El mundo lleva `scenario` opcional; el predio cerrado no tiene.
- **Bucle** (`src/practice/drivingLoop.ts`): el escenario se avanza en cada paso fijo después del auto, con la carrocería y el tiempo de la simulación; tocar un actor produce el evento `actor-contact`. La escena dibuja los actores como cajas y un semáforo con tres lámparas en la línea de detención (`createTrackScene`), y la vista del habitáculo los recibe en `update`. El suelo y la grilla se dimensionan y centran según los obstáculos y marcas del mundo (mínimo 200 m, margen de 60 m), para que una calle larga conserve el pavimento hasta su cruce.
- **Fases nuevas del examinador** (`session.ts`, con `Course` = zonas y límites del tramo): `firstMetres` (100 m desde que el auto despeja el cajón: a no más de 30 km/h, en segunda o en D por encima de 15 km/h; si no, eliminatoria g, una vez), `approach` (hasta entrar en la encrucijada: velocidad frente al límite de examen (30/45, REGLAS.md §6) y al máximo propio de la vía (40 en Quesada y 60 en Cabildo según OSM, RECORRIDO.md §4, pendientes de confirmar en F04-T01) con decisión D2 y 1 km/h de margen: un episodio empieza al superar el límite y termina al volver por debajo o al cambiar de fase vial (D3), y si llega a la máxima vial su alta f se retira y queda solo la eliminatoria l; direccional derecha anotada desde que empieza su episodio vigente (apagarla o cambiarla de lado lo olvida); detenerse pasando la línea, alta h, una por detención; entrar en la senda con el peatón sobre ella, alta l, y atropellarlo, esa misma falta elevada a eliminatoria con interrupción (`recordFault` eleva el episodio ya puntuado en vez de duplicarlo); bloquear la encrucijada 2 s en rojo, alta i; cruzar la línea en rojo, eliminatoria k; al cruzar la línea, sin direccional, baja g, o con direccional a menos de 30 m, leve q) y `turn` (giro a la derecha: terminado al superar 70° de giro y 30 m sobre la avenida; seguir de largo, eliminatoria f; tocar al vehículo que cruza, eliminatoria i). Las etapas no se completan: el resultado sigue parcial hasta la fase 4.
- **Devolución básica** (`ExamPage`): al terminar, cada falla muestra la conducta de la ficha, qué evalúa el protocolo (`condition` de `rules.json`) y enlaces a las páginas PDF del protocolo en la biblioteca; sin fallas, remite a las páginas de salida y primeros 100 m. El panel muestra además el estado del semáforo y la máxima de los primeros 100 m.
- **Pruebas** (`street.test.ts`): un conductor con guion recorre el tramo con el auto, el habitáculo y el escenario reales: 100 m correctos y con exceso (automática y manual en primera), parada correcta y espera del verde y del peatón con giro limpio, cruce en rojo, detención pasada la línea, direccional ausente y tardía, senda con peatón y seguir de largo. El conductor mantiene el carril con una corrección proporcional del volante, como un conductor estable.
- **Límites conocidos**: los actores no frenan ni esquivan; el tránsito real, las prioridades sin semáforo, la distancia de seguimiento y la detención innecesaria llegan en F04; el auto no se detiene físicamente al tocar un actor (la falla interrumpe el examen); el giro se juzga por rumbo y posición, no por carril.


## Ciudad y recorrido completo (F04-T01)

El explorador `#/recorrido` construye el barrio desde `ContentGate` y el catálogo de ruta validado. `src/city/` separa modelo métrico y colisiones, planificación de piezas, instancias, señales, sectores y adaptadores de vista. El habitáculo se reutiliza por la propiedad opcional `createScene` de `DrivingCanvas`; el subtítulo también es configurable. Las vistas Three.js siguen cargándose en diferido.

Sectores de 128 m con carga a 220 m y descarga a 270 m, recursos GPU liberados al salir, colisiones persistentes y materiales originales sin dependencias nuevas. La prueba de vuelta completa usa el vehículo real; los E2E cubren exploración, conducción y reinicio. Detalle de ejes, anchos, evidencias, límites y presupuesto en [CIUDAD.md](CIUDAD.md). La evaluación del primer cruce no se extiende automáticamente al circuito.

## Tránsito del circuito (F04-T02)

`src/traffic/` genera un tránsito determinista para toda la ciudad a partir del modelo de F04-T01 y una semilla. Es una capa de simulación pura (sin Three.js), avanzada una vez por paso fijo de 120 Hz junto al auto, como el escenario de F03-T05. El bucle de manejo ya no conoce el escenario concreto: `World` lleva `traffic?: TrafficSource` (o el `scenario` guionado, adaptado por `scenarioSource`), y `trafficOf(world)` elige cuál avanzar. Toda implementación expone el mismo `TrafficSnapshot` (`light`, `lights` por id de control, `poses` con `inside(zona)` y `contacts`), así `#/examen` sigue consumiendo el primer tramo sin cambios y el examinador de F04-T03 podrá consumir la ciudad.

- **Red** (`network.ts`): `buildNetwork(city)` deriva de las calles las **encrucijadas** (puntos de cruce entre calles distintas, agrupados a 22 m, con el control de PARE o semáforo a menos de 20 m), sus **aproximaciones** (calle, sentido, línea de detención, grupo 0/1 y regla `signal | stop | priority`, con las cajas de conflicto que cada una debe atravesar), las **sendas** (31: las tres sendas semaforizadas del catálogo y una antes y otra después de cada esquina del recorrido) y los **carriles y trayectorias** de los actores: la vuelta cíclica por el carril derecho del recorrido, el carril izquierdo de Cabildo y Manuel Ugarte, el Metrobús en ambos sentidos, la calzada opuesta de Cabildo, Iberá, Av. Congreso en ambos sentidos, Vuelta de Obligado norte y la ciclovía (tramos 4, 5 y 6 hasta Congreso) en ambos sentidos. Con la semilla 1 hay 15 encrucijadas (5 con semáforo, 5 con PARE, 5 sin control) y 14 trayectorias. Las trayectorias abiertas se prolongan 15 m en cada extremo para que los vehículos aparezcan y desaparezcan fuera del cruce.
- **Línea de detención**: a medio ancho de la calle cruzada más 2 m antes del punto de cruce, o la línea pintada por `signage.ts` cuando queda más atrás (Quesada ante Cabildo, Cabildo ante Guayra). En los semáforos de media cuadra (Cabildo e Iberá, Cuba y Obligado ante Congreso) la línea pintada de F04-T01 cae dentro de la calle transversal; el tránsito usa la geométrica. Alinear la pintura es tarea de F04-T03, cuando el examinador juzgue la detención.
- **Semáforos** (`lights.ts`): ciclo fijo de 14 s verde, 3 s amarillo y 19 s rojo (36 s) para la calle del control (grupo 0) con un desfase por encrucijada tomado de la semilla; la calle transversal (grupo 1) tiene la fase complementaria con 1 s de todo rojo antes de su verde y amarillo antes del verde principal. Las sendas semaforizadas de Cabildo heredan la fase del cruce más cercano (control-1 del cruce con Quesada; control-2 y control-4 del cruce con Iberá). `lights` informa el estado por id de control: los cinco `traffic_signals` y las tres `crossing-traffic_signals`. Las duraciones son aproximaciones del juego; el significado de cada luz sigue `specs/fuentes/pdf/manual.pdf`, PDF 64 y 197.
- **Vehículos** (`traffic.ts`): autos (4,3 × 1,75 m), colectivos (12 × 2,5 m, solo en el Metrobús) y bicicletas (1,8 × 0,6 m, solo en la ciclovía; cada sentido usa su mitad derecha de los 2,6 m, el de ida junto a la calzada y el de vuelta por fuera). Un vehículo cada 120 m de carril (al menos uno en trayectorias de 60 m o más; el enlace de Quesada, de 36 m, no lleva ninguno) y tres bicicletas por sentido: 34 con la semilla 1 (24 autos, 4 colectivos, 6 bicicletas). Cada uno conserva una fracción de la velocidad del carril (0,85–1) tomada de la semilla. Velocidad del carril: el menor entre el límite de examen y la máxima OSM (30 km/h en calles, 45 en Cabildo, REGLAS.md §6 y RECORRIDO.md §4); 30/45 en calles y avenidas de contexto sin fuente, 40 en el Metrobús y 15 en bicicleta, todos aproximaciones. Longitudinalmente aceleran a 2 m/s², frenan con comodidad a 3 m/s² y como máximo a 5 m/s², anticipan los carriles más lentos y toman las esquinas a 4 m/s (aproximaciones). Reglas que siguen:
  - **Distancia de seguimiento**: 2 s respecto del vehículo de adelante más 3 m detenidos (`manual.pdf`, PDF 71, regla de los dos segundos), tanto con otro actor de su trayectoria como con cualquiera que esté delante en su corredor, incluido el auto del jugador. Quien viene de frente por otra trayectoria (la otra mitad de la ciclovía) no cuenta como vehículo de adelante; sin esa excepción, dos bicicletas enfrentadas se esperaban para siempre.
  - **Semáforo**: detenerse en la línea con rojo, o con amarillo si todavía pueden frenar a 5 m/s²; con verde ceder a quien ya esté cruzando el pavimento de conflicto en sentido transversal (`manual.pdf`, PDF 64).
  - **PARE**: detenerse por completo en la línea, esperar 1 s (aproximación) y ceder el paso a los vehículos de la otra calle que llegan a menos de 20 m o a menos de 4 s (`manual.pdf`, PDF 64: Pare y Ceda el Paso hacen perder la prioridad).
  - **Prioridad de la derecha** en esquinas sin semáforo ni PARE: ceder a quien llega por la derecha, actor o auto del jugador, salvo que el de la derecha se haya detenido 1,5 s (`manual.pdf`, PDF 64, «Prioridad de la derecha y sus excepciones», excepción 4); seguir cuando la prioridad es propia. Los actores que llegan por la izquierda del jugador le ceden; los que llegan por su derecha siguen (y frenan si el jugador invade el cruce, por el corredor y las cajas de conflicto).
  - **Peatones**: detenerse antes de una senda con un peatón sobre ella.
  - **Bloqueo**: un vehículo que lleva 8 s cediendo sin poder avanzar sigue a través de ese cruce (aproximación anti-bloqueo); los que terminan una trayectoria abierta reaparecen al inicio tras 4–12 s, solo a más de 40 m del jugador y con el inicio libre. No cambian de carril, no sobrepasan y no son vehículos de emergencia (F04-T03).
- **Peatones**: uno por senda como máximo, a 1,1–1,5 m/s, cada 25–55 s por senda (intervalo de la semilla), solo en sendas a menos de 250 m del auto. En sendas con semáforo cruzan solo mientras su calle está en rojo y le queda rojo para terminar más 1 s (aproximación de la fase peatonal); en las demás, solo si ningún vehículo ni el auto se acercan a menos de 15 m a más de 1 m/s y nada ocupa la senda. Son cinemáticos: una vez que bajaron del cordón terminan de cruzar.
- **Jugador**: el tránsito lo ve como un vehículo más por su carrocería (velocidad estimada entre pasos). `lookahead.ts` devuelve `lookAhead(traffic, state, body)`: el próximo semáforo o senda semaforizada (control, luz y distancia a la línea desde el paragolpes), el próximo PARE o cruce con prioridad (aproximación, regla, distancia y cajas de conflicto), la próxima senda (ocupada o no) y el vehículo de adelante: sobre la línea del recorrido, y mientras el auto también va sobre ella, se lo sigue a lo largo de la vuelta si va en su sentido (hasta 60°), como se siguen los actores entre sí, así un auto que dobla adelante sigue siendo líder antes de que el auto doble; fuera de esa línea, debe estar en el corredor del auto e ir en el sentido del auto o del recorrido en los próximos 20 m. La brecha usa la extensión del actor sobre ese eje. El tránsito transversal o de frente queda como conflicto del cruce, nunca como líder. `light` del snapshot es la luz que el auto enfrenta en el recorrido a menos de 80 m, o verde si ninguna aplica; F04-T03 debe usar `lights` y `lookAhead`, no solo `light`.
- **Determinismo y costo**: la misma semilla y las mismas entradas producen estados idénticos (prueba `is reproducible`); la aleatoriedad se consume solo al crear el tránsito (`createRandom`, Mulberry32), nunca en el paso. Se posan y se pueden tocar solo los actores a menos de 250 m del auto, con un tope de 60; los lejanos siguen avanzando sin reaccionar al auto. Índices por id y búsqueda binaria en las trayectorias mantienen el paso en torno a 0,5 ms con 34 vehículos (medido en la prueba de vuelta, no en navegador).
- **Escena**: `signage.ts` nombra las lentes (`lens-red|yellow|green`) y `lightControl` enciende una desde el estado; `scene.ts` mantiene una malla por actor presente en el último estado (caja por tipo, colores de `ACTOR_LOOK`, visible solo mientras está activo) y libera la malla de cada actor que desaparece, porque cada cruce peatonal crea un id nuevo; enciende los semáforos cargados en cada sector, incluidas las tres sendas semaforizadas de Cabildo (`isSignalControl`), también en los espejos porque comparten la escena. `DrivingCanvas` publica `data-actors` con los actores activos.
- **Interfaz**: `#/recorrido` conduce con tránsito por defecto y una semilla editable (entero 0–999999, por defecto 1) que recrea el bucle y el tránsito; nada se puntúa. La página aclara que la evaluación del circuito completo corresponde a F04-T03–T05.
- **Sentidos supuestos** (aproximaciones declaradas, sin fuente en el catálogo): Iberá de oeste a este, Vuelta de Obligado norte continuando el sentido del tramo 8, el enlace de Quesada hacia Cuba, Av. Congreso de doble mano, la calzada opuesta de Cabildo en sentido contrario al tramo 2, el Metrobús y la ciclovía de doble sentido. Confirmarlos requiere relevamiento (CIUDAD.md).
- **Pruebas** (`src/traffic/*.test.ts`): red (encrucijadas, controles, líneas fuera de la calle cruzada, sendas, trayectorias), planes de semáforo (nunca dos verdes, todo rojo), reproducibilidad por semilla, tope y radio, velocidad del carril, rojo/verde, PARE, seguimiento (actor y jugador), prioridad de la derecha (actor y jugador, con la excepción 4), fase peatonal y brecha, bicicletas en la ciclovía, contacto único, colectivos en ambos sentidos con reaparición, luz que enfrenta el auto; y la **vuelta legal** (`lap.test.ts`): un conductor de prueba por seguimiento de trayectoria que lee `lookAhead` completa el circuito con el tránsito de la semilla 1, sin contactos con cordones ni actores, sin cruzar en rojo, deteniéndose en los rojos y sin ninguna detención mayor a un ciclo (36 s). La escena y la página tienen pruebas de actores y lámparas; Playwright comprueba actores activos y ausencia de errores.

## Examinador del circuito (F04-T03)

`#/examen` corre ahora sobre la ciudad de F04-T01 con el tránsito de F04-T02: etapa I en el cajón del tramo 1, los 30 cm, la salida, los primeros 100 m y la circulación completa de los ocho tramos del recorrido A, hasta volver a Quesada; ahí termina la etapa II (marcada completa) y el resultado queda parcial a la espera del estacionamiento (F04-T04). Los modos y la ficha son F04-T05.

- **Circuito** (`src/exam/circuit.ts`): `buildCircuit(city, traffic)` deriva de la ciudad y de la red de tránsito lo que el examinador lee: los ocho tramos sobre la trayectoria `lap` (inicio/fin en metros de vuelta, giro, calle siguiente, límite de examen 30/45 y máxima OSM, carriles, ciclovía), cada cruce con línea de detención, regla (`signal`, `stop`, `priority`), cajas de conflicto y calzadas cruzadas, la esquina que cierra cada tramo (giro y tramo siguiente), las sendas (con el control `crossing-traffic_signals` que tenga luz propia), el reductor del tramo 6, las calzadas del Metrobús y las calles con línea continua a la izquierda (las de Av. Cabildo). Reemplaza al `Course` del primer tramo fijo; `src/sim/tracks/firstBlock.ts` queda solo como mundo de prueba del escenario con guion.
- **Examinador** (`src/exam/circulation.ts`, con el estado y los umbrales en `src/exam/street.ts` y los jueces de carril, sobrepaso, ambulancia y toma de control en `src/exam/circulationActors.ts`): `judgeCirculation(street, circuit, car, cockpit, snapshot, dt, timeS, firstMetres)` es una función pura por paso fijo que devuelve el estado siguiente de la calle (`Street`: tramo, instrucción, aviso, límites del tramo, memorias de direccionales, miradas, detenciones, episodios, actores vistos, ambulancia, escalables) y los `Report` a consignar; `session.ts` los aplica con `recordFault`/`withdrawFault` y resuelve la toma de control (`takeover`). Lee `lookAhead` (con 14 m de tolerancia lateral para juzgar el lado del Metrobús), `lights`, `poses` con `inside`, los contactos y el estado del auto. Un reporte repetido por el mismo par regla/episodio se filtra en el juez (`reported`), además de la política del libro. Umbrales en `CIRCULATION`; son decisiones del juego (REGLAS.md §7 D6–D9 y §9).
- **Fases** (`session.ts`): … → `exit` → `firstMetres` → `circulation` → `finished`. `exit` termina cuando el auto está 2,5 m a la izquierda de donde empezó la salida (en el marco de la pose inicial, ya no en coordenadas fijas). Durante `firstMetres` rigen todas las reglas de circulación salvo la velocidad (eliminatoria g, D1) y la mínima; con el cajón a 20 m, los 100 m terminan unos 3 m después de la línea de Cabildo (D9). La toma de control (`takeover`, resuelta en `settleCirculation`): eleva la última alta escalable reciente (e, l, n u o; la e se registra al salir del cajón sin mirar) o consigna la eliminatoria i, interrumpe con causa `examiner` aunque una falta del mismo paso ya haya interrumpido, marca `street.takeover` y el auto se frena (`halted` en `DrivingCanvas`: freno y embrague a fondo, teclas ignoradas). La página pasa `halted` como función que lee la sesión, así el freno actúa desde el paso de simulación siguiente sin esperar un render. El progreso solo avanza al tramo siguiente en orden (`legsEntered`); volver al anterior cerca de una esquina no cuenta. Los contactos reales (`actor-contact`) elevan la alta l (peatón, ciclista) o consignan la i (vehículo, colectivo, ambulancia), siempre con causa `examiner`; `recordFault` admite `cause` y da `examiner` a todo escalamiento.
- **Vehículo de emergencia** (`src/traffic/emergency.ts`): una ambulancia por vuelta, actor `emergency`, aparece 90 m detrás del auto cuando este lleva 20 m de Guayra, sube por el recorrido a 50 km/h desplazada 2,4 m a la izquierda del carril, se detiene a 6 m de cualquier carrocería que tenga de frente y se rinde (desaparece) tras 6 s esperando o 150 m después de pasar. Los demás actores no reaccionan a ella (aproximación). Tamaño, velocidad, disparo y paciencia son aproximaciones del juego.
- **Tránsito** (extensión mínima de F04-T02): los peatones de sendas semaforizadas tampoco bajan del cordón con el auto a menos de 15 m a más de 1 m/s (antes solo en las sendas sin semáforo), para que un giro no encuentre un peatón recién bajado.
- **Página**: `ExamDrive` (`src/city/ExamDrive.tsx`, carga diferida) pone la escena de la ciudad en el `DrivingCanvas` del examen; la semilla (1–999999) define el orden de las preguntas y el tránsito. HUD: puntos, tramo y calle, próxima indicación («En la próxima esquina, doblá a la derecha, por Av. Cabildo.»), aviso del control siguiente (semáforo con su luz, PARE, esquina sin semáforo, lomo de burro, ambulancia), límite de examen y máxima de la vía (OSM, sin confirmar), semáforo y mediciones del cajón. Al interrumpir muestra la causa y la regla; el resultado parcial dice que faltan la etapa III.

En la columna «Fuente», «protocolo PDF n» es `specs/fuentes/pdf/protocolo.pdf`, página PDF n.

| Regla | Criterio (juego) | Fuente | Episodio | Prueba |
|---|---|---|---|---|
| elim g (primeros 100 m) | > 30 km/h o fuera de 2.ª/D por encima de 15 km/h | protocolo PDF 11, 31 | una vez | `street.test.ts` «the first 100 m…», «manual: staying in first…» |
| alta f / elim l (velocidad) | exam 30/45 vs máxima OSM por calle; D2, D3, D8 | protocolo PDF 8, 10, 12, 28, 32 | `speed-n` por tramo | `street.test.ts` «over 30 km/h on a street…»; `circulation.test.ts` «skips the speed rules…» |
| elim k (rojo) | frente cruza la línea de un semáforo o senda semaforizada en rojo | protocolo PDF 12, 32 | una vez | `street.test.ts` «crossing the stop line on red…» |
| alta h (línea/senda) | frente 0,1–4,5 m después de la línea o dentro de una senda al detenerse | protocolo PDF 12, 28 | `stop-n` | `street.test.ts` «stopping past the line…» |
| alta i (bloqueo) | 2 s detenido sobre la calzada cruzada, sin ceder a una senda | protocolo PDF 12, 28–29 | encrucijada | `street.test.ts` «standing on the avenue…» |
| alta j (PARE) | sin detención total a < 3 m de la línea, o con vehículo cruzando | protocolo PDF 12, 29 | encrucijada | `street.test.ts` «rolling through the STOP…» |
| alta k (prioridad) | vehículo cruzando o llegando por la derecha a < 20 m | protocolo PDF 12, 29 | encrucijada | `circulation.test.ts` «priority at unsignalised corners» |
| alta l (peatones/ciclistas) | senda ocupada invadida; ciclista cruzando el pavimento; escalable | protocolo PDF 12, 29 | senda / encrucijada | `circulation.test.ts` «pedestrians and cyclists»; `street.test.ts` «hitting a pedestrian…» |
| alta m (reducir) | > 20 km/h a < 12 m de una esquina de giro o cruce con prioridad | protocolo PDF 12, 29 | encrucijada | `street.test.ts` «arriving fast at the unsignalised corner…» |
| alta n (carril de giro) | carril distinto del más próximo al giro en calles multicarril; escalable | protocolo PDF 12, 29 (X2) | encrucijada | criterio en `judgeLineCrossing`; sin caso con guion (el recorrido gira a la derecha desde el carril derecho) |
| alta o (espejos al cambiar) | cambio de carril sin mirada al espejo del lado en 5 s; escalable | protocolo PDF 12, 29 | `lane-change-n` | `circulation.test.ts` «lanes…» |
| baja h (direccional 3 s) | cambio de carril con direccional < 3 s | protocolo PDF 12, 27 | `lane-change-n` | `circulation.test.ts` «lanes…» |
| baja g / leve q (direccional de giro) | ausente o del lado contrario / a < 30 m | protocolo PDF 12, 24, 26 | encrucijada | `street.test.ts` «turning without the signal…» |
| alta g (2 s) | brecha/velocidad < 2 s durante 1,5 s tras un vehículo en movimiento | protocolo PDF 12, 28 | tramo | `circulation.test.ts` «following distance» |
| leve p (carril) | fuera del carril 3 s, asentado y alineado | protocolo PDF 12, 24 | tramo | `circulation.test.ts` «scores straddling…» |
| elim j (carriles/sentidos) | ciclovía, Metrobús o contramano 1 s | protocolo PDF 12, 32 | tramo | `circulation.test.ts` «scores driving on the cycle track…» |
| elim o (línea continua) | borde izquierdo de Cabildo 0,5 s (X3, D8) | protocolo PDF 12, 32–33 | tramo | `circulation.test.ts` «…the continuous line…» |
| elim p (sobrepaso) | por la derecha, o por la izquierda sobre encrucijada/senda | protocolo PDF 12, 33 | una vez | `circulation.test.ts` «overtaking» |
| elim n (emergencia) | no estar cediendo (10 km/h o 0,7 m a la derecha) mientras está a menos de 30 m detrás, hasta que pasa | protocolo PDF 12, 32 | una vez | `street.test.ts` «the ambulance of Guayra»; `circulation.test.ts` «the emergency vehicle» |
| elim f (indicación) | pasar la esquina sin tomar el tramo siguiente, o salir del recorrido 3 s | protocolo PDF 8, 11, 31 | una vez | `street.test.ts` «going straight across the avenue…» |
| elim h (control) | aceleración lateral > 6 m/s² 0,3 s | protocolo PDF 16, 31 | una vez | `street.test.ts` «full lock at speed…» |
| elim i (temeraria) | contacto con vehículo o toma de control sin escalable | protocolo PDF 14, 31–32 | una vez | `street.test.ts` «an unavoidable contact ahead…», «hitting a car…» |
| leve k (detención innecesaria) | 1 s detenido sin motivo a 8/12/15/30 m | protocolo PDF 16, 23 | `stop-n` | `circulation.test.ts` «scores crawling… stopping for nothing» |
| leve l (mínima) | < 10 km/h 8 s con la vía libre | protocolo PDF 16, 23–24 | tramo | ídem |
| leve m (bocina) | toque sin conflicto a 15 m | protocolo PDF 16, 24 | `horn-n` | `circulation.test.ts` «the horn» |
| leve n (reductor) | > 20 km/h sobre el lomo | protocolo PDF 16, 24 | reductor | `circulation.test.ts` «speed bump…» |
| leve o (precautoria) | > 20 km/h sin frenar a 15 m de una senda ocupada | protocolo PDF 16, 24 | senda | `circulation.test.ts` «pedestrians and cyclists» |
| toma de control (D7) | frenado necesario > 7 m/s² | protocolo PDF 7 | — | `circulation.test.ts` «the examiner takes the dual controls»; `street.test.ts` ídem |
| vuelta limpia | ocho tramos con tránsito, semilla 1, sin fallas, etapa II completa | protocolo PDF 10–12 | — | `street.test.ts` «a lawful lap of the eight legs…» |

**No se evalúa** (y por qué): baja f (dos manos: no hay modelo de manos ni volante físico), elim m (dispositivos: no existen en el habitáculo), elim e (autoridad de tránsito: no hay agentes), la omisión de bocina (no hay modelo de «peligro que exigía bocina»), leve g y bajas b/c (como en F03-T04), y el carril de giro alta n no tiene caso con guion porque el recorrido gira siempre hacia el lado del carril del trazado.

**Conductor de prueba** (`src/test/circuitDriver.ts`): seguimiento de trayectoria sobre `lap` que respeta semáforos, PARE, prioridades, sendas, 2 s, ambulancia, esquinas y direccionales; cada comportamiento se puede apagar para producir el caso con falla. `examDriver.ts` mide los 30 cm y la salida en el marco de la pose inicial, avanza el tránsito genérico y se puede clonar para ramificar escenarios. El cajón del tramo 1 es el de F04-T01: sin postes, por eso d/alta d del cajón no se prueban en la ciudad.

**Límites**: el examinador no evalúa la cola del auto sobre una senda (solo el frente); las aproximaciones de los actores a la ambulancia no existen; los umbrales están calibrados con la semilla 1 y el conductor de prueba, no con conductores reales; la vuelta limpia tarda unos 360 s simulados.

## Estacionamiento y descenso (F04-T04)

Al volver al tramo 1 tras el tramo 8, la etapa II queda completa y la sesión entra en la fase `parking` (ya no en `finished`): el estacionamiento paralelo en el cajón de Quesada, la posición final y el descenso (protocolo PDF 13, 24–25, 27, 29–30, 33). Con las tres etapas completas, `resultOf` aprueba con 7 puntos o menos (PDF 14). Las decisiones de este alcance son D10–D14 y V3 de REGLAS.md §7, resumidas en §9.

- **Cajón** (`src/exam/circuit.ts`, `ParkingBay`): derivado de la ciudad, nunca de coordenadas fijas: centro y rumbo de `city.start.pose`, largo de las marcas de `city.world.markings` (6 m, protocolo PDF 21), borde del cordón desde el ancho de la calle del tramo 1 (`kerbLeftM`, −1,075 m en el marco del cajón) y distancia de vuelta de su línea delantera (`frontS`) para el aviso de 100 m. Las **marcas** (`lines`) son el tramo de cada línea pintada desde el cordón hasta 1,2 m hacia la calzada (`MARKER_REACH_M`): hacen de vallas (D13).
- **Juez** (`src/exam/parking.ts`): funciones puras sobre el marco del cajón (`bayFrame`: metros a lo largo del cordón desde el centro y a la izquierda de la línea central). `judgeParkingStep` corre por paso fijo durante la fase `parking`: balizas, alineación en doble fila, maniobras, intentos, mirada durante la marcha atrás, marcas y distancia viva al cordón (`kerb`, cuando está detenido dentro del cajón). `judgeFinalPosition` corre cuando el aspirante avisa con el auto detenido (`ready` en `parking` deja `endRequested`; el paso siguiente lo juzga): `kerbDistancesCm` mide el lado derecho de la carrocería a cada eje contra el borde del cordón, `parkingBands` de `rules.json` clasifica cada eje (V1), y la inclinación y el centrado consignan la leve s. `judgeDescent` corre una vez cuando se abre la puerta: caja, freno de mano, luces, motor y llave, espejo izquierdo. Los umbrales están en `PARKING`; una prueba comprueba que coinciden con los `parameters` del catálogo (3 s, 3 maniobras, 2 intentos, 30 cm) y con `markerKnockSpeedMps` de la etapa I.
- **Sesión** (`session.ts`): fases `parking` → `leaving` → `finished`; `Session.parking` lleva el estado del juez y `Session.bands`, las franjas del catálogo (`createSession(rules, kind, seed, circuit, bands)`). Los eventos del auto (contacto con el cordón, calado, arranque con el motor en marcha, freno de mano) se juzgan en las etapas II y III. Las miradas de la cabina alimentan `noteParkingLook` (espejo lateral o cabeza atrás) y `noteDescentLook` (solo el espejo izquierdo, X7). Quitarse el cinturón en `parking` es la eliminatoria c; en `leaving` no. La puerta es un `toggle` nuevo del habitáculo (`door`), con tecla `G`, botón «Abrir la puerta y bajar» junto a la llave y el freno de mano, y no responde a ninguna pregunta del reconocimiento.
- **Aviso de 100 m** (`circulation.ts`, `Street.parkingAheadM`): en el último tramo, a 100 m o menos de la línea delantera del cajón, el examinador dice que van a estacionar; la página lo agrega a la indicación y el HUD muestra la distancia (D10).
- **Tránsito** (extensiones mínimas de F04-T02, `traffic.ts`): a menos de 25 m del cajón, los actores que vienen detrás del auto a menos de 2,5 m/s dejan 8 m en vez de 3 y, si el auto retrocede hacia ellos, esperan donde están (`parkingBayAt`, `ROOM_BEHIND_CAR_M`); los demás vehículos (de frente o cruzando en una esquina) leen la velocidad del auto como antes, para no trabar las esquinas. Ningún peatón baja del cordón delante del auto que arranca a menos de 6 m de la senda (antes solo a menos de 15 m y más de 1 m/s). Las tres son aproximaciones del juego.
- **Página**: botón «Terminé de estacionar» en la fase `parking` (ignorado en movimiento, el título lo dice); HUD con «Estacionamiento» (cajón a N m mientras se acerca; después maniobras e intentos), «Distancia al cordón» (adelante/atrás, viva al detenerse en el cajón y la medida final) y, en `leaving`, la lista «Para bajar» con el espejo izquierdo marcado al mirarlo; resultado «Aprobado con N puntos» o «Desaprobado». Copia solo en `src/i18n/es-AR.ts`.

| Regla | Criterio (juego) | Fuente | Episodio | Prueba |
|---|---|---|---|---|
| aviso 100 m | en el tramo 8, a ≤ 100 m de la línea delantera del cajón (D10) | protocolo PDF 24 | — | `parkingStreet.test.ts` «announces the parking 100 m before…» |
| baja i (balizas) | encendidas ≥ 3 s seguidos antes de la primera detención en la zona (D11) | protocolo PDF 13, 17, 27 | control único | `parking.test.ts` «exactly 3 s… 2,9 s or never»; `parkingStreet.test.ts` «hazards switched on less than 3 s…» |
| leve r (maniobras) | la cuarta maniobra (D12) | protocolo PDF 13, 17, 24–25 | una vez | `parking.test.ts` «a forward nudge… a fourth manoeuvre»; `parkingStreet.test.ts` «…a fourth manoeuvre, the minor one» |
| elim q (intentos) | el tercer intento (D12), interrumpe | protocolo PDF 13, 17, 33 | una vez | `parking.test.ts` «pulling out of the bay…»; `parkingStreet.test.ts` «a second attempt costs… a third attempt eliminates» |
| alta p (espejos) | sin espejo lateral ni cabeza atrás entre la alineación y el fin de la marcha atrás | protocolo PDF 13, 17, 29–30 | `attempt-n` | `parking.test.ts` «scores the reverse done without a glance…»; `parkingStreet.test.ts` «reversing without a glance…» |
| alta d / elim d (marcas) | pisar el tramo de la línea junto al cordón a < 1 m/s / ≥ 1 m/s (D13) | protocolo PDF 15, 17, 28, 30–31 | cada vez / una vez | `parking.test.ts` «touching a line slowly…»; `parkingStreet.test.ts` «backing fast into the rear marker…» |
| leve i / elim d (cordón) | contacto con el cordón a < 1 m/s / ≥ 1 m/s, mismo evento que la etapa I | protocolo PDF 15, 17, 23, 30 | cada vez / una vez | `session.test.ts` «scraping the kerb…», «hitting a post at speed or mounting the kerb…» (evento compartido) |
| leve t / leve u / elim r (franjas) | cada eje por `parkingBands`: < 15 t; [15, 25] bien; (25, 50] u; > 50 r (V1) | protocolo PDF 13, 17, 21, 25, 33 | una vez cada una | `parking.test.ts` «is correct between 15 and 25 cm inclusive…», «measures each axle…»; `parkingStreet.test.ts` «ends on the second band…» |
| leve s (inclinada/descentrada) | ejes a > 30 cm entre sí, o centro a > 0,5 m del centro del cajón (V3) | protocolo PDF 13, 17, 25 | una vez | `parking.test.ts` «measures each axle…», «is off-centre beyond 0,5 m…»; `parkingStreet.test.ts` «ending more than 0,5 m off…» |
| leve w (N/P) | al abrir la puerta, caja fuera de N (manual) o P (automática) | protocolo PDF 13, 17, 25 | control único | `parking.test.ts` «scores each omission once…»; `parkingStreet.test.ts` «manual: gearbox left in gear…» |
| leve x (freno de mano) | al abrir la puerta, sin freno de mano | protocolo PDF 13, 17, 25 | control único | ídem |
| leve v (luces bajas) | al abrir la puerta, luces en bajas o altas (posición vale) | protocolo PDF 17, 25 | control único | ídem |
| leve y (motor, llave, dirección) | al abrir la puerta, motor en marcha o llave puesta (D14) | protocolo PDF 13, 17, 25 | una vez | `parking.test.ts` ídem; `parkingStreet.test.ts` «automatic: opening the door with the engine running…» |
| baja j (mirar antes de bajar) | sin mirada al espejo izquierdo antes de abrir la puerta (X7) | protocolo PDF 13, 17, 27 | control único | `parking.test.ts` «only the left mirror counts…»; `parkingStreet.test.ts` «not looking at the left mirror…» |
| elim c (cinturón) | quitárselo durante la maniobra | protocolo PDF 10, 15, 30 | una vez | `parkingStreet.test.ts` «taking the belt off while parking…» |
| examen completo | vuelta + estacionamiento + descenso, 0 puntos, aprobado, manual y automática | protocolo PDF 13–14 | — | `parkingStreet.test.ts` «a clean exam parks in three manoeuvres…» (×2) |

**Casos frontera comprobados** (`parking.test.ts`): 15, 25 y 50 cm exactos (bien, bien, segunda franja); 14,9, 25,1 y 50,1; 30 cm exactos entre ejes (no inclinada) y 30,5; 0,5 m exactos de descentrado (bien) y 0,51; balizas 3 s exactos (bien), 2,9 s, nunca y con un corte; tres maniobras exactas y la cuarta; dos intentos exactos y el tercero; marca pisada a 0,99 y a 1 m/s; puerta abierta con el motor en marcha o con la llave puesta; espejo derecho o giro de cabeza en vez del izquierdo.

**Conductor de prueba** (`src/test/circuitDriver.ts`): `stopInDoubleFile` (balizas, crucero lento a 0,5 m a la derecha de la línea de la vuelta hasta el punto de inicio de la curva S calculado desde el desplazamiento lateral real, mirada al espejo derecho), `parkInTheBay` (dos arcos a tope en marcha atrás con una pausa para cambiar de tope, abortos y reintentos, posicionamiento hacia adelante), `nudge`, `reverseHard` y `descend` (cada paso del descenso se puede omitir). El conductor manual ganó primera y segunda, embrague pisado al detenerse, salida al punto de acople, velocidad en curva acotada por aceleración lateral y espera en el PARE hasta que nadie llegue por la derecha; ambos ceden a los peatones en el cordón, esperan ante una senda de salida ocupada y no se detienen dentro del cruce por alguien que recién llega.

**Límites**: el cajón no tiene vallas físicas (las marcas no detienen el auto); el roce del cordón durante la maniobra no tiene caso con guion (el colisionador frena el auto y el guion no lo modela), solo el evento compartido con la etapa I; el `ready` en movimiento se ignora sin consignar nada; los actores no retroceden para hacer lugar; los umbrales están calibrados con la semilla 1.


## Modos, recorrido completo y ficha (F04-T05)

`#/examen` tiene cuatro modos, elegidos antes de empezar y llevados en la consulta del hash (`#/examen?modo=rendir`, `#/examen?modo=practicar&etapa=3`), así los enlaces del inicio y el botón de atrás los reproducen; sin parámetro rige `recorrer`. Son los modos del contrato `Attempt` (`ATTEMPT_MODES`) menos `review`, que es la bitácora. Qué ayuda muestra cada modo es la decisión D15 de REGLAS.md §7: lo que el examinador dice en voz alta (la consigna de cada fase, la indicación de la próxima esquina, el aviso de los 100 m, el tramo actual como sustituto del cartel de la calle) se ve siempre; lo que el aspirante debe saber solo es una ayuda.

| Modo (`DrivingMode`) | Ayudas visibles (`aidsOf`) | Puntaje | Persistencia |
|---|---|---|---|
| `learn` (aprender) | todas: puntos y fallas en vivo, aviso del control (`notice`), límites de examen y de la vía, mediciones del cajón, semáforo, maniobras/intentos, distancia al cordón, lista «Para bajar», más `hints` (qué regla y umbral evalúa cada fase, qué tecla usar) y `explanations` (cada falla explicada al momento con la condición y el PDF) | se registra y se muestra; sin consecuencias | no se guarda (`isPersisted` = false) |
| `practice` (practicar) | las ayudas del tablero, sin `hints` ni `explanations` | una sola etapa; `resultOf` queda `pending` | se guarda con `scope` de una etapa |
| `run` (recorrer) | las ayudas del tablero | tres etapas seguidas, puntos en vivo, resultado al final | se guarda |
| `exam` (rendir) | ninguna: solo tramo, próxima indicación y lo que dice el examinador; el texto «los puntos y las fallas se informan al final» lo recuerda | puntos, fallas y ficha solo al terminar | se guarda |

La interrupción y la toma de control (D7) funcionan igual en los cuatro modos: `halted` frena el auto siempre.

- **Sesión** (`src/exam/session.ts`): `Session.scope` (`{ from, to }`, etapas que corre la sesión) y `Session.transitions` (cada fase entrada con su `timeS`, la inicial incluida). `createPracticeSession(rules, kind, seed, circuit, bands, stage)`: la etapa I es la sesión normal que termina al completar la preparación; la II empieza en `unlock` (en el cajón, motor apagado, llave puesta: la salida es parte de la etapa); la III empieza en `circulation` sobre el último tramo (`leg` 8, `legsEntered` 7, instrucción y calle del tramo), con `movedOff` (no rigen el cinturón al arrancar ni el corte de 8 puntos, propios de la etapa II) y con la primera detención ya juzgada (`stopJudged`), para que esperar parado al empezar no sea una detención innecesaria. Una etapa se marca completa solo si está dentro del alcance (`completeStage`): practicar la III no completa la II al terminar la vuelta. Cada falla lleva su etapa (`Fault.stage`, asignada al consignarla por la fase actual): el instante solo no alcanza, porque las fallas de la preparación se consignan en el mismo `timeS` en que la sesión pasa a `unlock`, y los pasos con `dt` 0 (comandos) comparten tiempo con el siguiente. Las transiciones dan la duración y el estado de cada etapa.
- **Posición y arranque de la práctica** (`src/exam/modes.ts`): `startPoseFor(city, stage)` usa `entryPose(city, 8)` para la etapa III (18 m dentro de Vuelta de Obligado, carril derecho; 273 m de tramo, así el aviso de los 100 m llega después) y `city.start.pose` en los demás casos; `preparedFor(stage)` deja la llave en contacto, y en la etapa III además el motor en marcha (el auto queda en P o N con el freno de mano puesto: el aspirante pone D o primera y lo suelta). El tránsito se siembra como siempre con la semilla.
- **Ficha** (`src/exam/card.ts`, `buildCard(session)`): una `StageCard` por etapa I, II y III con `inScope`, `completed`, `startedAtS`/`endedAtS` (de las transiciones), las fallas de esa etapa con su regla y el subtotal; `points` total; `result` (`resultOf`, o `pending` si la sesión no terminó) y `verdict`: `approved` con puntos; `disapproved` por `interruption` (causa y regla, PDF 7–10), por `eliminatory` sin interrupción (l, m, n, o, p, r; PDF 32–33) o por `over-points` (≥ 8, PDF 14); `pending` cuando faltan etapas. La vista (`ExamCardView.tsx`) muestra por falla la conducta de la ficha, los puntos, el instante, la condición evaluada y los enlaces `/biblioteca/protocolo/<página>`, y debajo el texto de aproximaciones del juego (`EXAM_COPY.approximations`) como «aproximaciones que pudieron influir».
- **Intento de manejo** (`src/progress/model.ts`, `createDrivingAttempt({ session, mode, subjectId }, { id, contentVersion, startedAt, finishedAt })`): `Attempt` con `kind: 'driving'`, `subjectId` `route.<id del recorrido>` (`route.comuna13-a`), `mode`, `startedAt` (reloj de pared al empezar) y `finishedAt` (la hora monótona del almacén), `events` (`start` con transmisión, semilla y alcance; `phase` por transición; `stage-completed` por etapa; `interruption` con causa y regla; `finished` con resultado, puntos y etapas), `faults` (`ruleId`, `at` = inicio + `atS`, `points`) y `result` (`points` del libro; `correct` true si aprobado, false si desaprobado, null si pendiente; `score` null). Todo instante se acota al intervalo del intento, así una pestaña lenta o un reloj corregido nunca dejan una falla fuera de él (el esquema lo exige). El proveedor expone `recordAttempt(build)` (cola, hora monótona, recarga y aviso a las otras pestañas, como las respuestas); la página lo llama una vez al pasar a `finished` en los modos persistentes. Salir de la página a mitad del examen no guarda nada.
- **Bitácora** (`src/progress/logbook.ts`, `drivingLog`): los intentos `driving`, del más nuevo al más viejo, con modo, etapas completas (del evento `finished`, validado con Zod; si falta o está dañado, ninguna), puntos y resultado (de `result.correct`); `DrivingSection.tsx` los lista con fecha. Los intentos de actividad no cambian: `recentErrors` y `recommendedReview` ya filtraban por `kind`. El respaldo valida los intentos de manejo con `attemptErrors` (puntos de cada falla y total coherentes).
- **Inicio**: sección «Al volante» con la pista (`#/pista`), el recorrido libre (`#/recorrido`), el examen (`#/examen`) y un enlace por modo.
- **Navegación durante una conducción** (corrección en `DrivingCanvas`, encontrada al probar el selector de modos en el navegador): React Router renderiza cada navegación dentro de una transición, y las lecturas del tablero (`setReadout` y la telemetría, cada 0,1 s o cada cuadro lento) eran actualizaciones urgentes que la interrumpían una y otra vez: con el motor 3D en marcha, ni cambiar de modo ni salir de `#/examen` o de `#/recorrido` por el menú llegaba a renderizarse (se comprobó con Playwright sobre la ciudad sin tocar). Ahora las lecturas se emiten con `startTransition`, así se agrupan con la navegación en vez de bloquearla; el E2E «can leave the exam page through the navigation while the drive is running» lo protege.

**Límites**: el modo aprender explica las reglas con texto fijo por fase (`learnHints`), no con un análisis de la situación; la práctica de la etapa II empieza con las comprobaciones de la cabina en cero (el cinturón y las luces se exigen igual que en el examen completo); la práctica de la etapa III empieza con la cabina en cero (sin cinturón ni luces: quitárselo no puede consignarse porque nunca estuvo puesto) y el aspirante debe poner la marcha y soltar el freno de mano; en `rendir` el tramo actual sigue visible porque la ciudad no tiene carteles con nombres de calle; las ayudas se ocultan en la interfaz, no en la sesión (la sesión es la misma en los cuatro modos). No hay repetición ni reintento (F06-T01).
