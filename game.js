const COLS = 10, ROWS = 20, BLOCK = 30;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nctx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const statusEl = document.getElementById('status');
const restartBtn = document.getElementById('restart');

const COLORS = { I:'#22d3ee', O:'#facc15', T:'#c084fc', S:'#4ade80', Z:'#fb7185', J:'#60a5fa', L:'#fb923c' };
const SHAPES = {
  I:[[1,1,1,1]], O:[[1,1],[1,1]], T:[[0,1,0],[1,1,1]],
  S:[[0,1,1],[1,1,0]], Z:[[1,1,0],[0,1,1]], J:[[1,0,0],[1,1,1]], L:[[0,0,1],[1,1,1]]
};
const BAG = Object.keys(SHAPES);
const HIGHSCORE_KEY = 'tetris_highscore_v1';

let bag = [], board, current, nextPiece, score, lines, level, highscore, dropCounter, dropInterval, lastTime, gameOver, paused;
let audioCtx;

function beep(freq = 440, duration = 0.05, type = 'square', volume = 0.03) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = volume;
    o.connect(g); g.connect(audioCtx.destination); o.start();
    setTimeout(() => o.stop(), duration * 1000);
  } catch {}
}

function resetGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  bag = []; score = 0; lines = 0; level = 1;
  highscore = Number(localStorage.getItem(HIGHSCORE_KEY) || 0);
  dropCounter = 0; dropInterval = 1000; lastTime = 0;
  gameOver = false; paused = false;
  current = spawnPiece(); nextPiece = spawnPiece();
  updateHud(); setStatus('Game on.'); draw();
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function nextType(){ if(!bag.length) bag = shuffle([...BAG]); return bag.pop(); }
function spawnPiece(){ const type = nextType(); const shape = SHAPES[type].map(r=>[...r]); return { type, shape, x: Math.floor((COLS-shape[0].length)/2), y: 0 }; }
function rotate(m){ return m[0].map((_,i)=>m.map(r=>r[i]).reverse()); }

function collide(piece, dx=0, dy=0, shape=piece.shape){
  for(let y=0;y<shape.length;y++) for(let x=0;x<shape[y].length;x++) if(shape[y][x]){
    const nx = piece.x+x+dx, ny = piece.y+y+dy;
    if(nx<0||nx>=COLS||ny>=ROWS) return true;
    if(ny>=0 && board[ny][nx]) return true;
  }
  return false;
}

function merge(piece){ piece.shape.forEach((r,y)=>r.forEach((v,x)=>{ if(v&&piece.y+y>=0) board[piece.y+y][piece.x+x]=piece.type; })); }

function clearLines(){
  let cleared=0;
  outer: for(let y=ROWS-1;y>=0;y--){
    for(let x=0;x<COLS;x++) if(!board[y][x]) continue outer;
    board.splice(y,1); board.unshift(Array(COLS).fill(0)); cleared++; y++;
  }
  if(!cleared) return;
  lines += cleared;
  score += [0,100,300,500,800][cleared] * level;
  level = Math.floor(lines/10)+1;
  dropInterval = Math.max(100, 1000-(level-1)*90);
  beep(620 + cleared * 100, 0.08);
  updateHud();
}

function maybeSaveHighscore(){
  if(score > highscore){ highscore = score; localStorage.setItem(HIGHSCORE_KEY, String(highscore)); }
}

function lockPiece(){
  merge(current); clearLines(); current = nextPiece; nextPiece = spawnPiece();
  beep(240, 0.03, 'triangle', 0.02);
  if(collide(current,0,0)){ gameOver = true; maybeSaveHighscore(); updateHud(); setStatus('Game over. Press Restart.'); beep(120,0.2,'sawtooth',0.04); }
}

function hardDrop(){ if(gameOver||paused) return; while(!collide(current,0,1)){ current.y++; score += 2; } beep(900,0.03); lockPiece(); updateHud(); }
function playerDrop(){ if(gameOver||paused) return; if(!collide(current,0,1)) current.y++; else lockPiece(); dropCounter=0; }
function move(dir){ if(gameOver||paused) return; if(!collide(current,dir,0)) { current.x += dir; beep(480,0.02,'square',0.01); } }
function playerRotate(){
  if(gameOver||paused) return;
  const r = rotate(current.shape);
  for(const k of [0,-1,1,-2,2]) if(!collide(current,k,0,r)){ current.shape=r; current.x += k; beep(700,0.02,'triangle',0.02); return; }
}

function drawCell(x,y,color,c=ctx,size=BLOCK){ c.fillStyle=color; c.fillRect(x*size,y*size,size,size); c.strokeStyle='rgba(0,0,0,.25)'; c.strokeRect(x*size,y*size,size,size); }
function drawBoard(){ ctx.clearRect(0,0,canvas.width,canvas.height); for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(board[y][x]) drawCell(x,y,COLORS[board[y][x]]); }
function drawPiece(piece,c=ctx,ox=0,oy=0,size=BLOCK){ piece.shape.forEach((r,y)=>r.forEach((v,x)=>{ if(v) drawCell(piece.x+x+ox,piece.y+y+oy,COLORS[piece.type],c,size); })); }
function drawNext(){
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  const size=24, w=nextPiece.shape[0].length, h=nextPiece.shape.length;
  const ox=Math.floor((nextCanvas.width/size-w)/2), oy=Math.floor((nextCanvas.height/size-h)/2);
  drawPiece({ ...nextPiece, x:0, y:0 }, nctx, ox, oy, size);
}
function draw(){ drawBoard(); if(!gameOver) drawPiece(current); drawNext(); }
function updateHud(){ scoreEl.textContent=score; linesEl.textContent=lines; levelEl.textContent=level; highEl.textContent=highscore; }
function setStatus(m){ statusEl.textContent=m; }

function update(t=0){
  const d=t-lastTime; lastTime=t;
  if(!gameOver&&!paused){ dropCounter += d; if(dropCounter>dropInterval) playerDrop(); maybeSaveHighscore(); }
  draw(); requestAnimationFrame(update);
}

document.addEventListener('keydown', e => {
  if(e.key==='ArrowLeft') move(-1);
  else if(e.key==='ArrowRight') move(1);
  else if(e.key==='ArrowDown'){ playerDrop(); score += 1; updateHud(); }
  else if(e.key==='ArrowUp') playerRotate();
  else if(e.code==='Space'){ e.preventDefault(); hardDrop(); }
  else if(e.key.toLowerCase()==='p'){ paused=!paused; setStatus(paused?'Paused':'Game on.'); beep(paused?330:550,0.05); }
});

restartBtn.addEventListener('click', resetGame);

document.querySelectorAll('.touch-controls button').forEach(btn => {
  const run = () => {
    const a = btn.dataset.act;
    if(a==='left') move(-1);
    else if(a==='right') move(1);
    else if(a==='rotate') playerRotate();
    else if(a==='down'){ playerDrop(); score += 1; updateHud(); }
    else if(a==='drop') hardDrop();
    else if(a==='pause'){ paused=!paused; setStatus(paused?'Paused':'Game on.'); }
  };
  btn.addEventListener('click', run);
  btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); run(); }, { passive:false });
});

resetGame();
requestAnimationFrame(update);
