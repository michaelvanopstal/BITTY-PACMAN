// Bitty Pacman demo - Bitty sprite + echte hap-mond + 2 ghosts

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 32;
const RENDER_SCALE = 0.3; // 0.5 = 50% van de originele map-grootte

let WORLD_WIDTH = 0;
let WORLD_HEIGHT = 0;

// ---------------------------------------------------------------------------
// Level PNG -> onzichtbare muren
// ---------------------------------------------------------------------------

let MAZE = []; // wordt gevuld uit PNG
let ROWS = 0;
let COLS = 0;
let currentMaze = [];

const levelImage = new Image();
// pas dit pad zo nodig aan:
levelImage.src = "bitty_pacman.png";

let levelReady = false;

// portal-data (wordt automatisch bepaald uit de MAZE)
let portalRow = null;
let portalLeftCol = null;
let portalRightCol = null;

levelImage.onload = () => {
  levelReady = true;
  generateMazeFromImage(levelImage);
  // als MAZE klaar is, game opstarten
  startInitialGame();
};

// Maak MAZE uit de pixels van de PNG
function generateMazeFromImage(image) {
  const off = document.createElement("canvas");
  off.width = image.width;
  off.height = image.height;
  const offCtx = off.getContext("2d");

  offCtx.drawImage(image, 0, 0);

  ROWS = Math.floor(image.height / TILE_SIZE);
  COLS = Math.floor(image.width / TILE_SIZE);

  const newMaze = [];

  for (let row = 0; row < ROWS; row++) {
    let line = "";
    for (let col = 0; col < COLS; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      const imageData = offCtx.getImageData(
        x,
        y,
        TILE_SIZE,
        TILE_SIZE
      ).data;

      let isWall = false;

      // neon-detectie: blauwe muren + BITTY-letters
      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];

        const blueNeon = b > 150 && r < 80 && g < 80;
        const redNeon = r > 150 && g < 100 && b < 100;
        const greenNeon = g > 150 && r < 100 && b < 100;
        const cyanNeon = b > 150 && g > 120 && r < 80;
        const yellowNeon = r > 150 && g > 150 && b < 120;
        const magentaNeon = r > 150 && b > 150 && g < 120;
        const whiteLine = r > 200 && g > 200 && b > 200;

        if (
          blueNeon ||
          redNeon ||
          greenNeon ||
          cyanNeon ||
          yellowNeon ||
          magentaNeon ||
          whiteLine
        ) {
          isWall = true;
          break;
        }
      }

      line += isWall ? "#" : ".";
    }
    newMaze.push(line);
  }

  // Hulpfunctie om een karakter in een string-rij te zetten
  function putChar(r, c, ch) {
    const s = newMaze[r];
    newMaze[r] = s.slice(0, c) + ch + s.slice(c + 1);
  }

  // Zoek een gang-tile (.) in de buurt van een gewenste positie
  function findNonWallNear(prefCol, prefRow) {
    const maxRadius = Math.max(ROWS, COLS);
    for (let radius = 0; radius < maxRadius; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = prefRow + dr;
          const c = prefCol + dc;
          if (r < 1 || r >= ROWS - 1 || c < 1 || c >= COLS - 1) continue;
          if (newMaze[r][c] === ".") {
            return { row: r, col: c };
          }
        }
      }
    }
    // fallback
    return { row: 1, col: 1 };
  }

  // Player ongeveer onderaan midden
  const playerSpawn = findNonWallNear(Math.floor(COLS / 2), ROWS - 4);
  putChar(playerSpawn.row, playerSpawn.col, "P");

  // Ghost ongeveer in het centrum
  const ghostSpawn = findNonWallNear(
    Math.floor(COLS / 2),
    Math.floor(ROWS / 2)
  );
  putChar(ghostSpawn.row, ghostSpawn.col, "G");

  // -----------------------------
  // FLOOD FILL: alleen gebied dat vanaf P bereikbaar is blijft '.'
  // alles buiten-level / in letters → '#'
  // -----------------------------
  const reachable = [];
  for (let r = 0; r < ROWS; r++) {
    reachable[r] = new Array(COLS).fill(false);
  }

  const q = [];
  q.push({ r: playerSpawn.row, c: playerSpawn.col });
  reachable[playerSpawn.row][playerSpawn.col] = true;

  while (q.length > 0) {
    const { r, c } = q.shift();
    const dirs = [
      { dr: 1, dc: 0 },
      { dr: -1, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 0, dc: -1 },
    ];
    for (const d of dirs) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (reachable[nr][nc]) continue;
      const ch = newMaze[nr][nc];
      if (ch === "#") continue; // muur
      reachable[nr][nc] = true;
      q.push({ r: nr, c: nc });
    }
  }

  // alle '.' die NIET bereikbaar zijn → '#'
  for (let r = 0; r < ROWS; r++) {
    let rowStr = newMaze[r];
    const chars = rowStr.split("");
    for (let c = 0; c < COLS; c++) {
      if (chars[c] === "." && !reachable[r][c]) {
        chars[c] = "#";
      }
    }
    newMaze[r] = chars.join("");
  }

  // -----------------------------
  // PORTAL automatisch zoeken
  // -----------------------------
  let bestRow = null;
  let bestScore = -Infinity;

  for (let r = 0; r < ROWS; r++) {
    const rowStr = newMaze[r];
    let first = -1;
    let last = -1;
    for (let c = 0; c < COLS; c++) {
      if (rowStr[c] !== "#") {
        if (first === -1) first = c;
        last = c;
      }
    }
    if (first === -1) continue;
    const span = last - first + 1;
    const centerDist = Math.abs(r - ROWS / 2);
    const score = span - centerDist * 2; // voorkeur: lang & in het midden
    if (span > COLS * 0.5 && score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  if (bestRow !== null) {
    const rowStr = newMaze[bestRow];
    let first = -1;
    let last = -1;
    for (let c = 0; c < COLS; c++) {
      if (rowStr[c] !== "#") {
        if (first === -1) first = c;
        last = c;
      }
    }
    portalRow = bestRow;
    portalLeftCol = first;
    portalRightCol = last;
    // console.log("Portal row:", portalRow, "cols:", portalLeftCol, portalRightCol);
  }

  MAZE = newMaze;

  WORLD_WIDTH = COLS * TILE_SIZE;
  WORLD_HEIGHT = ROWS * TILE_SIZE;

  // Canvas verkleinen met RENDER_SCALE zodat het hele level in beeld past
  canvas.width = WORLD_WIDTH * RENDER_SCALE;
  canvas.height = WORLD_HEIGHT * RENDER_SCALE;
}

// ---------------------------------------------------------------------------
// Score / game state
// ---------------------------------------------------------------------------

const SCORE_DOT = 10;

let score = 0;
let lives = 3;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const messageEl = document.getElementById("message");
const messageTextEl = document.getElementById("messageText");

let gameRunning = false;
let gameOver = false;
let frame = 0; // voor hap-animatie

// ---------------------------------------------------------------------------
// Maze helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

const player = {
  x: 0,
  y: 0,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  speed: 2,
};

const ghost = {
  x: 0,
  y: 0,
  dir: { x: -1, y: 0 }, // start naar links
  speed: 1.5,
};

const ghost2 = {
  x: 0,
  y: 0,
  dir: { x: 1, y: 0 }, // start naar rechts
  speed: 1.5,
};

function resetEntities() {
  currentMaze = MAZE.slice();
  const { playerPos, ghostPos } = findPositions();

  if (!playerPos || !ghostPos) {
    console.error("P of G niet gevonden in MAZE");
    return;
  }

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

  // Portal: in portalRow mag je "uit het veld" bewegen, we warpen daarna
  if (
    portalRow !== null &&
    dir.y === 0 &&
    Math.floor(entity.y / TILE_SIZE) === portalRow &&
    (col < 0 || col >= COLS)
  ) {
    return true;
  }

  return !isWall(col, row);
}

function applyPortal(entity) {
  if (portalRow === null) return;

  const row = Math.floor(entity.y / TILE_SIZE);

  if (row !== portalRow || entity.dir.y !== 0) return;

  if (entity.x < 0) {
    entity.x = WORLD_WIDTH - TILE_SIZE / 2;
  } else if (entity.x > WORLD_WIDTH) {
    entity.x = TILE_SIZE / 2;
  }
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
  // Kijk of we kunnen draaien naar nextDir
  if (player.nextDir.x !== player.dir.x || player.nextDir.y !== player.dir.y) {
    if (canMove(player, player.nextDir)) {
      player.dir = { ...player.nextDir };
    }
  }

  // Beweeg in huidige richting
  if (player.dir.x !== 0 || player.dir.y !== 0) {
    if (canMove(player, player.dir)) {
      player.x += player.dir.x * player.speed;
      player.y += player.dir.y * player.speed;
      applyPortal(player);
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
  }
}

// ---------------------------------------------------------------------------
// Ghost updates
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
      applyPortal(g);
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
// Maze tekenen: PNG als achtergrond + alleen dots
// ---------------------------------------------------------------------------

function drawMaze() {
  // achtergrond = level PNG
  if (levelReady) {
    // tekenen in wereld-coördinaten (1920x1920), schaal gebeurt in loop()
    ctx.drawImage(levelImage, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  } else {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  // GEEN muren tekenen: ze zijn onzichtbaar, alleen collision

  // Dots
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = getTile(c, r);
      if (ch === ".") {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          3,
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

  // Alles tekenen in wereldruimte en daarna geschaald weergeven
  ctx.save();
  ctx.scale(RENDER_SCALE, RENDER_SCALE);

  drawMaze();
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

// wordt aangeroepen na het genereren van MAZE uit de PNG
function startInitialGame() {
  score = 0;
  lives = 3;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  gameOver = false;
  gameRunning = true;
  resetEntities();
  messageEl.classList.add("hidden");
  loop(); // game-loop starten
}






