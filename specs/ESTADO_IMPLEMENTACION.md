# Estado de implementación

Registro operativo exigido por `PLAN_IMPLEMENTACION.md` §6. Actualizar en cada PR y al cerrar cada fase.

Última actualización: 2026-10-11.

## Fase activa

- **Fase 1 — Fuentes, cobertura y recorrido verificado: en curso.**
- Mensaje de inicio (2026-10-11): «lee todos los documentos y comienza la implementacion de la primera fase».
- Fases 2–7: no iniciadas. Cada una requiere indicación manual del usuario.
- Modo de trabajo (usuario, 2026-10-11): etapa A, crear todos los PRs de la fase uno por uno y apilados sin esperar revisiones; etapa B, revisar los findings con el usuario y fusionar en orden. Ver `PLAN_IMPLEMENTACION.md` §1–§3.
- **Etapa actual de la fase 1: A (creación).**

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
| F01-T01 | `f01-t01-repositorio` (borrada) | `main` | — | [#1](https://github.com/grunch/al-volante/pull/1) | `b96dcf6` | fusionado por el usuario (merge `12cf2a8`, 2026-10-11 18:59 UTC) |
| F01-T02 | `f01-t02-cobertura` | `main` | T01 (#1, fusionado) | #2 | ver PR | en revisión (etapa A) |
| F01-T03 | `f01-t03-reglas` | `f01-t02-cobertura` (#2) | T02 (#2) | #3 | ver PR | en revisión (etapa A) |
| F01-T04 | — | — | T03 | — | — | pendiente |

### F01-T01 — Repositorio, documentación y flujo de revisión

- Alcance: inicializar git con remoto, versionar propuesta, plan, continuidad, estrategia y fuentes (PDF originales, textos extraídos y láminas); plantilla de PR; este registro; `AGENTS.md`/`CLAUDE.md`; configuración de CodeRabbit.
- Autorrevisión: completa antes del primer push; se corrigieron dos líneas de estado obsoletas. Repetida antes del push correctivo.
- CodeRabbit: completada sobre `5c78875` (4 findings). Re-revisión sujeta al cupo horario.
- Codex: completada sobre `5c78875` (2 findings: P1 manifiesto, P2 registro) y sobre `d8e5e84` (1 finding P2: citar la política de repetición de fallas).
- Findings:
  - Manifiesto con rutas locales no reproducibles (Codex P1, CodeRabbit Major): **corregido**. Los PDF se copiaron a `specs/fuentes/pdf/`, con hashes verificados, y el manifiesto usa rutas relativas.
  - Registro desactualizado (Codex P2, CodeRabbit): **corregido** en este archivo.
  - `CONTINUIDAD.md` sin citas en los hallazgos (CodeRabbit): **corregido**. Cada cifra cita archivo y página PDF, localizada en el texto o en la lámina; la verificación completa queda en T03.
  - Política de repetición sin cita en PROPUESTA §5 (Codex P2 sobre `d8e5e84`): **corregido**. Se citan protocolo PDF 22–28 para faltas que cuentan una vez y faltas que se repiten.
  - Cifras de F04-T05 sin cita (CodeRabbit): **corregido en parte**. Las fuentes ya están citadas en PROPUESTA §5 y se transcriben en `REGLAS.md` (T03), así que agregué en el plan una nota que remite a ellas y no dupliqué las citas fila por fila.
- Incidente: la primera versión del PR versionó rutas del sistema de archivos local del usuario. El usuario lo señaló. Se eliminaron de todos los archivos y el commit de la rama se reescribió (`--force-with-lease`).
- Checks: no hay checks configurados.
- Cierre: el usuario fusionó #1 el 2026-10-11 con merge commit. La re-revisión de CodeRabbit sobre los últimos commits no llegó a completarse antes de la fusión.

### F01-T02 — Auditoría del manual y la guía (`COBERTURA.md` y catálogo)

- Alcance: clasificar cada página del manual (200) y de la guía de siniestros (24), y catalogar unidades, señales y observaciones con su página. Entregables: `specs/COBERTURA.md`, `specs/catalog/{pages,units,signs,issues}.json` y el validador `scripts/check-catalog.mjs` con su prueba.
- Resultado: 224 páginas, 705 unidades, 355 señales y 206 observaciones. Validador OK; 7/7 pruebas.
- Método: nueve subagentes de extracción por tramos de páginas (texto + imagen), con integración y muestreo del autor contra `fuentes/pdf/manual.pdf` (PDF 61, 72, 91 y 185, sin diferencias). Estado del contenido: `transcrita`.
- Autorrevisión: estructura validada; sin rutas locales en el catálogo; conteos de COBERTURA recalculados desde los datos; corregido un issue duplicado y dos imprecisiones del borrador.
- CodeRabbit y Codex: solicitadas al abrir el PR; se revisan en la etapa B.

### F01-T03 — Reglas del examen (`REGLAS.md`)

- Alcance: transcribir el protocolo completo (etapas, fallas, excepciones, repetición e interrupción) y verificar los parámetros del teórico contra fuentes oficiales. Entregables: `specs/REGLAS.md`, `specs/catalog/rules.json` y el validador `scripts/check-rules.mjs` con su prueba.
- Resultado: 69 reglas (25 leves, 10 def. bajas, 16 def. altas, 18 eliminatorias) mapeadas a las 80 filas de la ficha; 12 eliminatorias que interrumpen (a–k, q) y 5 escalamientos por doble comando. Discrepancias X1–X6, vacíos V1–V7 y decisiones D1–D4 documentados.
- Fuentes oficiales verificadas el 2026-10-11: el protocolo, el manual, la guía y los recorridos que publica hoy el sitio coinciden por SHA-256 con el manifiesto. La edición GEDO de enero de 2023 tiene texto normativo idéntico. Teórico: 40 preguntas, 34 correctas; tiempo de 45 min (Disp. 860/2023 y página vigente) frente a 40 min (informe 2024); se adopta 45 configurable.
- Autorrevisión: lectura completa del protocolo por columnas (anexo II) y por imagen (ficha y gráficos); cotejo de la ficha fila por fila; validadores OK; 12/12 pruebas.
- CodeRabbit y Codex: solicitadas al abrir el PR; se revisan en la etapa B.

## Pila y orden de fusión

`main ← F01-T02 (#2) ← F01-T03 (#3) ← F01-T04`. #1 ya está en `main`. T03 y T04 se crean en la etapa A; se fusionan en ese orden en la etapa B.

## Bloqueos

Ninguno conocido.

## Siguiente acción

Etapa B en curso: findings de #2 y #3 resueltos en sus ramas; luego #4, y fusión en orden #2 → #3 → #4. #1 ya está fusionado. La re-revisión de CodeRabbit que quedó sin completar antes de fusionarlo no bloquea la fase y se registra como seguimiento. La versión vigente de este registro está en la rama más alta de la pila.

## Decisiones que no deben reinterpretarse

- Repo destino, visibilidad pública y revisores fueron confirmados por el usuario el 2026-10-11; no volver a preguntar.
- Ver también «Hallazgos que no deben perderse» en `CONTINUIDAD.md`.
