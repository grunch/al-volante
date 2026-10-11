# Al volante: Comuna 13

Juego web para preparar el examen teórico y práctico de licencia B/B.1 en CABA. Se conduce en 3D (Three.js) desde el interior del auto por el recorrido A de la Comuna 13, y una campaña de aprendizaje cubre el manual y el protocolo de examen.

Estado: **en construcción.** La fase 1 (fuentes, cobertura y recorrido verificado) está en curso; todavía no hay aplicación ejecutable.

## Documentación

- [Propuesta](PROPUESTA.md): producto, evaluación y arquitectura.
- [Plan de implementación](specs/PLAN_IMPLEMENTACION.md): fases, tareas y flujo de PRs.
- [Estado de implementación](specs/ESTADO_IMPLEMENTACION.md): avance y siguiente acción.
- [Continuidad](specs/CONTINUIDAD.md): contexto y hallazgos para retomar el trabajo.
- [Estrategia de modelos](specs/ESTRATEGIA_MODELOS.md).
- [Instrucciones para agentes](AGENTS.md).

## Fuentes

`specs/fuentes/pdf/` contiene los PDF originales y `specs/fuentes/` el texto extraído automáticamente de material público del Gobierno de la Ciudad de Buenos Aires: el manual teórico de conducción de vehículos de cuatro ruedas (2023), el protocolo de examen práctico, los recorridos de examen y la guía práctica de siniestros viales. También contiene dos láminas de esos documentos. `manifest.json` registra el nombre original, la cantidad de páginas y el hash SHA-256 de cada PDF. Los derechos sobre ese material pertenecen a sus autores; se incluye solo como referencia para el estudio. El proyecto no es oficial ni está avalado por el GCBA, y sus preguntas no forman un banco oficial.
