# Al volante: Comuna 13

Juego web para preparar el examen teórico y práctico de licencia B/B.1 en CABA. Se conduce en 3D (Three.js) desde el interior del auto por el recorrido A de la Comuna 13, y una campaña de aprendizaje cubre el manual y el protocolo de examen.

Estado: **en construcción.** Fase 1 (fuentes, cobertura y recorrido verificado) cerrada; fase 2 (base web, datos y aprendizaje inicial) en curso.

## Arranque

Requisitos: Node.js 24.9 o superior (`.nvmrc` fija 24.9.0, la versión usada en la CI).

```bash
npm ci                 # instala las dependencias fijadas
npm run dev            # servidor de desarrollo (http://localhost:5173)
npm run check          # lint, formato, tipos, pruebas con cobertura, validadores y build
npx playwright install --with-deps chromium   # una sola vez, para las pruebas E2E (en Linux instala también las bibliotecas del sistema; requiere sudo)
npm run test:e2e       # pruebas de punta a punta en Chromium (escritorio y móvil)
```

Pila, estructura y convenciones: [specs/ARQUITECTURA.md](specs/ARQUITECTURA.md).

## Documentación

- [Propuesta](PROPUESTA.md): producto, evaluación y arquitectura.
- [Plan de implementación](specs/PLAN_IMPLEMENTACION.md): fases, tareas y flujo de PRs.
- [Estado de implementación](specs/ESTADO_IMPLEMENTACION.md): avance y siguiente acción.
- [Arquitectura](specs/ARQUITECTURA.md): pila, estructura, convenciones y comandos.
- [Continuidad](specs/CONTINUIDAD.md): contexto y hallazgos para retomar el trabajo.
- [Estrategia de modelos](specs/ESTRATEGIA_MODELOS.md).
- [Instrucciones para agentes](AGENTS.md).

## Fuentes

`specs/fuentes/pdf/` contiene los PDF originales y `specs/fuentes/` el texto extraído automáticamente de material público del Gobierno de la Ciudad de Buenos Aires: el manual teórico de conducción de vehículos de cuatro ruedas (2023), el protocolo de examen práctico, los recorridos de examen y la guía práctica de siniestros viales. También contiene dos láminas de esos documentos. `manifest.json` registra el nombre original, la cantidad de páginas y el hash SHA-256 de cada PDF. Los derechos sobre ese material pertenecen a sus autores; se incluye solo como referencia para el estudio. El proyecto no es oficial ni está avalado por el GCBA, y sus preguntas no forman un banco oficial.
