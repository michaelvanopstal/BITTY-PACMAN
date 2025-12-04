// Bitty Pacman – DOT-SYSTEM PERFECT UITGELIJND
// Pacman & ghosts volgen MAZE-baan, alle dots 100% uniform & éénvoudig

// ---------------------------------------------------------------------------
// CANVASSEN
// ---------------------------------------------------------------------------

const mazeCanvas = document.getElementById("mazeCanvas");
const mazeCtx = mazeCanvas.getContext("2d");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 32;

// DOT GROOTTES (UNIFORM)
const DOT_RADIUS = 3;
const POWER_RADIUS = 6;

// ---------------------------------------------------------------------------
// MAZE – bepaalt ALLEEN de logische dot-baan, NIET de PNG
// ---------------------------------------------------------------------------

const MAZE = [
  "#.....O..O.##..O#....O.....#",
  "#.####.##.#####.#####.####.#",
  "######.##.#####.#####.######",
  "#.########################.#",
  "#.####O##O#####O#####O####.#",
  "#.####.##.#####.#####.####.#",
  "#.####.##.#####.#####.####.#",
  "#.....O..O.O#..O#.#..O##...#",
  "######.####.####.####.######",
  "######.####.####.####.######",
  "######.##O..###.O..##.######",
  "######.##.########.##.######",
  "######.##.########.##.######",
  ".###OOO..O#########..O##....",
  "######.##.########.##O######",
  "######.##.########.##O######",
  "######.###.G.##...O#########",
  "######.##.########.##.######",
  "######.##.########.##.######",
  "#........O...##...#........#",
  "#.####.#####.##.#####.####.#",
  "#.##########.##.#####.####.#",
  "##..##O...OO...O......##..##",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "##....O##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "##...##...#..P.#...##......#",
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
// SCHALING (alleen voor speler/ghosts, NIET voor dots)
// ---------------------------------------------------------------------------

let mazeScale = 1.0;
let mazeOffsetX = 0;
let mazeOffsetY = 0;

let pathScale = 0.83;
let pathOffsetX = 80;
let pathOffsetY = 60;

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

// DOM elementen
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const messageEl = document.getElementById("message");
const messageTextEl = document.getElementById("messageText");

// ---------------------------------------------------------------------------
// MAZE Helpers
// ---------------------------------------------------------------------------

let currentMaze = MAZE.slice(); // visuele dotlaag

function getTile(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return "#";
  return currentMaze[r][c];
}

function setTile(c, r, ch) {
  let row = currentMaze[r].split("");
  row[c] = ch;
  currentMaze[r] = row.join("");
}

// MAZE bepaalt de baan (PNG wordt NIET gebruikt voor logic)
function isWall(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;

  const t = MAZE[r][c];

  // Alleen "." "O" "P" "G" zijn pad
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

const ghost = {
  x: tileCenter(gh.c, gh.r).x,
  y: tileCenter(gh.c, gh.r).y,
  dir: { x: 0, y: -1 },
  speed: 1.5,
};

const ghost2 = {
  x: tileCenter(gh.c, gh.r).x,
  y: tileCenter(gh.c, gh.r).y,
  dir: { x: 0, y: 1 },
  speed: 1.5,
};

function resetEntities() {
  currentMaze = MAZE.slice();

  player.x = tileCenter(pac.c, pac.r).x;
  player.y = tileCenter(pac.c, pac.r).y;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };

  ghost.x = tileCenter(gh.c, gh.r).x;
  ghost.y = tileCenter(gh.c, gh.r).y;
  ghost.dir = { x: 0, y: -1 };

  ghost2.x = tileCenter(gh.c, gh.r).x;
  ghost2.y = tileCenter(gh.c, gh.r).y;
  ghost2.dir = { x: 0, y: 1 };
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

function updateGhost() { updateOneGhost(ghost); }
function updateGhost2() { updateOneGhost(ghost2); }

// ---------------------------------------------------------------------------
// COLLISION
// ---------------------------------------------------------------------------

function checkCollision() {
  const hit1 = Math.hypot(player.x - ghost.x, player.y - ghost.y) < TILE_SIZE * 0.6;
  const hit2 = Math.hypot(player.x - ghost2.x, player.y - ghost2.y) < TILE_SIZE * 0.6;

  if (hit1 || hit2) {
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
// DRAW DOTS (niet geschaald → perfecte uitlijning)
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
// DRAW PLAYER
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
// DRAW GHOSTS
// ---------------------------------------------------------------------------

const ghostImg = new Image();
ghostImg.src = "bitty-ghost.png";
let ghostLoaded = false;
ghostImg.onload = () => ghostLoaded = true;

const ghost2Img = new Image();
ghost2Img.src = "Beefcake-bitkey (1).png";
let ghost2Loaded = false;
ghost2Img.onload = () => ghost2Loaded = true;

function drawGhost() {
  const size = TILE_SIZE * 1.2;
  ctx.save();
  ctx.translate(ghost.x, ghost.y);
  if (ghostLoaded) ctx.drawImage(ghostImg, -size/2, -size/2, size, size);
  ctx.restore();
}

function drawGhost2() {
  const size = TILE_SIZE * 1.2;
  ctx.save();
  ctx.translate(ghost2.x, ghost2.y);
  if (ghost2Loaded) ctx.drawImage(ghost2Img, -size/2, -size/2, size, size);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// GAME LOOP
// ---------------------------------------------------------------------------

function loop() {
  if (gameRunning) {
    updatePlayer();
    updateGhost();
    updateGhost2();
    checkCollision();
    frame++;
  }

  drawMazeBackground();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // DOTS worden NIET geschaald → altijd perfect
  drawDots();

  // Speler & ghosts WEL geschaald
  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScale, pathScale);

  drawPlayer();
  drawGhost();
  drawGhost2();

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









