
// Bitty Pacman - simple Pac-Man style clone
// Designed to be easy to extend and host on GitHub Pages.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- GAME CONSTANTS -------------------------------------------------------

const TILE_SIZE = 20;
const COLS = 28;
const ROWS = 31;

const DOT_SCORE = 10;
const POWER_PELLET_SCORE = 50;
// Ghost scores for consecutive ghosts per power mode
const GHOST_CHAIN_SCORES = [200, 400, 800, 1600];

// Fruit scores by level (Pac-Man original order)
const FRUITS = [
  { name: "Cherry", score: 100 },
  { name: "Strawberry", score: 300 },
  { name: "Orange", score: 500 },
  { name: "Apple", score: 700 },
  { name: "Melon", score: 1000 },
  { name: "Galaxian", score: 2000 },
  { name: "Bell", score: 3000 },
  { name: "Key", score: 5000 },
];

// Maze tiles
// 0 empty, 1 wall, 2 dot, 3 power pellet, 4 ghost house door, 5 ghost house floor, 6 fruit spawn
// The layout is a simplified Pac-Man style maze (28 x 31 tiles)
const LEVEL_MAP = [
  "1111111111111111111111111111",
  "1222222222111112222222222221",
  "1211112112111112112111112121",
  "1311112112222222112111112121",
  "1222222222111112222222222221",
  "1211112112111112112111112121",
  "1222222112222222112222222121",
  "1111112111114111112111111111",
  "0000012115555555112120000000",
  "1111112115111115112111111111",
  "1222222222222222222222222221",
  "1211112112111112112111112121",
  "1311112112111112112111112121",
  "1222222112222222112222222121",
  "1111112111116111112111111111",
  "1222222222111112222222222221",
  "1211112112111112112111112121",
  "1222222112222222112222222121",
  "1211112112111112112111112121",
  "1222222222222222222222222221",
  "1111111111111111111111111111",
  "0000000000000000000000000000",
  "1111111111111111111111111111",
  "1222222222222222222222222221",
  "1211112112111112112111112121",
  "1311112112222222112111112121",
  "1222222222111112222222222221",
  "1211112112111112112111112121",
  "1222222112222222112222222121",
  "1222222222222222222222222221",
  "1111111111111111111111111111",
];

// --- GAME STATE ----------------------------------------------------------

let map = [];
let score = 0;
let lives = 3;
let level = 1;
let totalDots = 0;
let dotsEaten = 0;

let player = {
  x: 14.5 * TILE_SIZE,
  y: 23 * TILE_SIZE,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  speed: 2,
};

let ghosts = [];
let ghostSpeedBase = 1.6;
let frightened = false;
let frightenedTimer = 0;
let ghostChain = 0;

let fruit = null;
let fruitTimer = 0;

let bittyImg = new Image();
bittyImg.src = "assets/bitty-pacman.png";
let bittyLoaded = false;
bittyImg.onload = () => {
  bittyLoaded = true;
};

// Ghost colors for drawing
const GHOST_COLORS = ["#ff0000", "#ffb8ff", "#00ffff", "#ffb847"];

// --- LOGIN / UI STATE ----------------------------------------------------

const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const nameInput = document.getElementById("nameInput");
const avatarInput = document.getElementById("avatarInput");
const playerNameLabel = document.getElementById("playerName");
const playerAvatar = document.getElementById("playerAvatar");
const scoreDisplay = document.getElementById("scoreDisplay");
const livesDisplay = document.getElementById("livesDisplay");
const levelDisplay = document.getElementById("levelDisplay");
const highscoreList = document.getElementById("highscoreList");

const messageOverlay = document.getElementById("messageOverlay");
const messageText = document.getElementById("messageText");
const messageButton = document.getElementById("messageButton");

let playerName = "";
let avatarDataUrl = "";

let gameRunning = false;
let gameOver = false;

// --- INITIALIZATION ------------------------------------------------------

function resetMap() {
  map = [];
  totalDots = 0;
  dotsEaten = 0;
  for (let r = 0; r < ROWS; r++) {
    const rowStr = LEVEL_MAP[r];
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const ch = rowStr[c];
      let tile = 0;
      if (ch === "1") tile = 1;
      else if (ch === "2") { tile = 2; totalDots++; }
      else if (ch === "3") { tile = 3; totalDots++; }
      else if (ch === "4") tile = 4;
      else if (ch === "5") tile = 5;
      else if (ch === "6") tile = 6;
      else tile = 0;
      row.push(tile);
    }
    map.push(row);
  }
}

function resetPlayer() {
  player.x = 14.5 * TILE_SIZE;
  player.y = 23 * TILE_SIZE;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
}

function resetGhosts() {
  ghosts = [];
  const centerCol = 14;
  const houseRow = 9;
  for (let i = 0; i < 4; i++) {
    ghosts.push({
      x: (centerCol - 1 + i) * TILE_SIZE + TILE_SIZE / 2,
      y: houseRow * TILE_SIZE + TILE_SIZE / 2,
      dir: { x: 0, y: -1 },
      speed: ghostSpeedBase,
      mode: "chase",
      scatterTarget: i === 0 ? { x: COLS - 1, y: 0 }
        : i === 1 ? { x: 0, y: 0 }
        : i === 2 ? { x: COLS - 1, y: ROWS - 1 }
        : { x: 0, y: ROWS - 1 },
      home: { x: centerCol, y: houseRow },
    });
  }
}

function startLevel(newLevel) {
  level = newLevel;
  levelDisplay.textContent = level;
  ghostSpeedBase = 1.6 + (level - 1) * 0.15;
  resetMap();
  resetPlayer();
  resetGhosts();
  frightened = false;
  frightenedTimer = 0;
  ghostChain = 0;
  fruit = null;
  fruitTimer = 0;
  gameRunning = true;
  gameOver = false;
}

// --- HIGH SCORES ---------------------------------------------------------

function loadHighscores() {
  try {
    const raw = localStorage.getItem("bittyPacmanHighscores");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem("bittyPacmanHighscores", JSON.stringify(list));
}

function updateHighscoreUI() {
  const list = loadHighscores();
  highscoreList.innerHTML = "";
  list.forEach((entry) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    const right = document.createElement("span");
    left.textContent = `${entry.name} (L${entry.level})`;
    right.textContent = entry.score;
    li.appendChild(left);
    li.appendChild(right);
    highscoreList.appendChild(li);
  });
}

function addHighscore(name, scoreVal, levelVal) {
  const list = loadHighscores();
  list.push({ name, score: scoreVal, level: levelVal });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 10);
  saveHighscores(trimmed);
  updateHighscoreUI();
}

// --- INPUT HANDLING ------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (!gameRunning) return;
  let dx = 0, dy = 0;
  if (e.key === "ArrowUp") dy = -1;
  else if (e.key === "ArrowDown") dy = 1;
  else if (e.key === "ArrowLeft") dx = -1;
  else if (e.key === "ArrowRight") dx = 1;
  else return;

  player.nextDir = { x: dx, y: dy };
  e.preventDefault();
});

// --- LOGIN HANDLING ------------------------------------------------------

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  playerName = name;
  playerNameLabel.textContent = name;

  const file = avatarInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      avatarDataUrl = reader.result;
      playerAvatar.src = avatarDataUrl;
      loginOverlay.classList.add("hidden");
      startLevel(1);
    };
    reader.readAsDataURL(file);
  } else {
    avatarDataUrl = "";
    playerAvatar.src = "";
    loginOverlay.classList.add("hidden");
    startLevel(1);
  }
});

messageButton.addEventListener("click", () => {
  messageOverlay.classList.add("hidden");
  if (gameOver) {
    // Restart whole game
    score = 0;
    lives = 3;
    scoreDisplay.textContent = "0";
    livesDisplay.textContent = "3";
    startLevel(1);
  } else {
    startLevel(level + 1);
  }
});

// --- UTILS ----------------------------------------------------------------

function tileAt(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 1;
  return map[row][col];
}

function isWall(col, row) {
  const t = tileAt(col, row);
  return t === 1 || t === 4;
}

// Wrap around tunnels horizontally
function wrapX(x) {
  if (x < 0) return canvas.width + x;
  if (x >= canvas.width) return x - canvas.width;
  return x;
}

// --- MOVEMENT -------------------------------------------------------------

function canMove(entity, dir) {
  const speed = entity.speed;
  const newX = entity.x + dir.x * speed;
  const newY = entity.y + dir.y * speed;
  const col = Math.floor(newX / TILE_SIZE);
  const row = Math.floor(newY / TILE_SIZE);
  if (isWall(col, row)) return false;
  return true;
}

function updatePlayer() {
  // Try to turn into nextDir at tile centers
  const centerCol = Math.round(player.x / TILE_SIZE);
  const centerRow = Math.round(player.y / TILE_SIZE);
  const centerX = centerCol * TILE_SIZE;
  const centerY = centerRow * TILE_SIZE;
  const distanceToCenter = Math.hypot(player.x - centerX, player.y - centerY);

  if (distanceToCenter < 2 && (player.nextDir.x !== player.dir.x || player.nextDir.y !== player.dir.y)) {
    const testEntity = { ...player, x: centerX, y: centerY, speed: player.speed };
    if (!isWall(centerCol + player.nextDir.x, centerRow + player.nextDir.y)) {
      player.x = centerX;
      player.y = centerY;
      player.dir = { ...player.nextDir };
    }
  }

  if (!canMove(player, player.dir)) return;

  player.x += player.dir.x * player.speed;
  player.y += player.dir.y * player.speed;

  player.x = wrapX(player.x);

  // Eating dots / power pellets
  const col = Math.floor(player.x / TILE_SIZE);
  const row = Math.floor(player.y / TILE_SIZE);
  const tile = tileAt(col, row);
  if (tile === 2) {
    map[row][col] = 0;
    score += DOT_SCORE;
    dotsEaten++;
    scoreDisplay.textContent = score;
  } else if (tile === 3) {
    map[row][col] = 0;
    score += POWER_PELLET_SCORE;
    dotsEaten++;
    scoreDisplay.textContent = score;
    frightened = true;
    ghostChain = 0;
    const baseDuration = 360; // frames
    frightenedTimer = Math.max(120, baseDuration - (level - 1) * 30);
  }

  // Fruit spawn thresholds (roughly 30% and 70% of dots)
  if (!fruit && totalDots > 0) {
    const p = dotsEaten / totalDots;
    if (p > 0.3 && p < 0.35) spawnFruit();
    if (p > 0.7 && p < 0.75) spawnFruit();
  }

  // Eat fruit
  if (fruit && Math.hypot(player.x - fruit.x, player.y - fruit.y) < TILE_SIZE / 2) {
    score += fruit.score;
    scoreDisplay.textContent = score;
    fruit = null;
  }

  // Level complete
  if (dotsEaten >= totalDots) {
    gameRunning = false;
    messageText.textContent = `Level ${level} complete!`;
    messageOverlay.classList.remove("hidden");
  }
}

function updateGhosts() {
  if (frightened) {
    frightenedTimer--;
    if (frightenedTimer <= 0) {
      frightened = false;
      ghostChain = 0;
    }
  }

  ghosts.forEach((g, index) => {
    // At intersections, choose direction
    const col = Math.round(g.x / TILE_SIZE);
    const row = Math.round(g.y / TILE_SIZE);
    const centerX = col * TILE_SIZE;
    const centerY = row * TILE_SIZE;
    const distanceToCenter = Math.hypot(g.x - centerX, g.y - centerY);

    if (distanceToCenter < 1) {
      const possibleDirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ].filter((d) => !(d.x === -g.dir.x && d.y === -g.dir.y)); // no reverse

      const validDirs = possibleDirs.filter((d) => !isWall(col + d.x, row + d.y));
      if (validDirs.length > 0) {
        let chosen;
        if (frightened) {
          // Random direction when frightened
          chosen = validDirs[Math.floor(Math.random() * validDirs.length)];
        } else {
          // Chase: pick direction that minimizes distance to player
          let bestDist = Infinity;
          validDirs.forEach((d) => {
            const tx = (col + d.x) * TILE_SIZE;
            const ty = (row + d.y) * TILE_SIZE;
            const offsetX = index === 1 ? player.dir.x * 4 * TILE_SIZE : 0;
            const offsetY = index === 1 ? player.dir.y * 4 * TILE_SIZE : 0;
            const dist = Math.hypot(tx - (player.x + offsetX), ty - (player.y + offsetY));
            if (dist < bestDist) {
              bestDist = dist;
              chosen = d;
            }
          });
        }
        if (chosen) {
          g.dir = chosen;
          g.x = centerX;
          g.y = centerY;
        }
      }
    }

    if (canMove(g, g.dir)) {
      g.x += g.dir.x * g.speed;
      g.y += g.dir.y * g.speed;
      g.x = wrapX(g.x);
    }

    // Collision with player
    if (Math.hypot(g.x - player.x, g.y - player.y) < TILE_SIZE * 0.7) {
      if (frightened) {
        // Eat ghost
        const chainIndex = Math.min(ghostChain, GHOST_CHAIN_SCORES.length - 1);
        score += GHOST_CHAIN_SCORES[chainIndex];
        scoreDisplay.textContent = score;
        ghostChain++;
        // Send ghost back to house
        g.x = g.home.x * TILE_SIZE;
        g.y = g.home.y * TILE_SIZE;
        g.dir = { x: 0, y: -1 };
      } else {
        // Lose life
        handleLifeLost();
      }
    }
  });
}

function spawnFruit() {
  // Single fruit spawn tile defined in map as tile 6
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map[r][c] === 6) {
        const fruitDef = FRUITS[Math.min(level - 1, FRUITS.length - 1)];
        fruit = {
          x: c * TILE_SIZE + TILE_SIZE / 2,
          y: r * TILE_SIZE + TILE_SIZE / 2,
          name: fruitDef.name,
          score: fruitDef.score,
        };
        fruitTimer = 60 * 9; // 9 seconds approx at 60fps
        return;
      }
    }
  }
}

function updateFruit() {
  if (!fruit) return;
  fruitTimer--;
  if (fruitTimer <= 0) {
    fruit = null;
  }
}

// --- LIVES / GAME OVER ----------------------------------------------------

function handleLifeLost() {
  if (!gameRunning) return;
  lives--;
  livesDisplay.textContent = lives;
  if (lives <= 0) {
    gameRunning = false;
    gameOver = true;
    addHighscore(playerName || "Anon", score, level);
    messageText.textContent = `Game over! Final score: ${score}`;
    messageOverlay.classList.remove("hidden");
  } else {
    resetPlayer();
    resetGhosts();
    frightened = false;
    frightenedTimer = 0;
    ghostChain = 0;
  }
}

// --- RENDERING ------------------------------------------------------------

let chompFrame = 0;

function drawMaze() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = map[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      if (tile === 1 || tile === 4) {
        ctx.strokeStyle = "#1c4bff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      } else if (tile === 2) {
        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === 3) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPlayer() {
  const angle =
    player.dir.x > 0 ? 0 :
    player.dir.x < 0 ? Math.PI :
    player.dir.y < 0 ? -Math.PI / 2 :
    player.dir.y > 0 ? Math.PI / 2 :
    0;

  const size = TILE_SIZE * 1.2;
  const drawX = player.x;
  const drawY = player.y;

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate(angle);
  const scale = 0.9 + 0.1 * Math.abs(Math.sin(chompFrame / 8));
  ctx.scale(scale, scale);
  if (bittyLoaded) {
    ctx.drawImage(bittyImg, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#ffff00";
    ctx.beginPath();
    ctx.arc(0, 0, TILE_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGhosts() {
  ghosts.forEach((g, index) => {
    const radius = TILE_SIZE * 0.4;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = frightened ? "#0000ff" : GHOST_COLORS[index];
    ctx.beginPath();
    ctx.arc(0, -radius / 3, radius, Math.PI, 0);
    ctx.lineTo(radius, radius);
    ctx.lineTo(-radius, radius);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-radius / 3, -radius / 2, radius / 4, 0, Math.PI * 2);
    ctx.arc(radius / 3, -radius / 2, radius / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(-radius / 3, -radius / 2, radius / 9, 0, Math.PI * 2);
    ctx.arc(radius / 3, -radius / 2, radius / 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

function drawFruit() {
  if (!fruit) return;
  ctx.save();
  ctx.translate(fruit.x, fruit.y);
  ctx.fillStyle = "#ff4b4b";
  ctx.beginPath();
  ctx.arc(0, 0, TILE_SIZE * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fruit.name[0], 0, 0);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  drawFruit();
  drawPlayer();
  drawGhosts();
}

// --- MAIN LOOP ------------------------------------------------------------

function loop() {
  if (gameRunning) {
    updatePlayer();
    updateGhosts();
    updateFruit();
    chompFrame++;
  }
  render();
  requestAnimationFrame(loop);
}

// --- STARTUP --------------------------------------------------------------

updateHighscoreUI();
scoreDisplay.textContent = score;
livesDisplay.textContent = lives;
loop();
