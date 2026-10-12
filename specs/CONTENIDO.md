# Contenido pedagógico: autoría, revisión y cobertura

Entregable de la fase 5 (iniciada el 2026-10-12). Define cómo se convierten las unidades del catálogo (`COBERTURA.md`) en actividades, cómo se revisa cada unidad contra la fuente, qué significa cada estado y qué se decidió ante cada discrepancia. El estado vivo de las tareas está en `ESTADO_IMPLEMENTACION.md`.

## Archivos

| Archivo | Contenido |
|---|---|
| `catalog/activities/<fuente>-<sección>.json` | Actividades de una sección (`manual-ch1`, `manual-glossary`, `siniestros-s1`…). Una actividad vive en el archivo de la sección de **su primera unidad**; el validador lo exige. |
| `catalog/figures.json` | Recortes de páginas de los PDF oficiales: fuente, página, caja en fracciones de la página, descripción accesible y unidades que ilustran. |
| `../public/figures/*.png` | Imágenes de esos recortes, generadas con `node scripts/crop-figures.ts` (requiere poppler). Se versionan porque la aplicación estática las sirve. |
| `catalog/units.json` | Las unidades, con su estado y, si son de consulta, `consultationReason`. Las correcciones de la revisión quedan en el propio registro y se anotan en `notes`. |

Las figuras recortan el mismo material oficial que el repositorio ya incluye en `fuentes/pdf/` para estudio (ver README): no son material propio ni oficial del proyecto.

## Estados y tratamiento

Escala común (`COBERTURA.md`): `pending` → `transcribed` → `reviewed` → `implemented` → `tested`. En la fase 5 cada estado tiene un significado verificable, que `validateTreatment` controla:

| Estado | Significado | Regla del validador |
|---|---|---|
| `transcribed` | Extraída en F01-T02, sin revisar unidad por unidad. | — |
| `reviewed` | Contrastada contra la **imagen** de su página (y el texto extraído), con las correcciones aplicadas. | Una unidad de consulta tiene que estar al menos revisada. |
| `implemented` | Revisada y con tratamiento: practicada por una actividad revisada o declarada de **consulta** con su motivo. | Sin actividad ni motivo de consulta, no puede estar `implemented`. |
| `tested` | Practicada por actividades revisadas, que la prueba de recorrido del catálogo responde bien y mal variante por variante. | Solo las actividades llevan a `tested`; una unidad practicada no puede quedar por debajo de `implemented`. |

- Las actividades en borrador (`draft`) no cuentan como cobertura.
- Cada actividad cita al menos una página de **cada** unidad que practica (trazabilidad de la devolución).
- Las señales siguen la misma escala a través de las actividades de identificación.
- `src/content/catalogPlaythrough.test.ts` es la «prueba» de `tested`: muestra cada variante con alguna semilla sin revelar la respuesta, responde cada opción (o el orden correcto e invertido, o cada camino de la escena) y comprueba la corrección y la devolución.

**Consulta.** Una unidad queda como consulta cuando su contenido no se puede evaluar con justicia (datos de contacto, listados que pueden estar desactualizados o contenido que depende de un dato excluido por una decisión). Se estudia en su página de sección y en la biblioteca, con el motivo visible. No se evalúa ni cuenta para el dominio.

## Método de revisión

1. Por cada unidad, se mira la imagen de su página (`pdftoppm`, 80–90 ppp; recortes a más resolución cuando hace falta) y el texto extraído (`pdftotext -layout`). El texto solo pierde infografías, tablas y rótulos.
2. Se corrige el título, el resumen o los datos clave que no sean fieles a la página. No se agrega conocimiento externo. La corrección queda anotada en `notes` («Revisada contra PDF n (F05-Txx): …»).
3. Se escriben las actividades y se decide el tratamiento de cada unidad.
4. El trabajo de cada tarea se reparte en lotes por páginas, que escriben subagentes con una guía común. El autor integra los lotes, corre los validadores y revisa por muestreo contra la fuente. Ningún lote modifica el repositorio directamente.

## Reglas de autoría

- **Tipos:** `single-choice` para definiciones y datos; `ordering` solo para procedimientos cuyo orden fija la fuente; `decision` para conductas en situación; `sign-identification` para señales (desde F05-T02).
- **Una sola respuesta defendible** según la página citada. Distractores plausibles pero claramente incorrectos para quien estudió esa página; sin «todas/ninguna de las anteriores» ni opciones que se delaten por su largo.
- **Devolución por opción:** la correcta confirma y explica; cada incorrecta dice por qué no y cuál es el dato correcto. La `explanation` enseña la regla completa con su cita.
- **Español rioplatense con voseo**, claro y breve. Ids y claves en inglés.
- **No se pregunta** por URLs, teléfonos (salvo los de emergencia verificados), correos, direcciones, números de artículo, fechas de normas ni estadísticas exactas.
- **Glosario:** «diccionario interactivo»; los distractores son definiciones de otros términos del mismo glosario.
- **Figuras:** solo las que enseñan (infografías, tablas, diagramas), mostradas con la devolución porque pueden contener la respuesta. Cada una tiene descripción accesible con sus datos.
- El banco es propio, revisado contra las fuentes; no se presenta como oficial ni afirma vigencia normativa que no se verificó.

## Decisiones sobre discrepancias

Política (`COBERTURA.md`): ninguna pregunta depende de un dato no resuelto. Cuando dos fuentes difieren se evalúa lo que comparten o la versión verificada, y la diferencia se explica citando ambas. Las verificaciones externas indican fecha y fuente.

### F05-T01

- **D-T01-1 Velocidad en calles de prioridad peatón / convivencia** (manual PDF 26, ficha 10 km/h vs nota 20 km/h): no evaluar esa velocidad. Sí se evalúa qué es cada tipo de calle y quién puede circular.
- **D-T01-2 Áreas con prioridad peatonal** (PDF 28: seis áreas en el texto, dos en el mapa): no evaluar el listado de áreas.
- **D-T01-3 «Cuatro autos menos»** (PDF 41): no evaluar la cantidad; sí el concepto de compartir el auto.
- **D-T01-4 Teléfonos de emergencia** (manual PDF 52: 107 y luego 911; guía PDF 7, 9, 10: 911): verificado el 12/10/2026 en el sitio oficial ([página del SAME](https://buenosaires.gob.ar/gcaba_historico/salud/informacion-para-los-ciudadanos/same), «Teléfonos útiles»): **107 = SAME (emergencias médicas)** y **911 = Policía**. Se puede evaluar: con heridos, llamar al 107 (SAME) para la emergencia médica y al 911 para dar intervención a la policía. No evaluar que el 911 «centraliza Policía Federal» (desactualizado: en CABA la seguridad está a cargo de la Policía de la Ciudad).
- **D-T01-5 Balizas portátiles** (manual PDF 51 vs guía PDF 8): en ciudad ambas fuentes coinciden en 30 m y 60 m detrás del vehículo; eso se evalúa. Las distancias en ruta (50/100 m vs ~90 m) y la ubicación delante/detrás en ruta no se evalúan.
- **D-T01-6 Túneles y estructura Proteger-Alertar-Socorrer** (solo manual PDF 51–53): se evalúa citando el manual; la guía no lo contradice, solo lo omite.
- **D-T01-7 Primeros auxilios** (manual PDF 53 con excepciones vs guía PDF 10 sin excepciones): rige el manual (material del examen de la categoría B); la guía no lo contradice, es menos detallada. Se puede evaluar la regla general (no mover a la persona herida, no retirarle el casco) y las excepciones del manual citándolo.
- **D-T01-8 Datos a recabar, vehículo estacionado, testigos** (manual PDF 53–54 vs guía PDF 11–12): evaluar lo que comparten; lo exclusivo de una fuente se evalúa solo citándola expresamente («según la guía…») y sin contradecir a la otra.
- **D-T01-9 Contactos de organismos y ONG** (manual PDF 54–55, guía PDF 22–23): no evaluar teléfonos, correos, sitios ni nombres exactos de oficinas. Lo evaluable es la existencia y función de esos espacios; los datos de contacto quedan como consulta.
- **D-T01-10 Alcohol del principiante** (PDF 47: 0,0 g/l durante los dos años): evaluable (cualquier norma posterior de alcohol cero no lo cambia). Los límites generales de alcohol (cap. 4) no son de este lote.
- **D-T01-11 Cédulas del vehículo** (PDF 47–48, vigencias y colores ambiguos): no evaluar vigencias ni colores de cédula; sí que el vehículo debe circular con su documentación.
- **D-T01-12 VTV** (PDF 49): los plazos y la frecuencia de la VTV en CABA están cambiando (búsqueda del 12/10/2026: fuentes periodísticas contradictorias sobre la primera verificación y la vigencia, y una reforma legislativa de estado incierto; no se encontró una página oficial actualizada), y la infografía por terminación de patente no asigna diciembre ni enero. No evaluar plazos, frecuencias ni calendario; sí qué es la VTV y para qué sirve, según el manual.
- **D-T01-13 Unidad fija y Código Penal** (PDF 44–45): evaluar los tipos de responsabilidad y sus ejemplos; no evaluar el valor de la unidad fija, números de artículo ni años de pena.
- **D-T01-14 Estadísticas** (PDF 15, OSV 2022 sin año de referencia): solo conceptos (quiénes son los usuarios más afectados), atribuyéndolos al informe que cita el manual; no evaluar porcentajes ni cifras.
- **D-T01-15 Plan de seguridad vial 2020-2023 y referencias a sitios** (PDF 15–18 y notas al pie): no evaluar.
- **D-T01-16 Guía, plazos de reclamo** (guía PDF 14: 3 años ante el tercero, 1 año ante la propia aseguradora; 72 h para avisar, que coincide con el manual PDF 53): evaluable citando la guía.
- **D-T01-17 Guía, proceso penal** (PDF 17–21: fuero, querella, transferencia de 2018): evaluar solo conceptos generales (qué es la mediación, la demanda civil, la denuncia penal); no evaluar fueros, códigos procesales ni la transferencia.
- **D-T01-18 Scoring** (manual PDF 55: 20 puntos iniciales, curso de 4 puntos, reasignación del 50 % y de 10 puntos, inhabilitación de 60 días a 5 años): evaluable. Verificado el 12/10/2026: la [página oficial del sistema de evaluación permanente de conductores](https://buenosaires.gob.ar/jefaturadegabinete/movilidad/licencias-de-conducir/scoring) confirma los 20 puntos iniciales; la recuperación de puntos y los plazos de inhabilitación coinciden en notas periodísticas de 2026 y no se confirmaron en una página oficial.

Observaciones nuevas encontradas al revisar (agregadas a `catalog/issues.json`, que pasa de 206 a 214): límite de 13 m entre calle y avenida (glosario PDF 5–6), pictogramas de PDF 23 y 29, horario de la calle prioridad peatón (PDF 26 y 29), edad de 12 años en veredas (PDF 33), picadas como contravención (PDF 45), balizas en doble sentido (manual PDF 51 frente a guía PDF 8) y documentos a intercambiar (manual PDF 53 frente a guía PDF 7). Ninguna pregunta depende de ellas.

## Cobertura por tarea

| Tarea | Secciones | Unidades | Probadas | De consulta | Actividades nuevas | Figuras |
|---|---|---:|---:|---:|---:|---:|
| F05-T01 | Presentación, glosario, introducción, cap. 1–2 y guía de siniestros | 260 | 254 | 6 | 105 (351 variantes) | 23 |

Además, en F05-T01 se revisaron contra sus páginas las 14 unidades (cap. 1, 3 y anexo IV) y las 4 señales que practican las 8 actividades de la fase 2; quedan `tested`.

## Cómo validar

```bash
npm run validate:content                              # esquemas, referencias, figuras y estados de tratamiento
npx vitest run src/content                            # validadores, recorrido del catálogo y política de contenido
node scripts/crop-figures.ts [id …]                   # regenera los recortes (poppler e ImageMagick)
```

