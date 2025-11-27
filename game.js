// Bitty Pacman demo - Bitty sprite + echte hap-mond + 2 ghosts

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 32;

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
let frame = 0; // voor hap-animatie

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

const ghost2 = {
  x: tileCenter(startGhostTile.col, startGhostTile.row).x,
  y: tileCenter(startGhostTile.col, startGhostTile.row).y,
  dir: { x: 1, y: 0 }, // start naar rechts
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

  ghost2.x = gc.x;
  ghost2.y = gc.y;
  ghost2.dir = { x: 1, y: 0 };
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

// --- Movement helpers ----------------------------------------------------

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

  if (entity.dir.x !== 0) {
    entity.y = center.y;
  } else if (entity.dir.y !== 0) {
    entity.x = center.x;
  }
}

// --- Player update -------------------------------------------------------

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
  }
}

// --- Ghost updates -------------------------------------------------------

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
    const nonReverse = dirs.filter(
      (d) => !(d.x === -ghost.dir.x && d.y === -ghost.dir.y),
    );
    let options = nonReverse.filter((d) => !isWall(col + d.x, row + d.y));
    if (options.length === 0) {
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

function updateGhost2() {
  const col = Math.round(ghost2.x / TILE_SIZE - 0.5);
  const row = Math.round(ghost2.y / TILE_SIZE - 0.5);
  const center = tileCenter(col, row);
  const distance = Math.hypot(ghost2.x - center.x, ghost2.y - center.y);

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  if (distance < 1) {
    const nonReverse = dirs.filter(
      (d) => !(d.x === -ghost2.dir.x && d.y === -ghost2.dir.y),
    );
    let options = nonReverse.filter((d) => !isWall(col + d.x, row + d.y));
    if (options.length === 0) {
      options = dirs.filter((d) => !isWall(col + d.x, row + d.y));
    }
    if (options.length > 0) {
      ghost2.dir = options[Math.floor(Math.random() * options.length)];
      ghost2.x = center.x;
      ghost2.y = center.y;
    }
  }

  if (ghost2.dir.x !== 0 || ghost2.dir.y !== 0) {
    if (canMove(ghost2, ghost2.dir)) {
      ghost2.x += ghost2.dir.x * ghost2.speed;
      ghost2.y += ghost2.dir.y * ghost2.speed;
    }
  }

  snapToCenter(ghost2);
}

// --- Collision -----------------------------------------------------------

function checkCollision() {
  let dx = player.x - ghost.x;
  let dy = player.y - ghost.y;
  let dist = Math.hypot(dx, dy);

  let dx2 = player.x - ghost2.x;
  let dy2 = player.y - ghost2.y;
  let dist2 = Math.hypot(dx2, dy2);

  if (dist < TILE_SIZE * 0.6 || dist2 < TILE_SIZE * 0.6) {
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

// --- Maze tekenen als doorlopende neon-lijnen ---------------------------
function drawMaze() {
  // Achtergrond
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = 6;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // HORIZONTALE lijnen
  ctx.strokeStyle = "#1c4bff";
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      while (c < COLS && getTile(c, r) !== "#") c++;
      if (c >= COLS) break;

      const start = c;
      while (c + 1 < COLS && getTile(c + 1, r) === "#") c++;
      const end = c;

      const y = r * TILE_SIZE + TILE_SIZE / 2;
      const x1 = start * TILE_SIZE + pad;
      const x2 = (end + 1) * TILE_SIZE - pad;

      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      c++;
    }
  }

  // VERTICALE lijnen
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      while (r < ROWS && getTile(c, r) !== "#") r++;
      if (r >= ROWS) break;

      const start = r;
      while (r + 1 < ROWS && getTile(c, r + 1) === "#") r++;
      const end = r;

      const x = c * TILE_SIZE + TILE_SIZE / 2;
      const y1 = start * TILE_SIZE + pad;
      const y2 = (end + 1) * TILE_SIZE - pad;

      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();

      r++;
    }
  }

  // DOTS
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = getTile(c, r);
      if (ch === ".") {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// --- BittyPacman sprite laden -------------------------------------------

const playerImg = new Image();
playerImg.src = "bittypacman.png";
let playerImgLoaded = false;
playerImg.onload = () => {
  playerImgLoaded = true;
};

// --- Pacman tekenen met echte hap-mond ----------------------------------

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

// --- Ghost sprites -------------------------------------------------------

const ghostImg = new Image();
ghostImg.src = "bitty-ghost.png";
let ghostImgLoaded = false;
ghostImg.onload = () => {
  ghostImgLoaded = true;
};

const ghost2Img = new Image();
ghost2Img.src = "Beefcake-bitkey (1).png";
let ghost2ImgLoaded = false;
ghost2Img.onload = () => {
  ghost2ImgLoaded = true;
};

function drawGhost() {
  const size = TILE_SIZE * 1.2;
  ctx.save();
  ctx.translate(ghost.x, ghost.y);

  if (ghostImgLoaded) {
    ctx.drawImage(ghostImg, -size / 2, -size / 2, size, size);
  } else {
    const radius = TILE_SIZE * 0.45;
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(0, -radius / 3, radius, Math.PI, 0);
    ctx.lineTo(radius, radius);
    ctx.lineTo(-radius, radius);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawGhost2() {
  const size = TILE_SIZE * 1.2;
  ctx.save();
  ctx.translate(ghost2.x, ghost2.y);

  if (ghost2ImgLoaded) {
    ctx.drawImage(ghost2Img, -size / 2, -size / 2, size, size);
  } else {
    const radius = TILE_SIZE * 0.45;
    ctx.fillStyle = "#ff8800";
    ctx.beginPath();
    ctx.arc(0, -radius / 3, radius, Math.PI, 0);
    ctx.lineTo(radius, radius);
    ctx.lineTo(-radius, radius);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// --- Game loop -----------------------------------------------------------

function loop() {
  if (gameRunning) {
    updatePlayer();
    updateGhost();
    updateGhost2();
    checkCollision();
    frame++;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  drawPlayer();
  drawGhost();
  drawGhost2();

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


