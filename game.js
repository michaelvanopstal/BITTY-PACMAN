// Bitty Pacman demo - kleine, schone versie
// Bitty + ghost lopen exact over dezelfde banen (tile-grid)

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 32;

// # = wall, . = dot, P = player start, G = ghost start, ' ' = corridor
const MAZE = [
  "###################",
  "#........#........#",
  "#.###.###.#.###.###",
  "#.................#",
  "#.###.#.#####.#.###",
  "#.....#...#...#...#",
  "###.#####.#.#####.#",
  "#...#.....G.....#.#",
  "#.#.#.#########.#.#",
  "#.#.............#.#",
  "#.#####.#.#.#####.#",
  "#........P........#",
  "###################",
];

const ROWS = MAZE.length;
const COLS = MAZE[0].length;

canvas.width = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;

const SCORE_DOT = 10;

let score = 0;
let lives = 3;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const messageEl = document.getElementById("message");
const messageTextEl = document.getElementById("messageText");

let gameRunning = true;
let gameOver = false;

// --- Maze helpers --------------------------------------------------------

let currentMaze = MAZE.slice(); // copy

function getTile(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return "#";
  return currentMaze[row][col];
}

function setTile(col, row, ch) {
  const chars = currentMaze[row].split("");
  chars[col] = ch;
  currentMaze[row] = chars.join("");
}

function isWall(col, row) {
  return getTile(col, row) === "#";
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

// --- Entities ------------------------------------------------------------

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
  dir: { x: -1, y: 0 }, // start naar links
  speed: 1.5,
};

function resetEntities() {
  currentMaze = MAZE.slice();
  const { playerPos, ghostPos } = findPositions();
  const pc = tileCenter(playerPos.col, playerPos.row);
  const gc = tileCenter(ghostPos.col, ghostPos.row);

  player.x = pc.x;
  player.y = pc.y;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };

  ghost.x = gc.x;
  ghost.y = gc.y;
  ghost.dir = { x: -1, y: 0 };
}

// --- Input ---------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (gameOver) startNewGame();
    e.preventDefault();
    return;
  }
  if (!gameRunning) return;

  let dx = 0,
    dy = 0;
  if (e.key === "ArrowUp") dy = -1;
  else if (e.key === "ArrowDown") dy = 1;
  else if (e.key === "ArrowLeft") dx = -1;
  else if (e.key === "ArrowRight") dx = 1;
  else return;

  player.nextDir = { x: dx, y: dy };
  e.preventDefault();
});

// --- Movement helpers: zelfde regels voor Bitty & ghost ------------------

function canMove(entity, dir) {
  const newX = entity.x + dir.x * entity.speed;
  const newY = entity.y + dir.y * entity.speed;

  const col = Math.floor(newX / TILE_SIZE);
  const row = Math.floor(newY / TILE_SIZE);

  return !isWall(col, row);
}

function snapToCenter(entity) {
  // Zorg dat entity precies in het midden van de baan blijft
  const col = Math.round(entity.x / TILE_SIZE - 0.5);
  const row = Math.round(entity.y / TILE_SIZE - 0.5);
  const center = tileCenter(col, row);

  if (entity.dir.x !== 0) {
    // horizontale beweging → Y centreren
    entity.y = center.y;
  } else if (entity.dir.y !== 0) {
    // verticale beweging → X centreren
    entity.x = center.x;
  }
}

// --- Player update -------------------------------------------------------

function updatePlayer() {
  // eerst proberen richting veranderen naar nextDir
  if (player.nextDir.x !== player.dir.x || player.nextDir.y !== player.dir.y) {
    if (canMove(player, player.nextDir)) {
      player.dir = { ...player.nextDir };
    }
  }

  // dan bewegen
  if (player.dir.x !== 0 || player.dir.y !== 0) {
    if (canMove(player, player.dir)) {
      player.x += player.dir.x * player.speed;
      player.y += player.dir.y * player.speed;
    }
  }

  snapToCenter(player);

  // dots eten
  const col = Math.round(player.x / TILE_SIZE - 0.5);
  const row = Math.round(player.y / TILE_SIZE - 0.5);
  const ch = getTile(col, row);

  if (ch === ".") {
    setTile(col, row, " ");
    score += SCORE_DOT;
    scoreEl.textContent = score;
  }
}

// --- Ghost update --------------------------------------------------------

function updateGhost() {
  const col = Math.round(ghost.x / TILE_SIZE - 0.5);
  const row = Math.round(ghost.y / TILE_SIZE - 0.5);
  const center = tileCenter(col, row);
  const distance = Math.hypot(ghost.x - center.x, ghost.y - center.y);

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  if (distance < 1) {
    // op kruispunt
    const nonReverse = dirs.filter(
      (d) => !(d.x === -ghost.dir.x && d.y === -ghost.dir.y),
    );
    let options = nonReverse.filter((d) => !isWall(col + d.x, row + d.y));
    if (options.length === 0) {
      // doodlopend → reverse toestaan
      options = dirs.filter((d) => !isWall(col + d.x, row + d.y));
    }
    if (options.length > 0) {
      ghost.dir = options[Math.floor(Math.random() * options.length)];
      ghost.x = center.x;
      ghost.y = center.y;
    }
  }

  if (ghost.dir.x !== 0 || ghost.dir.y !== 0) {
    if (canMove(ghost, ghost.dir)) {
      ghost.x += ghost.dir.x * ghost.speed;
      ghost.y += ghost.dir.y * ghost.speed;
    }
  }

  snapToCenter(ghost);
}

// --- Collision -----------------------------------------------------------

function checkCollision() {
  const dx = player.x - ghost.x;
  const dy = player.y - ghost.y;
  const dist = Math.hypot(dx, dy);

  if (dist < TILE_SIZE * 0.6) {
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

// --- Rendering -----------------------------------------------------------

function drawMaze() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = getTile(c, r);
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      // zwarte achtergrond
      ctx.fillStyle = "black";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      if (ch === "#") {
        // muren als blokken met blauwe rand
        ctx.strokeStyle = "#1c4bff";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      } else if (ch === ".") {
        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// --- Load custom Bitty Pacman image ---
const playerImg = new Image();
playerImg.src = "bitty-pacman.png"; // jouw Bitty karakter

function drawPlayer() {
  const size = TILE_SIZE * 1.2;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.drawImage(playerImg, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// --- Load custom Bitty Ghost image ---
const ghostImg = new Image();
ghostImg.src = "bitty-ghost.png"; // zorg dat deze in dezelfde map staat

function drawGhost() {
  const size = TILE_SIZE * 1.2; // iets groter dan standaard
  ctx.save();
  ctx.translate(ghost.x, ghost.y);
  ctx.drawImage(ghostImg, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// --- Game loop -----------------------------------------------------------

function loop() {
  if (gameRunning) {
    updatePlayer();
    updateGhost();
    checkCollision();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  drawPlayer();
  drawGhost();

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

// start
resetEntities();
loop();
