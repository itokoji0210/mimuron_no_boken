const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const hairCount = document.querySelector("#hairCount");
const progressCount = document.querySelector("#progressCount");
const sorrowCount = document.querySelector("#sorrowCount");

const W = canvas.width;
const H = canvas.height;
const groundY = 438;
const keys = new Set();

const stages = [
  {
    name: "朝礼回廊",
    quote: "今日も全員、前向きに後ろ向きだ。",
    color: "#6b7f95",
    hazards: [
      { x: 560, w: 42, label: "議事録" },
      { x: 860, w: 52, label: "未読" },
      { x: 1220, w: 46, label: "稟議" }
    ],
    platforms: [
      { x: 400, y: 340, w: 130 },
      { x: 980, y: 310, w: 150 }
    ]
  },
  {
    name: "締切坂",
    quote: "急ぎではないが、昨日ほしい。",
    color: "#8a6f52",
    hazards: [
      { x: 440, w: 44, label: "差戻" },
      { x: 730, w: 48, label: "炎上" },
      { x: 1040, w: 44, label: "修正" },
      { x: 1380, w: 58, label: "再提出" }
    ],
    platforms: [
      { x: 580, y: 330, w: 130 },
      { x: 900, y: 280, w: 120 },
      { x: 1190, y: 330, w: 150 }
    ]
  },
  {
    name: "役員沼",
    quote: "結論は任せる。責任も任せる。",
    color: "#5f7b62",
    hazards: [
      { x: 360, w: 60, label: "忖度" },
      { x: 660, w: 54, label: "空気" },
      { x: 990, w: 46, label: "詰問" },
      { x: 1280, w: 70, label: "無茶振り" },
      { x: 1530, w: 50, label: "沈黙" }
    ],
    platforms: [
      { x: 500, y: 315, w: 120 },
      { x: 790, y: 255, w: 110 },
      { x: 1110, y: 300, w: 120 },
      { x: 1450, y: 250, w: 130 }
    ]
  }
];

let state;
let lastTime = 0;

function resetGame() {
  state = {
    running: false,
    won: false,
    gameOver: false,
    stageIndex: 0,
    scroll: 0,
    hair: 12,
    sorrow: 0,
    invincible: 0,
    message: "",
    messageTime: 0,
    fallenHair: [],
    boss: {
      x: 120,
      y: groundY - 82,
      w: 52,
      h: 82,
      vx: 0,
      vy: 0,
      grounded: true,
      face: 1
    }
  };
  updateHud();
}

function startGame() {
  if (state.gameOver || state.won) resetGame();
  state.running = true;
  overlay.classList.add("hidden");
}

function currentStage() {
  return stages[state.stageIndex];
}

function stageLength() {
  return 1780;
}

function updateHud() {
  hairCount.textContent = state.hair;
  sorrowCount.textContent = state.sorrow;
  const progress = Math.min(100, Math.round((state.scroll / (stageLength() - W + 210)) * 100));
  progressCount.textContent = `${Math.max(0, progress)}%`;
}

function loseHair(reason) {
  if (state.invincible > 0 || state.gameOver || state.won) return;
  state.hair -= 1;
  state.sorrow += 1;
  state.invincible = 1.3;
  state.message = reason;
  state.messageTime = 1.5;
  for (let i = 0; i < 7; i += 1) {
    state.fallenHair.push({
      x: state.boss.x + 12 + Math.random() * 30,
      y: state.boss.y + 4,
      vx: -90 + Math.random() * 180,
      vy: -180 - Math.random() * 90,
      life: 1.2
    });
  }
  if (state.hair <= 0) {
    state.gameOver = true;
    state.running = false;
    showOverlay("頭皮が定時退社しました", "Rで再挑戦。悲哀は消えないが、髪は初期化される。", "もう一度");
  }
  updateHud();
}

function showOverlay(title, text, button) {
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = text;
  startButton.textContent = button;
  overlay.classList.remove("hidden");
}

function nextStage() {
  if (state.stageIndex < stages.length - 1) {
    state.stageIndex += 1;
    state.scroll = 0;
    state.boss.x = 120;
    state.boss.y = groundY - state.boss.h;
    state.boss.vy = 0;
    state.message = currentStage().name;
    state.messageTime = 1.6;
  } else {
    state.won = true;
    state.running = false;
    showOverlay("ミムロン、明日も出社", "すべての困難を越えた。残った髪の毛が、彼の勲章だ。", "再び悲哀へ");
  }
  updateHud();
}

function update(dt) {
  if (!state.running) return;
  const boss = state.boss;
  const stage = currentStage();
  const move = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
  boss.vx = move * 250;
  if (move !== 0) boss.face = Math.sign(move);

  if ((keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW")) && boss.grounded) {
    boss.vy = -540;
    boss.grounded = false;
  }

  boss.vy += 1500 * dt;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  if (boss.x < 40) boss.x = 40;
  if (boss.x > W * 0.56 && boss.vx > 0) {
    state.scroll += boss.vx * dt;
    boss.x = W * 0.56;
  }

  boss.grounded = false;
  const floor = groundY - boss.h;
  if (boss.y >= floor) {
    boss.y = floor;
    boss.vy = 0;
    boss.grounded = true;
  }

  for (const platform of stage.platforms) {
    const px = platform.x - state.scroll;
    const hitX = boss.x + boss.w > px && boss.x < px + platform.w;
    const hitY = boss.y + boss.h > platform.y - 12 && boss.y + boss.h < platform.y + 22;
    if (hitX && hitY && boss.vy >= 0) {
      boss.y = platform.y - boss.h;
      boss.vy = 0;
      boss.grounded = true;
    }
  }

  for (const hazard of stage.hazards) {
    const hx = hazard.x - state.scroll;
    const collides = boss.x + boss.w - 8 > hx && boss.x + 8 < hx + hazard.w && boss.y + boss.h > groundY - 58;
    if (collides) {
      loseHair(`${hazard.label}で髪が抜けた`);
    }
  }

  if (state.scroll > stageLength() - W + 190) {
    nextStage();
  }

  state.invincible = Math.max(0, state.invincible - dt);
  state.messageTime = Math.max(0, state.messageTime - dt);
  state.fallenHair = state.fallenHair.filter((hair) => {
    hair.vy += 780 * dt;
    hair.x += hair.vx * dt;
    hair.y += hair.vy * dt;
    hair.life -= dt;
    return hair.life > 0;
  });
  updateHud();
}

function drawBackground(stage) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, stage.color);
  sky.addColorStop(1, "#222126");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255, 246, 205, 0.18)";
  for (let i = 0; i < 8; i += 1) {
    const x = (i * 180 - state.scroll * 0.25) % (W + 220) - 90;
    ctx.fillRect(x, 82 + (i % 3) * 28, 112, 54);
    ctx.fillRect(x + 18, 70 + (i % 2) * 18, 70, 80);
  }

  ctx.fillStyle = "#2e2a25";
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = "#514330";
  for (let x = -((state.scroll * 0.8) % 58); x < W; x += 58) {
    ctx.fillRect(x, groundY + 28, 34, 8);
  }
}

function drawBoss() {
  const b = state.boss;
  ctx.save();
  if (state.invincible > 0 && Math.floor(state.invincible * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.translate(b.x + b.w / 2, b.y);
  ctx.scale(b.face, 1);

  ctx.fillStyle = "#35302b";
  ctx.fillRect(-22, 28, 44, 52);
  ctx.fillStyle = "#6d4636";
  ctx.fillRect(-18, 38, 36, 10);
  ctx.fillStyle = "#f0bf86";
  ctx.beginPath();
  ctx.roundRect(-24, 0, 48, 40, 16);
  ctx.fill();

  ctx.fillStyle = "#1e1a18";
  const hairStrands = Math.max(0, Math.min(12, state.hair));
  for (let i = 0; i < hairStrands; i += 1) {
    const x = -20 + i * 3.6;
    ctx.fillRect(x, -10 - (i % 3) * 3, 3, 14);
  }

  ctx.fillStyle = "#151515";
  ctx.fillRect(5, 15, 5, 5);
  ctx.fillStyle = "#8b2f25";
  ctx.fillRect(-5, 27, 18, 4);
  ctx.fillStyle = "#d9d2c2";
  ctx.fillRect(-30, 36, 10, 32);
  ctx.fillRect(20, 36, 10, 32);
  ctx.fillStyle = "#222";
  ctx.fillRect(-18, 80, 14, 20);
  ctx.fillRect(5, 80, 14, 20);
  ctx.restore();
}

function drawHazards(stage) {
  for (const hazard of stage.hazards) {
    const x = hazard.x - state.scroll;
    if (x < -100 || x > W + 100) continue;
    ctx.fillStyle = "#b83d2f";
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + hazard.w / 2, groundY - 62);
    ctx.lineTo(x + hazard.w, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff0d3";
    ctx.font = "700 14px Meiryo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(hazard.label, x + hazard.w / 2, groundY - 68);
  }
}

function drawPlatforms(stage) {
  for (const p of stage.platforms) {
    const x = p.x - state.scroll;
    ctx.fillStyle = "#604b35";
    ctx.fillRect(x, p.y, p.w, 18);
    ctx.fillStyle = "#d0aa64";
    ctx.fillRect(x, p.y, p.w, 5);
  }
}

function drawText(stage) {
  ctx.fillStyle = "rgba(20, 18, 16, 0.72)";
  ctx.fillRect(24, 22, 374, 82);
  ctx.fillStyle = "#ffd86b";
  ctx.font = "800 28px Meiryo, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(stage.name, 42, 58);
  ctx.fillStyle = "#f3e8d4";
  ctx.font = "16px Meiryo, sans-serif";
  ctx.fillText(stage.quote, 42, 86);

  if (state.messageTime > 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(W / 2 - 190, 128, 380, 48);
    ctx.fillStyle = "#fff6d7";
    ctx.font = "800 22px Meiryo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.message, W / 2, 159);
  }
}

function drawHairParticles() {
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  for (const hair of state.fallenHair) {
    ctx.globalAlpha = Math.max(0, hair.life);
    ctx.beginPath();
    ctx.arc(hair.x, hair.y, 7, 0.2, 2.7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function render() {
  const stage = currentStage();
  drawBackground(stage);
  drawPlatforms(stage);
  drawHazards(stage);
  drawBoss();
  drawHairParticles();
  drawText(stage);
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyR") {
    resetGame();
    startGame();
  }
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
startButton.addEventListener("click", startGame);

resetGame();
requestAnimationFrame(loop);
