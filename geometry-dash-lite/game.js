const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const progressFill = document.querySelector("#progressFill");
const menu = document.querySelector("#menu");
const result = document.querySelector("#result");
const resultKicker = document.querySelector("#resultKicker");
const resultTitle = document.querySelector("#resultTitle");
const resultScore = document.querySelector("#resultScore");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");

const player = {
  x: 170,
  y: 0,
  previousY: 0,
  size: 42,
  velocityY: 0,
  rotation: 0,
  grounded: true,
};

const level = {
  length: 7800,
  obstacles: [
    { x: 760, type: "spike" },
    { x: 1090, type: "spike" },
    { x: 1380, type: "block", width: 52, height: 52 },
    { x: 1730, type: "spike" },
    { x: 1878, type: "spike" },
    { x: 2320, type: "block", width: 62, height: 72 },
    { x: 2660, type: "spike" },
    { x: 2810, type: "spike" },
    { x: 3180, type: "block", width: 56, height: 92 },
    { x: 3630, type: "spike" },
    { x: 3910, type: "block", width: 118, height: 44 },
    { x: 4350, type: "spike" },
    { x: 4496, type: "spike" },
    { x: 4850, type: "block", width: 68, height: 72 },
    { x: 5190, type: "spike" },
    { x: 5500, type: "spike" },
    { x: 5650, type: "spike" },
    { x: 6060, type: "block", width: 72, height: 96 },
    { x: 6450, type: "spike" },
    { x: 6750, type: "block", width: 140, height: 48 },
    { x: 7220, type: "spike" },
  ],
};

let view = { width: 1280, height: 720, ground: 530, dpr: 1 };
let state = "menu";
let distance = 0;
let speed = 360;
let score = 0;
let best = Number(localStorage.getItem("dash-runner-best") || 0);
let lastTime = 0;
let particles = [];
let beatPulse = 0;
let beatIndex = 0;
let audio = null;
let nextBeatAt = 0;

bestEl.textContent = best;

function resize() {
  const rect = canvas.getBoundingClientRect();
  view.width = rect.width;
  view.height = rect.height;
  view.ground = Math.round(rect.height * 0.76);
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(rect.width * view.dpr);
  canvas.height = Math.floor(rect.height * view.dpr);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  player.x = Math.max(96, Math.min(170, view.width * 0.2));
  if (player.grounded || state !== "playing") {
    player.y = view.ground - player.size;
  }
}

function resetGame() {
  distance = 0;
  speed = 360;
  score = 0;
  particles = [];
  beatPulse = 0;
  beatIndex = 0;
  player.y = view.ground - player.size;
  player.previousY = player.y;
  player.velocityY = 0;
  player.rotation = 0;
  player.grounded = true;
  scoreEl.textContent = "0";
  progressFill.style.width = "0%";
}

function startGame() {
  resetGame();
  state = "playing";
  menu.classList.remove("visible");
  result.classList.remove("visible");
  startAudio();
}

function finishGame() {
  state = "complete";
  updateBest();
  stopAudio();
  resultKicker.textContent = "complete";
  resultTitle.textContent = "완주 성공";
  resultScore.textContent = `score ${score}`;
  result.classList.add("visible");
}

function crash() {
  if (state !== "playing") return;
  state = "dead";
  updateBest();
  burst(player.x + player.size / 2, player.y + player.size / 2, 26, "#ff4f6d");
  stopAudio();
  resultKicker.textContent = "crashed";
  resultTitle.textContent = "다시 달려볼까요?";
  resultScore.textContent = `score ${score}`;
  result.classList.add("visible");
}

function updateBest() {
  if (score <= best) return;
  best = score;
  localStorage.setItem("dash-runner-best", String(best));
  bestEl.textContent = best;
}

function jump() {
  if (state !== "playing") {
    startGame();
    return;
  }

  if (!player.grounded) return;
  player.velocityY = -790;
  player.grounded = false;
  burst(player.x + player.size * 0.5, view.ground - 6, 8, "#2de2bf");
  playBlip(520, 0.045, "triangle", 0.055);
}

function startAudio() {
  if (!audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audio = new AudioContext();
  }

  if (audio.state === "suspended") {
    audio.resume();
  }
  nextBeatAt = audio.currentTime + 0.05;
}

function stopAudio() {
  nextBeatAt = 0;
}

function scheduleBeat() {
  if (!audio || state !== "playing") return;
  const now = audio.currentTime;
  const beatLength = 60 / 132;
  while (nextBeatAt && nextBeatAt < now + 0.08) {
    const accent = beatIndex % 4 === 0;
    const frequency = accent ? 164.81 : beatIndex % 2 === 0 ? 246.94 : 196;
    playBlip(frequency, accent ? 0.08 : 0.045, accent ? "sawtooth" : "square", accent ? 0.06 : 0.035, nextBeatAt);
    beatPulse = accent ? 1 : 0.55;
    beatIndex += 1;
    nextBeatAt += beatLength;
  }
}

function playBlip(frequency, duration, type, gainValue, when = null) {
  if (!audio) return;
  const startAt = when ?? audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function burst(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const force = 90 + Math.random() * 250;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * force,
      vy: Math.sin(angle) * force,
      life: 0.35 + Math.random() * 0.45,
      maxLife: 0.8,
      size: 3 + Math.random() * 5,
      color,
    });
  }
}

function update(delta) {
  if (state !== "playing") {
    updateParticles(delta);
    return;
  }

  scheduleBeat();

  const progress = Math.min(distance / level.length, 1);
  speed = 360 + progress * 95;
  distance += speed * delta;
  score = Math.floor(distance / 12);
  scoreEl.textContent = score;
  progressFill.style.width = `${Math.floor(progress * 100)}%`;

  player.previousY = player.y;
  player.velocityY += 2350 * delta;
  player.y += player.velocityY * delta;

  if (player.y >= view.ground - player.size) {
    player.y = view.ground - player.size;
    player.velocityY = 0;
    player.grounded = true;
  }

  if (!player.grounded) {
    player.rotation += delta * speed * 0.015;
  } else {
    player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
  }

  emitTrail(delta);
  updateParticles(delta);
  checkCollisions();
  beatPulse = Math.max(0, beatPulse - delta * 2.6);

  if (distance >= level.length) {
    finishGame();
  }
}

function emitTrail(delta) {
  const amount = player.grounded ? 12 : 6;
  if (Math.random() > delta * amount) return;
  particles.push({
    x: player.x + 4,
    y: player.y + player.size - 8,
    vx: -80 - Math.random() * 80,
    vy: -20 + Math.random() * 40,
    life: 0.24 + Math.random() * 0.2,
    maxLife: 0.46,
    size: 3 + Math.random() * 4,
    color: player.grounded ? "#ffd166" : "#2de2bf",
  });
}

function updateParticles(delta) {
  particles = particles.filter((particle) => {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 420 * delta;
    return particle.life > 0;
  });
}

function checkCollisions() {
  const playerRect = {
    x: distance + 4,
    y: player.y + 4,
    width: player.size - 8,
    height: player.size - 8,
  };

  for (const obstacle of level.obstacles) {
    const width = obstacle.width ?? 42;
    const height = obstacle.height ?? 42;
    const rect = {
      x: obstacle.x,
      y: view.ground - height,
      width,
      height,
    };

    if (obstacle.type === "spike") {
      const spikeRect = {
        x: obstacle.x + 7,
        y: view.ground - 35,
        width: 28,
        height: 35,
      };
      if (rectsOverlap(playerRect, spikeRect)) {
        crash();
        return;
      }
      continue;
    }

    if (rectsOverlap(playerRect, rect)) {
      crash();
      return;
    }
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function draw() {
  ctx.clearRect(0, 0, view.width, view.height);
  drawBackground();
  drawTrack();
  drawObstacles();
  drawParticles();
  drawPlayer();

  if (state === "menu") {
    drawGhostRun();
  }
}

function drawBackground() {
  const pulse = beatPulse * 18;
  const sky = ctx.createLinearGradient(0, 0, view.width, view.height);
  sky.addColorStop(0, "#191022");
  sky.addColorStop(0.45, "#132236");
  sky.addColorStop(1, "#2b1726");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  ctx.save();
  ctx.globalAlpha = 0.55 + beatPulse * 0.18;
  drawSun(view.width * 0.78, view.height * 0.24, 62 + pulse);
  ctx.restore();

  drawMountains(0.12, "#24233a", 0.32);
  drawMountains(0.2, "#171a2a", 0.52);
  drawGrid();
}

function drawSun(x, y, radius) {
  const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, "rgba(255, 209, 102, 0.85)");
  gradient.addColorStop(0.54, "rgba(255, 79, 109, 0.34)");
  gradient.addColorStop(1, "rgba(255, 79, 109, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains(rate, color, baseRatio) {
  const offset = -(distance * rate) % 240;
  const base = view.height * baseRatio;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(offset - 260, view.ground);
  for (let x = offset - 260; x < view.width + 300; x += 120) {
    ctx.lineTo(x + 70, base + Math.sin(x * 0.03) * 22);
    ctx.lineTo(x + 145, view.ground);
  }
  ctx.lineTo(view.width + 320, view.ground);
  ctx.closePath();
  ctx.fill();
}

function drawGrid() {
  const offset = -(distance * 0.58) % 64;
  ctx.strokeStyle = "rgba(45, 226, 191, 0.16)";
  ctx.lineWidth = 1;
  for (let x = offset; x < view.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, view.ground);
    ctx.lineTo(x + view.width * 0.18, view.height);
    ctx.stroke();
  }

  for (let y = view.ground; y < view.height; y += 34) {
    ctx.globalAlpha = Math.max(0.1, 1 - (y - view.ground) / (view.height - view.ground + 1));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(view.width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTrack() {
  const groundGradient = ctx.createLinearGradient(0, view.ground - 22, 0, view.height);
  groundGradient.addColorStop(0, "#f7e6a1");
  groundGradient.addColorStop(0.18, "#ff4f6d");
  groundGradient.addColorStop(0.22, "#2c1220");
  groundGradient.addColorStop(1, "#120d18");
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, view.ground - 22, view.width, view.height - view.ground + 22);

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  const tile = 54;
  const offset = -(distance % tile);
  for (let x = offset; x < view.width; x += tile) {
    ctx.fillRect(x, view.ground - 18, 24, 5);
  }
}

function drawObstacles() {
  for (const obstacle of level.obstacles) {
    const x = obstacle.x - distance + player.x;
    if (x < -180 || x > view.width + 180) continue;

    if (obstacle.type === "spike") {
      drawSpike(x, view.ground);
    } else {
      drawBlock(x, view.ground - obstacle.height, obstacle.width, obstacle.height);
    }
  }
}

function drawSpike(x, groundY) {
  ctx.save();
  ctx.shadowColor = "rgba(255, 79, 109, 0.6)";
  ctx.shadowBlur = 16;
  const gradient = ctx.createLinearGradient(x, groundY - 42, x, groundY);
  gradient.addColorStop(0, "#f9f4df");
  gradient.addColorStop(0.44, "#ffd166");
  gradient.addColorStop(1, "#ff4f6d");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x + 21, groundY - 43);
  ctx.lineTo(x + 42, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(23, 16, 24, 0.85)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawBlock(x, y, width, height) {
  ctx.save();
  ctx.shadowColor = "rgba(45, 226, 191, 0.38)";
  ctx.shadowBlur = 16;
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "#2de2bf");
  gradient.addColorStop(0.52, "#7c5cff");
  gradient.addColorStop(1, "#ff4f6d");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(x + 6, y + 6, width - 12, 7);
  ctx.strokeStyle = "rgba(13, 12, 20, 0.84)";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(player.rotation);
  ctx.shadowColor = "rgba(255, 209, 102, 0.55)";
  ctx.shadowBlur = 18;

  const gradient = ctx.createLinearGradient(-player.size / 2, -player.size / 2, player.size / 2, player.size / 2);
  gradient.addColorStop(0, "#ffd166");
  gradient.addColorStop(0.54, "#ff4f6d");
  gradient.addColorStop(1, "#7c5cff");
  ctx.fillStyle = gradient;
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);

  ctx.strokeStyle = "#171018";
  ctx.lineWidth = 4;
  ctx.strokeRect(-player.size / 2, -player.size / 2, player.size, player.size);

  ctx.fillStyle = "#171018";
  ctx.fillRect(-11, -8, 7, 7);
  ctx.fillRect(7, -8, 7, 7);
  ctx.fillRect(-10, 9, 24, 5);
  ctx.restore();
}

function drawGhostRun() {
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = i % 2 ? "#2de2bf" : "#ffd166";
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x - i * 20, player.y + i * 3, player.size, player.size);
  }
  ctx.restore();
}

function frame(time) {
  if (!lastTime) lastTime = time;
  const delta = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

function handlePress(event) {
  if (event.type === "keydown") {
    if (!["Space", "ArrowUp", "KeyW"].includes(event.code) || event.repeat) return;
    event.preventDefault();
  }
  jump();
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", handlePress);
canvas.addEventListener("pointerdown", handlePress);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

resize();
resetGame();
requestAnimationFrame(frame);
