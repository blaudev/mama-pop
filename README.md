# Mama Pop

Juego de disparar burbujas para el navegador. HTML + JavaScript sin dependencias ni build.

## Jugar

```bash
npm start
```

Abre http://localhost:5173. (Hace falta un servidor porque el juego usa módulos ES; `file://` no vale.)

**Controles:** ratón para apuntar y clic para disparar · con el dedo, arrastra (o mantén pulsado un momento) y
suelta para disparar; un toque rápido solo apunta, para que no se escapen disparos al rozar la pantalla · tocar cualquiera de las dos burbujas del
lanzador las hace girar y se intercambian · teclado: ← → apuntar,
Espacio disparar, C cambiar, R / M / A cargar cohete, mina o perla arcoíris.
Para **anular un tiro** mientras apuntas, vuelve con el dedo al lanzador y suelta ahí. Si hay **dos dedos**
en la pantalla a la vez, ese gesto no dispara. Entre que se pega una bola y el siguiente disparo hay una
pausa corta (0,35 s) para evitar dobles toques. Cuando caen bolas, el mapa espera a que salgan de la
pantalla antes de bajar.

**Bolas propuestas:** siempre de un color que quede en el mapa, nunca tres seguidas del mismo color
y, si fallas dos seguidas del mismo color, la siguiente es de otro. Además, 3 de cada 4 veces sale un color
que puede explotar algo desde el lanzador: el juego prueba hacia dónde se puede disparar y no cuenta los
grupos escondidos detrás de burbujas de otros colores (`reachableColors` en `src/logic.js`). El bot de
`tools/bot.js` elige las bolas igual, así que los límites de disparos ya lo tienen en cuenta.

**Cohete:** cada 3 disparos seguidos explotando algo ganas un cohete, que se guarda en la barra de abajo (el
número dice cuántos tienes; se guardan y pasan de un mapa a otro). Tócalo (o pulsa R) para cargarlo en el cañón cuando quieras; vuelve a
tocarlo, o toca el lanzador, para guardarlo. Sale recto hacia donde apuntes, sin rebotar, y abre una franja de
unas 3 burbujas de ancho en todo lo que se ve; lo que se queda colgando cae. No gasta disparos.

**Anclas (en el mapa):** burbujas de metal con una flecha dorada que vienen puestas en algunos mapas (`v` en los
mapas). No tienen color. La flecha apunta en una sola dirección: arriba, abajo, a un lado o en oblicuo. Cuando
una bola se pega tocando un ancla, rompe todo lo que hay hacia donde apunta (no hacia atrás), pero solo en la
parte del mapa que se ve. Si rompe otra ancla, esa salta también hacia donde apunte ella. Después de cada
disparo, todas las flechas giran un paso en el sentido del reloj. El cohete y la mina también las hacen saltar,
y la mira marca lo que rompería. Aparecen a partir del 4.º nivel de la Tortuga y del 3.º del Pulpo.

**Mina:** se gana cada vez que un disparo explota 3 o más bolas del mismo color. Vuela como una perla y, al pegarse, explota y
rompe todo lo que haya a 2 casillas, sea del color que sea. Tecla M.

**Perla arcoíris:** se gana cuando caen 6 o más a la vez. Toma el color del grupo más grande que toque y lo
explota si llega a 3. Tecla A.

Las tres se guardan en la fila de iconos bajo el lanzador, pasan de un mapa a otro, se cargan cuando quieras (solo
una a la vez) y no gastan disparos. Solo las perlas normales dan premios.

**Reglas:** junta 3 o más del mismo color para explotarlas; lo que se queda colgando cae y puntúa
doble. Los mapas son más altos que la pantalla: al empezar se recorren de arriba abajo y, a medida
que los rompes, bajan en bloques de 3 filas para enseñar lo que hay arriba (la barra de profundidad de la
derecha marca cuánto falta). Cada mapa tiene un límite de disparos; si se acaban o una burbuja
cruza la línea discontinua, pierdes. Vacía el mapa para completarlo: si te sobra al menos el 30 % de
los disparos, 3 estrellas; el 10 %, 2; si no, 1. El progreso se guarda en el navegador.

## Dedicatoria

El juego está dedicado a mamá. Al abrirlo sale una portada con su retrato en el centro (pensando en un guapo y
una copa de vino) rodeado de los animales de las temáticas; desde ahí, «Jugar» lleva a las temáticas y «Cómo se
juega», a las instrucciones. Los dibujos y la frase están en `src/dedication.js`.

El icono de la app es la cara de mamá. Su dibujo está en `tools/icon.svg`; para volver a sacar los PNG (en macOS):

```bash
sips -s format png tools/icon.svg --out icons/icon-512.png && sips -z 192 192 icons/icon-512.png --out icons/icon-192.png && sips -z 180 180 icons/icon-512.png --out icons/apple-touch-icon.png
```

## Temáticas

Los niveles van en 5 temáticas de animales de 10 niveles cada una, cada vez más profundas y difíciles:
Tortuga, Pulpo, Caballito de mar, Medusa y Ballena. Dentro de cada temática la dificultad sube del nivel 1 al
10, y se juegan en orden: al terminar una temática se abre la siguiente. La pantalla de temáticas enseña el
progreso de cada una y, al entrar, se ve el camino de sus 10 niveles. Las temáticas, sus nombres y colores están
en `src/levels.js`; los dibujos de los animales, en `src/animals.js`.

Cada temática tiene su propio fondo mientras se juega (arena y algas, arrecife, pradera de algas, mar abierto,
gran profundidad con el barco hundido), más oscuro cuanto más profunda. Cada medio minuto, más o menos, el
animal de la temática cruza el fondo nadando por detrás de las perlas y a mitad de camino se para a saludar
(`src/cameo.js`).

En cada temática los colores van subiendo: el nivel 1 tiene 2 colores, el 2 tiene 3, el 3 tiene 4, el 4 tiene 5
y del 5 al 10 salen los 6 (`COLOR_PLAN` en `tools/generate-maps.js`). A partir del 5.º la dificultad sigue subiendo con
mapas más largos, grupos más pequeños, anclas y menos disparos de margen.

Todos los mapas los genera `tools/generate-maps.js` y los guarda en `src/maps.js` (no se edita a mano). Los del
Pulpo conservan las formas hechas a mano de `src/levels.js`; el generador solo las vuelve a pintar con los colores
que tocan:

```bash
node tools/generate-maps.js
```

El generador es determinista, comprueba las mismas reglas que los tests y fija el límite de disparos con el bot.

## Mapas

Están en `src/maps.js` (y las formas del Pulpo, en `src/levels.js`). Cada fila es un texto de 10 letras (la primera fila es el techo):
`r` rojo · `o` naranja · `y` amarillo · `g` verde · `b` azul · `p` morado · `v` ancla · `.` hueco.
La 2.ª, 4.ª, 6.ª… fila se dibujan desplazadas media burbuja a la derecha y tienen una bola menos
(la última letra va siempre a `.`), para que los mapas puedan ser simétricos de izquierda a derecha.
`shots` es el límite de disparos.

Están hechos para ser difíciles: casi ningún color forma grupos de más de 2, así que cada explosión
hay que prepararla. A cambio, cada mapa tiene **racimos**: grupos que cuelgan de un tallo cuyo color
forma un grupo de 2 o 3, así que una sola bola bien puesta los suelta enteros. Los primeros mapas de cada
temática son más suaves (menos colores y algunos grupos de 3). `npm test` comprueba que cada mapa es válido (ancho correcto, simétrico, ninguna
burbuja suelta, grupos pequeños, al menos un racimo) y que el bot de `tools/bot.js` lo gana sin pasarse del límite. Para ver
cuántos disparos necesita el bot en cada mapa:

```bash
node tools/bot.js
```

Para probar, abre `http://localhost:5173/?debug` y usa `bubblePop.startLevel(n)` en la consola
del navegador para saltar a cualquier nivel (0 a 49; de 10 en 10 por temática), y `bubblePop.giveSpecial('rocket' | 'mine' | 'rainbow')` para sumar una bola especial.

## Estructura

- `src/logic.js` — reglas puras del tablero (rejilla hexagonal, grupos, caídas, trayectoria del disparo, cámara).
- `src/levels.js` — los mapas, las estrellas y el progreso guardado.
- `src/launcher.js` — geometría del lanzador giratorio (dónde va cada burbuja durante el giro).
- `src/game.js` — dibujo en canvas, controles, sonido sintetizado, pantallas y puntuación.
- `tools/bot.js` — bot que juega los mapas, para comprobarlos y ajustar el límite de disparos.
- `test/` — tests de la lógica y de los mapas.

## Tests

```bash
npm test
```
