# Contexto de la conversación y del proyecto

Fecha: 2025-09-04

## Resumen de objetivos
- Construir un juego tipo UNO con interfaz gráfica en JavaScript.
- Soportar colores (Rojo, Azul, Verde, Amarillo), números 0–9 y cartas especiales (+2, +4, invertir, bloquear).
- Cualquier número de jugadores (UI 2–8), mazo para robar, juego por turnos.
- Agregar sonidos, animaciones y opciones de reglas avanzadas.
- Agregar marcador de rondas y tema claro/oscuro.
- Reorganizar el proyecto en carpetas `/css`, `/js`, `/images`.

## Hitos y cambios principales
1. Implementación inicial: HTML/CSS/JS sin build, mazo, descarte, bots simples, turnos, UI para un jugador humano.
2. Mejoras UX: sonidos WebAudio, animaciones (pop/slide y “vuelo” de cartas), diálogo de opciones con reglas avanzadas:
   - Auto-jugar carta robada si es válida
   - Apilar +2 y +4 mezclados (o por tipo)
   - UNO obligatorio (botón ¡UNO! y penalización si olvidas declararlo)
3. Marcador de rondas y puntajes: suma puntos por cartas restantes de rivales; botón "Nueva ronda".
4. Tema claro/oscuro con persistencia en localStorage.
5. Correcciones:
   - Evitar CORS del `file://` retirando `type="module"` del script y recomendando servidor local.
   - Evitar error `Cannot read properties of undefined (reading 'type')` con guardas y placeholders cuando la pila de descarte está vacía.
   - Favicon 404: ícono SVG inline.
6. Reorganización del proyecto:
   - `css/styles.css` (antes `styles.css` raíz)
   - `js/main.js` (contenido migrado desde `src/main.js`)
   - `images/` carpeta preparada
   - `index.html` actualizado para usar las nuevas rutas
   7. UX móvil y ayudas:
      - Diseño responsive: tamaños de cartas/pilas fluidos, header fijo, mano con scroll horizontal, objetivos táctiles más grandes.
      - Eliminación de scroll horizontal a nivel de página en móvil; contenedores ajustados a 100vw.
      - Modal “Ayuda” (❓) con instrucciones y casilla “No mostrar de nuevo” (persistencia en localStorage); botón en header y auto-aparece al primer acceso.
      - Opción para ocultar pistas de cartas jugables por defecto y mensajes claros de por qué una carta no es válida.

## Estado actual
- Juego funcional servido localmente (ejemplo reciente: http://localhost:3000).
- `js/main.js` contiene toda la lógica del juego.
- `css/styles.css` contiene los estilos, temas y animaciones.
- `src/main.js` se dejó como archivo de referencia con una nota de “Código movido a js/main.js”. Puede eliminarse si se desea.
- `README.md` actualizado con características, ejecución, uso y estructura.

## Próximos pasos sugeridos
- Eliminar definitivamente `src/` si ya no se necesita.
- Añadir pruebas unitarias mínimas a lógica pura (por ejemplo, validación de reglas de jugadas y acumulación).
- Añadir assets a `images/` si se quieren ilustraciones/íconos.
- Publicar en GitHub Pages para compartir el juego fácilmente.
 - Mostrar el modal de ayuda opcionalmente al inicio de cada nueva ronda (configurable).

## Notas de ejecución
- Para desarrollo, se recomienda un servidor estático (ej. `npx serve .`).
- En Windows PowerShell, ejecuta los comandos en la carpeta del proyecto.
