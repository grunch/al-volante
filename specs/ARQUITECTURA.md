# Arquitectura de la aplicación

Fecha: 2026-10-11 (F02-T01). Documento vivo: cada tarea que cambie estructura, dependencias o convenciones lo actualiza.

Concreta la arquitectura de `PROPUESTA.md` §8 para el código. Este documento describe lo que ya está implementado; lo que llega en tareas posteriores se marca como «planificado».

## Pila y versiones

Todas las dependencias están fijadas con versión exacta en `package.json` y `package-lock.json`. Criterio de elección (F02-T01): la versión más reciente de su línea con **al menos dos semanas publicada** y compatible con el resto.

| Paquete | Versión | Uso |
|---|---|---|
| Node.js | ≥ 24.9 (`.nvmrc`: 24) | Desarrollo, pruebas y CI. |
| TypeScript | 6.0.3 | Tipado estricto. **No se usa TypeScript 7**: `typescript-eslint` 8.x exige TypeScript `< 6.1`. |
| Vite / `@vitejs/plugin-react` | 8.3.1 / 6.1.1 | Servidor de desarrollo y build. |
| React / React DOM | 19.3.0 | Interfaz. |
| Three.js | 0.186.1 | Mundo 3D. Se usa directamente, sin `@react-three/fiber`: la simulación de fases futuras necesita un bucle de paso fijo controlado fuera de React. |
| Vitest / `@vitest/coverage-v8` / jsdom | 5.0.2 / 5.0.2 / 30.1.1 | Pruebas unitarias y de componentes, cobertura. |
| Testing Library (react, dom, user-event, jest-dom) | 16.3.3 / 10.4.2 / 14.6.7 / 6.10.0 | Pruebas de componentes centradas en el comportamiento. |
| Playwright | 1.63.0 | Pruebas E2E en Chromium (escritorio y móvil). |
| ESLint / typescript-eslint / react-hooks | 10.11.0 / 8.70.1 / 7.1.1 | Lint estricto. |
| Prettier | 3.9.9 | Formato del código (no de los `.md` ni de los catálogos). |

## Estructura

```text
index.html                 Documento base (lang es-AR).
src/
  main.tsx                 Punto de entrada.
  app/                     Composición de la aplicación (App).
  i18n/es-AR.ts            Textos de la interfaz en español rioplatense, con claves en inglés.
  scene/                   Mundo 3D: escena pura de Three.js y su componente de montaje.
  ui/                      Estilos (tokens de diseño) y hooks de interfaz compartidos.
  test/                    Configuración y dobles de prueba.
tests/e2e/                 Pruebas de punta a punta con Playwright.
scripts/                   Validadores de catálogo de la fase 1 (Node).
specs/                     Documentación, fuentes y catálogos de datos.
.github/workflows/ci.yml   Integración continua.
```

Planificado en esta fase: `src/content/` (esquemas y carga de datos, F02-T02), pantallas y navegación (F02-T03), `src/activities/` (motor de actividades, F02-T04) y `src/progress/` (progreso y persistencia, F02-T05).

## Convenciones

- **Idiomas** (`AGENTS.md`): código, nombres y comentarios en inglés; documentación en español; textos para quien juega en español rioplatense, siempre desde `src/i18n/es-AR.ts`.
- **Separación de capas**: el mundo 3D (`createGarageScene`) es un módulo puro de Three.js que no conoce React ni el renderer. `SceneCanvas` lo monta, recibe la fábrica del renderer por inyección (para probar sin WebGL) e informa su estado en `data-state` (`loading`, `ready`, `unavailable`).
- **Carga diferida**: Three.js se carga en un chunk separado (`React.lazy`), así la parte teórica no espera el bundle 3D. El shell inicial pesa unos 70 kB comprimidos.
- **Accesibilidad**: salto al contenido, foco visible, `prefers-reduced-motion` (la cámara del garaje deja de moverse), descripción textual de la escena y mensaje alternativo sin WebGL. Contraste verificado: texto noche sobre marfil 14,2:1; turquesa de texto sobre marfil 5,5:1.
- **Paleta** (`src/ui/theme.css`, PROPUESTA §7): azul noche, marfil y turquesa; el amarillo queda reservado para información vial y alertas.

## Calidad y comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Chequeo de tipos y build de producción en `dist/`. |
| `npm run lint` / `npm run format:check` / `npm run typecheck` | Lint, formato y tipos. |
| `npm test` / `npm run test:coverage` | Pruebas unitarias; la cobertura exige ≥ 80 % en líneas, ramas, funciones y sentencias. |
| `npm run test:e2e` | Build, servidor de vista previa y pruebas Playwright. La primera vez: `npx playwright install chromium`. |
| `npm run validate:catalog` | Validadores de catálogo, reglas y recorrido de la fase 1, más sus pruebas. |
| `npm run check` | Todo lo anterior salvo E2E, en el mismo orden que la CI. |

La CI (`.github/workflows/ci.yml`) corre `checks` y `e2e` en cada PR y en `main`. Las actions están fijadas por SHA de commit. Activar la CI como check obligatorio de `main` queda a decisión del usuario.
