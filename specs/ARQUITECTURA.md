# Arquitectura de la aplicación

Fecha: 2026-10-11 (F02-T01). Documento vivo: cada tarea que cambie estructura, dependencias o convenciones lo actualiza.

Concreta la arquitectura de `PROPUESTA.md` §8 para el código. Este documento describe lo que ya está implementado; lo que llega en tareas posteriores se marca como «planificado».

## Pila y versiones

Todas las dependencias están fijadas con versión exacta en `package.json` y `package-lock.json`. Criterio de elección (F02-T01): la versión más reciente de su línea con **al menos dos semanas publicada** y compatible con el resto.

Las fechas de publicación salen del registro de npm (`npm view <paquete> time`) y, para Node.js, de `https://nodejs.org/dist/index.json`. Se verificaron el 2026-10-11, así que el límite era el 2026-09-27.

| Paquete | Versión | Publicada | Uso |
|---|---|---|---|
| Node.js | 24.21.0 (`.nvmrc`; `engines` ≥ 24.15.0) | 2026-09-07 | Desarrollo, pruebas y CI. El mínimo sale de jsdom 30.1.1 y tres dependencias suyas (`^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`). |
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
  content/                 Esquemas (Zod), validación referencial, versión, cobertura y carga de catálogos.
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
   - `attemptErrors` (`validateAttempt.ts`) valida un intento contra las reglas: faltas de reglas conocidas con sus puntos, total coherente y ninguna falta en intentos de actividades.

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
- **Persistencia** (`src/progress/storage.ts`): IndexedDB, base `al-volante` (versión 2), almacenes `attempts`, `concepts` y `quarantine`.
  - Cada respuesta se escribe en una sola transacción, que lee el valor guardado de cada concepto y calcula el nuevo dentro de ella. Así, una pestaña nunca pisa el progreso más nuevo que escribió otra. Si algo falla, la transacción se aborta y no queda nada a medias.
  - Las migraciones de la base van en `upgrade`, una rama por versión (`DB_VERSION`). La versión 2 agregó `quarantine`.
  - Al cargar, cada registro se valida con Zod. Los ilegibles se mueven a `quarantine` exactamente como estaban (almacén, clave y valor), en la misma transacción, y la bitácora avisa cuántos hay. Nunca se borran, y una práctica posterior del mismo concepto tampoco los pisa: si otra pestaña dejó un registro ilegible, también se aparta antes de escribir.
  - Si IndexedDB no está disponible (algunos modos privados), se usa memoria y la bitácora avisa que el progreso no va a durar.
  - `ProgressProvider` encola las respuestas detrás de la carga: una respuesta dada mientras carga se guarda cuando la carga termina, y si la carga falla, se guarda igual y aparece al reintentar.
  - Otra pestaña ve las respuestas nuevas al recargar; las escrituras no pierden datos, pero la vista no se sincroniza en vivo.
- **Respaldo** (`src/progress/backup.ts`): JSON autodescriptivo con `format`, `formatVersion`, `exportedAt` y `contentVersion`.
  - Al importar, primero se valida todo, incluidas las migraciones de formato una versión por vez, los ids duplicados y la coherencia de cada concepto: no más aciertos que intentos, una caja que no supere los aciertos y un próximo repaso dentro del intervalo de la caja (exactamente un día después de un error).
  - Después se pide confirmación, y recién entonces se reemplaza el progreso en una sola transacción.
  - Un archivo inválido, demasiado grande (más de 20 MB) o ilegible, o una escritura que falla, dejan el progreso actual intacto.

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
