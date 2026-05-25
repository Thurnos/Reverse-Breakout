/* Reverse Breakout — polished rogue-lite version
   Fully self-contained: no external assets needed.
*/

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const startBtn = document.getElementById('startBtn');
  const muteBtn = document.getElementById('muteBtn');
  const resetMetaBtn = document.getElementById('resetMetaBtn');

  const timerEl = document.getElementById('timer');
  const levelEl = document.getElementById('level');
  const hpEl = document.getElementById('hp');
  const goldEl = document.getElementById('gold');
  const highEl = document.getElementById('high');
  const powerEl = document.getElementById('power');

  const W = canvas.width;
  const H = canvas.height;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let muted = false;
  let audioCtx = null;

  function beep(type = 'power', volume = 0.12) {
    if (muted) return;

    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const frequencies = {
        power: [660, 880],
        hit: [180, 90],
        warn: [320, 240],
        buy: [740, 980],
        level: [440, 880],
      };

      const [start, end] = frequencies[type] || frequencies.power;
      osc.frequency.setValueAtTime(start, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(end, audioCtx.currentTime + 0.12);

      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);

      osc.type = type === 'hit' ? 'sawtooth' : 'sine';
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.17);
    } catch (_) {}
  }

  const STORAGE = {
    best: 'reverse_breakout_best_v2',
    gold: 'reverse_breakout_gold_v2',
    upgrades: 'reverse_breakout_upgrades_v2',
  };

  let best = Number(localStorage.getItem(STORAGE.best) || 0);
  let gold = Number(localStorage.getItem(STORAGE.gold) || 0);
  let lastRunGold = 0;
  let upgrades = safeParse(localStorage.getItem(STORAGE.upgrades), {});

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }

  const BASE = {
    w: 80,
    h: 28,
    maxHp: 100,
    speed: 6,
    stickRadius: 95,
    goldMultiplier: 1,
  };

  const UPGRADE_DEFS = [
    { id: 'vitality', name: 'Vitality', desc: '+20 Max HP', baseCost: 45, max: 10 },
    { id: 'agility', name: 'Agility', desc: '+0.45 Move Speed', baseCost: 55, max: 10 },
    { id: 'compact', name: 'Compact Frame', desc: '-4% Base Size, same shape', baseCost: 70, max: 6 },
    { id: 'stick', name: 'Longer Stick', desc: '+10 Stick Radius', baseCost: 65, max: 8 },
    { id: 'gold', name: 'Gold Sense', desc: '+15% Gold Earned', baseCost: 90, max: 8 },
    { id: 'recovery', name: 'Recovery Core', desc: '+4 Powerup Healing', baseCost: 85, max: 8 },
  ];

  function upgradeLevel(id) {
    return upgrades[id] || 0;
  }

  function upgradeCost(def) {
    return Math.round(def.baseCost * Math.pow(1.42, upgradeLevel(def.id)));
  }

  function saveProgress() {
    localStorage.setItem(STORAGE.gold, String(Math.floor(gold)));
    localStorage.setItem(STORAGE.upgrades, JSON.stringify(upgrades));
  }

  function resetProgress() {
    if (!confirm('Reset gold, upgrades, and best time?')) return;
    localStorage.removeItem(STORAGE.best);
    localStorage.removeItem(STORAGE.gold);
    localStorage.removeItem(STORAGE.upgrades);
    best = 0;
    gold = 0;
    upgrades = {};
    lastRunGold = 0;
    applyPermanentStats();
    updateDom();
  }

  function goldMultiplier() {
    return BASE.goldMultiplier + upgradeLevel('gold') * 0.15;
  }

  function rewardFor(seconds, level) {
    const levelBonus = Math.max(0, level - 1) * 9;
    return Math.floor((seconds * 2.6 + levelBonus) * goldMultiplier());
  }

  const player = {
    x: W / 2 - BASE.w / 2,
    y: H / 2 - BASE.h / 2,
    w: BASE.w,
    h: BASE.h,
    baseW: BASE.w,
    baseH: BASE.h,
    speed: BASE.speed,
    maxHp: BASE.maxHp,
    hp: BASE.maxHp,
    color: '#22f5c8',

    shield: false,
    shieldT: 0,

    reflectShield: false,
    reflectShieldT: 0,
    reflectShieldDuration: 6000,
    reflectRadius: 76,

    shrinkActive: false,
    shrinkT: 0,
    shrinkDuration: 6000,
    shrinkScale: 0.62,

    autoDodgeActive: false,
    autoDodgeTimer: 0,
    autoDodgeDuration: 5000,

    stickCooldown: 0,
    stickCooldownMax: 2000,
    stickRadius: BASE.stickRadius,
    stickSwingTimer: 0,
    stickSwingDuration: 180,
  };

  function applyPermanentStats() {
    const compactScale = Math.max(0.72, 1 - upgradeLevel('compact') * 0.04);
    player.maxHp = BASE.maxHp + upgradeLevel('vitality') * 20;
    player.speed = BASE.speed + upgradeLevel('agility') * 0.45;
    player.baseW = BASE.w * compactScale;
    player.baseH = BASE.h * compactScale;
    player.stickRadius = BASE.stickRadius + upgradeLevel('stick') * 10;
  }

  const LEVEL_TRANSITION_DURATION = 2600;
  const LEVELS = {
    1: { name: 'Level 1', unlockAt: 0, spawnInterval: 2000, minSpawnInterval: 650, speedBonus: 0, modes: ['normal'], waveChance: 0.20 },
    2: { name: 'Level 2: Split Lines', unlockAt: 30, spawnInterval: 1350, minSpawnInterval: 620, speedBonus: 0.35, modes: ['vertical', 'horizontal'], waveChance: 0.22 },
    3: { name: 'Level 3: Diagonal Blades', unlockAt: 60, spawnInterval: 1120, minSpawnInterval: 540, speedBonus: 0.65, modes: ['diagonal'], waveChance: 0.26 },
    4: { name: 'Level 4: Crossfire', unlockAt: 90, spawnInterval: 980, minSpawnInterval: 480, speedBonus: 0.82, modes: ['normal', 'vertical', 'horizontal', 'diagonal'], waveChance: 0.32 },
    5: { name: 'Level 5: Hunters', unlockAt: 120, spawnInterval: 920, minSpawnInterval: 450, speedBonus: 0.95, modes: ['aimed', 'aimed', 'normal', 'diagonal'], waveChance: 0.36 },
    6: { name: 'Level 6: Swarm', unlockAt: 150, spawnInterval: 840, minSpawnInterval: 410, speedBonus: 1.08, modes: ['tinyFast', 'tinyFast', 'zigzag', 'horizontal', 'vertical'], waveChance: 0.42 },
    7: { name: 'Level 7: Final Chaos', unlockAt: 180, spawnInterval: 760, minSpawnInterval: 360, speedBonus: 1.22, modes: ['heavy', 'aimed', 'zigzag', 'diagonal', 'tinyFast'], waveChance: 0.48 },
  };

  let started = false;
  let shopOpen = false;
  let mouseFollow = false;
  let lastTime = 0;
  let runStart = 0;
  let elapsed = 0;
  let currentLevel = 1;
  let spawnTimer = 0;
  let spawnInterval = LEVELS[1].spawnInterval;
  let powerTimer = 0;
  let powerInterval = 7000;

  let levelTransition = false;
  let transitionTimer = 0;
  let pendingLevel = 0;

  let balls = [];
  let powerups = [];
  let particles = [];
  let obstacles = [];

  const keys = {};
  const shake = { x: 0, y: 0, intensity: 0 };

  class Ball {
    constructor(x, y, dx, dy, r = 12, color = '#fb7185') {
      this.x = x;
      this.y = y;
      this.dx = dx;
      this.dy = dy;
      this.r = r;
      this.color = color;
      this.warned = false;
      this.zigzag = false;
      this.zigzagT = rand(0, Math.PI * 2);
      this.zigzagStrength = 0;
      this.prevX = x;
      this.prevY = y;
    }

    update() {
      this.prevX = this.x;
      this.prevY = this.y;

      if (this.zigzag) {
        this.zigzagT += 0.09;
        const sidePush = Math.sin(this.zigzagT) * this.zigzagStrength;
        const len = Math.max(0.001, Math.hypot(this.dx, this.dy));
        const nx = -this.dy / len;
        const ny = this.dx / len;
        this.x += this.dx + nx * sidePush;
        this.y += this.dy + ny * sidePush;
      } else {
        this.x += this.dx;
        this.y += this.dy;
      }

      if (this.x - this.r < 0) { this.x = this.r; this.dx = Math.abs(this.dx); }
      if (this.x + this.r > W) { this.x = W - this.r; this.dx = -Math.abs(this.dx); }
      if (this.y - this.r < 0) { this.y = this.r; this.dy = Math.abs(this.dy); }
      if (this.y + this.r > H) { this.y = H - this.r; this.dy = -Math.abs(this.dy); }
    }
  }

  class Powerup {
    constructor(type, x, y) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.w = 24;
      this.h = 24;
      this.dy = 1.15;
      this.life = 900;
      this.spin = 0;
    }

    update() {
      this.y += this.dy;
      this.spin += 0.06;
      this.life--;
    }
  }

  function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr) {
    const testX = clamp(cx, rx, rx + rw);
    const testY = clamp(cy, ry, ry + rh);
    return Math.hypot(cx - testX, cy - testY) <= cr;
  }

  function spawnParticles(x, y, count = 12, hue = 190) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: rand(-2.8, 2.8),
        vy: rand(-3.0, 1.2),
        life: Math.floor(rand(22, 48)),
        size: rand(1.5, 4),
        color: `hsl(${hue + rand(-20, 20)}, 90%, 65%)`,
      });
    }
  }

  function terrainFor(level) {
    obstacles = [];
    const cx = W / 2;
    const cy = H / 2;

    if (level === 2 || level === 3) {
      obstacles.push(
        { x: cx - 130, y: cy - 85, w: 34, h: 170, color: 'rgba(148, 163, 184, 0.9)' },
        { x: cx + 96, y: cy - 85, w: 34, h: 170, color: 'rgba(148, 163, 184, 0.9)' },
      );
    } else if (level === 4) {
      terrainFor(2);
      obstacles.push(
        { x: W * 0.22, y: H * 0.24, w: 42, h: 42, color: 'rgba(251, 146, 60, 0.9)' },
        { x: W * 0.73, y: H * 0.68, w: 42, h: 42, color: 'rgba(251, 146, 60, 0.9)' },
      );
    } else if (level === 5) {
      obstacles.push(
        { x: cx - 85, y: cy - 105, w: 170, h: 28, color: 'rgba(56, 189, 248, 0.82)' },
        { x: cx - 85, y: cy + 77, w: 170, h: 28, color: 'rgba(56, 189, 248, 0.82)' },
        { x: cx - 18, y: cy - 38, w: 36, h: 76, color: 'rgba(56, 189, 248, 0.65)' },
      );
    } else if (level === 6) {
      const size = 56;
      obstacles.push(
        { x: W * 0.25 - size / 2, y: H * 0.50 - size / 2, w: size, h: size, color: 'rgba(244, 114, 182, 0.78)' },
        { x: W * 0.50 - size / 2, y: H * 0.25 - size / 2, w: size, h: size, color: 'rgba(244, 114, 182, 0.78)' },
        { x: W * 0.75 - size / 2, y: H * 0.50 - size / 2, w: size, h: size, color: 'rgba(244, 114, 182, 0.78)' },
        { x: W * 0.50 - size / 2, y: H * 0.75 - size / 2, w: size, h: size, color: 'rgba(244, 114, 182, 0.78)' },
      );
    } else if (level >= 7) {
      obstacles.push(
        { x: W * 0.30, y: cy - 75, w: 36, h: 150, color: 'rgba(168, 85, 247, 0.82)' },
        { x: W * 0.70 - 36, y: cy - 75, w: 36, h: 150, color: 'rgba(168, 85, 247, 0.82)' },
        { x: cx - 95, y: H * 0.28, w: 190, h: 26, color: 'rgba(168, 85, 247, 0.7)' },
        { x: cx - 95, y: H * 0.72, w: 190, h: 26, color: 'rgba(168, 85, 247, 0.7)' },
      );
    }
  }

  function bounceBallOffObstacle(ball, o) {
    if (!rectCircleCollide(o.x, o.y, o.w, o.h, ball.x, ball.y, ball.r)) return;

    const fromLeft = ball.prevX + ball.r <= o.x;
    const fromRight = ball.prevX - ball.r >= o.x + o.w;
    const fromTop = ball.prevY + ball.r <= o.y;
    const fromBottom = ball.prevY - ball.r >= o.y + o.h;

    if (fromLeft) { ball.x = o.x - ball.r; ball.dx = -Math.abs(ball.dx); }
    else if (fromRight) { ball.x = o.x + o.w + ball.r; ball.dx = Math.abs(ball.dx); }
    else if (fromTop) { ball.y = o.y - ball.r; ball.dy = -Math.abs(ball.dy); }
    else if (fromBottom) { ball.y = o.y + o.h + ball.r; ball.dy = Math.abs(ball.dy); }
    else if (Math.abs(ball.dx) > Math.abs(ball.dy)) { ball.dx *= -1; ball.x += Math.sign(ball.dx || 1) * 3; }
    else { ball.dy *= -1; ball.y += Math.sign(ball.dy || 1) * 3; }

    spawnParticles(ball.x, ball.y, 5, 210);
  }

  function spawnBall(mode = 'normal') {
    const level = LEVELS[currentLevel] || LEVELS[1];
    const speed = rand(1.35, 2.55) + Math.min(0.95, elapsed / 34) + level.speedBonus;
    let x = 0, y = 0, dx = 0, dy = 0;

    if (mode === 'vertical') {
      const top = Math.random() < 0.5;
      x = rand(28, W - 28);
      y = top ? -22 : H + 22;
      dx = 0;
      dy = top ? speed : -speed;
      balls.push(new Ball(x, y, dx, dy, rand(8, 14), '#60a5fa'));
      return;
    }

    if (mode === 'horizontal') {
      const left = Math.random() < 0.5;
      x = left ? -22 : W + 22;
      y = rand(28, H - 28);
      dx = left ? speed : -speed;
      dy = 0;
      balls.push(new Ball(x, y, dx, dy, rand(8, 14), '#fb923c'));
      return;
    }

    if (mode === 'diagonal') {
      const corner = Math.floor(rand(0, 4));
      const s = speed * 0.707;
      if (corner === 0) { x = -22; y = -22; dx = s; dy = s; }
      if (corner === 1) { x = W + 22; y = -22; dx = -s; dy = s; }
      if (corner === 2) { x = W + 22; y = H + 22; dx = -s; dy = -s; }
      if (corner === 3) { x = -22; y = H + 22; dx = s; dy = -s; }
      balls.push(new Ball(x, y, dx, dy, rand(8, 14), '#a855f7'));
      return;
    }

    if (mode === 'aimed') {
      const side = Math.floor(rand(0, 4));
      if (side === 0) { x = rand(20, W - 20); y = -24; }
      if (side === 1) { x = W + 24; y = rand(20, H - 20); }
      if (side === 2) { x = rand(20, W - 20); y = H + 24; }
      if (side === 3) { x = -24; y = rand(20, H - 20); }
      const angle = Math.atan2((player.y + player.h / 2) - y, (player.x + player.w / 2) - x);
      balls.push(new Ball(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, rand(8, 13), '#22c55e'));
      return;
    }

    if (mode === 'tinyFast') {
      const side = Math.floor(rand(0, 4));
      const s = speed * 1.05;
      if (side === 0) { x = rand(20, W - 20); y = -20; dx = rand(-1.4, 1.4); dy = s; }
      if (side === 1) { x = W + 20; y = rand(20, H - 20); dx = -s; dy = rand(-1.4, 1.4); }
      if (side === 2) { x = rand(20, W - 20); y = H + 20; dx = rand(-1.4, 1.4); dy = -s; }
      if (side === 3) { x = -20; y = rand(20, H - 20); dx = s; dy = rand(-1.4, 1.4); }
      balls.push(new Ball(x, y, dx, dy, rand(5, 8), '#facc15'));
      return;
    }

    if (mode === 'zigzag') {
      spawnBall('normal');
      const b = balls[balls.length - 1];
      b.color = '#ec4899';
      b.zigzag = true;
      b.zigzagStrength = rand(0.55, 0.9);
      return;
    }

    if (mode === 'heavy') {
      const side = Math.floor(rand(0, 4));
      const s = speed * 0.62;
      if (side === 0) { x = rand(28, W - 28); y = -30; dx = rand(-0.8, 0.8); dy = s; }
      if (side === 1) { x = W + 30; y = rand(28, H - 28); dx = -s; dy = rand(-0.8, 0.8); }
      if (side === 2) { x = rand(28, W - 28); y = H + 30; dx = rand(-0.8, 0.8); dy = -s; }
      if (side === 3) { x = -30; y = rand(28, H - 28); dx = s; dy = rand(-0.8, 0.8); }
      balls.push(new Ball(x, y, dx, dy, rand(18, 25), '#ef4444'));
      return;
    }

    const side = Math.floor(rand(0, 4));
    if (side === 0) { x = rand(20, W - 20); y = -20; dx = rand(-1.2, 1.2); dy = speed; }
    if (side === 1) { x = W + 20; y = rand(20, H - 20); dx = -speed; dy = rand(-1.2, 1.2); }
    if (side === 2) { x = rand(20, W - 20); y = H + 20; dx = rand(-1.2, 1.2); dy = -speed; }
    if (side === 3) { x = -20; y = rand(20, H - 20); dx = speed; dy = rand(-1.2, 1.2); }

    balls.push(new Ball(x, y, dx, dy, rand(8, 14), '#fb7185'));
  }

  function spawnPowerup() {
    const types = ['heal', 'shield', 'slow', 'autoDodge', 'reflectShield', 'shrink'];
    const type = choice(types);
    powerups.push(new Powerup(type, rand(80, W - 80), -24));
  }

  function applyPower(type) {
    beep('power', 0.12);
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 14, 180);

    if (type === 'heal') {
      const heal = 22 + upgradeLevel('recovery') * 4;
      player.hp = clamp(player.hp + heal, 0, player.maxHp);
    } else if (type === 'shield') {
      player.shield = true;
      player.shieldT = 8000;
    } else if (type === 'slow') {
      balls.forEach((b) => { b.dx *= 0.58; b.dy *= 0.58; });
      setTimeout(() => balls.forEach((b) => { b.dx *= 1.72; b.dy *= 1.72; }), 6200);
    } else if (type === 'autoDodge') {
      player.autoDodgeActive = true;
      player.autoDodgeTimer = player.autoDodgeDuration;
    } else if (type === 'reflectShield') {
      player.reflectShield = true;
      player.reflectShieldT = player.reflectShieldDuration;
    } else if (type === 'shrink') {
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      player.shrinkActive = true;
      player.shrinkT = player.shrinkDuration;
      player.w = player.baseW * player.shrinkScale;
      player.h = player.baseH * player.shrinkScale;
      player.x = clamp(cx - player.w / 2, 6, W - player.w - 6);
      player.y = clamp(cy - player.h / 2, 6, H - player.h - 6);
    }
  }

  function useStick() {
    if (!started || shopOpen || currentLevel < 3 || player.stickCooldown > 0 || levelTransition) return;

    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    let removed = 0;

    balls = balls.filter((b) => {
      const distance = Math.hypot(b.x - px, b.y - py);
      if (distance <= player.stickRadius + b.r) {
        removed++;
        spawnParticles(b.x, b.y, 14, 280);
        return false;
      }
      return true;
    });

    player.stickCooldown = player.stickCooldownMax;
    player.stickSwingTimer = player.stickSwingDuration;
    shake.intensity = Math.max(shake.intensity, removed > 0 ? 5 : 2);
    beep(removed > 0 ? 'power' : 'warn', removed > 0 ? 0.14 : 0.07);
  }

  function startTransition(nextLevel) {
    levelTransition = true;
    transitionTimer = LEVEL_TRANSITION_DURATION;
    pendingLevel = nextLevel;
    balls = [];
    powerups = [];
    spawnTimer = 0;
    powerTimer = 0;
    spawnParticles(W / 2, H / 2, 64, 210 + nextLevel * 12);
    beep('level', 0.14);
  }

  function completeTransition() {
    currentLevel = pendingLevel;
    pendingLevel = 0;
    levelTransition = false;
    transitionTimer = 0;
    spawnInterval = LEVELS[currentLevel].spawnInterval;
    terrainFor(currentLevel);

    const intro = {
      2: ['vertical', 'horizontal'],
      3: ['diagonal', 'diagonal'],
      4: ['vertical', 'horizontal', 'diagonal'],
      5: ['aimed', 'aimed'],
      6: ['tinyFast', 'tinyFast', 'zigzag'],
      7: ['heavy', 'aimed', 'zigzag'],
    }[currentLevel] || ['normal'];

    intro.forEach(spawnBall);
  }

  function resetRun() {
    applyPermanentStats();

    balls = [];
    powerups = [];
    particles = [];
    obstacles = [];
    currentLevel = 1;
    spawnTimer = 0;
    spawnInterval = LEVELS[1].spawnInterval;
    powerTimer = 0;
    powerInterval = 7000;
    elapsed = 0;
    levelTransition = false;
    transitionTimer = 0;
    pendingLevel = 0;

    player.w = player.baseW;
    player.h = player.baseH;
    player.x = W / 2 - player.w / 2;
    player.y = H / 2 - player.h / 2;
    player.hp = player.maxHp;
    player.shield = false;
    player.shieldT = 0;
    player.reflectShield = false;
    player.reflectShieldT = 0;
    player.shrinkActive = false;
    player.shrinkT = 0;
    player.autoDodgeActive = false;
    player.autoDodgeTimer = 0;
    player.stickCooldown = 0;
    player.stickSwingTimer = 0;

    balls.push(new Ball(W / 2, -30, rand(-1.6, 1.6), rand(2, 3.5), 12));
    updateDom();
  }

  function buyUpgrade(index) {
    const def = UPGRADE_DEFS[index];
    if (!def) return;

    const level = upgradeLevel(def.id);
    if (level >= def.max) {
      beep('warn', 0.08);
      return;
    }

    const cost = upgradeCost(def);
    if (gold < cost) {
      beep('warn', 0.08);
      return;
    }

    gold -= cost;
    upgrades[def.id] = level + 1;
    saveProgress();
    applyPermanentStats();
    beep('buy', 0.12);
    updateDom();
  }

  function update(dt) {
    elapsed = (performance.now() - runStart) / 1000;

    if (player.stickCooldown > 0) player.stickCooldown = Math.max(0, player.stickCooldown - dt);
    if (player.stickSwingTimer > 0) player.stickSwingTimer = Math.max(0, player.stickSwingTimer - dt);

    if (player.shield) {
      player.shieldT = Math.max(0, player.shieldT - dt);
      if (player.shieldT <= 0) player.shield = false;
    }

    if (player.reflectShield) {
      player.reflectShieldT = Math.max(0, player.reflectShieldT - dt);
      if (player.reflectShieldT <= 0) player.reflectShield = false;
    }

    if (player.shrinkActive) {
      player.shrinkT = Math.max(0, player.shrinkT - dt);
      if (player.shrinkT <= 0) {
        const cx = player.x + player.w / 2;
        const cy = player.y + player.h / 2;
        player.shrinkActive = false;
        player.w = player.baseW;
        player.h = player.baseH;
        player.x = clamp(cx - player.w / 2, 6, W - player.w - 6);
        player.y = clamp(cy - player.h / 2, 6, H - player.h - 6);
      }
    }

    if (levelTransition) {
      transitionTimer -= dt;
      updateParticles();
      if (transitionTimer <= 0) completeTransition();
      return;
    }

    const next = LEVELS[currentLevel + 1];
    if (next && elapsed >= next.unlockAt) {
      startTransition(currentLevel + 1);
      return;
    }

    if (keys.ArrowLeft || keys.a) player.x -= player.speed;
    if (keys.ArrowRight || keys.d) player.x += player.speed;
    if (keys.ArrowUp || keys.w) player.y -= player.speed;
    if (keys.ArrowDown || keys.s) player.y += player.speed;

    if (player.autoDodgeActive) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      let closest = null;
      let closestDist = Infinity;

      for (const b of balls) {
        const d = Math.hypot(b.x - px, b.y - py);
        if (d < closestDist) {
          closestDist = d;
          closest = b;
        }
      }

      if (closest && closestDist < 126) {
        const dodge = Math.max(4, player.speed * 0.8);
        if (Math.abs(closest.dx) > Math.abs(closest.dy)) player.y += closest.y < py ? dodge : -dodge;
        else player.x += closest.x < px ? dodge : -dodge;
      }

      player.autoDodgeTimer = Math.max(0, player.autoDodgeTimer - dt);
      if (player.autoDodgeTimer <= 0) player.autoDodgeActive = false;
    }

    player.x = clamp(player.x, 6, W - player.w - 6);
    player.y = clamp(player.y, 6, H - player.h - 6);

    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      const level = LEVELS[currentLevel];
      spawnInterval = Math.max(level.minSpawnInterval, level.spawnInterval - elapsed * 4.2);

      let count = 1;
      if (currentLevel >= 5 && Math.random() < 0.18) count++;
      if (Math.random() < level.waveChance) count++;

      for (let i = 0; i < count; i++) spawnBall(choice(level.modes));
    }

    powerTimer += dt;
    powerInterval = currentLevel >= 5 ? 5600 : 7000;
    if (powerTimer >= powerInterval) {
      powerTimer = 0;
      spawnPowerup();
    }

    balls.forEach((b) => b.update());
    for (const b of balls) for (const o of obstacles) bounceBallOffObstacle(b, o);

    handleCollisions();
    updatePowerups();
    updateParticles();

    if (shake.intensity > 0) {
      shake.x = rand(-shake.intensity, shake.intensity);
      shake.y = rand(-shake.intensity, shake.intensity);
      shake.intensity *= 0.88;
    } else {
      shake.x = 0;
      shake.y = 0;
    }

    if (player.hp <= 0) endRun();
  }

  function handleCollisions() {
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;

    if (player.reflectShield) {
      for (const b of balls) {
        const dist = Math.hypot(b.x - px, b.y - py);
        if (dist <= player.reflectRadius + b.r) {
          const angle = Math.atan2(b.y - py, b.x - px);
          const speed = Math.max(3.5, Math.hypot(b.dx, b.dy)) * 1.08;
          b.x = px + Math.cos(angle) * (player.reflectRadius + b.r + 2);
          b.y = py + Math.sin(angle) * (player.reflectRadius + b.r + 2);
          b.dx = Math.cos(angle) * speed;
          b.dy = Math.sin(angle) * speed;
          spawnParticles(b.x, b.y, 5, 190);
        }
      }
    }

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (!rectCircleCollide(player.x, player.y, player.w, player.h, b.x, b.y, b.r)) continue;

      spawnParticles(b.x, b.y, 16, 0);
      shake.intensity = Math.max(shake.intensity, 7);
      beep('hit', 0.12);

      if (player.shield) {
        player.shield = false;
        player.shieldT = 0;
        balls.splice(i, 1);
      } else {
        player.hp -= Math.round(b.r * 1.2);
        balls.splice(i, 1);
      }
    }

    let near = false;
    for (const b of balls) {
      const dist = Math.hypot(b.x - px, b.y - py);
      if (dist < 140) {
        near = true;
        if (!b.warned) { beep('warn', 0.035); b.warned = true; }
      }
      if (dist > 220) b.warned = false;
    }

    timerEl.classList.toggle('dangerText', near);
  }

  function updatePowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.update();

      if (p.y > H + 40 || p.life <= 0) {
        powerups.splice(i, 1);
        continue;
      }

      if (
        p.x >= player.x &&
        p.x <= player.x + player.w &&
        p.y >= player.y &&
        p.y <= player.y + player.h
      ) {
        applyPower(p.type);
        powerups.splice(i, 1);
      }
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.10;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateDom() {
    timerEl.textContent = `Time: ${elapsed.toFixed(1)}s`;
    levelEl.textContent = `Level: ${currentLevel}`;
    hpEl.textContent = `HP: ${Math.max(0, Math.round(player.hp))}/${Math.round(player.maxHp)}`;
    goldEl.textContent = `Gold: ${Math.floor(gold)}`;
    highEl.textContent = `Best: ${best.toFixed(1)}s`;

    if (player.shrinkActive) powerEl.textContent = `Power: SHRINK ${Math.ceil(player.shrinkT / 1000)}s`;
    else if (player.reflectShield) powerEl.textContent = `Power: REFLECT ${Math.ceil(player.reflectShieldT / 1000)}s`;
    else if (player.shield) powerEl.textContent = `Power: SHIELD ${Math.ceil(player.shieldT / 1000)}s`;
    else if (player.autoDodgeActive) powerEl.textContent = `Power: AUTO-DODGE ${Math.ceil(player.autoDodgeTimer / 1000)}s`;
    else if (currentLevel >= 3) powerEl.textContent = player.stickCooldown <= 0 ? 'Stick: READY [Space/E]' : `Stick: ${(player.stickCooldown / 1000).toFixed(1)}s`;
    else powerEl.textContent = 'Power: —';
  }

  function getShopLayout() {
    const panelW = Math.min(840, W - 70);
    const panelH = Math.min(560, H - 54);
    const x = W / 2 - panelW / 2;
    const y = H / 2 - panelH / 2;
    const rowStartY = y + 148;
    const rowH = 56;
    const buttonW = 96;
    const buttonH = 34;

    return { panelW, panelH, x, y, rowStartY, rowH, buttonW, buttonH };
  }

  function getShopButtonAt(canvasX, canvasY) {
    if (!shopOpen) return -1;

    const layout = getShopLayout();

    for (let i = 0; i < UPGRADE_DEFS.length; i++) {
      const bx = layout.x + layout.panelW - layout.buttonW - 34;
      const by = layout.rowStartY + i * layout.rowH + 3;

      if (
        canvasX >= bx &&
        canvasX <= bx + layout.buttonW &&
        canvasY >= by &&
        canvasY <= by + layout.buttonH
      ) {
        return i;
      }
    }

    return -1;
  }

  function drawUpgradeRadar(cx, cy, radius) {
    const stats = UPGRADE_DEFS.map((def) => ({
      label: def.name.split(' ')[0],
      value: upgradeLevel(def.id) / def.max,
    }));

    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;

    for (let ring = 1; ring <= 4; ring++) {
      const r = radius * (ring / 4);
      ctx.beginPath();
      stats.forEach((_, i) => {
        const a = -Math.PI / 2 + (i / stats.length) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }

    stats.forEach((stat, i) => {
      const a = -Math.PI / 2 + (i / stats.length) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stat.label, Math.cos(a) * (radius + 28), Math.sin(a) * (radius + 20));
    });

    ctx.beginPath();
    stats.forEach((stat, i) => {
      const a = -Math.PI / 2 + (i / stats.length) * Math.PI * 2;
      const r = radius * clamp(stat.value, 0, 1);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function endRun() {
    if (!started) return;

    started = false;
    balls = [];
    powerups = [];
    levelTransition = false;

    if (elapsed > best) {
      best = elapsed;
      localStorage.setItem(STORAGE.best, best.toFixed(1));
    }

    lastRunGold = rewardFor(elapsed, currentLevel);
    gold += lastRunGold;
    saveProgress();

    shopOpen = true;
    startBtn.textContent = 'Play Again';
    beep('warn', 0.12);
    updateDom();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#020617');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      const g = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
      g.addColorStop(0, 'rgba(255,255,255,0.28)');
      g.addColorStop(0.25, o.color);
      g.addColorStop(1, 'rgba(15, 23, 42, 0.96)');
      ctx.fillStyle = g;
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.strokeStyle = 'rgba(255,255,255,0.38)';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }
  }

  function drawPowerups() {
    const colorMap = {
      heal: '#22c55e',
      shield: '#67e8f9',
      slow: '#facc15',
      autoDodge: '#c084fc',
      reflectShield: '#38bdf8',
      shrink: '#f472b6',
    };

    const labelMap = {
      heal: '+',
      shield: 'S',
      slow: 'T',
      autoDodge: 'A',
      reflectShield: 'R',
      shrink: '↓',
    };

    for (const p of powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = colorMap[p.type] || '#fff';
      ctx.shadowBlur = 16;
      ctx.shadowColor = colorMap[p.type] || '#fff';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.strokeRect(-p.w / 2 - 2, -p.h / 2 - 2, p.w + 4, p.h + 4);
      ctx.rotate(-p.spin);
      ctx.fillStyle = '#020617';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelMap[p.type] || '?', 0, 1);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / 48, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }

  function drawBalls() {
    for (const b of balls) {
      ctx.beginPath();
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = b.color;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(2, b.r * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    ctx.save();

    ctx.fillStyle = player.color;
    ctx.shadowBlur = player.shrinkActive ? 18 : 10;
    ctx.shadowColor = player.shrinkActive ? '#f472b6' : player.color;
    roundRect(player.x, player.y, player.w, player.h, 8);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(player.x + 5, player.y + 4, Math.max(4, player.w - 10), Math.max(3, player.h * 0.25), 5);
    ctx.fill();

    if (player.shrinkActive) {
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)';
      ctx.lineWidth = 2;
      roundRect(player.x - 4, player.y - 4, player.w + 8, player.h + 8, 10);
      ctx.stroke();
    }

    if (player.reflectShield) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const pulse = 0.5 + Math.sin(performance.now() / 120) * 0.5;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + pulse * 0.25})`;
      ctx.lineWidth = 4;
      ctx.arc(px, py, player.reflectRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (player.shield) {
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.78)';
      ctx.lineWidth = 3;
      roundRect(player.x - 6, player.y - 6, player.w + 12, player.h + 12, 12);
      ctx.stroke();
    }

    if (currentLevel >= 3) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const ready = player.stickCooldown <= 0;
      ctx.lineCap = 'round';
      ctx.strokeStyle = ready ? 'rgba(245, 222, 179, 0.95)' : 'rgba(130,130,130,0.6)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(px + player.w / 2 - 6, py - 6);
      ctx.lineTo(px + player.w / 2 + 36, py - 26);
      ctx.stroke();

      const alpha = clamp(player.stickSwingTimer / player.stickSwingDuration, 0, 1);
      if (alpha > 0) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.25 + 0.45 * alpha})`;
        ctx.lineWidth = 4;
        ctx.arc(px, py, player.stickRadius * (1.05 - alpha * 0.2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawHud() {
    const barW = 180;
    const barH = 14;
    const x = 18;
    const y = H - 32;
    const pct = clamp(player.hp / player.maxHp, 0, 1);

    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#facc15' : '#fb7185';
    ctx.fillRect(x, y, barW * pct, barH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.max(0, Math.round(player.hp))}/${Math.round(player.maxHp)}`, x, y - 9);

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(LEVELS[currentLevel].name, W - 18, 22);

    const next = LEVELS[currentLevel + 1];
    ctx.font = '12px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(next ? `Next: ${next.name} at ${next.unlockAt}s` : 'Final level: survive as long as possible', W - 18, 44);

    if (currentLevel >= 3 && !levelTransition) {
      ctx.fillStyle = player.stickCooldown <= 0 ? '#d8b4fe' : '#94a3b8';
      ctx.fillText(player.stickCooldown <= 0 ? 'Stick ready [Space/E]' : `Stick ${(player.stickCooldown / 1000).toFixed(1)}s`, W - 18, 66);
    }
  }

  function drawTransition() {
    if (!levelTransition) return;

    const next = LEVELS[pendingLevel];
    const seconds = Math.max(0, transitionTimer / 1000);

    ctx.save();
    ctx.fillStyle = 'rgba(2,6,23,0.60)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.fillText(next ? next.name : 'Next Level', W / 2, H / 2 - 34);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Starting in ${seconds.toFixed(1)}s`, W / 2, H / 2 + 8);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px Arial';
    ctx.fillText('Old balls cleared. Breathe, reposition, and get ready.', W / 2, H / 2 + 42);
    ctx.restore();
  }

  function drawShop() {
    if (!shopOpen) return;

    ctx.save();
    ctx.fillStyle = 'rgba(2,6,23,0.88)';
    ctx.fillRect(0, 0, W, H);

    const layout = getShopLayout();
    const { panelW, panelH, x, y, rowStartY, rowH, buttonW, buttonH } = layout;

    ctx.fillStyle = 'rgba(15,23,42,0.98)';
    roundRect(x, y, panelW, panelH, 22);
    ctx.fill();

    ctx.strokeStyle = 'rgba(250,204,21,0.68)';
    ctx.lineWidth = 2;
    roundRect(x, y, panelW, panelH, 22);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('Rogue Shop', x + 30, y + 24);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Gold: ${Math.floor(gold)}   +${lastRunGold} from last run`, x + 32, y + 66);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Arial';
    ctx.fillText('Click BUY or press 1-6. Press Enter/R or Play Again to start another run.', x + 32, y + 94);

    let rowY = rowStartY;
    UPGRADE_DEFS.forEach((def, i) => {
      const level = upgradeLevel(def.id);
      const maxed = level >= def.max;
      const cost = maxed ? 0 : upgradeCost(def);
      const affordable = gold >= cost;

      ctx.fillStyle = 'rgba(255,255,255,0.055)';
      roundRect(x + 28, rowY - 8, panelW - 250, 50, 13);
      ctx.fill();

      ctx.fillStyle = maxed ? '#22c55e' : affordable ? '#f8fafc' : '#64748b';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`${i + 1}. ${def.name}`, x + 44, rowY);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px Arial';
      ctx.fillText(def.desc, x + 44, rowY + 22);

      // Progress bar and max progress text.
      const progressX = x + 280;
      const progressY = rowY + 10;
      const progressW = 130;
      const progressH = 10;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(progressX, progressY, progressW, progressH, 5);
      ctx.fill();

      ctx.fillStyle = maxed ? '#22c55e' : '#38bdf8';
      roundRect(progressX, progressY, progressW * (level / def.max), progressH, 5);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`${level}/${def.max}`, progressX + progressW + 10, progressY - 3);

      // Buy button.
      const bx = x + panelW - buttonW - 34;
      const by = rowY + 3;

      ctx.fillStyle = maxed
        ? 'rgba(34,197,94,0.18)'
        : affordable
          ? 'rgba(250,204,21,0.22)'
          : 'rgba(100,116,139,0.18)';
      roundRect(bx, by, buttonW, buttonH, 12);
      ctx.fill();

      ctx.strokeStyle = maxed
        ? 'rgba(34,197,94,0.7)'
        : affordable
          ? 'rgba(250,204,21,0.75)'
          : 'rgba(100,116,139,0.55)';
      ctx.lineWidth = 1.5;
      roundRect(bx, by, buttonW, buttonH, 12);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = maxed ? '#22c55e' : affordable ? '#facc15' : '#94a3b8';
      ctx.font = 'bold 13px Arial';
      ctx.fillText(maxed ? 'MAXED' : `BUY ${cost}g`, bx + buttonW / 2, by + buttonH / 2);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      rowY += rowH;
    });

    // Upgrade radar / overall progress.
    const radarX = x + panelW - 125;
    const radarY = y + panelH - 118;
    drawUpgradeRadar(radarX, radarY, 58);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Upgrade Radar', radarX, radarY + 82);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px Arial';
    ctx.fillText('Tip: Compact Frame makes you smaller permanently but preserves the brick shape.', x + 32, y + panelH - 32);

    ctx.restore();
  }

  function drawStartOverlay() {
    if (started || shopOpen) return;

    ctx.save();
    ctx.fillStyle = 'rgba(2,6,23,0.45)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px Arial';
    ctx.fillText('Reverse Breakout', W / 2, H / 2 - 30);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Arial';
    ctx.fillText('Press Start Run. Survive, earn gold, upgrade, repeat.', W / 2, H / 2 + 10);
    ctx.fillText('Click canvas to toggle mouse-follow. Space/E uses stick from Level 3.', W / 2, H / 2 + 38);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(shake.x, shake.y);

    drawBackground();
    drawObstacles();
    drawPowerups();
    drawParticles();
    drawBalls();
    drawPlayer();
    drawHud();
    drawTransition();
    drawShop();
    drawStartOverlay();

    ctx.restore();
  }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min(40, ts - lastTime);
    lastTime = ts;

    if (started) {
      update(dt);
      updateDom();
    }

    render();
    requestAnimationFrame(loop);
  }

  function startRun() {
    shopOpen = false;
    lastRunGold = 0;
    started = true;
    lastTime = 0;
    runStart = performance.now();
    resetRun();
    startBtn.textContent = 'Restart';
    beep('power', 0.1);
  }

  startBtn.addEventListener('click', () => {
    startRun();
  });

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  });

  resetMetaBtn.addEventListener('click', resetProgress);

  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (shopOpen) {
      const n = Number(e.key);
      if (n >= 1 && n <= UPGRADE_DEFS.length) {
        buyUpgrade(n - 1);
        e.preventDefault();
        return;
      }

      if (e.key === 'Enter' || e.key.toLowerCase() === 'r') {
        startRun();
        e.preventDefault();
        return;
      }
    }

    if (e.key === ' ' || e.key.toLowerCase() === 'e') {
      useStick();
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!mouseFollow || !started || levelTransition || shopOpen) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    player.x = clamp(x - player.w / 2, 6, W - player.w - 6);
    player.y = clamp(y - player.h / 2, 6, H - player.h - 6);
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (shopOpen) {
      const upgradeIndex = getShopButtonAt(x, y);
      if (upgradeIndex !== -1) buyUpgrade(upgradeIndex);
      return;
    }

    mouseFollow = !mouseFollow;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 8, mouseFollow ? 170 : 20);
  });

  applyPermanentStats();
  resetRun();
  started = false;
  updateDom();
  requestAnimationFrame(loop);
})();
