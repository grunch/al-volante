# Recorrido A de Comuna 13 (Núñez)

Entregable de F01-T04. Fecha: 2026-10-11. Estado: **trazado conducible contrastado; maniobras inequívocas; aproximaciones identificadas.**

Define qué calles construir y conducir en el práctico 3D. Los datos están en `route/comuna13-a.json` y `route/comuna13-a.geojson`; sus licencias, en `route/README.md`. Las referencias «recorridos PDF n» y «protocolo PDF n» son páginas físicas de `fuentes/pdf/`.

## 1. Fuentes del trazado

| Fuente | Qué aporta | Verificación |
|---|---|---|
| Documento de recorridos (`recorridos.pdf`, PDF 16; edición 03/2026) | Sede (Av. Cabildo 3067), inicio (Quesada al 2381), recorridos A y B con mapa. Duración de unos 15 min para el recorrido A (PDF 5). | SHA-256 idéntico al publicado hoy en la página oficial del examen práctico (2026-10-11). |
| Protocolo (`protocolo.pdf`, PDF 39; edición 14/09/2023), anexo III | La misma secuencia, con cada paso numerado del 1 al 9 sobre el mapa. Estacionamiento: «Quesada al 2300 (entre Vuelta de Obligado y Av. Cabildo)». | La edición del 13/01/2023 (PDF 38) muestra la misma secuencia y el mismo trazado para Comuna 13. Entre ediciones solo se agregaron los circuitos de las comunas 7 y 11 y se reordenaron las láminas. |
| OpenStreetMap (Overpass API, base 2026-10-11T19:16:50Z) | Geometría, sentidos, carriles, máximas, PARE, sendas, reductores, ciclovías y Metrobús. | Ruteo tramo por tramo respetando la mano única (§4). Licencia ODbL. |
| GCBA, dataset «Cruces semaforizados» (descarga del 2026-10-11) | Semáforos oficiales. | Cotejo de cada intersección del circuito contra OSM (§5). Licencia CC-BY 2.5 AR. |

**Trampa de extracción.** En PDF 16 el texto extraído pone «Recorrido A: Recorrido B:» antes de las dos secuencias, y parece que A fuera la corta. La imagen muestra lo contrario: **A es la secuencia larga** (recuadro izquierdo) y B, la corta (Quesada → Av. Cabildo → Guayra → Cuba → Quesada). El protocolo (PDF 39) también numera los 9 pasos de la secuencia larga. No usar el texto extraído de esa página para la secuencia.

## 2. Secuencia oficial

**Quesada → Av. Cabildo → Guayra → Cuba → Quesada → Cuba → Manuel Ugarte → Vuelta de Obligado → Quesada** (recorridos PDF 16; protocolo PDF 39, pasos 1–9).

## 3. Cuba – Quesada – Cuba: resolución

**No es una repetición ni una vuelta en U: Cuba está desplazada en Quesada.**

- **Desplazamiento:** según OSM, el tramo norte de Cuba (way 86576244, Guayra → Quesada) termina en Quesada en el nodo 180275561. El tramo sur (way 519835126, Quesada → Congreso) empieza en el nodo 92583899, **66 m** más al noreste sobre Quesada. Las dos partes de Cuba son de mano única hacia el sudeste.
- **Maniobra:** por Cuba hacia el sudeste, **izquierda** por Quesada (noreste) unos 66 m, y **derecha** para retomar Cuba hacia el sudeste. El tramo de Quesada entre ambos nodos (way 43340296) es de mano única hacia el noreste, así que la maniobra es legal.
- **Láminas oficiales:** en las dos (recorridos PDF 16; protocolo PDF 39), los pasos 4 y 6 son dos tramos paralelos desplazados, unidos por un tramo corto de Quesada (paso 5). En la lámina de 2026, «Cuba» aparece rotulada en dos posiciones distintas.
- **Ciclovía:** la ciclovía bidireccional de Cuba sigue el mismo desplazamiento (OSM `cycleway:left=track` en los tres ways).
- **Vuelta de Obligado:** también está desplazada en Quesada, unos 46 m (nodos 180274842 y 247921753). El recorrido solo usa su tramo sur, que llega a Quesada en el nodo 180274842.

## 4. Tramos

El inicio (E) está dentro del tramo 1, por eso ese tramo cubre los pasos oficiales 9 (llegada) y 1 (salida). Longitud total del circuito: **1507 m** (1506.8 m). Los ocho tramos se rutearon sobre la red de OSM con sus restricciones de mano única: todos son legales en el sentido indicado y se encadenan nodo a nodo, cerrando el circuito.

| Tramo | Pasos | Calle | Desde → hasta | Sentido | m | Límite de examen (km/h) | Ciclovía a la izquierda | Controles en el tramo | Giro siguiente |
|---|---|---|---|---|---:|---:|---|---|---|
| 1 | 9, 1 | Quesada | Vuelta de Obligado → Av. Cabildo (incluye E) | sudoeste | 127 | 30 | no | semáforo | derecha a Av. Cabildo |
| 2 | 2 | Av. Cabildo | Quesada → Guayra | noroeste | 240 | 45 | no | semáforo, semáforo (GCBA, sin OSM), senda con semáforo | derecha a Guayra |
| 3 | 3 | Guayra | Av. Cabildo → Cuba | noreste | 190 | 30 | no | PARE | derecha a Cuba |
| 4 | 4 | Cuba | Guayra → Quesada | sudeste | 235 | 30 | sí | PARE | izquierda a Quesada |
| 5 | 5 | Quesada | Cuba (norte) → Cuba (sur) | noreste | 66 | 30 | sí | PARE | derecha a Cuba |
| 6 | 6 | Cuba | Quesada → Manuel Ugarte | sudeste | 273 | 30 | parcial (Quesada–Congreso) | reductor (lomo de burro), semáforo | derecha a Manuel Ugarte |
| 7 | 7 | Manuel Ugarte | Cuba → Vuelta de Obligado | sudoeste | 102 | 30 | no | PARE | derecha a Vuelta de Obligado |
| 8 | 8 | Vuelta de Obligado | Manuel Ugarte → Quesada | noroeste | 273 | 30 | no | PARE, semáforo | izquierda a Quesada |

- **Límite de examen:** 30 km/h en calles y 45 km/h en avenidas (`REGLAS.md` §6). Las máximas de OSM (40 en calles, 30 en algunos tramos de Cuba y Quesada, 60 en Cabildo) son iguales o mayores, así que no lo bajan. Esas máximas no se relevaron en terreno: el límite que fija la falla l (máxima de la vía) debe confirmarse en F04-T01.
- **Atributos por subtramo:** cada tramo lista sus `segments`, uno por way de OSM, con ciclovía, máxima y carriles. El resumen `cycleTrack` puede ser `none`, `partial` o `full`. En el tramo 6 la ciclovía solo existe entre Quesada y Congreso (way 519835126, máxima 30); entre Congreso y Manuel Ugarte, OSM indica `cycleway:both=no` (way 10596246, máxima 40).

## 5. Controles y señalización

La columna «Estado» usa los valores de `status` del catálogo: `sources-verified` (coinciden dos fuentes), `single-source` (una sola fuente), `discrepancy` (las fuentes no coinciden), `approximation` (aproximación) y `surveyed` (relevado en terreno).

| Intersección | Control | Fuentes | Estado |
|---|---|---|---|
| Quesada y Av. Cabildo | Semáforo | OSM + GCBA B-CR-03655 | `sources-verified` |
| Av. Cabildo e Iberá | Semáforo; sendas semaforizadas | OSM + GCBA B-CR-03629 | `sources-verified` |
| Av. Cabildo y Guayra | Semáforo | GCBA B-CR-00064; OSM no lo tiene | `discrepancy`: se adopta el dato oficial, a verificar en terreno |
| Guayra y Cuba | PARE en Guayra | OSM | `single-source` |
| Cuba e Iberá | PARE en Cuba | OSM | `single-source` |
| Quesada y Cuba sur | PARE en Quesada | OSM | `single-source` |
| Cuba y Av. Congreso | Semáforo | OSM + GCBA B-CR-03662 | `sources-verified` |
| Cuba antes de Manuel Ugarte | Reductor (lomo de burro) | OSM | `single-source` |
| Manuel Ugarte y Vuelta de Obligado | PARE en Manuel Ugarte | OSM | `single-source` |
| Vuelta de Obligado y Av. Congreso | Semáforo | OSM + GCBA B-CR-03661 | `sources-verified` |
| Vuelta de Obligado y Quesada | PARE en Vuelta de Obligado | OSM | `single-source` |

Las intersecciones internas sin semáforo en OSM (Guayra–Vuelta de Obligado, Cuba–Quesada y las de Manuel Ugarte) tampoco figuran en el dataset del GCBA: las dos fuentes coinciden en que no tienen semáforo. Donde no hay PARE ni semáforo rigen las prioridades generales (manual, cap. 3).

**Contexto que el examen evalúa:**

- **Metrobús Norte** por el centro de Av. Cabildo: carriles exclusivos. Invadirlos es la eliminatoria j (`REGLAS.md`). El recorrido usa la calzada noreste de Cabildo y gira a la derecha, sin cruzar el Metrobús.
- **Ciclovías:** bidireccional sobre el lado izquierdo de Cuba y del empalme de Quesada, más las de Iberá y Congreso, que el circuito cruza. Los giros de los tramos 4→5 y 5→6 son el escenario natural de «ceder el paso a ciclistas» (def. alta l) y de «ubicarse en el carril más próximo al giro» (def. alta n).
- **Av. Congreso** es avenida y se cruza con semáforo en los tramos 6 y 8.
- **Estacionamiento paralelo** en ambos lados de Vuelta de Obligado, Manuel Ugarte y Cuba sur (OSM `parking:*`), relevante para elegir el carril de giro (`REGLAS.md`, def. alta n).

## 6. Geometría métrica

- **Proyección:** equirectangular local con origen en el nodo OSM 437539782 (Quesada y Av. Cabildo; lat −34.554415, lon −58.463435). x apunta al este, y al norte, en metros. Escalas del elipsoide **WGS84** en la latitud del origen: `metersPerDegLat = 111132.92 − 559.82·cos 2φ + 1.175·cos 4φ − 0.0023·cos 6φ = 110932.417` y `metersPerDegLon = 111412.84·cos φ − 93.5·cos 3φ + 0.118·cos 5φ = 91780.235`. Entonces `x = (lon − lon0) · metersPerDegLon` y `y = (lat − lat0) · metersPerDegLat`.
- **Precisión verificada:** cada tramo se comparó con la suma de distancias geodésicas de Vincenty sobre WGS84. La peor diferencia por tramo es de 0,021 %, que corresponde al redondeo a décimas; el circuito completo difiere en 0,002 % (1506,78 m geodésicos). La primera versión usaba factores esféricos aproximados (110540 y 111320·cos φ), que comprimían las escalas un 0,35 % en latitud y un 0,11 % en longitud. Se corrigió por la revisión de Codex en #4.
- **Datos:** cada punto de la ruta guarda lat/lon y x/y. El validador exige coordenadas numéricas finitas y comprueba:
  - que lat/lon y x/y coincidan (tolerancia de 0,5 m);
  - que las longitudes cuadren y los tramos sean continuos;
  - que la secuencia sea la oficial;
  - que los subtramos cubran cada tramo;
  - que cada giro declarado coincida con el **calculado desde la geometría** de los tramos adyacentes (tolerancia de 5°).

## 7. Aproximaciones y pendientes

Ningún dato está relevado en terreno. Lo que sigue **no** debe presentarse como verificado:

| Elemento | Estado | Tratamiento |
|---|---|---|
| Posición del cajón de inicio y fin (Quesada al 2300–2381) | aproximación | Sabemos la cuadra (entre Vuelta de Obligado y Cabildo, tramo 1), pero no el lado ni la posición exacta. La consulta de numeración en OSM no devolvió datos. Fijarlo en F04-T01; hasta entonces, mostrarlo como aproximación. |
| Medidas del cajón | aproximación | El gráfico 4 del protocolo da 6 m de largo y franjas; el ancho no figura (`REGLAS.md`, V5). |
| PARE, reductor, máximas, cantidad de carriles | fuente única (OSM) | Contrastar en F04-T01 con relevamiento o imágenes de calle autorizadas y registrar la evidencia. |
| Semáforo de Cabildo y Guayra | discrepancia | Se adopta el dato del GCBA; verificar. |
| Fachadas, árboles, comercios, mobiliario | ambiental | Se reconstruyen como aproximación estilizada (propuesta §4); no afectan la evaluación. |

Ninguna de estas aproximaciones cambia la secuencia, los sentidos ni el tipo de maniobra de cada giro: esos tres datos se sostienen en las láminas oficiales y en la red de OSM.

## 8. Otros circuitos (material de consulta)

El documento de recorridos (PDF 6–19) incluye circuitos A y B para las comunas 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14 y 15, y para la sede ACA Libertador. El protocolo de septiembre de 2023 (PDF 34–40) incluye los de las comunas 2–7 y 9–15. Esos circuitos se ofrecen como consulta en F05-T04; solo Comuna 13 A se reconstruye en 3D.

## 9. Cómo validar y regenerar

```bash
npm run validate:content   # secuencia, continuidad, proyección, longitudes, límites y estados (y el resto de los catálogos)
npm test                   # pruebas de los validadores (src/content/validateRoute.test.ts)
```

Los datos se generaron con consultas Overpass sobre la caja `(-34.5585,-58.4690,-34.5500,-58.4570)`: todas las `way["highway"]` con `out body geom`, y los nodos `highway~traffic_signals|stop|give_way|crossing|bus_stop` y `traffic_calming`. El ruteo de cada tramo usa Dijkstra restringido a ways con el nombre de la calle del tramo, respetando `oneway`. Para regenerarlos con una base OSM posterior, repetir las consultas y volver a correr el validador. Cualquier cambio de sentido o de conectividad debe registrarse aquí antes de modificar la escena.
