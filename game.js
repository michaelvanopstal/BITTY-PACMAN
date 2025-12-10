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
  // Pacman – basis
  playerSpeed: 2.8,

  // Ghosts net iets langzamer dan Pacman (± 90%)
  ghostSpeed:       2.8 * 0.90,  // ≈ 2.52

  // In tunnels flink trager
  ghostTunnelSpeed: 2.8 * 0.45,  // ≈ 1.26

  // In frightened mode nog wat trager
  ghostFrightSpeed: 2.8 * 0.60,  // ≈ 1.68
};

// --- GHOST MODES & SCHEMA (Google-achtig) ---
const GHOST_MODE_SCATTER    = 0;
const GHOST_MODE_CHASE      = 1;
const GHOST_MODE_FRIGHTENED = 2;
const GHOST_MODE_EATEN      = 3;
const GHOST_MODE_IN_PEN     = 4;
const GHOST_MODE_LEAVING    = 5;

// Agressiever schema:
// 2s scatter, 35s chase, 2s scatter, dan eindeloos chase.
const GHOST_MODE_SEQUENCE = [
  { mode: GHOST_MODE_SCATTER, durationMs:  2 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs: 35 * 1000 },
  { mode: GHOST_MODE_SCATTER, durationMs:  2 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs:  Infinity },
];

// Globale mode-status
let globalGhostMode      = GHOST_MODE_SCATTER;
let ghostModeIndex       = 0;
let ghostModeElapsedTime = 0;
let wowBonusActive = false;
let wowBonusTimer = 0;


// DOT GROOTTES
const DOT_RADIUS   = 3;   // gewone dots
const POWER_RADIUS = 7;   // grotere power-dots (blijven vanuit dezelfde middenpositie)

// Animatie voor knipperende power-dots
let powerDotPhase = 0;
const POWER_DOT_BLINK_SPEED = 0.12; // hoe hoger, hoe sneller ze "pulseren"


// Clyde schakelt naar corner als hij binnen deze afstand is (in tiles)
// Lager = sneller jagen, minder snel wegrennen
const CLYDE_SCATTER_DISTANCE_TILES = 4;
const CLYDE_SCATTER_DISTANCE2 = CLYDE_SCATTER_DISTANCE_TILES * CLYDE_SCATTER_DISTANCE_TILES;

// --- FRIGHTENED MODE VARIABELEN ---
let frightTimer = 0;
let frightFlash = false;
let ghostEatChain = 0;
// Hoe vaak vuurmode is gestart in dit level (aantal power-dots gegeten)
let frightActivationCount = 0;

// Frightened langer + laatste 5 sec knipperen
const FRIGHT_DURATION_MS = 12000;   // vuur duurt 12 sec (pas aan naar smaak)
const FRIGHT_FLASH_MS    = 5000;    // in de laatste 5 sec gaat het knipperen

// ───────────────────────────────────────────────
// BITTY OVERLAY CONFIG
// ───────────────────────────────────────────────
let bittyVisible = true;    // zet op false als je 'm tijdelijk wilt verbergen
let bittyPosX    = 820;     // positie vanaf linkerkant van het scherm (px)
let bittyPosY    = 100;     // positie vanaf bovenkant van het scherm (px)
let bittyScale   = 0.9;     // 1.0 = origineel, 2.0 = 2x zo groot, etc.

// --- 4-GHOST BONUS + COIN BONUS ---
let fourGhostBonusTriggered = false;    // binnen huidige fire-mode al gegeven?
let coinBonusActive = false;           // loopt de 20s coin-fase?
let coinBonusTimer = 0;                // ms resterend voor coins
const COIN_BONUS_DURATION = 20000;     // 20 sec
let coinPickupIndex = 0;
const coinSequence = [250, 500, 1000, 2000];
let coinPulsePhase = 0;

const coins = [];                      // actieve coins in het speelveld
const COIN_RADIUS = TILE_SIZE * 0.8;
const bittyBonusSound = new Audio("bittybonussound.mp3");
bittyBonusSound.loop = false;
bittyBonusSound.volume = 0.8; // of naar smaak

const coinSound = new Audio("coinsoundbitty.mp3");
coinSound.loop = false;
coinSound.volume = 0.7;

// ---------------------------------------------------------------------------
// MAZE – 28 kolommen, 29 rijen. # = muur, . = dot, O = power-dot, P/G starts
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
  "######.##.####X###.##.######", // nieuwe rij 11 → 1 gaatje in het midden
  "######.##.####X###.##.######", // nieuwe rij 12 → zelfde gaatje
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

// PORTAL (horizontale poort op rij met "..........##GGG###..........")
const PORTAL_ROW       = 13;        // rij 14 menselijk → index 13
const PORTAL_LEFT_COL  = 0;         // eerste punt links in die rij
const PORTAL_RIGHT_COL = COLS - 1;  // laatste punt rechts (27 bij 28 kolommen)


// Deurpositie voor de elektrische balk
// Rij 12 (menselijk) = index 11 (0-based)
const DOOR_ROW       = 11;   // regel "######.##.####X###.##.######"
// Deur loopt ongeveer van stip 12 t/m 15
const DOOR_START_COL = 12;   // linker kant deur
const DOOR_END_COL   = 16;   // 16 is "na" stip 15 → mooi tot 15

const GAME_WIDTH = COLS * TILE_SIZE;
const GAME_HEIGHT = ROWS * TILE_SIZE;

mazeCanvas.width = GAME_WIDTH;
mazeCanvas.height = GAME_HEIGHT;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// PACMAN SPRITE SHEET
// pacmansheet.png = 3 kolommen × 4 rijen
// rij 0: rechts, rij 1: links, rij 2: omhoog, rij 3: omlaag
// kolom 0..2: mond-animatie (dicht → open)
const playerImg = new Image();
playerImg.src = "pacman_sheet_32x32_4x3.png";
let playerLoaded = false;
playerImg.onload = () => playerLoaded = true;

// Frame-gegevens
const PACMAN_FRAME_COLS = 3;  // dicht, half, open
const PACMAN_FRAME_ROWS = 4;  // rechts, links, omhoog, omlaag
const PACMAN_SRC_WIDTH  = 32;
const PACMAN_SRC_HEIGHT = 32;

const PACMAN_DIRECTION_ROW = {
  right: 0,
  left: 1,
  up: 2,
  down: 3,
};
// --- GHOST EAT SOUND (als spookje wordt opgegeten) ---
const ghostEatSound = new Audio("ghosteat.mp3"); // zorg dat dit bestand bestaat
ghostEatSound.loop = false;
ghostEatSound.volume = 0.7;

// --- READY / INTRO SOUND ---
const readySound = new Audio("getready.mp3");
readySound.loop = false;
readySound.volume = 0.8;

// --- SIRENE SOUND (loopt tijdens spel, behalve in vuur-mode) ---
const sirenSound = new Audio("sirenesound.mp3");
sirenSound.loop = true;
sirenSound.volume = 0.6;

// --- SIRENE SPEED 2 (snellere sirene na 3e vuurmode) ---
const sirenSpeed2Sound = new Audio("sirenespeed2.mp3");
sirenSpeed2Sound.loop = true;
sirenSpeed2Sound.volume = 0.6;

let sirenSpeed2Playing = false;

let sirenPlaying = false;
let roundStarted = false; // wordt true zodra Pacman voor het eerst beweegt

// FLAGS VOOR INTRO / READY-TEKST
let introActive   = false; // zolang true: geen beweging, alleen GET READY
let showReadyText = false;

// --- SUPERFAST SIRENE (na laatste knipper-dot + einde vuurmode) ---
const superFastSirenSound = new Audio("superfastsirine.mp3");
superFastSirenSound.loop = true;
superFastSirenSound.volume = 0.75;

let superFastSirenPlaying = false;
let allPowerDotsUsed = false;  // wordt true na de allerlaatste 'O'


function playGhostEatSound() {
  try {
    const s = ghostEatSound.cloneNode();  // kopie zodat ze kunnen overlappen
    s.volume = ghostEatSound.volume;
    s.play().catch(() => {});
  } catch (e) {
    // negeren
  }
}

// --- EYES SOUND (als spook-ogen teruglopen) ---
const eyesSound = new Audio("eyessound.mp3");
eyesSound.loop = true;
eyesSound.volume = 0.6; // pas aan naar smaak

let eyesSoundPlaying = false;

// --- GHOST FIRE (FRIGHTENED) SOUND ---
const ghostFireSound = new Audio("ghotsfiremode.mp3");
ghostFireSound.loop = true;
ghostFireSound.volume = 0.6; // pas aan naar smaak

let ghostFireSoundPlaying = false;

function updateFrightSound() {
  // Is er minstens één ghost in FRIGHTENED-modus?
  const anyFright = ghosts.some(g => g.mode === GHOST_MODE_FRIGHTENED);

  if (anyFright) {
    if (!ghostFireSoundPlaying) {
      ghostFireSoundPlaying = true;
      ghostFireSound.currentTime = 0;
      ghostFireSound.play().catch(() => {
        // browser kan audio blokkeren zonder user interactie
      });
    }
  } else {
    if (ghostFireSoundPlaying) {
      ghostFireSoundPlaying = false;
      ghostFireSound.pause();
      ghostFireSound.currentTime = 0; // terug naar begin
    }
  }
}


function updateEyesSound() {
  // Is er minstens één ghost in EATEN-modus?
  const anyEaten = ghosts.some(g => g.mode === GHOST_MODE_EATEN);

  if (anyEaten) {
    if (!eyesSoundPlaying) {
      eyesSoundPlaying = true;
      eyesSound.currentTime = 0;
      eyesSound.play().catch(() => {
        // browser kan audio blokkeren zonder user interactie
      });
    }
  } else {
    if (eyesSoundPlaying) {
      eyesSoundPlaying = false;
      eyesSound.pause();
      eyesSound.currentTime = 0; // terug naar begin
    }
  }
}


// ---------------------------------------------------------------------------
// SCHALING (voor dots + speler + ghosts)
// ---------------------------------------------------------------------------

let mazeScale = 0.90;
let mazeOffsetX = 0;
let mazeOffsetY = 0;

// aparte schaal voor breedte (X) en hoogte (Y)
let pathScaleX  = 0.72;  // deze liet je dots al goed aansluiten in de BREEDTE
let pathScaleY  = 0.75;  // iets groter dan X → rekt dots in de HOOGTE

let pathOffsetX = 75;
let pathOffsetY = 55;

let mouthPhase   = 0;
let mouthSpeed   = 0;
let eatingTimer  = 0;
const EATING_DURATION = 200; // ms

const eatSound = new Audio("pacmaneatingdots.mp3");
// Niet loopen: één compleet deuntje per dot
eatSound.loop = false;
eatSound.volume = 0.35;

// Helper: speel altijd het hele deuntje af, zonder vorige af te kappen
function playDotSound() {
  try {
    const s = eatSound.cloneNode();  // kopie zodat vorige rustig kan uitspelen
    s.volume = eatSound.volume;
    s.play().catch(() => {
      // sommige browsers blokkeren audio zonder user interactie
    });
  } catch (e) {
    // veilig negeren
  }
}


// ---------------------------------------------------------------------------
// SCORE, STATE
// ---------------------------------------------------------------------------

const SCORE_DOT = 10;
const SCORE_POWER = 50;

let score = 0;
let lives = 3;
let gameRunning = true;
let gameOver = false;
let frame = 0;
// ───────────────────────────────────────────────
// VISUELE LIVES ALS PACMAN-ICOONTJES
// ───────────────────────────────────────────────
const lifeIconConfig = {
  enabled: true,        // zet op false als je ze tijdelijk uit wilt
  baseX: 70,            // begin X-positie van de eerste Pacman (px, canvas coördinaten)
  baseY: 300,            // Y-positie van alle Pacmans
  spacing: 40,          // afstand tussen icoontjes (horizontaal)
  scale: 0.7            // schaal t.o.v. normale Pacman (TILE_SIZE * pacmanScale)
};


let gameTime = 0; // ms sinds start / laatste reset

// SCALES
let pacmanScale = 1.6;   // standaard 1.4 → iets groter
let ghostScale  = 2.0;   // standaard 1.2 → iets groter

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const messageEl = document.getElementById("message");
const messageTextEl = document.getElementById("messageText");

// ELECTRICITY OVERLAY (px-coördinaten op gameCanvas)
let electricPhase = 0;

// basispositie van de balk
const E_START_X_BASE = 450;
const E_END_X_BASE   = 520;
const E_Y_BASE       = 360;

// 👉 alleen deze twee hoef je straks aan te passen
let ELECTRIC_OFFSET_X = -82;  // - is links, + is rechts
let ELECTRIC_OFFSET_Y = -24;  // - is omhoog, + is omlaag
// ───────────────────────────────────────────────
// PACMAN DEATH ANIMATIE
// ───────────────────────────────────────────────
let isDying = false;          // zijn we nu een death animatie aan het afspelen?
let deathAnimTime = 0;        // ms hoeveel tijd al in de animatie
let deathAnimDuration = 1400; // default duur (ms), wordt gesync'd met de sound

const pacmanDeathSound = new Audio("pacmandeadsound.mp3");
pacmanDeathSound.loop = false;
pacmanDeathSound.volume = 0.8;

// Zodra de metadata geladen is, kennen we de echte duur van het geluid
pacmanDeathSound.addEventListener("loadedmetadata", () => {
  if (!isNaN(pacmanDeathSound.duration) && pacmanDeathSound.duration > 0) {
    deathAnimDuration = pacmanDeathSound.duration * 1000; // sec → ms
  }
});


// ---------------------------------------------------------------------------
// MAZE helpers
// ---------------------------------------------------------------------------

let currentMaze = MAZE.slice(); // voor zichtbare dots

function updateBittyPanel() {
  const panel = document.getElementById("bittyPanel");
  if (!panel) return;

  // zichtbaar / onzichtbaar
  panel.style.display = bittyVisible ? "block" : "none";

  // positie + schaal
  panel.style.transform =
    `translate(${bittyPosX}px, ${bittyPosY}px) scale(${bittyScale})`;
}


function getTile(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return "#";
  return currentMaze[r][c];
}

function setTile(c, r, ch) {
  let row = currentMaze[r].split("");
  row[c] = ch;
  currentMaze[r] = row.join("");
}

// Alleen ".", "O", "P", "G" zijn pad – rest is muur
function isWall(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
  const t = MAZE[r][c];

  // X = onzichtbare dot/pad
  return !(t === "." || t === "O" || t === "P" || t === "G" || t === "X");
}

function tileCenter(c, r) {
  return { x: (c + 0.5) * TILE_SIZE, y: (r + 0.5) * TILE_SIZE };
}

function findPositions() {
  let pac = null;
  let ghostStarts = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === "P") pac = { c, r };
      if (MAZE[r][c] === "G") ghostStarts.push({ c, r });
    }
  }

  // midden van de 3 ghost tiles bepalen
  if (ghostStarts.length > 0) {
    const avgC = Math.round(ghostStarts.reduce((s,g)=>s+g.c,0) / ghostStarts.length);
    const avgR = Math.round(ghostStarts.reduce((s,g)=>s+g.r,0) / ghostStarts.length);
    return { pac, ghostPen: { c: avgC, r: avgR }, ghostStarts };
  }

  return { pac, ghostPen: null, ghostStarts: [] };
}

const { pac, ghostPen, ghostStarts } = findPositions();
const startGhostTile = ghostPen;

// kolombreedte van de pen bepalen (voor eventueel gebruik – maar nu niet nodig)
let penColMin = null;
let penColMax = null;
if (ghostStarts.length > 0) {
  penColMin = Math.min(...ghostStarts.map(g => g.c));
  penColMax = Math.max(...ghostStarts.map(g => g.c));
}

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

// SUPERFAST
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

  // Geen sirenes tijdens intro, game over of vóór eerste beweging
  if (!gameRunning || introActive || gameOver || !roundStarted) {
    stopAllSirens();
    return;
  }

  // 🔥 Tijdens vuurmode → GEEN sirenes
  if (anyFright) {
    stopAllSirens();
    return;
  }

  // 🟣 SUPERFAST SIRENE:
  // Alleen als ALLE knipper-dots (O) op zijn én vuurmode nu echt voorbij is
  if (allPowerDotsUsed) {
    stopSiren();
    stopSirenSpeed2();
    if (!superFastSirenPlaying) {
      startSuperFastSiren();
    }
    return;
  }

  // 🔵 Na de 3e vuurmode → snelle sirene
  if (typeof frightActivationCount !== "undefined" && frightActivationCount >= 3) {
    stopSiren();
    stopSuperFastSiren();
    if (!sirenSpeed2Playing) {
      startSirenSpeed2();
    }
    return;
  }

  // 🟡 Standaard sirene
  stopSirenSpeed2();
  stopSuperFastSiren();
  if (!sirenPlaying) {
    startSiren();
  }
}


// INTRO STARTEN
function startIntro() {
  introActive   = true;
  showReadyText = true;
  gameRunning   = false; // alles bevriezen

  roundStarted = false;
  
  // zeker weten dat alle sounds uit zijn
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

  if (typeof stopAllSirens === "function") {
    stopAllSirens();
  } else if (sirenPlaying) {
    stopSiren();
  }

  readySound.currentTime = 0;
  readySound.play().catch(() => {});
}

// als ready-deuntje klaar is → spel starten + sirene aan
readySound.addEventListener("ended", () => {
  introActive   = false;
  showReadyText = false;
  gameRunning   = true;

  // Sirene nog NIET starten hier.
  // We wachten tot Pacman echt gaat bewegen (roundStarted in updatePlayer).
});

function startCoinBonus() {
  // Als er nog geen coins klaarstaan, zet ze klaar
  if (coins.length === 0) {
    prepareCoinsForBonus();
  }

  coinBonusActive = true;
  coinBonusTimer = COIN_BONUS_DURATION;

  // volgorde van punten weer bij 0 beginnen
  coinPickupIndex = 0;
}


function endCoinBonus() {
  coinBonusActive = false;
  coinBonusTimer = 0;
  coins.length = 0; // verwijder alle coins uit het veld
}


// ---------------------------------------------------------------------------
// ENTITIES
// ---------------------------------------------------------------------------



// --- PACMAN ---
const player = {
  x: tileCenter(pac.c, pac.r).x,
  y: tileCenter(pac.c, pac.r).y,
  dir:     { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  speed: SPEED_CONFIG.playerSpeed,
  facingRow: PACMAN_DIRECTION_ROW.right, // laatste kijkrichting
  isMoving: false,                       // ← NIEUW
};
// --- GHOSTS ---
const ghosts = [
  {
    id: 1, // Blinky
    x: tileCenter(ghostStarts[0].c, ghostStarts[0].r).x,
    y: tileCenter(ghostStarts[0].c, ghostStarts[0].r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 0,          // komt direct als eerste naar buiten
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 26, r: 1 }, // top-right corner
    targetTile:  { c: pac.c, r: pac.r },
  },
  {
    id: 2, // Pinky
    x: tileCenter(ghostStarts[1].c, ghostStarts[1].r).x,
    y: tileCenter(ghostStarts[1].c, ghostStarts[1].r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 3000,       // 3s later
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 1, r: 1 }, // top-left corner
    targetTile:  { c: pac.c, r: pac.r },
  },
  {
    id: 3, // Inky
    x: tileCenter(ghostStarts[2].c, ghostStarts[2].r).x,
    y: tileCenter(ghostStarts[2].c, ghostStarts[2].r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 6000,       // 6s later
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 26, r: 27 }, // bottom-right
    targetTile:  { c: pac.c, r: pac.r },
  },
  {
    id: 4, // Clyde
    x: tileCenter(ghostStarts[3].c, ghostStarts[3].r).x,
    y: tileCenter(ghostStarts[3].c, ghostStarts[3].r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 9000,       // 9s later
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 1, r: 27 },  // bottom-left
    targetTile:  { c: pac.c, r: pac.r },
  },
];



// ---------------------------------------------------------------------------
// ZWEVENDE SCORES (200 / 400 / 800 / 1600 boven spookje)
// ---------------------------------------------------------------------------
const floatingScores = [];

function spawnFloatingScore(x, y, value) {
  floatingScores.push({
    x,
    y,
    value,
    life: 1000 // ms zichtbaar
  });
}

function updateFloatingScores(deltaMs) {
  for (let i = floatingScores.length - 1; i >= 0; i--) {
    const fs = floatingScores[i];
    fs.life -= deltaMs;
    fs.y -= 0.03 * deltaMs; // langzaam omhoog zweven

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

    // Pixel-achtige look + dubbel formaat
    ctx.font = "bold 32px 'Courier New', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;

    const text = fs.value.toString();

    // Zwarte rand (pixel/arcade vibe)
    ctx.strokeText(text, fs.x, fs.y);
    // Witte vulling
    ctx.fillText(text, fs.x, fs.y);
  });

  ctx.restore();
}

function resetEntities() {
  currentMaze = MAZE.slice();
  allPowerDotsUsed = false;   // 🔄 power-dot (knipper-dot) toestand resetten

  // Pacman terug naar start
  player.x = tileCenter(pac.c, pac.r).x;
  player.y = tileCenter(pac.c, pac.r).y;
  player.dir     = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
  player.speed   = SPEED_CONFIG.playerSpeed;

  // Frightened resetten
  frightTimer   = 0;
  frightFlash   = false;
  ghostEatChain = 0;

  // Globale ghost-modes resetten
  globalGhostMode      = GHOST_MODE_SCATTER;
  ghostModeIndex       = 0;
  ghostModeElapsedTime = 0;

  // Ghosts terug naar start
  ghosts.forEach((g, index) => {
    const startTile = ghostStarts[index] || ghostPen;

    g.x = tileCenter(startTile.c, startTile.r).x;
    g.y = tileCenter(startTile.c, startTile.r).y;
    g.dir = { x: 0, y: -1 };
    g.released = false;
    g.hasExitedBox = false;
    g.speed = SPEED_CONFIG.ghostSpeed;
    g.mode  = GHOST_MODE_SCATTER;

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

  // 4-ghost & coin-bonus resetten bij nieuw life/level
  if (typeof fourGhostBonusTriggered !== "undefined") {
    fourGhostBonusTriggered = false;
  }
  if (typeof wowBonusActive !== "undefined") {
    wowBonusActive = false;
    wowBonusTimer  = 0;
  }
  if (typeof endCoinBonus === "function") {
    endCoinBonus();
  } else {
    if (typeof coinBonusActive !== "undefined") coinBonusActive = false;
    if (typeof coinBonusTimer !== "undefined") coinBonusTimer = 0;
    if (typeof coins !== "undefined" && Array.isArray(coins)) {
      coins.length = 0;
    }
  }

  // 🔊 ogen-geluid altijd uit bij reset
  eyesSoundPlaying = false;
  eyesSound.pause();
  eyesSound.currentTime = 0;

  // 🔊 fire-mode geluid ook uit bij reset
  ghostFireSoundPlaying = false;
  ghostFireSound.pause();
  ghostFireSound.currentTime = 0;

  // 🔊 sirenes + vuurmode-teller resetten bij nieuw life/level
  frightActivationCount = 0;
  stopAllSirens();
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
// MOVEMENT
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

// ---------------------------------------------------------------------------
// UPDATE PLAYER
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// PLAYER INTERSECTION CHECK
// ---------------------------------------------------------------------------

// Een tile is een kruispunt als hij meer dan 2 open richtingen heeft
// Tile waar je mag sturen tijdens het rijden (bocht of kruising)
function isTurnTile(c, r) {
  const up    = !isWall(c,   r - 1);
  const down  = !isWall(c,   r + 1);
  const left  = !isWall(c-1, r);
  const right = !isWall(c+1, r);

  let exits = 0;
  if (up) exits++;
  if (down) exits++;
  if (left) exits++;
  if (right) exits++;

  // Rechte gang (links+rechts OF boven+onder) → GEEN stuurpunt
  const straight =
    (left && right && !up && !down) ||
    (up && down && !left && !right);

  // Bocht (L-vorm) of kruising (3 of 4 kanten open) → wel stuurpunt
  return exits >= 2 && !straight;
}





// UPDATE PLAYER (alleen sturen op kruispunten)
function updatePlayer() {
  const prevX = player.x;
  const prevY = player.y;

  // Huidige tile
  const c = Math.round(player.x / TILE_SIZE - 0.5);
  const r = Math.round(player.y / TILE_SIZE - 0.5);

  // Dicht bij het midden van de tile?
  const mid  = tileCenter(c, r);
  const dist = Math.hypot(player.x - mid.x, player.y - mid.y);
  const atCenter = dist < 6;   // iets ruime marge, voelt soepel

  const isStopped = (player.dir.x === 0 && player.dir.y === 0);
  const blocked   = !isStopped && !canMove(player, player.dir);

  const wantsReverse =
    player.nextDir.x === -player.dir.x &&
    player.nextDir.y === -player.dir.y;

  // ─────────────────────────────────────────────
  // RICHTING KIEZEN
  // ─────────────────────────────────────────────

  // 1) Als huidige richting geblokkeerd is → beschouw als stilstaand
  if (blocked) {
    player.dir = { x: 0, y: 0 };
  }

  // 2) Mag hij nu van richting veranderen?
  let mayChange = false;

  if (player.dir.x === 0 && player.dir.y === 0) {
    // stil of net tegen muur → ALTIJD mogen sturen als het pad vrij is
    mayChange = true;
  } else if (atCenter) {
    // onderweg: alleen sturen als:
    // - we willen reverse, of
    // - deze tile een bocht / kruising is
    if (wantsReverse || isTurnTile(c, r)) {
      mayChange = true;
    }
  }

  if (mayChange) {
    if (canMove(player, player.nextDir)) {
      player.dir = { ...player.nextDir };
    }
  }

  // ─────────────────────────────────────────────
  // BEWEGEN
  // ─────────────────────────────────────────────
  if (canMove(player, player.dir)) {
    player.x += player.dir.x * player.speed;
    player.y += player.dir.y * player.speed;
  }

  player.isMoving = (player.x !== prevX || player.y !== prevY);

  // Zodra Pacman voor het eerst beweegt in een life → ronde gestart
  if (!roundStarted && player.isMoving && !introActive && !gameOver) {
    roundStarted = true;
  }

  snapToCenter(player);
  applyPortal(player);

  // Eet-timer
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
      // 🔥 start nieuwe vuurmode
      frightActivationCount++;
      frightTimer   = FRIGHT_DURATION_MS;
      frightFlash   = false;
      ghostEatChain = 0;

      // 4-ghost bonus resetten voor deze nieuwe fire-mode
      fourGhostBonusTriggered = false;

      // Alle ghosts die in SCATTER/CHASE zijn en buiten de box → frightened maken
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
    }

    // 🔍 check: is dit de allerlaatste knipperende power-dot (O)?
    const anyPowerDotsLeft = currentMaze.some(row => row.includes("O"));
    if (!anyPowerDotsLeft) {
      allPowerDotsUsed = true;
      console.log("✅ Laatste knipperende power-dot gepakt");
    }
  }

  // Mond-snelheid
  if (eatingTimer > 0) {
    mouthSpeed = 0.30;
  } else {
    mouthSpeed = player.isMoving ? 0.08 : 0.0;
  }
}



function startFourGhostBonus(triggerX, triggerY) {
  // 1) WOW overlay activeren
  wowBonusActive = true;
  wowBonusTimer = 1500; // ms zichtbaar, bv. 1.5 sec

  // 2) Jingle afspelen
  try {
    bittyBonusSound.currentTime = 0;
    bittyBonusSound.play().catch(() => {});
  } catch (e) {}

  // 3) Coins voorbereiden (maar pas echt laten bewegen na WOW)
  prepareCoinsForBonus();
}



function setGhostTarget(g) {
  // Pacman-tile en richting
  const playerC = Math.round(player.x / TILE_SIZE - 0.5);
  const playerR = Math.round(player.y / TILE_SIZE - 0.5);
  const dir = player.dir;

  // 1) EATEN: ogen terug naar start-vak
  if (g.mode === GHOST_MODE_EATEN) {
    if (startGhostTile) {
      g.targetTile = { c: startGhostTile.c, r: startGhostTile.r };
    } else {
      g.targetTile = { c: playerC, r: playerR }; // fallback
    }
    return;
  }

  // 1b) Als ghost net is gereleased maar nog in de box zit → forceer naar uitgang
  if (
    g.released &&
    !g.hasExitedBox &&
    (g.mode === GHOST_MODE_SCATTER || g.mode === GHOST_MODE_CHASE)
  ) {
    if (startGhostTile) {
      // target net boven het midden van de pen (richting deur)
      g.targetTile = { c: startGhostTile.c, r: startGhostTile.r - 2 };
      return;
    }
  }

  // 2) FRIGHTENED / IN_PEN → geen gericht target, random gedrag
  if (
    g.mode === GHOST_MODE_FRIGHTENED ||
    g.mode === GHOST_MODE_IN_PEN ||
    g.mode === GHOST_MODE_LEAVING
  ) {
    g.targetTile = null;
    return;
  }

  // 3) Alleen SCATTER & CHASE krijgen echt een target
  if (g.mode !== GHOST_MODE_SCATTER && g.mode !== GHOST_MODE_CHASE) {
    g.targetTile = null;
    return;
  }

  // SCATTER: altijd naar eigen hoek
  if (g.mode === GHOST_MODE_SCATTER) {
    if (g.scatterTile) {
      g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
    } else {
      g.targetTile = { c: playerC, r: playerR }; // fallback
    }
    return;
  }

  // Vanaf hier: CHASE-mode
  // 1) Blinky – direct op Pacman
  if (g.id === 1) {
    g.targetTile = { c: playerC, r: playerR };
    return;
  }

  // 2) Pinky – 4 tiles voor Pacman, met klassieke "up bug"
  if (g.id === 2) {
    let tx = playerC + 4 * dir.x;
    let ty = playerR + 4 * dir.y;

    if (dir.y === -1) {
      tx -= 4;
    }

    g.targetTile = { c: tx, r: ty };
    return;
  }

  // 3) Inky – 2 tiles voor Pacman, dan vector vanaf Blinky verdubbelen
  if (g.id === 3) {
    const blinky = ghosts.find(gg => gg.id === 1) || g;

    const blC = Math.round(blinky.x / TILE_SIZE - 0.5);
    const blR = Math.round(blinky.y / TILE_SIZE - 0.5);

    let px2 = playerC + 2 * dir.x;
    let py2 = playerR + 2 * dir.y;

    if (dir.y === -1) {
      px2 -= 2;
    }

    const vx = px2 - blC;
    const vy = py2 - blR;

    const tx = blC + 2 * vx;
    const ty = blR + 2 * vy;

    g.targetTile = { c: tx, r: ty };
    return;
  }

  // 4) Clyde – ver weg: Pacman, dichtbij: eigen corner
  if (g.id === 4) {
    const gC = Math.round(g.x / TILE_SIZE - 0.5);
    const gR = Math.round(g.y / TILE_SIZE - 0.5);

    const dx = gC - playerC;
    const dy = gR - playerR;
    const dist2 = dx * dx + dy * dy;

    if (dist2 >= CLYDE_SCATTER_DISTANCE2) {
      g.targetTile = { c: playerC, r: playerR };
    } else {
      if (g.scatterTile) {
        g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
      } else {
        g.targetTile = { c: playerC, r: playerR };
      }
    }
    return;
  }

  // fallback: onbekende id → Pacman
  g.targetTile = { c: playerC, r: playerR };
}

function updateOneGhost(g) {
  // Huidige tile & tile-midden berekenen
  const c = Math.round(g.x / TILE_SIZE - 0.5);
  const r = Math.round(g.y / TILE_SIZE - 0.5);
  const mid = tileCenter(c, r);
  const dist = Math.hypot(g.x - mid.x, g.y - mid.y);

  // Pen-centrum (voorkeur ghostPen, anders startGhostTile)
  const penTile = (typeof ghostPen !== "undefined" && ghostPen)
    ? ghostPen
    : startGhostTile; // fallback

  // EATEN-timer + vooruitgang naar pen bijhouden (voor slimme safety reset)
  if (g.mode === GHOST_MODE_EATEN && penTile) {
    const tileDistNow =
      Math.abs(c - penTile.c) + Math.abs(r - penTile.r); // Manhattan afstand

    if (g.eatenStartTime == null) {
      // Eerste frame dat hij ogen is
      g.eatenStartTime = gameTime;
      g.lastDistToPen = tileDistNow;
      g.lastDistImprovementTime = gameTime;
    } else {
      // Kijkt of hij dichterbij is gekomen
      if (tileDistNow < g.lastDistToPen) {
        g.lastDistToPen = tileDistNow;
        g.lastDistImprovementTime = gameTime;
      }
    }
  } else {
    // Zodra hij geen ogen meer is → reset alle EATEN-tracking
    g.eatenStartTime = null;
    g.lastDistToPen = null;
    g.lastDistImprovementTime = null;
  }

  // Target berekenen obv mode + ghost-type
  setGhostTarget(g);

  // Alle mogelijke richtingen
  const dirs = [
    { x:  1, y:  0 },  // rechts
    { x: -1, y:  0 },  // links
    { x:  0, y:  1 },  // omlaag
    { x:  0, y: -1 }   // omhoog
  ];

  // Nieuwe richting alleen kiezen in het midden van een tile
  if (dist < 1) {
    // Alle opties behalve reverse
    const nonRev = dirs.filter(d => !(d.x === -g.dir.x && d.y === -g.dir.y));

    function canStep(d) {
      const nc = c + d.x;
      const nr = r + d.y;

      if (isWall(nc, nr)) return false;

      // eenmaal uit het hok → niet terug erin
      // MAAR ogen (EATEN) mogen WEL naar binnen
      if (penTile && g.hasExitedBox && g.mode !== GHOST_MODE_EATEN) {
        const tileChar = (MAZE[nr] && MAZE[nr][nc]) ? MAZE[nr][nc] : "#";

        if (tileChar === "G" || (nc === penTile.c && nr === penTile.r)) {
          return false;
        }
      }

      return true;
    }

    // Eerst opties zonder omkeren
    let opts = nonRev.filter(canStep);

    // Als die leeg zijn → probeer alle richtingen
    if (opts.length === 0) opts = dirs.filter(canStep);

    if (opts.length > 0) {
      let chosen = null;

      // 1) FRIGHTENED → random bewegen
      if (g.mode === GHOST_MODE_FRIGHTENED) {
        chosen = opts[Math.floor(Math.random() * opts.length)];
      }

      // 2) SCATTER / CHASE / EATEN → target volgen
      else if (
        g.targetTile &&
        (g.mode === GHOST_MODE_SCATTER ||
         g.mode === GHOST_MODE_CHASE   ||
         g.mode === GHOST_MODE_EATEN)
      ) {
        const tx = g.targetTile.c;
        const ty = g.targetTile.r;

        const prefOrder = [
          { x: 0,  y: -1 },  // up
          { x: -1, y: 0 },   // left
          { x: 0,  y: 1 },   // down
          { x: 1,  y: 0 },   // right
        ];

        let best = null;
        let bestDist2 = Infinity;

        for (const pref of prefOrder) {
          const option = opts.find(o => o.x === pref.x && o.y === pref.y);
          if (!option) continue;

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

      // 3) FALLBACK (IN_PEN / LEAVING zonder target) → random
      else {
        chosen = opts[Math.floor(Math.random() * opts.length)];
      }

      g.dir = chosen;
      g.x = mid.x;
      g.y = mid.y;
    }
  }

  // Verplaats ghost
  const speed = g.speed;

  if (canMove(g, g.dir)) {
    g.x += g.dir.x * speed;
    g.y += g.dir.y * speed;
  }

  // Center correctie & portals
  snapToCenter(g);
  applyPortal(g);

  // Check wanneer ghost definitief het hok verlaat
  if (penTile) {
    const tileRow = Math.round(g.y / TILE_SIZE - 0.5);

    if (!g.hasExitedBox && tileRow < penTile.r - 1) {
      g.hasExitedBox = true;
    }
  }

  // --- EATEN → ogen terug in het hok aangekomen? ---
  if (g.mode === GHOST_MODE_EATEN && penTile) {
    const tileDist =
      Math.abs(c - penTile.c) + Math.abs(r - penTile.r); // Manhattan afstand

    // safety: alleen als hij lang GEEN VOORUITGANG meer maakt
    const noProgressTooLong =
      g.lastDistImprovementTime != null &&
      (gameTime - g.lastDistImprovementTime) > 8000 &&  // 8s geen verbetering
      tileDist > 2;

    // Normaal: als hij binnen 2 tiles van de pen is, tellen we dat als "aangekomen"
    if (tileDist <= 2 || noProgressTooLong) {
      const penCenter = tileCenter(penTile.c, penTile.r);
      g.x = penCenter.x;
      g.y = penCenter.y;

      // Respawn in pen
      g.mode         = GHOST_MODE_SCATTER;
      g.speed        = SPEED_CONFIG.ghostSpeed;
      g.released     = false;
      g.hasExitedBox = false;

      if (g.scatterTile) {
        g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
      } else {
        g.targetTile = null;
      }

      // Delay voor weer naar buiten gaan
      g.releaseTime = gameTime + 1000;

      // optioneel: debug
      // console.log("👀 FORCE RESPAWN", g.color, "dist:", tileDist, "noProgressTooLong:", noProgressTooLong);
    }
  }

  // Debug-log BINNEN de functie
  if (g.mode === GHOST_MODE_EATEN && penTile) {
    const tileDist =
      Math.abs(c - penTile.c) + Math.abs(r - penTile.r);
    console.log(
      "👀 EATEN",
      g.color,
      "tile:", c, r,
      "pen:", penTile.c, penTile.r,
      "dist:", tileDist
    );
  }
}


function updateGhosts() {
  ghosts.forEach((g) => {
    // Release-timer respecteren
    if (!g.released) {
      if (gameTime >= g.releaseTime) {
        g.released = true;
      } else {
        return; // deze ghost nog niet updaten
      }
    }

    updateOneGhost(g);
  });
}


function updateGhostGlobalMode(deltaMs) {
  // actuele fase in de sequence
  const seq = GHOST_MODE_SEQUENCE;
  const current = seq[ghostModeIndex];

  // tijd optellen in huidige mode (alleen als niet Infinity)
  if (current.durationMs !== Infinity) {
    ghostModeElapsedTime += deltaMs;

    if (ghostModeElapsedTime >= current.durationMs) {
      const oldMode = current.mode;

      // naar volgende fase
      ghostModeIndex = Math.min(ghostModeIndex + 1, seq.length - 1);
      ghostModeElapsedTime = 0;

      const newMode = seq[ghostModeIndex].mode;
      globalGhostMode = newMode;

      // Bij scatter ↔ chase wissel: alle ghosts omdraaien
      if (
        (oldMode === GHOST_MODE_SCATTER && newMode === GHOST_MODE_CHASE) ||
        (oldMode === GHOST_MODE_CHASE   && newMode === GHOST_MODE_SCATTER)
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

  // globale mode pushen naar individuele ghosts (zolang ze geen frightened/eaten zijn)
  ghosts.forEach((g) => {
    if (g.mode === GHOST_MODE_SCATTER || g.mode === GHOST_MODE_CHASE) {
      g.mode = globalGhostMode;
    }
  });
}

function updateCoins(deltaMs) {
  // timer aftellen
  coinBonusTimer -= deltaMs;
  if (coinBonusTimer <= 0) {
    endCoinBonus();
    return;
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    const cObj = coins[i];

    // al gepakt? -> verwijderen uit array
    if (cObj.taken) {
      coins.splice(i, 1);
      continue;
    }

    // --- botsing met Pacman ---
    const dx = player.x - cObj.x;
    const dy = player.y - cObj.y;
    const dist = Math.hypot(dx, dy);

    if (dist < TILE_SIZE * 0.6) {
      // coin gepakt
      cObj.taken = true;

     // juiste volgorde: 250 -> 500 -> 1000 -> 2000
     const points = coinSequence[coinPickupIndex] || 2000;
     coinPickupIndex++;


      score += points;
      scoreEl.textContent = score;

      // floating score popup
      spawnFloatingScore(cObj.x, cObj.y, points);

      // coin sound
      try {
        const s = coinSound.cloneNode();
        s.volume = coinSound.volume;
        s.play().catch(() => {});
      } catch (e) {}
    }
  }
}


// ---------------------------------------------------------------------------
// COLLISION
// ---------------------------------------------------------------------------

function checkCollision() {
  let playerDies = false;

  for (const g of ghosts) {
    // alleen actieve ghosts
    if (!g.released) continue;

    const dist = Math.hypot(player.x - g.x, player.y - g.y);
    if (dist >= TILE_SIZE * 0.6) continue;

    // 1) FRIGHTENED → Pacman eet ghost
    if (g.mode === GHOST_MODE_FRIGHTENED) {
      // score-chain: 200, 400, 800, 1600
      ghostEatChain++;
      let ghostScore = 200;
      if (ghostEatChain === 2) ghostScore = 400;
      else if (ghostEatChain === 3) ghostScore = 800;
      else if (ghostEatChain >= 4) ghostScore = 1600;

if (
  frightTimer > 0 &&              // we zitten nog in fire-mode
  !fourGhostBonusTriggered &&     // nog niet eerder gedaan in deze fire-mode
  ghostEatChain >= 4              // 4e spookje in deze chain
) {
  fourGhostBonusTriggered = true;
  startFourGhostBonus(g.x, g.y);  // nieuwe functie (coordinaten: waar 4e ghost zat)
}


      score += ghostScore;
      scoreEl.textContent = score;

      // 🔊 geluidje bij eten van spookje
      playGhostEatSound();

      // ⬆️ zwevende score boven het spookje
      spawnFloatingScore(g.x, g.y - TILE_SIZE * 0.6, ghostScore);

      // Ghost wordt ogen in EATEN-mode, sneller terug naar hok
      g.mode  = GHOST_MODE_EATEN;
      g.speed = SPEED_CONFIG.ghostSpeed * 2.5; // beetje sneller dan normaal
      g.targetTile = { c: startGhostTile.c, r: startGhostTile.r };

      continue;
    }

    // 2) Normale modes (scatter/chase) → Pacman sterft
    if (g.mode === GHOST_MODE_SCATTER || g.mode === GHOST_MODE_CHASE) {
      playerDies = true;
      break;
    }

    // 3) EATEN / IN_PEN / LEAVING → negeren (ogen/ghost in hok)
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
// BACKGROUND PNG
// ---------------------------------------------------------------------------

const levelImage = new Image();
levelImage.src = "bitty_pacman.png";

let levelReady = false;
levelImage.onload = () => levelReady = true;

function drawMazeBackground() {
  mazeCtx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
  if (levelReady) {
    mazeCtx.save();
    mazeCtx.translate(mazeOffsetX, mazeOffsetY);
    mazeCtx.scale(mazeScale, mazeScale);
    mazeCtx.drawImage(levelImage, 0, 0, mazeCanvas.width, mazeCanvas.height);
    mazeCtx.restore();
  }
}

// ---------------------------------------------------------------------------
// DOTS – nu weer geschaald met pathScale
// ---------------------------------------------------------------------------

function drawDots() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = getTile(c, r);
      if (t !== "." && t !== "O") continue;

      const x = c * TILE_SIZE + TILE_SIZE / 2;
      const y = r * TILE_SIZE + TILE_SIZE / 2;

      if (t === ".") {
        // Gewone dot – zoals je gewend bent
        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      } else if (t === "O") {
        // Power-dot: groter + pulserend knipper effect

        // basis radius + kleine puls (tussen 0.9x en 1.1x)
        const pulse = 0.9 + 0.2 * ((Math.sin(powerDotPhase * 2) + 1) / 2);
        const rad = POWER_RADIUS * pulse;

        ctx.save();

        // zachte gloed + iets helderdere kleur
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
// PLAYER & GHOST DRAW
// ---------------------------------------------------------------------------

const coinImg = new Image();
coinImg.src = "bittybonus.png";
let coinImgLoaded = false;
coinImg.onload = () => { coinImgLoaded = true; };

const ghostEyesImg = new Image();
ghostEyesImg.src = "eyes.png";
let ghostEyesLoaded = false;
ghostEyesImg.onload = () => (ghostEyesLoaded = true);


const ghost1Img = new Image();
ghost1Img.src = "bitty-ghost.png";
let ghost1Loaded = false;
ghost1Img.onload = () => ghost1Loaded = true;

const ghost2Img = new Image();
ghost2Img.src = "Beefcake-bitkey (1).png";
let ghost2Loaded = false;
ghost2Img.onload = () => ghost2Loaded = true;

const ghost3Img = new Image();
ghost3Img.src = "Orange-man.png";
let ghost3Loaded = false;
ghost3Img.onload = () => ghost3Loaded = true;

const ghost4Img = new Image();
ghost4Img.src = "Beholder.png";
let ghost4Loaded = false;
ghost4Img.onload = () => ghost4Loaded = true;

function drawFireAura(ctx, intensity, radius) {
  ctx.save();
  // Vlammen moeten licht geven → kleuren optellen
  ctx.globalCompositeOperation = "lighter";

  const layers = 2;          // aantal “ringen” vuur
  const baseParticles = 14;  // basis aantal vonken per ring

  for (let layer = 0; layer < layers; layer++) {
    const particles = baseParticles + layer * 6;

    for (let i = 0; i < particles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = radius * (0.7 + Math.random() * 0.4);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;

      const size = radius * (0.15 + Math.random() * 0.15);

      // Kleur: rood/oranje vuur
      const r = 255;
      const g = 80 + Math.floor(Math.random() * 120); // 80–200
      const b = 0;

      // transparantie → afhankelijk van intensiteit
      const a = 0.08 * intensity;

      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}


function drawGhosts() {
  const size = TILE_SIZE * ghostScale;

  // for-of ipv forEach zodat we 'continue' kunnen gebruiken
  for (const g of ghosts) {
    ctx.save();
    ctx.translate(g.x, g.y);

    // === 1. EATEN MODE → alleen ogen ===
    // === 1. EATEN MODE → alleen ogen (groter) ===
    if (g.mode === GHOST_MODE_EATEN) {
      if (ghostEyesImg && ghostEyesImg.complete) {
        const eyesSize = size * 2; // 2x zo groot als normale ghost
        ctx.drawImage(
          ghostEyesImg,
          -eyesSize / 2,
          -eyesSize / 2,
          eyesSize,
          eyesSize
        );
      }
      ctx.restore();
      continue; // volgende ghost
    }


    // === 2. Normale ghost (SCATTER / CHASE / FRIGHT) ===
    let img = ghost1Img;
    if (g.id === 2) img = ghost2Img;
    if (g.id === 3) img = ghost3Img;
    if (g.id === 4) img = ghost4Img;

    // Body tekenen
    if (img && img.complete) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }

    // === 3. FRIGHTENED MODE VISUEEL EFFECT (VUUR-AURA) ===
    if (g.mode === GHOST_MODE_FRIGHTENED) {
      // intensiteit → higher in gewone frightened, knipper in laatste fase
      const intensity = frightFlash
        ? (frame % 20 < 10 ? 0.4 : 1.0)
        : 1.0;

      // Vuur-aura rond de ghost (iets groter dan sprite)
      drawFireAura(ctx, intensity, size * 0.60);
    }

    ctx.restore();
  }
}

function prepareCoinsForBonus() {
  coins.length = 0; // oude coins weg

  const values = [250, 500, 1000, 2000];

  for (let i = 0; i < 4; i++) {
    let c, r, ch;

    // willekeurige geldige tile zoeken
    while (true) {
      c = Math.floor(Math.random() * COLS);
      r = Math.floor(Math.random() * ROWS);
      ch = MAZE[r][c];

      // muren overslaan
      if (isWall(c, r)) continue;

      // startvak Pacman / ghostpen / X overslaan
      if (ch === "P" || ch === "G" || ch === "X") continue;

      break;
    }

    // Tile-center bepalen
    const pos = tileCenter(c, r);

    coins.push({
  x: pos.x,
  y: pos.y,
  radius: COIN_RADIUS,
  taken: false

    });
  }
}


function drawWowBonusText() {
  if (!wowBonusActive) return;

  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  ctx.fillStyle = "#ffff00";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 6;
  ctx.font = "bold 72px 'Courier New', monospace";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const wowOffsetX = 140; // zelfde als readyOffsetX voor consistentie
  const centerX = (COLS * TILE_SIZE) / 2 + wowOffsetX;
  const centerY = player.y - TILE_SIZE * 2; // net iets hoger dan Pacman

  ctx.strokeText("WOW!", centerX, centerY);
  ctx.fillText("WOW!", centerX, centerY);

  ctx.restore();
}

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

  // 👉 handmatige offset
  const readyOffsetX = 140;  // pas aan zoals jij wil
  const centerX = (COLS * TILE_SIZE) / 2 + readyOffsetX;

  const centerY = player.y - TILE_SIZE * 1.5;

  ctx.strokeText("GET READY!", centerX, centerY);
  ctx.fillText("GET READY!", centerX, centerY);

  ctx.restore();
}


// 👉 hier zit de update: we gebruiken nu BASE + OFFSET
function drawElectricBarrierOverlay() {
  electricPhase += 0.3; // snelheid animatie

  const x1 = E_START_X_BASE + ELECTRIC_OFFSET_X;
  const x2 = E_END_X_BASE   + ELECTRIC_OFFSET_X;
  const baseY = E_Y_BASE    + ELECTRIC_OFFSET_Y;

  // 1) Gloeiende basis-balk
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

  // 2) Hoofd-elektrische lijn (knetterend)
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

  // 3) Extra fijne spark-laag
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

function drawPlayer() {
  const size   = TILE_SIZE * pacmanScale;
  const radius = size / 2;

  // ░░ Beweegt hij? ░░
  // Gebruik de echte bewegings-flag uit updatePlayer()
  const moving = player.isMoving;

  // ░░ Mond-animatie ░░
  // Update mouthPhase ALLEEN als hij beweegt of eet.
  // Als hij stil staat en niet eet, blijft mouthPhase gelijk
  // → mond blijft in de laatste frame-stand.
  if (moving || eatingTimer > 0) {
    mouthPhase += mouthSpeed;
  }

  // Mond-open (0..1) op basis van de huidige mouthPhase
  const mouthOpen = (Math.sin(mouthPhase) + 1) / 2;

  // ░░ Richting → rij in sprite sheet ░░
  if (player.dir.x > 0) {
    player.facingRow = PACMAN_DIRECTION_ROW.right;
  } else if (player.dir.x < 0) {
    player.facingRow = PACMAN_DIRECTION_ROW.left;
  } else if (player.dir.y < 0) {
    player.facingRow = PACMAN_DIRECTION_ROW.up;
  } else if (player.dir.y > 0) {
    player.facingRow = PACMAN_DIRECTION_ROW.down;
  }
  // als dir = (0,0) blijft facingRow wat hij was

  // ░░ Mond-open → kolom in sprite sheet (0..2) ░░
  let frameCol = 0;
  if (mouthOpen > 0.66)      frameCol = 2; // helemaal open
  else if (mouthOpen > 0.33) frameCol = 1; // half open
  else                       frameCol = 0; // dicht / klein

  ctx.save();
  ctx.translate(player.x, player.y);

  if (playerLoaded) {
    // Tekenen vanaf de sprite sheet
    const sx = frameCol * PACMAN_SRC_WIDTH;
    const sy = player.facingRow * PACMAN_SRC_HEIGHT;

    ctx.drawImage(
      playerImg,
      sx, sy, PACMAN_SRC_WIDTH, PACMAN_SRC_HEIGHT,
      -size / 2, -size / 2, size, size
    );
  } else {
    // Fallback: oude cirkel + mond-wedge
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


function applyPortal(ent) {
  const c = Math.round(ent.x / TILE_SIZE - 0.5);
  const r = Math.round(ent.y / TILE_SIZE - 0.5);

  // Alleen op de portal-rij
  if (r !== PORTAL_ROW) return;

  // Naar RECHTS bewegen en rechts uit beeld → naar links poort
  if (ent.dir.x > 0 && c === PORTAL_RIGHT_COL) {
    const target = tileCenter(PORTAL_LEFT_COL, PORTAL_ROW);
    ent.x = target.x;
    return;
  }

  // Naar LINKS bewegen en links uit beeld → naar rechts poort
  if (ent.dir.x < 0 && c === PORTAL_LEFT_COL) {
    const target = tileCenter(PORTAL_RIGHT_COL, PORTAL_ROW);
    ent.x = target.x;
    return;
  }
}

// ---------------------------------------------------------------------------
// DRAWT LIVES ALS KLEINE PACMAN-ICOONTJES
// ---------------------------------------------------------------------------
function drawLifeIcons() {
  if (!lifeIconConfig.enabled) return;
  if (!playerLoaded) return; // sprite nog niet geladen? Niks tekenen.

  const { baseX, baseY, spacing, scale } = lifeIconConfig;

  // We gebruiken de sprite sheet van Pacman:
  // rij: naar rechts kijkend, kolom: mond open (frame 2)
  const frameCol = 2; // helemaal open
  const frameRow = PACMAN_DIRECTION_ROW.right;

  const srcX = frameCol * PACMAN_SRC_WIDTH;
  const srcY = frameRow * PACMAN_SRC_HEIGHT;

  // Grootte van het icoontje op het scherm
  const iconSize = TILE_SIZE * pacmanScale * scale;

  for (let i = 0; i < lives; i++) {
    const x = baseX + i * spacing;
    const y = baseY;

    // We tekenen vanuit het midden, net als bij Pacman zelf
    const drawX = x - iconSize / 2;
    const drawY = y - iconSize / 2;

    ctx.drawImage(
      playerImg,
      srcX, srcY, PACMAN_SRC_WIDTH, PACMAN_SRC_HEIGHT,
      drawX, drawY, iconSize, iconSize
    );
  }
}


function drawCoins() {
  if (!coinImgLoaded) return;

  ctx.save();

  // pulse tussen 0.9 en 1.1
  const pulse = 0.9 + 0.2 * ((Math.sin(coinPulsePhase) + 1) / 2);

  coins.forEach(c => {
    if (c.taken) return;

    const scaledRadius = c.radius * pulse;
    const size = scaledRadius * 2;

    ctx.drawImage(
      coinImg,
      c.x - scaledRadius,
      c.y - scaledRadius,
      size,
      size
    );
  });

  ctx.restore();
}




const FRAME_TIME = 1000 / 60; // ≈ 16.67 ms
function loop() {
  if (gameRunning) {
    gameTime += FRAME_TIME; // voor je eigen timing

    // Power-dot animatie fase (voor knipperende grote dots)
    powerDotPhase += POWER_DOT_BLINK_SPEED;

     coinPulsePhase += 0.04;

    // --- FRIGHTENED TIMER UPDATE ---
    if (frightTimer > 0) {
      frightTimer -= FRAME_TIME;

      if (frightTimer <= FRIGHT_FLASH_MS) {
        frightFlash = true;   // laatste fase → knipperen
      }

      if (frightTimer <= 0) {
        frightTimer = 0;
        frightFlash = false;

        // Frightened is voorbij → alle frightened ghosts normaliseren
        ghosts.forEach((g) => {
          if (g.mode === GHOST_MODE_FRIGHTENED) {
            g.mode  = globalGhostMode;          // terug naar SCATTER/CHASE
            g.speed = SPEED_CONFIG.ghostSpeed;  // normale snelheid
          }
        });
      }
    }

    // Scatter/chase-mode timer blijft ook lopen
    updateGhostGlobalMode(FRAME_TIME);

    // Updates
    updatePlayer();
    updateGhosts();
    checkCollision();

    // zwevende scores updaten
    updateFloatingScores(FRAME_TIME);

    // --- WOW 4-GHOST BONUS TIMER ---
    // Zodra je 4 spookjes in vuurmode hebt gepakt, wordt wowBonusActive gezet.
    // Hier tellen we die tijd af; als hij klaar is, starten we de coin-bonus.
    if (typeof wowBonusActive !== "undefined" && wowBonusActive) {
      wowBonusTimer -= FRAME_TIME;
      if (wowBonusTimer <= 0) {
        wowBonusTimer = 0;
        wowBonusActive = false;

        // coin-fase starten zodra de WOW-overlay klaar is
        if (typeof startCoinBonus === "function") {
          startCoinBonus();
        }
      }
    }

    // --- COIN BONUS UPDATE ---
    // Coins bewegen en kunnen door Pacman worden opgepakt
    if (
      typeof coinBonusActive !== "undefined" &&
      coinBonusActive &&
      typeof updateCoins === "function"
    ) {
      updateCoins(FRAME_TIME);
    }

    // 🔊 ogen-sound aan/uit op basis van ghosts in EATEN-modus
    if (typeof updateEyesSound === "function") {
      updateEyesSound();
    }

    // 🔊 fire-mode-sound op basis van ghosts in FRIGHTENED-modus
    if (typeof updateFrightSound === "function") {
      updateFrightSound();
    }

    // 🔊 sirene aan/uit (loopt altijd behalve tijdens intro / frightened / game over)
    if (typeof updateSirenSound === "function") {
      updateSirenSound();
    }

    frame++;
  } else {
    // Spel staat stil (intro of game over) → zorg dat alle loopende sounds uit zijn
    if (typeof eyesSound !== "undefined" && eyesSoundPlaying) {
      eyesSoundPlaying = false;
      eyesSound.pause();
      eyesSound.currentTime = 0;
    }

    if (typeof ghostFireSound !== "undefined" && ghostFireSoundPlaying) {
      ghostFireSoundPlaying = false;
      ghostFireSound.pause();
      ghostFireSound.currentTime = 0;
    }

    // 🔊 alle sirenes uit (normale + speed2)
    if (typeof stopAllSirens === "function") {
      stopAllSirens();
    } else if (typeof stopSiren === "function") {
      // fallback als stopAllSirens nog niet bestaat
      stopSiren();
    }
  }

  // Achtergrond
  drawMazeBackground();

  // Canvas resetten
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Alles in het spelgebied tekenen
  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  drawDots();
  drawPlayer();
  drawGhosts();
  drawFloatingScores(); // zwevende scores

  // Coins tekenen bovenop speler/spookjes als de coin-bonus actief is
  if (
    typeof coinBonusActive !== "undefined" &&
    coinBonusActive &&
    typeof drawCoins === "function"
  ) {
    drawCoins();
  }

  // WOW! tekst tijdens 4-ghost bonus (gele stijl zoals GET READY)
  if (typeof drawWowBonusText === "function") {
    drawWowBonusText();
  }

  // GET READY! tekst tijdens intro
  if (typeof drawReadyText === "function") {
    drawReadyText();
  }

   ctx.restore();

  // Lives als Pacman-icoontjes (in normale scherm-coördinaten)
  drawLifeIcons();

  // Elektrische balk overlay
  drawElectricBarrierOverlay();

  requestAnimationFrame(loop);
}


function startNewGame() {
  score = 0;
  lives = 3;
  scoreEl.textContent = score;
  livesEl.textContent = lives;

  roundStarted = false;
  gameOver    = false;
  gameRunning = false; // wordt pas true NA getready.mp3

  // 🔄 vuurmode-teller resetten voor nieuwe game
  if (typeof frightActivationCount !== "undefined") {
    frightActivationCount = 0;
  }

  // 🔄 4-ghost bonus + WOW-overlay resetten
  if (typeof fourGhostBonusTriggered !== "undefined") {
    fourGhostBonusTriggered = false;
  }
  if (typeof wowBonusActive !== "undefined") {
    wowBonusActive = false;
    wowBonusTimer  = 0;
  }

  // 🔄 coin-bonus resetten (alle coins weg bij nieuwe game)
  if (typeof endCoinBonus === "function") {
    endCoinBonus();
  } else {
    if (typeof coinBonusActive !== "undefined") {
      coinBonusActive = false;
    }
    if (typeof coinBonusTimer !== "undefined") {
      coinBonusTimer = 0;
    }
    if (typeof coins !== "undefined" && Array.isArray(coins)) {
      coins.length = 0;
    }
  }

  // 🔊 alle sirenes uit bij nieuwe game
  if (typeof stopAllSirens === "function") {
    stopAllSirens();
  } else if (typeof stopSiren === "function") {
    stopSiren();
  }

  resetEntities();
  messageEl.classList.add("hidden");

  startIntro();
}

resetEntities();
startIntro();
updateBittyPanel();   // ⬅️ overlay direct goed zetten
loop();


