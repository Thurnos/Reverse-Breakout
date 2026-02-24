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
    } catch (e) { }
  }

  // Canvas / state
  let W = canvas.width, H = canvas.height;
  let started = false, lastTime = 0;
  let surviveStart = 0, elapsed = 0;

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
  };

  // Ball class
  class Ball {
    constructor(x,y,dx,dy,r=12,color='#ff6b6b'){
      this.x = x; this.y = y; this.dx = dx; this.dy = dy; this.r = r; this.color = color;
      this.warned = false;
    }
    update() {
      this.x += this.dx;
      this.y += this.dy;
      // wall collisions
      if (this.x - this.r < 0) { this.x = this.r; this.dx = -this.dx; }
      if (this.x + this.r > W) { this.x = W - this.r; this.dx = -this.dx; }
      if (this.y - this.r < 0) { this.y = this.r; this.dy = -this.dy; }
      if (this.y + this.r > H) { this.y = H - this.r; this.dy = -this.dy; }
    }
  }
  let balls = [];

  // Powerups: include autoDodge here
  const powerTypes = ['shield','health','slow','teleport','heal','speed','autoDodge'];
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
  function spawnBall() {
    const side = Math.floor(rand(0,4));
    let x,y,dx,dy;
    const speed = rand(2.2, 4.2) + Math.min(1.6, elapsed/20);
    if (side === 0) { x = rand(0,W); y = -20; dx = rand(-1,1); dy = speed; }
    if (side === 1) { x = W + 20; y = rand(0,H); dx = -speed; dy = rand(-1,1); }
    if (side === 2) { x = rand(0,W); y = H + 20; dx = rand(-1,1); dy = -speed; }
    if (side === 3) { x = -20; y = rand(0,H); dx = speed; dy = rand(-1,1); }
    balls.push(new Ball(x,y,dx,dy, rand(8,14)));
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
    player.x = W/2 - player.w/2;
    player.y = H/2 - player.h/2;
    player.hp = 100;
    player.shield = false;
    player.shieldT = 0;
    player.autoDodgeActive = false;
    player.autoDodgeTimer = 0;
    elapsed = 0;
    spawnTimer = 0; spawnInterval = 2000;
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
    }
    spawnParticles(p.x, p.y, 12, 120);
  }

  // Collisions & power collection
  function handleCollisions(delta) {
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

    // spawn balls faster over time
    if (spawnTimer > spawnInterval) {
      spawnTimer = 0;
      spawnInterval = Math.max(650, spawnInterval * 0.95);
      const count = Math.random() < 0.2 ? 2 : 1;
      for (let i=0;i<count;i++) spawnBall();
    }

    // spawn powerups occasionally
    if (powerTimer > powerInterval) {
      powerTimer = 0;
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
    ctx.restore();
  }

  function drawBalls() {
    for (const b of balls) {
      ctx.beginPath();
      const g = ctx.createRadialGradient(b.x - b.r/3, b.y - b.r/3, 2, b.x, b.y, b.r*1.6);
      g.addColorStop(0,'rgba(255,255,255,0.9)');
      g.addColorStop(0.4, 'rgba(255,120,120,0.9)');
      g.addColorStop(1, 'rgba(180,30,30,0.6)');
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
      ctx.fillStyle = '#0ea5a1';
      ctx.fillRect(p.x - p.w/2, p.y - p.h/2, p.w, p.h);
      ctx.fillStyle = '#042f2f';
      ctx.textAlign = 'center'; ctx.textBaseline='middle';
      ctx.font = 'bold 13px Arial';
      ctx.fillText(p.type[0].toUpperCase(), p.x, p.y);
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
    if (player.shield) powerEl.textContent = `Power: SHIELD ${Math.ceil(player.shieldT/1000)}s`;
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
  window.addEventListener('keydown', e => { keys[e.key] = true; });
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


