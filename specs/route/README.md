# Datos del recorrido

| Archivo | Contenido |
|---|---|
| `comuna13-a.json` | Recorrido A de Comuna 13: tramos, geometría (lat/lon y coordenadas locales en metros), giros, límites de examen, controles de tránsito y estado de verificación de cada elemento. |
| `comuna13-a.geojson` | Los mismos tramos y controles en GeoJSON. GitHub lo muestra como mapa. |

Validar con `npm run validate:content` (todos los catálogos, incluido este recorrido). La documentación está en [`../RECORRIDO.md`](../RECORRIDO.md).

## Licencias y atribución

- **Geometría, sentidos, carriles, máximas, PARE, sendas, reductores, ciclovías y Metrobús:** datos derivados de OpenStreetMap, © colaboradores de OpenStreetMap, disponibles bajo la [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Estos archivos son una base de datos derivada y se distribuyen bajo la misma licencia ODbL 1.0. Atribución requerida: «© OpenStreetMap contributors». Instantánea: base OSM del 2026-10-11T19:16:50Z.
- **Cruces semaforizados:** dataset «Cruces semaforizados» del Gobierno de la Ciudad Autónoma de Buenos Aires (https://data.buenosaires.gob.ar/dataset/cruces-semaforizados), licencia CC-BY 2.5 AR, descargado el 2026-10-11. Atribución: «Fuente: Gobierno de la Ciudad Autónoma de Buenos Aires».
- **Secuencia del recorrido:** documento oficial de recorridos (`fuentes/pdf/recorridos.pdf`, PDF 16) y protocolo (`fuentes/pdf/protocolo.pdf`, PDF 39).

Cualquier pantalla del juego que muestre esta cartografía debe incluir la atribución de OpenStreetMap, y del GCBA cuando se usen sus datos.
