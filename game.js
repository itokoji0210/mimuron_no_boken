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
const maxLife = 5;
const keys = new Set();
const touch = { left: false, right: false, jump: false };

const stages = [
  {
    name: "朝礼回廊",
    quote: "昨日の反省を今日の残業に変換する場所。",
    color: "#667c91",
    boss: null,
    hazards: [
      { x: 520, w: 44, label: "議事録" },
      { x: 820, w: 52, label: "未読" },
      { x: 1180, w: 46, label: "稟議" }
    ],
    platforms: [
      { x: 390, y: 338, w: 130 },
      { x: 940, y: 310, w: 150 }
    ]
  },
  {
    name: "締切坂",
    quote: "急ぎではない。ただし昨日ほしい。",
    color: "#8a6f52",
    boss: {
      name: "タカタ・ソーム",
      x: 1460,
      w: 90,
      h: 116,
      hp: 3,
      label: "中ボス",
      line: "その資料、味は薄いが圧は濃いな。",
      defeat: "タカタ・ソームは会議室の予約だけ残して消えた。"
    },
    hazards: [
      { x: 420, w: 44, label: "差戻" },
      { x: 720, w: 48, label: "炎上" },
      { x: 1060, w: 44, label: "修正" },
      { x: 1320, w: 58, label: "再提出" }
    ],
    platforms: [
      { x: 560, y: 330, w: 130 },
      { x: 900, y: 280, w: 120 },
      { x: 1200, y: 330, w: 150 }
    ]
  },
  {
    name: "役員沼",
    quote: "責任の所在だけが、いつも在宅勤務。",
    color: "#5f7b62",
    boss: {
      name: "タッキー・キョクチョウ",
      x: 1540,
      w: 112,
      h: 134,
      hp: 5,
      label: "ラスボス",
      line: "君の裁量でやってくれ。結果は私の顔色で決まる。",
      defeat: "タッキー・キョクチョウは『検討する』と言い残し、実質敗北した。"
    },
    hazards: [
      { x: 360, w: 58, label: "忖度" },
      { x: 660, w: 54, label: "空気" },
      { x: 990, w: 46, label: "詰問" },
      { x: 1280, w: 70, label: "無茶振り" }
    ],
    platforms: [
      { x: 500, y: 315, w: 120 },
      { x: 790, y: 255, w: 110 },
      { x: 1110, y: 300, w: 120 },
      { x: 1430, y: 250, w: 130 }
    ]
  }
];

let state;
let lastTime = 0;
let audio;

function cloneBoss(stage) {
  if (!stage.boss) return null;
  return {
    ...stage.boss,
    y: groundY - stage.boss.h,
    maxHp: stage.boss.hp,
    hitCooldown: 0,
    defeated: false,
    wobble: 0
  };
}

function resetGame() {
  state = {
    running: false,
    won: false,
    gameOver: false,
    stageIndex: 0,
    scroll: 0,
    life: maxLife,
    sorrow: 0,
    invincible: 0,
    message: "",
    messageTime: 0,
    fallenHair: [],
    stageBoss: cloneBoss(stages[0]),
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

function ensureAudio() {
  if (audio) {
    audio.ctx.resume();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const ctxAudio = new AudioContext();
  const master = ctxAudio.createGain();
  master.gain.value = 0.08;
  master.connect(ctxAudio.destination);
  audio = { ctx: ctxAudio, master, timer: null, beat: 0 };
  startBgm();
}

function blip(freq, duration, type = "square", gain = 0.35) {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const amp = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(amp);
  amp.connect(audio.master);
  osc.start(now);
  osc.stop(now + duration);
}

function startBgm() {
  if (!audio || audio.timer) return;
  const melody = [262, 330, 392, 330, 294, 370, 440, 196];
  const bass = [98, 98, 131, 98, 110, 110, 147, 73];
  audio.timer = setInterval(() => {
    if (!state.running) return;
    const i = audio.beat % melody.length;
    blip(melody[i], 0.12, i % 3 === 0 ? "triangle" : "square", 0.18);
    if (i % 2 === 0) blip(bass[i], 0.18, "sawtooth", 0.13);
    audio.beat += 1;
  }, 210);
}

function startGame() {
  ensureAudio();
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
  hairCount.textContent = `${state.life}/${maxLife}`;
  sorrowCount.textContent = state.sorrow;
  const progress = Math.min(100, Math.round((state.scroll / (stageLength() - W + 210)) * 100));
  progressCount.textContent = `${Math.max(0, progress)}%`;
}

function loseLife(reason) {
  if (state.invincible > 0 || state.gameOver || state.won) return;
  state.life -= 1;
  state.sorrow += 1;
  state.invincible = 1.35;
  state.message = reason;
  state.messageTime = 1.7;
  blip(92, 0.3, "sawtooth", 0.42);
  for (let i = 0; i < 8; i += 1) {
    state.fallenHair.push({
      x: state.boss.x + 12 + Math.random() * 30,
      y: state.boss.y + 4,
      vx: -100 + Math.random() * 200,
      vy: -180 - Math.random() * 100,
      life: 1.25
    });
  }
  if (state.life <= 0) {
    state.gameOver = true;
    state.running = false;
    showOverlay("頭皮が希望退職しました", "ライフ5回分を使い切った。会社は明日も通常営業です。", "もう一度出社");
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
    state.stageBoss = cloneBoss(currentStage());
    state.boss.x = 120;
    state.boss.y = groundY - state.boss.h;
    state.boss.vy = 0;
    state.message = currentStage().name;
    state.messageTime = 1.8;
  } else {
    state.won = true;
    state.running = false;
    showOverlay("称号獲得: ウンドーブチョー", "ミムロンは全困難を越えた。残った髪と倫理観は、どちらも希少資源だ。", "再び悲哀へ");
    blip(523, 0.16, "triangle", 0.35);
    setTimeout(() => blip(659, 0.16, "triangle", 0.35), 120);
    setTimeout(() => blip(784, 0.32, "triangle", 0.35), 260);
  }
  updateHud();
}

function isJumpPressed() {
  return keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW") || touch.jump;
}

function updateBossFight(dt) {
  const stageBoss = state.stageBoss;
  if (!stageBoss || stageBoss.defeated) return;
  const boss = state.boss;
  stageBoss.hitCooldown = Math.max(0, stageBoss.hitCooldown - dt);
  stageBoss.wobble += dt;
  const bx = stageBoss.x - state.scroll;
  const collides =
    boss.x + boss.w > bx &&
    boss.x < bx + stageBoss.w &&
    boss.y + boss.h > stageBoss.y &&
    boss.y < stageBoss.y + stageBoss.h;

  if (!collides) return;

  const stomp = boss.vy > 120 && boss.y + boss.h < stageBoss.y + 34;
  if (stomp && stageBoss.hitCooldown <= 0) {
    stageBoss.hp -= 1;
    stageBoss.hitCooldown = 0.55;
    boss.vy = -430;
    state.message = stageBoss.hp > 0 ? `${stageBoss.name}「${stageBoss.line}」` : stageBoss.defeat;
    state.messageTime = 2.2;
    blip(620, 0.08, "square", 0.32);
    blip(310, 0.12, "triangle", 0.22);
    if (stageBoss.hp <= 0) {
      stageBoss.defeated = true;
      state.sorrow += 2;
      updateHud();
    }
  } else {
    loseLife(`${stageBoss.name}の評価面談で髪が抜けた`);
    boss.vx = -180;
    boss.x = Math.max(40, boss.x - 26);
  }
}

function update(dt) {
  if (!state.running) return;
  const boss = state.boss;
  const stage = currentStage();
  const move = (keys.has("ArrowRight") || keys.has("KeyD") || touch.right ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") || touch.left ? 1 : 0);
  boss.vx = move * 250;
  if (move !== 0) boss.face = Math.sign(move);

  if (isJumpPressed() && boss.grounded) {
    boss.vy = -540;
    boss.grounded = false;
    blip(440, 0.08, "triangle", 0.12);
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
      loseLife(`${hazard.label}で髪が抜けた。毛根は労基に相談中。`);
    }
  }

  updateBossFight(dt);

  const bossGateOpen = !state.stageBoss || state.stageBoss.defeated;
  if (state.scroll > stageLength() - W + 190 && bossGateOpen) {
    nextStage();
  } else if (state.scroll > stageLength() - W + 190 && !bossGateOpen) {
    state.scroll = stageLength() - W + 180;
    state.message = `${state.stageBoss.label}: ${state.stageBoss.name}を踏んで突破`;
    state.messageTime = 1.4;
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

  ctx.fillStyle = "rgba(255, 246, 205, 0.16)";
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
  const hairStrands = Math.max(0, state.life);
  for (let i = 0; i < hairStrands; i += 1) {
    const x = -18 + i * 9;
    ctx.fillRect(x, -11 - (i % 2) * 4, 4, 15);
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

function drawStageBoss() {
  const b = state.stageBoss;
  if (!b || b.defeated) return;
  const x = b.x - state.scroll;
  if (x < -160 || x > W + 140) return;
  const shake = Math.sin(b.wobble * 8) * 3;
  ctx.save();
  ctx.translate(x + b.w / 2 + shake, b.y);
  ctx.fillStyle = b.label === "ラスボス" ? "#492c69" : "#7a4538";
  ctx.fillRect(-b.w / 2, 26, b.w, b.h - 26);
  ctx.fillStyle = "#f0bf86";
  ctx.beginPath();
  ctx.roundRect(-b.w / 2 + 14, 0, b.w - 28, 48, 16);
  ctx.fill();
  ctx.fillStyle = "#1a1514";
  ctx.fillRect(-22, 15, 8, 7);
  ctx.fillRect(16, 15, 8, 7);
  ctx.fillStyle = "#d9d2c2";
  ctx.fillRect(-b.w / 2 - 12, 54, 18, 48);
  ctx.fillRect(b.w / 2 - 6, 54, 18, 48);
  ctx.fillStyle = "#ffd86b";
  ctx.font = "800 16px Meiryo, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(b.label, 0, -22);
  ctx.fillStyle = "#fff3d4";
  ctx.fillText(b.name, 0, -4);
  ctx.fillStyle = "#111";
  ctx.fillRect(-48, -48, 96, 9);
  ctx.fillStyle = "#e35f4f";
  ctx.fillRect(-48, -48, 96 * (b.hp / b.maxHp), 9);
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
  ctx.fillRect(24, 22, 430, 86);
  ctx.fillStyle = "#ffd86b";
  ctx.font = "800 28px Meiryo, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(stage.name, 42, 58);
  ctx.fillStyle = "#f3e8d4";
  ctx.font = "16px Meiryo, sans-serif";
  ctx.fillText(stage.quote, 42, 88);

  if (state.messageTime > 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(W / 2 - 290, 126, 580, 58);
    ctx.fillStyle = "#fff6d7";
    ctx.font = "800 20px Meiryo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.message, W / 2, 162);
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
  drawStageBoss();
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

function bindTouchButton(button, key) {
  const set = (value) => {
    touch[key] = value;
    button.classList.toggle("pressed", value);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    set(true);
    if (!state.running) startGame();
  });
  button.addEventListener("pointerup", () => set(false));
  button.addEventListener("pointercancel", () => set(false));
  button.addEventListener("pointerleave", () => set(false));
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
bindTouchButton(document.querySelector("#leftButton"), "left");
bindTouchButton(document.querySelector("#rightButton"), "right");
bindTouchButton(document.querySelector("#jumpButton"), "jump");

resetGame();
requestAnimationFrame(loop);
