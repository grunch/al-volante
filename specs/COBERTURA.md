# Cobertura del manual y de la guía de siniestros

Entregable de F01-T02. Fecha: 2026-10-11. Estado: **inventario completo y tratado.** En la fase 5 (2026-10-12) todas las unidades y señales se revisaron y quedaron practicadas o de consulta (auditoría global de F05-T05: 753 unidades, 355 señales y 285 páginas, sin pendientes); el método, el avance por tarea y las decisiones sobre discrepancias están en [CONTENIDO.md](CONTENIDO.md).

Define qué hay que enseñar: cada página del manual teórico (200 páginas) y de la guía práctica de siniestros viales (24 páginas) está clasificada, y cada contenido instructivo está registrado como unidad de conocimiento o como señal, con su página. El protocolo de examen y el documento de recorridos se tratan en F01-T03 (`REGLAS.md`) y F01-T04 (`RECORRIDO.md`); desde F05-T04 también están clasificados página por página, con sus unidades de consulta (ver «Documentos del examen»).

## Archivos

| Archivo | Contenido |
|---|---|
| `catalog/pages.json` | 224 páginas en F01-T02 (285 desde F05-T04, con las 42 del protocolo y las 19 de los recorridos): fuente, página PDF, página impresa, sección, categoría, tipo, resumen, unidades y figuras (con los datos de cada infografía transcriptos). |
| `catalog/units.json` | 705 unidades de conocimiento en F01-T02 (753 desde F05-T04): id estable, páginas, título, categoría, tipo, resumen fiel con cifras exactas y datos atómicos (`keyFacts`). |
| `catalog/signs.json` | 355 señales individuales: página, grupo, rótulo, significado si la fuente lo da, descripción visual y código impreso. |
| `catalog/issues.json` | 206 observaciones de F01-T02 (más las que agrega la revisión de la fase 5; ver CONTENIDO.md): discrepancias, datos posiblemente desactualizados, ambigüedades, erratas, fallas de extracción e ilegibles. |
| `../src/content/` | Esquemas y validadores en TypeScript (ver «Cómo validar»); desde F02-T02 reemplazan al script original de la fase 1. |

Las claves y los ids están en inglés; títulos, resúmenes y descripciones, en español, fieles a la fuente. Las referencias de página son siempre **páginas físicas del PDF** (en el manual, la página impresa suele ser PDF − 1).

## Método

1. **Integridad de fuentes.** SHA-256 y cantidad de páginas de `fuentes/pdf/manual.pdf` y `fuentes/pdf/siniestros.pdf` verificados contra `fuentes/manifest.json`.
2. **Lectura de texto e imagen por página.** El texto extraído (`fuentes/*.txt`) pierde gran parte del contenido: infografías, tablas, rótulos de señales y cifras. Cada página se renderizó a 70 ppp (110 ppp para el anexo IV) y se revisó visualmente. Las cifras dudosas se volvieron a renderizar recortadas, a entre 150 y 300 ppp. 58 observaciones de tipo `extraction` documentan qué perdía el texto. Las unidades cuyo contenido sale principalmente de una imagen llevan `figureBased: true` (145 unidades).
3. **Reparto.** La extracción se dividió en nueve tramos de páginas, procesados por subagentes con un esquema común. El autor integró los tramos, corrigió colisiones de ids, unificó prefijos, eliminó duplicados y corrió el validador.
4. **Verificación por muestreo del autor.** Se contrastaron contra la imagen las páginas de `fuentes/pdf/manual.pdf` 61 (tipos de señalización vertical), 72 (velocidades máximas en CABA y excepciones por avenida), 91 (límites de alcohol por tipo de conductor) y 185 (27 señales de prohibición, una por una). No se encontraron diferencias.
5. **Conteo de señales.** En cada página del anexo IV se contaron los dibujos y se cotejaron con las entradas. El `notes` de cada página registra el conteo y explica los casos en que un dibujo genera varias entradas (p. ej., los estados de cada semáforo en PDF 197).

## Clasificación

**Categoría** (según «Material a estudiar», manual PDF 3–4):

- `B`: introducción, capítulos 1–5, anexo I y anexo IV. Es la campaña principal. El anexo IV también figura para las categorías D y C/E; se lo marca `B` porque es parte de la campaña principal.
- `D`: anexo II (transporte de pasajeros/as). Material complementario.
- `C-E`: anexo III (carga y mercaderías). Material complementario. La página 3 lista la categoría C sin contenido propio, junto a la E; se interpreta que ambas usan el anexo III (ver issues).
- `common`: tapa, presentación, glosario, índice y contratapa. Son material de referencia general.
- `guide`: guía de siniestros. Material adicional.

**Tipo de página:** `instructional`, `chapter-cover`, `closing-quote`, `toc`, `cover`, `credits` y `other`.

**Estado de cada unidad o señal** (escala común del proyecto; los valores de `status` en los catálogos están en inglés, como el resto del código): `pending` (pendiente) → `transcribed` (transcrito) → `reviewed` (revisado) → `implemented` (implementado) → `tested` (probado). Al cerrar F01-T02 todo el catálogo estaba en `transcribed`: el contenido estaba extraído y citado, pero no revisado contra la fuente unidad por unidad. La fase 5 lo revisa sección por sección antes de convertirlo en actividad; el significado verificable de cada estado y las reglas que lo controlan están en CONTENIDO.md.

## Cobertura por sección

### Manual (200 páginas)

| Sección | Páginas PDF | Categoría | Páginas | Instructivas | Unidades | De figura | Señales |
|---|---|---|---:|---:|---:|---:|---:|
| Tapa, presentación, material por categoría | 1–4 | common | 4 | 3 | 2 | 0 | 0 |
| Glosario | 5–11 | common | 7 | 7 | 75 | 0 | 0 |
| Índice | 12–13 | common | 2 | 0 | 0 | 0 | 0 |
| Introducción | 14–20 | B | 7 | 5 | 16 | 5 | 0 |
| Cap. 1 Movilidad sustentable | 21–42 | B | 22 | 20 | 86 | 12 | 13 |
| Cap. 2 Responsabilidad | 43–56 | B | 14 | 12 | 50 | 5 | 0 |
| Cap. 3 Normas básicas | 57–88 | B | 32 | 30 | 122 | 59 | 38 |
| Cap. 4 Capacidad natural | 89–97 | B | 9 | 7 | 31 | 2 | 1 |
| Cap. 5 Actitud | 98–103 | B | 6 | 4 | 19 | 1 | 0 |
| Anexo I Automóviles | 104–122 | B | 19 | 17 | 57 | 10 | 0 |
| Anexo II Pasajeros/as | 123–151 | D | 29 | 27 | 94 | 12 | 0 |
| Anexo III Carga | 152–183 | C-E | 32 | 30 | 91 | 11 | 0 |
| Anexo IV Señales | 184–198 | B | 15 | 13 | 31 | 28 | 303 |
| Contratapa | 199–200 | common | 2 | 0 | 0 | 0 | 0 |
| **Total** | | | **200** | **175** | **674** | **145** | **355** |

Campaña B (introducción, cap. 1–5, anexos I y IV): 412 unidades y 355 señales. Las señales fuera del anexo IV (cap. 1, 3 y 4) son ejemplos dentro del texto y llevan ids `sign.ch1-cycling.*`, `sign.ch3.*` y `sign.ch4.*` para no chocar con el catálogo del anexo IV.

### Guía de siniestros (24 páginas)

| Sección | Páginas PDF | Páginas | Instructivas | Unidades |
|---|---|---:|---:|---:|
| Tapa, índice, autoridades | 1–3 | 3 | 0 | 0 |
| Introducción | 4–5 | 2 | 1 | 1 |
| 01 ¿Qué hacer ante un siniestro vial? | 6–12 | 7 | 6 | 13 |
| 02 Reclamo administrativo ante la aseguradora | 13–15 | 3 | 2 | 5 |
| 03 Pasos posteriores (orientación jurídica) | 16–23 | 8 | 7 | 12 |
| Contratapa | 24 | 1 | 0 | 0 |
| **Total** | | **24** | **16** | **31** |

### Documentos del examen (desde F05-T04)

Categoría `exam`. Las unidades del protocolo son de consulta salvo las reglas generales del examen, y las de circuitos son todas de consulta (CONTENIDO.md, D-T04-16 y D-T04-17).

| Fuente | Sección | Páginas PDF | Páginas | Instructivas | Unidades |
|---|---|---|---:|---:|---:|
| Protocolo (42) | Tapa, reverso, créditos e índice | 1–4 | 4 | 0 | 0 |
| | Presentación y condiciones | 5–8 | 4 | 4 | 6 |
| | Las tres etapas | 9–13 | 5 | 5 | 5 |
| | Forma de evaluación y ficha | 14–17 | 4 | 4 | 2 |
| | Anexo I (gráficos) | 18–21 | 4 | 4 | 4 |
| | Anexo II (fallas) | 22–33 | 12 | 12 | 6 |
| | Anexo III (circuitos 2023) | 34–40 | 7 | 7 | 7 |
| | Contratapa | 41–42 | 2 | 0 | 0 |
| Recorridos (19) | Tapa, autoridades e índice | 1–3 | 3 | 0 | 0 |
| | Presentación | 4–5 | 2 | 2 | 4 |
| | Circuitos por comuna | 6–19 | 14 | 14 | 14 |

El documento de recorridos no tiene contratapa: PDF 19 es la lámina de ACA Libertador.

### Páginas no instructivas

Están clasificadas explícitamente en `pages.json`, con resumen:

- **Manual:** tapa (1); índice (12–13); portadas de sección (14, 21, 43, 57, 89, 98, 104, 123, 152, 184); frases de cierre (20, 42, 56, 88, 97, 103, 122, 151, 183, 198); ilustración decorativa de contratapa (199) y contratapa (200).
- **Guía:** tapa (1), índice (2), autoridades (3), portadas de sección (4, 6, 13, 16) y contratapa (24).
- **Protocolo:** tapa (1), reverso ilustrado (2), créditos (3), índice (4), ilustración de contratapa (41) y contratapa (42).
- **Recorridos:** tapa (1), autoridades (2) e índice (3).

Las frases de cierre repiten mensajes que ya están cubiertos en unidades del capítulo; ninguna aporta una norma nueva. Las páginas 199–200, pendientes de revisión visual según la propuesta, quedan revisadas: no tienen contenido instructivo.

## Discrepancias y datos a resolver antes de crear contenido

Lista completa en `catalog/issues.json`: 41 `discrepancy`, 39 `outdated`, 38 `ambiguous`, 25 `typo`, 58 `extraction` y 5 `illegible`. Estas son las que afectan lo que se enseñará en la campaña B; F05 debe resolverlas antes de crear preguntas sobre esos temas.

| Tema | Fuentes | Situación |
|---|---|---|
| Límites de alcohol | manual PDF 91 (Ley 2148: 0,5 g/l general; 0,00 principiante y profesional; 0,20 motociclista) | Posiblemente desactualizado por la Ley nacional 27.714 de alcohol cero y su adhesión local. Verificar la norma vigente; no afirmar una vigencia que no esté comprobada. |
| Cordón amarillo | manual PDF 60 frente a PDF 196 | La p. 60 dice «prohibición de estacionar durante las 24 horas» y la p. 196, «prohibición de estacionar, pudiendo detenerse». |
| Teléfono ante heridos | manual PDF 52 frente a guía PDF 7, 9 y 10 | El manual dice 107 y luego 911; la guía, solo 911. El manual describe el 911 como «Policía Federal». |
| Distancia de balizas | manual PDF 51 frente a guía PDF 8 | El manual da 30/60 m en ciudad y 50/100 m en ruta; la guía, 1 m por km/h de velocidad máxima, hasta 90 m. |
| Primeros auxilios y datos a recabar | manual PDF 53–54 frente a guía PDF 10–12 | Hay diferencias en excepciones, datos del asegurado, vehículo estacionado y testigos. |
| Contramarcha del SRI | manual PDF 115 (tabla) frente a PDF 116 (texto) | El texto dice hasta 1 año y 10 kg; la tabla ubica al grupo 0+ (hasta 13 kg) hacia atrás. |
| Estacionamiento en pasajes | manual PDF 84 (texto frente a infografía) | El texto lo prohíbe en pasajes de calzada de hasta 4,5 m; la infografía, en todos los pasajes. |
| Velocidad en calles peatonales | manual PDF 26 | 10 km/h en la ficha y 20 km/h en calles de convivencia; solo el Centro Peatonal se redujo a 10. |
| Cédula del vehículo | manual PDF 48 | El mismo párrafo dice «vigencia 1 año» y «no tiene vencimiento» (para la persona titular). |
| Fecha de fabricación del neumático | manual PDF 108 | Dice que la semana 17 de 2016 es la «tercera semana de abril», pero corresponde al 25/4–1/5. |
| Referencias normativas | manual PDF 58–59 y 77 | Remite a un «Anexo V» inexistente (las señales están en el IV) y cita la «Ley 2449» (probablemente la 24.449). |
| Calendario de VTV | manual PDF 49 | La infografía por terminación de patente no asigna diciembre ni enero. |

En el material complementario se registraron diferencias entre los anexos I, II y III. Cada una está en `issues.json` con su página:

- **Frenos:** frecuencia de revisión (manual PDF 126 frente a 107).
- **Neumáticos:** carga, profundidad para gran porte y recapados (PDF 127–128 frente a 107–108).
- **Espejos de gran porte:** PDF 129; espejo interno del camión, PDF 173 frente a 174.
- **Cinturón, apoyacabeza y cristales:** PDF 131–133 frente a 112–113 y 118.
- **Matafuegos y botiquín:** PDF 135–136 frente a 120–121.
- **Definición de camión y categoría N1:** PDF 154.
- **Umbral de 12 t («superior» frente a «igual o mayor») y Paseo del Bajo con 9 o 5 puntos:** PDF 168 frente a 149, y glosario, PDF 9.

La propia guía tiene diferencias entre su índice y sus títulos (siniestros PDF 2 frente a 16–17). Los datos de contacto (teléfonos, correos, sitios web y normas citadas) se marcaron `outdated` para verificarlos antes de publicarlos.

**Política:** el catálogo transcribe la fuente tal como está y no corrige discrepancias. Cada actividad que use un dato discrepante debe citar ambas fuentes o la norma verificada y registrar la decisión. Ninguna pregunta puede depender de un dato no resuelto.

## Limitaciones

- La transcripción la hicieron subagentes; el autor verificó por muestreo cuatro páginas críticas y la integridad estructural completa. Por eso el estado global es `transcribed` y no `reviewed`.
- Hay 5 observaciones `illegible`: rótulos menores del mapa de PDF 28, un pictograma de PDF 29, una etiqueta duplicada del mapa de hospitales (PDF 150), los teléfonos de las placas de acarreo (PDF 185) y la señal «Barreras ferroviarias» (PDF 186), que está incompleta en el propio PDF.
- La vigencia normativa no se verificó: es tarea de F05 y F07-T04, según la propuesta (§9).

## Cómo validar

```bash
npm run validate:content   # estructura (Zod) y referencias cruzadas de todos los catálogos, con resumen de cobertura
npm test                   # pruebas de los validadores (src/content/*.test.ts)
```

El validador falla si alguna página de las fuentes auditadas no está clasificada o lo está dos veces, si hay ids duplicados o mal formados, si hay referencias huérfanas en cualquier sentido entre páginas y unidades, si una página instructiva no tiene unidades ni señales, o si algún valor está fuera de su enumeración.

## Uso en fases siguientes

- F02-T02 carga estos catálogos con esquemas formales; los ids son estables.
- F05 convierte las unidades en actividades, resuelve las discrepancias señaladas y lleva cada unidad a `reviewed`, `implemented` y `tested`.
- El catálogo visual del anexo IV (`signs.json`) es la referencia para dibujar las señales del juego y para las actividades de reconocimiento.
