# Referencias visuales del recorrido A

## Procedencia y alcance

El usuario entregó 35 capturas el 2026-10-12 y aclaró que el orden cronológico de los nombres empieza y termina en el mismo punto de Quesada. Se inspeccionaron todas y se cotejaron los nombres visibles con la secuencia de [RECORRIDO.md](RECORRIDO.md): Quesada → Av. Cabildo → Guayra → Cuba → Quesada → Cuba → Manuel Ugarte → Vuelta de Obligado → Quesada. La secuencia oficial conserva como fuentes `fuentes/pdf/recorridos.pdf`, PDF 16, y `fuentes/pdf/protocolo.pdf`, PDF 39.

Son capturas de Google Street View, con atribuciones y fechas de imágenes diferentes; la fecha del archivo es la de captura de pantalla. No constituyen un relevamiento de octubre de 2026. Se usan como referencia visual; no se incorporan las capturas, rostros, patentes, logotipos ni texturas extraídas al repositorio o a la aplicación. La geometría y los materiales del juego son originales y procedurales. Los originales permanecen fuera de Git; quien reproduzca esta comparación necesita la colección proporcionada por el usuario.

## Inventario cronológico

Todos los archivos tienen el patrón `Screenshot_2026-10-12_HH-MM-SS.png`. La columna de horas identifica cada archivo individual, en orden. La asociación con el tramo combina los rótulos visibles, la continuidad de las capturas y el recorrido documentado; no aporta coordenadas medidas de las fachadas.

| Tramo | Horas, en orden | Rasgos observados usados como referencia |
|---|---|---|
| 1. Quesada, salida hacia Cabildo | 12-15-06, 12-15-20 | Edificios de ladrillo con balcones claros a la izquierda, frentes más bajos a la derecha, locales vidriados, árboles y vallas blancas junto al estacionamiento. |
| 2. Av. Cabildo | 12-15-36, 12-15-51, 12-16-11, 12-16-27, 12-16-39 | Avenida comercial, alturas variadas, balcones y toldos; a la izquierda corredor central de Metrobús con isletas, barandas oscuras y refugios alargados con bandas amarillas. |
| 3. Guayra | 12-16-54, 12-17-03, 12-17-13, 12-17-28 | Mezcla de casas bajas y departamentos, portones, ladrillo y revoque claro, árboles y casa con cubierta de tejas al llegar a Cuba. |
| 4. Cuba hasta Quesada | 12-17-43, 12-17-53, 12-18-08, 12-18-34, 12-18-43, 12-18-54 | Frentes residenciales variados, ciclovía a la izquierda, vegetación y encuentro en T con Quesada. |
| 5. Quesada, desplazamiento entre ambas ramas de Cuba | 12-19-07, 12-19-18 | Departamentos y comercio de esquina; continuidad del breve enlace con giro izquierdo y luego derecho. |
| 6. Cuba hacia Manuel Ugarte | 12-20-40, 12-20-49, 12-20-57, 12-21-10, 12-21-28 | Arboleda alta, balcones; cambio al cruzar Congreso; esquina comercial baja verde azulada y toldos claros en Ugarte. |
| 7. Manuel Ugarte | 12-21-47, 12-21-54, 12-22-05 | Casas antiguas claras mezcladas con departamentos y acceso a Vuelta de Obligado. |
| 8. Vuelta de Obligado | 12-22-19, 12-22-26, 12-22-34, 12-22-46, 12-22-53 | Arboleda más envolvente, garajes, mezcla de alturas y casa de cubierta inclinada frente al encuentro con Quesada. |
| Regreso al tramo 1 | 12-23-05, 12-23-51, 12-23-58 | Reaparecen balcones de ladrillo y vallas de Quesada. El usuario identifica la última captura con el punto de partida. |

## Traducción al juego — F04-T01-FIX01

- `src/city/frontages.ts`: perfiles por tramo y lado, plantas bajas comerciales o con garajes, balcones con profundidad, persianas, cornisas, azoteas y árboles con ramas y copas agrupadas. Tres esquinas bajas se inspiran en las referencias de Guayra–Cuba, Cuba–Ugarte y Obligado–Quesada. Sus posiciones y dimensiones son aproximadas dentro del modelo existente.
- `src/city/streetFurniture.ts`: refugios y barandas del Metrobús, placas con los nombres del catálogo y vallas blancas en los extremos del cajón ya modelado. Los nombres Quesada e Iberá identifican visualmente los refugios; sus longitudes y ubicaciones se estiman para el escenario, sin relevamiento de andenes.
- `src/city/geometry.ts`: color por instancia, materiales diferenciados y grano y juntas procedurales del ladrillo. No usa imágenes como texturas.
- `src/city/lighting.ts`: iluminación de día y sombras locales de edificios y vegetación sobre el pavimento. El mapa de sombras se actualiza al cambiar la zona o los sectores, y se comparte con el habitáculo y sus espejos.
- `CityPreview.tsx`: cámara elevada para mostrar la calzada entre los edificios más altos. La vista completa conserva norte y escala.

El resultado es una interpretación estilizada más próxima al carácter de las calles. No reproduce cada parcela ni equivale a fotogrametría. Alturas, colores, anchuras, separación de árboles, modelos de luminaria y posición de comercios son aproximaciones. No se cambia la geometría de conducción, la posición evaluada del cajón, las colisiones, las reglas, el tránsito ni las evidencias del catálogo. Las vallas son detalle visual, sin colisión adicional.

Las fotos muestran detalles que todavía difieren del modelo: el pintado verde de la ciclovía se concentra en ciertos cruces, mientras el juego mantiene su banda verde continua; hay autos estacionados y cableado que no se reconstruyen. Las señales visibles no se convierten automáticamente en reglas vigentes. No se eleva ninguna evidencia a `surveyed` por estas capturas.

## Verificación

`src/city/environment.test.ts` comprueba reproducibilidad sin mutar las calles, despeje de calzadas y ciclovías por las fachadas, refugios fuera de carriles, colores y transformaciones del agrupamiento por instancias y actualización/liberación de sombras. Las pruebas de ciudad existentes conservan la transitabilidad del circuito y la liberación de sectores, materiales y espejos. El registro operativo y el PR documentan los resultados de la suite, capturas y mediciones del navegador; no se considera certificada la meta de 60 FPS.

## Revisión de experiencia — F04-T01-FIX02

Después de fusionar #31, el usuario pidió mejorar también el manejo. Se volvió a observar la colección y se añadió asfalto con grano, veredas con juntas, copas con huecos y siluetas reconocibles para los actores existentes. La cabina, cámara y asistencia de teclado se describen en [EXPERIENCIA_CONDUCCION.md](EXPERIENCIA_CONDUCCION.md). Todas sus magnitudes son ajustes de presentación o de interfaz, no mediciones obtenidas de estas imágenes.

## Nueva revisión y modelado en Blender — F04-T01-FIX03

Después de fusionar #34, se revisaron nuevamente las 35 referencias en orden cronológico. Se tomó como guía el detalle de ramas y follaje, barandas abiertas, marcos de ventanas y equipos de fachada. Blender 5.2 produjo doce familias originales de modelos y los campos de altura de pavimento y vereda. Se integraron también autos, colectivos, personas, bicicletas y carcasas de semáforos más detallados. Las piezas genéricas, como tapas, rejillas o llantas, mejoran la lectura visual sin atribuirles una ubicación o medida relevada.

La fuente reproducible, las comparaciones de la aplicación, la procedencia de los recursos y los límites están en [DETALLE_GRAFICO_BLENDER.md](DETALLE_GRAFICO_BLENDER.md). Se mantienen las aproximaciones y exclusiones descritas arriba; ninguna referencia se convirtió en una nueva regla de examen ni en evidencia `surveyed`.
