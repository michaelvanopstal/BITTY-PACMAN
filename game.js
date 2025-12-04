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
  "#.####.##.#####.#####.####.#",
  "#.####.##.#####.#####.####.#",
  "#.####.##.#####.#####.####.#",
  "#.####.##.#####.#####.####.#",
  "#..........................#",
  "######.####.####.####.######",
  "######.####.####.####.######",
  "######.##..........##.######",
  "######.##.####.###.##.######", // nieuwe rij 11 → 1 gaatje in het midden
  "######.##.####.###.##.######", // nieuwe rij 12 → zelfde gaatje
  "..........####G###..........",
  "######.##.########.##.######",
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
let ghostScale  = 1.4;   // standaard 1.2 → iets groter


const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const messageEl = document.getElementById("message");
const messageTextEl = document.getElementById("messageText");

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
  return !(t === "." || t === "O" || t === "P" || t === "G");
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

// ---------------------------------------------------------------------------
// ENTITIES
// ---------------------------------------------------------------------------

const player = {
  x: tileCenter(pac.c, pac.r).x,
  y: tileCenter(pac.c, pac.r).y,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  speed: 2,
};

const ghosts = [
  {
    id: 1,
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: 1.5,
    released: false,
    releaseTime: 0,      // direct
  },
  {
    id: 2,
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: 1.5,
    released: false,
    releaseTime: 3000,   // 3 sec
  },
  {
    id: 3,
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: 1.5,
    released: false,
    releaseTime: 6000,   // 6 sec
  },
  {
    id: 4,
    x: tileCenter(gh.c, gh.r).x,
    y: tileCenter(gh.c, gh.r).y,
    dir: { x: 0, y: -1 },
    speed: 1.5,
    released: false,
    releaseTime: 9000,   // 9 sec
  },
];


function resetEntities() {
  currentMaze = MAZE.slice();

  player.x = tileCenter(pac.c, pac.r).x;
  player.y = tileCenter(pac.c, pac.r).y;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };

    // alle ghosts terug in het hok
  ghosts.forEach((g, index) => {
    g.x = tileCenter(gh.c, gh.r).x;
    g.y = tileCenter(gh.c, gh.r).y;
    g.dir = { x: 0, y: -1 };
    g.released = false;
  });

  // klok opnieuw
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
  if (player.nextDir.x !== player.dir.x || player.nextDir.y !== player.dir.y) {
    if (canMove(player, player.nextDir)) {
      player.dir = { ...player.nextDir };
    }
  }

  if (canMove(player, player.dir)) {
    player.x += player.dir.x * player.speed;
    player.y += player.dir.y * player.speed;
  }

  snapToCenter(player);

  const c = Math.round(player.x / TILE_SIZE - 0.5);
  const r = Math.round(player.y / TILE_SIZE - 0.5);
  const ch = getTile(c, r);

  if (ch === "." || ch === "O") {
    setTile(c, r, " ");
    score += (ch === "O" ? SCORE_POWER : SCORE_DOT);
    scoreEl.textContent = score;
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
    let opts = nonRev.filter(d => !isWall(c + d.x, r + d.y));

    if (opts.length === 0) opts = dirs.filter(d => !isWall(c + d.x, r + d.y));

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
}

function updateGhosts() {
  ghosts.forEach((g) => {
    // nog niet vrij? check of het tijd is
    if (!g.released) {
      if (gameTime >= g.releaseTime) {
        g.released = true;
      } else {
        return; // deze ghost nog niet bewegen
      }
    }

    updateOneGhost(g);
  });
}


// ---------------------------------------------------------------------------
// COLLISION
// ---------------------------------------------------------------------------

function checkCollision() {
  // botsing alleen met ghosts die al released zijn
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
// PLAYER DRAW
// ---------------------------------------------------------------------------

const playerImg = new Image();
playerImg.src = "bittypacman.png";
let playerLoaded = false;
playerImg.onload = () => playerLoaded = true;

function drawPlayer() {
  const size = TILE_SIZE * 1.4;

  let ang = 0;
  if (player.dir.x < 0) ang = Math.PI;
  if (player.dir.y < 0) ang = -Math.PI / 2;
  if (player.dir.y > 0) ang = Math.PI / 2;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(ang);

  if (playerLoaded) {
    ctx.drawImage(playerImg, -size/2, -size/2, size, size);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// GHOST DRAW
// ---------------------------------------------------------------------------

// ---------------------------------------------
// GHOST IMAGES (4 sprites)
// ---------------------------------------------

const ghost1Img = new Image();
ghost1Img.src = "bitty-ghost.png";
let ghost1Loaded = false;
ghost1Img.onload = () => ghost1Loaded = true;

const ghost2Img = new Image();
ghost2Img.src = "Beefcake-bitkey (1).png";
let ghost2Loaded = false;
ghost2Img.onload = () => ghost2Loaded = true;

const ghost3Img = new Image();
ghost3Img.src = "Orange-man.png";   // NIEUWE SPRITE 1
let ghost3Loaded = false;
ghost3Img.onload = () => ghost3Loaded = true;

const ghost4Img = new Image();
ghost4Img.src = "Beholder.png";     // NIEUWE SPRITE 2
let ghost4Loaded = false;
ghost4Img.onload = () => ghost4Loaded = true;


// ---------------------------------------------
// TEKENEN VAN ALLE 4 GHOSTS
// ---------------------------------------------

function drawGhosts() {
 const size = TILE_SIZE * ghostScale;


  ghosts.forEach((g) => {
    ctx.save();
    ctx.translate(g.x, g.y);

    // Kies sprite per ID
    let img = ghost1Img;
    if (g.id === 2) img = ghost2Img;
    if (g.id === 3) img = ghost3Img;
    if (g.id === 4) img = ghost4Img;

    // Alleen tekenen als geladen
    if (img.complete) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }

    ctx.restore();
  });
}


function drawPlayer() {
  const size = TILE_SIZE * pacmanScale;
  const radius = size / 2;

  // Mond animatie teruggezet zoals jij het had
  const mouthOpen = (Math.sin(frame / 5) + 1) / 2;
  const maxMouth = Math.PI / 3;
  const mouthAngle = mouthOpen * maxMouth;

  // Richting bepalen
  let directionAngle = 0;
  if (player.dir.x > 0) directionAngle = 0;
  else if (player.dir.x < 0) directionAngle = Math.PI;
  else if (player.dir.y < 0) directionAngle = -Math.PI / 2;
  else if (player.dir.y > 0) directionAngle = Math.PI / 2;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(directionAngle);

  // Eerst Pacman sprite tekenen
  if (playerLoaded) {
    ctx.drawImage(playerImg, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#f4a428";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dan mond uitsnijden: ANIMATIE IS TERUG
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, -mouthAngle, mouthAngle);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
}

// ---------------------------------------------------------------------------
// GAME LOOP
// ---------------------------------------------------------------------------

function loop() {
  if (gameRunning) {
    gameTime += 16.67; // ~60 FPS

    updatePlayer();
    updateGhosts();   // nieuwe functie (straks)
    checkCollision();
    frame++;
  }


  // 1) achtergrond
  drawMazeBackground();

  // 2) game-layer
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

 ctx.save();
 ctx.translate(pathOffsetX, pathOffsetY);

// NIET meer 1 schaal, maar apart X en Y
ctx.scale(pathScaleX, pathScaleY);

drawDots();
drawPlayer();
drawGhosts();

ctx.restore();


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









