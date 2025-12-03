// Bitty Pacman - versie met handmatig berekend MAZE uit je PNG + dots

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 32;   // logische tile-grootte

// ---------------------------------------------------------------------------
// MAZE: gegenereerd uit jouw dot-afbeelding
// 28 kolommen, 29 rijen
// # = muur, . = dot, O = power-dot, P = pacman start, G = ghost start
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

// Canvas-formaat gebaseerd op tiles
canvas.width  = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;

// ---------------------------------------------------------------------------
// Score / state
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
let frame = 0; // hap-animatie

// ---------------------------------------------------------------------------
// Maze helpers
// ---------------------------------------------------------------------------

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
  const t = getTile(col, row);
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
// Entities
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
  dir: { x: 0, y: -1 }, // eerst omhoog
  speed: 1.5,
};

const ghost2 = {
  x: tileCenter(startGhostTile.col, startGhostTile.row).x,
  y: tileCenter(startGhostTile.col, startGhostTile.row).y,
  dir: { x: 0, y: 1 }, // en omlaag
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
  ghost.dir = { x: 0, y: -1 };

  ghost2.x = gc.x;
  ghost2.y = gc.y;
  ghost2.dir = { x: 0, y: 1 };
}

// ---------------------------------------------------------------------------
// Input
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
// Movement helpers
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

  if (entity.dir.x !== 0) {
    entity.y = center.y; // horizontale beweging → Y centreren
  } else if (entity.dir.y !== 0) {
    entity.x = center.x; // verticale beweging → X centreren
  }
}

// ---------------------------------------------------------------------------
// Player update
// ---------------------------------------------------------------------------

function updatePlayer() {
  // wissel richting zodra mogelijk
  if (player.nextDir.x !== player.dir.x || player.nextDir.y !== player.dir.y) {
    if (canMove(player, player.nextDir)) {
      player.dir = { ...player.nextDir };
    }
  }

  // bewegen
  if (player.dir.x !== 0 || player.dir.y !== 0) {
    if (canMove(player, player.dir)) {
      player.x += player.dir.x * player.speed;
      player.y += player.dir.y * player.speed;
    }
  }

  snapToCenter(player);

  // Dots eten
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
    // hier kun je later "frightened" mode voor ghosts toevoegen
  }
}

// ---------------------------------------------------------------------------
// Ghost updates (random wandelaar)
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
// Collision
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
// Achtergrond + dots tekenen
// ---------------------------------------------------------------------------

// PNG als decor (muren + dots visueel)
const levelImage = new Image();
levelImage.src = "bitty_pacman.png";
let levelReady = false;
levelImage.onload = () => {
  levelReady = true;
};

function drawMaze() {
  // achtergrond: jouw PNG geschaald naar canvas
  if (levelReady) {
    ctx.drawImage(levelImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // dots "logisch" tekenen (kleine cirkels) zodat ze altijd kloppen met MAZE
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = getTile(c, r);
      if (ch === "." || ch === "O") {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        ctx.fillStyle = "#ffb8ae";
        const radius = ch === "O" ? 6 : 3;
        ctx.beginPath();
        ctx.arc(
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          radius,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// BittyPacman sprite laden + tekenen met hap-mond
// ---------------------------------------------------------------------------

const playerImg = new Image();
playerImg.src = "bittypacman.png";
let playerImgLoaded = false;
playerImg.onload = () => {
  playerImgLoaded = true;
};

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

  // mond uitsnijden
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
// Ghost sprites laden + tekenen
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------

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








