# Continuidad del proyecto

Actualizado: 2026-10-11. Estado: fases 1 y 2 fusionadas; F03-T03 en curso. Avance por tarea y PR en `ESTADO_IMPLEMENTACION.md`; detalle de la fase 1 en `historial/FASE-1.md`.

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

T03 incorpora interior procedural, cámara desde el conductor, espejos por reflexión de la escena, tablero y volante animados, preparación e instrumental, mirada, teclado reasignable persistente y mandos en pantalla. Detalles y límites en ARQUITECTURA. Las revisiones y la validación final se registran en ESTADO_IMPLEMENTACION.

Los dos findings tardíos de #16 (pulsaciones entre cuadros y suavizado de la cámara exterior) no se declaran resueltos por esta tarea. El usuario pidió descartar el correctivo local y pasar a T03. La vista nueva usa cámara interior sin suavizado; el muestreo de pedales conserva el adaptador de T02. No se implementó el motor de evaluación ni el primer cruce.
