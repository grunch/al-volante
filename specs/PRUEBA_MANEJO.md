# Prueba jugable del examen práctico

Correctivo F04-T05-FIX02, pedido del 2026-10-13. Permite reproducir problemas operando los controles del navegador, desde la preparación y el arranque hasta el regreso por los ocho tramos. No inicia una fase nueva.

## Ejecutar

Instalar las dependencias y Chromium según el README. La prueba abre su propio servidor de desarrollo en el puerto 4197; debe estar libre. Usa un perfil temporal y no modifica las partidas del navegador personal.

```bash
npm run test:drive -- --headed
npm run test:drive -- --grep 'manual:'
npm run test:drive -- --grep 'automatic:'
# Optional native GPU mode, validated on Linux with NVIDIA/OpenGL:
DRIVING_GPU=1 npm run test:drive -- --headed
npx playwright show-report playwright-report/driving
```

`--headed` muestra el juego mientras se ejecuta. El modo sin ventana también funciona; WebGL por software es mucho más lento. El presupuesto es de veinte minutos por transmisión y un solo navegador a la vez. `DRIVING_GPU=1` solicita OpenGL acelerado; depende del equipo y no es una medición de rendimiento ni una garantía de aceleración en todos los sistemas.

No editar código servido durante la vuelta: la recarga de desarrollo puede reiniciar el auto. El conductor y la configuración son independientes de los E2E cortos de la CI.

## Qué hace

- Usa la semilla 1 y prueba caja manual y automática en sesiones independientes.
- Responde a las consignas de reconocimiento, ajusta asiento, apoyacabezas y espejos, coloca el cinturón y las luces bajas. Desactiva las balizas y el giro usados en el reconocimiento.
- Arranca con la llave, engrana reversa y avanza en el cajón, sale e intenta recorrer Quesada, Av. Cabildo, Guayra, Cuba, Quesada, Cuba, Manuel Ugarte y Vuelta de Obligado.
- Acciona teclas y botones reales. Dosifica los pedales y el volante con los mismos retardos que tiene quien juega; no asigna posiciones, velocidades, marchas, faltas ni fases del examen.
- Lee posición, instrumentos, etapa, luces y actores. La observación de tránsito existe solo en desarrollo. El trazado sale de `specs/route/comuna13-a.json`; no usa reconocimiento visual de las capturas para conducir.
- Controla semáforos, PARE, peatones, ciclistas y vehículos mediante esas observaciones. El conductor del test es una aproximación y también puede equivocarse: un choque suyo requiere diagnóstico antes de atribuirlo al juego.
- Falla si se cala inesperadamente, se interrumpe el examen, deja de avanzar, faltan observaciones o no visita los ocho tramos y vuelve a la fase de estacionamiento. También falla ante errores JavaScript de la página.

El reloj de Playwright avanza como máximo 100 ms por cuadro, conservando los pasos de física de 120 Hz y su límite de doce pasos por cuadro. La prueba no acelera las constantes del auto ni desactiva evaluación o colisiones. El tiempo de simulación se distingue del tiempo de ejecución.

**Límite explícito:** esta vuelta termina al recibir la consigna de estacionamiento. No certifica estacionamiento, cierre de la etapa III ni resultado aprobado de la ficha; las pruebas existentes de simulación cubren esas partes. Tampoco demuestra todas las semillas, dispositivos o comportamientos posibles del tránsito.

## Evidencia

Cada sesión deja en `test-results/driving/`:

- `driving-log.json`: transmisión, semilla y muestras de tiempo, posición, rumbo, pedales, velocidad, marcha, motor, etapa y mensajes, más la última observación de tránsito;
- capturas al arrancar, entrar a cada tramo y completar el recorrido;
- texto del examinador y de la ficha disponible al terminar;
- captura y traza de Playwright ante un fallo, con los pasos de interacción. La traza omite snapshots y capturas de cada cuadro para evitar archivos enormes.

El informe HTML reúne esos adjuntos. Los artefactos quedan fuera de Git. Para reproducir un fallo, conservar su carpeta antes de volver a ejecutar el mismo test.

## Fallos de controles reproducidos y corregidos

1. Mantener Shift y hacer clic en «Subir marcha» liberaba el embrague al salir el foco de la vista 3D. El motor se calaba aunque Shift siguiera presionado. Ahora el foco puede moverse entre la vista y los botones del habitáculo sin soltar el pedal.
2. Después del clic, K y los demás atajos dejaban de funcionar porque el foco estaba en el botón. Los atajos ahora funcionan en el habitáculo, con un botón explícito para activar el teclado. Los campos editables conservan su uso normal y Space/Enter activan los botones enfocados.
3. El examen no mostraba por qué rechazaba un arranque o cambio. Comparte ahora el feedback de la pista, con estado del motor, llave y freno de mano, y mensajes de bloqueo o calado.
4. Chromium no genera el `click` del segundo dedo mientras el primero sostiene un pedal. Los comandos usan la liberación del puntero dentro del botón y conservan la activación por teclado y tecnologías de asistencia. Cancelar o arrastrar fuera no acciona el comando; el click posterior no lo duplica. Se puede iniciar el desplazamiento de la página sobre un comando sin activarlo.

`tests/e2e/driving-start.spec.ts` protege arranque, movimiento, combinación de teclado y botones, recuperación después de calarse, bloqueo de P, reinicio y gesto de dos dedos. Las pruebas unitarias cubren además pérdida de foco, edición del teclado, cancelación de punteros y mensajes de rechazo. No se modificaron la física, las condiciones de arranque ni las reglas de evaluación para hacer pasar estas pruebas.

## Validación de la implementación

- Suite completa: 1.813 pruebas aprobadas en 111 archivos; cobertura de líneas 99,81 %, sentencias 99,36 %, funciones 99,70 % y ramas 97,26 %. Se ejecutó con dos workers.
- Lint, formato, tipos, catálogo de contenido y build aprobados. El build conserva la advertencia previa de tamaño del bloque 3D; la observación de tránsito queda fuera de su JavaScript.
- 39 E2E focalizados aprobados sobre el build de producción; once omisiones previstas (casos adaptables duplicados y multitouch en escritorio). El gesto de dos dedos y el desplazamiento sobre comandos también se comprobaron en Chromium móvil emulado.
- Inspección visual a 1280 × 900, 320 × 568 y 844 × 390: mensajes legibles, sin desbordes horizontales, controles de al menos 44 px y sin errores JavaScript. Equipo local: Linux, RTX 2060, Chromium de Playwright 1.63.0. La emulación no reemplaza una prueba en un teléfono físico.
- Vueltas completas aprobadas en Chromium con GPU: automática, 1.467,81 m y 475,45 s de simulación (8,5 minutos de ejecución); manual, 1.468,14 m y 589,45 s (10,7 minutos). Las observaciones finales de ambas confirman fase `parking`, motor en marcha y velocidad cero. La duración incluye observaciones y capturas, no representa los FPS del juego.
- La revisión independiente detectó dos errores del conductor: estimar velocidad con observaciones repetidas y aceptar la detención antes de comprobar una interrupción. Ambos corregidos; la regresión que combina `finished` con velocidad cero pasó. Los registros de las vueltas también se verificaron contra la condición final reforzada.
