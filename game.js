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
const stageSize = 1900;
const keys = new Set();
const touch = { left: false, right: false, jump: false };

const enemyTemplates = [
  { name: "ザザ1", line: "ポイント万歳", color: "#85513d" },
  { name: "クロチャン", line: "俺だって働いている", color: "#34343b" },
  { name: "ザザ2", line: "あいつが悪い", color: "#5d6d8e" }
];

const stages = [
  {
    name: "平社員フロア",
    rank: "平社員",
    quote: "出世階段の一段目は、だいたいコピー機の前にある。",
    color: "#667c91",
    enemies: [450, 760, 1120, 1440],
    platforms: [
      { x: 390, y: 338, w: 130 },
      { x: 940, y: 310, w: 150 }
    ],
    boss: null
  },
  {
    name: "主任デスク島",
    rank: "主任",
    quote: "権限は増えない。責任だけが名刺より先に刷られる。",
    color: "#8a6f52",
    enemies: [360, 650, 1010, 1290],
    platforms: [
      { x: 560, y: 330, w: 130 },
      { x: 900, y: 280, w: 120 },
      { x: 1200, y: 330, w: 150 }
    ],
    boss: {
      name: "タカタ・ソーム",
      x: 1500,
      w: 92,
      h: 116,
      hp: 3,
      label: "中ボス",
      line: "その資料、味は薄いが圧は濃いな。",
      defeat: "タカタ・ソームは会議室の予約だけ残して消えた。"
    }
  },
  {
    name: "部長前廊下",
    rank: "課長代理",
    quote: "境界線が見えたら、まず稟議に貼っておく。",
    color: "#5f7b62",
    enemies: [330, 610, 890, 1210, 1430],
    platforms: [
      { x: 500, y: 315, w: 120 },
      { x: 790, y: 255, w: 110 },
      { x: 1110, y: 300, w: 120 },
      { x: 1430, y: 250, w: 130 }
    ],
    boss: {
      name: "タッキー・キョクチョウ",
      x: 1580,
      w: 112,
      h: 134,
      hp: 5,
      label: "ラスボス",
      line: "君の裁量でやってくれ。結果は私の顔色で決まる。",
      defeat: "タッキー・キョクチョウは『検討する』と言い残し、実質敗北した。"
    }
  }
];

let state;
let lastTime = 0;
let audio;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeEnemies(stage) {
  return stage.enemies.map((x, index) => {
    const template = enemyTemplates[index % enemyTemplates.length];
    return {
      ...template,
      x,
      baseX: x,
      y: groundY - 82,
      w: 52,
      h: 82,
      vx: rand(45, 95) * (Math.random() > 0.5 ? 1 : -1),
      range: rand(70, 145),
      speakTimer: rand(0.4, 2.2),
      hitCooldown: 0
    };
  });
}

function makeItems(stageIndex) {
  const items = [
    { type: "expense", name: "ケーヒセツゲン", x: 680, y: 292, w: 38, h: 38, taken: false },
    { type: "expense", name: "ケーヒセツゲン", x: 1280, y: 388, w: 38, h: 38, taken: false }
  ];
  if (Math.random() < 0.34) {
    items.push({
      type: "boundary",
      name: "キョウカイショー",
      x: rand(520, 1450),
      y: rand(235, 350),
      w: 42,
      h: 42,
      taken: false,
      bob: 0
    });
  }
  if (stageIndex === 2) {
    items.push({ type: "boundary", name: "キョウカイショー", x: 1050, y: 238, w: 42, h: 42, taken: false, bob: 0 });
  }
  return items;
}

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

function loadStage(index) {
  state.stageIndex = index;
  state.scroll = 0;
  state.stageBoss = cloneBoss(stages[index]);
  state.enemies = makeEnemies(stages[index]);
  state.items = makeItems(index);
  state.boss.x = 120;
  state.boss.y = groundY - state.boss.h;
  state.boss.vx = 0;
  state.boss.vy = 0;
  state.boss.grounded = true;
  state.message = `${stages[index].rank}に昇格`;
  state.messageTime = 1.8;
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
    turbo: 0,
    message: "",
    messageTime: 0,
    fallenHair: [],
    stageBoss: null,
    enemies: [],
    items: [],
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
  loadStage(0);
  state.message = "";
  state.messageTime = 0;
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
  const turboMelody = [523, 659, 784, 988, 784, 659, 587, 523];
  const bass = [98, 98, 131, 98, 110, 110, 147, 73];
  audio.timer = setInterval(() => {
    if (!state.running) return;
    const i = audio.beat % melody.length;
    const fast = state.turbo > 0;
    blip((fast ? turboMelody : melody)[i], fast ? 0.08 : 0.12, i % 3 === 0 ? "triangle" : "square", fast ? 0.22 : 0.18);
    if (i % 2 === 0) blip(bass[i], fast ? 0.11 : 0.18, "sawtooth", 0.13);
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

function updateHud() {
  hairCount.textContent = `${state.life}/${maxLife}`;
  sorrowCount.textContent = state.sorrow;
  const progress = Math.min(100, Math.round((state.scroll / (stageSize - W + 210)) * 100));
  progressCount.textContent = `${Math.max(0, progress)}%`;
}

function spawnHair() {
  for (let i = 0; i < 8; i += 1) {
    state.fallenHair.push({
      x: state.boss.x + 12 + Math.random() * 30,
      y: state.boss.y + 4,
      vx: -100 + Math.random() * 200,
      vy: -180 - Math.random() * 100,
      life: 1.25
    });
  }
}

function loseLife(reason) {
  if (state.invincible > 0 || state.gameOver || state.won) return;
  state.life -= 1;
  state.sorrow += 1;
  state.invincible = 1.35;
  state.message = reason;
  state.messageTime = 1.7;
  blip(92, 0.3, "sawtooth", 0.42);
  spawnHair();
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
    loadStage(state.stageIndex + 1);
  } else {
    state.won = true;
    state.running = false;
    showOverlay("称号獲得: ウンドーブチョー", "ミムロンは出世への道を駆け抜けた。残った髪と倫理観は、どちらも希少資源だ。", "再び悲哀へ");
    blip(523, 0.16, "triangle", 0.35);
    setTimeout(() => blip(659, 0.16, "triangle", 0.35), 120);
    setTimeout(() => blip(784, 0.32, "triangle", 0.35), 260);
  }
  updateHud();
}

function isJumpPressed() {
  return keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW") || touch.jump;
}

function rectsOverlap(a, b) {
  return a.x + a.w > b.x && a.x < b.x + b.w && a.y + a.h > b.y && a.y < b.y + b.h;
}

function updateEnemies(dt) {
  const player = state.boss;
  for (const enemy of state.enemies) {
    enemy.x += enemy.vx * dt;
    if (enemy.x < enemy.baseX - enemy.range || enemy.x > enemy.baseX + enemy.range) {
      enemy.vx *= -1;
      enemy.x = Math.max(enemy.baseX - enemy.range, Math.min(enemy.x, enemy.baseX + enemy.range));
    }
    if (Math.random() < 0.008) enemy.vx *= -1;
    enemy.speakTimer -= dt;
    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
    if (enemy.speakTimer <= 0) {
      enemy.speakTimer = rand(1.3, 3.6);
    }

    const screenEnemy = { x: enemy.x - state.scroll, y: enemy.y, w: enemy.w, h: enemy.h };
    if (!rectsOverlap(player, screenEnemy)) continue;

    const stomp = player.vy > 120 && player.y + player.h < screenEnemy.y + 28;
    if (stomp && enemy.hitCooldown <= 0) {
      enemy.hitCooldown = 0.8;
      player.vy = -430;
      enemy.vx *= -1;
      state.message = `${enemy.name}「${enemy.line}」を踏み越えた`;
      state.messageTime = 1.7;
      blip(620, 0.08, "square", 0.32);
    } else {
      loseLife(`${enemy.name}「${enemy.line}」で髪が抜けた`);
      player.x = Math.max(40, player.x - 28);
    }
  }
}

function updateItems(dt) {
  const player = state.boss;
  for (const item of state.items) {
    if (item.taken) continue;
    item.bob = (item.bob || 0) + dt * 4;
    const screenItem = {
      x: item.x - state.scroll,
      y: item.y + Math.sin(item.bob) * 8,
      w: item.w,
      h: item.h
    };
    if (!rectsOverlap(player, screenItem)) continue;
    item.taken = true;
    if (item.type === "expense") {
      const before = state.life;
      state.life = Math.min(maxLife, state.life + 1);
      state.message = before === maxLife ? "ケーヒセツゲン: 回復した気分だけ経費で落ちた" : "ケーヒセツゲン獲得: 髪が1本だけ予算復活";
      state.messageTime = 1.9;
      blip(740, 0.12, "triangle", 0.28);
    } else {
      state.invincible = 5;
      state.turbo = 5;
      state.message = "超レア: キョウカイショー発動。5秒だけ境界線が味方。";
      state.messageTime = 2.3;
      blip(988, 0.12, "square", 0.35);
      setTimeout(() => blip(1175, 0.14, "square", 0.35), 100);
    }
    updateHud();
  }
}

function updateBossFight(dt) {
  const stageBoss = state.stageBoss;
  if (!stageBoss || stageBoss.defeated) return;
  const player = state.boss;
  stageBoss.hitCooldown = Math.max(0, stageBoss.hitCooldown - dt);
  stageBoss.wobble += dt;
  const screenBoss = { x: stageBoss.x - state.scroll, y: stageBoss.y, w: stageBoss.w, h: stageBoss.h };
  if (!rectsOverlap(player, screenBoss)) return;

  const stomp = player.vy > 120 && player.y + player.h < screenBoss.y + 34;
  if (stomp && stageBoss.hitCooldown <= 0) {
    stageBoss.hp -= 1;
    stageBoss.hitCooldown = 0.55;
    player.vy = -430;
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
    player.x = Math.max(40, player.x - 30);
  }
}

function update(dt) {
  if (!state.running) return;
  const player = state.boss;
  const stage = currentStage();
  const turboSpeed = state.turbo > 0 ? 1.75 : 1;
  const move = (keys.has("ArrowRight") || keys.has("KeyD") || touch.right ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") || touch.left ? 1 : 0);
  player.vx = move * 250 * turboSpeed;
  if (state.turbo > 0 && move === 0) player.vx = 370;
  if (player.vx !== 0) player.face = Math.sign(player.vx);

  if (isJumpPressed() && player.grounded) {
    player.vy = -540;
    player.grounded = false;
    blip(440, 0.08, "triangle", 0.12);
  }

  player.vy += 1500 * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.x < 40) player.x = 40;
  if (player.x > W * 0.56 && player.vx > 0) {
    state.scroll += player.vx * dt;
    player.x = W * 0.56;
  }

  player.grounded = false;
  const floor = groundY - player.h;
  if (player.y >= floor) {
    player.y = floor;
    player.vy = 0;
    player.grounded = true;
  }

  for (const platform of stage.platforms) {
    const px = platform.x - state.scroll;
    const hitX = player.x + player.w > px && player.x < px + platform.w;
    const hitY = player.y + player.h > platform.y - 12 && player.y + player.h < platform.y + 22;
    if (hitX && hitY && player.vy >= 0) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
    }
  }

  updateEnemies(dt);
  updateItems(dt);
  updateBossFight(dt);

  const bossGateOpen = !state.stageBoss || state.stageBoss.defeated;
  if (state.scroll > stageSize - W + 190 && bossGateOpen) {
    nextStage();
  } else if (state.scroll > stageSize - W + 190 && !bossGateOpen) {
    state.scroll = stageSize - W + 180;
    state.message = `${state.stageBoss.label}: ${state.stageBoss.name}を踏んで突破`;
    state.messageTime = 1.4;
  }

  state.invincible = Math.max(0, state.invincible - dt);
  state.turbo = Math.max(0, state.turbo - dt);
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
  sky.addColorStop(1, "#24262a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(237, 244, 255, 0.2)";
  for (let i = 0; i < 7; i += 1) {
    const x = (i * 190 - state.scroll * 0.2) % (W + 260) - 120;
    ctx.fillRect(x, 68, 126, 96);
    ctx.fillStyle = "rgba(35, 42, 48, 0.35)";
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        ctx.fillRect(x + 16 + c * 25, 84 + r * 24, 14, 12);
      }
    }
    ctx.fillStyle = "rgba(237, 244, 255, 0.2)";
  }

  ctx.fillStyle = "#34302b";
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = "#5a4e3c";
  for (let x = -((state.scroll * 0.8) % 58); x < W; x += 58) {
    ctx.fillRect(x, groundY + 28, 34, 8);
  }

  ctx.fillStyle = "rgba(255, 216, 107, 0.2)";
  ctx.fillRect(W - 170, 26, 134, 44);
  ctx.fillStyle = "#fff4ce";
  ctx.font = "800 16px Meiryo, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`現在: ${stage.rank}`, W - 103, 54);
}

function drawPerson(x, y, w, h, color, face = 1, name = "") {
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.scale(face, 1);
  ctx.fillStyle = color;
  ctx.fillRect(-w * 0.38, h * 0.32, w * 0.76, h * 0.52);
  ctx.fillStyle = "#24242a";
  ctx.fillRect(-w * 0.16, h * 0.44, w * 0.32, h * 0.28);
  ctx.fillStyle = "#f0bf86";
  ctx.beginPath();
  ctx.roundRect(-w * 0.34, 0, w * 0.68, h * 0.44, 14);
  ctx.fill();
  ctx.fillStyle = "#151515";
  ctx.fillRect(4, h * 0.18, 5, 5);
  ctx.fillStyle = "#8b2f25";
  ctx.fillRect(-6, h * 0.3, 16, 4);
  ctx.fillStyle = "#d9d2c2";
  ctx.fillRect(-w * 0.52, h * 0.42, 10, h * 0.32);
  ctx.fillRect(w * 0.35, h * 0.42, 10, h * 0.32);
  ctx.fillStyle = "#222";
  ctx.fillRect(-w * 0.27, h * 0.84, 13, h * 0.24);
  ctx.fillRect(w * 0.05, h * 0.84, 13, h * 0.24);
  ctx.restore();

  if (name) {
    ctx.fillStyle = "#fff0d3";
    ctx.font = "700 13px Meiryo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, x + w / 2, y - 10);
  }
}

function drawPlayer() {
  const p = state.boss;
  ctx.save();
  if (state.invincible > 0 && Math.floor(state.invincible * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  if (state.turbo > 0) {
    ctx.fillStyle = "rgba(121, 214, 198, 0.28)";
    ctx.fillRect(p.x - 40, p.y + 16, 32, 18);
    ctx.fillRect(p.x - 70, p.y + 42, 48, 14);
  }
  drawPerson(p.x, p.y, p.w, p.h, "#35302b", p.face, "");
  ctx.fillStyle = "#1e1a18";
  for (let i = 0; i < state.life; i += 1) {
    ctx.fillRect(p.x + 10 + i * 8, p.y - 11 - (i % 2) * 4, 4, 15);
  }
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    const x = enemy.x - state.scroll;
    if (x < -120 || x > W + 120) continue;
    drawPerson(x, enemy.y, enemy.w, enemy.h, enemy.color, Math.sign(enemy.vx) || 1, enemy.name);
    if (enemy.speakTimer > 2.4) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
      ctx.fillRect(x - 30, enemy.y - 52, 120, 30);
      ctx.fillStyle = "#fff6d7";
      ctx.font = "700 12px Meiryo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(enemy.line, x + enemy.w / 2, enemy.y - 32);
    }
  }
}

function drawItems() {
  for (const item of state.items) {
    if (item.taken) continue;
    const x = item.x - state.scroll;
    const y = item.y + Math.sin(item.bob || 0) * 8;
    if (x < -80 || x > W + 80) continue;
    if (item.type === "expense") {
      ctx.fillStyle = "#f3c94b";
      ctx.beginPath();
      ctx.arc(x + item.w / 2, y + item.h / 2, item.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a2110";
      ctx.font = "900 22px Meiryo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("￥", x + item.w / 2, y + 27);
    } else {
      ctx.fillStyle = "#79d6c6";
      ctx.fillRect(x, y, item.w, item.h);
      ctx.fillStyle = "#12332f";
      ctx.font = "900 20px Meiryo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("境", x + item.w / 2, y + 28);
      ctx.fillStyle = "#fff6d7";
      ctx.font = "700 12px Meiryo, sans-serif";
      ctx.fillText("RARE", x + item.w / 2, y - 7);
    }
  }
}

function drawStageBoss() {
  const b = state.stageBoss;
  if (!b || b.defeated) return;
  const x = b.x - state.scroll;
  if (x < -160 || x > W + 140) return;
  const shake = Math.sin(b.wobble * 8) * 3;
  drawPerson(x + shake, b.y, b.w, b.h, b.label === "ラスボス" ? "#492c69" : "#7a4538", -1, b.name);
  ctx.fillStyle = "#ffd86b";
  ctx.font = "800 16px Meiryo, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(b.label, x + b.w / 2, b.y - 32);
  ctx.fillStyle = "#111";
  ctx.fillRect(x + b.w / 2 - 48, b.y - 24, 96, 9);
  ctx.fillStyle = "#e35f4f";
  ctx.fillRect(x + b.w / 2 - 48, b.y - 24, 96 * (b.hp / b.maxHp), 9);
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
  ctx.fillRect(24, 22, 486, 88);
  ctx.fillStyle = "#ffd86b";
  ctx.font = "800 27px Meiryo, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(stage.name, 42, 58);
  ctx.fillStyle = "#f3e8d4";
  ctx.font = "16px Meiryo, sans-serif";
  ctx.fillText(stage.quote, 42, 88);

  if (state.turbo > 0) {
    ctx.fillStyle = "#79d6c6";
    ctx.font = "900 18px Meiryo, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`無敵 ${state.turbo.toFixed(1)}秒`, W - 40, 94);
  }

  if (state.messageTime > 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.66)";
    ctx.fillRect(W / 2 - 310, 126, 620, 58);
    ctx.fillStyle = "#fff6d7";
    ctx.font = "800 19px Meiryo, sans-serif";
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
  drawItems();
  drawEnemies();
  drawStageBoss();
  drawPlayer();
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
