# Instrucciones para agentes

Proyecto: **Al volante: Comuna 13**, juego web para preparar el examen de licencia B/B.1 en CABA. Idioma del producto y de la documentación: español rioplatense.

## Leer antes de trabajar

1. `specs/ESTADO_IMPLEMENTACION.md`: fase activa, tareas, PRs, bloqueos y siguiente acción.
2. `specs/PLAN_IMPLEMENTACION.md`: plan vinculante de fases, PRs, revisiones y apilado.
3. `specs/CONTINUIDAD.md`: contexto, hallazgos y decisiones que no deben reinterpretarse.
4. `PROPUESTA.md`: producto y arquitectura.
5. `specs/ESTRATEGIA_MODELOS.md`: reparto de modelos y cuota.

## Reglas operativas

- Cada fase la inicia el usuario de forma explícita. Terminar una fase no autoriza la siguiente.
- Una tarea `Fxx-Tyy` equivale a un PR. Las tareas se procesan una por una y en orden.
- Antes de cada commit y push, el autor revisa el diff completo.
- Cada PR pide revisión a CodeRabbit (GitHub App, automática) y a Codex (comentario `@codex review`). Registrar el estado de cada revisor y cómo se resolvió cada finding.
- No hacer commits directos en `main`; todo entra por PR.
- Las fuentes originales están en `specs/fuentes/pdf/` y se describen en `specs/fuentes/manifest.json`. Toda regla o contenido pedagógico cita archivo y página PDF.
- El repositorio es público: no versionar rutas del sistema de archivos local, nombres de usuario del equipo ni otros datos privados. Usar rutas relativas a la raíz del repo.
- Si un dato es una aproximación o no se pudo verificar, decirlo explícitamente; no presentarlo como verificado.

## Review guidelines

- Comprobar que el PR se limita a su tarea `Fxx-Tyy` y cumple los criterios de aceptación del plan.
- Verificar contra la fuente citada (archivo y página PDF) cada regla, cifra, puntaje, límite o dato cartográfico. Marcar cualquier afirmación sin fuente o que contradiga `specs/fuentes/`.
- En reglas de examen: distinguir desaprobación de interrupción, faltas que cuentan una sola vez de las que se repiten, velocidad del examen (30/45 km/h) frente a la máxima de la vía, y maniobras frente a intentos de estacionamiento.
- Señalar ambigüedades presentadas como resueltas y aproximaciones presentadas como verificadas.
- Señalar rutas absolutas del sistema de archivos local u otros datos privados del autor.
- En código: corrección, determinismo de la simulación y de la evaluación, pruebas de casos correctos, incorrectos y frontera, y ausencia de secretos.
- Comprobar que `specs/ESTADO_IMPLEMENTACION.md` refleja el estado real del PR.
