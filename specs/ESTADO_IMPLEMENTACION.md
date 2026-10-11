# Estado de implementación

Registro operativo exigido por `PLAN_IMPLEMENTACION.md` §6. Actualizar en cada PR y al cerrar cada fase.

Última actualización: 2026-10-11.

## Fase activa

- **Fase 1 — Fuentes, cobertura y recorrido verificado: en curso.**
- Mensaje de inicio (2026-10-11): «lee todos los documentos y comienza la implementacion de la primera fase».
- Fases 2–7: no iniciadas. Cada una requiere indicación manual del usuario.

## Repositorio y revisión

| Dato | Valor |
|---|---|
| Remoto | `git@github.com:grunch/al-volante.git` (https://github.com/grunch/al-volante), público. El usuario confirmó publicar las fuentes de `specs/fuentes/` (PDF, textos y láminas). No versionar rutas del sistema de archivos local. |
| Rama principal | `main` |
| Commit base | `ac56c2f` «chore: initialize repository», único commit directo en `main`: un repositorio vacío no admite PRs. Solo contiene `README.md` y `.gitignore`. |
| CodeRabbit | GitHub App elegida por el usuario, plan Advanced. Configuración en `.coderabbit.yaml` (revisa también PRs apilados). Cupo incluido observado en PR #1: 1 revisión por hora. CLI local `coderabbit` 0.7.6 disponible como alternativa. |
| Codex | Comentario `@codex review` en cada PR, según eligió el usuario. Guía de revisión en `AGENTS.md`. El primer pedido respondió que faltaba un entorno de Codex cloud; una vez creado, la revisión corrió. CLI local `codex-cli` 0.162.1 disponible como alternativa (su modelo por defecto es Astra; usar `-c model="gpt-6.1-sol"`). |
| Protección de rama | No configurada. Sin checks obligatorios por ahora; la CI llega en F02-T01. |

Estados por revisor: `pendiente`, `solicitada`, `completada`, `omitida por tokens agotados`, `bloqueada por integración`.

## Tareas de la fase 1

| Tarea | Rama | Base | Depende de | PR | Último commit | Estado |
|---|---|---|---|---|---|---|
| F01-T01 | `f01-t01-repositorio` | `main` | — | [#1](https://github.com/grunch/al-volante/pull/1) | ver PR | en revisión |
| F01-T02 | — | — | T01 | — | — | pendiente |
| F01-T03 | — | — | T02 | — | — | pendiente |
| F01-T04 | — | — | T03 | — | — | pendiente |

### F01-T01 — Repositorio, documentación y flujo de revisión

- Alcance: inicializar git con remoto, versionar propuesta, plan, continuidad, estrategia y fuentes (PDF originales, textos extraídos y láminas); plantilla de PR; este registro; `AGENTS.md`/`CLAUDE.md`; configuración de CodeRabbit.
- Autorrevisión: completa antes del primer push; se corrigieron dos líneas de estado obsoletas. Repetida antes del push correctivo.
- CodeRabbit: completada sobre `5c78875` (4 findings). Re-revisión sujeta al cupo horario.
- Codex: completada sobre `5c78875` (2 findings: P1 manifiesto, P2 registro). Re-revisión solicitada tras la corrección.
- Findings:
  - Manifiesto con rutas locales no reproducibles (Codex P1, CodeRabbit Major): **corregido**. Los PDF se copiaron a `specs/fuentes/pdf/`, con hashes verificados, y el manifiesto usa rutas relativas.
  - Registro desactualizado (Codex P2, CodeRabbit): **corregido** en este archivo.
  - `CONTINUIDAD.md` sin citas en los hallazgos (CodeRabbit): **corregido**. Cada cifra cita archivo y página PDF, localizada en el texto o en la lámina; la verificación completa queda en T03.
  - Cifras de F04-T05 sin cita (CodeRabbit): **corregido en parte**. Las fuentes ya están citadas en PROPUESTA §5 y se transcriben en `REGLAS.md` (T03), así que agregué en el plan una nota que remite a ellas y no dupliqué las citas fila por fila.
- Incidente: la primera versión del PR versionó rutas del sistema de archivos local del usuario. El usuario lo señaló. Se eliminaron de todos los archivos y el commit de la rama se reescribió (`--force-with-lease`).
- Checks: no hay checks configurados.

## Pila y orden de fusión

`main ← F01-T01`

## Bloqueos

Ninguno conocido.

## Siguiente acción

Obtener la re-revisión del commit corregido de PR #1, resolver lo que surja, comprobar los criterios de fusión y fusionar. Después, F01-T02.

## Decisiones que no deben reinterpretarse

- Repo destino, visibilidad pública y revisores fueron confirmados por el usuario el 2026-10-11; no volver a preguntar.
- Ver también «Hallazgos que no deben perderse» en `CONTINUIDAD.md`.
