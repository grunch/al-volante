# Estrategia de modelos y consumo

Fecha de consulta: 2026-10-11. Estado: estrategia ajustada a los planes confirmados por el usuario; no inicia ninguna fase ni cambia el modelo automáticamente.

## Planes confirmados por el usuario

- **Anthropic: plan de 200 USD.**
- **OpenAI: plan de 100 USD.**
- El usuario indica que dispone de **menos tokens en OpenAI**. Tratar esa cuota como el recurso más limitado y reservarla prioritariamente para las revisiones Codex exigidas por PR.
- Los importes y la disponibilidad relativa son datos proporcionados por el usuario. No deducir una proporción exacta de tokens a partir de 200/100 USD ni asumir el nombre comercial o multiplicador de cada plan solo por su precio.
- Cuotas restantes, ventanas de renovación y sublímites de modelos se consultarán cuando haga falta. No volver a preguntar los importes ya confirmados.

Optimizar cuota por tarea aceptada y PR fusionado, incluyendo correcciones y revisiones. No estimar cantidad de PRs incluidos usando precios API.

## Recomendación principal

Usar **Opus 5.5 como autor habitual de las siete fases** y reservar **GPT-6.1 Sol para las revisiones Codex** y asistencia técnica focalizada. Usar GPT-6 Luna solo en tareas delimitadas cuando exista cuota OpenAI sobrante después de prever las revisiones. Reservar Fable y Astra para problemas específicos difíciles; preferir probar Fable con cuota incluida disponible antes de consumir Astra, sin asumir que Fable siempre dará mejor resultado. Esta asignación reemplaza la recomendación anterior de Sol como autor principal, dado el mayor margen que el usuario declara en Anthropic. Esta distribución es una recomendación de ingeniería basada en roles documentados; no es un benchmark realizado sobre este proyecto ni garantiza ausencia de errores.

La documentación oficial sitúa GPT-6.1 Sol como opción para trabajo prolongado de código/documentos a menor costo que Astra, y Luna para tareas claras y repetibles. Opus 5.5 está orientado a programación agéntica y trabajo prolongado. Referencias: [modelos de OpenAI](https://learn.chatgpt.com/docs/models), [Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview).

## Selección por fase

Los niveles de esfuerzo siguientes son recomendaciones iniciales, sujetos a los controles disponibles en cada cliente. Standard se refiere a velocidad; medium/high se refiere a esfuerzo de razonamiento.

| Fase | Si se elige un solo autor para toda la fase | Ajustes rentables por tarea |
|---|---|---|
| 1. Fuentes y recorrido | Opus 5.5, medium; high en interpretación crítica | T01–T02 medium; extracción mecánica con scripts. T03–T04 high. Sol revisa reglas, fuentes y geometría; escalar solo una ambigüedad concreta con evidencia. |
| 2. Base web y aprendizaje | Opus 5.5, medium | T01–T04 medium; T05 high en persistencia y migraciones. Sol realiza revisión adicional; no duplicar toda la implementación. |
| 3. Auto y primer tramo | Opus 5.5, high | T01–T02 y T04–T05 high por física, transmisión, reglas e integración; T03 medium/high según complejidad. Sol revisa casos críticos. Fable o Astra solo ante problemas persistentes con reproducción. |
| 4. Circuito y práctico | Opus 5.5, high | T01 medium/high según geometría; T02–T05 high por actores, reglas, estacionamiento y estados. Priorizar la cuota Sol para revisión de este código. |
| 5. Contenido y teórico | Opus 5.5, medium | T01–T04 medium con plantillas y scripts; T05 high para simulacro y evaluación. Sol comprueba cobertura y lógica. Luna solo si sobra cuota; no dejar inferencia normativa o revisión final solo a Luna. |
| 6. Repetición e inmersión | Opus 5.5, medium/high | T01–T02 high por restauración determinista y modelos físicos; T03–T04 medium. Sol revisa restauración, reglas e integración. |
| 7. Validación y entrega | Opus 5.5, high en T01/T03/T04, medium en T02 | Decidir optimizaciones con perfiles. Reservar Sol para revisión final y regresiones. Astra únicamente si un diagnóstico difícil justifica su consumo. |

La prioridad de Opus responde a las cuotas declaradas, no a una superioridad demostrada sobre Sol en Three.js. Si Opus no avanza y Sol resuelve un problema con menos retrabajo, usar Sol en ese alcance y volver al reparto habitual. Mantener al autor durante el PR cuando progresa evita repetir contexto. Las tareas siguen ejecutándose una a una; esta tabla no autoriza implementación paralela.

## Papel de cada modelo solicitado

- **GPT-6.1 Sol:** opción por defecto para revisión Codex cuando el mecanismo permite elegir. Medium en PRs estándar, high para reglas, estados, física y migraciones. Autor solo como alternativa focalizada por bloqueo o ventaja observada, preservando cuota de revisión.
- **GPT-6 Luna:** uso opcional si sobra cuota OpenAI para transformaciones, catálogos, clasificación y cambios pequeños con aceptación inequívoca; high como punto inicial. No usar como único responsable del trazado ambiguo o de reglas críticas.
- **Opus 5.5:** autor principal del proyecto aprovechando el plan Anthropic de 200 USD. Medium por defecto; high si hay ambigüedad o integración difícil. Reparte consumo entre empresas sin recurrir al modelo de mayor costo.
- **GPT-6 Astra:** escalamiento focalizado. Empezar en low/light o medium según dificultad; high si el problema lo requiere. No gastarlo leyendo otra vez todo el manual o escribiendo todas las preguntas.
- **Claude Fable 5.1:** último recurso o análisis difícil si el plan lo incluye y hay cuota; no autor habitual de fases. Evaluar primero Opus con esfuerzo mayor y un caso bien delimitado.
- **GPT-6 Sol:** alternativa si 6.1 no está disponible, hay un problema comprobado en 6.1 o se obtiene mejor resultado medido. No asumir ahorro por ser anterior.
- **GPT-5.6 Sol/Terra/Luna:** reserva por disponibilidad, cuotas específicas o ventaja medida en una tarea. La antigüedad no demuestra menor costo. Evitar cambiar automáticamente a 5.6 para ahorrar.

## Qué dicen las tarifas y qué no dicen

La tabla oficial de créditos Standard de OpenAI lista, por millón de tokens (entrada / caché / salida): GPT-6.1 Sol 50 / 2.5 / 250; GPT-6 Sol 50 / 5 / 250; GPT-6 Luna 2.5 / 0.25 / 12.5; Astra 250 / 25 / 1250; GPT-5.6 Sol 100 / 10 / 500; Terra 50 / 5 / 300; Luna 5 / 0.5 / 30. Son tarifas para créditos, no equivalencias de consumo del cupo incluido. Esta comparación solo justifica no presumir que 5.6 ahorra dinero al comprar créditos. [Precios y uso de OpenAI](https://learn.chatgpt.com/docs/pricing).

Con suscripción, conviene comenzar en **velocidad Standard**. La documentación consultada indica multiplicadores de consumo incluido de 2.5x para Fast y 8x para Ultrafast en los modelos señalados. Registrar el consumo real en el panel, ya que contexto, esfuerzo y herramientas influyen y las condiciones pueden cambiar. [Precios y modos de velocidad](https://learn.chatgpt.com/docs/pricing).

En Claude, **Fable 5.1 está disponible pero no incluido en Claude Pro**: utiliza créditos adicionales. En Max está incluido, con sublímite de hasta 50% del uso semanal y consume el cupo más rápido que otros Claude. Tener ambas suscripciones no permite concluir que Fable resulte gratuito. Verificar la inclusión y cuota restante mostradas en la cuenta antes de asignarlo; el usuario ya confirmó el importe de su plan Anthropic, 200 USD. [Fable en cada plan](https://support.claude.com/en/articles/15424964-claude-fable-models-on-your-plan).

Como referencia API únicamente, Opus 5.5 tiene precio base 4/20 USD y Fable 5.1 10/50 USD por millón de tokens de entrada/salida; esos valores no sirven para calcular cuántos PRs incluye la suscripción. [Tarifas Claude](https://platform.claude.com/docs/en/about-claude/pricing).

## Revisiones y ahorro sin cambiar las reglas del proyecto

Cada PR mantiene autorrevisión antes de commit/push, revisión adicional Codex y CodeRabbit cuando haya tokens, resolución de findings y criterios de fusión del plan. No suprimir revisiones para ajustarse a una preferencia de ahorro; la excepción sigue siendo agotamiento real documentado.

- Si Claude implementa, reservar cuota OpenAI para revisión Codex.
- Si Sol implementa, una revisión Codex separada puede usar Sol en contexto de revisión independiente; no exige Astra. La autorrevisión no cuenta como segunda revisión.
- Si la integración GitHub elige su modelo, registrar el modelo cuando sea visible; no afirmar que se controló su selección.
- CodeRabbit conserva su propio mecanismo y cuota. No asumir que su consumo sale de las suscripciones OpenAI/Anthropic.
- Enviar al revisor requisitos, diff respecto de la base correcta, archivos relacionados y evidencia de pruebas. Ampliar contexto cuando el hallazgo lo requiera.
- Repetir revisión en cambios afectados por correcciones y riesgos relevantes. Evitar revisiones redundantes sin cambios ni findings nuevos.

## Reglas prácticas para administrar cuota

1. Cargar al comenzar cada tarea plan, continuidad y las specs relevantes; buscar y leer solo páginas/archivos necesarios. No reenviar 200 páginas del manual en cada turno.
2. Mantener IDs y referencias estables. Extracción y comprobaciones mecánicas se hacen con scripts cuando basta; reservar razonamiento del modelo para interpretación.
3. Una tarea/PR por contexto operativo cuando sea posible. Si se conserva una sesión eficiente y con contexto útil, no reiniciarla por obligación; reiniciar cuando la historia irrelevante domine.
4. Usar medium normalmente y high ante complejidad identificada. No dejar max/ultra activados por defecto. Mayor esfuerzo consume más tokens y puede agotar antes el límite. [Ajustes Claude](https://support.claude.com/en/articles/8664678-change-the-model-effort-and-thinking-settings).
5. Tras dos intentos sustanciales sin progreso en el mismo fallo, preparar un resumen con reproducción, pruebas y enfoques descartados; cambiar de estrategia o escalar a un modelo fuerte para ese problema. Es una heurística, no un límite que permita abandonar la tarea.
6. Antes de pasar entre proveedores, escribir estado del PR y próximo paso. No depender del historial invisible del otro modelo.
7. Dedicar prioritariamente la cuota OpenAI a revisiones Codex y sus revalidaciones. Antes de usar OpenAI como autor o asistente, prever el consumo de los PRs pendientes según mediciones reales. En Anthropic, mantener una reserva orientativa del 25% para correcciones; ajustarla con datos. No son límites que permitan omitir controles ni predicciones de tokens.
8. Registrar por PR modelo/esfuerzo, cuota antes/después y hora de reset, tiempo, rondas de corrección y regresiones. Si hubo otro uso simultáneo de la cuenta, marcar la medición como aproximada.
9. Tras los primeros PRs de una fase autorizada, recalibrar según cuota consumida por PR aceptado y calidad. No duplicar PRs completos solo para comparar modelos.
10. Cambiar entre empresas cuando ayude a aprovechar cuotas, reservando la revisión Codex exigida. Cambiar de Sol a Astra no crea un cupo OpenAI independiente.

## Para afinar esta recomendación

Los importes ya están confirmados: Anthropic 200 USD y OpenAI 100 USD; el usuario dispone de menos tokens en OpenAI. Solo falta verificar, cuando sea necesario, cuotas restantes, reinicios, inclusión de modelos y sublímites. El gasto adicional no está autorizado. No activar créditos adicionales ni servicios pagos a partir de esta recomendación. La elección de modelos no altera el inicio manual obligatorio de cada fase.
