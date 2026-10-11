# Plan de implementación por fases y PRs

Fecha: 2026-10-11. Propuesta de producto aceptada por el usuario. Fase 1 cerrada y fase 2 iniciada el 2026-10-11; estado vivo en [ESTADO_IMPLEMENTACION.md](ESTADO_IMPLEMENTACION.md).

Este documento concreta la ejecución de [PROPUESTA.md](../PROPUESTA.md). Cada tarea numerada corresponde a **un PR de GitHub**. Los identificadores siguientes son identificadores de planificación, no números de PR creados.

## 1. Control de inicio y autonomía

- El usuario inicia cada fase de forma explícita, por ejemplo: «iniciá la fase 1».
- Aprobar la propuesta o este plan no inicia una fase. Finalizar una fase tampoco autoriza la siguiente.
- **Modo de trabajo por fase (indicado por el usuario el 2026-10-11):** al iniciarse una fase, el modelo implementa y crea **todos los PRs de la fase**, uno por uno, en el orden indicado y apilados. **No espera las revisiones ni la fusión de un PR para crear el siguiente.** Cuando la fase tiene todos sus PRs creados, comienza la etapa de revisión, en la que el usuario y el modelo repasan juntos los findings de los agentes revisores.
- Cada PR se implementa completo antes de pasar al siguiente. No delegar implementaciones paralelas ni crear PRs vacíos o provisionales para reservar lugar.
- En la etapa de revisión, el modelo corrige los findings aceptados y puede fusionar cada PR, en el orden de la pila, cuando cumpla los criterios de fusión de este documento y las protecciones del repositorio lo permitan.
- Al cerrar una fase, entregar resumen, enlaces a PRs, evidencia de validación, limitaciones y estado de continuidad; esperar la indicación manual para iniciar otra.
- Una corrección necesaria de una tarea pertenece a su PR. Si ya se fusionó, abrir un PR correctivo identificado como `Fxx-Tyy-FIXnn`, con el mismo flujo. No aprovechar correcciones para iniciar trabajo de otra fase.
- No fusionar todos los cambios en un único PR ni sustituir los PRs por commits directos a la rama principal.

## 2. Flujo obligatorio de cada fase y de cada PR

Una fase tiene dos etapas consecutivas.

**Etapa A — Creación.** Para cada tarea, en orden, ejecutar los pasos 1–6 y pasar enseguida a la tarea siguiente. Las revisiones externas corren en segundo plano y no se esperan. Al crear el último PR, entregar al usuario la lista de PRs, la pila y el estado de las revisiones solicitadas.

**Etapa B — Revisión de findings.** Con todos los PRs creados, recorrer la pila desde la base y ejecutar los pasos 7–9 en cada PR, junto con el usuario. Esperar o volver a pedir las revisiones que todavía no terminaron.

1. **Preparar:** leer instrucciones aplicables, specs, estado de fase y dependencias; definir alcance y aceptación. Crear una rama de tarea sobre la rama del PR anterior de la fase (o sobre `main` para la primera tarea; ver §3).
2. **Implementar:** cambios, documentación y verificaciones proporcionales a su riesgo. Mantener los cambios revisables y acotados a la tarea.
3. **Autorrevisar antes de commit y push:** el modelo autor revisa el diff completo frente a los requisitos, fuentes, posibles regresiones y pruebas. Corrige sus findings y vuelve a revisar los cambios corregidos. Esta revisión es obligatoria, aunque no quede presupuesto para revisores adicionales.
4. **Commit y push:** solo después de la autorrevisión. Todo commit posterior de corrección repite el paso anterior antes de publicarse.
5. **Crear PR:** descripción completa con problema, comportamiento resultante, validación, dependencias, orden de fusión, estado de revisiones y limitaciones.
6. **Solicitar revisión por Codex y CodeRabbit** y continuar con la siguiente tarea sin esperar el resultado: solicitar ambas, siempre que haya presupuesto/tokens disponibles para cada servicio. Codex será una revisión adicional y diferenciada de la autorrevisión; si el autor es Codex, su autorrevisión no cuenta como ambas. Usar la integración o sesión de revisión disponible y registrar el mecanismo utilizado. La revisión adicional por un agente está autorizada para este fin; no implica implementación paralela de tareas.
7. **Resolver findings (etapa B):** revisar con el usuario los findings de cada PR, evaluar cada hallazgo, corregir los aceptados y justificar con evidencia los descartados o no aplicables. Ante desacuerdo no esconder el hallazgo. Corregir en la rama del PR afectado, actualizar los descendientes de la pila (§3), revalidar lo afectado y pedir nueva revisión cuando los cambios o las observaciones lo requieran y haya presupuesto.
8. **Decidir y fusionar (etapa B):** fusionar en el orden de la pila, comprobando criterios de fusión, dependencias y último estado de checks/revisiones. El modelo puede fusionar si concluye que el resultado es correcto. No eludir reglas de protección ni checks obligatorios de GitHub.
9. **Registrar:** en `ESTADO_IMPLEMENTACION.md`, enlace/número del PR, commits relevantes, estado de revisiones, findings, comprobaciones y estado final. En la etapa A se registra al crear cada PR; en la etapa B, al resolver y fusionar.

### Tokens y excepciones de revisión

La condición «siempre y cuando no se acaben los tokens» aplica a las revisiones adicionales por Codex y CodeRabbit. Intentar ambas; no omitirlas por comodidad. Si se agota la cuota o el presupuesto de una, usar la otra si sigue disponible.

Registrar el estado por revisor: `pendiente`, `solicitada`, `completada`, `omitida por tokens agotados` o `bloqueada por integración`. Anotar evidencia de cuota/error o límite de sesión conocido; no inventar disponibilidad ni declarar una revisión realizada sin resultado.

La falta de integración no equivale a tokens agotados: intentar el mecanismo disponible, documentar el impedimento y resolverlo. Si no hay alternativa, dejar el PR pendiente e informar el bloqueo; no ampliar automáticamente la excepción del usuario.

Si se agotan tokens de revisión, se permite fusionar con la excepción explícitamente registrada, autorrevisión completa, verificaciones suficientes y sin findings aceptados pendientes. Si el modelo no tiene presupuesto para evaluar y cerrar de forma fiable, dejar el PR en borrador/pendiente y actualizar continuidad. Nunca fusionar solamente para terminar antes de agotar contexto.

### Criterios de fusión

- Alcance y criterios de aceptación satisfechos; documentación actualizada.
- Autorrevisión realizada antes de cada commit/push.
- Revisiones de Codex y CodeRabbit completadas sobre cambios vigentes, o excepción de tokens documentada individualmente.
- Todos los findings recibidos tienen resolución: corregido y verificado, o descartado con fundamento. No diferir silenciosamente findings aceptados a otra fase.
- Checks obligatorios en verde, validaciones relevantes realizadas y fallas explicadas/resueltas.
- Dependencias fusionadas, rama/base actualizadas y diff final limitado a la tarea.
- No quedan solicitudes de cambios o protecciones pendientes que impidan fusionar.
- El modelo registra una conclusión de que el PR está listo. La aprobación de un bot por sí sola no reemplaza ese juicio.

## 3. PRs apilados y orden

Los PRs de una fase se crean uno a uno durante la etapa A, sin esperar la fusión del anterior. Por eso, dentro de una fase, cada tarea crea su rama **sobre la rama del PR anterior** y abre el PR apuntando a esa rama; así su diff contiene solo su tarea y las dependencias quedan explícitas. La primera tarea de la fase parte de `main`.

Si al crear una tarea su predecesor ya fue fusionado, crear la nueva rama desde la principal actualizada; no mantener una pila artificial. Las dependencias de fases anteriores deben estar fusionadas al iniciar la nueva fase.

Ejemplo:

```text
main ← F03-T01 ← F03-T02 ← F03-T03
       fusionar 1, después 2, después 3
```

En cada PR apilado debe constar:

> PR apilado sobre #ANTERIOR. Orden obligatorio: #PR1 → #PR2 → #ACTUAL. Solo puede fusionarse cuando todos sus predecesores estén correctamente apilados y hayan sido fusionados en ese orden. No fusionar directamente ni fuera de secuencia. Después de fusionar el predecesor, actualizar la base, comprobar el diff y repetir los checks afectados.

La condición de apilado no sustituye la de fusión: para integrar un descendiente a la principal, sus predecesores deben estar integrados primero. Tras un squash/rebase del padre, reaplicar únicamente los commits propios sobre la nueva base; verificar que no se reintroduzcan commits o cambios de ancestros. No usar push forzado indiscriminado; si es necesario para una rama propia, emplear `--force-with-lease` y respetar las reglas aplicables.

Si un padre cambia por revisión, actualizar descendientes en orden, comprobar sus diffs y repetir la validación afectada. Si un padre queda bloqueado, los descendientes no se fusionan. En dependencias múltiples, esperar a que las bases necesarias estén integradas o apilar sobre un descendiente que ya las incluya; no mezclar ramas ajenas improvisadamente.

## 4. Fases y tareas

Las dependencias listadas son requisitos de integración. Dentro de cada fase, ejecutar las filas en orden. Las cifras de examen que aparecen en los criterios (7/8 puntos, 30 cm, 30/45 km/h, maniobras/intentos) se citan en PROPUESTA §5 y se transcriben y verifican en `REGLAS.md` (F01-T03); ese documento prevalece. Toda tarea incluye documentación del cambio y el flujo de revisión anterior.

### Fase 1 — Fuentes, cobertura y recorrido verificado

Objetivo: establecer qué enseñar, cómo evaluar y qué calles construir antes de convertir suposiciones en código.

| Tarea / PR | Trabajo | Depende de | Aceptación |
|---|---|---|---|
| F01-T01 | Preparar repositorio, incorporar propuesta/plan/continuidad, plantilla de PR y registro de ejecución. Confirmar rama principal y mecanismos Codex/CodeRabbit. | — | Repo y remoto identificados; docs versionadas; flujo de revisión operable o impedimentos explícitos. |
| F01-T02 | Auditar manual completo y guía, incluidas figuras y señales; crear `COBERTURA.md` y catálogo de unidades con páginas y categorías. | T01 | Cada página clasificada; cada unidad instructiva identificada; separación B/complementos; fuentes y discrepancias registradas. |
| F01-T03 | Transcribir protocolo completo a `REGLAS.md`: etapas, fallas, excepciones, repetición, interrupción y parámetros del teórico con verificación de fuentes oficiales. | T02 | Ficha y anexo reconciliados; límites/casos frontera documentados; diferencias de edición resueltas o bloqueo localizado y explícito. |
| F01-T04 | Elaborar `RECORRIDO.md` y datos cartográficos: georreferenciar A, resolver Cuba–Quesada–Cuba, verificar sentidos, cruces y señalización relevante; registrar licencias y atribución. | T03 | Trazado conducible contrastado con fuentes; maniobras inequívocas; geometría métrica; ninguna aproximación crítica presentada como verificada. |

Cierre: inventario auditable, reglas completas y recorrido validado. Una ambigüedad que afecte la circulación/evaluación impide dar esta fase por cerrada; el resto del trabajo independiente puede avanzar dentro de la fase.

### Fase 2 — Base web, datos y aprendizaje inicial

Objetivo: aplicación ejecutable, datos validados y primer ciclo de aprendizaje persistente.

| Tarea / PR | Trabajo | Depende de | Aceptación |
|---|---|---|---|
| F02-T01 | Inicializar TypeScript/Vite/React/Three.js, estructura, versiones fijadas y CI para build, tipos y validaciones necesarias. | F01 completa | Arranque documentado, escena Three.js visible y checks reproducibles. |
| F02-T02 | Implementar esquemas y validadores de fuentes, unidades, actividades, reglas, escenario e intentos; cargar catálogos de fase 1. | T01 | Referencias huérfanas y datos inválidos detectados; versiones y cobertura trazables. |
| F02-T03 | Construir navegación, inicio/garaje, biblioteca, mapa de aprendizaje e interfaz accesible y adaptable. | T02 | Flujo navegable con teclado, estados de carga/error y fuentes consultables por página. |
| F02-T04 | Implementar motor de actividades con una muestra representativa: elección, ordenar prioridades, señales y decisiones; explicar aciertos/errores. | T03 | Actividades evaluables, feedback con fuente y variantes coherentes; aún no declarar campaña completa. |
| F02-T05 | Implementar progreso por concepto, bitácora, repaso espaciado, IndexedDB y respaldo/importación versionada. | T04 | Progreso persiste al reiniciar; respaldo restaura datos; datos corruptos no destruyen progreso existente. |

Cierre: un usuario puede estudiar, resolver, consultar fuentes y retomar una sesión; base preparada para todo el contenido.

### Fase 3 — Auto e interior: primer tramo jugable

Objetivo: conducción real en primera persona, preparación y salida del cajón hasta un cruce funcional.

| Tarea / PR | Trabajo | Depende de | Aceptación |
|---|---|---|---|
| F03-T01 | Implementar simulación a paso fijo, vehículo, dirección, frenado y colisiones; calibrar baja velocidad y escala. | F02 completa | Movimiento independiente de FPS dentro de tolerancias documentadas; colisiones y distancias comprobables. |
| F03-T02 | Implementar caja manual/automática, embrague, punto de acople, calado, reversa, llave y freno de mano. | T01 | Procedimientos y restricciones del protocolo reproducibles en ambas transmisiones. |
| F03-T03 | **Autor: GPT-6 Astra (`gpt-6-astra`).** Construir habitáculo, tablero, volante, espejos funcionales, mirada, ajustes, cinturón e instrumental interactivo; controles configurables. Revisar interior, proporciones, tablero y espejos en navegador mediante capturas y pruebas de controles. | T02 | Comandos afectan al estado simulado; espejos muestran actores reales; controles usables y legibles. |
| F03-T04 | Implementar motor de evaluación, familiarización, etapa I, desplazamientos de 30 cm y salida; registrar eventos y faltas. | T03 | Secuencia completa comprobable, reglas de repetición/interrupción y puntuación verificadas para este alcance. |
| F03-T05 | Construir primer tramo real y un cruce con semáforos, vehículo y peatón; integrar conducción, observación y devolución básica. | T04 | Sesión jugable desde preparación hasta cruce; prioridades, giro y detención tienen consecuencias verificables. |

Cierre: demostrar en navegador la primera experiencia completa; no considerar este tramo como todo el práctico.

### Fase 4 — Comuna 13 A y examen práctico completo

Objetivo: circuito completo con tránsito y las tres etapas evaluadas.

| Tarea / PR | Trabajo | Depende de | Aceptación |
|---|---|---|---|
| F04-T01 | **Autor: GPT-6 Astra (`gpt-6-astra`).** Extender calles, carriles, veredas, señalización y geometría a todo A; cargar por sectores y contrastar datos con escena. Crear primero una cuadra representativa y un sistema visual reutilizable; extenderlo al circuito validado y revisar en navegador. | F03 completa | Trazado completo, escala y conexiones coinciden con recorrido validado. |
| F04-T02 | Implementar tránsito del circuito: autos, colectivos, peatones y bicicletas, prioridades, semáforos y escenarios por semilla. | T01 | Actores interactúan coherentemente; cruces y tránsito no bloquean indefinidamente una conducción válida. |
| F04-T03 | Integrar examinador y todas las reglas de circulación: primeros metros, velocidades, giros, carril, sobrepaso, emergencias e interrupciones. | T02 | Cada regla del alcance tiene evidencia; distinción entre 30/45 y máxima vial; toma de control cuando corresponde. |
| F04-T04 | Implementar estacionamiento y descenso: cajón, contactos, franjas, maniobras/intentos, apagado y apertura segura. | T03 | Evaluación de ambas transmisiones; casos frontera documentados y comprobados. |
| F04-T05 | Integrar modos aprender/practicar/recorrer/rendir, recorrido entero y ficha final por etapa. | T04 | Tres etapas consecutivas; aprobado solo al completar con hasta 7 puntos; sin ayudas impropias en rendir. |

Cierre: examen completo jugable en A, con reglas transcritas implementadas y comprobadas. Los criterios que el juego solo aproxima se explican al usuario.

### Fase 5 — Todo el contenido y simulacros teóricos

Objetivo: completar el contenido pedagógico del manual y protocolo, sin depender de un banco reducido.

| Tarea / PR | Trabajo | Depende de | Aceptación |
|---|---|---|---|
| F05-T01 | Crear actividades y explicaciones de glosario, introducción, capítulos 1–2 y guía de siniestros. | F04 completa | Todas sus unidades instructivas cubiertas y revisadas contra fuentes; figuras relevantes incorporadas. |
| F05-T02 | Completar capítulo 3 y anexo IV: normas, prioridades, velocidades y catálogo visual íntegro de señales con aplicación contextual. | T01 | Inventario visual reconciliado; señales exactas y legibles; excepciones cubiertas. |
| F05-T03 | Completar capítulos 4–5 y anexo I: capacidades, actitud, seguridad del automóvil y actividades de inspección. | T02 | Cobertura B completa; explicaciones y variantes revisadas; sin unidades omitidas. |
| F05-T04 | Completar anexos II–III y material de consulta del protocolo, incluidos otros circuitos y aspectos no representados en 3D. | T03 | Cobertura completa adicional, categorías claras y páginas no instructivas clasificadas. |
| F05-T05 | Implementar simulacros teóricos balanceados por tema, duración/umbral versionados y diagnóstico por concepto; auditar cobertura global. | T04 | Configuración respaldada por fuentes verificadas; resultados reproducibles; todas las unidades trazadas a actividades/consulta según clasificación. |

Cierre: cobertura total auditable y simulacros disponibles. Dominio personal se distingue de disponibilidad de contenido. Si una tanda resulta demasiado grande, dividirla antes de implementarla en PRs de tareas con sufijos, conservando esta fase y su cierre; documentar el ajuste de plan.

### Fase 6 — Repetición, laboratorio e inmersión

Objetivo: transformar errores en práctica dirigida y completar la experiencia creativa.

| Tarea / PR | Trabajo | Depende de | Aceptación |
|---|---|---|---|
| F06-T01 | Grabar estados/inputs, reproducir intentos y reintentar situaciones con restauración de auto, actores, semáforos y evaluación. | F05 completa | Repetición coherente y reintento desde estado correcto; modo examen conserva sus restricciones. |
| F06-T02 | Construir laboratorio de reacción/frenado, puntos ciegos, cargas y condiciones adversas; escenarios y desafíos didácticos. | T01 | Variables producen consecuencias coherentes y explicadas; escenarios adicionales identificados como entrenamiento. |
| F06-T03 | **Autor: GPT-6 Astra (`gpt-6-astra`).** Integrar voz/subtítulos del examinador, audio espacial, ambiente porteño, fachadas y referencias visuales del barrio. Pulir materiales, iluminación, sombras e identidad porteña con capturas comparables y presupuesto gráfico. | T02 | Audio y visuales apoyan conducción; activos con procedencia/licencia y calidad gráfica graduable. |
| F06-T04 | Completar sesiones recomendadas, conexión teoría-práctica, medallas útiles y devolución con acceso a ejercicios correctivos. | T03 | Errores llevan a unidades y ejercicios adecuados; recompensas no alteran puntaje de examen. |

Cierre: aprender → conducir → revisar → reintentar → repasar funciona de punta a punta.

### Fase 7 — Pulido, validación final y entrega

Objetivo: versión completa verificable, estable y lista para usar.

| Tarea / PR | Trabajo | Depende de | Aceptación |
|---|---|---|---|
| F07-T01 | **Autor habitual: Opus 5.5; usar GPT-6 Astra si las mediciones muestran un problema complejo de renderizado que requiera diagnóstico adicional.** Medir y optimizar CPU/GPU, espejos, memoria, carga por sectores y niveles de calidad. | F06 completa | Registrar hardware/escenarios/FPS; cumplir presupuesto acordado o corregir antes de cerrar. |
| F07-T02 | Auditar accesibilidad de teoría, legibilidad, subtítulos, movimiento reducido, controles y compatibilidad de escritorio/móvil; verificar mando. | T01 | Flujos principales usables; límites del práctico móvil y dispositivos soportados documentados con evidencia. |
| F07-T03 | Completar instalación PWA, caché sin conexión, actualización de versiones y migraciones de progreso. | T02 | Sesión offline tras descarga; actualización no pierde progreso ni combina reglas incompatibles. |
| F07-T04 | Auditar fuentes y cobertura final, ejecutar recorrido completo y casos críticos; corregir regresiones; documentar arranque, entrega y continuidad. | T03 | Todos los criterios de PROPUESTA satisfechos, checks verdes y pendientes explícitos resueltos; informe final con PRs y evidencia. |

Cierre: versión completa local y lista para publicación. Publicar en un servicio, contratar recursos o configurar un dominio no forma parte implícita de la fusión de PRs; registrar cualquier pedido posterior como alcance concreto.

## Asignación de Astra para Three.js

El usuario asignó GPT-6 Astra como autor de **F03-T03, F04-T01 y F06-T03**. Esta asignación específica prevalece sobre Opus como autor habitual. En **F07-T01** su uso es condicionado al diagnóstico de problemas complejos de renderizado respaldados por mediciones. Empezar con esfuerzo medium y velocidad Standard; aumentar a high cuando espejos, geometría o diagnóstico lo requieran.

Estos siguen siendo PRs completos de sus tareas; Opus continúa las tareas posteriores de integración y mantenimiento a partir de los sistemas entregados. Preparar referencias visuales, escenas reproducibles, capturas y contadores de rendimiento para iterar con evidencia. Reservar cuota OpenAI para la revisión Codex adicional; la autorrevisión de Astra no sustituye esa revisión. Si Astra no está disponible o no alcanza la cuota, registrar el bloqueo y acordar con el usuario una alternativa antes de sustituir al autor asignado. La asignación no inicia fases futuras ni activa créditos adicionales.

## 5. Plantilla de descripción de PR

```markdown
## Problema y resultado
[Tarea Fxx-Tyy, necesidad y comportamiento entregado.]

## Alcance y aceptación
[Qué incluye y evidencia de cada criterio.]

## Dependencias y fusión
- Base: [rama / PR]
- Depende de: [enlaces o ninguna]
- Orden obligatorio: [#1 → #2 → #actual]
- [Si apilado, incluir advertencia obligatoria de sección 3.]

## Validación
[Comandos y resultados, revisión documental/visual, escenarios y limitaciones.]

## Revisiones y findings
- Autorrevisión previa a commit/push: [resultado y alcance]
- Codex: [estado, enlace/evidencia, commit revisado]
- CodeRabbit: [estado, enlace/evidencia, commit revisado]
- Findings: [resoluciones; links a discusiones]
- Excepciones por tokens: [ninguna o evidencia y evaluación restante]

## Documentación y continuidad
[Specs actualizadas, progreso y siguiente tarea de esta fase.]
```

## 6. Registro de ejecución y entrega entre modelos

Crear y mantener `specs/ESTADO_IMPLEMENTACION.md` desde F01-T01. Actualizarlo en cada PR y al terminar cada fase; continuidad es operativa, no solo narrativa.

Registrar:

- Fase autorizada, mensaje que la inició y estado (`no iniciada`, `en curso`, `bloqueada`, `cerrada`).
- Por tarea: rama, base, dependencias, URL/número de PR, último commit y estado de integración.
- Autorrevisión, revisores, findings, excepciones por tokens y checks con resultados.
- Pila actual y orden de fusión; bloqueos y siguiente acción concreta.
- Comandos de ejecución, versiones, pruebas pendientes y decisiones que otro modelo no debe reinterpretar.
- Al cerrar: PRs fusionados, evidencias de aceptación y frase explícita «Esperando inicio manual de la fase siguiente».

No declarar una fase cerrada con tareas abiertas o criterios pendientes. Una fase bloqueada no habilita la siguiente. No reabrir permisos ya concedidos para corregir o fusionar PRs de la fase activa.

## Estrategia de modelos

Consultar [ESTRATEGIA_MODELOS.md](ESTRATEGIA_MODELOS.md) para recomendaciones por fase y tarea, esfuerzo y administración de las dos suscripciones. Planes confirmados: **Anthropic 200 USD y OpenAI 100 USD**, con menor disponibilidad de tokens OpenAI según el usuario. Priorizar **Opus 5.5 como autor** y reservar **GPT-6.1 Sol para revisiones Codex** y problemas focalizados. Es una guía revisable; no activa fases, cambia modelos automáticamente ni elimina revisiones obligatorias.

## 7. Estado

Este plan no registra el avance; el estado vivo está en [ESTADO_IMPLEMENTACION.md](ESTADO_IMPLEMENTACION.md).

- 7 fases, 32 tareas/PRs planificados, más correcciones o divisiones justificadas que se documenten.
- 2026-10-11: el usuario inició la fase 1. Repositorio `grunch/al-volante` con rama principal `main`; el registro de ejecución describe el commit base y los mecanismos de revisión.
