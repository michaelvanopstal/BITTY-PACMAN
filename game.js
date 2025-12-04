// Bitty Pacman - versie zonder muren, dot-baan bepaalt de route

// ---------------------------------------------------------------------------
// CANVASSEN
// ---------------------------------------------------------------------------

const mazeCanvas = document.getElementById("mazeCanvas");
const mazeCtx    = mazeCanvas.getContext("2d");

const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");

const TILE_SIZE = 32;

// ---------------------------------------------------------------------------
// MAZE (originele dot-layout wordt gebruikt als PAD, niet als muren)
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

const GAME_WIDTH  = COLS * TILE_SIZE;
const GAME_HEIGHT = ROWS * TILE_SIZE;

mazeCanvas.width  = GAME_WIDTH;
mazeCanvas.height = GAME_HEIGHT;
canvas.width      = GAME_WIDTH;
canvas.height     = GAME_HEIGHT;

// ---------------------------------------------------------------------------
// SCHALING
// ---------------------------------------------------------------------------

let mazeScale   = 1.0;
let mazeOffsetX = 0;
let mazeOffsetY = 0;

let pathScale   = 0.83;
let pathOffsetX = 80;
let pathOffsetY = 60;

// ---------------------------------------------------------------------------
// SCORE & STATE
// ---------------------------------------------------------------------------

const SCORE_DOT = 10;
const SCORE_POWER = 50;

let score = 0;
let lives = 3;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const messageEl = document.getElementById("message");
const messageTextEl = document.getElementById("messageText");

let gameRunning = true;
let gameOver = false;
let frame = 0;

// ---------------------------------------------------------------------------
// MAZE HELPERS
// ---------------------------------------------------------------------------

// MAZE bepaalt PAD, currentMaze bepaalt VISUEEL (stippen wegvreten)
let currentMaze = MAZE.slice();

function getTile(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return "#";
  return currentMaze[row][col];
}

function setTile(col, row, ch) {
  const chars = currentMaze[row].split("");
  chars[col] = ch;
  currentMaze[row] = chars.join("");
}

// ⭐⭐ BELANGRIJK: GEEN MUREN MEER ⭐⭐
// Pacman mag alleen lopen op tiles die IN DE ORIGINELE MAZE pad waren
// Dus: '.' , 'O', 'P', 'G', of een lege ruimte
function isWall(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;

  const t = MAZE[row][col];

  // Alleen # is muur, ALLES ANDERS = pad
  return t === "#";
}

function isDot(col, row) {
  const t = getTile(col, row);
  return t === "." || t === "O";
}

function isPowerDot(col, row) {
  return getTile(col, row) === "O";
}

function tileCenter(col, row) {
  return {
    x: (col + 0.5) * TILE_SIZE,
    y: (row + 0.5) * TILE_SIZE,
  };
}

function findPositions() {
  let playerPos = null;
  let ghostPos = null;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = MAZE[r][c];
      if (ch === "P") playerPos = { col: c, row: r };
      if (ch === "G") ghostPos = { col: c, row: r };
    }
  }
  return { playerPos, ghostPos };
}

const { playerPos: startPlayerTile, ghostPos: startGhostTile } = findPositions();

// ---------------------------------------------------------------------------
// ENTITIES
// ---------------------------------------------------------------------------

const player = {
  x: tileCenter(startPlayerTile.col, startPlayerTile.row).x,
  y: tileCenter(startPlayerTile.col, startPlayerTile.row).y,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  speed: 2,
};

const ghost = {
  x: tileCenter(startGhostTile.col, startGhostTile.row).x,
  y: tileCenter(startGhostTile.col, startGhostTile.row).y,
  dir: { x: 0, y: -1 },
  speed: 1.5,
};

const ghost2 = {
  x: tileCenter(startGhostTile.col, startGhostTile.row).x,
  y: tileCenter(startGhostTile.col, startGhostTile.row).y,
  dir: { x: 0, y: 1 },
  speed: 1.5,
};

function resetEntities() {
  currentMaze = MAZE.slice();

  const pos = findPositions();
  const pc = tileCenter(pos.playerPos.col, pos.playerPos.row);
  const gc = tileCenter(pos.ghostPos.col, pos.ghostPos.row);

  player.x = pc.x;
  player.y = pc.y;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };

  ghost.x = gc.x;
  ghost.y = gc.y;
  ghost.dir = { x: 0, y: -1 };

  ghost2.x = gc.x;
  ghost2.y = gc.y;
  ghost2.dir = { x: 0, y: 1 };
}

// ---------------------------------------------------------------------------
// INPUT
// ---------------------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (gameOver) startNewGame();
    e.preventDefault();
    return;
  }
  if (!gameRunning) return;

  let dx = 0;
  let dy = 0;

  if (e.key === "ArrowUp") dy = -1;
  else if (e.key === "ArrowDown") dy = 1;
  else if (e.key === "ArrowLeft") dx = -1;
  else if (e.key === "ArrowRight") dx = 1;
  else return;

  player.nextDir = { x: dx, y: dy };
  e.preventDefault();
});

// ---------------------------------------------------------------------------
// MOVEMENT
// ---------------------------------------------------------------------------

function canMove(entity, dir) {
  const newX = entity.x + dir.x * entity.speed;
  const newY = entity.y + dir.y * entity.speed;

  const col = Math.floor(newX / TILE_SIZE);
  const row = Math.floor(newY / TILE_SIZE);

  return !isWall(col, row);
}

function snapToCenter(entity) {
  const col = Math.round(entity.x / TILE_SIZE - 0.5);
  const row = Math.round(entity.y / TILE_SIZE - 0.5);
  const center = tileCenter(col, row);

  if (entity.dir.x !== 0) entity.y = center.y;
  else if (entity.dir.y !== 0) entity.x = center.x;
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

  if (player.dir.x !== 0 || player.dir.y !== 0) {
    if (canMove(player, player.dir)) {
      player.x += player.dir.x * player.speed;
      player.y += player.dir.y * player.speed;
    }
  }

  snapToCenter(player);

  const col = Math.round(player.x / TILE_SIZE - 0.5);
  const row = Math.round(player.y / TILE_SIZE - 0.5);
  const ch = getTile(col, row);

  if (ch === ".") {
    setTile(col, row, " ");
    score += SCORE_DOT;
    scoreEl.textContent = score;
  } else if (ch === "O") {
    setTile(col, row, " ");
    score += SCORE_POWER;
    scoreEl.textContent = score;
  }
}

// ---------------------------------------------------------------------------
// GHOST UPDATE
// ---------------------------------------------------------------------------

function updateGhost() {
  updateOneGhost(ghost);
}

function updateGhost2() {
  updateOneGhost(ghost2);
}

function updateOneGhost(g) {
  const col = Math.round(g.x / TILE_SIZE - 0.5);
  const row = Math.round(g.y / TILE_SIZE - 0.5);
  const center = tileCenter(col, row);
  const distance = Math.hypot(g.x - center.x, g.y - center.y);

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  if (distance < 1) {
    const nonReverse = dirs.filter(
      (d) => !(d.x === -g.dir.x && d.y === -g.dir.y),
    );
    let options = nonReverse.filter((d) => !isWall(col + d.x, row + d.y));

    if (options.length === 0) {
      options = dirs.filter((d) => !isWall(col + d.x, row + d.y));
    }

    if (options.length > 0) {
      g.dir = options[Math.floor(Math.random() * options.length)];
      g.x = center.x;
      g.y = center.y;
    }
  }

  if (g.dir.x !== 0 || g.dir.y !== 0) {
    if (canMove(g, g.dir)) {
      g.x += g.dir.x * g.speed;
      g.y += g.dir.y * g.speed;
    }
  }

  snapToCenter(g);
}

// ---------------------------------------------------------------------------
// COLLISION
// ---------------------------------------------------------------------------

function checkCollision() {
  const hitGhost1 =
    Math.hypot(player.x - ghost.x, player.y - ghost.y) < TILE_SIZE * 0.6;
  const hitGhost2 =
    Math.hypot(player.x - ghost2.x, player.y - ghost2.y) < TILE_SIZE * 0.6;

  if (hitGhost1 || hitGhost2) {
    lives--;
    livesEl.textContent = lives;

    if (lives <= 0) {
      gameOver = true;
      gameRunning = false;
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
  mazeCtx.setTransform(1, 0, 0, 1, 0, 0);
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
// DOTS
// ---------------------------------------------------------------------------

function drawDots() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {

      const ch = getTile(c, r);
      if (ch === "." || ch === "O") {
        const x = c * TILE_SIZE + TILE_SIZE / 2;
        const y = r * TILE_SIZE + TILE_SIZE / 2;
        const radius = ch === "O" ? 5 : 2.5;

        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
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
let playerImgLoaded = false;
playerImg.onload = () => playerImgLoaded = true;

function drawPlayer() {
  const size = TILE_SIZE * 1.4;
  const radius = size / 2;

  const mouthOpen = (Math.sin(frame / 5) + 1) / 2;
  const maxMouth = Math.PI / 3;
  const mouthAngle = mouthOpen * maxMouth;

  let directionAngle = 0;
  if (player.dir.x > 0) directionAngle = 0;
  else if (player.dir.x < 0) directionAngle = Math.PI;
  else if (player.dir.y < 0) directionAngle = -Math.PI / 2;
  else if (player.dir.y > 0) directionAngle = Math.PI / 2;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(directionAngle);

  if (playerImgLoaded) {
    ctx.drawImage(playerImg, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#f4a428";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  }

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
// GHOST DRAW
// ---------------------------------------------------------------------------

const ghostImg = new Image();
ghostImg.src = "bitty-ghost.png";
let ghostImgLoaded = false;
ghostImg.onload = () => ghostImgLoaded = true;

const ghost2Img = new Image();
ghost2Img.src = "Beefcake-bitkey (1).png";
let ghost2ImgLoaded = false;
ghost2Img.onload = () => ghost2ImgLoaded = true;

function drawGhost() {
  const size = TILE_SIZE * 1.2;

  ctx.save();
  ctx.translate(ghost.x, ghost.y);

  if (ghostImgLoaded) {
    ctx.drawImage(ghostImg, -size / 2, -size / 2, size, size);
  }

  ctx.restore();
}

function drawGhost2() {
  const size = TILE_SIZE * 1.2;

  ctx.save();
  ctx.translate(ghost2.x, ghost2.y);

  if (ghost2ImgLoaded) {
    ctx.drawImage(ghost2Img, -size / 2, -size / 2, size, size);
  }

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

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(pathOffsetX, pathOffsetY);
  ctx.scale(pathScale, pathScale);

  drawDots();
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








