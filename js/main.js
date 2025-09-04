// UNO-like game (simplified) - JS module
// Reglas solicitadas:
// - Colores: rojo, azul, verde, amarillo
// - Números: 0-9
// - Especiales: +2, +4 (comodín), invertir, bloquear
// - Cualquier cantidad de jugadores (2-8 en UI)
// - Mazo para robar, juego por turnos, bots sencillos

const COLORS = ["red", "yellow", "green", "blue"]; // usamos english keys para CSS
const NUMBERS = Array.from({ length: 10 }, (_, i) => String(i));
const TYPES = {
	NUMBER: "number",
	PLUS2: "+2",
	PLUS4: "+4",
	REVERSE: "reverse",
	SKIP: "skip",
};

// Representación de carta: { color: 'red'|'yellow'|'green'|'blue'|null, type: 'number'|'+2'|'+4'|'reverse'|'skip', value?: '0'-'9' }
function createDeck() {
	const deck = [];
	// Números: 0-9 (una copia por color para simplificar)
	for (const c of COLORS) {
		for (const n of NUMBERS) {
			deck.push({ color: c, type: TYPES.NUMBER, value: n });
		}
		// +2, reverse, skip (2 copias cada uno por color podría ser; usamos 1 para simple)
		deck.push({ color: c, type: TYPES.PLUS2 });
		deck.push({ color: c, type: TYPES.REVERSE });
		deck.push({ color: c, type: TYPES.SKIP });
	}
	// Comodines +4 (4 copias en total)
	for (let i = 0; i < 4; i++) deck.push({ color: null, type: TYPES.PLUS4 });
	return shuffle(deck);
}

function shuffle(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function canPlayOn(card, top, forcedColor) {
	// forcedColor existe cuando se jugó +4 con elección
	const topColor = forcedColor ?? top.color;
	if (card.type === TYPES.PLUS4) return true; // comodín se puede jugar siempre
	if (card.color === topColor) return true;
	if (top.type === TYPES.NUMBER && card.type === TYPES.NUMBER && card.value === top.value) return true;
	if (top.type !== TYPES.NUMBER && card.type === top.type) return true; // mismas especiales
	return false;
}

function drawCards(state, playerIndex, count) {
	ensureDrawPile(state);
	for (let i = 0; i < count; i++) {
		if (state.drawPile.length === 0) ensureDrawPile(state);
		const card = state.drawPile.pop();
		if (!card) break;
		state.hands[playerIndex].push(card);
	}
}

function ensureDrawPile(state) {
	if (state.drawPile.length > 0) return;
	// mover descartes excepto la última
	if (state.discardPile.length > 1) {
		const last = state.discardPile.pop();
		state.drawPile = shuffle(state.discardPile);
		state.discardPile = [last];
	} else if (state.discardPile.length === 0) {
		// fallback raro: recrear mazo mínimo si todo quedó vacío
		state.drawPile = createDeck();
	}
}

function nextPlayer(state, steps = 1) {
	const n = state.players.length;
	state.currentPlayer = (state.currentPlayer + steps * state.direction + n) % n;
}

function placeCard(state, playerIndex, cardIndex, chosenColor = null) {
	const card = state.hands[playerIndex][cardIndex];
	state.hands[playerIndex].splice(cardIndex, 1);
	state.discardPile.push(card);
	state.forcedColor = card.type === TYPES.PLUS4 ? (chosenColor ?? randomColor()) : null;

	const applySkip = () => nextPlayer(state, 1);
	const applyReverse = () => (state.direction *= -1);
	const applyPlus2 = () => (state.stackDraw += 2);
	const applyPlus4 = () => (state.stackDraw += 4);

	switch (card.type) {
		case TYPES.SKIP:
			applySkip();
			break;
		case TYPES.REVERSE:
			applyReverse();
			// con 2 jugadores, reverse actúa como skip
			if (state.players.length === 2) applySkip();
			break;
		case TYPES.PLUS2:
			// si se inicia una nueva pila de acumulación, fijar tipo
			if (state.stackDraw === 0) state.stackType = TYPES.PLUS2;
			applyPlus2();
			break;
		case TYPES.PLUS4:
			if (state.stackDraw === 0) state.stackType = TYPES.PLUS4;
			applyPlus4();
			break;
		default:
			// número normal resetea forcedColor
			break;
	}
}

function hasPlayable(state, playerIndex) {
	const hand = state.hands[playerIndex];
	const top = state.discardPile[state.discardPile.length - 1];
	return hand.some((c) => canPlayOn(c, top, state.forcedColor));
}

function randomColor() {
	return COLORS[(Math.random() * COLORS.length) | 0];
}

// Estado global del juego
const G = {
	players: [], // ["Tú", "Bot 1", ...]
	hands: [], // Array<Array<Card>>
	drawPile: [],
	discardPile: [],
	currentPlayer: 0,
	direction: 1, // 1 = sentido horario, -1 = antihorario
	stackDraw: 0, // acumulado por +2/+4
	stackType: null, // tipo actual de acumulación (+2 o +4) si aplica
	forcedColor: null, // color elegido tras +4
	running: false,
	unoArmed: [], // bool por jugador: declaró UNO para este turno
	_lastAction: null, // {type:'draw'|'play'|'stack'|'turn', player:number}
	scores: [], // puntaje acumulado por jugador
	round: 1,
	lastWinner: null,
};

// Configuración (sin persistencia por simplicidad)
const C = {
	sound: true,
	animations: true,
	autoPlayDrawn: true,
	mixStacking: true,
	unoRequired: false,
	showHints: false, // NO sugerir cartas jugables por defecto
};

// Sonidos simples vía WebAudio
const S = (() => {
	let ctx = null;
	const ensure = () => {
		if (!ctx) {
			try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
		}
		return ctx;
	};
	const beep = (freq = 440, dur = 0.08, type = 'sine', gain = 0.04) => {
		if (!C.sound) return;
		const ac = ensure();
		if (!ac) return;
		const t = ac.currentTime;
		const o = ac.createOscillator();
		const g = ac.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.connect(g).connect(ac.destination);
		o.start();
		o.stop(t + dur);
	};
	const play = (name) => {
		switch (name) {
			case 'draw': beep(250, 0.08, 'triangle'); break;
			case 'play': beep(520, 0.07, 'sawtooth'); break;
			case 'stack': beep(380, 0.09, 'square'); setTimeout(() => beep(480, 0.08, 'square'), 70); break;
			case 'reverse': beep(300, 0.06, 'sine'); setTimeout(() => beep(240, 0.06, 'sine'), 60); break;
			case 'skip': beep(180, 0.06, 'sine'); break;
			case 'turn': beep(700, 0.05, 'sine'); break;
			case 'win': beep(660, 0.1, 'sine'); setTimeout(()=>beep(880,0.12,'sine'),100); setTimeout(()=>beep(990,0.14,'sine'),220); break;
			case 'error': beep(120, 0.08, 'square'); break;
		}
	};
	return { play };
})();

// UI refs
const refs = {
	startBtn: document.getElementById("startBtn"),
	playersCount: document.getElementById("playersCount"),
	opponents: document.getElementById("opponents"),
	humanHand: document.getElementById("humanHand"),
	turnLabel: document.getElementById("turnLabel"),
	dirLabel: document.getElementById("dirLabel"),
	drawPile: document.getElementById("drawPile"),
	discardPile: document.getElementById("discardPile"),
	drawCount: document.getElementById("drawCount"),
	discardCount: document.getElementById("discardCount"),
	message: document.getElementById("message"),
	drawBtn: document.getElementById("drawBtn"),
	passBtn: document.getElementById("passBtn"),
	colorDialog: document.getElementById("colorDialog"),
	stackLabel: document.getElementById("stackLabel"),
	settingsBtn: document.getElementById("settingsBtn"),
	settingsDialog: document.getElementById("settingsDialog"),
	optSound: document.getElementById("optSound"),
	optAnimations: document.getElementById("optAnimations"),
	optAutoPlayDrawn: document.getElementById("optAutoPlayDrawn"),
	optMixStacking: document.getElementById("optMixStacking"),
	optUnoRequired: document.getElementById("optUnoRequired"),
		optShowHints: document.getElementById("optShowHints"),
	unoBtn: document.getElementById("unoBtn"),
	themeBtn: document.getElementById("themeBtn"),
	roundLabel: document.getElementById("roundLabel"),
	scoreList: document.getElementById("scoreList"),
	nextRoundBtn: document.getElementById("nextRoundBtn"),
	scoreboard: document.getElementById("scoreboard"),
};

refs.startBtn.addEventListener("click", () => startGame(Number(refs.playersCount.value || 4)));
refs.drawBtn.addEventListener("click", onHumanDraw);
refs.passBtn.addEventListener("click", onHumanPass);
refs.settingsBtn?.addEventListener("click", onOpenSettings);
refs.settingsDialog?.addEventListener("close", onSettingsClose);
refs.unoBtn?.addEventListener("click", () => {
	if (G.players[G.currentPlayer] !== "Tú") return;
	if (!C.unoRequired) return;
	if ((G.hands[0]?.length || 0) !== 2) return;
	G.unoArmed[0] = true;
	setMessage("UNO listo para este turno");
	if (C.sound) S.play('turn');
});
refs.themeBtn?.addEventListener('click', toggleTheme);
refs.nextRoundBtn?.addEventListener('click', startNextRound);

// Tema persistente
const THEME_KEY = 'uno_theme';
applySavedTheme();

function startGame(playersCount) {
	const n = Math.min(Math.max(playersCount, 2), 8);
	G.players = Array.from({ length: n }, (_, i) => (i === 0 ? "Tú" : `Bot ${i}`));
	G.hands = Array.from({ length: n }, () => []);
	G.drawPile = createDeck();
	G.discardPile = [];
	G.currentPlayer = 0;
	G.direction = 1;
	G.stackDraw = 0;
	G.stackType = null;
	G.forcedColor = null;
	G.running = true;
	 G.unoArmed = Array.from({ length: n }, () => false);
	 G._lastAction = { type: 'turn', player: 0 };
	if (!Array.isArray(G.scores) || G.scores.length !== n) G.scores = Array.from({ length: n }, () => 0);

	// Repartir 7 cartas por jugador
	for (let r = 0; r < 7; r++) {
		for (let p = 0; p < n; p++) drawCards(G, p, 1);
	}

	// carta inicial en descarte (evita +4 como primera)
	let first;
	do {
		first = G.drawPile.pop();
	} while (first && first.type === TYPES.PLUS4);
	if (!first) first = { color: randomColor(), type: TYPES.NUMBER, value: "0" };
	G.discardPile.push(first);

	renderAll();
	if (C.sound) S.play('turn');
	maybeBotTurn();
}

function onHumanDraw() {
	if (!G.running || G.players[G.currentPlayer] !== "Tú") return;
	if (G.stackDraw > 0) {
		// debe comer acumulado y perder turno
		drawCards(G, 0, G.stackDraw);
		setMessage(`Has robado ${G.stackDraw}`);
		G.stackDraw = 0;
		G.stackType = null;
		G.forcedColor = null;
		nextPlayer(G, 1);
		renderAll();
		setTimeout(maybeBotTurn, 600);
		return;
	}
	drawCards(G, 0, 1);
	G._lastAction = { type: 'draw', player: 0 };
	if (C.sound) S.play('draw');
	const startRect = getPileCardRect('draw');
	// auto-jugar si activa la opción
	if (C.autoPlayDrawn) {
		const top = G.discardPile[G.discardPile.length - 1];
		const idx = G.hands[0].length - 1;
		const card = G.hands[0][idx];
		if (canPlayOn(card, top, G.forcedColor) && canPlayConsideringStack(card)) {
			if (card.type === TYPES.PLUS4) {
				openColorDialog().then((color) => {
					if (!color) return renderAll();
					const labelInfo = getCardLabelInfo(card);
					placeCard(G, 0, idx, color);
					renderAll();
					const endRect = getPileCardRect('discard');
					if (C.animations && startRect && endRect) flyCard(labelInfo, startRect, endRect);
					afterPlayCommonWithUnoCheck(0, card);
				});
			} else {
				const labelInfo = getCardLabelInfo(card);
				placeCard(G, 0, idx, null);
				renderAll();
				const endRect = getPileCardRect('discard');
				if (C.animations && startRect && endRect) flyCard(labelInfo, startRect, endRect);
				afterPlayCommonWithUnoCheck(0, card);
			}
			return;
		}
	}
	renderAll();
	// animar robo hacia la última carta de la mano
	if (C.animations && startRect) {
		const targetEl = refs.humanHand.lastElementChild;
		const endRect = targetEl?.getBoundingClientRect();
		if (endRect) flyCard({ label: targetEl.textContent || '', className: targetEl.className.replace('selectable','') }, startRect, endRect);
	}
}

function onHumanPass() {
	if (!G.running || G.players[G.currentPlayer] !== "Tú") return;
	// Sólo puedes pasar si no tienes jugada
	if (hasPlayable(G, 0)) {
		setMessage("Tienes una carta jugable");
		return;
	}
	nextPlayer(G, 1);
	renderAll();
	setTimeout(maybeBotTurn, 600);
}

function onHumanPlay(index) {
	if (!G.running || G.players[G.currentPlayer] !== "Tú") return;
	const top = G.discardPile[G.discardPile.length - 1];
	const card = G.hands[0][index];
	if (!canPlayOn(card, top, G.forcedColor)) {
		setMessage(explainInvalidPlay(card, top));
		if (C.sound) S.play('error');
		return;
	}

	// Manejo de acumulación: si hay stackDraw>0, sólo se puede jugar +2 o +4
	if (G.stackDraw > 0 && !canPlayConsideringStack(card)) {
		setMessage(explainInvalidPlay(card, top));
		if (C.sound) S.play('error');
		return;
	}

	const startEl = refs.humanHand.children[index];
	const startRect = startEl?.getBoundingClientRect();
	const labelInfo = getCardLabelInfo(card);
	if (card.type === TYPES.PLUS4) {
		openColorDialog().then((color) => {
			if (!color) return; // cancelado (no debería en dialog nativo)
			placeCard(G, 0, index, color);
			renderAll();
			const endRect = getPileCardRect('discard');
			if (C.animations && startRect && endRect) flyCard(labelInfo, startRect, endRect);
			afterPlayCommonWithUnoCheck(0, card);
		});
		return;
	}

	placeCard(G, 0, index, null);
	renderAll();
	const endRect = getPileCardRect('discard');
	if (C.animations && startRect && endRect) flyCard(labelInfo, startRect, endRect);
	afterPlayCommonWithUnoCheck(0, card);
}

function afterPlayCommonWithUnoCheck(playerIndex, card) {
	// sonido según carta
	if (C.sound) {
		if (card.type === TYPES.PLUS2 || card.type === TYPES.PLUS4) S.play('stack');
		else if (card.type === TYPES.REVERSE) S.play('reverse');
		else if (card.type === TYPES.SKIP) S.play('skip');
		else S.play('play');
	}

	// UNO obligatorio
	if (C.unoRequired && G.hands[playerIndex].length === 1) {
		if (!G.unoArmed[playerIndex]) {
			drawCards(G, playerIndex, 2);
			setMessage(`${G.players[playerIndex]} no declaró UNO. Penalización +2`);
		} else {
			setMessage(`${G.players[playerIndex]} declaró UNO`);
		}
		G.unoArmed[playerIndex] = false;
	}

	// ¿ganó?
	if (G.hands[playerIndex].length === 0) {
		setMessage(`${G.players[playerIndex]} gana!`);
		if (C.sound) S.play('win');
		G.running = false;
		onRoundEnd(playerIndex);
		renderAll();
		return;
	}

	// avanzar turno (nota: algunas cartas ya avanzaron dentro de placeCard)
	nextPlayer(G, 1);
	G._lastAction = { type: 'turn', player: G.currentPlayer };
	renderAll();
	setTimeout(maybeBotTurn, 600);
}

function maybeBotTurn() {
	if (!G.running) return;
	if (G.players[G.currentPlayer] === "Tú") return;
	const idx = G.currentPlayer;

	// Si tiene acumulado por comer y no puede contrarrestar, roba todo y pasa
	if (G.stackDraw > 0) {
		const playablePlus = G.hands[idx].findIndex((c) => canPlayConsideringStack(c));
		if (playablePlus === -1) {
			drawCards(G, idx, G.stackDraw);
			setMessage(`${G.players[idx]} roba ${G.stackDraw}`);
			G.stackDraw = 0;
			G.stackType = null;
			G.forcedColor = null;
			nextPlayer(G, 1);
			renderAll();
			setTimeout(maybeBotTurn, 500);
			return;
		} else {
			const c = G.hands[idx][playablePlus];
			const startRect = getOpponentCardRect(idx);
			// El bot "declara" UNO si se quedará con 1 carta
			if (C.unoRequired && G.hands[idx].length === 2) G.unoArmed[idx] = true;
			const chosen = c.type === TYPES.PLUS4 ? botChooseColor(idx) : null;
			placeCard(G, idx, playablePlus, chosen);
			renderAll();
			const endRect = getPileCardRect('discard');
			if (C.animations && startRect && endRect) flyCard(getCardLabelInfo(c), startRect, endRect);
			afterPlayCommonWithUnoCheck(idx, c);
			return;
		}
	}

	// Buscar jugable normal
	const top = G.discardPile[G.discardPile.length - 1];
	let playIndex = G.hands[idx].findIndex((c) => canPlayOn(c, top, G.forcedColor));
	if (playIndex === -1) {
		// robar una y ver si se puede jugar
		drawCards(G, idx, 1);
		if (C.sound) S.play('draw');
		playIndex = G.hands[idx].length - 1;
		const newCard = G.hands[idx][playIndex];
		if (!canPlayOn(newCard, top, G.forcedColor) || (G.stackDraw > 0 && !canPlayConsideringStack(newCard))) {
			nextPlayer(G, 1);
			renderAll();
			setTimeout(maybeBotTurn, 500);
			return;
		}
	}

	const card = G.hands[idx][playIndex];
	const startRect = getOpponentCardRect(idx);
	if (C.unoRequired && G.hands[idx].length === 2) G.unoArmed[idx] = true;
	const chosen = card.type === TYPES.PLUS4 ? botChooseColor(idx) : null;
	placeCard(G, idx, playIndex, chosen);
	renderAll();
	const endRect = getPileCardRect('discard');
	if (C.animations && startRect && endRect) flyCard(getCardLabelInfo(card), startRect, endRect);
	afterPlayCommonWithUnoCheck(idx, card);
}

function botChooseColor(idx) {
	// elige el color del que más tenga
	const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
	for (const c of G.hands[idx]) if (c.color) counts[c.color]++;
	let best = "red";
	for (const k of COLORS) if (counts[k] > counts[best]) best = k;
	return best;
}

function setMessage(t) {
	refs.message.textContent = t || "";
}

function openColorDialog() {
	return new Promise((resolve) => {
		const onClose = (e) => {
			const val = e.target.returnValue || null;
			refs.colorDialog.removeEventListener("close", onClose);
			resolve(val);
		};
		refs.colorDialog.addEventListener("close", onClose, { once: true });
		try { refs.colorDialog.showModal(); } catch { resolve(null); }
	});
}

function renderAll() {
	// oponentes
	refs.opponents.innerHTML = "";
	for (let i = 1; i < G.players.length; i++) {
		const div = document.createElement("div");
		div.className = "opponent";
		const name = document.createElement("div");
		name.className = "name";
		name.textContent = `${G.players[i]}${i === G.currentPlayer ? " (turno)" : ""}`;
		const cards = document.createElement("div");
		cards.className = "cards";
		for (let k = 0; k < G.hands[i].length; k++) {
			const back = document.createElement("div");
			back.className = "card small back";
			back.textContent = "UNO";
			cards.appendChild(back);
		}
		div.appendChild(name);
		div.appendChild(cards);
		if (i === G.currentPlayer && C.animations) div.classList.add('glow');
		refs.opponents.appendChild(div);
	}

	// montones
	refs.drawCount.textContent = String(G.drawPile.length);
	refs.discardCount.textContent = String(G.discardPile.length);
	const top = G.discardPile.length ? G.discardPile[G.discardPile.length - 1] : null;
	renderCardInto(refs.discardPile, top, true);

	// turno y dirección
	refs.turnLabel.textContent = G.players[G.currentPlayer] || "—";
	refs.dirLabel.textContent = G.direction === 1 ? "↻" : "↺";
	refs.stackLabel.textContent = `Acumulado: ${G.stackDraw}`;
	refs.roundLabel && (refs.roundLabel.textContent = String(G.round));

	// mano humana
	refs.humanHand.innerHTML = "";
	const hand = G.hands[0] || [];
	for (let i = 0; i < hand.length; i++) {
		const c = hand[i];
		const el = makeCardEl(c);
			const playable = G.running && G.players[G.currentPlayer] === "Tú" && (top ? canPlayOn(c, top, G.forcedColor) : true);
			// Si hay acumulación activa, sólo +2 o +4 son jugables
			const playableWithStack = G.stackDraw > 0 ? canPlayConsideringStack(c) : playable;

			if (C.showHints) {
				el.classList.toggle("selectable", playableWithStack);
				if (playableWithStack) {
					el.addEventListener("click", () => onHumanPlay(i));
				} else {
					el.classList.add("disabled");
				}
			} else {
				// Sin sugerencias: todas las cartas son clicables; si no es válida, se muestra error.
				el.addEventListener("click", () => onHumanPlay(i));
			}
		refs.humanHand.appendChild(el);
	}
	// anim de carta robada
	if (G._lastAction?.type === 'draw' && G._lastAction.player === 0 && C.animations) {
		const last = refs.humanHand.lastElementChild; if (last) last.classList.add('animate-slide-up');
	}
	// resaltar turno humano
	if (G.players[G.currentPlayer] === 'Tú' && C.animations) refs.humanHand.classList.add('glow'); else refs.humanHand.classList.remove('glow');

	// UNO button state
	if (refs.unoBtn) {
		const canUNO = C.unoRequired && G.players[G.currentPlayer] === 'Tú' && (G.hands[0]?.length === 2);
		refs.unoBtn.disabled = !canUNO;
	}

	// marcador
	renderScoreboard();
}

function makeCardEl(card) {
	const div = document.createElement("div");
	const baseClass = card.type === TYPES.PLUS4 ? "wild" : card.color;
	div.className = `card ${baseClass}`;
	let label = "";
	switch (card.type) {
		case TYPES.NUMBER:
			label = card.value;
			break;
		case TYPES.PLUS2:
			label = "+2";
			break;
		case TYPES.PLUS4:
			label = "+4";
			break;
		case TYPES.REVERSE:
			label = "↺";
			break;
		case TYPES.SKIP:
			label = "⦸";
			break;
	}
	div.textContent = label;
	return div;
}

function renderCardInto(container, card, isTop = false) {
	container.innerHTML = "";
	if (!card) {
		const ph = document.createElement('div');
		ph.className = 'card placeholder';
		ph.textContent = '—';
		container.appendChild(ph);
		return;
	}
	const el = makeCardEl(card);
	container.appendChild(el);
	if (isTop && G.forcedColor && card.type === TYPES.PLUS4) {
		// borde para indicar color forzado
		el.style.boxShadow = `0 0 0 6px rgba(255,255,255,.6) inset, 0 0 0 12px var(--${G.forcedColor}) inset`;
	}
	if (isTop && C.animations) el.classList.add('animate-pop');
}

// inicial
renderAll();

// Helpers de reglas avanzadas
function canPlayConsideringStack(card) {
	if (G.stackDraw <= 0) return true;
	if (!(card.type === TYPES.PLUS2 || card.type === TYPES.PLUS4)) return false;
	if (C.mixStacking) return true;
	return card.type === G.stackType;
}

function onOpenSettings() {
	// reflejar config en UI
	if (!refs.settingsDialog) return;
	refs.optSound.checked = !!C.sound;
	refs.optAnimations.checked = !!C.animations;
	refs.optAutoPlayDrawn.checked = !!C.autoPlayDrawn;
	refs.optMixStacking.checked = !!C.mixStacking;
	refs.optUnoRequired.checked = !!C.unoRequired;
	if (refs.optShowHints) refs.optShowHints.checked = !!C.showHints;
	try { refs.settingsDialog.showModal(); } catch {}
}

function onSettingsClose() {
	if (!refs.settingsDialog || refs.settingsDialog.returnValue === 'cancel') {
		// recoger igualmente porque el botón cierra sin valores
	}
	C.sound = !!refs.optSound.checked;
	C.animations = !!refs.optAnimations.checked;
	C.autoPlayDrawn = !!refs.optAutoPlayDrawn.checked;
	C.mixStacking = !!refs.optMixStacking.checked;
	C.unoRequired = !!refs.optUnoRequired.checked;
		if (refs.optShowHints) C.showHints = !!refs.optShowHints.checked;
	renderAll();
}

// Marcador y rondas
function cardPoints(card) {
	if (card.type === TYPES.NUMBER) return Number(card.value) || 0;
	if (card.type === TYPES.PLUS4) return 50;
	return 20; // +2, reverse, skip
}
function computeWinnerGain(winnerIdx) {
	let sum = 0;
	for (let i = 0; i < G.hands.length; i++) {
		if (i === winnerIdx) continue;
		for (const c of G.hands[i]) sum += cardPoints(c);
	}
	return sum;
}
function onRoundEnd(winnerIdx) {
	G.lastWinner = winnerIdx;
	const gain = computeWinnerGain(winnerIdx);
	G.scores[winnerIdx] += gain;
	if (refs.nextRoundBtn) refs.nextRoundBtn.disabled = false;
	renderScoreboard();
}
function startNextRound() {
	if (refs.nextRoundBtn) refs.nextRoundBtn.disabled = true;
	G.round += 1;
	G.lastWinner = null;
	startGame(G.players.length);
}
function renderScoreboard() {
	if (!refs.scoreList) return;
	refs.scoreList.innerHTML = '';
	for (let i = 0; i < G.players.length; i++) {
		const li = document.createElement('li');
		li.innerHTML = `<span>${G.players[i]}</span><span>${G.scores[i] ?? 0}</span>`;
		refs.scoreList.appendChild(li);
	}
	if (refs.nextRoundBtn) refs.nextRoundBtn.disabled = G.running;
}

// Tema claro/oscuro
function toggleTheme() {
	const el = document.documentElement;
	const isLight = el.classList.toggle('theme-light');
	try { localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark'); } catch {}
}
function applySavedTheme() {
	try {
		const t = localStorage.getItem(THEME_KEY);
		if (t === 'light') document.documentElement.classList.add('theme-light');
	} catch {}
}

// Animaciones de vuelo
function getPileCardRect(type) {
	const el = type === 'draw' ? refs.drawPile.querySelector('.card') : refs.discardPile.querySelector('.card');
	return el?.getBoundingClientRect();
}
function getOpponentCardRect(playerIdx) {
	const container = refs.opponents.children[playerIdx - 1];
	const el = container?.querySelector('.card');
	return el?.getBoundingClientRect();
}
function getCardLabelInfo(card) {
	let label = '';
	switch (card.type) {
		case TYPES.NUMBER: label = card.value; break;
		case TYPES.PLUS2: label = '+2'; break;
		case TYPES.PLUS4: label = '+4'; break;
		case TYPES.REVERSE: label = '↺'; break;
		case TYPES.SKIP: label = '⦸'; break;
	}
	const baseClass = card.type === TYPES.PLUS4 ? 'wild' : card.color;
	return { label, className: `card ${baseClass} fly` };
}
	// Descripciones y explicación de jugada inválida
	function colorToEs(color) {
		return ({ red: 'Rojo', yellow: 'Amarillo', green: 'Verde', blue: 'Azul' })[color] || '';
	}
	function cardShortLabel(card) {
		switch (card.type) {
			case TYPES.NUMBER: return card.value;
			case TYPES.PLUS2: return '+2';
			case TYPES.PLUS4: return '+4';
			case TYPES.REVERSE: return 'Invertir';
			case TYPES.SKIP: return 'Bloquear';
		}
		return '';
	}
	function describeTop(top) {
		if (!top) return '';
		const color = top.color ? colorToEs(top.color) : '';
		const lbl = cardShortLabel(top);
		if (top.type === TYPES.NUMBER) return `${lbl} ${color}`.trim();
		return `${lbl}${color ? ' ' + color : ''}`.trim();
	}
	function explainInvalidPlay(card, top) {
		// Prioridad: acumulación activa
		if (G.stackDraw > 0) {
			if (!(card.type === TYPES.PLUS2 || card.type === TYPES.PLUS4)) {
				return `Acumulado de ${G.stackDraw}: debes responder con +2 o +4.`;
			}
			if (!C.mixStacking && card.type !== G.stackType) {
				const req = G.stackType === TYPES.PLUS2 ? '+2' : '+4';
				return `Acumulado de ${G.stackDraw}: responde con ${req}.`;
			}
		}
		// Color forzado por +4
		if (G.forcedColor && !(card.type === TYPES.PLUS4) && card.color !== G.forcedColor) {
			return `Color forzado: ${colorToEs(G.forcedColor)}. Juega ese color o +4.`;
		}
		// Coincidencia básica
		const topDesc = describeTop(top);
		if (top?.type === TYPES.NUMBER) {
			return `Debe coincidir color o número (arriba: ${topDesc}).`;
		}
		return `Debe coincidir color o tipo especial (arriba: ${topDesc}).`;
	}
function flyCard(labelInfo, startRect, endRect) {
	if (!startRect || !endRect) return;
	const el = document.createElement('div');
	el.className = labelInfo.className;
	el.textContent = labelInfo.label;
	Object.assign(el.style, {
		left: startRect.left + 'px',
		top: startRect.top + 'px',
		width: startRect.width + 'px',
		height: startRect.height + 'px',
	});
	document.body.appendChild(el);
	const dx = endRect.left - startRect.left;
	const dy = endRect.top - startRect.top;
	const sx = endRect.width / startRect.width;
	const sy = endRect.height / startRect.height;
	// forzar reflow
	void el.offsetWidth;
	el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
	const clean = () => el.remove();
	el.addEventListener('transitionend', clean, { once: true });
	// fallback cleanup
	setTimeout(clean, 450);
}
