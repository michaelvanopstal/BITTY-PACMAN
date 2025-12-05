// Bitty Pacman – dot-baan uit MAZE, alles weer geschaald met pathScale

// ---------------------------------------------------------------------------
// CANVASSEN
// ---------------------------------------------------------------------------

const mazeCanvas = document.getElementById("mazeCanvas");
const mazeCtx = mazeCanvas.getContext("2d");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 32;

// DOT GROOTTES (UNIFORM)
const DOT_RADIUS = 3;      // gewone dots
const POWER_RADIUS = 3;    // power-dots nu dezelfde grootte

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

// PACMAN SPRITESHEET (3 kolommen × 4 rijen)
const pacmanSheet = new Image();
pacmanSheet.src = "pacmansheet.png";
let pacmanSheetLoaded = false;
pacmanSheet.onload = () => pacmanSheetLoaded = true;

const PACMAN_COLS = 3;
const PACMAN_ROWS = 4;

// animatie-state
let pacmanFrame = 2;                  // start: dicht rondje
let pacmanAnimCounter = 0;
let lastMoveDir = { x: 1, y: 0 };     // laatst bewogen richting (default rechts)

// simpele eet-sound: één tik per dot
const eatSound = new Audio("pacmaneatingdots.mp3");
eatSound.volume = 0.35;


const PACMAN_COLS = 3;
const PACMAN_ROWS = 4;

// animatie-state
let pacmanFrame = 2;                  // start: dicht rondje
let pacmanAnimCounter = 0;
let lastMoveDir = { x: 1, y: 0 };     // laatst bewogen richting (default rechts)

// simpele eet-sound: één tik per dot
const eatSound = new Audio("pacmaneatingdots.mp3");
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

// PLAYER
const player = {
  x: tileCenter(pac.c, pac.r).x,
  y: tileCenter(pac.c, pac.r).y,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  speed: 2,
};

// 4 GHOSTS MET RELEASE-TIMERS & EXIT-FLAG
const ghosts = [
  {
    id: 1,
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: 1.5,
    released: false,
    releaseTime: 0,
    hasExitedBox: false,
  },
  {
    id: 2,
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: 1.5,
    released: false,
    releaseTime: 3000,
    hasExitedBox: false,
  },
  {
    id: 3,
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: 1.5,
    released: false,
    releaseTime: 6000,
    hasExitedBox: false,
  },
  {
    id: 4,
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: 1.5,
    released: false,
    releaseTime: 9000,
    hasExitedBox: false,
  },
];

// RESET VAN PACMAN & ALLE GHOSTS
function resetEntities() {
  currentMaze = MAZE.slice();

  player.x = tileCenter(pac.c, pac.r).x;
  player.y = tileCenter(pac.c, pac.r).y;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };

  ghosts.forEach((g) => {
    g.x = tileCenter(gh.c, gh.r).x;
    g.y = tileCenter(gh.c, gh.r).y;
    g.dir = { x: 0, y: -1 };
    g.released = false;
    g.hasExitedBox = false;
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

  snapToCenter(player);
  applyPortal(player);

  // Tile onder Pacman
  const c  = Math.round(player.x / TILE_SIZE - 0.5);
  const r  = Math.round(player.y / TILE_SIZE - 0.5);
  const ch = getTile(c, r);

  // DOT / POWER DOT eten
  if (ch === "." || ch === "O") {
    setTile(c, r, " ");
    score += (ch === "O" ? SCORE_POWER : SCORE_DOT);
    scoreEl.textContent = score;

    // korte 'hap'-sound
    try {
      eatSound.currentTime = 0;
      eatSound.play();
    } catch (e) {
      // sommige browsers blokkeren auto-play, is oké
    }
  }

  // ─────────────────────────────────────────────
  // Pacman sprite-animatie op basis van beweging
  // ─────────────────────────────────────────────
  const moving = (player.dir.x !== 0 || player.dir.y !== 0);

  if (moving) {
    // richting onthouden
    lastMoveDir = { x: player.dir.x, y: player.dir.y };

    pacmanAnimCounter++;
    if (pacmanAnimCounter >= 6) {   // animatiesnelheid (lager = sneller)
      pacmanAnimCounter = 0;
      pacmanFrame = (pacmanFrame + 1) % PACMAN_COLS; // 0 → 1 → 2 → 0
    }
  } else {
    // stilstaan: dicht rondje
    pacmanFrame = 2;
    pacmanAnimCounter = 0;
  }
}

// ---------------------------------------------------------------------------
// GHOSTS
// ---------------------------------------------------------------------------

function updateOneGhost(g) {
  const c = Math.round(g.x / TILE_SIZE - 0.5);
  const r = Math.round(g.y / TILE_SIZE - 0.5);
  const mid = tileCenter(c, r);
  const dist = Math.hypot(g.x - mid.x, g.y - mid.y);

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

      if (isWall(nc, nr)) return false;

      if (g.hasExitedBox && nr >= startGhostTile.row) {
        return false;
      }

      return true;
    }

    let opts = nonRev.filter(canStep);

    if (opts.length === 0) {
      opts = dirs.filter(canStep);
    }

    if (opts.length) {
      g.dir = opts[Math.floor(Math.random() * opts.length)];
      g.x = mid.x;
      g.y = mid.y;
    }
  }

  if (canMove(g, g.dir)) {
    g.x += g.dir.x * g.speed;
    g.y += g.dir.y * g.speed;
  }

  snapToCenter(g);
  applyPortal(g);


  const tileRow = Math.round(g.y / TILE_SIZE - 0.5);
  if (!g.hasExitedBox && tileRow < startGhostTile.row) {
    g.hasExitedBox = true;
  }
}

function updateGhosts() {
  ghosts.forEach((g) => {
    if (!g.released) {
      if (gameTime >= g.releaseTime) {
        g.released = true;
      } else {
        return;
      }
    }

    updateOneGhost(g);
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
  const size = TILE_SIZE * pacmanScale;

  // sprite-afmetingen in de sheet
  const frameW = pacmanSheet.width / PACMAN_COLS;
  const frameH = pacmanSheet.height / PACMAN_ROWS;

  // bepaal welke rij (richting) we gebruiken
  // rij 0 = rechts, 1 = links, 2 = omlaag, 3 = omhoog
  let rowIndex = 0; // default: rechts

  if (lastMoveDir.x < 0) {
    rowIndex = 1; // links
  } else if (lastMoveDir.y > 0) {
    rowIndex = 2; // omlaag
  } else if (lastMoveDir.y < 0) {
    rowIndex = 3; // omhoog
  }

  const colIndex = pacmanFrame; // 0, 1, 2

  const sx = colIndex * frameW;
  const sy = rowIndex * frameH;

  ctx.save();
  ctx.translate(player.x, player.y);

  if (pacmanSheetLoaded) {
    ctx.drawImage(
      pacmanSheet,
      sx, sy, frameW, frameH,   // bron in de sheet
      -size / 2, -size / 2,     // gecentreerd op speler
      size, size                // schaal naar TILE_SIZE * pacmanScale
    );
  } else {
    // fallback: simpel geel rondje als sheet nog laadt
    ctx.fillStyle = "#f4a428";
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();
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

function loop() {
  if (gameRunning) {
    gameTime += 16.67; // ~60 FPS

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

  // ⚡ Elektriciteit als overlay in px, boven alles
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










