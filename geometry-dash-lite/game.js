const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const stageNameEl = document.querySelector("#stageName");
const progressFill = document.querySelector("#progressFill");
const menu = document.querySelector("#menu");
const result = document.querySelector("#result");
const resultKicker = document.querySelector("#resultKicker");
const resultTitle = document.querySelector("#resultTitle");
const resultScore = document.querySelector("#resultScore");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const stageButtons = [...document.querySelectorAll(".stage-button")];
const spriteCache = new Map();
const SPRITE_SCALE = 2;

const player = {
  x: 170,
  y: 0,
  previousY: 0,
  size: 42,
  velocityY: 0,
  rotation: 0,
  grounded: true,
};

const BEAT_DISTANCE = 180;
const JUMP_SPEED = 790;
const GRAVITY = 2350;
const ONE_HOLD_BPM = 134;
const INITIAL_HOLD_WINDOW_SECONDS = 0.3;

function atBeat(beat, type, options = {}) {
  return { x: beat * BEAT_DISTANCE, type, ...options };
}

function buildOneHoldCourse() {
  const speed = BEAT_DISTANCE * (ONE_HOLD_BPM / 60);
  const playerCollisionWidth = player.size - 8;
  const platformWidth =
    speed * INITIAL_HOLD_WINDOW_SECONDS - playerCollisionWidth;
  const platformHeight = 40;
  const platformTops = [72, 96, 120];
  const heightPattern = [
    0, 1, 2, 1, 0, 2, 1, 0, 1, 2,
    0, 2, 1, 2, 0, 1, 0, 2, 1, 2,
    0, 1, 2, 0, 2, 1, 0, 1, 2, 1,
  ];
  const firstPlatformCenter = 6 * BEAT_DISTANCE + platformWidth / 2;
  const physicsStep = 1 / 60;

  function getLandingTime(targetHeight) {
    let y = 0;
    let velocity = -JUMP_SPEED;
    let elapsed = 0;

    while (elapsed < 2) {
      velocity += GRAVITY * physicsStep;
      y += velocity * physicsStep;
      elapsed += physicsStep;
      if (velocity >= 0 && y >= -targetHeight) return elapsed;
    }

    return 0;
  }

  const firstTop = platformTops[heightPattern[0]];
  const playerCollisionCenter = 4 + playerCollisionWidth / 2;
  const holdStartDistance =
    firstPlatformCenter -
    playerCollisionCenter -
    speed * getLandingTime(firstTop);
  const obstacles = [];
  let platformCenter = firstPlatformCenter;

  for (let index = 0; index < heightPattern.length; index += 1) {
    const currentTop = platformTops[heightPattern[index]];
    const platformX = platformCenter - platformWidth / 2;
    obstacles.push({
      x: platformX,
      type: "block",
      width: platformWidth,
      height: platformHeight,
      elevation: currentTop - platformHeight,
    });
    obstacles.push({ x: platformCenter - 21, type: "spike" });

    if (index === heightPattern.length - 1) continue;

    const nextTop = platformTops[heightPattern[index + 1]];
    const nextCenter = platformCenter + speed * getLandingTime(nextTop - currentTop);
    const midpoint = (platformCenter + nextCenter) / 2;

    if (index % 3 === 0) {
      obstacles.push({ x: midpoint - 63, type: "spike" });
      obstacles.push({ x: midpoint - 21, type: "spike" });
      obstacles.push({ x: midpoint + 21, type: "spike" });
    } else if (index % 3 === 1) {
      obstacles.push({ x: midpoint - 86, type: "block", width: 62, height: 58, elevation: 0 });
      obstacles.push({ x: midpoint + 24, type: "block", width: 62, height: 58, elevation: 0 });
      obstacles.push({ x: midpoint - 21, type: "spike" });
    } else {
      obstacles.push({ x: midpoint - 38, type: "block", width: 76, height: 38, elevation: 62 });
      obstacles.push({ x: midpoint - 68, type: "spike" });
      obstacles.push({ x: midpoint + 26, type: "spike" });
    }

    platformCenter = nextCenter;
  }

  return {
    holdStartDistance,
    obstacles: obstacles.sort((a, b) => a.x - b.x),
  };
}

const oneHoldCourse = buildOneHoldCourse();

const stages = [
  {
    id: "neon-start",
    number: 1,
    name: "Neon Start",
    bpm: 120,
    beats: 36,
    audioRoot: 164.81,
    theme: {
      skyA: "#191022", skyB: "#132236", skyC: "#2b1726",
      mountainA: "#24233a", mountainB: "#171a2a",
      hot: "#ff4f6d", gold: "#ffd166", mint: "#2de2bf", accent: "#7c5cff",
    },
    obstacles: [
      atBeat(4, "spike"), atBeat(6, "spike"),
      atBeat(8, "block", { width: 108, height: 52 }),
      atBeat(11, "spike"), atBeat(12, "spike"),
      atBeat(15, "block", { width: 132, height: 72 }),
      atBeat(18, "spike"),
      atBeat(20, "block", { width: 112, height: 92 }),
      atBeat(23, "spike"), atBeat(24, "spike"),
      atBeat(27, "block", { width: 162, height: 48 }),
      atBeat(30, "spike"),
      atBeat(32, "block", { width: 126, height: 78 }),
      atBeat(34, "spike"),
    ],
  },
  {
    id: "pulse-circuit",
    number: 2,
    name: "Pulse Circuit",
    bpm: 132,
    beats: 40,
    audioRoot: 196,
    theme: {
      skyA: "#071d24", skyB: "#173044", skyC: "#30172d",
      mountainA: "#183747", mountainB: "#10222d",
      hot: "#ff6b6b", gold: "#d9f45b", mint: "#39e6c2", accent: "#4b7bec",
    },
    obstacles: [
      atBeat(4, "spike"), atBeat(5.5, "spike"),
      atBeat(8, "block", { width: 150, height: 54 }),
      atBeat(10.5, "spike"), atBeat(11, "spike"),
      atBeat(14, "block", { width: 108, height: 86 }),
      atBeat(16.5, "spike"),
      atBeat(19, "block", { width: 176, height: 50 }),
      atBeat(22, "spike"), atBeat(22.5, "spike"),
      atBeat(25, "block", { width: 116, height: 104 }),
      atBeat(28, "spike"),
      atBeat(30, "block", { width: 164, height: 62 }),
      atBeat(33, "spike"), atBeat(33.5, "spike"),
      atBeat(36, "block", { width: 120, height: 92 }),
      atBeat(38, "spike"),
    ],
  },
  {
    id: "hyper-drive",
    number: 3,
    name: "Hyper Drive",
    bpm: 144,
    beats: 44,
    audioRoot: 220,
    theme: {
      skyA: "#220d2c", skyB: "#102a3b", skyC: "#36131f",
      mountainA: "#3c2147", mountainB: "#182334",
      hot: "#ff3d81", gold: "#ffe45c", mint: "#29d9ff", accent: "#9b5de5",
    },
    obstacles: [
      atBeat(4, "spike"), atBeat(5, "spike"),
      atBeat(7, "block", { width: 118, height: 64 }),
      atBeat(9.5, "spike"), atBeat(10, "spike"),
      atBeat(12.5, "block", { width: 178, height: 48 }),
      atBeat(15.5, "spike"),
      atBeat(17, "block", { width: 110, height: 108 }),
      atBeat(20, "spike"), atBeat(20.5, "spike"),
      atBeat(23, "block", { width: 150, height: 72 }),
      atBeat(25.5, "spike"), atBeat(26, "spike"),
      atBeat(28.5, "block", { width: 118, height: 112 }),
      atBeat(31.5, "spike"),
      atBeat(34, "block", { width: 190, height: 54 }),
      atBeat(37, "spike"), atBeat(37.5, "spike"),
      atBeat(40, "block", { width: 126, height: 94 }),
      atBeat(42, "spike"),
    ],
  },
  {
    id: "skyline-steps",
    number: 4,
    name: "Skyline Steps",
    bpm: 132,
    beats: 46,
    audioRoot: 246.94,
    theme: {
      skyA: "#10233a", skyB: "#173f4b", skyC: "#3b1835",
      mountainA: "#29445a", mountainB: "#172d3d",
      hot: "#ff5d8f", gold: "#f8e16c", mint: "#62e6a7", accent: "#4ea8de",
    },
    obstacles: [
      atBeat(4, "block", { width: 198, height: 42, elevation: 42 }),
      atBeat(4.35, "spike"),
      atBeat(6, "block", { width: 184, height: 42, elevation: 58 }),
      atBeat(6.35, "spike"),
      atBeat(8, "block", { width: 216, height: 42, elevation: 38 }),
      atBeat(8.45, "spike"),
      atBeat(11.5, "spike"),
      atBeat(14, "block", { width: 210, height: 44, elevation: 46 }),
      atBeat(14.4, "spike"),
      atBeat(16.25, "block", { width: 178, height: 42, elevation: 68 }),
      atBeat(16.55, "spike"),
      atBeat(18.25, "block", { width: 232, height: 44, elevation: 48 }),
      atBeat(18.65, "spike"),
      atBeat(22, "spike"), atBeat(22.5, "spike"),
      atBeat(25, "block", { width: 220, height: 42, elevation: 54 }),
      atBeat(25.4, "spike"),
      atBeat(27.25, "block", { width: 182, height: 42, elevation: 72 }),
      atBeat(27.55, "spike"),
      atBeat(29.25, "block", { width: 238, height: 42, elevation: 44 }),
      atBeat(29.65, "spike"),
      atBeat(33, "spike"),
      atBeat(35.5, "block", { width: 190, height: 44, elevation: 62 }),
      atBeat(35.85, "spike"),
      atBeat(37.5, "block", { width: 206, height: 42, elevation: 42 }),
      atBeat(37.9, "spike"),
      atBeat(41, "spike"), atBeat(41.5, "spike"),
      atBeat(44, "block", { width: 170, height: 42, elevation: 56 }),
    ],
  },
  {
    id: "one-hold-core",
    number: 5,
    name: "One Hold Core",
    bpm: ONE_HOLD_BPM,
    beats: 56,
    audioRoot: 277.18,
    theme: {
      skyA: "#190d25", skyB: "#17343d", skyC: "#411620",
      mountainA: "#432344", mountainB: "#182c35",
      hot: "#ff416c", gold: "#ffe66d", mint: "#42f5c5", accent: "#00a8e8",
    },
    holdStartDistance: oneHoldCourse.holdStartDistance,
    holdWindowSeconds: INITIAL_HOLD_WINDOW_SECONDS,
    obstacles: oneHoldCourse.obstacles,
  },
];

let view = { width: 1280, height: 720, ground: 530, dpr: 1 };
let state = "menu";
let selectedStageIndex = 0;
let currentStage = stages[selectedStageIndex];
let distance = 0;
let speed = getStageSpeed(currentStage);
let score = 0;
let bestScores = loadBestScores();
let best = Number(bestScores[currentStage.id] || 0);
let lastTime = 0;
let particles = [];
let beatPulse = 0;
let beatIndex = 0;
let audio = null;
let nextBeatAt = 0;
let stageStartedAt = null;
let inputHeld = false;
let resultAction = "restart";
let collisionStartIndex = 0;
let displayedScore = 0;
let displayedProgress = 0;
let stageInputStarted = false;

bestEl.textContent = best;
stageNameEl.textContent = getStageLabel(currentStage);

function getStageSpeed(stage) {
  return BEAT_DISTANCE * (stage.bpm / 60);
}

function getStageLabel(stage) {
  return `STAGE ${stage.number} · ${stage.name.toUpperCase()} · ${stage.bpm} BPM`;
}

function loadBestScores() {
  try {
    const saved = JSON.parse(localStorage.getItem("dash-runner-stage-bests") || "{}");
    const legacyBest = Number(localStorage.getItem("dash-runner-best") || 0);
    if (!saved[stages[0].id] && legacyBest) saved[stages[0].id] = legacyBest;
    return saved;
  } catch {
    return {};
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  view.width = rect.width;
  view.height = rect.height;
  view.ground = Math.round(rect.height * 0.76);
  const dprLimit = rect.width <= 900 ? 1.25 : 1.5;
  view.dpr = Math.min(window.devicePixelRatio || 1, dprLimit);

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
  speed = getStageSpeed(currentStage);
  score = 0;
  particles = [];
  beatPulse = 0;
  beatIndex = 0;
  player.y = view.ground - player.size;
  player.previousY = player.y;
  player.velocityY = 0;
  player.rotation = 0;
  player.grounded = true;
  collisionStartIndex = 0;
  displayedScore = 0;
  displayedProgress = 0;
  stageInputStarted = false;
  scoreEl.textContent = "0";
  progressFill.style.transform = "scaleX(0)";
}

function startGame() {
  resetGame();
  state = "playing";
  stageStartedAt = performance.now() / 1000 + 0.08;
  menu.classList.remove("visible");
  result.classList.remove("visible");
  if (currentStage.holdStartDistance !== undefined) inputHeld = false;
  startAudio();
}

function selectStage(index) {
  selectedStageIndex = Math.max(0, Math.min(stages.length - 1, index));
  currentStage = stages[selectedStageIndex];
  best = Number(bestScores[currentStage.id] || 0);
  bestEl.textContent = best;
  stageNameEl.textContent = getStageLabel(currentStage);

  for (const button of stageButtons) {
    const selected = Number(button.dataset.stage) === selectedStageIndex;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }

  resetGame();
}

function finishGame() {
  state = "complete";
  updateBest();
  stopAudio();
  resultKicker.textContent = "complete";
  resultTitle.textContent = `${currentStage.name} 완주`;
  resultScore.textContent = `score ${score}`;
  resultAction = selectedStageIndex < stages.length - 1 ? "next" : "restart";
  restartButton.textContent = resultAction === "next" ? "다음 스테이지" : "다시 플레이";
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
  resultScore.textContent = `${Math.floor((distance / (currentStage.beats * BEAT_DISTANCE)) * 100)}% · score ${score}`;
  resultAction = "restart";
  restartButton.textContent = "다시 플레이";
  result.classList.add("visible");
}

function updateBest() {
  if (score <= best) return;
  best = score;
  bestScores[currentStage.id] = best;
  localStorage.setItem("dash-runner-stage-bests", JSON.stringify(bestScores));
  bestEl.textContent = best;
}

function jump() {
  if (!player.grounded) return;
  player.velocityY = -JUMP_SPEED;
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
  nextBeatAt = audio.currentTime + 0.08;
}

function stopAudio() {
  nextBeatAt = 0;
  stageStartedAt = null;
}

function scheduleBeat() {
  if (!audio || state !== "playing") return;
  const now = audio.currentTime;
  const beatLength = 60 / currentStage.bpm;
  while (nextBeatAt && nextBeatAt < now + 0.08) {
    const accent = beatIndex % 4 === 0;
    const frequency = accent
      ? currentStage.audioRoot
      : beatIndex % 2 === 0
        ? currentStage.audioRoot * 1.5
        : currentStage.audioRoot * 1.2;
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

  const stageLength = currentStage.beats * BEAT_DISTANCE;
  if (stageStartedAt !== null) {
    distance = Math.max(0, (performance.now() / 1000 - stageStartedAt) * speed);
  } else {
    distance += speed * delta;
  }
  const progress = Math.min(distance / stageLength, 1);
  score = Math.floor(distance / 12);
  const progressPercent = Math.floor(progress * 100);
  if (score !== displayedScore) {
    displayedScore = score;
    scoreEl.textContent = score;
  }
  if (progressPercent !== displayedProgress) {
    displayedProgress = progressPercent;
    progressFill.style.transform = `scaleX(${progressPercent / 100})`;
  }

  player.previousY = player.y;
  player.grounded = false;
  player.velocityY += GRAVITY * delta;
  player.y += player.velocityY * delta;

  if (player.y >= view.ground - player.size) {
    player.y = view.ground - player.size;
    player.velocityY = 0;
    player.grounded = true;
  }

  checkCollisions();
  if (state !== "playing") return;

  if (inputHeld && player.grounded) jump();

  if (!player.grounded) {
    player.rotation += delta * speed * 0.015;
  } else {
    player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
  }

  emitTrail(delta);
  updateParticles(delta);
  beatPulse = Math.max(0, beatPulse - delta * 2.6);

  if (distance >= stageLength) {
    displayedProgress = 100;
    progressFill.style.transform = "scaleX(1)";
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

  const obstacles = currentStage.obstacles;
  while (collisionStartIndex < obstacles.length) {
    const obstacle = obstacles[collisionStartIndex];
    const width = obstacle.width ?? 42;
    if (obstacle.x + width >= distance - 64) break;
    collisionStartIndex += 1;
  }

  for (let index = collisionStartIndex; index < obstacles.length; index += 1) {
    const obstacle = obstacles[index];
    if (obstacle.x > distance + player.size + 96) break;
    const width = obstacle.width ?? 42;
    const height = obstacle.height ?? 42;
    const elevation = obstacle.elevation ?? 0;
    const rect = {
      x: obstacle.x,
      y: view.ground - height - elevation,
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

    const horizontalOverlap =
      playerRect.x < rect.x + rect.width &&
      playerRect.x + playerRect.width > rect.x;
    const previousBottom = player.previousY + player.size;
    const currentBottom = player.y + player.size;
    const landedOnTop =
      horizontalOverlap &&
      player.velocityY >= 0 &&
      previousBottom <= rect.y + 6 &&
      currentBottom >= rect.y;

    if (landedOnTop) {
      player.y = rect.y - player.size;
      player.velocityY = 0;
      player.grounded = true;
      playerRect.y = player.y + 4;
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
  const theme = currentStage.theme;
  const sky = ctx.createLinearGradient(0, 0, view.width, view.height);
  sky.addColorStop(0, theme.skyA);
  sky.addColorStop(0.45, theme.skyB);
  sky.addColorStop(1, theme.skyC);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  ctx.save();
  ctx.globalAlpha = 0.55 + beatPulse * 0.18;
  drawSun(view.width * 0.78, view.height * 0.24, 62 + pulse);
  ctx.restore();

  drawMountains(0.12, theme.mountainA, 0.32);
  drawMountains(0.2, theme.mountainB, 0.52);
  drawGrid();
}

function drawSun(x, y, radius) {
  const theme = currentStage.theme;
  const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, theme.gold);
  gradient.addColorStop(0.54, theme.hot);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
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
  ctx.strokeStyle = currentStage.theme.mint;
  ctx.globalAlpha = 0.16;
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
  const theme = currentStage.theme;
  const groundGradient = ctx.createLinearGradient(0, view.ground - 22, 0, view.height);
  groundGradient.addColorStop(0, theme.gold);
  groundGradient.addColorStop(0.18, theme.hot);
  groundGradient.addColorStop(0.22, "#2c1220");
  groundGradient.addColorStop(1, "#120d18");
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, view.ground - 22, view.width, view.height - view.ground + 22);

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  const halfBeat = BEAT_DISTANCE / 2;
  const offset = -(distance % halfBeat);
  for (let x = offset; x < view.width; x += halfBeat) {
    const beatIndexAtX = Math.round((distance + x) / halfBeat);
    ctx.fillRect(x, view.ground - 18, beatIndexAtX % 2 === 0 ? 32 : 16, 5);
  }
}

function drawObstacles() {
  const obstacles = currentStage.obstacles;
  const firstVisibleIndex = Math.max(0, collisionStartIndex - 1);
  const maxWorldX = distance + (view.width - player.x) + 180;

  for (let index = firstVisibleIndex; index < obstacles.length; index += 1) {
    const obstacle = obstacles[index];
    if (obstacle.x > maxWorldX) break;
    const x = obstacle.x - distance + player.x;
    if (x < -180 || x > view.width + 180) continue;

    if (obstacle.type === "spike") {
      drawSpike(x, view.ground);
    } else {
      const elevation = obstacle.elevation ?? 0;
      drawBlock(x, view.ground - obstacle.height - elevation, obstacle.width, obstacle.height, elevation);
    }
  }
}

function createSprite(width, height, drawSprite) {
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = Math.ceil(width * SPRITE_SCALE);
  spriteCanvas.height = Math.ceil(height * SPRITE_SCALE);
  const spriteContext = spriteCanvas.getContext("2d");
  spriteContext.scale(SPRITE_SCALE, SPRITE_SCALE);
  drawSprite(spriteContext);
  return { canvas: spriteCanvas, width, height };
}

function getSpikeSprite() {
  const key = `spike:${currentStage.id}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const padding = 16;
  const sprite = createSprite(74, 75, (spriteContext) => {
    const theme = currentStage.theme;
    const x = padding;
    const groundY = padding + 43;
    spriteContext.shadowColor = theme.hot;
    spriteContext.shadowBlur = 16;
    const gradient = spriteContext.createLinearGradient(x, groundY - 42, x, groundY);
    gradient.addColorStop(0, "#f9f4df");
    gradient.addColorStop(0.44, theme.gold);
    gradient.addColorStop(1, theme.hot);
    spriteContext.fillStyle = gradient;
    spriteContext.beginPath();
    spriteContext.moveTo(x, groundY);
    spriteContext.lineTo(x + 21, groundY - 43);
    spriteContext.lineTo(x + 42, groundY);
    spriteContext.closePath();
    spriteContext.fill();
    spriteContext.strokeStyle = "rgba(23, 16, 24, 0.85)";
    spriteContext.lineWidth = 3;
    spriteContext.stroke();
  });
  spriteCache.set(key, sprite);
  return sprite;
}

function getBlockSprite(width, height, floating) {
  const key = `block:${currentStage.id}:${width}:${height}:${floating ? 1 : 0}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const padding = 16;
  const sprite = createSprite(width + padding * 2, height + padding * 2, (spriteContext) => {
    const theme = currentStage.theme;
    const x = padding;
    const y = padding;
    spriteContext.shadowColor = theme.mint;
    spriteContext.shadowBlur = 16;
    const gradient = spriteContext.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, theme.mint);
    gradient.addColorStop(0.52, theme.accent);
    gradient.addColorStop(1, theme.hot);
    spriteContext.fillStyle = gradient;
    spriteContext.fillRect(x, y, width, height);
    spriteContext.fillStyle = "rgba(255, 255, 255, 0.18)";
    spriteContext.fillRect(x + 6, y + 6, width - 12, 7);
    spriteContext.strokeStyle = "rgba(13, 12, 20, 0.84)";
    spriteContext.lineWidth = 4;
    spriteContext.strokeRect(x, y, width, height);

    if (floating) {
      spriteContext.globalAlpha = 0.3;
      spriteContext.fillStyle = theme.mint;
      spriteContext.fillRect(x + 8, y + height + 8, width - 16, 3);
    }
  });
  spriteCache.set(key, sprite);
  return sprite;
}

function getPlayerSprite() {
  const key = "player";
  if (spriteCache.has(key)) return spriteCache.get(key);

  const padding = 18;
  const sprite = createSprite(player.size + padding * 2, player.size + padding * 2, (spriteContext) => {
    const x = padding;
    const y = padding;
    const gradient = spriteContext.createLinearGradient(x, y, x + player.size, y + player.size);
    gradient.addColorStop(0, "#ffd166");
    gradient.addColorStop(0.54, "#ff4f6d");
    gradient.addColorStop(1, "#7c5cff");
    spriteContext.shadowColor = "rgba(255, 209, 102, 0.55)";
    spriteContext.shadowBlur = 18;
    spriteContext.fillStyle = gradient;
    spriteContext.fillRect(x, y, player.size, player.size);
    spriteContext.strokeStyle = "#171018";
    spriteContext.lineWidth = 4;
    spriteContext.strokeRect(x, y, player.size, player.size);
    spriteContext.fillStyle = "#171018";
    spriteContext.fillRect(x + 10, y + 13, 7, 7);
    spriteContext.fillRect(x + 28, y + 13, 7, 7);
    spriteContext.fillRect(x + 11, y + 30, 24, 5);
  });
  spriteCache.set(key, sprite);
  return sprite;
}

function drawSpike(x, groundY) {
  const sprite = getSpikeSprite();
  ctx.drawImage(sprite.canvas, x - 16, groundY - 59, sprite.width, sprite.height);
}

function drawBlock(x, y, width, height, elevation = 0) {
  const sprite = getBlockSprite(width, height, elevation > 0);
  ctx.drawImage(sprite.canvas, x - 16, y - 16, sprite.width, sprite.height);
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
  const sprite = getPlayerSprite();
  ctx.drawImage(sprite.canvas, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
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

function isJumpKey(event) {
  return ["Space", "ArrowUp", "KeyW"].includes(event.code);
}

function handlePress(event) {
  if (event.type === "keydown") {
    if (!isJumpKey(event) || event.repeat) return;
    event.preventDefault();
  }

  if (event.type === "pointerdown") {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
  }

  inputHeld = true;

  if (state === "menu") {
    startGame();
    return;
  }

  if (state === "dead" || state === "complete") {
    handleResultAction();
    return;
  }

  if (currentStage.holdStartDistance !== undefined && !stageInputStarted) {
    stageInputStarted = true;
    const timingTolerance = speed * (currentStage.holdWindowSeconds / 2);
    if (Math.abs(distance - currentStage.holdStartDistance) > timingTolerance) {
      inputHeld = false;
      crash();
      return;
    }
  }

  jump();
}

function handleRelease(event) {
  if (event.type === "keyup" && !isJumpKey(event)) return;

  if (event.type === "pointerup" || event.type === "pointercancel") {
    event.preventDefault();
    canvas.releasePointerCapture?.(event.pointerId);
  }

  inputHeld = false;
}

function handleResultAction() {
  if (resultAction === "next") selectStage(selectedStageIndex + 1);
  startGame();
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", handlePress);
window.addEventListener("keyup", handleRelease);
window.addEventListener("blur", () => {
  inputHeld = false;
});
canvas.addEventListener("pointerdown", handlePress);
canvas.addEventListener("pointerup", handleRelease);
canvas.addEventListener("pointercancel", handleRelease);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", handleResultAction);
for (const button of stageButtons) {
  button.addEventListener("click", () => selectStage(Number(button.dataset.stage)));
}

resize();
resetGame();
requestAnimationFrame(frame);
