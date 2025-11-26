// Bitty Pacman - improved maze, paths & ghost movement

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- GAME CONSTANTS -------------------------------------------------------

const TILE_SIZE = 32;   // groter: alles beter in balans
const COLS = 28;
const ROWS = 31;


canvas.width = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;

const DOT_SCORE = 10;
const POWER_PELLET_SCORE = 50;
const GHOST_CHAIN_SCORES = [200, 400, 800, 1600];

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

// 0 corridor, 1 wall, 2 dot, 3 power pellet, 4 ghost door, 5 ghost house, 6 fruit spawn
const LEVEL_MAP = [
 
  "1111111111111111111111111111",
  "1222222222222112222222222221",
  "1211112111112112111112111121",
  "1311112111112112111112111131",
  "1211112111112112111112111121",
  "1222222222222222222222222221",
  "1211112112111111112112111121",
  "1211112112111111112112111121",
  "1222222222222112222222222221",
  "1111112111112112111112111111",
  "0000012115552115552112000000",
  "1111112115552115552111111111",
  "1222222222222112222222222221",
  "1211112111112112111112111121",
  "1311112111114332111112111131",
  "1211112111112112111112111121",
  "1222222222222112222222222221",
  "1211112112111111112112111121",
  "1211112112111111112112111121",
  "1222222222222222222222222221",
  "1211112111112112111112111121",
  "1311112111112112111112111131",
  "1222222222222112222222222221",
  "1111111111116111111111111111",
  "1111111111111111111111111111",
  "1111111111111111111111111111",
  "1111111111111111111111111111",
  "1111111111111111111111111111",
  "1111111111111111111111111111",
  "1111111111111111111111111111",
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
  y: 26 * TILE_SIZE,       // wordt in resetPlayer nog gezet
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  speed: 2,
};

let ghosts = [];
let ghostSpeedBase = 1.4;
let frightened = false;
let frightenedTimer = 0;
let ghostChain = 0;
let lifeLostCooldown = 0;

let fruit = null;
let fruitTimer = 0;

let bittyImg = new Image();
bittyImg.src = "assets/bitty-pacman.png";
let bittyLoaded = false;
bittyImg.onload = () => { bittyLoaded = true; };

const GHOST_COLORS = ["#ff0000", "#ffb8ff", "#00ffff", "#ffb847"];

// --- LOGIN / UI ----------------------------------------------------------

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

// --- INITIALISATIE -------------------------------------------------------

function resetMap() {
  map = [];
  totalDots = 0;
  dotsEaten = 0;
  for (let r = 0; r < ROWS; r++) {
    const rowStr = LEVEL_MAP[r];
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const ch = rowStr[c];
      let tile;
      if (ch === "1") tile = 1;
      else if (ch === "2") { tile = 2; totalDots++; }
      else if (ch === "3") { tile = 3; totalDots++; }
      else if (ch === "4") tile = 4;
      else if (ch === "5") tile = 5;
      else if (ch === "6") tile = 6;
      else tile = 0; // corridors
      row.push(tile);
    }
    map.push(row);
  }
}

function resetPlayer() {
  // Start onderin het hoofdlevel, in een horizontale gang
  const startCol = 15;  // dit is een pad (dot) in LEVEL_MAP
  const startRow = 21;  // ook een gang

  player.x = (startCol + 0.5) * TILE_SIZE; // midden van de tile
  player.y = (startRow + 0.5) * TILE_SIZE;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
}


function resetGhosts() {
  ghosts = [];
  const centerCol = 14;
  const houseRow = 11;
  for (let i = 0; i < 4; i++) {
    ghosts.push({
      x: (centerCol - 1 + i) * TILE_SIZE + TILE_SIZE / 2,
      y: houseRow * TILE_SIZE + TILE_SIZE / 2,
      dir: { x: 0, y: -1 },
      speed: ghostSpeedBase,
      mode: "scatter",
      home: { x: centerCol, y: houseRow },
      leaveDelay: i * 180, // komen na elkaar uit de box
    });
  }
}

function startLevel(newLevel) {
  level = newLevel;
  levelDisplay.textContent = level;
  ghostSpeedBase = 1.4 + (level - 1) * 0.15;
  resetMap();
  resetPlayer();
  resetGhosts();
  frightened = false;
  frightenedTimer = 0;
  ghostChain = 0;
  fruit = null;
  fruitTimer = 0;
  lifeLostCooldown = 60;
  gameRunning = true;
  gameOver = false;
}

// --- HIGHSCORES ----------------------------------------------------------

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
  saveHighscores(list.slice(0, 10));
  updateHighscoreUI();
}

// --- INPUT ---------------------------------------------------------------

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

// --- LOGIN ---------------------------------------------------------------

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
    score = 0;
    lives = 3;
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    startLevel(1);
  } else {
    startLevel(level + 1);
  }
});

// --- UTILS ---------------------------------------------------------------

function tileAt(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 1;
  return map[row][col];
}

function isWall(col, row) {
  const t = tileAt(col, row);
  // 1 = muur, 4 = deur ghosthouse; 0,2,3,5,6 zijn paden
  return t === 1 || t === 4;
}

function wrapX(x) {
  const w = COLS * TILE_SIZE;
  if (x < 0) return w + x;
  if (x >= w) return x - w;
  return x;
}

// --- MOVEMENT ------------------------------------------------------------

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
  if (lifeLostCooldown > 0) lifeLostCooldown--;

  const centerCol = Math.round(player.x / TILE_SIZE);
  const centerRow = Math.round(player.y / TILE_SIZE);
  const centerX = centerCol * TILE_SIZE + TILE_SIZE / 2;
  const centerY = centerRow * TILE_SIZE + TILE_SIZE / 2;
  const distanceToCenter = Math.hypot(player.x - centerX, player.y - centerY);

  const isStanding = player.dir.x === 0 && player.dir.y === 0;

  // ALS BITTY NOG STIL STAAT -> direct de eerste richting pakken
  if (isStanding) {
    if (player.nextDir.x !== 0 || player.nextDir.y !== 0) {
      if (!isWall(centerCol + player.nextDir.x, centerRow + player.nextDir.y)) {
        player.x = centerX;
        player.y = centerY;
        player.dir = { ...player.nextDir };
      }
    }
  } else if (
    distanceToCenter < 2 &&
    (player.nextDir.x !== player.dir.x || player.nextDir.y !== player.dir.y)
  ) {
    // normaal gedrag op kruispunten
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
    frightenedTimer = Math.max(120, 360 - (level - 1) * 30);
  }

  if (!fruit && totalDots > 0) {
    const p = dotsEaten / totalDots;
    if ((p > 0.3 && p < 0.33) || (p > 0.7 && p < 0.73)) spawnFruit();
  }

  if (fruit && Math.hypot(player.x - fruit.x, player.y - fruit.y) < TILE_SIZE * 0.5) {
    score += fruit.score;
    scoreDisplay.textContent = score;
    fruit = null;
  }

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

  ghosts.forEach((g) => {
    // delay voor uit het huis komen
    if (g.leaveDelay > 0) {
      g.leaveDelay--;
      return;
    }

    const col = Math.round(g.x / TILE_SIZE);
    const row = Math.round(g.y / TILE_SIZE);
    const centerX = col * TILE_SIZE;
    const centerY = row * TILE_SIZE;
    const distanceToCenter = Math.hypot(g.x - centerX, g.y - centerY);

    const allDirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    // kruispunt of kan niet vooruit → nieuwe richting kiezen
    if (distanceToCenter < 1 || !canMove(g, g.dir)) {
      const nonReverse = allDirs.filter(
        (d) => !(d.x === -g.dir.x && d.y === -g.dir.y)
      );
      let options = nonReverse.filter((d) => !isWall(col + d.x, row + d.y));

      if (options.length === 0) {
        // doodlopend → reverse toestaan
        options = allDirs.filter((d) => !isWall(col + d.x, row + d.y));
      }

      if (options.length > 0) {
        let chosen;
        if (frightened) {
          chosen = options[Math.floor(Math.random() * options.length)];
        } else {
          // simpele chase: richting die speler dichterbij brengt
          let bestDist = Infinity;
          options.forEach((d) => {
            const tx = (col + d.x) * TILE_SIZE;
            const ty = (row + d.y) * TILE_SIZE;
            const dist = Math.hypot(tx - player.x, ty - player.y);
            if (dist < bestDist) {
              bestDist = dist;
              chosen = d;
            }
          });
        }
        if (chosen) {
          g.x = centerX;
          g.y = centerY;
          g.dir = chosen;
        }
      }
    }

    if (canMove(g, g.dir)) {
      g.x += g.dir.x * g.speed;
      g.y += g.dir.y * g.speed;
      g.x = wrapX(g.x);
    }

    if (Math.hypot(g.x - player.x, g.y - player.y) < TILE_SIZE * 0.7) {
      if (frightened && lifeLostCooldown === 0) {
        const chainIndex = Math.min(ghostChain, GHOST_CHAIN_SCORES.length - 1);
        score += GHOST_CHAIN_SCORES[chainIndex];
        scoreDisplay.textContent = score;
        ghostChain++;
        g.x = g.home.x * TILE_SIZE;
        g.y = g.home.y * TILE_SIZE;
        g.dir = { x: 0, y: -1 };
        g.leaveDelay = 240; // later weer uit het huis
      } else if (!frightened && lifeLostCooldown === 0) {
        handleLifeLost();
      }
    }
  });
}

function spawnFruit() {
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
        fruitTimer = 60 * 9;
        return;
      }
    }
  }
}

function updateFruit() {
  if (!fruit) return;
  fruitTimer--;
  if (fruitTimer <= 0) fruit = null;
}

// --- LIVES ---------------------------------------------------------------

function handleLifeLost() {
  if (!gameRunning) return;
  lives--;
  livesDisplay.textContent = lives;
  lifeLostCooldown = 60;
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
  // muren als mooie lijnen
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#1c4bff";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = map[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      if (tile === 1 || tile === 4) {
        if (!isWall(c, r - 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + TILE_SIZE, y);
          ctx.stroke();
        }
        if (!isWall(c, r + 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y + TILE_SIZE);
          ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
          ctx.stroke();
        }
        if (!isWall(c - 1, r)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + TILE_SIZE);
          ctx.stroke();
        }
        if (!isWall(c + 1, r)) {
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE, y);
          ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
          ctx.stroke();
        }
      }
    }
  }

  // dots & power pellets
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = map[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;
      if (tile === 2) {
        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === 3) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 6, 0, Math.PI * 2);
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
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  const scale = 0.9 + 0.1 * Math.abs(Math.sin(chompFrame / 6));
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
    const radius = TILE_SIZE * 0.45;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = frightened ? "#0000ff" : GHOST_COLORS[index];
    ctx.beginPath();
    ctx.arc(0, -radius / 3, radius, Math.PI, 0);
    ctx.lineTo(radius, radius);
    ctx.lineTo(-radius, radius);
    ctx.closePath();
    ctx.fill();

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

resetMap();
updateHighscoreUI();
scoreDisplay.textContent = score;
livesDisplay.textContent = lives;
loop();

