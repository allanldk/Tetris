const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nctx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const statusEl = document.getElementById('status');
const restartBtn = document.getElementById('restart');

const COLORS = {
  I: '#22d3ee', O: '#facc15', T: '#c084fc', S: '#4ade80',
  Z: '#fb7185', J: '#60a5fa', L: '#fb923c'
};

const SHAPES = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]],
};

const BAG = Object.keys(SHAPES);
let bag = [];
let board, current, nextPiece, score, lines, level, dropCounter, dropInterval, lastTime, gameOver, paused;

function resetGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  bag = [];
  score = 0; lines = 0; level = 1;
  dropCounter = 0; dropInterval = 1000; lastTime = 0;
  gameOver = false; paused = false;
  current = spawnPiece();
  nextPiece = spawnPiece();
  updateHud();
  setStatus('Game on.');
  draw();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextType() {
  if (!bag.length) bag = shuffle([...BAG]);
  return bag.pop();
}

function spawnPiece() {
  const type = nextType();
  const shape = SHAPES[type].map(r => [...r]);
  return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
}

function rotate(matrix) {
  return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
}

function collide(piece, dx = 0, dy = 0, shape = piece.shape) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function merge(piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val && piece.y + y >= 0) board[piece.y + y][piece.x + x] = piece.type;
    });
  });
}

function clearLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (!board[y][x]) continue outer;
    }
    board.splice(y, 1);
    board.unshift(Array(COLS).fill(0));
    cleared++;
    y++;
  }
  if (!cleared) return;
  lines += cleared;
  const points = [0, 100, 300, 500, 800];
  score += points[cleared] * level;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  updateHud();
}

function lockPiece() {
  merge(current);
  clearLines();
  current = nextPiece;
  nextPiece = spawnPiece();
  if (collide(current, 0, 0)) {
    gameOver = true;
    setStatus('Game over. Press Restart.');
  }
}

function hardDrop() {
  if (gameOver || paused) return;
  while (!collide(current, 0, 1)) {
    current.y++;
    score += 2;
  }
  lockPiece();
  updateHud();
}

function playerDrop() {
  if (gameOver || paused) return;
  if (!collide(current, 0, 1)) {
    current.y++;
  } else {
    lockPiece();
  }
  dropCounter = 0;
}

function move(dir) {
  if (gameOver || paused) return;
  if (!collide(current, dir, 0)) current.x += dir;
}

function playerRotate() {
  if (gameOver || paused) return;
  const rotated = rotate(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (!collide(current, k, 0, rotated)) {
      current.shape = rotated;
      current.x += k;
      return;
    }
  }
}

function drawCell(x, y, color, context = ctx, size = BLOCK) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);
  context.strokeStyle = 'rgba(0,0,0,.25)';
  context.strokeRect(x * size, y * size, size, size);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (cell) drawCell(x, y, COLORS[cell]);
    }
  }
}

function drawPiece(piece, context = ctx, offsetX = 0, offsetY = 0, size = BLOCK) {
  piece.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val) drawCell(piece.x + x + offsetX, piece.y + y + offsetY, COLORS[piece.type], context, size);
    });
  });
}

function drawNext() {
  nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = 24;
  const w = nextPiece.shape[0].length;
  const h = nextPiece.shape.length;
  const ox = Math.floor((nextCanvas.width / size - w) / 2);
  const oy = Math.floor((nextCanvas.height / size - h) / 2);
  drawPiece({ ...nextPiece, x: 0, y: 0 }, nctx, ox, oy, size);
}

function draw() {
  drawBoard();
  if (!gameOver) drawPiece(current);
  drawNext();
}

function updateHud() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function setStatus(msg) { statusEl.textContent = msg; }

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  if (!gameOver && !paused) {
    dropCounter += delta;
    if (dropCounter > dropInterval) playerDrop();
  }
  draw();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') move(-1);
  else if (e.key === 'ArrowRight') move(1);
  else if (e.key === 'ArrowDown') { playerDrop(); score += 1; updateHud(); }
  else if (e.key === 'ArrowUp') playerRotate();
  else if (e.code === 'Space') { e.preventDefault(); hardDrop(); }
  else if (e.key.toLowerCase() === 'p') {
    paused = !paused;
    setStatus(paused ? 'Paused' : 'Game on.');
  }
});

restartBtn.addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(update);
