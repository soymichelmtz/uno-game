# UNO (versión simple en JavaScript)

Juego de cartas tipo UNO con reglas simplificadas y una interfaz web sin dependencias ni build.

## Características

- Colores: rojo, azul, verde, amarillo. Números: 0–9.
- Especiales: +2, +4 (comodín con elección de color), invertir, bloquear.
- 2–8 jugadores: tú + bots sencillos por turnos y dirección (↻/↺).
- Mazo para robar y pila de descarte con recirculación automática.
- Opciones/Reglas avanzadas (botón ⚙️):
	- Sonido y animaciones activables.
	- Auto-jugar carta robada si es válida.
	- Apilado mixto de +2 y +4 (opcional) o por tipo.
	- UNO obligatorio: si no declaras y quedas con 1 carta, penaliza +2.
- Botón ¡UNO! disponible cuando aplica la regla.
- Marcador de rondas: al ganar, se suman puntos por cartas restantes de los rivales.
- Tema claro/oscuro con persistencia en localStorage.
- Efectos visuales (pop/slide) y “vuelo” de cartas entre pilas/jugadores.
 - UX móvil: diseño responsive (cartas y pilas fluidas), header fijo, mano con scroll horizontal y targets táctiles más grandes.
 - Modal de ayuda (❓) con instrucciones y opción “No mostrar de nuevo”.

## Cómo ejecutar

- Rápido: abre `index.html` directamente en un navegador moderno.
- Recomendado (evita restricciones de `file://` y facilita pruebas):

```powershell
# En PowerShell, dentro de la carpeta del proyecto
npx serve .
```

Luego visita la URL mostrada (ej. http://localhost:3000 o el puerto asignado).

## Uso básico

- Al cargar por primera vez verás un modal de ayuda con las reglas básicas (puedes reabrirlo con ❓ Ayuda o marcar “No mostrar de nuevo”).
- Ajusta “Jugadores” y pulsa “Iniciar partida”.
- Tus cartas aparecen abajo. Por defecto no se resaltan; si quieres pistas visuales, activa “Mostrar sugerencias de cartas jugables” en ⚙️ Opciones.
- Botones: “Robar”, “Pasar”, “¡UNO!” (si la regla está activa).
- Tras un +4, elige color en el diálogo.

## Reglas (resumen)

- Se puede jugar por coincidencia de color o número, o por tipo especial igual.
- +2 y +4 acumulan penalización; con acumulación activa, responde con +2/+4 o roba todo.
- “Invertir” cambia la dirección; con 2 jugadores equivale a “Bloquear”.
- “Bloquear” salta al siguiente jugador.

Tips de UX:
- En móvil, desplaza lateralmente tu mano si hay muchas cartas (sólo se desplaza la mano, no la página).
- El mensaje inferior explica por qué una carta no es válida cuando las pistas están desactivadas.

## Estructura del proyecto

- `index.html` — layout principal y carga de recursos.
- `css/styles.css` — estilos, temas, animaciones.
- `js/main.js` — lógica del juego, IA básica, render y audio.
- `images/` — carpeta para futuros recursos.

## Personalización rápida

- Ajusta el mazo en `createDeck()` y la IA en `maybeBotTurn()` / `botChooseColor()`.
- Cambia efectos/sonidos mediante las opciones o editando `S.play(...)`.

## Notas

- Si ves errores CORS al abrir con `file://`, usa un servidor local (ver arriba).
- Este proyecto es educativo y no replica todas las reglas oficiales de UNO.
 - Si notas scroll horizontal de la página en móviles, abre un issue con tu modelo y resolución; se ajustan los breakpoints fácilmente.
