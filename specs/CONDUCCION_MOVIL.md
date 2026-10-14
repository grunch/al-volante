# Conducción en el celular — MOV01

Pedido puntual del 2026-10-14: especificar cómo se maneja desde un teléfono aprovechando sus sensores, en particular girar el volante inclinando el teléfono. En escritorio el juego sigue igual. No inicia las fases 6 ni 7; adelanta la parte de la compatibilidad móvil del práctico que F07-T02 audita después.

**Estado: especificado, sin implementar.** La implementación empieza cuando el usuario la pida; la entrega propuesta está en §15.

## 1. Alcance

Incluye, solo en teléfonos y tabletas:

- volante por inclinación, con calibración del centro, zona muerta y sensibilidad ajustable;
- controles semitransparentes sobre la vista: el pulgar izquierdo acelera (arriba) y frena (abajo), y el derecho maneja la palanca, en caja manual y automática;
- embrague asistido en caja manual: no hace falta pisarlo para cambiar ni para salir;
- vibración ante eventos físicos del auto;
- pantalla siempre encendida mientras se maneja y orientación horizontal.

Se aplica a las tres vistas que usan `DrivingCanvas` (`src/practice/DrivingCanvas.tsx`): la pista (`#/pista`), el recorrido libre (`#/recorrido`) y el examen práctico (`#/examen`).

No cambia la conducción en escritorio, la física del auto, las reglas del examen ni sus umbrales.

## 2. Cuándo se activa

Depende de las capacidades del aparato, no de su marca ni modelo, y tiene dos niveles:

1. **Modo móvil:** se activa con puntero táctil principal (`matchMedia('(pointer: coarse) and (hover: none)')`).
   - Muestra la superposición inicial (§3), los controles superpuestos (§8) y los ajustes (§10), y usa el embrague asistido en caja manual (§8.3).
   - Los controles superpuestos se usan con el teléfono apaisado; en vertical se muestra el aviso de §3.
2. **Volante por inclinación:** es un subestado del modo móvil que se confirma después del gesto «Empezar».
   - Requiere el permiso, donde se pide, y una lectura válida de `GravitySensor` o `devicemotion` en el primer segundo. Se exige una lectura real porque los navegadores de escritorio suelen definir `DeviceMotionEvent` sin entregar lecturas.
   - Si se rechaza el permiso, no llegan lecturas, las lecturas vencen (§4) o quien juega lo desactiva (§10), el modo móvil sigue. El volante se maneja entonces con los botones ← y → de la superposición (§8.4).

En escritorio, con un puntero principal fino, no aparece nada nuevo: no se piden permisos, no se registran escuchas de sensores ni se pide mantener la pantalla encendida. Teclado, mouse y botones en pantalla funcionan como hoy. Una tableta, o un equipo 2 en 1 en modo tableta, con puntero táctil principal también usa el modo móvil.

## 3. Flujo de uso

1. Al montar la cabina en modo móvil, una superposición explica cómo sostener el teléfono (apaisado, con las dos manos, como un volante) y ofrece el botón «Empezar». Ese toque es el gesto que habilita todo lo siguiente:
   - en iPhone y iPad, `DeviceMotionEvent.requestPermission()`; si se rechaza, se maneja con botones y se informa;
   - pantalla completa sobre la cabina (el mismo mecanismo del botón actual) y bloqueo en horizontal (§9); si alguno falla, se sigue sin él;
   - pantalla siempre encendida (§9);
   - arranque del sensor y calibración: el **centro** es el ángulo promedio de una ventana de 0,3 s en la que el ángulo varía 2° o menos (máximo menos mínimo). Mientras no se cumpla, el volante queda en el centro y se muestra «Sostené el teléfono quieto, como un volante». Pasados 3 s sin cumplirse, el aviso sigue visible y se sigue esperando: nunca se toma un movimiento como centro;
   - el audio de manejo, que ya se activa por gesto, queda habilitado con el mismo toque.
2. En modo inclinación, el botón **«Centrar volante»** está siempre visible en la cabina. Recalibra con el mismo criterio de estabilidad y, mientras espera, conserva el centro anterior.
3. Avisos en una región `aria-live`, sin bloquear el manejo:
   - teléfono vertical: «Girá el teléfono a horizontal para manejar inclinándolo»;
   - teléfono casi plano (§5): «Levantá un poco el teléfono»;
   - sensor sin lecturas, con lecturas vencidas o con error: «No se pudo leer la inclinación; usá los botones».

Los textos de interfaz van en español rioplatense en `src/i18n/es-AR.ts`; los de esta spec son orientativos.

## 4. Lectura del sensor

- **Fuente preferida: `GravitySensor`** (Generic Sensor API; Chrome en Android) a 60 Hz. Android calcula esa gravedad combinando acelerómetro y giroscopio, con poco ruido y poca demora.
- **Respaldo: evento `devicemotion`.** Se usa `accelerationIncludingGravity` junto con `rotationRate` en un filtro complementario: el giroscopio sigue los cambios rápidos y la gravedad corrige la deriva. Constante de tiempo inicial de 0,25 s, a ajustar en el aparato. Las muestras con aceleración total fuera de 0,5–1,5 g, por ejemplo por un sacudón de la mano, no corrigen la deriva.
- **Lecturas inválidas:** las no finitas se descartan. Un error del sensor (`NotAllowedError`, `NotReadableError`) desactiva la inclinación y se muestra el aviso de §3.
- **Lecturas vencidas:** si la lectura más reciente tiene más de 250 ms respecto del instante del paso fijo (unas quince lecturas perdidas a 60 Hz), se descarta.
  - La inclinación pasa a inactiva, el volante vuelve al centro, aparecen los botones de giro (§8.4) y se muestra el aviso de §3.
  - Cuando vuelven a llegar lecturas, la inclinación se reactiva sola y conserva el centro.
- **Sin ninguna fuente:** modo botones.

El adaptador del sensor queda separado de la lógica pura para poder probarla sin navegador (§14).

## 5. Ángulo del volante

El giro del teléfono alrededor del eje perpendicular a la pantalla se calcula con la gravedad proyectada sobre el plano de la pantalla. En ejes del dispositivo (x a la derecha, y hacia arriba, z saliendo de la pantalla, en su orientación natural):

```ts
// Indicative: final signs are fixed by tests for every screen angle and confirmed on the device.
const deviceRollDeg = toDegrees(Math.atan2(gravity.x, gravity.y));
const screenRollDeg = normalizeDegrees(deviceRollDeg - screen.orientation.angle); // (-180, 180]
```

- **Sentido exigido:** girar el teléfono en sentido antihorario, como un volante hacia la izquierda, produce giro a la izquierda (`steer > 0`, la convención de `CarControls.steer`) en las dos orientaciones apaisadas.
- **No se usa `gamma` de `deviceorientation`:** son ángulos de Euler, y con el teléfono parado y apaisado `gamma` queda en el borde de su rango (±90°) y salta.
- **Inclinación hacia adelante o hacia atrás:** el ángulo no siempre se mantiene; depende de alrededor de qué eje se incline el teléfono.
  - Alrededor del eje horizontal de quien juega, las dos componentes se multiplican por el mismo coseno y el ángulo no cambia.
  - Alrededor del eje horizontal propio del teléfono, ya girado, el ángulo sí cambia: con 45° de giro y 60° de inclinación se lee ≈ 63,4°; con 10° de giro y 30° de inclinación, ≈ 11,5°.
  - Es una aproximación: la calibración toma la postura habitual, y la prueba en el aparato cubre distintas inclinaciones (§14). Si en el aparato resulta molesta, antes de cerrar MOV01-T01 se evalúa compensarla con la orientación completa del sensor (`RelativeOrientationSensor`).
- **Teléfono casi plano:** si la gravedad proyectada sobre la pantalla (`hypot(x, y)`) cae por debajo de `sin(20°)·g`, el ángulo deja de ser confiable. La entrada pasa a inactiva, el volante vuelve al centro y aparece el aviso. Vuelve a ser confiable por encima de `sin(25°)·g`; la diferencia evita parpadeos.

## 6. Del ángulo al volante

| Parámetro | Valor inicial | Ajustable |
|---|---|---|
| Zona muerta | 3° | no |
| Ángulo de tope (inclinación que lleva el volante al tope) | 75° | 45–90°, ajuste «Sensibilidad» |
| Curva | exponente 1,5 | no |

```text
d     = screenRoll − center                 (normalizado a (−180°, 180°])
n     = clamp((|d| − deadZone) / (fullLock − deadZone), 0, 1)
steer = sign(d) · n^1.5                     (positivo = izquierda)
```

- La curva da precisión cerca del centro, para corregir en recta, sin perder el tope.
- **Sin asistencia por velocidad:** la asistencia actual de `stepControls`, que reduce el giro pedido con la velocidad, existe porque teclas y botones solo están apretados o sueltos. La inclinación es continua y quien juega dosifica el giro. El límite físico de la dirección sigue en la dinámica: `steerRateRadPerS`, 1 rad/s en `EXAM_CAR`.
- **Aproximación del juego:** un volante real da más de una vuelta hacia cada lado, y acá 75° de inclinación llevan las ruedas al tope (33°, `maxSteerRad`). La dirección es más directa que la real; la ayuda de controles lo dice.
- Los valores iniciales son aproximaciones y se ajustan con pruebas en el aparato (§14).

## 7. Integración con la simulación

Módulos propuestos (nombres orientativos):

- `src/practice/tilt.ts`: funciones puras: ángulo, histéresis del teléfono plano, mapeo a volante y validación de ajustes;
- `src/practice/motionSensor.ts`: adaptador de `GravitySensor` / `devicemotion`, permisos y errores;
- `src/practice/mobileDriving.ts`: detección del modo móvil, pantalla siempre encendida y orientación;
- `src/practice/haptics.ts`: de eventos del auto a patrones de vibración;
- `src/practice/assistedClutch.ts`: embrague asistido de la caja manual (§8.3).

Reglas:

- **Entrada:** `stepControls` (`src/practice/controls.ts`) recibe además valores continuos opcionales (`number | null`) de volante, acelerador y freno, y el embrague del asistente (§8.3). Las reglas del volante son estas; acelerador y freno siguen la franja de pedales (§8.1).
  - Si hay valor y no se sostiene un botón de giro, `steer` toma ese valor.
  - Si se sostiene ← o →, manda el botón, con su asistencia actual.
  - Sin valor, el comportamiento es el de hoy: vuelta al centro con las rampas existentes.
- **Paso fijo y lecturas con su instante:**
  - Las lecturas continuas (inclinación y franja de pedales) se encolan con su instante: el `timestamp` del sensor o el `timeStamp` del evento.
  - `driveFrame` (`src/practice/drivingLoop.ts`) asigna a cada paso fijo un instante real, calculado a partir del inicio del cuadro y del acumulador del paso fijo. En cada paso usa la última lectura con instante menor o igual al del paso, y descarta las ya consumidas.
  - Así, la misma secuencia de lecturas con sus instantes da el mismo recorrido a 30 y a 120 cuadros por segundo, aunque a 30 cuadros varios pasos se calculen juntos.
  - Las teclas y los botones conservan su comportamiento actual, que no reconstruye la duración de los eventos entre cuadros (`ARQUITECTURA.md`, «Habitáculo y controles»).
- **Cambios con el asistente:** con el embrague asistido, un cambio pedido queda pendiente hasta que el embrague supera `CLUTCH_PRESSED`; recién entonces se aplica el comando, dentro de la secuencia de pasos fijos.
- **Foco:** a diferencia del teclado, la inclinación no depende del foco del lienzo. Tocar un pedal mueve el foco a ese botón y el volante tiene que seguir funcionando.
- **Liberación:** la inclinación pasa a inactiva y el volante vuelve al centro cuando la pestaña se oculta, la ventana pierde el foco, se reinicia el manejo o se desmonta la cabina (los mismos casos que `releaseKeys` en `DrivingCanvas.tsx`). Al volver se conserva el centro calibrado.
- **Pruebas:** un atributo `data-*` de solo lectura indica la fuente activa del volante (`tilt` o `buttons`), como la telemetría que ya existe.

## 8. Mandos superpuestos para los pulgares

Con el modo inclinación activo y el teléfono apaisado, los pedales y la palanca se superponen a la vista 3D como **controles semitransparentes**, en las dos cajas. La palanca queda bajo el pulgar derecho, como en un auto con el volante a la izquierda, y el pulgar izquierdo acelera y frena. En caja manual no hace falta pisar el embrague (§8.3).

| Pulgar | Control | Caja manual | Caja automática |
|---|---|---|---|
| Izquierdo | franja vertical de pedales | arriba acelera, abajo frena | igual |
| Derecho | palanca de cambios | grilla en H: 1, 3 y 5 arriba; N en el centro; 2, 4 y R abajo | P, R, N y D en columna |

Las combinaciones necesarias usan pulgares distintos. En automática: frenar y elegir la posición (salir de P exige freno). En manual: frenar hasta detenerse y elegir primera o reversa.

### 8.1 Acelerador y freno (pulgar izquierdo)

- **Forma:** una franja vertical en el borde izquierdo de la vista, de al menos 64 px de ancho y unos dos tercios del alto de la vista.
- **Mapeo:**
  - una banda central neutra, del 15 % del alto, no acciona nada;
  - por encima, el acelerador crece en forma lineal hasta el borde superior (de 0 a 1);
  - por debajo, el freno crece de la misma forma hasta el borde inferior;
  - acelerador y freno nunca se piden a la vez.
- **Uso:**
  - tocar un punto fija el valor sin necesidad de arrastrar (WCAG 2.5.7), y deslizar el pulgar lo cambia en forma continua;
  - con la captura de puntero, si el pulgar se sale de la franja se mantiene el tope;
  - al soltar, acelerador y freno vuelven a 0.
- **Paso fijo:** el valor sigue al pulgar con una variación máxima de 5 por segundo (de 0 a 1 en 0,2 s, valor inicial).
- **Indicación:** una barra muestra el nivel del acelerador hacia arriba o del freno hacia abajo, con los rótulos «Acelerar ↑» y «Frenar ↓».
- **Examen:** la banda neutra evita acelerar o frenar sin querer, lo que importa en las maniobras de 30 cm. El protocolo pide hacerlas sin acelerador (`specs/fuentes/pdf/protocolo.pdf`, PDF 11), y el simulador considera que se aceleró a partir de 0,05, una aproximación del juego (§11).

### 8.2 Palanca de cambios (pulgar derecho)

- **Selección directa en las dos cajas:** tocar una posición la elige y envía `{ type: 'shift', to }`. El tren motriz ya acepta posiciones directas y valida:
  - automática: freno pisado para salir de P; P rechazada con el auto en movimiento; R rechazada mientras avanza;
  - manual: R rechazada mientras avanza. El embrague lo acciona el asistente (§8.3).
- **Rechazos:** usan los mensajes existentes y una vibración de 25 ms (§13).
- **Automática:** P, R, N y D en columna, de arriba abajo como una palanca real.
- **Manual:** grilla en H de cinco marchas, con 1, 3 y 5 arriba, N en el centro y 2, 4 y R abajo. La ubicación de R varía entre autos; es una aproximación.
- **Posición actual:** se resalta y lleva `aria-pressed`.
- **Teclado:** conserva su recorrido secuencial (E y Q por defecto).

### 8.3 Embrague asistido (caja manual)

En el modo móvil, la caja manual se maneja sin pisar el embrague: el juego lo acciona como lo haría quien conduce.
- **Física sin cambios:** el tren motriz no cambia. El asistente (`src/practice/assistedClutch.ts`, nombre orientativo) solo calcula el valor del pedal de embrague en cada paso fijo, y la física de acople, patinamiento y calado sigue igual.
- **Determinismo:** depende solo del estado del auto y de los mandos, así que es determinista.

| Situación | Embrague asistido (valores iniciales, a ajustar) |
|---|---|
| Motor apagado o en N | Suelto. Arrancar con una marcha puesta se sigue rechazando: hay que poner N, como indica la consigna actual. |
| Cambio pedido | Lo pisa a fondo. El cambio se aplica cuando el embrague supera `CLUTCH_PRESSED` (0,85), como si lo hiciera una persona; después lo suelta en 0,4 s. |
| Freno pisado y auto casi detenido, en marcha | Pisado, para no calar. |
| Freno de mano puesto | Pisado: no hace avanzar el auto contra el freno de mano. |
| En primera o R, sin acelerador ni freno y a baja velocidad | Regula el acople para que el auto avance despacio, a 0,3 m/s, como una automática. Es el «solo con el embrague» de las maniobras de 30 cm. |
| Salida con acelerador | Lo suelta a medida que el motor supera unas 1.300 rpm y termina de acoplar cuando deja de patinar. |
| Marcha normal | Suelto; si el motor baja de unas 1.000 rpm sin acelerador, lo pisa para no calar. |

- **Botón del embrague:** «Embrague» sigue en la columna de mandos. Sirve para el reconocimiento de la pedalera de la etapa I y para quien quiera usarlo; el valor efectivo es el mayor entre el botón y el asistente.
- **Escritorio:** no hay asistente; el embrague sigue en Shift.
- **Examen:** las consecuencias están en §11.

### 8.4 Apariencia, ubicación y resto de los mandos

- **Relleno:** semitransparente (opacidad inicial del 40 %, a ajustar en el aparato), para no tapar la calle. Se vuelve opaco al tocarlo o cuando marca la posición actual.
- **Borde y rótulo:** opacos y con halo oscuro, para que se lean sobre cualquier parte de la escena. El borde tiene un contraste de al menos 3:1 (WCAG 1.4.11) y el texto, de al menos 4,5:1 (1.4.3).
- **Tamaño:** la franja de pedales mide al menos 64 px de ancho y cada posición de la palanca al menos 48 × 48 px, por encima del mínimo de 44 px del proyecto.
- **Ubicación:** los controles van en los bordes laterales e inferiores de la vista, sin tapar los espejos ni el centro de la calle. Se respetan las zonas seguras (`env(safe-area-inset-*)`).
- **Componentes:** la palanca reutiliza `CommandButton` (`CockpitControls.tsx`) con un comando de selección directa. La franja de pedales es un componente nuevo con captura de puntero, que admite varios toques a la vez como los mandos actuales.
- **Resto de los mandos:** llave, freno de mano, embrague, luces, giros, mirada y espejos siguen en la columna de mandos de la disposición apaisada actual (`ARQUITECTURA.md`, «Diseño adaptable»).
- **Volante con botones:** si la inclinación está desactivada o no disponible (§2, §4), los botones ← y → aparecen en la superposición bajo el pulgar derecho, debajo de la palanca. Así se puede girar mientras el pulgar izquierdo acelera o frena. Con dos pulgares no se puede girar y cambiar de marcha a la vez: el cambio se hace antes o después de la curva.

## 9. Pantalla y orientación

- **Pantalla encendida:** `navigator.wakeLock.request('screen')` se pide mientras la cabina está montada en modo inclinación, se libera al salir y se vuelve a pedir cuando la pestaña vuelve a ser visible (el navegador lo suelta al ocultarla). Si falla, aviso discreto, sin bloquear.
- **Orientación:** `screen.orientation.lock('landscape')` solo dentro de pantalla completa. Si no se puede, por ejemplo en iPhone, queda el aviso de girar el teléfono. Al salir de pantalla completa se desbloquea.
- **Movimiento reducido:** `prefers-reduced-motion` no afecta la inclinación, porque es una entrada y no una animación. El comportamiento actual de la cabina se mantiene.

## 10. Ajustes y persistencia

- **Clave:** `al-volante.mobile-driving.v1` en `localStorage`, con `{ tiltEnabled: boolean, fullLockDeg: number, vibration: boolean }`. Por defecto: `true`, `75`, `true`.
- **Validación:** como en `bindings.ts`. Datos corruptos o fuera de rango vuelven a los valores por defecto; un error de escritura se muestra y la configuración sigue en memoria.
- **Centro:** no se guarda; se calibra en cada sesión de manejo, porque depende de cómo se sostiene el teléfono.
- **Panel:** los ajustes («Volante por inclinación», «Sensibilidad», «Vibración») van en el panel de controles de la cabina y solo se muestran en modo móvil.

## 11. Examen y evaluación

- **Reglas sin cambios:** ninguna regla ni umbral del examen cambia.
- **Margen frente a «volante movido»:** el protocolo pide hacer las maniobras de 30 cm sin mover el volante (`protocolo.pdf`, PDF 11). El simulador lo considera movido si las ruedas superan `GAME_PARAMETERS.steerHeldRad` (0,03 rad, `src/exam/session.ts`), una aproximación del juego (`ARQUITECTURA.md`, «Evaluación del examen», aproximaciones del juego).
  - Con el tope de 33°, eso es ≈ 5,2 % del recorrido.
  - Con zona muerta de 3° y curva 1,5, hace falta inclinar el teléfono ≈ 13° desde el centro con el tope en 75°, y ≈ 9° con el tope en 45°.
  - El temblor normal de la mano queda muy por debajo; una prueba lo comprueba con ruido (§14).
- **Centrar en el examen:** está permitido en cualquier momento, también durante el examen. Equivale a acomodarse al volante y no altera la evaluación.
- **Vibración:** responde solo a eventos físicos, nunca a faltas (§13).
- **Embrague asistido (caja manual en el celular):**
  - **Calado y dominio del embrague:** el calado (deficiente baja d) prácticamente no ocurre y el dominio del embrague no se pone a prueba. La ficha lo informa entre las aproximaciones que pudieron influir.
  - **Reconocimiento de la pedalera:** el embrague se señala con el botón «Embrague» de la columna.
  - **Retroceder y avanzar 30 cm:**
    - **Protocolo:** en caja manual, retroceder regulando solo con el embrague, sin acelerador y sin tocar el freno, que solo se puede pisar al final para inmovilizar; después, avanzar en primera sin girar el volante y en una sola maniobra (`specs/fuentes/pdf/protocolo.pdf`, PDF 11).
    - **Con el asistente:** las dos maniobras se hacen con su avance lento, sin acelerador, y el freno solo para detenerse.
    - **Aproximaciones del juego, no valores del protocolo:** un acelerador por encima de 0,05 cuenta como acelerar (umbral fijo en `onManoeuvreStep`, `src/exam/session.ts`), y moverse más de 5 cm después de pisar el freno (`GAME_PARAMETERS.brakeThenMoveM`, listado en `ARQUITECTURA.md`, «Evaluación del examen») cuenta como regular con él. A 0,3 m/s el auto se detiene en unos 2 cm después de empezar a frenar, por debajo de ese umbral; una prueba lo comprueba.
    - **Dominio fino:** el protocolo evalúa aquí el dominio fino del vehículo; con el asistente, esa regulación la hace el juego, y la ficha lo informa (punto anterior).
  - **Arranque con una marcha puesta:** con el motor apagado el asistente deja el embrague suelto, así que arrancar en marcha se sigue rechazando como hoy. Si alguien pisa el botón «Embrague» y arranca en marcha, se consigna la leve e como en escritorio.
- **Dos manos:** la baja f (dos manos en el volante) sigue sin evaluarse, como indica `REGLAS.md` §9.

## 12. Accesibilidad

- **Activación por movimiento:** cumple el criterio 2.5.4 de WCAG 2.2 (nivel A). Todo lo que se hace inclinando también se hace con botones (← y →), y la respuesta al movimiento se puede desactivar (§10).
- **Superposición inicial:** recibe el foco al abrirse y lo devuelve al área de conducción al cerrarse.
- **Avisos:** en región `aria-live`.
- **Arrastre:** la franja de pedales no exige arrastrar. Tocar un punto fija el valor, así que cumple el criterio 2.5.7 de WCAG 2.2 (nivel AA).
- **Tamaño de los objetivos:** se mantienen los mínimos táctiles de 44 × 44 px.

## 13. Vibración

Usa `navigator.vibrate`. Si el navegador no lo ofrece (Safari en iOS), el ajuste se muestra como no disponible.

| Evento del auto | Patrón inicial |
|---|---|
| `contact` a menos de 1 m/s (roce, por ejemplo del cordón) | 30 ms |
| `contact` a 1 m/s o más, o `actor-contact` (golpe) | 120 ms |
| `stall` (calado) | 60 ms, pausa de 40 ms, 60 ms |
| `shift-refused` (cambio rechazado) | 25 ms |

- **Solo eventos físicos:** nunca vibra por faltas, observaciones del examinador ni resultados; en el modo rendir sería una ayuda impropia.
- **Frecuencia y corte:** como máximo un patrón cada 150 ms. Se corta al ocultarse la pestaña, y el ajuste «Vibración» la desactiva.
- Las duraciones son iniciales y se ajustan en el aparato.

## 14. Verificación

**Pruebas unitarias (Vitest):**
- ángulo en las cuatro rotaciones de pantalla y sentido en ambas orientaciones apaisadas;
- zona muerta, curva, tope e histéresis del teléfono plano;
- lecturas no finitas;
- validación de ajustes y datos corruptos;
- detección: el modo móvil depende solo del puntero; sin permiso o sin lecturas sigue con botones; un escritorio no activa nada;
- calibración: un centro solo con 0,3 s de variación ≤ 2°; con movimiento continuo no se toma centro y se muestra el aviso; «Centrar volante» conserva el centro anterior mientras espera;
- lecturas vencidas: con más de 250 ms se descartan, el volante vuelve al centro y aparecen los botones; al volver las lecturas se reactiva con el mismo centro;
- vibración: correspondencia con los eventos, límite de frecuencia y ausencia de vibración por faltas;
- franja de pedales: banda neutra, mapeo lineal, tope fuera de la franja y vuelta a 0 al soltar;
- palanca con selección directa: P→D con y sin freno, P rechazada en movimiento, R rechazada al avanzar y cada marcha de la grilla en H;
- embrague asistido: cada fila de §8.3, incluidos el cambio pendiente hasta superar `CLUTCH_PRESSED`, el avance lento a 0,3 m/s en primera y en R, la salida sin calar con distintos niveles de acelerador, el freno de mano sin avance y el valor máximo entre el botón y el asistente.

**Integración:**
- `driveFrame` con la misma secuencia de lecturas con instante (inclinación y franja de pedales) da exactamente el mismo recorrido a 30 y a 120 cuadros por segundo;
- una interrupción de lecturas durante el manejo deja el volante en el centro al superar los 250 ms;
- el botón de giro manda sobre la inclinación;
- al ocultar la pestaña, el volante vuelve al centro;
- ruido de ±2° alrededor del centro durante los 30 cm no genera «volante movido»;
- caja manual con embrague asistido: las maniobras de 30 cm hacia atrás y hacia adelante salen correctas sin acelerador, y una vuelta guionada del recorrido con mandos móviles no cala;
- arrancar con una marcha puesta se sigue rechazando con el asistente.

**E2E (Playwright, Chromium):**
- **Proyecto móvil** con `hasTouch` e `isMobile`. Las lecturas se inyectan con sensores virtuales del protocolo de depuración de Chrome (`Emulation.setSensorOverrideEnabled`, si la versión de Chromium de Playwright lo permite) o con eventos `devicemotion` sintéticos. Se cubren la superposición inicial, la calibración, el giro del volante y del auto, los avisos de vertical y de teléfono plano y la desactivación. También los mandos superpuestos: acelerar y frenar con la franja; en caja automática, freno y D a la vez para salir de P, y D sin freno, que debe rechazarse; en caja manual, primera y segunda sin embrague, y R mientras el auto avanza, que debe rechazarse. Con la inclinación desactivada o sin permiso: acelerar con el pulgar izquierdo y sostener ← con el derecho a la vez, y el auto debe girar mientras acelera.
- **Escritorio:** sin superposición, sin escuchas de sensores y sin pedir pantalla encendida. La suite actual de escritorio no cambia.

**Prueba manual en el aparato** (referencia: Google Pixel 11 con Chrome; registrar modelo, navegador y versión):
- ambas orientaciones apaisadas y sentido del giro;
- giro sostenido mientras se inclina el teléfono hacia adelante y hacia atrás, para medir el efecto descrito en §5;
- teléfono quieto en el centro sin mover el volante;
- tope;
- avisos de teléfono plano y vertical;
- mandos superpuestos con caja manual y automática: legibilidad sobre la escena, alcance de los pulgares y dosificación del acelerador y el freno con la franja;
- embrague asistido: salidas, cambios, detenciones y maniobras de 30 cm sin calar ni tirones bruscos;
- vibración;
- pantalla encendida más allá del tiempo de bloqueo;
- salir de la app y volver;
- etapa I del examen sin «volante movido» espurio;
- observación de cuadros por segundo.

La emulación no acredita la sensación de manejo ni el rendimiento en un teléfono físico.

**Cobertura:** se mantienen los umbrales del repositorio.

## 15. Entrega propuesta

Dos PRs apilados desde `main`, con el flujo de revisión habitual (Codex y CodeRabbit):

| Tarea / PR | Trabajo | Aceptación |
|---|---|---|
| MOV01-T01 | Lectura de sensores, ángulo y mapeo; entradas continuas de volante, acelerador y freno; embrague asistido; ajustes; detección del modo móvil e integración en `stepControls`/`driveFrame`, con pruebas unitarias y de integración. | Escritorio sin cambios; determinismo a 30/120 cuadros por segundo; margen frente a `steerHeldRad` y maniobras de 30 cm en manual con el asistente comprobados. |
| MOV01-T02 | Superposición inicial y calibración, «Centrar volante», ajustes, controles superpuestos semitransparentes (franja de pedales y palanca para las dos cajas), vibración, pantalla encendida, orientación, textos, E2E móvil y documentación. | Flujo completo en emulación; prueba manual en el aparato registrada con sus resultados. |

## 16. Compatibilidad prevista y límites

| Navegador | Lectura del sensor | Vibración | Pantalla encendida | Bloqueo horizontal |
|---|---|---|---|---|
| Chrome en Android | `GravitySensor` | sí | sí | sí, en pantalla completa |
| Safari en iPhone/iPad | `devicemotion`, con permiso | no | sí: en pestaña desde iOS/iPadOS 16.4; en la app instalada en la pantalla de inicio, desde 18.4 | no |
| Otros | a verificar | a verificar | a verificar | a verificar |

- La tabla resume la documentación de cada navegador; solo la prueba en un aparato acredita compatibilidad.
- Los valores iniciales (zona muerta, tope, curva, filtro, patrones de vibración) son aproximaciones del juego a ajustar con pruebas reales.
- La medición de rendimiento de `ARQUITECTURA.md` (emulación de Pixel 7) no valida hardware real. La inclinación no agrega costo gráfico, pero la experiencia depende de los cuadros por segundo del teléfono.
- Sostener el teléfono con dos manos y usar los pulgares es una postura distinta de la de un auto; el juego no evalúa la postura.
- El embrague asistido simplifica la caja manual en el celular: para practicar el embrague hay que usar el teclado en escritorio.
