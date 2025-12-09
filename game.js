// Bitty Pacman – dot-baan uit MAZE, alles weer geschaald met pathScale
// ---------------------------------------------------------------------------
// CANVASSEN
// ---------------------------------------------------------------------------

const mazeCanvas = document.getElementById("mazeCanvas");
const mazeCtx = mazeCanvas.getContext("2d");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- SPEED CONFIG (Google Pacman verhoudingen) ---
const TILE_SIZE = 32;

const SPEED_CONFIG = {
  playerSpeed: 2.8,
  ghostSpeed: 2.8 * 0.90,
  ghostTunnelSpeed: 2.8 * 0.45,
  ghostFrightSpeed: 2.8 * 0.60,
};

// --- GHOST MODES ---
const GHOST_MODE_SCATTER = 0;
const GHOST_MODE_CHASE = 1;
const GHOST_MODE_FRIGHTENED = 2;
const GHOST_MODE_EATEN = 3;
const GHOST_MODE_IN_PEN = 4;
const GHOST_MODE_LEAVING = 5;

const GHOST_MODE_SEQUENCE = [
  { mode: GHOST_MODE_SCATTER, durationMs: 2000 },
  { mode: GHOST_MODE_CHASE, durationMs: 35000 },
  { mode: GHOST_MODE_SCATTER, durationMs: 2000 },
  { mode: GHOST_MODE_CHASE, durationMs: Infinity },
];

let globalGhostMode = GHOST_MODE_SCATTER;
let ghostModeIndex = 0;
let ghostModeElapsedTime = 0;

// Dots
const DOT_RADIUS = 3;
const POWER_RADIUS = 7;

let powerDotPhase = 0;
const POWER_DOT_BLINK_SPEED = 0.12;

// Clyde afstand
const CLYDE_SCATTER_DISTANCE_TILES = 4;
const CLYDE_SCATTER_DISTANCE2 = CLYDE_SCATTER_DISTANCE_TILES ** 2;

// Frightened variabelen
let frightTimer = 0;
let frightFlash = false;
let ghostEatChain = 0;
let frightActivationCount = 0;

const FRIGHT_DURATION_MS = 12000;
const FRIGHT_FLASH_MS = 5000;

// ---------------------------------------------------------------------------
// BITTY BONUS (WOW + Coins)
// ---------------------------------------------------------------------------

let bittyBonusActive = false;
let bittyBonusTimer = 0;

let showBittyWow = false;
let bittyWowTimer = 0;

const BITTY_WOW_DURATION_MS = 1500;
const BITTY_BONUS_DURATION_MS = 20000;

const bittyBonusCoins = [];

// ---------------------------------------------------------------------------
// MAZE
// ---------------------------------------------------------------------------

const MAZE = [
  "#O........................O#",
  "#.####.##.#####.#####.####.#",
  "#.####.##.#####.#####.####.#",
  "#.####.##..###...###..####.#",
  "#.####.##..###...###...###.#",
  "#.####.##..###...###...###.#",
  "#..........................#",
  "#..........................#",
  "######.####.####.####.######",
  "######.####.####.####.######",
  "######.##.........O##.######",
  "######.##.####X###.##.######",
  "######.##.####X###.##.######",
  "..........##GGGG##..........",
  "######.##.########.##.######",
  "######.##.########.##.######",
  "######.##O.........##.######",
  "######.##.########.##.######",
  "######.##.########.##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#...##................##...#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#O...........P............O#",
];

const ROWS = MAZE.length;
const COLS = MAZE[0].length;

// Portal
const PORTAL_ROW = 13;
const PORTAL_LEFT_COL = 0;
const PORTAL_RIGHT_COL = COLS - 1;

// Door
const DOOR_ROW = 11;
const DOOR_START_COL = 12;
const DOOR_END_COL = 16;

const GAME_WIDTH = COLS * TILE_SIZE;
const GAME_HEIGHT = ROWS * TILE_SIZE;

mazeCanvas.width = GAME_WIDTH;
mazeCanvas.height = GAME_HEIGHT;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// ---------------------------------------------------------------------------
// SPRITES & SOUNDS
// ---------------------------------------------------------------------------

const playerImg = new Image();
playerImg.src = "pacman_sheet_32x32_4x3.png";
let playerLoaded = false;
playerImg.onload = () => (playerLoaded = true);

// BITTY COIN IMAGE
const bittyCoinImg = new Image();
bittyCoinImg.src = "bittybonus.png";
let bittyCoinLoaded = false;
bittyCoinImg.onload = () => (bittyCoinLoaded = true);

// Sounds
const bittyBonusSound = new Audio("bittybonussound.mp3");
bittyBonusSound.volume = 0.8;

const bittyCoinSound = new Audio("coinsoundbitty.mp3");
bittyCoinSound.volume = 0.8;

function playBittyBonusSound() {
  bittyBonusSound.currentTime = 0;
  bittyBonusSound.play().catch(() => {});
}

function playBittyCoinSound() {
  const s = bittyCoinSound.cloneNode();
  s.volume = bittyCoinSound.volume;
  s.play().catch(() => {});
}

// Ghost eat sound
const ghostEatSound = new Audio("ghosteat.mp3");
ghostEatSound.volume = 0.7;

// Ready sound
const readySound = new Audio("getready.mp3");
readySound.volume = 0.8;

// ---------------------------------------------------------------------------
// FIND START POSITIONS
// ---------------------------------------------------------------------------

function findPositions() {
  let pac = null;
  let ghostStarts = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === "P") pac = { c, r };
      if (MAZE[r][c] === "G") ghostStarts.push({ c, r });
    }
  }

  let avgC = Math.round(ghostStarts.reduce((s, g) => s + g.c, 0) / ghostStarts.length);
  let avgR = Math.round(ghostStarts.reduce((s, g) => s + g.r, 0) / ghostStarts.length);

  return { pac, ghostPen: { c: avgC, r: avgR }, ghostStarts };
}

const { pac, ghostPen, ghostStarts } = findPositions();

// ---------------------------------------------------------------------------
// BITTY BONUS HELPERS
// ---------------------------------------------------------------------------

function resetBittyBonus() {
  bittyBonusActive = false;
  bittyBonusTimer = 0;
  showBittyWow = false;
  bittyWowTimer = 0;
  bittyBonusCoins.length = 0;
}

function startBittyBonus() {
  if (showBittyWow || bittyBonusActive) return;

  showBittyWow = true;
  bittyWowTimer = BITTY_WOW_DURATION_MS;

  playBittyBonusSound();
}

function spawnBittyBonusCoins() {
  bittyBonusCoins.length = 0;

  const values = [250, 500, 1000, 2000];

  values.forEach(value => {
    let c, r;
    do {
      c = Math.floor(Math.random() * COLS);
      r = Math.floor(Math.random() * ROWS);
    } while (isWall(c, r));

    const pos = tileCenter(c, r);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 0.3;

    bittyBonusCoins.push({
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      value,
      alive: true
    });
  });

  bittyBonusActive = true;
  bittyBonusTimer = BITTY_BONUS_DURATION_MS;
}

// ---------------------------------------------------------------------------
// BITTY BONUS UPDATE
// ---------------------------------------------------------------------------

function updateBittyBonus(deltaMs) {
  // WOW timer
  if (showBittyWow) {
    bittyWowTimer -= deltaMs;
    if (bittyWowTimer <= 0) {
      showBittyWow = false;
      spawnBittyBonusCoins();
    }
  }

  if (!bittyBonusActive) return;

  bittyBonusTimer -= deltaMs;
  if (bittyBonusTimer <= 0) {
    resetBittyBonus();
    return;
  }

  const factor = deltaMs / (1000 / 60);

  // Move coins
  for (const coin of bittyBonusCoins) {
    if (!coin.alive) continue;

    coin.x += coin.vx * factor;
    coin.y += coin.vy * factor;

    const m = TILE_SIZE * 0.5;

    if (coin.x < m || coin.x > GAME_WIDTH - m) coin.vx *= -1;
    if (coin.y < m || coin.y > GAME_HEIGHT - m) coin.vy *= -1;

    coin.vx += (Math.random() - 0.5) * 0.01;
    coin.vy += (Math.random() - 0.5) * 0.01;
  }

  // Collision Pacman + coin
  for (const coin of bittyBonusCoins) {
    if (!coin.alive) continue;

    const dist = Math.hypot(player.x - coin.x, player.y - coin.y);
    if (dist < TILE_SIZE * 0.6) {
      coin.alive = false;

      score += coin.value;

Sure! Here's **DEEL 1 opnieuw, compleet én netjes afgesloten**, zodat je hem **zonder fouten kunt plakken** in je game.js.  
Dit deel gaat **tot en met updateBittyBonus()**, precies zoals afgesproken.

---

# ⭐ **DEEL 1 / 3 — GECORRIGEERDE game.js (van begin t/m updateBittyBonus)**

👉 **Plak dit als begin van jouw game.js.**  
👉 Deel 2 en 3 komen direct nadat jij bevestigt dat Deel 1 goed ontvangen is.

---

```js
// Bitty Pacman – dot-baan uit MAZE, alles weer geschaald met pathScale
// ---------------------------------------------------------------------------
// CANVASSEN
// ---------------------------------------------------------------------------

const mazeCanvas = document.getElementById("mazeCanvas");
const mazeCtx = mazeCanvas.getContext("2d");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- SPEED CONFIG ---
const TILE_SIZE = 32;

const SPEED_CONFIG = {
  playerSpeed: 2.8,
  ghostSpeed: 2.8 * 0.90,
  ghostTunnelSpeed: 2.8 * 0.45,
  ghostFrightSpeed: 2.8 * 0.60,
};

// --- GHOST MODES ---
const GHOST_MODE_SCATTER = 0;
const GHOST_MODE_CHASE = 1;
const GHOST_MODE_FRIGHTENED = 2;
const GHOST_MODE_EATEN = 3;
const GHOST_MODE_IN_PEN = 4;
const GHOST_MODE_LEAVING = 5;

const GHOST_MODE_SEQUENCE = [
  { mode: GHOST_MODE_SCATTER, durationMs: 2000 },
  { mode: GHOST_MODE_CHASE, durationMs: 35000 },
  { mode: GHOST_MODE_SCATTER, durationMs: 2000 },
  { mode: GHOST_MODE_CHASE, durationMs: Infinity },
];

let globalGhostMode = GHOST_MODE_SCATTER;
let ghostModeIndex = 0;
let ghostModeElapsedTime = 0;

// DOT GROOTTES
const DOT_RADIUS = 3;
const POWER_RADIUS = 7;

let powerDotPhase = 0;
const POWER_DOT_BLINK_SPEED = 0.12;

// Clyde-afstand
const CLYDE_SCATTER_DISTANCE_TILES = 4;
const CLYDE_SCATTER_DISTANCE2 = CLYDE_SCATTER_DISTANCE_TILES ** 2;

// FRIGHTENED VARIABELEN
let frightTimer = 0;
let frightFlash = false;
let ghostEatChain = 0;
let frightActivationCount = 0;

const FRIGHT_DURATION_MS = 12000;
const FRIGHT_FLASH_MS = 5000;

// ---------------------------------------------------------------------------
// BITTY BONUS (WOW + Coins)
// ---------------------------------------------------------------------------

let bittyBonusActive = false;
let bittyBonusTimer = 0;

let showBittyWow = false;
let bittyWowTimer = 0;

const BITTY_WOW_DURATION_MS = 1500;
const BITTY_BONUS_DURATION_MS = 20000;

const bittyBonusCoins = [];

// ---------------------------------------------------------------------------
// MAZE
// ---------------------------------------------------------------------------

const MAZE = [
  "#O........................O#",
  "#.####.##.#####.#####.####.#",
  "#.####.##.#####.#####.####.#",
  "#.####.##..###...###..####.#",
  "#.####.##..###...###...###.#",
  "#.####.##..###...###...###.#",
  "#..........................#",
  "#..........................#",
  "######.####.####.####.######",
  "######.####.####.####.######",
  "######.##.........O##.######",
  "######.##.####X###.##.######",
  "######.##.####X###.##.######",
  "..........##GGGG##..........",
  "######.##.########.##.######",
  "######.##.########.##.######",
  "######.##O.........##.######",
  "######.##.########.##.######",
  "######.##.########.##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#...##................##...#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#O...........P............O#",
];

const ROWS = MAZE.length;
const COLS = MAZE[0].length;

// Portal
const PORTAL_ROW = 13;
const PORTAL_LEFT_COL = 0;
const PORTAL_RIGHT_COL = COLS - 1;

const GAME_WIDTH = COLS * TILE_SIZE;
const GAME_HEIGHT = ROWS * TILE_SIZE;

mazeCanvas.width = GAME_WIDTH;
mazeCanvas.height = GAME_HEIGHT;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// ---------------------------------------------------------------------------
// SPRITES & SOUNDS
// ---------------------------------------------------------------------------

const playerImg = new Image();
playerImg.src = "pacman_sheet_32x32_4x3.png";
let playerLoaded = false;
playerImg.onload = () => (playerLoaded = true);

// BITTY COIN image
const bittyCoinImg = new Image();
bittyCoinImg.src = "bittybonus.png";
let bittyCoinLoaded = false;
bittyCoinImg.onload = () => (bittyCoinLoaded = true);

// Sounds
const bittyBonusSound = new Audio("bittybonussound.mp3");
bittyBonusSound.volume = 0.8;

const bittyCoinSound = new Audio("coinsoundbitty.mp3");
bittyCoinSound.volume = 0.8;

function playBittyBonusSound() {
  bittyBonusSound.currentTime = 0;
  bittyBonusSound.play().catch(() => {});
}

function playBittyCoinSound() {
  const s = bittyCoinSound.cloneNode();
  s.volume = bittyCoinSound.volume;
  s.play().catch(() => {});
}

const ghostEatSound = new Audio("ghosteat.mp3");
ghostEatSound.volume = 0.7;

const readySound = new Audio("getready.mp3");
readySound.volume = 0.8;

// ---------------------------------------------------------------------------
// START POSITIES
// ---------------------------------------------------------------------------

function findPositions() {
  let pac = null;
  let ghostStarts = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === "P") pac = { c, r };
      if (MAZE[r][c] === "G") ghostStarts.push({ c, r });
    }
  }

  let avgC = Math.round(ghostStarts.reduce((s, g) => s + g.c, 0) / ghostStarts.length);
  let avgR = Math.round(ghostStarts.reduce((s, g) => s + g.r, 0) / ghostStarts.length);

  return { pac, ghostPen: { c: avgC, r: avgR }, ghostStarts };
}

const { pac, ghostPen, ghostStarts } = findPositions();

// ---------------------------------------------------------------------------
// BITTY BONUS HELPERS
// ---------------------------------------------------------------------------

function resetBittyBonus() {
  bittyBonusActive = false;
  bittyBonusTimer = 0;
  showBittyWow = false;
  bittyWowTimer = 0;
  bittyBonusCoins.length = 0;
}

function startBittyBonus() {
  if (showBittyWow || bittyBonusActive) return;
  showBittyWow = true;
  bittyWowTimer = BITTY_WOW_DURATION_MS;
  playBittyBonusSound();
}

function spawnBittyBonusCoins() {
  bittyBonusCoins.length = 0;

  const values = [250, 500, 1000, 2000];

  for (const value of values) {
    let c, r;
    do {
      c = Math.floor(Math.random() * COLS);
      r = Math.floor(Math.random() * ROWS);
    } while (isWall(c, r));

    const pos = tileCenter(c, r);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 0.3;

    bittyBonusCoins.push({
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      value,
      alive: true
    });
  }

  bittyBonusActive = true;
  bittyBonusTimer = BITTY_BONUS_DURATION_MS;
}

// ---------------------------------------------------------------------------
// BITTY BONUS UPDATE
// ---------------------------------------------------------------------------

function updateBittyBonus(deltaMs) {
  // WOW fase
  if (showBittyWow) {
    bittyWowTimer -= deltaMs;
    if (bittyWowTimer <= 0) {
      showBittyWow = false;
      spawnBittyBonusCoins();
    }
  }

  if (!bittyBonusActive) return;

  bittyBonusTimer -= deltaMs;
  if (bittyBonusTimer <= 0) {
    resetBittyBonus();
    return;
  }

  const factor = deltaMs / (1000 / 60);

  // Beweging coins
  for (const coin of bittyBonusCoins) {
    if (!coin.alive) continue;

    coin.x += coin.vx * factor;
    coin.y += coin.vy * factor;

    const margin = TILE_SIZE * 0.5;

    if (coin.x < margin || coin.x > GAME_WIDTH - margin) coin.vx *= -1;
    if (coin.y < margin || coin.y > GAME_HEIGHT - margin) coin.vy *= -1;

    coin.vx += (Math.random() - 0.5) * 0.01;
    coin.vy += (Math.random() - 0.5) * 0.01;
  }

  // Collision Pacman + coin
  for (const coin of bittyBonusCoins) {
    if (!coin.alive) continue;

    const dist = Math.hypot(player.x - coin.x, player.y - coin.y);
    if (dist < TILE_SIZE * 0.6) {
      coin.alive = false;

      score += coin.value;
      scoreEl.textContent = score;

      playBittyCoinSound();
      spawnFloatingScore(coin.x, coin.y - TILE_SIZE * 0.4, coin.value);
    }
  }

  // alle coins gepakt?
  if (!bittyBonusCoins.some(c => c.alive)) {
    resetBittyBonus();
  }
}

// ---------------------------------------------------------------------------
// BITTY OVERLAY CONFIG (paneel rechts)
// ---------------------------------------------------------------------------

let bittyVisible = true;
let bittyPosX = 820;
let bittyPosY = 100;
let bittyScale = 0.9;

function updateBittyPanel() {
  const panel = document.getElementById("bittyPanel");
  if (!panel) return;

  panel.style.display = bittyVisible ? "block" : "none";
  panel.style.transform =
    `translate(${bittyPosX}px, ${bittyPosY}px) scale(${bittyScale})`;
}

// ---------------------------------------------------------------------------
// MAZE HELPERS
// ---------------------------------------------------------------------------

let currentMaze = MAZE.slice(); // kopie voor dots / powerdots
let allPowerDotsUsed = false;

function getTile(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return "#";
  return currentMaze[r][c];
}

function setTile(c, r, ch) {
  const row = currentMaze[r].split("");
  row[c] = ch;
  currentMaze[r] = row.join("");
}

// Alleen "." "O" "P" "G" "X" zijn pad
function isWall(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
  const t = MAZE[r][c];
  return !(t === "." || t === "O" || t === "P" || t === "G" || t === "X");
}

function tileCenter(c, r) {
  return {
    x: (c + 0.5) * TILE_SIZE,
    y: (r + 0.5) * TILE_SIZE
  };
}

// ---------------------------------------------------------------------------
// SCHALING / OFFSETS
// ---------------------------------------------------------------------------

let mazeScale = 0.90;
let mazeOffsetX = 0;
let mazeOffsetY = 0;

let pathScaleX = 0.72;
let pathScaleY = 0.75;

let pathOffsetX = 75;
let pathOffsetY = 55;

// ---------------------------------------------------------------------------
// PACMAN SPRITESHEET INFO
// ---------------------------------------------------------------------------

const PACMAN_FRAME_COLS = 3;
const PACMAN_FRAME_ROWS = 4;
const PACMAN_SRC_WIDTH = 32;
const PACMAN_SRC_HEIGHT = 32;

const PACMAN_DIRECTION_ROW = {
  right: 0,
  left: 1,
  up: 2,
  down: 3,
};

// ---------------------------------------------------------------------------
// DOT SOUND
// ---------------------------------------------------------------------------

const eatSound = new Audio("pacmaneatingdots.mp3");
eatSound.loop = false;
eatSound.volume = 0.35;

function playDotSound() {
  try {
    const s = eatSound.cloneNode();
    s.volume = eatSound.volume;
    s.play().catch(() => {});
  } catch (e) {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// SCORE / STATE
// ---------------------------------------------------------------------------

const SCORE_DOT = 10;
const SCORE_POWER = 50;

let score = 0;
let lives = 3;
let gameRunning = true;
let gameOver = false;
let frame = 0;
let gameTime = 0;

let pacmanScale = 1.6;
let ghostScale = 2.0;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const messageEl = document.getElementById("message");
const messageTextEl = document.getElementById("messageText");

// ELECTRICITY OVERLAY
let electricPhase = 0;
const E_START_X_BASE = 450;
const E_END_X_BASE = 520;
const E_Y_BASE = 360;

let ELECTRIC_OFFSET_X = -82;
let ELECTRIC_OFFSET_Y = -24;

// ---------------------------------------------------------------------------
// EXTRA SOUNDS (eyes, fire, sirenes, superfast)
// ---------------------------------------------------------------------------

const sirenSound = new Audio("sirenesound.mp3");
sirenSound.loop = true;
sirenSound.volume = 0.6;

const sirenSpeed2Sound = new Audio("sirenespeed2.mp3");
sirenSpeed2Sound.loop = true;
sirenSpeed2Sound.volume = 0.6;

const superFastSirenSound = new Audio("superfastsirine.mp3");
superFastSirenSound.loop = true;
superFastSirenSound.volume = 0.75;

const eyesSound = new Audio("eyessound.mp3");
eyesSound.loop = true;
eyesSound.volume = 0.6;

const ghostFireSound = new Audio("ghotsfiremode.mp3");
ghostFireSound.loop = true;
ghostFireSound.volume = 0.6;

let sirenPlaying = false;
let sirenSpeed2Playing = false;
let superFastSirenPlaying = false;
let eyesSoundPlaying = false;
let ghostFireSoundPlaying = false;

let roundStarted = false;
let introActive = false;
let showReadyText = false;

// ---------------------------------------------------------------------------
// GELUID HELPERS
// ---------------------------------------------------------------------------

function playGhostEatSound() {
  try {
    const s = ghostEatSound.cloneNode();
    s.volume = ghostEatSound.volume;
    s.play().catch(() => {});
  } catch (e) {}
}

function updateFrightSound() {
  const anyFright = ghosts.some(g => g.mode === GHOST_MODE_FRIGHTENED);
  if (anyFright) {
    if (!ghostFireSoundPlaying) {
      ghostFireSoundPlaying = true;
      ghostFireSound.currentTime = 0;
      ghostFireSound.play().catch(() => {});
    }
  } else {
    if (ghostFireSoundPlaying) {
      ghostFireSoundPlaying = false;
      ghostFireSound.pause();
      ghostFireSound.currentTime = 0;
    }
  }
}

function updateEyesSound() {
  const anyEaten = ghosts.some(g => g.mode === GHOST_MODE_EATEN);
  if (anyEaten) {
    if (!eyesSoundPlaying) {
      eyesSoundPlaying = true;
      eyesSound.currentTime = 0;
      eyesSound.play().catch(() => {});
    }
  } else {
    if (eyesSoundPlaying) {
      eyesSoundPlaying = false;
      eyesSound.pause();
      eyesSound.currentTime = 0;
    }
  }
}

// Sirene helpers
function startSiren() {
  if (sirenPlaying) return;
  sirenPlaying = true;
  sirenSound.currentTime = 0;
  sirenSound.play().catch(() => {});
}

function stopSiren() {
  if (!sirenPlaying) return;
  sirenPlaying = false;
  sirenSound.pause();
  sirenSound.currentTime = 0;
}

function startSirenSpeed2() {
  if (sirenSpeed2Playing) return;
  sirenSpeed2Playing = true;
  sirenSpeed2Sound.currentTime = 0;
  sirenSpeed2Sound.play().catch(() => {});
}

function stopSirenSpeed2() {
  if (!sirenSpeed2Playing) return;
  sirenSpeed2Playing = false;
  sirenSpeed2Sound.pause();
  sirenSpeed2Sound.currentTime = 0;
}

function startSuperFastSiren() {
  if (superFastSirenPlaying) return;
  superFastSirenPlaying = true;
  superFastSirenSound.currentTime = 0;
  superFastSirenSound.play().catch(() => {});
}

function stopSuperFastSiren() {
  if (!superFastSirenPlaying) return;
  superFastSirenPlaying = false;
  superFastSirenSound.pause();
  superFastSirenSound.currentTime = 0;
}

function stopAllSirens() {
  stopSiren();
  stopSirenSpeed2();
  stopSuperFastSiren();
}

function updateSirenSound() {
  const anyFright = ghosts.some(g => g.mode === GHOST_MODE_FRIGHTENED);

  if (!gameRunning || introActive || gameOver || !roundStarted) {
    stopAllSirens();
    return;
  }

  if (anyFright) {
    stopAllSirens();
    return;
  }

  if (allPowerDotsUsed) {
    stopSiren();
    stopSirenSpeed2();
    if (!superFastSirenPlaying) startSuperFastSiren();
    return;
  }

  if (frightActivationCount >= 3) {
    stopSiren();
    stopSuperFastSiren();
    if (!sirenSpeed2Playing) startSirenSpeed2();
    return;
  }

  stopSirenSpeed2();
  stopSuperFastSiren();
  if (!sirenPlaying) startSiren();
}

// ---------------------------------------------------------------------------
// INTRO / READY
// ---------------------------------------------------------------------------

function startIntro() {
  introActive = true;
  showReadyText = true;
  gameRunning = false;
  roundStarted = false;

  if (eyesSoundPlaying) {
    eyesSoundPlaying = false;
    eyesSound.pause();
    eyesSound.currentTime = 0;
  }
  if (ghostFireSoundPlaying) {
    ghostFireSoundPlaying = false;
    ghostFireSound.pause();
    ghostFireSound.currentTime = 0;
  }

  stopAllSirens();

  readySound.currentTime = 0;
  readySound.play().catch(() => {});
}

readySound.addEventListener("ended", () => {
  introActive = false;
  showReadyText = false;
  gameRunning = true;
  // sirene pas starten zodra Pacman gaat bewegen (roundStarted in updatePlayer)
});

// ---------------------------------------------------------------------------
// ENTITIES
// ---------------------------------------------------------------------------

const player = {
  x: tileCenter(pac.c, pac.r).x,
  y: tileCenter(pac.c, pac.r).y,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  speed: SPEED_CONFIG.playerSpeed,
  facingRow: PACMAN_DIRECTION_ROW.right,
  isMoving: false,
};

const ghosts = [
  {
    id: 1,
    x: tileCenter(ghostStarts[0].c, ghostStarts[0].r).x,
    y: tileCenter(ghostStarts[0].c, ghostStarts[0].r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 0,
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 26, r: 1 },
    targetTile: { c: pac.c, r: pac.r },
  },
  {
    id: 2,
    x: tileCenter(ghostStarts[1].c, ghostStarts[1].r).x,
    y: tileCenter(ghostStarts[1].c, ghostStarts[1].r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 3000,
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 1, r: 1 },
    targetTile: { c: pac.c, r: pac.r },
  },
  {
    id: 3,
    x: tileCenter(ghostStarts[2].c, ghostStarts[2].r).x,
    y: tileCenter(ghostStarts[2].c, ghostStarts[2].r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 6000,
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 26, r: 27 },
    targetTile: { c: pac.c, r: pac.r },
  },
  {
    id: 4,
    x: tileCenter(ghostStarts[3].c, ghostStarts[3].r).x,
    y: tileCenter(ghostStarts[3].c, ghostStarts[3].r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 9000,
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 1, r: 27 },
    targetTile: { c: pac.c, r: pac.r },
  },
];

// ---------------------------------------------------------------------------
// ZWEVENDE SCORES
// ---------------------------------------------------------------------------

const floatingScores = [];

function spawnFloatingScore(x, y, value) {
  floatingScores.push({
    x,
    y,
    value,
    life: 1000,
  });
}

function updateFloatingScores(deltaMs) {
  for (let i = floatingScores.length - 1; i >= 0; i--) {
    const fs = floatingScores[i];
    fs.life -= deltaMs;
    fs.y -= 0.03 * deltaMs;

    if (fs.life <= 0) {
      floatingScores.splice(i, 1);
    }
  }
}

function drawFloatingScores() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  floatingScores.forEach(fs => {
    const alpha = Math.max(0, fs.life / 1000);
    ctx.globalAlpha = alpha;

    ctx.font = "bold 32px 'Courier New', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;

    const text = fs.value.toString();
    ctx.strokeText(text, fs.x, fs.y);
    ctx.fillText(text, fs.x, fs.y);
  });

  ctx.restore();
}

// ---------------------------------------------------------------------------
// BACKGROUND
// ---------------------------------------------------------------------------

const levelImage = new Image();
levelImage.src = "bitty_pacman.png";
let levelReady = false;
levelImage.onload = () => (levelReady = true);

function drawMazeBackground() {
  mazeCtx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
  if (!levelReady) return;

  mazeCtx.save();
  mazeCtx.translate(mazeOffsetX, mazeOffsetY);
  mazeCtx.scale(mazeScale, mazeScale);
  mazeCtx.drawImage(levelImage, 0, 0, mazeCanvas.width, mazeCanvas.height);
  mazeCtx.restore();
}

// ---------------------------------------------------------------------------
// DOTS
// ---------------------------------------------------------------------------

function drawDots() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = getTile(c, r);
      if (t !== "." && t !== "O") continue;

      const x = c * TILE_SIZE + TILE_SIZE / 2;
      const y = r * TILE_SIZE + TILE_SIZE / 2;

      if (t === ".") {
        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      } else if (t === "O") {
        const pulse = 0.9 + 0.2 * ((Math.sin(powerDotPhase * 2) + 1) / 2);
        const rad = POWER_RADIUS * pulse;

        ctx.save();
        const alpha = 0.7 + 0.3 * ((Math.sin(powerDotPhase * 2) + 1) / 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// GHOST SPRITES + FIRE AURA
// ---------------------------------------------------------------------------

const ghostEyesImg = new Image();
ghostEyesImg.src = "eyes.png";
let ghostEyesLoaded = false;
ghostEyesImg.onload = () => (ghostEyesLoaded = true);

const ghost1Img = new Image();
ghost1Img.src = "bitty-ghost.png";
let ghost1Loaded = false;
ghost1Img.onload = () => (ghost1Loaded = true);

const ghost2Img = new Image();
ghost2Img.src = "Beefcake-bitkey (1).png";
let ghost2Loaded = false;
ghost2Img.onload = () => (ghost2Loaded = true);

const ghost3Img = new Image();
ghost3Img.src = "Orange-man.png";
let ghost3Loaded = false;
ghost3Img.onload = () => (ghost3Loaded = true);

const ghost4Img = new Image();
ghost4Img.src = "Beholder.png";
let ghost4Loaded = false;
ghost4Img.onload = () => (ghost4Loaded = true);

function drawFireAura(localCtx, intensity, radius) {
  localCtx.save();
  localCtx.globalCompositeOperation = "lighter";

  const layers = 2;
  const baseParticles = 14;

  for (let layer = 0; layer < layers; layer++) {
    const particles = baseParticles + layer * 6;
    for (let i = 0; i < particles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = radius * (0.7 + Math.random() * 0.4);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const size = radius * (0.15 + Math.random() * 0.15);

      const r = 255;
      const g = 80 + Math.floor(Math.random() * 120);
      const b = 0;
      const a = 0.08 * intensity;

      localCtx.fillStyle = `rgba(${r},${g},${b},${a})`;
      localCtx.beginPath();
      localCtx.arc(x, y, size, 0, Math.PI * 2);
      localCtx.fill();
    }
  }

  localCtx.restore();
}

function drawGhosts() {
  const size = TILE_SIZE * ghostScale;

  for (const g of ghosts) {
    ctx.save();
    ctx.translate(g.x, g.y);

    if (g.mode === GHOST_MODE_EATEN) {
      if (ghostEyesLoaded) {
        const eyesSize = size * 2;
        ctx.drawImage(
          ghostEyesImg,
          -eyesSize / 2,
          -eyesSize / 2,
          eyesSize,
          eyesSize
        );
      }
      ctx.restore();
      continue;
    }

    let img = ghost1Img;
    if (g.id === 2) img = ghost2Img;
    else if (g.id === 3) img = ghost3Img;
    else if (g.id === 4) img = ghost4Img;

    if (img && img.complete) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }

    if (g.mode === GHOST_MODE_FRIGHTENED) {
      const intensity = frightFlash ? (frame % 20 < 10 ? 0.4 : 1.0) : 1.0;
      drawFireAura(ctx, intensity, size * 0.6);
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// READY TEXT
// ---------------------------------------------------------------------------

function drawReadyText() {
  if (!showReadyText) return;

  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  ctx.fillStyle = "#ffff00";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 6;
  ctx.font = "bold 72px 'Courier New', monospace";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const readyOffsetX = 140;
  const centerX = (COLS * TILE_SIZE) / 2 + readyOffsetX;
  const centerY = player.y - TILE_SIZE * 1.5;

  ctx.strokeText("GET READY!", centerX, centerY);
  ctx.fillText("GET READY!", centerX, centerY);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// ELEKTRISCHE BALK
// ---------------------------------------------------------------------------

function drawElectricBarrierOverlay() {
  electricPhase += 0.3;

  const x1 = E_START_X_BASE + ELECTRIC_OFFSET_X;
  const x2 = E_END_X_BASE + ELECTRIC_OFFSET_X;
  const baseY = E_Y_BASE + ELECTRIC_OFFSET_Y;

  ctx.save();
  ctx.shadowColor = "rgba(0, 255, 255, 0.9)";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "rgba(0, 180, 255, 0.6)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x1, baseY);
  ctx.lineTo(x2, baseY);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(0, 255, 255, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, baseY);

  const step = 10;
  for (let x = x1; x <= x2; x += step) {
    const freq1 = 0.25;
    const freq2 = 0.18;
    const amp = 6;

    const noise =
      Math.sin((x + electricPhase * 40) * freq1) * amp +
      Math.sin((x * 1.3 + electricPhase * 55) * freq2) * (amp * 0.7);

    ctx.lineTo(x, baseY + noise);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(200, 255, 255, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, baseY);

  for (let x = x1; x <= x2; x += step) {
    const freq = 0.35;
    const amp = 3;
    const noise = Math.sin((x * 1.8 + electricPhase * 70) * freq) * amp;
    ctx.lineTo(x, baseY + noise);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// PLAYER DRAW
// ---------------------------------------------------------------------------

let mouthPhase = 0;
let mouthSpeed = 0;
let eatingTimer = 0;
const EATING_DURATION = 200;

function drawPlayer() {
  const size = TILE_SIZE * pacmanScale;
  const radius = size / 2;

  const moving = player.isMoving;

  if (moving || eatingTimer > 0) {
    mouthPhase += mouthSpeed;
  }

  const mouthOpen = (Math.sin(mouthPhase) + 1) / 2;

  if (player.dir.x > 0) player.facingRow = PACMAN_DIRECTION_ROW.right;
  else if (player.dir.x < 0) player.facingRow = PACMAN_DIRECTION_ROW.left;
  else if (player.dir.y < 0) player.facingRow = PACMAN_DIRECTION_ROW.up;
  else if (player.dir.y > 0) player.facingRow = PACMAN_DIRECTION_ROW.down;

  let frameCol = 0;
  if (mouthOpen > 0.66) frameCol = 2;
  else if (mouthOpen > 0.33) frameCol = 1;
  else frameCol = 0;

  ctx.save();
  ctx.translate(player.x, player.y);

  if (playerLoaded) {
    const sx = frameCol * PACMAN_SRC_WIDTH;
    const sy = player.facingRow * PACMAN_SRC_HEIGHT;

    ctx.drawImage(
      playerImg,
      sx,
      sy,
      PACMAN_SRC_WIDTH,
      PACMAN_SRC_HEIGHT,
      -size / 2,
      -size / 2,
      size,
      size
    );
  } else {
    const maxMouth = Math.PI / 3;
    const mouthAngle = maxMouth * mouthOpen;

    ctx.fillStyle = "#f4a428";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, -mouthAngle, mouthAngle);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// BITTY WOW + COINS DRAW
// ---------------------------------------------------------------------------

function drawBittyWow() {
  if (!showBittyWow) return;

  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  ctx.fillStyle = "#ffff00";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 6;
  ctx.font = "bold 80px 'Courier New', monospace";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const centerX = (COLS * TILE_SIZE) / 2;
  const centerY = (ROWS * TILE_SIZE) / 2;

  ctx.strokeText("WOW", centerX, centerY);
  ctx.fillText("WOW", centerX, centerY);

  ctx.restore();
}

function drawBittyBonusCoins() {
  if (!bittyBonusActive || !bittyCoinLoaded) return;

  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  const coinWidth = TILE_SIZE;
  const coinHeight = TILE_SIZE;

  for (const coin of bittyBonusCoins) {
    if (!coin.alive) continue;

    ctx.save();
    ctx.translate(coin.x, coin.y);

    ctx.drawImage(
      bittyCoinImg,
      -coinWidth / 2,
      -coinHeight / 2,
      coinWidth,
      coinHeight
    );

    ctx.restore();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// PORTAL
// ---------------------------------------------------------------------------

function applyPortal(ent) {
  const c = Math.round(ent.x / TILE_SIZE - 0.5);
  const r = Math.round(ent.y / TILE_SIZE - 0.5);

  if (r !== PORTAL_ROW) return;

  if (ent.dir.x > 0 && c === PORTAL_RIGHT_COL) {
    const target = tileCenter(PORTAL_LEFT_COL, PORTAL_ROW);
    ent.x = target.x;
    return;
  }

  if (ent.dir.x < 0 && c === PORTAL_LEFT_COL) {
    const target = tileCenter(PORTAL_RIGHT_COL, PORTAL_ROW);
    ent.x = target.x;
    return;
  }
}
// ---------------------------------------------------------------------------
// INPUT
// ---------------------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (gameOver) startNewGame();
    return;
  }

  let dx = 0, dy = 0;

  if (e.key === "ArrowUp") dy = -1;
  if (e.key === "ArrowDown") dy = 1;
  if (e.key === "ArrowLeft") dx = -1;
  if (e.key === "ArrowRight") dx = 1;

  player.nextDir = { x: dx, y: dy };
});

// ---------------------------------------------------------------------------
// MOVEMENT HELPERS
// ---------------------------------------------------------------------------

function canMove(ent, dir) {
  const nx = ent.x + dir.x * ent.speed;
  const ny = ent.y + dir.y * ent.speed;

  const c = Math.floor(nx / TILE_SIZE);
  const r = Math.floor(ny / TILE_SIZE);

  return !isWall(c, r);
}

function snapToCenter(ent) {
  const c = Math.round(ent.x / TILE_SIZE - 0.5);
  const r = Math.round(ent.y / TILE_SIZE - 0.5);
  const mid = tileCenter(c, r);

  if (ent.dir.x !== 0) ent.y = mid.y;
  if (ent.dir.y !== 0) ent.x = mid.x;
}

// Tile is een kruispunt/bocht waar je mag sturen
function isTurnTile(c, r) {
  const up    = !isWall(c, r - 1);
  const down  = !isWall(c, r + 1);
  const left  = !isWall(c - 1, r);
  const right = !isWall(c + 1, r);

  let exits = 0;
  if (up) exits++;
  if (down) exits++;
  if (left) exits++;
  if (right) exits++;

  const straight =
    (left && right && !up && !down) ||
    (up && down && !left && !right);

  return exits >= 2 && !straight;
}

// ---------------------------------------------------------------------------
// UPDATE PLAYER
// ---------------------------------------------------------------------------

function updatePlayer() {
  const prevX = player.x;
  const prevY = player.y;

  const c = Math.round(player.x / TILE_SIZE - 0.5);
  const r = Math.round(player.y / TILE_SIZE - 0.5);

  const mid = tileCenter(c, r);
  const dist = Math.hypot(player.x - mid.x, player.y - mid.y);
  const atCenter = dist < 6;

  const isStopped = (player.dir.x === 0 && player.dir.y === 0);
  const blocked = !isStopped && !canMove(player, player.dir);

  const wantsReverse =
    player.nextDir.x === -player.dir.x &&
    player.nextDir.y === -player.dir.y;

  if (blocked) {
    player.dir = { x: 0, y: 0 };
  }

  let mayChange = false;

  if (player.dir.x === 0 && player.dir.y === 0) {
    mayChange = true;
  } else if (atCenter) {
    if (wantsReverse || isTurnTile(c, r)) {
      mayChange = true;
    }
  }

  if (mayChange) {
    if (canMove(player, player.nextDir)) {
      player.dir = { ...player.nextDir };
    }
  }

  if (canMove(player, player.dir)) {
    player.x += player.dir.x * player.speed;
    player.y += player.dir.y * player.speed;
  }

  player.isMoving = (player.x !== prevX || player.y !== prevY);

  if (!roundStarted && player.isMoving && !introActive && !gameOver) {
    roundStarted = true;
  }

  snapToCenter(player);
  applyPortal(player);

  if (eatingTimer > 0) {
    eatingTimer -= 16.67;
    if (eatingTimer < 0) eatingTimer = 0;
  }

  const ch = getTile(c, r);

  // DOT / POWER DOT eten
  if (ch === "." || ch === "O") {
    setTile(c, r, " ");
    score += (ch === "O" ? SCORE_POWER : SCORE_DOT);
    scoreEl.textContent = score;

    playDotSound();
    eatingTimer = EATING_DURATION;

    if (ch === "O") {
      frightActivationCount++;
      frightTimer   = FRIGHT_DURATION_MS;
      frightFlash   = false;
      ghostEatChain = 0;

      ghosts.forEach((g) => {
        if (
          (g.mode === GHOST_MODE_SCATTER || g.mode === GHOST_MODE_CHASE) &&
          g.released &&
          g.hasExitedBox
        ) {
          g.mode  = GHOST_MODE_FRIGHTENED;
          g.speed = SPEED_CONFIG.ghostFrightSpeed;
          g.dir.x = -g.dir.x;
          g.dir.y = -g.dir.y;
        }
      });

      const anyPowerDotsLeft = currentMaze.some(row => row.includes("O"));
      if (!anyPowerDotsLeft) {
        allPowerDotsUsed = true;
      }
    }
  }

  if (eatingTimer > 0) {
    mouthSpeed = 0.30;
  } else {
    mouthSpeed = player.isMoving ? 0.08 : 0.0;
  }
}

// ---------------------------------------------------------------------------
// GHOST AI
// ---------------------------------------------------------------------------

function setGhostTarget(g) {
  const playerC = Math.round(player.x / TILE_SIZE - 0.5);
  const playerR = Math.round(player.y / TILE_SIZE - 0.5);
  const dir = player.dir;

  if (g.mode === GHOST_MODE_EATEN && ghostPen) {
    g.targetTile = { c: ghostPen.c, r: ghostPen.r };
    return;
  }

  if (
    g.mode === GHOST_MODE_FRIGHTENED ||
    g.mode === GHOST_MODE_IN_PEN ||
    g.mode === GHOST_MODE_LEAVING
  ) {
    g.targetTile = null;
    return;
  }

  if (g.mode === GHOST_MODE_SCATTER) {
    if (g.scatterTile) {
      g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
    } else {
      g.targetTile = { c: playerC, r: playerR };
    }
    return;
  }

  if (g.mode !== GHOST_MODE_CHASE) {
    g.targetTile = null;
    return;
  }

  // CHASE AI
  if (g.id === 1) {
    g.targetTile = { c: playerC, r: playerR };
    return;
  }

  if (g.id === 2) {
    let tx = playerC + 4 * dir.x;
    let ty = playerR + 4 * dir.y;
    if (dir.y === -1) tx -= 4;
    g.targetTile = { c: tx, r: ty };
    return;
  }

  if (g.id === 3) {
    const blinky = ghosts.find(gg => gg.id === 1) || g;

    const blC = Math.round(blinky.x / TILE_SIZE - 0.5);
    const blR = Math.round(blinky.y / TILE_SIZE - 0.5);

    let px2 = playerC + 2 * dir.x;
    let py2 = playerR + 2 * dir.y;
    if (dir.y === -1) px2 -= 2;

    const vx = px2 - blC;
    const vy = py2 - blR;

    const tx = blC + 2 * vx;
    const ty = blR + 2 * vy;

    g.targetTile = { c: tx, r: ty };
    return;
  }

  if (g.id === 4) {
    const gC = Math.round(g.x / TILE_SIZE - 0.5);
    const gR = Math.round(g.y / TILE_SIZE - 0.5);

    const dx = gC - playerC;
    const dy = gR - playerR;
    const dist2 = dx * dx + dy * dy;

    if (dist2 >= CLYDE_SCATTER_DISTANCE2) {
      g.targetTile = { c: playerC, r: playerR };
    } else if (g.scatterTile) {
      g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
    } else {
      g.targetTile = { c: playerC, r: playerR };
    }
    return;
  }

  g.targetTile = { c: playerC, r: playerR };
}

function updateOneGhost(g) {
  const c = Math.round(g.x / TILE_SIZE - 0.5);
  const r = Math.round(g.y / TILE_SIZE - 0.5);
  const mid = tileCenter(c, r);
  const dist = Math.hypot(g.x - mid.x, g.y - mid.y);

  setGhostTarget(g);

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  if (dist < 1) {
    const nonRev = dirs.filter(d => !(d.x === -g.dir.x && d.y === -g.dir.y));

    function canStep(d) {
      const nc = c + d.x;
      const nr = r + d.y;
      return !isWall(nc, nr);
    }

    let opts = nonRev.filter(canStep);
    if (opts.length === 0) opts = dirs.filter(canStep);

    if (opts.length > 0) {
      let chosen = null;

      if (g.mode === GHOST_MODE_FRIGHTENED || !g.targetTile) {
        chosen = opts[Math.floor(Math.random() * opts.length)];
      } else {
        const tx = g.targetTile.c;
        const ty = g.targetTile.r;
        let best = null;
        let bestDist2 = Infinity;

        for (const option of opts) {
          const nc2 = c + option.x;
          const nr2 = r + option.y;
          const dx = tx - nc2;
          const dy = ty - nr2;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDist2) {
            bestDist2 = d2;
            best = option;
          }
        }

        chosen = best || opts[0];
      }

      g.dir = chosen;
      g.x = mid.x;
      g.y = mid.y;
    }
  }

  const speed = g.speed;
  if (canMove(g, g.dir)) {
    g.x += g.dir.x * speed;
    g.y += g.dir.y * speed;
  }

  snapToCenter(g);
  applyPortal(g);

  // EATEN ghosts terug naar pen → resetten
  if (g.mode === GHOST_MODE_EATEN && ghostPen) {
    const center = tileCenter(ghostPen.c, ghostPen.r);
    const d = Math.hypot(g.x - center.x, g.y - center.y);
    if (d < TILE_SIZE) {
      g.x = center.x;
      g.y = center.y;
      g.mode = globalGhostMode;
      g.speed = SPEED_CONFIG.ghostSpeed;
      g.released = false;
      g.hasExitedBox = false;
      g.releaseTime = gameTime + 1000;
      g.targetTile = g.scatterTile ? { c: g.scatterTile.c, r: g.scatterTile.r } : null;
    }
  }

  // Heeft de ghost de box verlaten?
  if (ghostPen) {
    const penCenterRow = ghostPen.r;
    const rowNow = Math.round(g.y / TILE_SIZE - 0.5);
    if (!g.hasExitedBox && rowNow < penCenterRow - 1) {
      g.hasExitedBox = true;
    }
  }
}

function updateGhosts() {
  for (const g of ghosts) {
    if (!g.released) {
      if (gameTime >= g.releaseTime) {
        g.released = true;
      } else {
        continue;
      }
    }
    updateOneGhost(g);
  }
}

function updateGhostGlobalMode(deltaMs) {
  const seq = GHOST_MODE_SEQUENCE;
  const current = seq[ghostModeIndex];

  if (current.durationMs !== Infinity) {
    ghostModeElapsedTime += deltaMs;

    if (ghostModeElapsedTime >= current.durationMs) {
      const oldMode = current.mode;

      ghostModeIndex = Math.min(ghostModeIndex + 1, seq.length - 1);
      ghostModeElapsedTime = 0;

      const newMode = seq[ghostModeIndex].mode;
      globalGhostMode = newMode;

      if (
        (oldMode === GHOST_MODE_SCATTER && newMode === GHOST_MODE_CHASE) ||
        (oldMode === GHOST_MODE_CHASE && newMode === GHOST_MODE_SCATTER)
      ) {
        ghosts.forEach((g) => {
          if (
            g.mode === GHOST_MODE_SCATTER ||
            g.mode === GHOST_MODE_CHASE
          ) {
            g.dir.x = -g.dir.x;
            g.dir.y = -g.dir.y;
          }
        });
      }
    }
  }

  ghosts.forEach((g) => {
    if (g.mode === GHOST_MODE_SCATTER || g.mode === GHOST_MODE_CHASE) {
      g.mode = globalGhostMode;
    }
  });
}

// ---------------------------------------------------------------------------
// COLLISION
// ---------------------------------------------------------------------------

function checkCollision() {
  let playerDies = false;

  for (const g of ghosts) {
    if (!g.released) continue;

    const dist = Math.hypot(player.x - g.x, player.y - g.y);
    if (dist >= TILE_SIZE * 0.6) continue;

    if (g.mode === GHOST_MODE_FRIGHTENED) {
      ghostEatChain++;

      let ghostScore = 200;
      if (ghostEatChain === 2) ghostScore = 400;
      else if (ghostEatChain === 3) ghostScore = 800;
      else if (ghostEatChain >= 4) ghostScore = 1600;

      score += ghostScore;
      scoreEl.textContent = score;

      playGhostEatSound();
      spawnFloatingScore(g.x, g.y - TILE_SIZE * 0.6, ghostScore);

      g.mode = GHOST_MODE_EATEN;
      g.speed = SPEED_CONFIG.ghostSpeed * 2.5;
      if (ghostPen) {
        g.targetTile = { c: ghostPen.c, r: ghostPen.r };
      }

      // ⭐ BITTY BONUS: bij 4 ghosts in één vuurmode
      if (ghostEatChain === 4) {
        startBittyBonus();
      }

      continue;
    }

    if (g.mode === GHOST_MODE_SCATTER || g.mode === GHOST_MODE_CHASE) {
      playerDies = true;
      break;
    }
  }

  if (playerDies) {
    lives--;
    livesEl.textContent = lives;

    if (lives <= 0) {
      gameRunning = false;
      gameOver = true;
      messageTextEl.textContent = "Game Over";
      messageEl.classList.remove("hidden");
    } else {
      resetEntities();
    }
  }
}

// ---------------------------------------------------------------------------
// RESET ENTITIES (nieuw leven / nieuw level)
// ---------------------------------------------------------------------------

function resetEntities() {
  currentMaze = MAZE.slice();
  allPowerDotsUsed = false;

  resetBittyBonus();
  updateBittyPanel();

  player.x = tileCenter(pac.c, pac.r).x;
  player.y = tileCenter(pac.c, pac.r).y;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
  player.speed = SPEED_CONFIG.playerSpeed;
  player.isMoving = false;

  frightTimer = 0;
  frightFlash = false;
  ghostEatChain = 0;

  globalGhostMode = GHOST_MODE_SCATTER;
  ghostModeIndex = 0;
  ghostModeElapsedTime = 0;

  ghosts.forEach((g, index) => {
    const startTile = ghostStarts[index] || ghostPen;

    g.x = tileCenter(startTile.c, startTile.r).x;
    g.y = tileCenter(startTile.c, startTile.r).y;
    g.dir = { x: 0, y: -1 };
    g.released = false;
    g.hasExitedBox = false;
    g.speed = SPEED_CONFIG.ghostSpeed;
    g.mode = GHOST_MODE_SCATTER;

    if (g.id === 1) g.releaseTime = 0;
    if (g.id === 2) g.releaseTime = 3000;
    if (g.id === 3) g.releaseTime = 6000;
    if (g.id === 4) g.releaseTime = 9000;

    if (g.scatterTile) {
      g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
    } else {
      g.targetTile = null;
    }
  });

  gameTime = 0;
  roundStarted = false;

  eyesSoundPlaying = false;
  eyesSound.pause();
  eyesSound.currentTime = 0;

  ghostFireSoundPlaying = false;
  ghostFireSound.pause();
  ghostFireSound.currentTime = 0;

  frightActivationCount = 0;
  stopAllSirens();
}

// ---------------------------------------------------------------------------
// GAME LOOP + START NEW GAME
// ---------------------------------------------------------------------------

const FRAME_TIME = 1000 / 60;

function loop() {
  if (gameRunning) {
    gameTime += FRAME_TIME;

    powerDotPhase += POWER_DOT_BLINK_SPEED;

    // Fright timer
    if (frightTimer > 0) {
      frightTimer -= FRAME_TIME;

      if (frightTimer <= FRIGHT_FLASH_MS) {
        frightFlash = true;
      }
      if (frightTimer <= 0) {
        frightTimer = 0;
        frightFlash = false;

        ghosts.forEach((g) => {
          if (g.mode === GHOST_MODE_FRIGHTENED) {
            g.mode = globalGhostMode;
            g.speed = SPEED_CONFIG.ghostSpeed;
          }
        });
      }
    }

    updateGhostGlobalMode(FRAME_TIME);
    updatePlayer();
    updateGhosts();
    checkCollision();
    updateFloatingScores(FRAME_TIME);
    updateBittyBonus(FRAME_TIME);

    updateEyesSound();
    updateFrightSound();
    updateSirenSound();

    frame++;
  } else {
    if (eyesSoundPlaying) {
      eyesSoundPlaying = false;
      eyesSound.pause();
      eyesSound.currentTime = 0;
    }

    if (ghostFireSoundPlaying) {
      ghostFireSoundPlaying = false;
      ghostFireSound.pause();
      ghostFireSound.currentTime = 0;
    }

    stopAllSirens();
  }

  drawMazeBackground();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  drawDots();
  drawBittyBonusCoins();
  drawPlayer();
  drawGhosts();
  drawFloatingScores();

  if (typeof drawReadyText === "function") {
    drawReadyText();
  }

  ctx.restore();

  drawElectricBarrierOverlay();
  drawBittyWow();

  requestAnimationFrame(loop);
}

function startNewGame() {
  score = 0;
  lives = 3;
  scoreEl.textContent = score;
  livesEl.textContent = lives;

  roundStarted = false;
  gameOver = false;
  gameRunning = false;

  frightActivationCount = 0;
  stopAllSirens();

  resetEntities();
  resetBittyBonus();

  messageEl.classList.add("hidden");
  startIntro();
}

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------

resetEntities();
resetBittyBonus();
startIntro();
updateBittyPanel();
loop();



