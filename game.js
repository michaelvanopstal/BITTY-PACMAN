// Bitty Pacman – dot-baan uit MAZE, alles weer geschaald met pathScale

// ---------------------------------------------------------------------------
// CANVASSEN
// ---------------------------------------------------------------------------
const mazeCanvas = document.getElementById("mazeCanvas");
const mazeCtx = mazeCanvas ? mazeCanvas.getContext("2d") : null;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

// Fullscreen HUD canvas voor highscore paneel
const hudCanvas = document.getElementById("hudCanvas");
const hudCtx = hudCanvas ? hudCanvas.getContext("2d") : null;

// Houd CSS pixel afmetingen bij voor clearRect / positioning
let hudW = window.innerWidth;
let hudH = window.innerHeight;

function resizeHudCanvas() {
  if (!hudCanvas || !hudCtx) return;

  const dpr = window.devicePixelRatio || 1;

  hudW = window.innerWidth;
  hudH = window.innerHeight;

  hudCanvas.width  = Math.floor(hudW * dpr);
  hudCanvas.height = Math.floor(hudH * dpr);

  // Teken in CSS pixels
  hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeHudCanvas);
resizeHudCanvas();

// ---------------------------------------------------------------------------
// HIGHSCORE PANEL CONFIG (HUD)
// ---------------------------------------------------------------------------
const highscoreConfig = {
  enabled: true,

  // positionering op SCHERM (hudCanvas)
  anchor: "left-middle",
  offsetX: 40,
  offsetY: 0,

  // schaal
  scale: 0.7,
  textScale: 0.60,

  // basis maat van panel (handig voor consistentie)
  baseW: 420,
  baseH: 700
};



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
// --- GHOST MODES & SCHEMA ---
const GHOST_MODE_SCATTER    = 0;
const GHOST_MODE_CHASE      = 1;
const GHOST_MODE_FRIGHTENED = 2;
const GHOST_MODE_EATEN      = 3;
const GHOST_MODE_IN_PEN     = 4;
const GHOST_MODE_LEAVING    = 5;

// Level 1 (jouw “oude” schema)
const GHOST_MODE_SEQUENCE_L1 = [
  { mode: GHOST_MODE_SCATTER, durationMs:  2 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs: 35 * 1000 },
  { mode: GHOST_MODE_SCATTER, durationMs:  2 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs:  Infinity },
];

// Level 2 (houd jouw huidige waarden hier)
const GHOST_MODE_SEQUENCE_L2 = [
  { mode: GHOST_MODE_SCATTER, durationMs:  2 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs: 35 * 1000 },
  { mode: GHOST_MODE_SCATTER, durationMs:  2 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs:  Infinity },
];

// Level 3 (extra agressief)
const GHOST_MODE_SEQUENCE_L3 = [
  { mode: GHOST_MODE_SCATTER, durationMs:  1 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs: 25 * 1000 },
  { mode: GHOST_MODE_SCATTER, durationMs:  1 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs:  Infinity },
];

function getGhostModeSequenceForLevel() {
  if (currentLevel === 3) return GHOST_MODE_SEQUENCE_L3;
  if (currentLevel === 2) return GHOST_MODE_SEQUENCE_L2;
  return GHOST_MODE_SEQUENCE_L1; // level 1
}

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
let CLYDE_SCATTER_DISTANCE_TILES = 4;
let CLYDE_SCATTER_DISTANCE2 = CLYDE_SCATTER_DISTANCE_TILES * CLYDE_SCATTER_DISTANCE_TILES;

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

// Kersen systeem
let cherry = null;           // { x, y, active }
let cherriesSpawned = 0;     // maximaal 3
let dotsEaten = 0;           // tellen we bij in updatePlayer()
let nextCherryThresholds = [50, 120, 200]; // ritme voor kers (vroeg in level)
const cherryImg = new Image();
cherryImg.src = "kersen.png";

const cherrySound = new Audio("kersensound.mp3");
cherrySound.volume = 0.9;

// Aardbei systeem
let strawberry = null;              // { x, y, active }
let strawberriesSpawned = 0;        // bijvoorbeeld max 2 per level
let nextStrawberryThresholds = [140, 220]; // ritme: iets later in het level
const strawberryImg = new Image();
strawberryImg.src = "aarbei.png";

// ─────────────────────────────────────────────
// CANNON SYSTEM (Level 2) — HUD cannons + maze bullets
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 🟦 Bitty Bonus HUD icon
// ─────────────────────────────────────────────
const bittyBonusImg = new Image();
bittyBonusImg.src = "bittybonus.png";

// schaal/positie instelbaar
const bittyBonusIconConfig = {
  enabled: true,
  x: 140,     // pas aan
  y: 450,     // pas aan
  scale: 0.8  // pas aan
};


const bananaImg = new Image();
bananaImg.src = "banaan.png";

let banana = null;
let bananasSpawned = 0;
let nextBananaThresholds = [60, 150, 260]; // voorbeeld ritme, pas aan
const bananaIconConfig = { enabled: true, x: 690, y: 450, scale: 0.8 };

// ─────────────────────────────────────────────
// 🍐 PEER SYSTEM (LEVEL 3 ONLY)
// ─────────────────────────────────────────────
const pearImg = new Image();
pearImg.src = "peer.png";

let pear = null;       // { x, y, active }
let pearsSpawned = 0;  // exact 3 per level

// ✅ precies 3 spawns in level 3
// ✅ geen overlap met kers/aardbei/banaan thresholds (50,120,200 / 140,220 / 60,150,260)
let nextPearThresholds = [90, 190, 280];

// HUD icoon (naast banaan)
const pearIconConfig = { enabled: true, x: 650, y: 450, scale: 1.0 };


// Fine-tune bullet X binnen de lane (pixels, positief = naar rechts)
let CANNON_LANE_LEFT_OFFSET_PX  = 0;
let CANNON_LANE_RIGHT_OFFSET_PX = 0;

// Bullet start (pixels). Negatief = van boven buiten beeld naar binnen
const CANNON_BULLET_START_Y = -20;

// Wave triggers
let cannonWave1Triggered = false;
let cannonWave2Triggered = false;
let cannonWave3Triggered = false;
let cannonWaveTriggered = [];
let cannonWaveTimeoutIds = [];

// Actieve bullets
const activeCannonballs = [];

// Dots thresholds (wanneer waves starten)
const CANNON_WAVE_THRESHOLDS = [40, 80, 120, 180, 250, 300, 340,  380];


// Welke kolommen (lanes) gebruikt de bullet? (0-based tile columns)
const CANNON_LANE_LEFT_COL  = 6;   // “baantje 5”
const CANNON_LANE_RIGHT_COL = 21;  // “baantje 20”

// HUD-positie van de cannons (pixels op het scherm / canvas)
const cannonHUD = {
  left:  { x: 236, y: 1, scale: 0.7 },
  right: { x: 579, y: 1, scale: 0.7 }
};

// Cannon sprite
const cannonImg = new Image();
cannonImg.src = "cannon.png";


// === EXTRA LIFE GOAL TRACKING (per fire-mode run) ===
let fireRunGhostsEaten = 0;         // telt ghosts gegeten tijdens 1 fright (max 4)
let fireRunCoinsCollected = 0;      // telt coins gepakt tijdens 1 coinbonus (max 4)
let extraLifeAwardedThisRun = false; // voorkomt dubbele extra life in dezelfde run

// === 1 UP POPUP (midden in beeld) ===
let oneUpTextActive = false;
let oneUpTimer = 0;
const ONE_UP_DURATION = 1500; // ms


// Start een wave (1/2/3)
function startCannonWave(wave) {
   if (!isAdvancedLevel()) return;


  // helper: timeout opslaan zodat we 'm kunnen clearen bij death/reset
  function schedule(fn, delay) {
    const id = setTimeout(fn, delay);
    cannonWaveTimeoutIds.push(id);
  }

  if (wave === 1) {
    spawnCannonballFromLane("left");
    spawnCannonballFromLane("right");
  }

  if (wave === 2) {
    spawnCannonballFromLane("left");
    schedule(() => spawnCannonballFromLane("right"), 1000);
  }

  if (wave === 3) {
    spawnCannonballFromLane("left");
    spawnCannonballFromLane("right");
  }

  if (wave === 4) {
    spawnCannonballFromLane("left");
    schedule(() => spawnCannonballFromLane("left"), 600);
    spawnCannonballFromLane("right");
  }

  if (wave === 5) {
    spawnCannonballFromLane("left");
    spawnCannonballFromLane("right");
    schedule(() => spawnCannonballFromLane("left"), 600);
    schedule(() => spawnCannonballFromLane("right"), 600);
  }

  if (wave === 6) {
    spawnCannonballFromLane("left");
    spawnCannonballFromLane("left");
    spawnCannonballFromLane("right");
    spawnCannonballFromLane("right");
  }

  // ─────────────────────────────────────────────
  // WAVE 7 – Triple burst (links/rechts afwisselend)
  // ─────────────────────────────────────────────
  if (wave === 7) {
    spawnCannonballFromLane("left");
    schedule(() => spawnCannonballFromLane("right"), 250);
    schedule(() => spawnCannonballFromLane("left"), 500);

    schedule(() => spawnCannonballFromLane("right"), 750);
    schedule(() => spawnCannonballFromLane("left"), 1000);
    schedule(() => spawnCannonballFromLane("right"), 1250);
  }

  // ─────────────────────────────────────────────
  // WAVE 8 – Final storm: snelle dubbele bursts beide kanten
  // ─────────────────────────────────────────────
  if (wave === 8) {
    // burst 1
    spawnCannonballFromLane("left");
    spawnCannonballFromLane("right");

    // burst 2 (snel)
    schedule(() => {
      spawnCannonballFromLane("left");
      spawnCannonballFromLane("right");
    }, 300);

    // burst 3 (nog sneller/meer druk)
    schedule(() => {
      spawnCannonballFromLane("left");
      spawnCannonballFromLane("left");
      spawnCannonballFromLane("right");
      spawnCannonballFromLane("right");
    }, 650);
  }
}

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
  "X.........##GGGG##.........X",
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

// GAME OVER SOUND
const gameOverSound = new Audio("gameover.mp3");
gameOverSound.loop = false;
gameOverSound.volume = 1.0;

const cannonShootSound = new Audio("cannonshoot.mp3");
cannonShootSound.loop = false;
cannonShootSound.volume = 0.8;

const cannonExplosionSound = new Audio("cannonexsplosion.mp3");
cannonExplosionSound.loop = false;
cannonExplosionSound.volume = 0.9;

// ✅ 1UP / extra-life sound
const levelUpSound = new Audio("levelup sound.mp3");
levelUpSound.preload = "auto";
levelUpSound.volume = 0.9; // pas aan als je wil


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


const cherryIconConfig = {
  enabled: true,
  x: 660,    // positie op het scherm (px)
  y: 305,    // naast of onder je lives, pas zelf aan
  scale: 0.8 // 1.0 = normaal, 1.2 = iets groter
};

// ─────────────────────────────────────────────
// SPIKY ROLLING BALL (LEVEL 3 ONLY) - NO IMAGE
// ─────────────────────────────────────────────
let spikyBall = null;

function isSpikyBallTile(c, r) {
  if (!spikyBall || !spikyBall.active) return false;
  return spikyBall.c === c && spikyBall.r === r;
}


function drawCherryIcon() {
  if (!cherryIconConfig.enabled) return;
  if (!cherryImg || !cherryImg.complete) return;

  const size = TILE_SIZE * cherryIconConfig.scale * pacmanScale;
  const x = cherryIconConfig.x;
  const y = cherryIconConfig.y;

  ctx.drawImage(
    cherryImg,
    x - size / 2,
    y - size / 2,
    size,
    size
  );
}

// Aardbei HUD-icoon (vast op canvas, los van de spawns in het doolhof)
const strawberryIconConfig = {
  enabled: true,
  x: 700,    // schuif waar je wilt; bv. rechts van de kers
  y: 303,    // zelfde hoogte als cherryIconConfig voor een nette lijn
  scale: 0.8 // zelfde schaal als kers
};

function drawStrawberryIcon() {
  if (!strawberryIconConfig.enabled) return;
  if (!strawberryImg || !strawberryImg.complete) return;

  const size = TILE_SIZE * strawberryIconConfig.scale * pacmanScale;
  const x = strawberryIconConfig.x;
  const y = strawberryIconConfig.y;

  ctx.drawImage(
    strawberryImg,
    x - size / 2,
    y - size / 2,
    size,
    size
  );
}

function drawPear() {
  if (!pear || !pear.active) return;

  const size = TILE_SIZE * 1.1;
  ctx.drawImage(pearImg, pear.x - size / 2, pear.y - size / 2, size, size);
}

function drawPearIcon() {
  if (!pearIconConfig.enabled) return;
  if (!pearImg || !pearImg.complete) return;

  const size = TILE_SIZE * pearIconConfig.scale * pacmanScale;
  const x = pearIconConfig.x;
  const y = pearIconConfig.y;

  ctx.drawImage(
    pearImg,
    x - size / 2,
    y - size / 2,
    size,
    size
  );
}


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
// LEVEL SYSTEM
// ───────────────────────────────────────────────
let currentLevel = 1;
let readyLabel   = "GET READY!";  // level 1 tekst
// ───────────────────────────────────────────────
// VISUELE LIVES ALS PACMAN-ICOONTJES
// ───────────────────────────────────────────────
const lifeIconConfig = {
  enabled: true,        // zet op false als je ze tijdelijk uit wilt
  baseX: 60,            // begin X-positie van de eerste Pacman (px, canvas coördinaten)
  baseY: 330,            // Y-positie van alle Pacmans
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
// BACKGROUND PNG (maze) → neon restyle via offscreen mask
// ---------------------------------------------------------------------------
const levelImage = new Image();
levelImage.src = "bitty_pacman.png";

let levelReady = false;

// neon style (zelfde als highscore)
const MAZE_NEON_BLUE = "#2a00ff";

// Offscreen canvas om de PNG als “mask” te gebruiken
const levelMaskCanvas = document.createElement("canvas");
const levelMaskCtx = levelMaskCanvas.getContext("2d");

levelImage.onload = () => {
  levelReady = true;

  // match aan je mazeCanvas resolution
  levelMaskCanvas.width  = mazeCanvas.width;
  levelMaskCanvas.height = mazeCanvas.height;

  // mask = de originele png (line-art)
  levelMaskCtx.setTransform(1,0,0,1,0,0);
  levelMaskCtx.clearRect(0,0, levelMaskCanvas.width, levelMaskCanvas.height);
  levelMaskCtx.drawImage(levelImage, 0, 0, mazeCanvas.width, mazeCanvas.height);
};


function isAdvancedLevel() {
  return currentLevel === 2 || currentLevel === 3;
}
function applySpeedsForLevel() {
  const BASE_SPEED = 2.8;

  if (currentLevel === 1) {
    // ✅ Level 1: iets sneller dan eerst (actiever gevoel)
    SPEED_CONFIG.playerSpeed      = BASE_SPEED * 1.08; // ≈ 3.02
    SPEED_CONFIG.ghostSpeed       = SPEED_CONFIG.playerSpeed * 0.92;
    SPEED_CONFIG.ghostTunnelSpeed = SPEED_CONFIG.playerSpeed * 0.45;
    SPEED_CONFIG.ghostFrightSpeed = SPEED_CONFIG.playerSpeed * 0.60;

  } else if (currentLevel === 2) {
    // Level 2: duidelijke stap omhoog
    SPEED_CONFIG.playerSpeed      = BASE_SPEED * 1.25; // ≈ 3.50
    SPEED_CONFIG.ghostSpeed       = SPEED_CONFIG.playerSpeed * 0.97;
    SPEED_CONFIG.ghostTunnelSpeed = SPEED_CONFIG.playerSpeed * 0.50;
    SPEED_CONFIG.ghostFrightSpeed = SPEED_CONFIG.playerSpeed * 0.70;

  } else if (currentLevel === 3) {
    // Level 3: hoogste snelheid + agressie
    SPEED_CONFIG.playerSpeed      = BASE_SPEED * 1.40; // ≈ 3.92
    SPEED_CONFIG.ghostSpeed       = SPEED_CONFIG.playerSpeed * 0.99;
    SPEED_CONFIG.ghostTunnelSpeed = SPEED_CONFIG.playerSpeed * 0.60;
    SPEED_CONFIG.ghostFrightSpeed = SPEED_CONFIG.playerSpeed * 0.80;
  }

  // ─────────────────────────────────────────────
  // Bestaande entiteiten direct updaten
  // ─────────────────────────────────────────────
  if (player) {
    player.speed = SPEED_CONFIG.playerSpeed;
  }

  if (Array.isArray(ghosts)) {
    ghosts.forEach(g => {
      switch (g.mode) {
        case GHOST_MODE_FRIGHTENED:
          g.speed = SPEED_CONFIG.ghostFrightSpeed;
          break;

        case GHOST_MODE_SCATTER:
        case GHOST_MODE_CHASE:
          g.speed = SPEED_CONFIG.ghostSpeed;
          break;

        case GHOST_MODE_EATEN:
          // sneller terug naar huis
          g.speed = SPEED_CONFIG.ghostSpeed * 1.2;
          break;
      }
    });
  }

  // ─────────────────────────────────────────────
  // Clyde extra agressief maken in level 3
  // ─────────────────────────────────────────────
  if (typeof CLYDE_SCATTER_DISTANCE_TILES !== "undefined") {
    CLYDE_SCATTER_DISTANCE_TILES = (currentLevel === 3) ? 2.5 : 4;
  }

  if (
    typeof CLYDE_SCATTER_DISTANCE2 !== "undefined" &&
    typeof CLYDE_SCATTER_DISTANCE_TILES !== "undefined"
  ) {
    CLYDE_SCATTER_DISTANCE2 =
      CLYDE_SCATTER_DISTANCE_TILES * CLYDE_SCATTER_DISTANCE_TILES;
  }
}

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
  // ✅ Altijd oude coins weg (ook als ze er nog stonden)
  coins.length = 0;

  // ✅ Nieuwe set van 4 coins voorbereiden
  prepareCoinsForBonus();

  // ✅ Coin-bonus actief + timer opnieuw starten
  coinBonusActive = true;
  coinBonusTimer = COIN_BONUS_DURATION;

  // ✅ Puntenvolgorde opnieuw: 250 → 500 → 1000 → 2000
  coinPickupIndex = 0;

  // ✅ Nieuwe coin-run → teller resetten
  fireRunCoinsCollected = 0;

  // ✅ Zorg dat 1UP weer mogelijk is
  extraLifeAwardedThisRun = false;
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
    releaseTime: 2000,       // 3s later
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
    releaseTime: 4000,       // 6s later
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
    releaseTime: 6000,       // 9s later
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
function updateCannonballs(deltaMs) {
  for (let i = activeCannonballs.length - 1; i >= 0; i--) {
    const b = activeCannonballs[i];

    // ───── EXPLOSIE-FASE ─────
    if (b.exploding) {
      b.explodeTime += deltaMs;
      if (b.explodeTime > 400) {
        activeCannonballs.splice(i, 1);
      }
      continue;
    }

    // ───── BEWEGING ─────
    b.y += b.vy;

    let hitSomething = false;

    // ───── HIT MET PACMAN ─────
    const distP = Math.hypot(player.x - b.x, player.y - b.y);
    if (distP < b.radius + TILE_SIZE * 0.4) {
      hitSomething = true;
      startPacmanDeath();   // zelfde als door ghost geraakt
    }

    // ───── HIT MET GHOSTS ─────
    for (const g of ghosts) {
      const distG = Math.hypot(g.x - b.x, g.y - b.y);
      if (distG < b.radius + TILE_SIZE * 0.4) {
        hitSomething = true;

        // ghost wordt “ogen” → terug naar pen
        g.mode  = GHOST_MODE_EATEN;
        g.speed = SPEED_CONFIG.ghostSpeed * 2.5;
        g.targetTile = { c: startGhostTile.c, r: startGhostTile.r };
      }
    }

    // ───── EIND VAN DE BAAN / MUUR ─────
    // we checken de maze-tile: als daar een muur is, explodeert hij
    const c = Math.floor(b.x / TILE_SIZE);
    const r = Math.floor(b.y / TILE_SIZE);

   // Alleen walls checken zodra de bullet echt in de maze zit
if (b.y >= 0) {
  if (isWall(c, r) || b.y > GAME_HEIGHT - TILE_SIZE) {
    hitSomething = true;
  }
} else {
  // bovenin: nog niks doen, gewoon doorvliegen
  if (b.y > GAME_HEIGHT - TILE_SIZE) hitSomething = true;
}


    // ───── EXPLOSIE STARTEN ─────
    if (hitSomething) {
      b.exploding = true;
      b.explodeTime = 0;

      cannonExplosionSound.currentTime = 0;
      cannonExplosionSound.play().catch(()=>{});
    }
  }
}

// Wrapper zodat loop() gewoon updateCannons kan aanroepen
function updateCannons(deltaMs) {
  updateCannonballs(deltaMs);
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


function spawnCherry() {
  // Zoek een random plek in het doolhof die geen muur is
  let attempts = 0;

  while (attempts < 500) {
    const c = Math.floor(Math.random() * COLS);
    const r = Math.floor(Math.random() * ROWS);

    // muur? overslaan
    if (isWall(c, r)) {
      attempts++;
      continue;
    }

    // startposities / speciale tiles overslaan
    const ch = MAZE[r][c];
    if (ch === "P" || ch === "G" || ch === "X") {
      attempts++;
      continue;
    }

    const pos = tileCenter(c, r);

    cherry = {
      x: pos.x,
      y: pos.y,
      active: true
    };

    cherriesSpawned++;
    console.log("🍒 Cherry spawned at", c, r);
    return;
  }

  console.warn("Kon geen geldige plek voor cherry vinden.");
}

function spawnStrawberry() {
  // Zelfde logica als cherry, maar bewaak ook dat hij niet exact op de kers spawnt
  let attempts = 0;

  while (attempts < 500) {
    const c = Math.floor(Math.random() * COLS);
    const r = Math.floor(Math.random() * ROWS);

    if (isWall(c, r)) {
      attempts++;
      continue;
    }

    const ch = MAZE[r][c];
    if (ch === "P" || ch === "G" || ch === "X") {
      attempts++;
      continue;
    }

    const pos = tileCenter(c, r);

    // Niet bovenop een actieve kers spawnen
    if (cherry && cherry.active) {
      const d = Math.hypot(cherry.x - pos.x, cherry.y - pos.y);
      if (d < TILE_SIZE) {
        attempts++;
        continue;
      }
    }

    strawberry = {
      x: pos.x,
      y: pos.y,
      active: true
    };

    strawberriesSpawned++;
    console.log("🍓 Strawberry spawned at", c, r);
    return;
  }

  console.warn("Kon geen geldige plek voor strawberry vinden.");
}

function spawnBanana() {
  let attempts = 0;

  while (attempts < 500) {
    const c = Math.floor(Math.random() * COLS);
    const r = Math.floor(Math.random() * ROWS);

    if (isWall(c, r)) { attempts++; continue; }

    const ch = MAZE[r][c];
    if (ch === "P" || ch === "G" || ch === "X") { attempts++; continue; }

    const pos = tileCenter(c, r);

    // Niet bovenop andere fruit spawnen
    if (cherry && cherry.active && Math.hypot(cherry.x - pos.x, cherry.y - pos.y) < TILE_SIZE) {
      attempts++; continue;
    }
    if (strawberry && strawberry.active && Math.hypot(strawberry.x - pos.x, strawberry.y - pos.y) < TILE_SIZE) {
      attempts++; continue;
    }

    banana = { x: pos.x, y: pos.y, active: true };
    bananasSpawned++;
    console.log("🍌 Banana spawned at", c, r);
    return;
  }

  console.warn("Kon geen geldige plek voor banana vinden.");
}

function spawnPear() {
  // ✅ level 3 only
  if (currentLevel !== 3) return;

  let attempts = 0;

  while (attempts < 500) {
    const c = Math.floor(Math.random() * COLS);
    const r = Math.floor(Math.random() * ROWS);

    if (isWall(c, r)) { attempts++; continue; }

    const ch = MAZE[r][c];
    if (ch === "P" || ch === "G" || ch === "X") { attempts++; continue; }

    const pos = tileCenter(c, r);

    // Niet bovenop andere fruit spawnen
    if (cherry && cherry.active && Math.hypot(cherry.x - pos.x, cherry.y - pos.y) < TILE_SIZE) {
      attempts++; continue;
    }
    if (strawberry && strawberry.active && Math.hypot(strawberry.x - pos.x, strawberry.y - pos.y) < TILE_SIZE) {
      attempts++; continue;
    }
    if (banana && banana.active && Math.hypot(banana.x - pos.x, banana.y - pos.y) < TILE_SIZE) {
      attempts++; continue;
    }
    if (pear && pear.active && Math.hypot(pear.x - pos.x, pear.y - pos.y) < TILE_SIZE) {
      attempts++; continue;
    }

    pear = { x: pos.x, y: pos.y, active: true };
    pearsSpawned++;
    console.log("🍐 Pear spawned at", c, r);
    return;
  }

  console.warn("Kon geen geldige plek voor pear vinden.");
}


function spawnSpikyBallForLevel3() {
  if (currentLevel !== 3) {
    spikyBall = null;
    return;
  }

  // zoek random pad-tile (geen muur, geen P/G/X)
  let attempts = 0;
  while (attempts < 500) {
    const c = Math.floor(Math.random() * COLS);
    const r = Math.floor(Math.random() * ROWS);

    if (isWall(c, r)) { attempts++; continue; }

    const ch = MAZE[r][c];

// ❌ nooit spawnen op ghost-pen, ghost-starts of blocked tiles
if (
  ch === "G" ||     // ghost start / pen
  ch === "X" ||     // blocked tile
  ch === "P" ||     // pacman start (veilig)
  ch === "S" ||     // (optioneel) speciale tiles als je die hebt
  ch === "H"        // (optioneel) home/house
) {
  attempts++;
  continue;
}


    const size = TILE_SIZE * 1.2;
    const radius = size * 0.38;

    spikyBall = {
      active: true,
      c, r,
      x: tileCenter(c, r).x,
      y: tileCenter(c, r).y,
      dir: { x: 1, y: 0 },
      speed: 0.6,     // langzaam door het veld

      // rolling visual
      angle: 0,
      radius: radius,
      size: size
    };
    return;
  }

  spikyBall = null;
}


function resetEntities() {
  // ─────────────────────────────────────────────
  // PACMAN DEATH STATE RESETTEN
  // ─────────────────────────────────────────────
  if (typeof isDying !== "undefined") {
    isDying = false;
  }
  if (typeof deathAnimTime !== "undefined") {
    deathAnimTime = 0;
  }
  if (typeof pacmanDeathSound !== "undefined") {
    pacmanDeathSound.pause();
    pacmanDeathSound.currentTime = 0;
  }

  // ─────────────────────────────────────────────
  // LEVEL-SPEEDS OPNIEUW TOEPASSEN
  // (belangrijk bij level switch + life verlies)
  // ─────────────────────────────────────────────
  if (typeof applySpeedsForLevel === "function") {
    applySpeedsForLevel();
  }

  // ─────────────────────────────────────────────
  // MAZE & POWER-DOTS
  // ─────────────────────────────────────────────
  currentMaze = MAZE.slice();
  allPowerDotsUsed = false;

  // ─────────────────────────────────────────────
  // PACMAN RESET
  // ─────────────────────────────────────────────
  player.x = tileCenter(pac.c, pac.r).x;
  player.y = tileCenter(pac.c, pac.r).y;
  player.dir     = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
  player.speed   = SPEED_CONFIG.playerSpeed;

  // ─────────────────────────────────────────────
  // FRIGHT / GHOST CHAIN RESET
  // ─────────────────────────────────────────────
  frightTimer   = 0;
  frightFlash   = false;
  ghostEatChain = 0;

  // ✅ EXTRA LIFE RUN TRACKING RESET (nieuw)
  fireRunGhostsEaten = 0;
  fireRunCoinsCollected = 0;
  extraLifeAwardedThisRun = false;

  // ✅ 1 UP POPUP RESET (nieuw)
  oneUpTextActive = false;
  oneUpTimer = 0;

  globalGhostMode      = GHOST_MODE_SCATTER;
  ghostModeIndex       = 0;
  ghostModeElapsedTime = 0;

  // ─────────────────────────────────────────────
  // GHOSTS RESET
  // ─────────────────────────────────────────────
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
    if (g.id === 2) g.releaseTime = 2000;
    if (g.id === 3) g.releaseTime = 4000;
    if (g.id === 4) g.releaseTime = 6000;

    g.targetTile = g.scatterTile
      ? { c: g.scatterTile.c, r: g.scatterTile.r }
      : null;
  });

  gameTime = 0;
  roundStarted = false;

  // ─────────────────────────────────────────────
  // ✅ NEW: SPIKY BALL RESET/SPAWN (LEVEL 3 ONLY)
  // ─────────────────────────────────────────────
  if (typeof spawnSpikyBallForLevel3 === "function") {
    spawnSpikyBallForLevel3();
  } else {
    // fallback: als de functie nog niet bestaat, zet hem uit
    if (typeof spikyBall !== "undefined" && spikyBall) spikyBall.active = false;
  }

  // ─────────────────────────────────────────────
  // 4-GHOST BONUS / COIN BONUS RESET
  // ─────────────────────────────────────────────
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
    if (Array.isArray(coins)) coins.length = 0;
  }

  // ─────────────────────────────────────────────
  // 🍒🍓🍌🍐 FRUIT RESET
  // ─────────────────────────────────────────────
  if (typeof cherry !== "undefined") cherry = null;
  if (typeof cherriesSpawned !== "undefined") cherriesSpawned = 0;

  if (typeof strawberry !== "undefined") strawberry = null;
  if (typeof strawberriesSpawned !== "undefined") strawberriesSpawned = 0;

  // 🍌 banaan reset
  if (typeof banana !== "undefined") banana = null;
  if (typeof bananasSpawned !== "undefined") bananasSpawned = 0;

  // 🍐 peer reset
  if (typeof pear !== "undefined") pear = null;
  if (typeof pearsSpawned !== "undefined") pearsSpawned = 0;

  if (typeof dotsEaten !== "undefined") dotsEaten = 0;

  // ─────────────────────────────────────────────
  // 💣 CANNON SYSTEM RESET (LEVEL 2 + 3)
  // ─────────────────────────────────────────────

  // ✅ nieuw schaalbaar wavesysteem resetten
  if (typeof cannonWaveTriggered !== "undefined") {
    cannonWaveTriggered = [];
  }

  // ✅ alle geplande cannon spawns stoppen (belangrijk bij death/reset/level switch)
  if (typeof cannonWaveTimeoutIds !== "undefined" && Array.isArray(cannonWaveTimeoutIds)) {
    cannonWaveTimeoutIds.forEach(id => clearTimeout(id));
    cannonWaveTimeoutIds.length = 0;
  }

  // ✅ actieve bullets altijd weg
  if (Array.isArray(activeCannonballs)) {
    activeCannonballs.length = 0;
  }

  // (oud systeem mag blijven staan; breekt niks)
  if (typeof cannonWave1Triggered !== "undefined") cannonWave1Triggered = false;
  if (typeof cannonWave2Triggered !== "undefined") cannonWave2Triggered = false;
  if (typeof cannonWave3Triggered !== "undefined") cannonWave3Triggered = false;

  // ✅ HUD state reset (alleen als het bestaat)
  if (typeof cannonHUD !== "undefined" && cannonHUD) {
    if (cannonHUD.left)  cannonHUD.left.active  = false;
    if (cannonHUD.right) cannonHUD.right.active = false;
  }

  // ─────────────────────────────────────────────
  // 🔊 GELUIDEN RESET
  // ─────────────────────────────────────────────
  eyesSoundPlaying = false;
  if (eyesSound) {
    eyesSound.pause();
    eyesSound.currentTime = 0;
  }

  ghostFireSoundPlaying = false;
  if (ghostFireSound) {
    ghostFireSound.pause();
    ghostFireSound.currentTime = 0;
  }

  frightActivationCount = 0;
  stopAllSirens();
}

function resetAfterDeath() {
  // ❌ GEEN currentMaze reset hier!

  // ─────────────────────────────────────────────
  // PACMAN RESET
  // ─────────────────────────────────────────────
  player.x = tileCenter(pac.c, pac.r).x;
  player.y = tileCenter(pac.c, pac.r).y;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };

  // ─────────────────────────────────────────────
  // GHOSTS RESET (met juiste 2s release timing)
  // ─────────────────────────────────────────────
  const base = gameTime;                 // 🔑 huidig gameTime als referentie
  const delays = [0, 2000, 4000, 6000];  // ✅ exact zoals vroeger

  ghosts.forEach((g, index) => {
    const startTile = ghostStarts[index] || ghostPen;

    g.x = tileCenter(startTile.c, startTile.r).x;
    g.y = tileCenter(startTile.c, startTile.r).y;

    g.dir = { x: 0, y: -1 };
    g.released = false;
    g.hasExitedBox = false;

    g.mode  = GHOST_MODE_SCATTER;
    g.speed = SPEED_CONFIG.ghostSpeed;

    // ✅ CRUCIAAL: releaseTime opnieuw zetten RELATIEF aan gameTime
    g.releaseTime = base + (delays[index] ?? 0);
  });

  // ─────────────────────────────────────────────
  // FRIGHT / CHAINS RESET
  // ─────────────────────────────────────────────
  frightTimer = 0;
  frightFlash = false;
  ghostEatChain = 0;

  // ─────────────────────────────────────────────
  // ✅ COIN BONUS / WOW RESET BIJ DOODGAAN
  // ─────────────────────────────────────────────
  wowBonusActive = false;
  wowBonusTimer  = 0;

  // Stop coin-bonus en verwijder coins uit het veld
  if (typeof endCoinBonus === "function") {
    endCoinBonus(); // coinBonusActive=false, coinBonusTimer=0, coins.length=0
  } else {
    // fallback (voor het geval endCoinBonus ooit ontbreekt)
    if (typeof coinBonusActive !== "undefined") coinBonusActive = false;
    if (typeof coinBonusTimer !== "undefined") coinBonusTimer = 0;
    if (typeof coins !== "undefined" && Array.isArray(coins)) coins.length = 0;
  }

  // Reset pickup volgorde (250→500→1000→2000)
  coinPickupIndex = 0;

  // Reset run-tracking (zodat je niet “verdergaat” na death)
  fireRunGhostsEaten = 0;
  fireRunCoinsCollected = 0;
  extraLifeAwardedThisRun = false;

  // Veiligheid: 4-ghost bonus vlag resetten
  fourGhostBonusTriggered = false;

  // ─────────────────────────────────────────────
  // ROUND STATE
  // ─────────────────────────────────────────────
  roundStarted = false;
  gameRunning = true;
}




// ---------------------------------------------------------------------------
// INPUT
// ---------------------------------------------------------------------------

window.addEventListener("keydown", (e) => {

  // ─────────────────────────────────────────────
  // ⛔️ VOORKOM PAGE SCROLL (PIJLTJES + SPATIE)
  // ─────────────────────────────────────────────
  if (
    e.key === "ArrowUp" ||
    e.key === "ArrowDown" ||
    e.key === "ArrowLeft" ||
    e.key === "ArrowRight" ||
    e.code === "Space"
  ) {
    e.preventDefault();
  }

  // ─────────────────────────────────────────────
  // DEV SHORTCUT → DIRECT NAAR LEVEL 3
  // ─────────────────────────────────────────────
  if (e.key === "3") {
    currentLevel = 3;
    gameOver = false;
    gameRunning = true;

    if (typeof resetEntities === "function") {
      resetEntities();
    }
    return;
  }

  // ─────────────────────────────────────────────
  // SPACE → RESTART BIJ GAME OVER
  // ─────────────────────────────────────────────
  if (e.code === "Space") {
    if (gameOver) startNewGame();
    return;
  }

  // ─────────────────────────────────────────────
  // PACMAN INPUT
  // ─────────────────────────────────────────────
  let dx = 0, dy = 0;

  if (e.key === "ArrowUp")    dy = -1;
  if (e.key === "ArrowDown")  dy = 1;
  if (e.key === "ArrowLeft")  dx = -1;
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

  if (isSpikyBallTile(c, r)) return false;   // <-- nieuw
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

function updatePlayer() {

  const prevX = player.x;
  const prevY = player.y;

  const c = Math.round(player.x / TILE_SIZE - 0.5);
  const r = Math.round(player.y / TILE_SIZE - 0.5);

  const mid  = tileCenter(c, r);
  const dist = Math.hypot(player.x - mid.x, player.y - mid.y);
  const atCenter = dist < 6;

  const isStopped = (player.dir.x === 0 && player.dir.y === 0);
  const blocked   = !isStopped && !canMove(player, player.dir);

  const wantsReverse =
    player.nextDir.x === -player.dir.x &&
    player.nextDir.y === -player.dir.y;

  // ─────────────────────────────────────────────
  // RICHTING KIEZEN
  // ─────────────────────────────────────────────
  let mayChange = false;

  if (blocked) {
    player.dir = { x: 0, y: 0 };
    mayChange = true;
  }
  else if (isStopped) {
    mayChange = true;
  }
  else if (atCenter && (wantsReverse || isTurnTile(c, r))) {
    mayChange = true;
  }

  if (mayChange && canMove(player, player.nextDir)) {
    player.dir = { ...player.nextDir };
  }

  // ─────────────────────────────────────────────
  // BEWEGEN
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // EET-TIMER
  // ─────────────────────────────────────────────
  if (eatingTimer > 0) {
    eatingTimer -= 16.67;
    if (eatingTimer < 0) eatingTimer = 0;
  }

  const ch = getTile(c, r);

  // ─────────────────────────────────────────────
  // DOT / POWER DOT
  // ─────────────────────────────────────────────
  if (ch === "." || ch === "O") {

    setTile(c, r, " ");
    score += (ch === "O" ? SCORE_POWER : SCORE_DOT);
    scoreEl.textContent = score;

    playDotSound();
    eatingTimer = EATING_DURATION;

    if (typeof dotsEaten !== "undefined") {
      dotsEaten++;
      // fruit & cannon code ongewijzigd

      // ─────────────────────────────────────────────
      // 🔫 CANNON WAVE TRIGGERS (LEVEL 2 + 3)
      // ─────────────────────────────────────────────
      if (isAdvancedLevel()) {
        for (let i = 0; i < CANNON_WAVE_THRESHOLDS.length; i++) {
          if (
            dotsEaten >= CANNON_WAVE_THRESHOLDS[i] &&
            !cannonWaveTriggered[i]
          ) {
            cannonWaveTriggered[i] = true;
            startCannonWave(i + 1); // wave nummer = index + 1
          }
        }
      }
    }

    // ─────────────────────────────────────────────
    // POWER DOT (fire mode)
    // ─────────────────────────────────────────────
    if (ch === "O") {

      // 🔑 BELANGRIJK:
      // Alleen resetten als er GEEN coin-bonus actief is
      if (!coinBonusActive) {
        fireRunGhostsEaten = 0;
        fireRunCoinsCollected = 0;
        extraLifeAwardedThisRun = false;
      }

      frightActivationCount++;
      frightTimer   = FRIGHT_DURATION_MS;
      frightFlash   = false;
      ghostEatChain = 0;
      fourGhostBonusTriggered = false;

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

    // ─────────────────────────────────────────────
    // CHECK POWER DOTS / LEVEL OVER
    // ─────────────────────────────────────────────
    const anyPowerDotsLeft = currentMaze.some(row => row.includes("O"));
    if (!anyPowerDotsLeft) {
      allPowerDotsUsed = true;
    }

    const anyDotsLeft =
      currentMaze.some(row => row.includes(".")) ||
      currentMaze.some(row => row.includes("O"));

    if (!anyDotsLeft && typeof onAllDotsCleared === "function") {
      onAllDotsCleared();
    }
  }

  // ─────────────────────────────────────────────
  // MOND-ANIMATIE
  // ─────────────────────────────────────────────
  if (eatingTimer > 0) {
    mouthSpeed = 0.30;
  } else {
    mouthSpeed = player.isMoving ? 0.08 : 0.0;
  }
}



function onAllDotsCleared() {
  console.log("✨ All dots cleared!");

  if (currentLevel === 1) {
    currentLevel = 2;
    readyLabel = "LEVEL 2";
  } else if (currentLevel === 2) {
    currentLevel = 3;
    readyLabel = "LEVEL 3";
  } else {
    console.log("🎉 Alle levels klaar!");
    return;
  }

  // Nieuwe speeds instellen
  applySpeedsForLevel();

  // Alles resetten voor nieuw level (speler, ghosts, dots, fruit, cannons, etc.)
  resetEntities();

  // Intro: in de stijl van GET READY
  showReadyText = true;
  introActive   = true;
  gameRunning   = false;

  // Get-ready sound opnieuw gebruiken
  readySound.currentTime = 0;
  readySound.play().catch(() => {});
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
  // --- FIX B: cap snelheid voor EATEN (voorkomt kruispunt overslaan bij te hoge speed) ---
  if (g.mode === GHOST_MODE_EATEN) {
    const maxEatenSpeed = SPEED_CONFIG.ghostSpeed * 1.6;
    if (g.speed > maxEatenSpeed) g.speed = maxEatenSpeed;
  }

  // Huidige tile & tile-midden berekenen
  const c   = Math.round(g.x / TILE_SIZE - 0.5);
  const r   = Math.round(g.y / TILE_SIZE - 0.5);
  const mid = tileCenter(c, r);
  const dist = Math.hypot(g.x - mid.x, g.y - mid.y);

  // Nieuw: check of huidige richting geblokkeerd is
  const blocked = !canMove(g, g.dir);

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

  const dirs = [
    { x:  1, y:  0 },  // rechts
    { x: -1, y:  0 },  // links
    { x:  0, y:  1 },  // omlaag
    { x:  0, y: -1 }   // omhoog
  ];

  // --- FIX A: center-tolerantie schaalt met snelheid (kruispunten niet missen) ---
  const centerEps = Math.max(1.0, g.speed * 0.6);
  const atCenter = dist < centerEps;

  if (atCenter || blocked) {
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
          const dx  = tx - nc2;
          const dy  = ty - nr2;
          const d2  = dx * dx + dy * dy;

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
      // bij het kiezen van een nieuwe richting zetten we hem netjes op tile-center
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

    const noProgressTooLong =
      g.lastDistImprovementTime != null &&
      (gameTime - g.lastDistImprovementTime) > 8000 &&
      tileDist > 2;

    if (tileDist <= 2 || noProgressTooLong) {
      const penCenter = tileCenter(penTile.c, penTile.r);
      g.x = penCenter.x;
      g.y = penCenter.y;

      g.mode         = GHOST_MODE_SCATTER;
      g.speed        = SPEED_CONFIG.ghostSpeed;
      g.released     = false;
      g.hasExitedBox = false;

      if (g.scatterTile) {
        g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
      } else {
        g.targetTile = null;
      }

      g.releaseTime = gameTime + 1000;
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
function tryAwardExtraLife(pointsJustCollected) {
  // al gegeven in deze run?
  if (extraLifeAwardedThisRun) return;

  // ✅ moet echt de 4e coin zijn
  if (fireRunCoinsCollected !== 4) return;

  // ✅ moet de 2000-coin zijn
  if (pointsJustCollected !== 2000) return;

  // ✅ fire-run doel: 4 ghosts + 4 coins
  if (fireRunGhostsEaten === 4) {
    lives++;
    if (livesEl) livesEl.textContent = lives;

    extraLifeAwardedThisRun = true;

    // 🎉 1 UP popup
    oneUpTextActive = true;
    oneUpTimer = ONE_UP_DURATION;

    // 🔊 level-up sound tegelijk met 1 UP
    try {
      if (typeof levelUpSound !== "undefined") {
        levelUpSound.currentTime = 0;
        levelUpSound.play().catch(() => {});
      }
    } catch (e) {}

    console.log("⭐ EXTRA LIFE: 4 ghosts + 4 coins, awarded on 2000 coin!");
  }
}


function updateSpikyBall() {
  if (!spikyBall || !spikyBall.active) return;
  if (currentLevel !== 3) return;

  // vorige positie voor "rolling"
  const px = spikyBall.x;
  const py = spikyBall.y;

  // tile waar hij ongeveer zit
  const c = Math.round(spikyBall.x / TILE_SIZE - 0.5);
  const r = Math.round(spikyBall.y / TILE_SIZE - 0.5);
  const mid = tileCenter(c, r);
  const dist = Math.hypot(spikyBall.x - mid.x, spikyBall.y - mid.y);

  // ✅ FIX: veel kleinere center-drempel
  const EPS = 0.15;               // eventueel 0.2 als je wilt
  const atCenter = dist < EPS;

  // als hij op center is: kies nieuwe richting (random open paden)
  if (atCenter) {
    spikyBall.c = c; spikyBall.r = r;
    spikyBall.x = mid.x; spikyBall.y = mid.y;

    const dirs = [
      { x:  1, y:  0 },
      { x: -1, y:  0 },
      { x:  0, y:  1 },
      { x:  0, y: -1 }
    ];

    const nonReverse = dirs.filter(d => !(d.x === -spikyBall.dir.x && d.y === -spikyBall.dir.y));

    const ok = (d) => {
      const nc = c + d.x;
      const nr = r + d.y;
      return !isWall(nc, nr);
    };

    let options = nonReverse.filter(ok);
    if (options.length === 0) options = dirs.filter(ok);

    if (options.length > 0) {
      spikyBall.dir = options[Math.floor(Math.random() * options.length)];
    }
  }

  // beweeg constant langzaam
  const nx = spikyBall.x + spikyBall.dir.x * spikyBall.speed;
  const ny = spikyBall.y + spikyBall.dir.y * spikyBall.speed;
  const nc = Math.floor(nx / TILE_SIZE);
  const nr = Math.floor(ny / TILE_SIZE);

  if (!isWall(nc, nr)) {
    spikyBall.x = nx;
    spikyBall.y = ny;
  } else {
    // forceer center zodat hij opnieuw kiest
    spikyBall.x = tileCenter(c, r).x;
    spikyBall.y = tileCenter(c, r).y;
  }

  // portals (werkt met ent.x/y)
  applyPortal(spikyBall);

  // rolling: afstand -> rotatie
  const moved = Math.hypot(spikyBall.x - px, spikyBall.y - py);
  const sign = (spikyBall.dir.x !== 0) ? spikyBall.dir.x : spikyBall.dir.y;
  spikyBall.angle += sign * moved / Math.max(1, spikyBall.radius);

  // (optioneel maar goed) blocking tile sync
  spikyBall.c = Math.floor(spikyBall.x / TILE_SIZE);
  spikyBall.r = Math.floor(spikyBall.y / TILE_SIZE);
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
    const seq = getGhostModeSequenceForLevel();

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
  coinBonusTimer -= deltaMs;
  if (coinBonusTimer <= 0) {
    endCoinBonus();
    return;
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    const cObj = coins[i];

    if (cObj.taken) {
      coins.splice(i, 1);
      continue;
    }

    const dist = Math.hypot(player.x - cObj.x, player.y - cObj.y);

    if (dist < TILE_SIZE * 0.6) {
      cObj.taken = true;

      // punten in vaste volgorde (4e pickup = 2000)
      const points = coinSequence[coinPickupIndex] || 2000;
      coinPickupIndex++;

      // ✅ tel coins in deze run
      fireRunCoinsCollected = Math.min(4, fireRunCoinsCollected + 1);

      // ✅ extra life alleen checken bij deze pickup (en intern beperken tot 4e + 2000)
      tryAwardExtraLife(points);

      score += points;
      scoreEl.textContent = score;

      spawnFloatingScore(cObj.x, cObj.y, points);

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
  // Als Pacman al in een death-animatie zit of het is game over,
  // willen we geen nieuwe collision meer verwerken.
  if (typeof isDying !== "undefined" && isDying) return;
  if (gameOver) return;

  let playerDies = false;

  // ✅ NEW: SPIKY BALL collision (alleen level 3)
  // Als Pacman de rollende stekelbal raakt → leven eraf (via startPacmanDeath)
  if (
    typeof currentLevel !== "undefined" &&
    currentLevel === 3 &&
    typeof spikyBall !== "undefined" &&
    spikyBall &&
    spikyBall.active
  ) {
    const distSpiky = Math.hypot(player.x - spikyBall.x, player.y - spikyBall.y);
    if (distSpiky < TILE_SIZE * 0.65) {
      playerDies = true;
    }
  }

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

      // ✅ extra-life run tracking: tel ghosts tijdens deze fire-run (max 4)
      fireRunGhostsEaten = Math.min(4, fireRunGhostsEaten + 1);


      // 4-ghost bonus check
      if (
        frightTimer > 0 &&              // we zitten nog in fire-mode
        !fourGhostBonusTriggered &&     // nog niet eerder gedaan in deze fire-mode
        ghostEatChain >= 4              // 4e spookje in deze chain
      ) {
        fourGhostBonusTriggered = true;
        startFourGhostBonus(g.x, g.y);  // nieuwe functie (coördinaten: waar 4e ghost zat)
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

      // ✅ Stap 3: extra-life run tracking (4 ghosts in deze fire-mode run)
      fireRunGhostsEaten = Math.min(4, fireRunGhostsEaten + 1);
      // ❌ BELANGRIJK: GEEN tryAwardExtraLife() hier!
      // 1UP + extra life mag pas afgaan bij het pakken van de 4e coin.

      continue;
    }

    // 2) Normale modes (scatter/chase) → Pacman sterft
    if (g.mode === GHOST_MODE_SCATTER || g.mode === GHOST_MODE_CHASE) {
      playerDies = true;
      break;
    }

    // 3) EATEN / IN_PEN / LEAVING → negeren (ogen/ghost in hok)
  }

  // 🍒 KERS-COLLISION (alleen als Pacman niet doodgaat deze frame)
  if (!playerDies && typeof cherry !== "undefined" && cherry && cherry.active) {
    const distCherry = Math.hypot(player.x - cherry.x, player.y - cherry.y);
    if (distCherry < TILE_SIZE * 0.6) {
      // Kers oppakken
      cherry.active = false;

      // +100 punten
      score += 100;
      scoreEl.textContent = score;

      // zwevende +100 score boven de kers
      if (typeof spawnFloatingScore === "function") {
        spawnFloatingScore(cherry.x, cherry.y - TILE_SIZE * 0.6, 100);
      }

      // 🔊 kers-geluid
      if (typeof cherrySound !== "undefined") {
        cherrySound.currentTime = 0;
        cherrySound.play().catch(() => {});
      }
    }
  }

  // 🍌 BANAAN-COLLISION (+700 punten, zelfde geluid als kers/aarbei)
  if (!playerDies && typeof banana !== "undefined" && banana && banana.active) {
    const distBan = Math.hypot(player.x - banana.x, player.y - banana.y);
    if (distBan < TILE_SIZE * 0.6) {
      // Banaan oppakken
      banana.active = false;

      // +700 punten
      score += 700;
      scoreEl.textContent = score;

      // zwevende +700 score boven de banaan
      if (typeof spawnFloatingScore === "function") {
        spawnFloatingScore(banana.x, banana.y - TILE_SIZE * 0.6, 700);
      }

      // 🔊 zelfde sound als kers/aardbei
      if (typeof cherrySound !== "undefined") {
        cherrySound.currentTime = 0;
        cherrySound.play().catch(() => {});
      }
    }
  }

  // 🍓 AARDBEI-COLLISION (300 punten, zelfde geluid als kers)
  if (!playerDies && typeof strawberry !== "undefined" && strawberry && strawberry.active) {
    const distStraw = Math.hypot(player.x - strawberry.x, player.y - strawberry.y);
    if (distStraw < TILE_SIZE * 0.6) {
      // Aardbei oppakken
      strawberry.active = false;

      // +300 punten
      score += 300;
      scoreEl.textContent = score;

      // zwevende +300 score boven de aardbei
      if (typeof spawnFloatingScore === "function") {
        spawnFloatingScore(strawberry.x, strawberry.y - TILE_SIZE * 0.6, 300);
      }

      // 🔊 zelfde sound als kers
      if (typeof cherrySound !== "undefined") {
        cherrySound.currentTime = 0;
        cherrySound.play().catch(() => {});
      }
    }
  }

  // 🍐 PEER-COLLISION (LEVEL 3 ONLY, +1200 punten, zelfde geluid als kers)
  if (
    !playerDies &&
    currentLevel === 3 &&
    typeof pear !== "undefined" &&
    pear && pear.active
  ) {
    const distPear = Math.hypot(player.x - pear.x, player.y - pear.y);
    if (distPear < TILE_SIZE * 0.6) {
      // Peer oppakken
      pear.active = false;

      // +1200 punten
      score += 1200;
      scoreEl.textContent = score;

      // zwevende +1200 score boven de peer
      if (typeof spawnFloatingScore === "function") {
        spawnFloatingScore(pear.x, pear.y - TILE_SIZE * 0.6, 1200);
      }

      // 🔊 zelfde sound als kers
      if (typeof cherrySound !== "undefined") {
        cherrySound.currentTime = 0;
        cherrySound.play().catch(() => {});
      }
    }
  }

  if (playerDies) {
    // NIEUW: geen lives-- en reset meer hier, maar
    // de death-animatie met sound starten.
    if (typeof startPacmanDeath === "function") {
      startPacmanDeath();
    } else {
      // Fallback naar oud gedrag als de functie nog niet bestaat
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
}

function handleGhostSpikyBallCollision() {
  if (!spikyBall || !spikyBall.active) return;
  if (currentLevel !== 3) return;

  const hitDist = TILE_SIZE * 0.55;

  ghosts.forEach((g) => {
    if (!g.released) return;

    const d = Math.hypot(g.x - spikyBall.x, g.y - spikyBall.y);
    if (d >= hitDist) return;

    // ✅ Ghost "dood" → eyes-mode terug naar start/pen (zichtbaar)
    g.mode  = GHOST_MODE_EATEN;
    g.speed = SPEED_CONFIG.ghostSpeed * 2.5;

    // laat hem bewegen als eyes
    g.released = true;
    g.hasExitedBox = true;

    // target: start tile (of ghostPen als dat bij jou klopt)
    g.targetTile = { c: startGhostTile.c, r: startGhostTile.r };

    // optioneel: richting resetten voor consistente beweging
    g.dir = { x: 0, y: -1 };
  });
}



// ---------------------------------------------------------------------------
// BACKGROUND PNG
// ---------------------------------------------------------------------------



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

function startPacmanDeath() {
  if (isDying) return; // dubbele start voorkomen

  isDying = true;
  deathAnimTime = 0;

  // Spel stilzetten
  gameRunning = false;

  // Alle andere geluiden stoppen
  stopAllSirens?.();
  if (ghostFireSoundPlaying) {
    ghostFireSoundPlaying = false;
    ghostFireSound.pause();
    ghostFireSound.currentTime = 0;
  }
  if (eyesSoundPlaying) {
    eyesSoundPlaying = false;
    eyesSound.pause();
    eyesSound.currentTime = 0;
  }

  // Pacman death sound starten
  pacmanDeathSound.currentTime = 0;
  pacmanDeathSound.play().catch(() => {});
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



const cannonBulletImg = new Image();
cannonBulletImg.src = "canonbullet.png"; // je kogel-sprite
let cannonBulletLoaded = false;
cannonBulletImg.onload = () => { cannonBulletLoaded = true; };

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

  // ✅ Garandeer 4 coins (als er minstens 4 vrije tiles bestaan)
  // We bouwen eerst een lijst met geldige tiles, en pakken daar 4 unieke uit.
  const valid = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isWall(c, r)) continue;

      const ch = MAZE[r][c];
      // startvak Pacman / ghostpen / X overslaan
      if (ch === "P" || ch === "G" || ch === "X") continue;

      valid.push({ c, r });
    }
  }

  // Fisher–Yates shuffle
  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = valid[i];
    valid[i] = valid[j];
    valid[j] = tmp;
  }

  const count = Math.min(4, valid.length);
  for (let i = 0; i < count; i++) {
    const t = valid[i];
    const pos = tileCenter(t.c, t.r);
    coins.push({
      x: pos.x,
      y: pos.y,
      radius: COIN_RADIUS,
      taken: false
    });
  }

  // debug (handig): console.log("🪙 Coins spawned:", coins.length);
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

  ctx.strokeText(readyLabel, centerX, centerY);
  ctx.fillText(readyLabel, centerX, centerY);

  ctx.restore();
}

function drawCherry() {
  if (!cherry || !cherry.active) return;

  const size = TILE_SIZE * 1.1; // iets groter dan dots
  ctx.drawImage(cherryImg, cherry.x - size/2, cherry.y - size/2, size, size);
}

function drawStrawberry() {
  if (!strawberry || !strawberry.active) return;

  const size = TILE_SIZE * 1.1; // zelfde schaal als kers
  ctx.drawImage(strawberryImg, strawberry.x - size/2, strawberry.y - size/2, size, size);
}

function drawBanana() {
  if (!banana || !banana.active) return;

  const size = TILE_SIZE * 1.1;
  ctx.drawImage(bananaImg, banana.x - size / 2, banana.y - size / 2, size, size);
}

function drawBittyBonusIcon() {
  if (!bittyBonusIconConfig.enabled) return;
  if (!bittyBonusImg || !bittyBonusImg.complete) return;

  const scale = (typeof pacmanScale !== "undefined") ? pacmanScale : 1;
  const size = TILE_SIZE * bittyBonusIconConfig.scale * scale;

  ctx.drawImage(
    bittyBonusImg,
    bittyBonusIconConfig.x - size / 2,
    bittyBonusIconConfig.y - size / 2,
    size,
    size
  );
}


function drawBananaIcon() {
  if (!bananaIconConfig.enabled) return;
  if (!bananaImg || !bananaImg.complete) return;

  const size = TILE_SIZE * bananaIconConfig.scale * pacmanScale;
  const x = bananaIconConfig.x;
  const y = bananaIconConfig.y;

  ctx.drawImage(
    bananaImg,
    x - size / 2,
    y - size / 2,
    size,
    size
  );
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

   if (isDying) {
    drawPacmanDeathFrame();
    return;
  }

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

function fitTextToWidth(ctx, text, maxWidth, baseFontPx, fontFamily){
  let size = baseFontPx;
  ctx.font = `700 ${size}px ${fontFamily}`;
  while (ctx.measureText(text).width > maxWidth && size > 8){
    size -= 1;
    ctx.font = `700 ${size}px ${fontFamily}`;
  }
  return size;
}

function roundRectPath(ctx, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, w/2, h/2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function drawNeonStroke(ctx, drawPathFn, opt){
  const color = opt.color || "#00d8ff";
  const lw    = opt.lineWidth || 4;
  const glow  = opt.glow ?? 12;
  const a     = opt.alpha ?? 1;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.globalAlpha = a;
  ctx.lineJoin = "round";
  ctx.lineCap  = "round";

  // glow pass
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  drawPathFn();
  ctx.stroke();

  // crisp pass
  ctx.shadowBlur = 0;
  drawPathFn();
  ctx.stroke();

  ctx.restore();
}

function getAnchorPos(screenW, screenH, panelW, panelH, cfg){
  let x = 0, y = 0;
  if (cfg.anchor === "left-middle"){
    x = cfg.offsetX;
    y = (screenH - panelH) / 2 + cfg.offsetY;
  } else {
    x = cfg.offsetX;
    y = cfg.offsetY;
  }
  return { x, y };
}

function drawBittyHighscorePanel(ctx, x, y, w, h, opts = {}) {
  const BLUE   = "#2a00ff";
  const YELLOW = "#ffcc00";

  const outerRadius = Math.round(Math.min(w, h) * 0.04);
  const borderGap   = Math.round(Math.min(w, h) * 0.015);
  const outerLine   = Math.round(Math.min(w, h) * 0.012);
  const innerLine   = Math.max(2, Math.round(outerLine * 0.7));

  const headerH = Math.round(h * 0.17);
  const sepY = y + headerH;

  // outer
  drawNeonStroke(ctx, () => roundRectPath(ctx, x, y, w, h, outerRadius), {
    color: BLUE, lineWidth: outerLine, glow: 16, alpha: 1
  });

  // inner
  drawNeonStroke(ctx, () => roundRectPath(
    ctx,
    x + borderGap,
    y + borderGap,
    w - borderGap * 2,
    h - borderGap * 2,
    Math.max(2, outerRadius - borderGap)
  ), { color: BLUE, lineWidth: innerLine, glow: 10, alpha: 1 });

  // header separator
  drawNeonStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x + borderGap, sepY);
    ctx.lineTo(x + w - borderGap, sepY);
  }, { color: BLUE, lineWidth: innerLine, glow: 8, alpha: 1 });

  // title
  const textScale = (opts.textScale ?? 1);
  const title = "BITTY HIGHSCORE";

  ctx.save();
  ctx.fillStyle = YELLOW;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontFamily = "Arial Black, Impact, system-ui, sans-serif";
  const baseFont = Math.round(headerH * 0.46 * textScale);
  const maxTextWidth = (w - borderGap * 4);

  const fittedSize = fitTextToWidth(ctx, title, maxTextWidth, baseFont, fontFamily);
  ctx.font = `700 ${fittedSize}px ${fontFamily}`;

  ctx.fillText(title, x + w / 2, y + headerH / 2);
  ctx.restore();

  // binnen blijft leeg (hier kan jij straks je scores tekenen)
}

function drawScaledBittyHighscoreHUD(hudCtx, cfg){
  if (!cfg.enabled) return;

  const BASE_W = 420;
  const BASE_H = 700;

  const panelW = BASE_W * cfg.scale;
  const panelH = BASE_H * cfg.scale;

  // ✅ pak de echte positie van je maze op het scherm
  const rect = mazeCanvas.getBoundingClientRect();
  const gap  = 1;

  // links naast de maze
  const x = rect.left - panelW - gap + (cfg.offsetX || 0);
  const y = rect.top + (rect.height - panelH) / 2 + (cfg.offsetY || 0);

  hudCtx.save();
  hudCtx.translate(x, y);
  hudCtx.scale(cfg.scale, cfg.scale);

  drawBittyHighscorePanel(hudCtx, 0, 0, BASE_W, BASE_H, { textScale: cfg.textScale });

  hudCtx.restore();
}


function drawSpikyBall() {
  if (!spikyBall || !spikyBall.active) return;
  if (currentLevel !== 3) return;

  const size = spikyBall.size;

  // schaduw
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(spikyBall.x, spikyBall.y + size*0.18, size*0.28, size*0.16, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // bal + rotatie
  ctx.save();
  ctx.translate(spikyBall.x, spikyBall.y);
  ctx.rotate(spikyBall.angle);

  // body
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // subtiele highlight
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-size*0.12, -size*0.12, size*0.14, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // spikes (goud)
 // 🔺 echte spikes – punt altijd naar buiten
const spikes = 12;
const baseRadius = size * 0.42;
const spikeLength = size * 0.26;
const baseWidth = size * 0.12;

ctx.fillStyle = "#d4af37";

for (let i = 0; i < spikes; i++) {
  const a = (Math.PI * 2 * i) / spikes;

  // richting vector
  const dx = Math.cos(a);
  const dy = Math.sin(a);

  // basis links/rechts
  const bx1 = dx * baseRadius - dy * baseWidth * 0.5;
  const by1 = dy * baseRadius + dx * baseWidth * 0.5;

  const bx2 = dx * baseRadius + dy * baseWidth * 0.5;
  const by2 = dy * baseRadius - dx * baseWidth * 0.5;

  // punt van de spike (naar buiten)
  const px = dx * (baseRadius + spikeLength);
  const py = dy * (baseRadius + spikeLength);

  ctx.beginPath();
  ctx.moveTo(bx1, by1);
  ctx.lineTo(px, py);
  ctx.lineTo(bx2, by2);
  ctx.closePath();
  ctx.fill();
}


  // marker (maakt rollen super duidelijk)
  ctx.fillStyle = "#d4af37";
  ctx.beginPath();
  ctx.arc(size*0.18, -size*0.10, size*0.06, 0, Math.PI*2);
  ctx.fill();

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
  if (!playerLoaded) return;
  if (!hudCtx || !highscoreConfig?.enabled) return;

  const { spacing, scale } = lifeIconConfig;

  // ─────────────────────────────────────────────
  // Pacman sprite (zelfde als je originele code)
  // ─────────────────────────────────────────────
  const frameCol = 2; // mond open
  const frameRow = PACMAN_DIRECTION_ROW.right;

  const srcX = frameCol * PACMAN_SRC_WIDTH;
  const srcY = frameRow * PACMAN_SRC_HEIGHT;

  const iconSize = TILE_SIZE * pacmanScale * scale;

  // ─────────────────────────────────────────────
  // Bepaal positie van het highscore-paneel
  // ─────────────────────────────────────────────
  const BASE_W = highscoreConfig.baseW ?? 420;
  const BASE_H = highscoreConfig.baseH ?? 700;

  const panelW = BASE_W * highscoreConfig.scale;
  const panelH = BASE_H * highscoreConfig.scale;

  // zelfde positionering als paneel
  const pos = getAnchorPos(
    window.innerWidth,
    window.innerHeight,
    panelW,
    panelH,
    highscoreConfig
  );

  const panelX = pos.x;
  const panelY = pos.y;

  // ─────────────────────────────────────────────
  // Lives: gecentreerd BOVEN het paneel
  // ─────────────────────────────────────────────
  const centerX = panelX + panelW / 2;
  const yAbove  = panelY - iconSize * 0.9; // ↑ hoger/lager aanpassen

  const totalWidth = (lives - 1) * spacing;
  const startX = centerX - totalWidth / 2;

  // ─────────────────────────────────────────────
  // Tekenen op HUD canvas
  // ─────────────────────────────────────────────
  for (let i = 0; i < lives; i++) {
    const x = startX + i * spacing;
    const y = yAbove;

    hudCtx.drawImage(
      playerImg,
      srcX, srcY,
      PACMAN_SRC_WIDTH, PACMAN_SRC_HEIGHT,
      x - iconSize / 2,
      y - iconSize / 2,
      iconSize,
      iconSize
    );
  }
}


function onPlayerDeathFinished() {
  isDying = false;
  deathAnimTime = 0;

  // 🔊 Death sound resetten
  if (typeof pacmanDeathSound !== "undefined") {
    pacmanDeathSound.pause();
    pacmanDeathSound.currentTime = 0;
  }

  // Life aftrekken
  lives--;
  livesEl.textContent = lives;

  // ─────────────────────────────
  //   GAME OVER LOGICA
  // ─────────────────────────────
  if (lives <= 0) {
    gameRunning = false;
    gameOver = true;

    // 🔊 Alle andere geluiden stoppen
    if (typeof stopAllSirens === "function") stopAllSirens();
    
    if (typeof eyesSound !== "undefined") {
      eyesSound.pause();
      eyesSound.currentTime = 0;
      eyesSoundPlaying = false;
    }
    if (typeof ghostFireSound !== "undefined") {
      ghostFireSound.pause();
      ghostFireSound.currentTime = 0;
      ghostFireSoundPlaying = false;
    }

    // 🔊 GAME OVER SOUND AFSPELEN
    gameOverSound.currentTime = 0;
    gameOverSound.play().catch(() => {});

    return; // niets meer resetten, want game is voorbij
  }

  // ─────────────────────────────
  //   NIEUW LEVEN (geen game over)
  // ─────────────────────────────
 resetAfterDeath();

}


function updateDeathAnimation(deltaMs) {
  if (!isDying) return;

  deathAnimTime += deltaMs;

  if (deathAnimTime >= deathAnimDuration) {
    onPlayerDeathFinished();
  }
}

function drawPacmanDeathFrame() {
  if (!playerLoaded) return;

  const t = Math.min(1, deathAnimTime / deathAnimDuration);

  ctx.save();
  ctx.translate(player.x, player.y);

  const baseSize = TILE_SIZE * pacmanScale;

  if (t < 0.7) {
    // Fase 1: Pacman shrink + mond verder open
    const local = t / 0.7; // 0..1 binnen fase 1
    const scale = 1 - local; // van 1 → 0

    const size = baseSize * scale;

    // mond-frame kiezen op basis van local (0..1 → kolom 0..2)
    const frameCol = Math.min(2, Math.floor(local * 3));
    const frameRow = player.facingRow || PACMAN_DIRECTION_ROW.right;

    const sx = frameCol * PACMAN_SRC_WIDTH;
    const sy = frameRow * PACMAN_SRC_HEIGHT;

    ctx.drawImage(
      playerImg,
      sx, sy, PACMAN_SRC_WIDTH, PACMAN_SRC_HEIGHT,
      -size / 2,
      -size / 2,
      size,
      size
    );
  } else {
    // Fase 2: Pacman is weg, alleen streepjes-rondje
    const local = (t - 0.7) / 0.3; // 0..1 binnen fase 2
    drawPacmanDeathRays(local);
  }

  ctx.restore();
}

function drawNeonMazeFromMask(ctx) {
  // 1) Maak een gekleurde versie van het mask (tint naar #2a00ff)
  // We doen dit door: mask tekenen → source-in → fill met blue
  const w = levelMaskCanvas.width;
  const h = levelMaskCanvas.height;

  // tijdelijke offscreen voor tinted resultaat (kan ook 1x global blijven, maar zo simpel is ok)
  const tinted = document.createElement("canvas");
  tinted.width = w;
  tinted.height = h;
  const tctx = tinted.getContext("2d");

  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(levelMaskCanvas, 0, 0);

  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = MAZE_NEON_BLUE;
  tctx.fillRect(0, 0, w, h);
  tctx.globalCompositeOperation = "source-over";

  // 2) Glow passes (zoals je paneel vibe)
  ctx.save();

  // outer glow
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = MAZE_NEON_BLUE;
  ctx.shadowBlur = 22;
  ctx.drawImage(tinted, 0, 0);

  // inner glow (iets strakker)
  ctx.shadowColor = "rgba(60, 120, 255, 0.95)";
  ctx.shadowBlur = 10;
  ctx.drawImage(tinted, 0, 0);

  // crisp pass (geen blur)
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.drawImage(tinted, 0, 0);

  ctx.restore();
}
function drawNeonBittyTitle(ctx) {
  // Tekent BITTY bovenaan in neon kleuren (poppen)
  const text = "BITTY";
  const colors = ["#ff2a2a", "#00ff66", "#00eaff", "#ffe600", "#ff00ff"];

  ctx.save();

  ctx.globalCompositeOperation = "lighter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // lettertype: kies iets dik en clean
  ctx.font = "900 180px Arial Black, Impact, system-ui, sans-serif";

  // positie binnen de PNG coordinate space (pas zonodig iets aan)
  const xCenter = (mazeCanvas.width / 2);
  const yTop = 40;

  // we tekenen per letter zodat elke letter eigen kleur/glow krijgt
  let measure = ctx.measureText(text);
  const totalW = measure.width;
  let startX = xCenter - totalW / 2;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const col = colors[i % colors.length];

    const chW = ctx.measureText(ch).width;

    // glow pass
    ctx.shadowColor = col;
    ctx.shadowBlur = 26;
    ctx.fillStyle = col;
    ctx.fillText(ch, startX, yTop);

    // crisp pass
    ctx.shadowBlur = 0;
    ctx.fillStyle = col;
    ctx.fillText(ch, startX, yTop);

    startX += chW;
  }

  ctx.restore();
}


function drawCannonProjectiles() {
  if (!cannonBulletImg || !cannonBulletImg.complete) return;

  for (const b of activeCannonballs) {
    if (b.exploding) {
      // simpele explosie tekenen
      const t = Math.min(1, b.explodeTime / 400);
      const maxR = b.radius * 2.5;
      const r = b.radius + (maxR - b.radius) * t;

      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffcc00";
      ctx.fillStyle = "rgba(255,120,0," + (1 - t) + ")";
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      continue;
    }

    const size = b.radius * 2;
    ctx.drawImage(
      cannonBulletImg,
      b.x - size / 2,
      b.y - size / 2,
      size,
      size
    );
  }
}

// ─────────────────────────────────────────────
// HUD CANNONS (alleen tekenen, niet geschaald)
// ─────────────────────────────────────────────
function drawCannonsHUD() {
  if (!isAdvancedLevel()) return;   // ✅ level 2 + 3
  if (!cannonImg || !cannonImg.complete) return;

  for (const key of ["left", "right"]) {
    const c = cannonHUD[key];
    const w = cannonImg.width  * c.scale;
    const h = cannonImg.height * c.scale;

    ctx.drawImage(
      cannonImg,
      c.x - w / 2,
      c.y,
      w,
      h
    );
  }
}




// ─────────────────────────────────────────────
// CANNON BULLET SPAWN (in maze)
// ─────────────────────────────────────────────
function spawnCannonballFromLane(side) {
  const laneCol =
    side === "left"
      ? CANNON_LANE_LEFT_COL
      : CANNON_LANE_RIGHT_COL;

  const laneCenter = tileCenter(laneCol, 0);

  activeCannonballs.push({
    x: laneCenter.x
        + (side === "left" ? CANNON_LANE_LEFT_OFFSET_PX : CANNON_LANE_RIGHT_OFFSET_PX),
    y: CANNON_BULLET_START_Y, // 🔥 pixel-positie
    vy: 6,
    radius: 40,
    exploding: false,
    explodeTime: 0
  });

  cannonShootSound.currentTime = 0;
  cannonShootSound.play().catch(() => {});
}



// ─────────────────────────────────────────────
// PACMAN DEATH STRALEN (los effect, correct)
// ─────────────────────────────────────────────
function drawPacmanDeathRays(local) {
  const rays = 16;
  const maxRadius = TILE_SIZE * pacmanScale * 1.6;
  const innerRadius = maxRadius * 0.3;
  const outerRadius = innerRadius + (maxRadius - innerRadius) * local;

  ctx.save();
  ctx.strokeStyle = "#f4a428";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1 - (local * 0.7);

  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI * 2 * i) / rays;

    const x1 = Math.cos(angle) * innerRadius;
    const y1 = Math.sin(angle) * innerRadius;
    const x2 = Math.cos(angle) * outerRadius;
    const y2 = Math.sin(angle) * outerRadius;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
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

function drawOneUpText() {
  if (!oneUpTextActive) return;

  const text = "1 UP";

  ctx.save();

  // zelfde stijl als READY / WOW
  ctx.font = "bold 72px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const x = canvas.width / 2;
  const y = canvas.height / 2;

  // zwarte outline
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000000";
  ctx.strokeText(text, x, y);

  // gele fill
  ctx.fillStyle = "#ffff00";
  ctx.fillText(text, x, y);

  ctx.restore();
}


function drawGameOverText() {
  if (!gameOver) return;

  ctx.save();

  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  ctx.fillStyle   = "#ff0000";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth   = 6;
  ctx.font = "bold 90px 'Courier New', monospace";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx = (COLS * TILE_SIZE) / 2 + 140; 
  const cy = (ROWS * TILE_SIZE) / 2;

  ctx.strokeText("GAME OVER", cx, cy);
  ctx.fillText("GAME OVER", cx, cy);

  ctx.restore();
}

const FRAME_TIME = 1000 / 60; // ≈ 16.67 ms

function loop() {
  // ─────────────────────────────────────────────
  // UPDATE-FASE
  // ─────────────────────────────────────────────
  if (gameRunning && !isDying) {
    gameTime += FRAME_TIME;

    powerDotPhase += POWER_DOT_BLINK_SPEED;
    coinPulsePhase += 0.04;

    // --- FRIGHTENED TIMER UPDATE ---
    if (frightTimer > 0) {
      frightTimer -= FRAME_TIME;

      if (frightTimer <= FRIGHT_FLASH_MS) frightFlash = true;

      if (frightTimer <= 0) {
        frightTimer = 0;
        frightFlash = false;

        ghosts.forEach((g) => {
          if (g.mode === GHOST_MODE_FRIGHTENED) {
            g.mode  = globalGhostMode;
            g.speed = SPEED_CONFIG.ghostSpeed;
          }
        });
      }
    }

    updateGhostGlobalMode(FRAME_TIME);

    // --- CORE UPDATES ---
    updatePlayer();
    updateGhosts();

    // ✅ SPIKY BALL UPDATE + GHOST COLLISION (LEVEL 3)
    if (typeof currentLevel !== "undefined" && currentLevel === 3) {
      updateSpikyBall?.();
      handleGhostSpikyBallCollision?.();
    }

    checkCollision();
    updateFloatingScores(FRAME_TIME);

    // --- LEVEL 2 + 3 CANNONS UPDATE ---
    if (isAdvancedLevel() && typeof updateCannons === "function") {
      updateCannons(FRAME_TIME);
    }

    // --- WOW 4-GHOST BONUS TIMER ---
    if (wowBonusActive) {
      wowBonusTimer -= FRAME_TIME;

      if (wowBonusTimer <= 0) {
        wowBonusTimer = 0;
        wowBonusActive = false;
        if (typeof startCoinBonus === "function") startCoinBonus();
      }
    }

    // ✅ --- 1 UP POPUP TIMER (STAP 7) ---
    if (oneUpTextActive) {
      oneUpTimer -= FRAME_TIME;
      if (oneUpTimer <= 0) {
        oneUpTimer = 0;
        oneUpTextActive = false;
      }
    }

    // --- COIN BONUS UPDATE ---
    if (coinBonusActive && typeof updateCoins === "function") {
      updateCoins(FRAME_TIME);
    }

    updateEyesSound?.();
    updateFrightSound?.();
    updateSirenSound?.();

    frame++;

  } else if (isDying) {
    // ─────────────────────────────────────────────
    // DEATH ANIMATIE UPDATE
    // ─────────────────────────────────────────────
    updateDeathAnimation?.(FRAME_TIME);

  } else {
    // ─────────────────────────────────────────────
    // GAME STIL → SOUNDS UIT
    // ─────────────────────────────────────────────
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

    stopAllSirens?.();
  }

  // ─────────────────────────────────────────────
  // TEKEN-FASE
  // ─────────────────────────────────────────────

  drawMazeBackground();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ─────────────────────────────────────────────
  // MAZE-LAYER (GESCHAALD)
  // ─────────────────────────────────────────────
  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  drawDots();

  // 🍒🍓🍌 FRUIT IN MAZE
  drawCherry?.();
  drawStrawberry?.();
  drawBanana?.();

  // 🍐 Peer (LEVEL 3 ONLY)
  if (typeof currentLevel !== "undefined" && currentLevel === 3) {
    drawPear?.();
  }

  // ✅ Spiky rolling ball (LEVEL 3 ONLY)
  if (typeof currentLevel !== "undefined" && currentLevel === 3) {
    drawSpikyBall?.();
  }

  drawPlayer();
  drawGhosts();

  drawFloatingScores();

  if (isAdvancedLevel()) {
    drawCannonProjectiles?.();
  }

  if (coinBonusActive) {
    drawCoins?.();
  }

  drawWowBonusText?.();
  drawReadyText?.();
  drawOneUpText();

  if (gameOver && !isDying) {
    drawGameOverText?.();
  }

  ctx.restore();

  // ─────────────────────────────────────────────
  // HUD-LAYER (NIET GESCHAALD)
  // ─────────────────────────────────────────────
drawCherryIcon?.();
drawStrawberryIcon?.();
drawBananaIcon?.();

// 🍐 Peer HUD (altijd zichtbaar)
if (typeof drawPearIcon === "function") {
  drawPearIcon();
}

// 🟦 Bitty Bonus HUD
if (typeof drawBittyBonusIcon === "function") {
  drawBittyBonusIcon();
}

// ✅ Cannon HUD (level 2 + 3)
if (isAdvancedLevel()) {
  drawCannonsHUD?.();
}

drawElectricBarrierOverlay();


// ─────────────────────────────────────────────
// HUD-CANVAS (FULLSCREEN OVERLAY)
// ─────────────────────────────────────────────
if (hudCtx && highscoreConfig.enabled) {

  // eerst WISSEN
  hudCtx.clearRect(0, 0, hudW, hudH);

  // dan HIGHSCORE PANEEL
  drawScaledBittyHighscoreHUD(hudCtx, highscoreConfig);

  // ✅ DAN PAS LIVES (boven paneel)
  drawLifeIcons();
}

requestAnimationFrame(loop);
}




function startNewGame() {
  score = 0;
  lives = 3;
  scoreEl.textContent = score;
  livesEl.textContent = lives;

  // Nieuwe game begint altijd op level 1
  currentLevel = 1;
  readyLabel   = "GET READY!";

  // Snelheden terug naar level 1
  if (typeof applySpeedsForLevel === "function") {
    applySpeedsForLevel();
  }

  roundStarted = false;
  gameOver     = false;
  gameRunning  = false; // wordt pas true NA getready.mp3

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

  // 🔄 kersen- / aardbei- / banaan-systeem resetten bij nieuwe game
  if (typeof cherry !== "undefined") {
    cherry = null;
  }
  if (typeof cherriesSpawned !== "undefined") {
    cherriesSpawned = 0;
  }

  if (typeof strawberry !== "undefined") {
    strawberry = null;
  }
  if (typeof strawberriesSpawned !== "undefined") {
    strawberriesSpawned = 0;
  }

  // 🍌 banaan reset
  if (typeof banana !== "undefined") {
    banana = null;
  }
  if (typeof bananasSpawned !== "undefined") {
    bananasSpawned = 0;
  }

  // 🍐 peer reset
  if (typeof pear !== "undefined") {
    pear = null;
  }
  if (typeof pearsSpawned !== "undefined") {
    pearsSpawned = 0;
  }

  if (typeof dotsEaten !== "undefined") {
    dotsEaten = 0;
  }

  // 🔄 level 2 cannon-systeem resetten
  // ✅ nieuw schaalbaar wavesysteem resetten
  if (typeof cannonWaveTriggered !== "undefined") {
    cannonWaveTriggered = [];
  }

  // ✅ alle geplande cannon spawns stoppen (belangrijk bij nieuwe game)
  if (typeof cannonWaveTimeoutIds !== "undefined" && Array.isArray(cannonWaveTimeoutIds)) {
    cannonWaveTimeoutIds.forEach(id => clearTimeout(id));
    cannonWaveTimeoutIds.length = 0;
  }

  // (oud systeem mag blijven staan; breekt niks)
  if (typeof cannonWave1Triggered !== "undefined") {
    cannonWave1Triggered = false;
  }
  if (typeof cannonWave2Triggered !== "undefined") {
    cannonWave2Triggered = false;
  }
  if (typeof cannonWave3Triggered !== "undefined") {
    cannonWave3Triggered = false;
  }

  if (typeof activeCannonballs !== "undefined" && Array.isArray(activeCannonballs)) {
    activeCannonballs.length = 0;
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


// Eerste init
resetEntities();
startIntro();
updateBittyPanel();   // ⬅️ overlay direct goed zetten
loop();
