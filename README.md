# Al volante: Comuna 13

Juego web para preparar el examen teórico y práctico de licencia B/B.1 en CABA. Se conduce en 3D (Three.js) desde el interior del auto por el recorrido A de la Comuna 13, y una campaña de aprendizaje cubre el manual y el protocolo de examen.

Estado: **en construcción.** Fases 1–5 integradas, incluido el tránsito y el examen práctico completo. Ver el [estado operativo](specs/ESTADO_IMPLEMENTACION.md).

## Arranque

Requisitos: Node.js 24 desde la 24.15, o 26 en adelante; jsdom 30 no admite la 25 (`.nvmrc` fija 24.21.0, la versión usada en la CI).

```bash
npm ci                 # install pinned dependencies
npm run dev            # development server (http://localhost:5173)
npm run check          # lint, formatting, types, coverage, validators and build
npx playwright install --with-deps chromium   # once for E2E; Linux system libraries require sudo
npm run test:e2e       # end-to-end tests in Chromium (desktop and mobile)
npm run test:audio     # real Web Audio PCM checks in Chromium
npm run test:drive -- --headed  # optional browser driving session
```

Prueba que arranca el auto y conduce por el recorrido: [instrucciones, registros y límites](specs/PRUEBA_MANEJO.md).

Pila, estructura y convenciones: [specs/ARQUITECTURA.md](specs/ARQUITECTURA.md).

Desde el inicio, «Explorar Comuna 13» abre `#/recorrido`: ocho entradas, vista de cuadra o circuito completo y conducción manual/automática. [Fuentes, aproximaciones y rendimiento](specs/CIUDAD.md).

## Instalar la app y usarla sin conexión

La versión publicada se instala como aplicación: en Chrome, Edge o Android, con el ícono de instalar de la barra de direcciones o «Instalar app» en el menú; en iPhone o iPad, desde Safari con «Compartir → Agregar a inicio».

- La primera visita con conexión guarda la app entera (unos 17 MB, en segundo plano) y avisa «Listo: la app ya funciona sin conexión». Desde ahí todo funciona sin internet, también el manejo 3D y el simulacro teórico; solo los enlaces externos, como los PDF oficiales, necesitan conexión, y lo dicen.
- Cuando hay una versión nueva, la app la ofrece con «Actualizar» o «Más tarde». Nunca se recarga sola ni durante un examen, y el progreso se conserva.
- El service worker existe solo en el build de producción (`npm run build && npx vite preview`), no en `npm run dev`.

Detalle, límites y pruebas: [Arquitectura, «Aplicación instalable y sin conexión»](specs/ARQUITECTURA.md#aplicación-instalable-y-sin-conexión-pwa01-t02).

## Documentación

- [Propuesta](PROPUESTA.md): producto, evaluación y arquitectura.
- [Plan de implementación](specs/PLAN_IMPLEMENTACION.md): fases, tareas y flujo de PRs.
- [Estado de implementación](specs/ESTADO_IMPLEMENTACION.md): avance y siguiente acción.
- [Inmersión del recorrido](specs/INMERSION_RECORRIDO.md): referencias, Blender, sonido y comprobaciones.
- [Arquitectura](specs/ARQUITECTURA.md): pila, estructura, convenciones y comandos.
- [Continuidad](specs/CONTINUIDAD.md): contexto y hallazgos para retomar el trabajo.
- [Estrategia de modelos](specs/ESTRATEGIA_MODELOS.md).
- [Instrucciones para agentes](AGENTS.md).

## Fuentes

`specs/fuentes/pdf/` contiene los PDF originales y `specs/fuentes/` el texto extraído automáticamente de material público del Gobierno de la Ciudad de Buenos Aires: el manual teórico de conducción de vehículos de cuatro ruedas (2023), el protocolo de examen práctico, los recorridos de examen y la guía práctica de siniestros viales. También contiene dos láminas de esos documentos. `manifest.json` registra el nombre original, la cantidad de páginas y el hash SHA-256 de cada PDF. Los derechos sobre ese material pertenecen a sus autores; se incluye solo como referencia para el estudio. El proyecto no es oficial ni está avalado por el GCBA, y sus preguntas no forman un banco oficial.
