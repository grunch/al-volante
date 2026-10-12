# Ciudad 3D — F04-T01 y tránsito F04-T02

## Alcance

`#/recorrido` permite explorar las ocho partes del recorrido A o conducir desde una entrada de cada tramo, con caja manual o automática. La vista aérea muestra una cuadra o el circuito completo; el mapa conserva norte arriba y una escala de 100 m. El habitáculo y sus tres espejos usan el mismo mundo 3D. Desde F04-T02 la conducción lleva tránsito por semilla y semáforos con ciclo; la página informa que la evaluación del circuito completo corresponde a F04-T03–T05 y que nada se puntúa. `#/examen` conserva el primer tramo evaluado de F03.

## Tránsito (F04-T02)

Desde F04-T03 `#/examen` corre sobre esta ciudad con el tránsito y evalúa la circulación completa (ver ARQUITECTURA, «Examinador del circuito»); `#/recorrido` sigue siendo exploración sin puntaje. `src/traffic/` deriva de las calles una red de encrucijadas, aproximaciones, sendas y trayectorias, y mueve autos, colectivos (Metrobús), bicicletas (ciclovía) y peatones de forma determinista según una semilla editable en la página (por defecto 1). Reglas con respaldo documental que respetan los actores: semáforos, PARE (que pierde la prioridad) y prioridad de la derecha con su excepción 4 (`fuentes/pdf/manual.pdf`, PDF 64); distancia de dos segundos (`fuentes/pdf/manual.pdf`, PDF 71); detenerse ante peatones en la senda (`fuentes/pdf/manual.pdf`, PDF 64). Que los peatones crucen en su fase o en brechas es una aproximación del juego. Se activan solo a 250 m del auto, con un tope de 60. Los sentidos de las calles de contexto, el doble sentido del Metrobús, de Congreso y de la ciclovía, las duraciones de los semáforos y las distancias de los actores son aproximaciones declaradas; las fuentes de cada regla y el detalle del diseño están en [ARQUITECTURA.md](ARQUITECTURA.md), «Tránsito del circuito». Las líneas de detención del tránsito y del examinador son geométricas; en tres semáforos de media cuadra pueden no coincidir con la pintura de F04-T01. Es una limitación vigente, sin tarea asignada.

F04-T01 se inició con «arranca con F04 T01»; el usuario autorizó después F04-T02–T05 («ya está el pr de F04 T01, haz el resto de tareas de esta fase»), registrado en `ESTADO_IMPLEMENTACION.md`. La rama de T01 parte de `main` e incorporó las fusiones de #19–#21 sin modificar sus ramas.

## Fuentes y geometría

- Catálogo de entrada: `route/comuna13-a.json`, validado por `ContentGate`. Conserva todas las coordenadas, ocho tramos, 14 controles y evidencias. Secuencia: `fuentes/pdf/recorridos.pdf`, PDF 16, y `fuentes/pdf/protocolo.pdf`, PDF 39. Se cotejó nuevamente la lámina renderizada con la vista del circuito.
- Conversión a Three.js: `x = x` del catálogo (este), `z = -y` (norte hacia −z). No se rota, refleja ni comprime el trazado. El circuito conserva 1506,8 m (`loopLengthM` del catálogo; verificación geodésica en [RECORRIDO.md](RECORRIDO.md) §6); Cuba–Quesada–Cuba conserva el desplazamiento de unos 66 m (OSM, nodos 180275561 y 92583899; [RECORRIDO.md](RECORRIDO.md) §3) y los giros izquierda/derecha (`fuentes/pdf/recorridos.pdf`, PDF 16).
- Cada arista mantiene carriles, ciclovía y máxima OSM del subtramo (`legs[].segments` del catálogo; [RECORRIDO.md](RECORRIDO.md) §4), separados del límite de examen (30/45 km/h, `fuentes/pdf/protocolo.pdf`, PDF 8, 10 y 28). La ciclovía de Cuba termina en Congreso, según el catálogo; no se propaga a Manuel Ugarte.
- Los cruces de Iberá y Congreso, la conexión corta de Quesada y Vuelta de Obligado norte se interpolan entre nodos del catálogo. Las prolongaciones ambientales no pertenecen al itinerario oficial y no tienen sentidos ni máximas inventados.
- El Metrobús y la calzada opuesta se dibujan a la izquierda de la calzada noreste de Cabildo. Sus separaciones y anchos son aproximaciones, sin evaluación de invasión de carril en esta tarea.
- Los controles conservan su posición de fuente (`controls[]` del catálogo, con evidencia OSM o GCBA por control; [RECORRIDO.md](RECORRIDO.md) §5). La ubicación del poste en la vereda y su retranqueo de hasta 9 m son aproximaciones de representación; no reemplazan la coordenada original ni acreditan la ubicación de una línea real de detención.

## Aproximaciones que siguen abiertas

No hubo relevamiento en terreno. El 2026-10-12 se recibieron 35 capturas de Street View para referencia visual (ver [REFERENCIAS_VISUALES.md](REFERENCIAS_VISUALES.md)); sus fechas de imagen varían y no acreditan vigencia de PARE, reductor, máximas o cantidad de carriles. La consulta adicional al [dataset oficial de cruces semaforizados](https://data.buenosaires.gob.ar/dataset/cruces-semaforizados) confirma su disponibilidad, pero no resuelve los datos ajenos a ese dataset. Se conserva `single-source` o `discrepancy` donde corresponde; no se elevó ningún estado a `surveyed`.

Cada fila indica qué dato tiene respaldo y qué parte es aproximación del juego. Los datos respaldados vienen del catálogo `route/comuna13-a.json` (OSM y GCBA, ver [RECORRIDO.md](RECORRIDO.md) §1, §4 y §5) o del protocolo; todo lo demás es diseño.

| Elemento | Implementación y límite |
|---|---|
| Calzada de Cabildo | Respaldado: dos carriles (OSM, [RECORRIDO.md](RECORRIDO.md) §4). Aproximación: 7 m de ancho. |
| Otras calzadas | Respaldado: cantidad de carriles cuando OSM la informa ([RECORRIDO.md](RECORRIDO.md) §4). Aproximación: al menos 8,8 m, 3,2 m por carril más espacio lateral; sin dato, un carril. |
| Ciclovía izquierda | Respaldado: presencia y lado (OSM `cycleway:left=track`, [RECORRIDO.md](RECORRIDO.md) §3–§4). Aproximación: 2,6 m de ancho y los separadores. |
| Vereda | Aproximación: unos 2,5 m y cordón de 15 cm, recortada en cruces. Sin fuente. |
| Cajón | Respaldado: largo exterior de 6 m (gráfico 4, `fuentes/pdf/protocolo.pdf`, PDF 21). Aproximación: posición a 20 m del comienzo del tramo 1, lado derecho y ancho de 2,4 m. No es un relevamiento de Quesada 2381. |
| Entrada de otros tramos | Aproximación: a 18 m del comienzo, en carril derecho cuando hay dos. No representa una posición oficial de examen. |
| Cabildo y Guayra | Respaldado: el semáforo del dataset GCBA de cruces semaforizados, con su discrepancia frente a OSM ([RECORRIDO.md](RECORRIDO.md) §5 y §7). |
| Edificios, comercios, árboles | Aproximación: geometría procedural original, determinista y estilizada. Desde F04-T01-FIX01 se inspira en las 35 referencias del usuario; no representa fachadas medidas ni cada parcela real. |

Las máximas pendientes no se convierten en señalética oficial ni en reglas nuevas de evaluación. Su confirmación sigue necesaria antes de presentar el circuito como reproducción vigente para rendir. Las licencias y atribuciones se muestran en la pantalla: OpenStreetMap/ODbL y GCBA/CC-BY 2.5 AR. No se incorporaron activos externos ni nuevas dependencias.

## Organización y rendimiento

- `src/city/model.ts`: conversión métrica, aristas, contexto, entradas y colisiones estáticas. Los recortes de cordón consideran toda su caja y las vías que cruzan, no solo el centro.
- `streetscape.ts`, `frontages.ts`, `streetFurniture.ts`, `geometry.ts`, `palette.ts`, `signage.ts`: sistema visual de cuadras, materiales, fachadas, árboles, carriles, ciclovías y controles. Las piezas se agrupan con `InstancedMesh` por forma y material dentro de cada sector.
- `sectors.ts` y `scene.ts`: sectores de 128 m; se cargan a 220 m y se descargan después de 270 m, más allá de la niebla que termina a 170 m. Se conservan también los sectores detrás del auto para los espejos. Salir de un sector libera geometrías, materiales, texturas e instancias; volver los reconstruye de manera determinista. La vista completa carga todos y los libera al salir.
- Las colisiones permanecen disponibles aunque un sector visual no esté cargado. `stepWorld` rechaza primero pares cuyas circunferencias envolventes no se tocan, antes del SAT; no modifica el resultado de colisión.
- `DrivingCanvas` admite una fábrica de escena y subtítulo opcionales. El comportamiento por defecto del predio y del examen se conserva. El adaptador de ciudad reutiliza habitáculo, controles, transmisión, espejos y reinicio.
- La vista aérea dibuja solo al entrar, cambiar de tramo o tamaño. Ajusta el plano cercano al ver el conjunto para evitar parpadeos por precisión de profundidad. Las piezas largas se dividen antes de asignar sectores.

## Comprobaciones

Las pruebas comprueban coordenadas, escala, cierre, giros, carriles/ciclovías por subtramo, evidencia de controles, entradas sin colisión, cajón de 6 m y ciclo de carga/descarga de recursos. Un conductor de prueba por seguimiento de trayectoria recorre el circuito completo usando `stepWorld` a 120 Hz, el límite real de dirección y sin teletransportes ni contactos con cordones. Esa prueba acredita transitabilidad geométrica, no circulación legal ni evaluación de todas las maniobras.

Playwright recorre los ocho selectores, revisa atribuciones y fuentes, conduce con teclado y restaura la posición, en escritorio y Pixel 7. El caso independiente de rendimiento adjunta tiempos entre cuadros, dimensiones, DPR, motor gráfico y sectores activos; el resultado no equivale a certificar 60 FPS en hardware de referencia. Validaciones y mediciones concretas se registran en `ESTADO_IMPLEMENTACION.md` y en el PR.

### Medición local del habitáculo

Ejecución del 2026-10-12 UTC, producción, un worker, AMD Ryzen 7 4800H, Chromium 153 con ANGLE/SwiftShader Vulkan (renderizado por software), 15 sectores activos y tres espejos. Ventana de unos 5 segundos, auto quieto en la entrada de Quesada:

| Perfil | Ventana / DPR | Cuadros | Media | Percentil 95 |
|---|---|---|---|---|
| Escritorio | 1280 × 720 / 1 | 29 en 5178 ms | 178,13 ms (~5,6 FPS) | 200 ms |
| Pixel 7 emulado | 412 × 839 / 2,625 | 36 en 5007 ms | 138,85 ms (~7,2 FPS) | 166,6 ms |

**El objetivo de 60 FPS no se alcanzó en este entorno.** La emulación no mide un teléfono real ni una GPU física. Es una limitación de la validación y una referencia reproducible para el trabajo de rendimiento de F07; no se presenta como presupuesto aprobado. La vista aérea es estática y no consume un bucle continuo cuando no cambia.

## Referencias visuales — F04-T01-FIX01

Mejora puntual autorizada mientras Opus implementa la fase 5 en otro árbol de trabajo. Se desarrolla en una rama independiente desde `main`, sin iniciar la fase 6. Inventario de imágenes, criterios visuales y límites en [REFERENCIAS_VISUALES.md](REFERENCIAS_VISUALES.md). El entorno incorpora balcones, comercios, casas bajas, arboleda y refugios del Metrobús; las dimensiones siguen siendo aproximadas. `lighting.ts` mantiene una sombra local de 1024 × 1024, actualizada al cambiar una celda de 24 m o cargar/descargar sectores, para no recalcularla en cada cuadro. Los materiales se agrupan por forma y superficie, con color por instancia.

Medición de F04-T01-FIX01 sobre `5f8f226` (2026-10-12, mismo equipo/Chromium/SwiftShader, producción, 15 sectores, tres espejos y tránsito): escritorio 1280 × 720, DPR 1, 7 cuadros en 5472 ms, media 778,19 ms y p95 1000 ms; Pixel 7 emulado 412 × 839, DPR 2,625, 8 cuadros en 5209 ms, media 648,01 ms y p95 833,3 ms. El render por software sigue siendo lento; las cifras históricas de F04-T01 no son una comparación controlada porque entonces no corría el tránsito del circuito. No se midió GPU física y no se acredita el objetivo de FPS.
