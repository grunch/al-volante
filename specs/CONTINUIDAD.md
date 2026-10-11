# Continuidad del proyecto

Actualizado: 2026-10-11. Estado: fase 1 en curso. Avance por tarea y PR en `ESTADO_IMPLEMENTACION.md`.

## Pedido y alcance de esta etapa

El usuario pide un juego web prolijo y creativo para estudiar TODO el manual y protocolo de licencia B, con práctico de acción 3D desde el interior del auto por Comuna 13 recorrido A. Exige Three.js y specs persistentes para que otro modelo pueda continuar. Solicitó primero una propuesta, mostrársela y escribirla como `.md` en el directorio actual. La propuesta fue aceptada. El usuario pidió ahora un plan por fases: una tarea por PR, creación secuencial, autorrevisión antes de commit/push, revisión adicional por Codex y CodeRabbit salvo agotamiento de tokens, corrección de findings y fusión autónoma cuando esté listo. PRs dependientes abiertos deben apilarse y fusionarse en orden. El inicio de CADA fase requiere indicación manual del usuario; no iniciar la fase 1 con este pedido de planificación.

## Leer primero

0. `ESTADO_IMPLEMENTACION.md`: fase activa, PRs, bloqueos y siguiente acción.
1. `PLAN_IMPLEMENTACION.md`: plan operativo vinculante, 7 fases y 32 tareas/PRs, revisiones y apilado.
2. `../PROPUESTA.md`: propuesta de producto y decisiones de arquitectura.
3. `fuentes/manifest.json`: archivos originales, páginas y hashes.
4. `fuentes/INDICE.md`: índice automatizado por página.
5. PDFs originales en `fuentes/pdf/` (hashes verificados contra `manifest.json`).

El repositorio es `grunch/al-volante`. Las rutas de este proyecto se expresan relativas a la raíz del repo; no registrar rutas del sistema de archivos local en documentos versionados (el repo es público). No hay aplicación ni dependencias instaladas.

## Hecho

- Inventario de cuatro PDFs educativos: manual 200 páginas, protocolo 42, recorridos 19 y guía de siniestros 24 (`fuentes/manifest.json`, verificado con `pdfinfo`).
- Extracción con `pdftotext -layout`, conservando saltos de página. El protocolo tiene fondo decorativo que contamina la extracción; usar `pdftotext -raw` para mejorar la lectura y renderizar tablas/gráficos.
- Leídos índice, distribución B, etapas, ficha y partes del anexo de fallas. No afirmar que cada párrafo del manual o protocolo está auditado: la revisión integral pedagógica sigue pendiente.
- Inspección visual de página PDF 16 del recorrido y PDF 21 del protocolo (cajón).
- Propuesta escrita; sin implementación ni pruebas funcionales.
- Búsqueda oficial exploratoria del formato teórico: resultados contradictorios respecto del tiempo. Enlaces y estado en propuesta. No se ha certificado vigencia.

## Hallazgos que no deben perderse

Referencias como «protocolo PDF n» indican archivo y página física. Las cifras se localizaron en el texto extraído o en la lámina citada; la transcripción completa y su verificación de casos frontera corresponde a F01-T03 (`REGLAS.md`).

- Ruta literal: Quesada → Av. Cabildo → Guayra → Cuba → Quesada → Cuba → Manuel Ugarte → Vuelta de Obligado → Quesada. Inicio Quesada 2381, sede Cabildo 3067 (recorridos PDF 16). Duración estimada de 15 minutos (recorridos PDF 5).
- Repetición Cuba–Quesada–Cuba pendiente de interpretación cartográfica. No resolver inventando una maniobra.
- Manual B: introducción, capítulos 1–5, anexos I y IV (manual PDF 3). Anexos II/III se incluyen como complemento por pedido de TODO.
- Protocolo: 1/2/3/8 puntos; hasta 7 aprobado tras completar etapas; 8 o más desaprobado (protocolo PDF 14). Desaprobación e interrupción son estados distintos (pendiente de transcribir desde el anexo II, protocolo PDF 22–33).
- Límites del examen 30/45 km/h (protocolo PDF 8, 10); infracción de límite de examen no es la misma que máxima vial (anexo II, protocolo PDF 22–33; página exacta a fijar en T03).
- Retroceso y avance iniciales de 30 cm con restricciones de pedalera; primeros 100 m en segunda para manual (protocolo PDF 11).
- Más de tres maniobras no equivale a más de dos intentos de estacionamiento (maniobras: protocolo PDF 13, 24; intentos: PDF 17, 33).
- Cajón de 6 m, gráfico con distancias 15, 25 y 50 cm (gráfico 4, protocolo PDF 21, inspección visual) y objetivo aproximado de 20 cm (protocolo PDF 13, 25). Revisar anexo para reglas exactas y casos frontera, sin asumir tolerancias por física.
- Algunas fallas cuentan una vez, otras por repetición; hay excepciones y observaciones del examinador. Transcribir motor de reglas desde el anexo completo.
- Señales e imágenes no se recuperan completas del texto. Renderizar y revisar cada figura.
- Boleta de pago no abierta ni incorporada.

## Fase 1 en curso

El usuario inició la fase 1 el 2026-10-11. El problema anterior de `.git` quedó resuelto: el directorio ya no tenía `.git`, se inicializó git y se conectó a `grunch/al-volante`, el repo público que eligió el usuario. Las tareas siguen el orden del plan:

1. F01-T01: repositorio, documentación versionada, plantilla de PR, registro de ejecución y flujo de revisión (CodeRabbit App + `@codex review`).
2. F01-T02: `specs/COBERTURA.md` y catálogo de unidades del manual y la guía, con estado: pendiente / transcrita / revisada / implementada / probada.
3. F01-T03: `specs/REGLAS.md` con la ficha y el anexo completos, políticas de repetición e interrupción, parámetros del teórico y discrepancias.
4. F01-T04: `specs/RECORRIDO.md` y datos cartográficos con geometría, fuentes, sentidos, cruces, evidencias y resolución de Cuba–Quesada–Cuba. Usar cartografía abierta con atribución; no inferir la señalización actual del mapa esquemático.
5. Cerrar la fase 1 con evidencia y esperar la indicación manual para la fase 2.

Actualizar este archivo y `ESTADO_IMPLEMENTACION.md` en cada hito.

## Validación prevista

Contenido trazable y completo; reglas con casos y excepciones; navegación cartográfica; conducción y espejos reales; repeticiones deterministas; persistencia; sesión integral de navegador y perfil de rendimiento. No hay verificaciones de software hechas porque aún no hay software.

## Modelos y cuota

El usuario confirmó **Anthropic 200 USD y OpenAI 100 USD**, y aclaró que tiene menos tokens en OpenAI. Ver `ESTRATEGIA_MODELOS.md`: **Opus 5.5 como autor principal en todas las fases; GPT-6.1 Sol reservado prioritariamente para revisión Codex y ayuda focalizada**. Luna solo con cuota sobrante; Fable/Astra para escalamiento justificado. Esto sustituye la recomendación previa de Sol como autor habitual. No deducir proporciones de tokens ni el nombre comercial del plan por su precio; consultar uso real y sublímites cuando haga falta. No volver a preguntar los importes confirmados. Fuentes oficiales consultadas el 11/10/2026. No inferir cuota incluida desde precios API.
