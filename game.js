// Bitty Pacman – dot-baan uit MAZE, alles weer geschaald met pathScale

// ---------------------------------------------------------------------------
// CANVASSEN
// ---------------------------------------------------------------------------

const mazeCanvas = document.getElementById("mazeCanvas");
const mazeCtx = mazeCanvas.getContext("2d");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 32;

// --- SPEED CONFIG (Google Pacman verhoudingen) ---
const SPEED_CONFIG = {
  // Jouw huidige Pacman-snelheid (in pixels per frame)
  playerSpeed: 2,

  // Ghost is in Google ~0.75/0.80 zo snel als Pacman
  ghostSpeed:       2 * (0.75 / 0.80), // ≈ 1.875

  // Tunnel: 0.40/0.80 van Pacman
  ghostTunnelSpeed: 2 * (0.40 / 0.80), // = 1.0

  // Frightened: 0.50/0.80 van Pacman
  ghostFrightSpeed: 2 * (0.50 / 0.80), // = 1.25
};

// --- GHOST MODES & SCHEMA (Google-achtig) ---
const GHOST_MODE_SCATTER    = 0;
const GHOST_MODE_CHASE      = 1;
const GHOST_MODE_FRIGHTENED = 2;
const GHOST_MODE_EATEN      = 3;
const GHOST_MODE_IN_PEN     = 4;
const GHOST_MODE_LEAVING    = 5;

// Klassiek Pacman-schema (level 1):
// 7s scatter, 20s chase, 7s scatter, 20s chase,
// 5s scatter, 20s chase, 5s scatter, dan eindeloos chase.
const GHOST_MODE_SEQUENCE = [
  { mode: GHOST_MODE_SCATTER, durationMs:  7 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs: 20 * 1000 },
  { mode: GHOST_MODE_SCATTER, durationMs:  7 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs: 20 * 1000 },
  { mode: GHOST_MODE_SCATTER, durationMs:  5 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs: 20 * 1000 },
  { mode: GHOST_MODE_SCATTER, durationMs:  5 * 1000 },
  { mode: GHOST_MODE_CHASE,   durationMs:  Infinity }, // laatste fase: alleen nog chase
];

// Globale mode-status
let globalGhostMode      = GHOST_MODE_SCATTER;
let ghostModeIndex       = 0;
let ghostModeElapsedTime = 0;


// DOT GROOTTES (UNIFORM)
const DOT_RADIUS = 3;      // gewone dots
const POWER_RADIUS = 3;    // power-dots nu dezelfde grootte

// Clyde schakelt naar corner als hij binnen deze afstand is (in tiles)
const CLYDE_SCATTER_DISTANCE_TILES = 8;
const CLYDE_SCATTER_DISTANCE2 = CLYDE_SCATTER_DISTANCE_TILES * CLYDE_SCATTER_DISTANCE_TILES;


// ---------------------------------------------------------------------------
// MAZE – 28 kolommen, 29 rijen. # = muur, . = dot, O = power-dot, P/G starts
// ---------------------------------------------------------------------------

const MAZE = [
  "#..........................#",
  "#.####.##.#####.#####.####.#",
  "#.####.##.#####.#####.####.#",
  "#.####.##..###...###..####.#",
  "#.####.##..###...###...###.#",
  "#.####.##..###...###...###.#",
  "#..........................#",
  "#..........................#",
  "######.####.####.####.######",
  "######.####.####.####.######",
  "######.##..........##.######",
  "######.##.####X###.##.######", // nieuwe rij 11 → 1 gaatje in het midden
  "######.##.####X###.##.######", // nieuwe rij 12 → zelfde gaatje
  "..........##GGG###..........",
  "######.##.##XGXX##.##.######",
  "######.##.########.##.######",
  "######.##..........##.######",
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
  "#............P.............#",
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
eatSound.loop = true;
eatSound.volume = 0.35;



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

let gameTime = 0; // ms sinds start / laatste reset

// SCALES
let pacmanScale = 1.6;   // standaard 1.4 → iets groter
let ghostScale  = 1.6;   // standaard 1.2 → iets groter

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

// ---------------------------------------------------------------------------
// MAZE helpers
// ---------------------------------------------------------------------------

let currentMaze = MAZE.slice(); // voor zichtbare dots

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
  let gh = null;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === "P") pac = { c, r };
      if (MAZE[r][c] === "G") gh = { c, r };
    }
  }
  return { pac, gh };
}

const { pac, gh } = findPositions();
const startGhostTile = gh;

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

const ghosts = [
  {
    id: 1, // Blinky – rechtsboven hoek
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 0,
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 26, r: 1 },     // top-right corner ('.' in je maze)
    targetTile:  { c: pac.c, r: pac.r },
  },
  {
    id: 2, // Pinky – linksboven hoek
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 3000,
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 1, r: 1 },      // top-left corner
    targetTile:  { c: pac.c, r: pac.r },
  },
  {
    id: 3, // Inky – rechtsonder hoek
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 6000,
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 26, r: 27 },    // bottom-right corner
    targetTile:  { c: pac.c, r: pac.r },
  },
  {
    id: 4, // Clyde – linksonder hoek
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: SPEED_CONFIG.ghostSpeed,
    released: false,
    releaseTime: 9000,
    hasExitedBox: false,
    mode: GHOST_MODE_SCATTER,
    scatterTile: { c: 1, r: 27 },     // bottom-left corner
    targetTile:  { c: pac.c, r: pac.r },
  },
];


// --- RESET VAN PACMAN & ALLE GHOSTS ---
function resetEntities() {
  currentMaze = MAZE.slice();

  // Pacman terug naar start
  player.x = tileCenter(pac.c, pac.r).x;
  player.y = tileCenter(pac.c, pac.r).y;
  player.dir     = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
  player.speed   = SPEED_CONFIG.playerSpeed;

  // Globale ghost-modes resetten
  globalGhostMode      = GHOST_MODE_SCATTER;
  ghostModeIndex       = 0;
  ghostModeElapsedTime = 0;

  // Ghosts terug naar start
  ghosts.forEach((g) => {
    g.x = tileCenter(gh.c, gh.r).x;
    g.y = tileCenter(gh.c, gh.r).y;
    g.dir = { x: 0, y: -1 };
    g.released = false;
    g.hasExitedBox = false;
    g.speed = SPEED_CONFIG.ghostSpeed;
    g.mode  = GHOST_MODE_SCATTER;

    // releaseTimes behouden (op basis van id)
    if (g.id === 1) g.releaseTime = 0;
    if (g.id === 2) g.releaseTime = 3000;
    if (g.id === 3) g.releaseTime = 6000;
    if (g.id === 4) g.releaseTime = 9000;

    // targetTile initialiseren naar eigen scatter-hoek
    if (g.scatterTile) {
      g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
    }
  });

  gameTime = 0;
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

function updatePlayer() {
  // vorige positie onthouden (voor isMoving)
  const prevX = player.x;
  const prevY = player.y;

  // Richting wisselen als dat kan
  if (player.nextDir.x !== player.dir.x || player.nextDir.y !== player.dir.y) {
    if (canMove(player, player.nextDir)) {
      player.dir = { ...player.nextDir };
    }
  }

  // Bewegen
  if (canMove(player, player.dir)) {
    player.x += player.dir.x * player.speed;
    player.y += player.dir.y * player.speed;
  }

  // heeft hij deze frame echt bewogen?
  player.isMoving = (player.x !== prevX || player.y !== prevY);

  snapToCenter(player);
  applyPortal(player);

  // Eet-timer aftellen (~60 fps ≈ 16.67 ms)
  if (eatingTimer > 0) {
    eatingTimer -= 16.67;
    if (eatingTimer < 0) eatingTimer = 0;
  }

  const c  = Math.round(player.x / TILE_SIZE - 0.5);
  const r  = Math.round(player.y / TILE_SIZE - 0.5);
  const ch = getTile(c, r);

  // DOT / POWER DOT eten
  if (ch === "." || ch === "O") {
    setTile(c, r, " ");
    score += (ch === "O" ? SCORE_POWER : SCORE_DOT);
    scoreEl.textContent = score;

    // Pacman gaat in eet-modus voor korte tijd
    eatingTimer = EATING_DURATION;
  }

  // ─────────────────────────────────────────────
  // Mond-snelheid + geluid afhankelijk van state
  // ─────────────────────────────────────────────
  const moving = player.isMoving; // <-- gebruik echte beweging

  if (eatingTimer > 0) {
    // DOTS AAN HET ETEN → snelle mond + geluid
    mouthSpeed = 0.30;

    if (eatSound.paused) {
      eatSound.currentTime = 0;
      eatSound.play().catch(() => {
        // sommige browsers blokkeren geluid zonder user interactie
      });
    }
  } else {
    // NIET AAN HET ETEN → geluid uit
    if (!eatSound.paused) {
      eatSound.pause();
    }

    // mond beweegt langzaam als hij beweegt, staat stil als hij stilstaat
    mouthSpeed = moving ? 0.08 : 0.0;
  }
}

function setGhostTarget(g) {
  // FRIGHTENED / EATEN / IN_PEN gebruiken we later anders;
  // voor nu: alleen SCATTER & CHASE krijgen een target.
  if (g.mode !== GHOST_MODE_SCATTER && g.mode !== GHOST_MODE_CHASE) {
    g.targetTile = null;
    return;
  }

  // Pacman-tile en richting
  const playerC = Math.round(player.x / TILE_SIZE - 0.5);
  const playerR = Math.round(player.y / TILE_SIZE - 0.5);
  const dir = player.dir;

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

    // Als Pacman omhoog kijkt: 4 tiles extra naar links
    if (dir.y === -1) {
      tx -= 4;
    }

    g.targetTile = { c: tx, r: ty };
    return;
  }

  // 3) Inky – 2 tiles voor Pacman, dan vector vanaf Blinky verdubbelen
  if (g.id === 3) {
    // Blinky zoeken
    const blinky = ghosts.find(gg => gg.id === 1) || g;

    const blC = Math.round(blinky.x / TILE_SIZE - 0.5);
    const blR = Math.round(blinky.y / TILE_SIZE - 0.5);

    // Punt 2 tiles voor Pacman
    let px2 = playerC + 2 * dir.x;
    let py2 = playerR + 2 * dir.y;

    if (dir.y === -1) {
      px2 -= 2; // dezelfde bug in kleinere versie
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
      // ver → Pacman
      g.targetTile = { c: playerC, r: playerR };
    } else {
      // dichtbij → eigen hoek
      if (g.scatterTile) {
        g.targetTile = { c: g.scatterTile.c, r: g.scatterTile.r };
      } else {
        g.targetTile = { c: playerC, r: playerR }; // fallback
      }
    }
    return;
  }

  // Fallback: als id onbekend, gewoon Pacman
  g.targetTile = { c: playerC, r: playerR };
}


function updateOneGhost(g) {
  // Eerst: current tile & midden
  const c = Math.round(g.x / TILE_SIZE - 0.5);
  const r = Math.round(g.y / TILE_SIZE - 0.5);
  const mid = tileCenter(c, r);
  const dist = Math.hypot(g.x - mid.x, g.y - mid.y);

  // Doel-tile instellen obv mode + ghost-type
  setGhostTarget(g);

  // Mogelijke richtingen
  const dirs = [
    { x:  1, y:  0 }, // rechts
    { x: -1, y:  0 }, // links
    { x:  0, y:  1 }, // omlaag
    { x:  0, y: -1 }, // omhoog
  ];

  // Alleen nieuwe richting kiezen als we in het midden van een tile zitten
  if (dist < 1) {
    // Niet direct omdraaien (geen reverse)
    const nonRev = dirs.filter(d => !(d.x === -g.dir.x && d.y === -g.dir.y));

    function canStep(d) {
      const nc = c + d.x;
      const nr = r + d.y;

      // Geen muren
      if (isWall(nc, nr)) return false;

      // Niet terug de ghost-box in zodra hij eruit is
      if (g.hasExitedBox && nr >= startGhostTile.row) {
        return false;
      }

      return true;
    }

    // Eerst opties zonder reverse
    let opts = nonRev.filter(canStep);

    // Als dat niks oplevert, dan alle richtingen proberen
    if (opts.length === 0) {
      opts = dirs.filter(canStep);
    }

    if (opts.length) {
      let chosen;

      // Voor nu: alleen SCATTER/CHASE hebben een target.
      // Andere modes (FRIGHTENED/EATEN) kiezen random.
      if (!g.targetTile || (g.mode !== GHOST_MODE_SCATTER && g.mode !== GHOST_MODE_CHASE)) {
        chosen = opts[Math.floor(Math.random() * opts.length)];
      } else {
        const tx = g.targetTile.c;
        const ty = g.targetTile.r;

        // Voorkeursvolgorde zoals klassieke Pacman: Up, Left, Down, Right
        const prefOrder = [
          { x: 0,  y: -1 }, // up
          { x: -1, y: 0 },  // left
          { x: 0,  y: 1 },  // down
          { x: 1,  y: 0 },  // right
        ];

        let best = null;
        let bestDist2 = Infinity;

        for (const pref of prefOrder) {
          const option = opts.find(d => d.x === pref.x && d.y === pref.y);
          if (!option) continue;

          const nc = c + option.x;
          const nr = r + option.y;
          const dx = tx - nc;
          const dy = ty - nr;
          const d2 = dx * dx + dy * dy;

          if (d2 < bestDist2) {
            bestDist2 = d2;
            best = option;
          }
        }

        chosen = best || opts[0];
      }

      g.dir = chosen;
      // Netjes centreren op de tile voordat we verder gaan
      g.x = mid.x;
      g.y = mid.y;
    }
  }

  // Ghost verplaatsen met zijn huidige snelheid (uit SPEED_CONFIG.ghostSpeed)
  const speed = g.speed;

  if (canMove(g, g.dir)) {
    g.x += g.dir.x * speed;
    g.y += g.dir.y * speed;
  }

  // Center correctie & portals toepassen
  snapToCenter(g);
  applyPortal(g);

  // Markeren dat hij definitief uit de box is
  const tileRow = Math.round(g.y / TILE_SIZE - 0.5);
  if (!g.hasExitedBox && tileRow < startGhostTile.row) {
    g.hasExitedBox = true;
  }
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


// ---------------------------------------------------------------------------
// COLLISION
// ---------------------------------------------------------------------------

function checkCollision() {
  const hit = ghosts.some((g) =>
    g.released &&
    Math.hypot(player.x - g.x, player.y - g.y) < TILE_SIZE * 0.6
  );

  if (hit) {
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
  ctx.fillStyle = "#ffb8ae";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = getTile(c, r);
      if (t === "." || t === "O") {
        const x = c * TILE_SIZE + TILE_SIZE / 2;
        const y = r * TILE_SIZE + TILE_SIZE / 2;
        const rad = (t === "O" ? POWER_RADIUS : DOT_RADIUS);

        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PLAYER & GHOST DRAW
// ---------------------------------------------------------------------------




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

function drawGhosts() {
  const size = TILE_SIZE * ghostScale;

  ghosts.forEach((g) => {
    ctx.save();
    ctx.translate(g.x, g.y);

    let img = ghost1Img;
    if (g.id === 2) img = ghost2Img;
    if (g.id === 3) img = ghost3Img;
    if (g.id === 4) img = ghost4Img;

    if (img.complete) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }

    ctx.restore();
  });
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
// GAME LOOP
// ---------------------------------------------------------------------------
const FRAME_TIME = 1000 / 60; // ≈ 16.67 ms

function loop() {
  if (gameRunning) {
    gameTime += FRAME_TIME; // voor je eigen timing (als je die nog gebruikt)

    // NIEUW: scatter/chase-mode timer
    updateGhostGlobalMode(FRAME_TIME);

    updatePlayer();
    updateGhosts();
    checkCollision();
    frame++;
  }

  drawMazeBackground();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScaleX, pathScaleY);

  drawDots();
  drawPlayer();
  drawGhosts();

  ctx.restore();

  drawElectricBarrierOverlay();

  requestAnimationFrame(loop);
}


function startNewGame() {
  score = 0;
  lives = 3;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  gameOver = false;
  gameRunning = true;
  resetEntities();
  messageEl.classList.add("hidden");
}

resetEntities();
loop();










