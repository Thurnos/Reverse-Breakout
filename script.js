/* Reverse Breakout — Survive the Balls
   Player is a moving brick; balls bounce and try to hit player.
   Features: power-ups (including AutoDodge), particles, screen shake, warning, timer, highscore (localStorage).
*/

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // UI elements
  const startBtn = document.getElementById('startBtn');
  const muteBtn  = document.getElementById('muteBtn');
  const timerEl  = document.getElementById('timer');
  const highEl   = document.getElementById('high');
  const hpEl     = document.getElementById('hp');
  const powerEl  = document.getElementById('power');
  const levelEl  = document.getElementById('level'); // Optional: only used if your HTML has an element with id="level"

  // Audio elements
  const audio = {
    bgm: document.getElementById('bgm'),
    hit: document.getElementById('hitSfx'),
    power: document.getElementById('powerSfx'),
    warn: document.getElementById('warnSfx'),
  };
  let muted = false;
  function play(name, vol = 1) {
    try {
      if (muted) return;
      const a = audio[name];
      if (!a) return;
      a.volume = Math.min(Math.max(vol, 0), 1);
      a.currentTime = 0;
      a.play();
    } catch (e) {}
  }

  // Canvas / state
  let W = canvas.width, H = canvas.height;
  let started = false, lastTime = 0;
  let surviveStart = 0, elapsed = 0;

  // Level configuration
  // Level 1 keeps the original random balls.
  // Level 2 unlocks vertical and horizontal ball patterns.
  // Level 3 unlocks diagonal balls and the stick weapon.
  // Levels 4-7 introduce new attack patterns and terrain variety.
  let currentLevel = 1;
  const LEVELS = {
    1: {
      name: 'Level 1',
      spawnInterval: 2000,
      minSpawnInterval: 650,
      ballModes: ['normal'],
      speedBonus: 0,
      unlockAt: 0,
      waveChance: 0.20
    },
    2: {
      name: 'Level 2',
      spawnInterval: 1100,
      minSpawnInterval: 500,
      ballModes: ['vertical', 'horizontal'],
      speedBonus: 0.8,
      unlockAt: 30,
      waveChance: 0.30
    },
    3: {
      name: 'Level 3',
      spawnInterval: 850,
      minSpawnInterval: 420,
      ballModes: ['diagonal'],
      speedBonus: 1.4,
      unlockAt: 60,
      waveChance: 0.35
    },
    4: {
      name: 'Level 4: Crossfire',
      spawnInterval: 760,
      minSpawnInterval: 360,
      ballModes: ['normal', 'vertical', 'horizontal', 'diagonal'],
      speedBonus: 1.7,
      unlockAt: 90,
      waveChance: 0.45
    },
    5: {
      name: 'Level 5: Hunters',
      spawnInterval: 700,
      minSpawnInterval: 330,
      ballModes: ['aimed', 'aimed', 'normal', 'diagonal'],
      speedBonus: 1.9,
      unlockAt: 120,
      waveChance: 0.50
    },
    6: {
      name: 'Level 6: Swarm',
      spawnInterval: 620,
      minSpawnInterval: 300,
      ballModes: ['tinyFast', 'tinyFast', 'zigzag', 'horizontal', 'vertical'],
      speedBonus: 2.1,
      unlockAt: 150,
      waveChance: 0.60
    },
    7: {
      name: 'Level 7: Final Chaos',
      spawnInterval: 540,
      minSpawnInterval: 260,
      ballModes: ['heavy', 'aimed', 'zigzag', 'diagonal', 'tinyFast'],
      speedBonus: 2.4,
      unlockAt: 180,
      waveChance: 0.68
    }
  };

  // Highscore key
  const highKey = 'reverse_breakout_best';
  let best = Number(localStorage.getItem(highKey) || 0);
  highEl.textContent = `Best: ${best.toFixed(1)}s`;

  // Player (brick). Added autoDodge fields here.
  const player = {
    w: 80, h: 28,
    x: W/2 - 40, y: H/2 - 14,
    speed: 6,
    hp: 100,
    shield: false,
    shieldT: 0,
    color: '#02ffbcff',

    // Auto-dodge ability
    autoDodgeActive: false,
    autoDodgeTimer: 0,        // ms
    autoDodgeDuration: 5000,  // ms

    // Level 3 stick weapon.
    // Press Space or E to delete nearby balls.
    stickCooldown: 0,          // ms
    stickCooldownMax: 2000,    // ms
    stickRadius: 95,           // not too big, but enough to save yourself
    stickSwingTimer: 0,        // ms visual effect
    stickSwingDuration: 180,   // ms

    // Reflect shield powerup.
    // Different from the regular shield: this bounces balls away instead of absorbing one hit.
    reflectShield: false,
    reflectShieldT: 0,         // ms
    reflectShieldDuration: 6000,
    reflectRadius: 76,

    // Shrink powerup.
    // Makes the player smaller for a short time.
    baseW: 80,
    baseH: 28,
    shrinkActive: false,
    shrinkT: 0,                // ms
    shrinkDuration: 6000,
    shrinkScale: 0.62
  };

  // Ball class
  class Ball {
    constructor(x,y,dx,dy,r=12,color='#ff6b6b'){
      this.x = x; this.y = y; this.dx = dx; this.dy = dy; this.r = r; this.color = color;
      this.warned = false;
      this.zigzag = false;
      this.zigzagT = rand(0, Math.PI * 2);
      this.zigzagStrength = 0;
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
      // wall collisions
      if (this.x - this.r < 0) { this.x = this.r; this.dx = -this.dx; }
      if (this.x + this.r > W) { this.x = W - this.r; this.dx = -this.dx; }
      if (this.y - this.r < 0) { this.y = this.r; this.dy = -this.dy; }
      if (this.y + this.r > H) { this.y = H - this.r; this.dy = -this.dy; }
    }
  }
  let balls = [];

  // Level terrain / obstacles.
  // Level 1 has no obstacles. Level 2 introduces pillars in the middle.
  let obstacles = [];

  function createLevelTwoPillars() {
    const pillarW = 34;
    const pillarH = Math.min(170, H * 0.26);
    const gap = 110;
    const centerX = W / 2;
    const centerY = H / 2;

    obstacles = [
      { x: centerX - gap - pillarW / 2, y: centerY - pillarH / 2, w: pillarW, h: pillarH, color: 'rgba(148, 163, 184, 0.88)' },
      { x: centerX + gap - pillarW / 2, y: centerY - pillarH / 2, w: pillarW, h: pillarH, color: 'rgba(148, 163, 184, 0.88)' }
    ];
  }

  function createCrossfireTerrain() {
    createLevelTwoPillars();
    const block = 42;
    obstacles.push(
      { x: W * 0.22, y: H * 0.25, w: block, h: block, color: 'rgba(251, 146, 60, 0.88)' },
      { x: W * 0.72, y: H * 0.68, w: block, h: block, color: 'rgba(251, 146, 60, 0.88)' }
    );
  }

  function createHunterTerrain() {
    const w = 150;
    const h = 28;
    obstacles = [
      { x: W / 2 - w / 2, y: H / 2 - 95, w, h, color: 'rgba(56, 189, 248, 0.84)' },
      { x: W / 2 - w / 2, y: H / 2 + 95, w, h, color: 'rgba(56, 189, 248, 0.84)' },
      { x: W / 2 - 18, y: H / 2 - 35, w: 36, h: 70, color: 'rgba(56, 189, 248, 0.72)' }
    ];
  }

  function createSwarmTerrain() {
    const size = 56;
    obstacles = [
      { x: W * 0.25 - size / 2, y: H * 0.5 - size / 2, w: size, h: size, color: 'rgba(244, 114, 182, 0.78)' },
      { x: W * 0.5 - size / 2, y: H * 0.25 - size / 2, w: size, h: size, color: 'rgba(244, 114, 182, 0.78)' },
      { x: W * 0.75 - size / 2, y: H * 0.5 - size / 2, w: size, h: size, color: 'rgba(244, 114, 182, 0.78)' },
      { x: W * 0.5 - size / 2, y: H * 0.75 - size / 2, w: size, h: size, color: 'rgba(244, 114, 182, 0.78)' }
    ];
  }

  function createFinalTerrain() {
    const w = 36;
    const h = 150;
    obstacles = [
      { x: W * 0.30, y: H * 0.5 - h / 2, w, h, color: 'rgba(168, 85, 247, 0.80)' },
      { x: W * 0.70 - w, y: H * 0.5 - h / 2, w, h, color: 'rgba(168, 85, 247, 0.80)' },
      { x: W * 0.5 - 95, y: H * 0.28, w: 190, h: 26, color: 'rgba(168, 85, 247, 0.72)' },
      { x: W * 0.5 - 95, y: H * 0.72, w: 190, h: 26, color: 'rgba(168, 85, 247, 0.72)' }
    ];
  }

  function applyTerrainForLevel(level) {
    if (level === 1) clearLevelTerrain();
    else if (level === 2 || level === 3) createLevelTwoPillars();
    else if (level === 4) createCrossfireTerrain();
    else if (level === 5) createHunterTerrain();
    else if (level === 6) createSwarmTerrain();
    else if (level >= 7) createFinalTerrain();
  }

  function clearLevelTerrain() {
    obstacles = [];
  }

  function bounceBallOffObstacle(ball, obstacle) {
    if (!rectCircleCollide(obstacle.x, obstacle.y, obstacle.w, obstacle.h, ball.x, ball.y, ball.r)) {
      return;
    }

    const prevX = ball.prevX ?? ball.x;
    const prevY = ball.prevY ?? ball.y;

    const cameFromLeft = prevX + ball.r <= obstacle.x;
    const cameFromRight = prevX - ball.r >= obstacle.x + obstacle.w;
    const cameFromTop = prevY + ball.r <= obstacle.y;
    const cameFromBottom = prevY - ball.r >= obstacle.y + obstacle.h;

    if (cameFromLeft) {
      ball.x = obstacle.x - ball.r;
      ball.dx = -Math.abs(ball.dx);
    } else if (cameFromRight) {
      ball.x = obstacle.x + obstacle.w + ball.r;
      ball.dx = Math.abs(ball.dx);
    } else if (cameFromTop) {
      ball.y = obstacle.y - ball.r;
      ball.dy = -Math.abs(ball.dy);
    } else if (cameFromBottom) {
      ball.y = obstacle.y + obstacle.h + ball.r;
      ball.dy = Math.abs(ball.dy);
    } else {
      if (Math.abs(ball.dx) > Math.abs(ball.dy)) {
        ball.dx *= -1;
        ball.x += Math.sign(ball.dx || 1) * 3;
      } else {
        ball.dy *= -1;
        ball.y += Math.sign(ball.dy || 1) * 3;
      }
    }

    spawnParticles(ball.x, ball.y, 6, 210);
  }

  // Powerups: include autoDodge, reflect shield, and shrink here.
  const powerTypes = [/*'shield','health','slow','teleport','heal','speed',*/'autoDodge','reflectShield','shrink'];
  let powerups = [];

  // Particles & screen shake
  let particles = [];
  let shake = {x:0,y:0,intensity:0};

  // Input
  let keys = {};
  let mouseFollow = false;

  // Utilities
  const rand = (a,b) => Math.random()*(b-a)+a;
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  function rectCircleCollide(rx,ry,rw,rh, cx,cy,cr) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx*dx + dy*dy) <= (cr*cr);
  }

  // Spawn helpers
  function spawnBall(mode = 'normal') {
    const level = LEVELS[currentLevel] || LEVELS[1];
    let x, y, dx, dy;

    const speed = rand(2.2, 4.2)
      + Math.min(1.6, elapsed / 20)
      + level.speedBonus;

    // Level 2 pattern: perfectly vertical balls from the top/bottom.
    if (mode === 'vertical') {
      const fromTop = Math.random() < 0.5;
      x = rand(30, W - 30);
      y = fromTop ? -20 : H + 20;
      dx = 0;
      dy = fromTop ? speed : -speed;
      balls.push(new Ball(x, y, dx, dy, rand(8, 14), '#60a5fa'));
      return;
    }

    // Level 2 pattern: perfectly horizontal balls from the left/right.
    if (mode === 'horizontal') {
      const fromLeft = Math.random() < 0.5;
      x = fromLeft ? -20 : W + 20;
      y = rand(30, H - 30);
      dx = fromLeft ? speed : -speed;
      dy = 0;
      balls.push(new Ball(x, y, dx, dy, rand(8, 14), '#f97316'));
      return;
    }

    // Level 3 pattern: diagonal balls from the corners.
    // 0.707 keeps diagonal movement fair so it does not become faster than straight balls.
    if (mode === 'diagonal') {
      const corner = Math.floor(rand(0, 4));
      const diagonalSpeed = speed * 0.707;

      if (corner === 0) {
        // top-left to bottom-right
        x = -20;
        y = -20;
        dx = diagonalSpeed;
        dy = diagonalSpeed;
      } else if (corner === 1) {
        // top-right to bottom-left
        x = W + 20;
        y = -20;
        dx = -diagonalSpeed;
        dy = diagonalSpeed;
      } else if (corner === 2) {
        // bottom-right to top-left
        x = W + 20;
        y = H + 20;
        dx = -diagonalSpeed;
        dy = -diagonalSpeed;
      } else {
        // bottom-left to top-right
        x = -20;
        y = H + 20;
        dx = diagonalSpeed;
        dy = -diagonalSpeed;
      }

      balls.push(new Ball(x, y, dx, dy, rand(8, 14), '#a855f7'));
      return;
    }

    // Level 5 pattern: balls aim directly at the player's current position.
    if (mode === 'aimed') {
      const side = Math.floor(rand(0, 4));
      if (side === 0) { x = rand(0, W); y = -20; }
      if (side === 1) { x = W + 20; y = rand(0, H); }
      if (side === 2) { x = rand(0, W); y = H + 20; }
      if (side === 3) { x = -20; y = rand(0, H); }

      const targetX = player.x + player.w / 2;
      const targetY = player.y + player.h / 2;
      const angle = Math.atan2(targetY - y, targetX - x);
      dx = Math.cos(angle) * speed;
      dy = Math.sin(angle) * speed;

      balls.push(new Ball(x, y, dx, dy, rand(8, 13), '#22c55e'));
      return;
    }

    // Level 6 pattern: small, quick swarm balls.
    if (mode === 'tinyFast') {
      const side = Math.floor(rand(0, 4));
      const tinySpeed = speed * 1.22;

      if (side === 0) { x = rand(0, W); y = -20; dx = rand(-1.4, 1.4); dy = tinySpeed; }
      if (side === 1) { x = W + 20; y = rand(0, H); dx = -tinySpeed; dy = rand(-1.4, 1.4); }
      if (side === 2) { x = rand(0, W); y = H + 20; dx = rand(-1.4, 1.4); dy = -tinySpeed; }
      if (side === 3) { x = -20; y = rand(0, H); dx = tinySpeed; dy = rand(-1.4, 1.4); }

      balls.push(new Ball(x, y, dx, dy, rand(5, 8), '#facc15'));
      return;
    }

    // Level 6/7 pattern: balls wiggle while flying.
    if (mode === 'zigzag') {
      const side = Math.floor(rand(0, 4));
      const zigSpeed = speed * 0.95;

      if (side === 0) { x = rand(0, W); y = -20; dx = rand(-1.2, 1.2); dy = zigSpeed; }
      if (side === 1) { x = W + 20; y = rand(0, H); dx = -zigSpeed; dy = rand(-1.2, 1.2); }
      if (side === 2) { x = rand(0, W); y = H + 20; dx = rand(-1.2, 1.2); dy = -zigSpeed; }
      if (side === 3) { x = -20; y = rand(0, H); dx = zigSpeed; dy = rand(-1.2, 1.2); }

      const ball = new Ball(x, y, dx, dy, rand(8, 12), '#ec4899');
      ball.zigzag = true;
      ball.zigzagStrength = rand(0.55, 0.9);
      balls.push(ball);
      return;
    }

    // Level 7 pattern: large heavy balls, slower but dangerous.
    if (mode === 'heavy') {
      const side = Math.floor(rand(0, 4));
      const heavySpeed = speed * 0.62;

      if (side === 0) { x = rand(0, W); y = -28; dx = rand(-0.8, 0.8); dy = heavySpeed; }
      if (side === 1) { x = W + 28; y = rand(0, H); dx = -heavySpeed; dy = rand(-0.8, 0.8); }
      if (side === 2) { x = rand(0, W); y = H + 28; dx = rand(-0.8, 0.8); dy = -heavySpeed; }
      if (side === 3) { x = -28; y = rand(0, H); dx = heavySpeed; dy = rand(-0.8, 0.8); }

      balls.push(new Ball(x, y, dx, dy, rand(18, 25), '#ef4444'));
      return;
    }

    // Level 1 / default: original random-side ball.
    const side = Math.floor(rand(0, 4));
    if (side === 0) { x = rand(0, W); y = -20; dx = rand(-1, 1); dy = speed; }
    if (side === 1) { x = W + 20; y = rand(0, H); dx = -speed; dy = rand(-1, 1); }
    if (side === 2) { x = rand(0, W); y = H + 20; dx = rand(-1, 1); dy = -speed; }
    if (side === 3) { x = -20; y = rand(0, H); dx = speed; dy = rand(-1, 1); }
    balls.push(new Ball(x, y, dx, dy, rand(8, 14), '#ff6b6b'));
  }

  function useStickWeapon() {
    if (!started || currentLevel < 3 || player.stickCooldown > 0) {
      return;
    }

    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    let removed = 0;

    balls = balls.filter(ball => {
      const distance = Math.hypot(ball.x - px, ball.y - py);

      if (distance <= player.stickRadius + ball.r) {
        removed++;
        spawnParticles(ball.x, ball.y, 12, 275);
        return false;
      }

      return true;
    });

    player.stickCooldown = player.stickCooldownMax;
    player.stickSwingTimer = player.stickSwingDuration;

    if (removed > 0) {
      play('pop', 0.35);
      shake.intensity = Math.max(shake.intensity, 4);
    } else {
      play('warn', 0.18);
    }
  }

  function updateLevel() {
    const nextLevel = LEVELS[currentLevel + 1];

    if (nextLevel && elapsed >= nextLevel.unlockAt) {
      currentLevel++;
      spawnInterval = LEVELS[currentLevel].spawnInterval;
      applyTerrainForLevel(currentLevel);

      spawnParticles(W / 2, H / 2, 48, 200 + currentLevel * 18);
      play('warn', 0.45);

      if (currentLevel === 2) {
        spawnBall('vertical');
        spawnBall('horizontal');
      } else if (currentLevel === 3) {
        spawnBall('diagonal');
        spawnBall('diagonal');
      } else if (currentLevel === 4) {
        spawnBall('vertical');
        spawnBall('horizontal');
        spawnBall('diagonal');
      } else if (currentLevel === 5) {
        spawnBall('aimed');
        spawnBall('aimed');
      } else if (currentLevel === 6) {
        spawnBall('tinyFast');
        spawnBall('tinyFast');
        spawnBall('zigzag');
      } else if (currentLevel === 7) {
        spawnBall('heavy');
        spawnBall('aimed');
        spawnBall('zigzag');
      }
    }
  }

  function spawnPowerup(x,y) {
    const type = powerTypes[Math.floor(rand(0,powerTypes.length))];
    powerups.push({x,y,vy:1.6,type,w:28,h:28,life:800});
  }

  function spawnParticles(x,y,count=12, hue=10) {
    for (let i=0;i<count;i++){
      particles.push({
        x, y,
        vx: rand(-3,3),
        vy: rand(-5,1),
        life: rand(20,50),
        size: rand(1.5,4),
        col: `hsl(${rand(hue,hue+40)},70%,60%)`
      });
    }
  }

  // Game timers
  let spawnTimer = 0, spawnInterval = 2000; // ms
  let powerTimer = 0, powerInterval = 7000;

  // Reset game
  function resetGame() {
    balls = [];
    powerups = [];
    particles = [];
    clearLevelTerrain();
    player.w = player.baseW;
    player.h = player.baseH;
    player.x = W/2 - player.w/2;
    player.y = H/2 - player.h/2;
    player.hp = 100;
    player.shield = false;
    player.shieldT = 0;
    player.autoDodgeActive = false;
    player.autoDodgeTimer = 0;
    player.stickCooldown = 0;
    player.stickSwingTimer = 0;
    player.reflectShield = false;
    player.reflectShieldT = 0;
    player.shrinkActive = false;
    player.shrinkT = 0;
    elapsed = 0;
    currentLevel = 1;
    spawnTimer = 0; spawnInterval = LEVELS[1].spawnInterval;
    powerTimer = 0;
    balls.push(new Ball(W/2, -30, rand(-1.6,1.6), rand(2,3.5), 12));
  }

  // Apply power-up effects
  function applyPower(p) {
    play('power', 0.8);
    powerEl.textContent = `Power: ${p.type}`;
    switch (p.type) {
      case 'shield':
        player.shield = true;
        player.shieldT = 9000; // ms
        break;
      case 'slow':
        balls.forEach(b => { b.dx *= 0.55; b.dy *= 0.55; });
        setTimeout(()=> { balls.forEach(b => { b.dx *= 1.8; b.dy *= 1.8; }); }, 7000);
        break;
      case 'teleport':
        player.x = rand(20, W - player.w - 20);
        player.y = rand(20, H - player.h - 20);
        break;
      case 'heal':
        player.hp = clamp(player.hp + 22, 0, 100);
        break;
      case 'speed':
        player.speed *= 1.6;
        setTimeout(()=> { player.speed /= 1.6; }, 7000);
        break;
      case 'health':
        player.hp = clamp(player.hp + 20, 0, 100);
        break;
      case 'autoDodge':
        player.autoDodgeActive = true;
        player.autoDodgeTimer = player.autoDodgeDuration; // ms
        break;
      case 'reflectShield':
        player.reflectShield = true;
        player.reflectShieldT = player.reflectShieldDuration; // ms
        break;
      case 'shrink': {
        const centerX = player.x + player.w / 2;
        const centerY = player.y + player.h / 2;

        player.shrinkActive = true;
        player.shrinkT = player.shrinkDuration;
        player.w = player.baseW * player.shrinkScale;
        player.h = player.baseH * player.shrinkScale;

        player.x = clamp(centerX - player.w / 2, 0, W - player.w);
        player.y = clamp(centerY - player.h / 2, 0, H - player.h);
        break;
      }
    }
    spawnParticles(p.x, p.y, 12, 120);
  }

  // Collisions & power collection
  function handleCollisions(delta) {
    // Balls bouncing off level terrain / pillars.
    for (const b of balls) {
      for (const obstacle of obstacles) {
        bounceBallOffObstacle(b, obstacle);
      }
    }

    // Reflect shield bounces balls away before they can hit the player.
    if (player.reflectShield) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;

      for (const b of balls) {
        const dist = Math.hypot(b.x - px, b.y - py);

        if (dist <= player.reflectRadius + b.r) {
          const angle = Math.atan2(b.y - py, b.x - px);
          const currentSpeed = Math.max(3.5, Math.hypot(b.dx, b.dy));
          const reflectedSpeed = currentSpeed * 1.08;

          b.x = px + Math.cos(angle) * (player.reflectRadius + b.r + 2);
          b.y = py + Math.sin(angle) * (player.reflectRadius + b.r + 2);
          b.dx = Math.cos(angle) * reflectedSpeed;
          b.dy = Math.sin(angle) * reflectedSpeed;

          spawnParticles(b.x, b.y, 5, 190);
          shake.intensity = Math.max(shake.intensity, 1.5);
        }
      }
    }

    // Balls hitting player
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (rectCircleCollide(player.x, player.y, player.w, player.h, b.x, b.y, b.r)) {
        if (player.shield) {
          player.shield = false;
          player.shieldT = 0;
          spawnParticles(b.x, b.y, 18, 200);
          play('hit', 0.9);
        } else {
          player.hp -= Math.round(8 + b.r/2 + elapsed/20);
          spawnParticles(b.x, b.y, 18, 0);
          play('hit', 0.9);
          shake.intensity = 6;
        }
        if (Math.random() < 0.15) spawnPowerup(b.x, b.y);
        balls.splice(i,1);
      }
    }

    // Player collecting powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy;
      if (p.y > H + 40 || p.life-- <= 0) { powerups.splice(i,1); continue; }
      if (p.x >= player.x && p.x <= player.x + player.w && p.y >= player.y && p.y <= player.y + player.h) {
        applyPower(p);
        powerups.splice(i,1);
      }
    }

    // Warning: play warning sound when balls are near
    let near = false;
    for (const b of balls) {
      const dx = (b.x - (player.x + player.w/2));
      const dy = (b.y - (player.y + player.h/2));
      const dist = Math.hypot(dx, dy);
      if (dist < 140) { near = true; if (!b.warned) { play('warn', 0.12); b.warned = true; } }
      if (dist > 220) b.warned = false;
    }
    timerEl.style.color = near ? '#ffb703' : '#fff';

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.life <= 0) particles.splice(i,1);
    }
  }

  // Update loop (dt in milliseconds)
  function update(dt) {
    spawnTimer += dt;
    powerTimer += dt;
    elapsed = (performance.now() - surviveStart) / 1000;

    if (player.stickCooldown > 0) {
      player.stickCooldown = Math.max(0, player.stickCooldown - dt);
    }

    if (player.stickSwingTimer > 0) {
      player.stickSwingTimer = Math.max(0, player.stickSwingTimer - dt);
    }

    if (player.reflectShield) {
      player.reflectShieldT = Math.max(0, player.reflectShieldT - dt);
      if (player.reflectShieldT <= 0) {
        player.reflectShield = false;
      }
    }

    if (player.shrinkActive) {
      player.shrinkT = Math.max(0, player.shrinkT - dt);

      if (player.shrinkT <= 0) {
        const centerX = player.x + player.w / 2;
        const centerY = player.y + player.h / 2;

        player.shrinkActive = false;
        player.w = player.baseW;
        player.h = player.baseH;

        player.x = clamp(centerX - player.w / 2, 0, W - player.w);
        player.y = clamp(centerY - player.h / 2, 0, H - player.h);
      }
    }

    updateLevel();

    // Spawn balls based on the active level.
    if (spawnTimer > spawnInterval) {
      spawnTimer = 0;

      const level = LEVELS[currentLevel] || LEVELS[1];
      spawnInterval = Math.max(
        level.minSpawnInterval,
        level.spawnInterval - elapsed * 8
      );

      let count = 1;
      if (currentLevel >= 4 && Math.random() < 0.25) count++;
      if (Math.random() < (level.waveChance || 0.35)) count++;

      for (let i = 0; i < count; i++) {
        const mode = level.ballModes[Math.floor(rand(0, level.ballModes.length))];
        spawnBall(mode);
      }
    }

    // spawn powerups occasionally; later levels give slightly more chances to recover.
    if (powerTimer > powerInterval) {
      powerTimer = 0;
      powerInterval = currentLevel >= 5 ? 5600 : 7000;
      spawnPowerup(rand(80, W-80), -10);
    }

    // AutoDodge logic (uses Euclidean distance). dt is ms.
    if (player.autoDodgeActive) {
      let closestBall = null;
      let closestDist = Infinity;
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;

      for (const ball of balls) {
        const dx = ball.x - px;
        const dy = ball.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestBall = ball;
        }
      }

      if (closestBall && closestDist < 120) {
        // decide dodge direction based on where the ball is moving and its relative position
        // try to move perpendicular to incoming vector for better dodge
        const incomingX = closestBall.dx;
        const incomingY = closestBall.dy;
        // If ball is mostly coming horizontally, dodge vertically, otherwise dodge horizontally.
        const dodgeAmount = Math.max(4, player.speed); // px per frame (rough)
        if (Math.abs(incomingX) > Math.abs(incomingY)) {
          // dodge up or down based on ball's position
          if (closestBall.y < player.y) player.y += dodgeAmount;
          else player.y -= dodgeAmount;
        } else {
          // dodge left/right based on ball's x
          if (closestBall.x < player.x + player.w/2) player.x += dodgeAmount;
          else player.x -= dodgeAmount;
        }
      }

      // countdown timer (dt in ms)
      player.autoDodgeTimer -= dt;
      if (player.autoDodgeTimer <= 0) {
        player.autoDodgeActive = false;
        player.autoDodgeTimer = 0;
        powerEl.textContent = 'Power: —';
      }
    }

    // keyboard movement (still allowed; AutoDodge nudges on top of this)
    if (keys['ArrowLeft'] || keys['a']) player.x -= player.speed;
    if (keys['ArrowRight']|| keys['d']) player.x += player.speed;
    if (keys['ArrowUp']   || keys['w']) player.y -= player.speed;
    if (keys['ArrowDown'] || keys['s']) player.y += player.speed;

    // clamp player inside arena
    player.x = clamp(player.x, 6, W - player.w - 6);
    player.y = clamp(player.y, 6, H - player.h - 6);

    // mouse-follow handled separately; update balls
    for (const b of balls) b.update();

    // shield countdown
    if (player.shield) {
      player.shieldT -= dt;
      if (player.shieldT <= 0) { player.shield = false; player.shieldT = 0; }
    }

    // collisions & particle updates
    handleCollisions(dt);

    // screen shake decay
    if (shake.intensity > 0) {
      shake.x = rand(-shake.intensity, shake.intensity);
      shake.y = rand(-shake.intensity, shake.intensity);
      shake.intensity *= 0.92;
    } else { shake.x = 0; shake.y = 0; }

    // losing condition
    if (player.hp <= 0) {
      endGame();
    }
  }

  // Rendering helpers
  function drawBackground() {
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'rgba(255,255,255,0.015)');
    g.addColorStop(1,'rgba(0,0,0,0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
  }

  function drawObstacles() {
    for (const obstacle of obstacles) {
      ctx.save();

      const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x + obstacle.w, obstacle.y + obstacle.h);
      gradient.addColorStop(0, 'rgba(255,255,255,0.32)');
      gradient.addColorStop(0.25, obstacle.color);
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');

      ctx.fillStyle = gradient;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      ctx.lineWidth = 2;
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(obstacle.x + obstacle.w - 5, obstacle.y + 4, 3, obstacle.h - 8);

      ctx.restore();
    }
  }

  function drawPlayer() {
    ctx.save();
    // body
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    // inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(player.x+6, player.y+4, player.w-12, player.h-8);

    // shield ring
    if (player.shield) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(player.x-6, player.y-6, player.w+12, player.h+12);
    }

    // AutoDodge visual indicator (cyan glow)
    if (player.autoDodgeActive) {
      const alpha = clamp(player.autoDodgeTimer / player.autoDodgeDuration, 0, 1);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0,230,230,${0.6 * alpha})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(player.x-8, player.y-8, player.w+16, player.h+16);
    }
    if (player.shrinkActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x - 4, player.y - 4, player.w + 8, player.h + 8);
      ctx.restore();
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

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.arc(px, py, player.reflectRadius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (currentLevel >= 3) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const ready = player.stickCooldown <= 0;
      const swingAlpha = clamp(player.stickSwingTimer / player.stickSwingDuration, 0, 1);

      // Small stick attached to the player.
      ctx.lineCap = 'round';
      ctx.strokeStyle = ready ? 'rgba(245, 222, 179, 0.95)' : 'rgba(130, 130, 130, 0.6)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(px + player.w / 2 - 6, py - 6);
      ctx.lineTo(px + player.w / 2 + 30, py - 24);
      ctx.stroke();

      ctx.strokeStyle = ready ? 'rgba(255, 255, 255, 0.95)' : 'rgba(90, 90, 90, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + player.w / 2 - 6, py - 6);
      ctx.lineTo(px + player.w / 2 + 30, py - 24);
      ctx.stroke();

      // Swing / hit radius pulse only appears when used.
      if (swingAlpha > 0) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.25 + 0.35 * swingAlpha})`;
        ctx.lineWidth = 4;
        ctx.arc(px, py, player.stickRadius * (1.05 - swingAlpha * 0.2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawBalls() {
    for (const b of balls) {
      ctx.beginPath();
      const g = ctx.createRadialGradient(b.x - b.r/3, b.y - b.r/3, 2, b.x, b.y, b.r*1.6);
      g.addColorStop(0,'rgba(255,255,255,0.9)');
      g.addColorStop(0.4, b.color);
      g.addColorStop(1, 'rgba(30,30,30,0.55)');
      ctx.fillStyle = g;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.stroke();
    }
  }

  function drawPowerups() {
    for (const p of powerups) {
      ctx.save();
      ctx.fillStyle = p.type === 'reflectShield' ? '#38bdf8'
        : p.type === 'shrink' ? '#f472b6'
        : '#0ea5a1';
      ctx.fillRect(p.x - p.w/2, p.y - p.h/2, p.w, p.h);

      if (p.type === 'reflectShield' || p.type === 'shrink') {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - p.w/2 - 2, p.y - p.h/2 - 2, p.w + 4, p.h + 4);
      }

      ctx.fillStyle = '#042f2f';
      ctx.textAlign = 'center'; ctx.textBaseline='middle';
      ctx.font = 'bold 13px Arial';
      const label = p.type === 'reflectShield' ? 'R' : p.type === 'shrink' ? '↓' : p.type[0].toUpperCase();
      ctx.fillText(label, p.x, p.y);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / 60, 0, 1);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }

  function drawHUD() {
    const barW = 160, barH = 12;
    const bx = 14, by = H - 24;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(bx-2, by-2, barW+4, barH+4);
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, barW, barH);
    const pct = clamp(player.hp/100, 0, 1);
    ctx.fillStyle = pct > 0.5 ? '#06d6a0' : (pct > 0.25 ? '#ffd166' : '#ff6b6b');
    ctx.fillRect(bx, by, barW * pct, barH);
    ctx.fillStyle = '#fff'; ctx.font = '12px Arial'; ctx.textAlign = 'left';
    ctx.fillText(`HP: ${Math.max(0, Math.round(player.hp))}`, bx + 4, by - 6);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${LEVELS[currentLevel].name}`, W - 16, 28);
    ctx.font = '12px Arial';
    ctx.fillStyle = currentLevel === 1 ? '#aaa' : '#ffb703';
    const nextLevel = LEVELS[currentLevel + 1];
    const levelHint = nextLevel
      ? `Next: ${nextLevel.name} at ${nextLevel.unlockAt}s`
      : 'Final level: survive as long as possible';
    ctx.fillText(levelHint, W - 16, 46);

    if (currentLevel >= 3) {
      const stickReady = player.stickCooldown <= 0;
      ctx.fillStyle = stickReady ? '#d8b4fe' : '#aaa';
      const stickText = stickReady
        ? 'Stick: READY [Space/E]'
        : `Stick: ${(player.stickCooldown / 1000).toFixed(1)}s`;
      ctx.fillText(stickText, W - 16, 64);
    }

    if (player.reflectShield) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`Reflect Shield: ${Math.ceil(player.reflectShieldT / 1000)}s`, W - 16, currentLevel >= 3 ? 82 : 64);
    }

    if (player.shrinkActive) {
      ctx.fillStyle = '#f472b6';
      const shrinkY = currentLevel >= 3
        ? player.reflectShield ? 100 : 82
        : player.reflectShield ? 82 : 64;
      ctx.fillText(`Shrink: ${Math.ceil(player.shrinkT / 1000)}s`, W - 16, shrinkY);
    }

    ctx.textAlign = 'left';

    // AutoDodge cooldown bar (small)
    const cdX = bx + 200, cdY = by - 8;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(cdX - 2, cdY - 2, 110, 14);
    ctx.fillStyle = '#222';
    ctx.fillRect(cdX, cdY, 106, 10);
    if (player.autoDodgeActive) {
      const ratio = clamp(player.autoDodgeTimer / player.autoDodgeDuration, 0, 1);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(cdX, cdY, 106 * ratio, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '11px Arial';
      ctx.fillText('AutoDodge', cdX + 6, cdY - 4);
    } else {
      ctx.fillStyle = '#666';
      ctx.fillRect(cdX, cdY, 106, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '11px Arial';
      ctx.fillText('AutoDodge (pick-up)', cdX + 6, cdY - 4);
    }
  }

  function render() {
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.translate(shake.x, shake.y);

    drawBackground();
    drawObstacles();
    drawPowerups();
    drawParticles();
    drawBalls();
    drawPlayer();
    drawHUD();

    ctx.restore();
  }

  // Main loop
  function loop(ts) {
    if (!started) return;
    if (!lastTime) lastTime = ts;
    const dt = ts - lastTime;
    lastTime = ts;
    update(dt);   // dt in ms
    render();
    // update UI elements
    timerEl.textContent = `Time: ${elapsed.toFixed(1)}s`;
    hpEl.textContent = `HP: ${Math.max(0, Math.round(player.hp))}`;
    if (levelEl) levelEl.textContent = `Level: ${currentLevel}`;
    if (player.shrinkActive) {
      powerEl.textContent = `Power: SHRINK ${Math.ceil(player.shrinkT/1000)}s`;
    } else if (player.reflectShield) {
      powerEl.textContent = `Power: REFLECT SHIELD ${Math.ceil(player.reflectShieldT/1000)}s`;
    } else if (player.shield) {
      powerEl.textContent = `Power: SHIELD ${Math.ceil(player.shieldT/1000)}s`;
    } else if (currentLevel >= 3) {
      powerEl.textContent = player.stickCooldown <= 0
        ? 'Stick: READY [Space/E]'
        : `Stick: ${(player.stickCooldown / 1000).toFixed(1)}s`;
    }
    requestAnimationFrame(loop);
  }

  // End game
  function endGame() {
    started = false;
    if (elapsed > best) { best = elapsed; localStorage.setItem(highKey, best.toFixed(1)); highEl.textContent = `Best: ${best.toFixed(1)}s`; }
    try { audio.bgm.pause(); } catch (e) {}
    setTimeout(()=> alert(`You survived ${elapsed.toFixed(1)}s\nBest: ${best.toFixed(1)}s`), 80);
    startBtn.textContent = 'Start';
  }

  // Input handlers
  window.addEventListener('keydown', e => {
    keys[e.key] = true;

    if (e.key === ' ' || e.key.toLowerCase() === 'e') {
      e.preventDefault();
      useStickWeapon();
    }
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  canvas.addEventListener('mousemove', e => {
    if (!mouseFollow) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    player.x = clamp(x - player.w / 2, 6, W - player.w - 6);
    player.y = clamp(y - player.h / 2, 6, H - player.h - 6);
  });

  canvas.addEventListener('click', () => {
    mouseFollow = !mouseFollow;
  });

  // Start / restart and mute buttons
  startBtn.addEventListener('click', () => {
    if (!started) {
      if (!muted) try { audio.bgm.play(); } catch(e) {}
      started = true;
      lastTime = 0;
      surviveStart = performance.now();
      resetGame();
      startBtn.textContent = 'Restart';
      requestAnimationFrame(loop);
    } else {
      surviveStart = performance.now();
      resetGame();
      lastTime = 0;
    }
  });

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    if (muted) { muteBtn.textContent = 'Unmute'; try { audio.bgm.pause(); } catch(e){} }
    else { muteBtn.textContent = 'Mute'; try { audio.bgm.play(); } catch(e){} }
  });

  // Init HiDPI friendly canvas sizing
  function init() {
    const dpr = devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.scale(dpr, dpr);
    W = cssW; H = cssH;
  }

  // Start idle render so user sees initial scene
  window.addEventListener('load', () => {
    init();
    resetGame();
    function idle(t) {
      render();
      requestAnimationFrame(idle);
    }
    requestAnimationFrame(idle);
  });

})();
