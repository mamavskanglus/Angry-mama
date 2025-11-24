// src/main.ts
import * as Matter from 'matter-js';
const { Engine, World, Bodies, Body, Runner, Events, Constraint, Composite } = Matter;

let gameState: 'menu' | 'playing' | 'levelComplete' | 'gameOver' = 'menu';
let currentLevel = 1;
let globalScore = 0;
let isMuted = false;
let isLandscapeMode = false;

function checkOrientation() {
  const isMobile = window.innerWidth <= 768;
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  
  if (isMobile && !isLandscape) {
    document.body.classList.remove('landscape-mode');
  } else {
    document.body.classList.add('landscape-mode');
    isLandscapeMode = true;
  }
}

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const menuScreen = document.getElementById('menuScreen') as HTMLDivElement;
const gameUI = document.getElementById('gameUI') as HTMLDivElement;
const levelCompleteScreen = document.getElementById('levelCompleteScreen') as HTMLDivElement;
const gameOverScreen = document.getElementById('gameOverScreen') as HTMLDivElement;
const gameCompletionScreen = document.getElementById('gameCompletionScreen') as HTMLDivElement;
const muteBtn = document.getElementById('muteBtn') as HTMLButtonElement;

const scoreEl = document.getElementById('score') as HTMLDivElement;
const levelEl = document.getElementById('level') as HTMLDivElement;
const finalScoreEl = document.getElementById('finalScore') as HTMLDivElement;
const completeLevelEl = document.getElementById('completeLevel') as HTMLDivElement;
const gameOverScoreEl = document.getElementById('gameOverScore') as HTMLDivElement;
const finalGameScoreEl = document.getElementById('finalGameScore') as HTMLDivElement;

if (!canvas) throw new Error('Canvas not found');

const ctx = canvas.getContext('2d')!;
const engine = Engine.create();
const world = engine.world;

world.gravity.y = 1;
engine.timing.timeScale = 0.9;

const runner = Runner.create();
Runner.run(runner, engine);

const GROUND_HEIGHT = 90;

// Friend images
let friend1Image: HTMLImageElement;
let friend2Image: HTMLImageElement;
let friend3Image: HTMLImageElement;
let friend4Image: HTMLImageElement;
let imagesLoaded = false;

function loadImages(): Promise<boolean> {
  return new Promise((resolve) => {
    let imagesToLoad = 4;
    let imagesLoadedCount = 0;

    friend1Image = new Image();
    friend2Image = new Image();
    friend3Image = new Image();
    friend4Image = new Image();

    const onImageLoad = () => {
      imagesLoadedCount++;
      if (imagesLoadedCount === imagesToLoad) {
        imagesLoaded = true;
        resolve(true);
      }
    };

    friend1Image.onload = onImageLoad;
    friend2Image.onload = onImageLoad;
    friend3Image.onload = onImageLoad;
    friend4Image.onload = onImageLoad;

    friend1Image.onerror = friend2Image.onerror = friend3Image.onerror = friend4Image.onerror = () => {
      imagesLoadedCount++;
      if (imagesLoadedCount === imagesToLoad) {
        imagesLoaded = false;
        resolve(false);
      }
    };

    try {
      friend1Image.src = new URL('./assets/friend1-face.png', import.meta.url).href;
      friend2Image.src = new URL('./assets/friend2-face.png', import.meta.url).href;
      friend3Image.src = new URL('./assets/friend3-face.png', import.meta.url).href;
      friend4Image.src = new URL('./assets/friend4-face.png', import.meta.url).href;
    } catch (e) {
      friend1Image.src = './assets/friend1-face.png';
      friend2Image.src = './assets/friend2-face.png';
      friend3Image.src = './assets/friend3-face.png';
      friend4Image.src = './assets/friend4-face.png';
    }
  });
}

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let WORLD_W = window.innerWidth;
let WORLD_H = window.innerHeight;
let BIRD_RADIUS = 25;
let STRUCTURE_BASE_Y = WORLD_H - GROUND_HEIGHT - 10;

interface Bird {
  body: Matter.Body;
  launched: boolean;
  type: 'red' | 'blue' | 'yellow';
  launchTime: number;
}

interface Block {
  body: Matter.Body;
  health: number;
  maxHealth: number;
  type: 'wood' | 'stone' | 'glass' | 'cardboard' | 'bamboo' | 'thatch' | 'clay';
  isStatic: boolean;
}

interface Pig {
  body: Matter.Body;
  health: number;
  maxHealth: number;
  isBoss: boolean;
  lastY: number;
}

let birds: Bird[] = [];
let currentBirdIndex = 0;
let slingConstraint: Matter.Constraint | null = null;
let blocks: Block[] = [];
let pigs: Pig[] = [];
let score = 0;
let dragging = false;
let advanceTimer = 0;

let clouds: { x: number; y: number; size: number; speed: number }[] = [];

function createBackground() {
  clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * WORLD_W,
      y: 40 + Math.random() * 120,
      size: 40 + Math.random() * 60,
      speed: 0.05 + Math.random() * 0.2
    });
  }
}

function updateBackground() {
  for (const cloud of clouds) {
    cloud.x += cloud.speed;
    if (cloud.x > WORLD_W + cloud.size) {
      cloud.x = -cloud.size;
      cloud.y = 40 + Math.random() * 120;
    }
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.35, y - size * 0.25, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.7, y, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrass(ctx: CanvasRenderingContext2D) {
  const baseY = WORLD_H - GROUND_HEIGHT + 5;
  ctx.strokeStyle = '#2daa2d';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  
  for (let x = 0; x < WORLD_W; x += 8) {
    const height = 8 + Math.sin(x * 0.1) * 6;
    const lean = Math.sin(x * 0.05) * 3;
    
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + lean, baseY - height * 0.7, x + lean * 1.5, baseY - height);
    ctx.stroke();
  }
}

function addScore(n: number) {
  score += n;
  globalScore += n;
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
}

function spawnBirds(types: ('red' | 'blue' | 'yellow')[]) {
  for (const b of birds) {
    try { World.remove(world, b.body); } catch (e) {}
  }
  birds = [];

  const startX = 170;
  const startY = WORLD_H - GROUND_HEIGHT - BIRD_RADIUS - 2;

  for (let i = 0; i < types.length; i++) {
    const x = startX - (i * (BIRD_RADIUS * 2.8));
    const y = startY;
    
    const body = Bodies.circle(x, y, BIRD_RADIUS, {
      label: 'bird',
      restitution: 0.3,
      friction: 0.8,
      frictionAir: 0.01,
      density: 0.003,
      collisionFilter: { group: -1 }
    });
    World.add(world, body);
    Body.setStatic(body, true);
    birds.push({ body, launched: false, type: types[i], launchTime: 0 });
  }
}

function attachBirdToSling(index: number) {
  if (index < 0 || index >= birds.length) return;
  currentBirdIndex = index;
  const birdObj = birds[index];

  Body.setStatic(birdObj.body, false);
  Body.setVelocity(birdObj.body, { x: 0, y: 0 });
  Body.setAngularVelocity(birdObj.body, 0);
  Body.setPosition(birdObj.body, { x: 170, y: WORLD_H - GROUND_HEIGHT - 110 });
  Body.setAngle(birdObj.body, 0);

  if (slingConstraint) {
    World.remove(world, slingConstraint);
  }

  slingConstraint = Constraint.create({
    pointA: { x: 170, y: WORLD_H - GROUND_HEIGHT - 110 },
    bodyB: birdObj.body,
    stiffness: 0.05,
    damping: 0.08,
    length: 0
  });
  
  World.add(world, slingConstraint);
  birdObj.launched = false;
}

function releaseBirdFromSling() {
  if (!slingConstraint) return;
  
  const birdBody = slingConstraint.bodyB as Matter.Body;
  const dx = 170 - birdBody.position.x;
  const dy = (WORLD_H - GROUND_HEIGHT - 110) - birdBody.position.y;
  const dist = Math.hypot(dx, dy);

  World.remove(world, slingConstraint);
  slingConstraint = null;

  if (dist < 10) {
    Body.setPosition(birdBody, { x: 170, y: WORLD_H - GROUND_HEIGHT - 110 });
    attachBirdToSling(currentBirdIndex);
    return;
  }

  const power = Math.min(dist / 60, 2.5);
  const velocityMag = power * 12;

  const velocity = { 
    x: (dx / dist) * velocityMag, 
    y: (dy / dist) * velocityMag 
  };
  
  Body.setVelocity(birdBody, velocity);
  Body.setAngularVelocity(birdBody, (Math.random() - 0.5) * 0.2);

  const idx = birds.findIndex((b) => b.body === birdBody);
  if (idx >= 0) {
    birds[idx].launched = true;
    birds[idx].launchTime = Date.now();
  }
}

function addStableBlock(x: number, y: number, w: number, h: number, type: Block['type'], health: number): Matter.Body {
  const body = Bodies.rectangle(x, y, w, h, {
    label: 'block',
    isStatic: true,
    friction: 0.8,
    restitution: 0.2,
    density: 0.001
  });

  World.add(world, body);
  blocks.push({ body, health, maxHealth: health, type, isStatic: true });
  return body;
}

function addPig(x: number, y: number, health: number, isBoss: boolean): Matter.Body {
  const radius = isBoss ? 40 : 30;
  
  const body = Bodies.circle(x, y, radius, {
    label: 'pig',
    restitution: 0.2,
    friction: 0.8,
    density: 0.0025,
    isStatic: false
  });

  World.add(world, body);
  pigs.push({ body, health, maxHealth: health, isBoss, lastY: y });
  return body;
}

function buildAssamHouse(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  const platform = Bodies.rectangle(x, baseY, 400, 30, {
    isStatic: true, 
    label: 'platform'
  });
  World.add(world, platform);

  addStableBlock(x - 80, baseY - 20, 35, 25, 'wood', 3);
  addStableBlock(x - 40, baseY - 20, 35, 25, 'wood', 3);
  addStableBlock(x, baseY - 20, 35, 25, 'wood', 3);
  addStableBlock(x + 40, baseY - 20, 35, 25, 'wood', 3);
  addStableBlock(x + 80, baseY - 20, 35, 25, 'wood', 3);

  addStableBlock(x, baseY - 50, 220, 20, 'wood', 2);

  // FIXED: Actually add pigs to the level
  addPig(x - 30, baseY - 60, 5, false);
  addPig(x + 30, baseY - 60, 5, false);
  addPig(x, baseY - 100, 5, false);
}

function buildTwoStory(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  const platform = Bodies.rectangle(x, baseY, 450, 30, {
    isStatic: true, label: 'platform'
  });
  World.add(world, platform);

  addStableBlock(x - 120, baseY - 35, 30, 60, 'stone', 5);
  addStableBlock(x + 120, baseY - 35, 30, 60, 'stone', 5);

  addStableBlock(x - 100, baseY - 105, 28, 60, 'stone', 5);
  addStableBlock(x + 100, baseY - 105, 28, 60, 'stone', 5);

  // FIXED: Actually add pigs to the level
  addPig(x - 80, baseY - 45, 6, false);
  addPig(x + 80, baseY - 45, 6, false);
  addPig(x, baseY - 185, 6, false);
}

function buildThreeStory(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  const platform = Bodies.rectangle(x, baseY, 500, 30, {
    isStatic: true, label: 'platform'
  });
  World.add(world, platform);

  addStableBlock(x - 140, baseY - 40, 30, 70, 'stone', 6);
  addStableBlock(x + 140, baseY - 40, 30, 70, 'stone', 6);

  addStableBlock(x - 120, baseY - 120, 28, 70, 'stone', 5);
  addStableBlock(x + 120, baseY - 120, 28, 70, 'stone', 5);

  // FIXED: Actually add pigs to the level
  addPig(x - 90, baseY - 50, 8, false);
  addPig(x + 90, baseY - 50, 8, false);
  addPig(x, baseY - 270, 12, true);
}

function buildFinalLevel(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  const platform = Bodies.rectangle(x, baseY, 550, 30, {
    isStatic: true, label: 'platform'
  });
  World.add(world, platform);

  addStableBlock(x - 160, baseY - 60, 35, 100, 'stone', 8);
  addStableBlock(x + 160, baseY - 60, 35, 100, 'stone', 8);

  // FIXED: Actually add pigs to the level
  addPig(x - 160, baseY - 120, 8, false);
  addPig(x + 160, baseY - 120, 8, false);
  addPig(x, baseY - 240, 15, true);
}

let ground: Matter.Body;
let leftWall: Matter.Body;
let rightWall: Matter.Body;

function buildWorld() {
  WORLD_W = window.innerWidth;
  WORLD_H = window.innerHeight;
  STRUCTURE_BASE_Y = WORLD_H - GROUND_HEIGHT - 10;
  BIRD_RADIUS = 25;

  // Clear everything
  Composite.clear(world, false);
  birds = [];
  blocks = [];
  pigs = []; // FIXED: Make sure pigs array is cleared
  currentBirdIndex = 0;
  slingConstraint = null;
  score = 0;
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  if (levelEl) levelEl.textContent = `Level: ${currentLevel}`;
  advanceTimer = 0;

  createBackground();

  if (!imagesLoaded) {
    loadImages();
  }

  // Create ground and walls
  ground = Bodies.rectangle(
    WORLD_W / 2,
    WORLD_H - GROUND_HEIGHT / 2,
    WORLD_W * 3,
    GROUND_HEIGHT,
    { isStatic: true, label: 'ground' }
  );

  leftWall = Bodies.rectangle(-50, WORLD_H / 2, 100, WORLD_H * 3, { 
    isStatic: true, label: 'wall'
  });
  rightWall = Bodies.rectangle(WORLD_W + 50, WORLD_H / 2, 100, WORLD_H * 3, { 
    isStatic: true, label: 'wall'
  });
  World.add(world, [ground, leftWall, rightWall]);

  const structureX = WORLD_W - Math.floor(WORLD_W * 0.25);
  
  console.log(`Building level ${currentLevel} with structure at ${structureX}`);
  
  switch (currentLevel) {
    case 1: 
      buildAssamHouse(structureX); 
      break;
    case 2: 
      buildTwoStory(structureX); 
      break;
    case 3: 
      buildThreeStory(structureX); 
      break;
    case 4: 
      buildFinalLevel(structureX); 
      break;
    default: 
      buildAssamHouse(structureX); 
      break;
  }

  console.log(`Level ${currentLevel} built with ${pigs.length} pigs`);

  const birdTypesList: ('red' | 'blue' | 'yellow')[][] = [
    ['red', 'red', 'red', 'blue', 'yellow'],
    ['red', 'blue', 'red', 'blue', 'yellow', 'red'],
    ['red', 'blue', 'yellow', 'red', 'blue', 'yellow', 'red'],
    ['red', 'blue', 'yellow', 'blue', 'yellow', 'red', 'blue', 'yellow']
  ];
  
  const birdTypes = birdTypesList[currentLevel - 1] || ['red', 'red', 'red', 'blue', 'yellow'];
  spawnBirds(birdTypes);
  
  if (birds.length > 0) {
    attachBirdToSling(0);
  }

  // Remove any existing collision handlers first
  Events.off(engine, 'collisionStart');
  
  // Add collision handler
  Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;
    for (const pair of pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      // Bird hits pig
      if ((bodyA.label === 'pig' && bodyB.label === 'bird') || 
          (bodyB.label === 'pig' && bodyA.label === 'bird')) {
        
        const pigBody = bodyA.label === 'pig' ? bodyA : bodyB;
        const birdBody = bodyA.label === 'pig' ? bodyB : bodyA;
        
        const pig = pigs.find(p => p.body === pigBody);
        const bird = birds.find(b => b.body === birdBody);
        
        if (pig && bird) {
          pig.health -= 10;
          console.log(`Pig hit! Health: ${pig.health}`);
          
          if (pig.health <= 0) {
            World.remove(world, pig.body);
            pigs = pigs.filter(p => p !== pig);
            addScore(pig.isBoss ? 300 : 150);
            console.log(`Pig defeated! Pigs remaining: ${pigs.length}`);
          }
        }
      }

      // Bird hits block
      if ((bodyA.label === 'block' && bodyB.label === 'bird') || 
          (bodyB.label === 'block' && bodyA.label === 'bird')) {
        
        const blockBody = bodyA.label === 'block' ? bodyA : bodyB;
        const block = blocks.find(b => b.body === blockBody);
        
        if (block) {
          block.health -= 5;
          if (block.health <= 0) {
            World.remove(world, block.body);
            blocks = blocks.filter(b => b !== block);
            addScore(50);
          }
        }
      }
    }
  });
}

function autoAdvance() {
  if (gameState !== 'playing') return;

  // Check if all pigs are defeated
  if (pigs.length === 0) {
    console.log('All pigs defeated! Level complete.');
    setTimeout(() => {
      if (gameState === 'playing' && pigs.length === 0) {
        showLevelComplete();
      }
    }, 1000);
    return;
  }

  // Check if current bird is launched and get next bird
  const current = birds[currentBirdIndex];
  
  if (!current || current.launched) {
    const nextIndex = birds.findIndex(b => !b.launched);
    if (nextIndex >= 0) {
      currentBirdIndex = nextIndex;
      attachBirdToSling(currentBirdIndex);
      advanceTimer = 0;
    } else if (birds.every(b => b.launched)) {
      // All birds launched but pigs remain
      advanceTimer++;
      if (advanceTimer > 180) {
        console.log('All birds used but pigs remain. Game over.');
        showGameOver();
        advanceTimer = 0;
      }
    }
  }
}

function clientToWorld(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left);
  const y = (clientY - rect.top);
  return { x, y };
}

canvas.addEventListener('pointerdown', (ev) => {
  if (gameState !== 'playing') return;
  const p = clientToWorld(ev.clientX, ev.clientY);
  const current = birds[currentBirdIndex];
  if (!current || current.launched) return;
  
  const d = Math.hypot(p.x - 170, p.y - (WORLD_H - GROUND_HEIGHT - 110));
  if (d < BIRD_RADIUS * 3) {
    dragging = true;
    if (slingConstraint) {
      World.remove(world, slingConstraint);
      slingConstraint = null;
    }
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('pointermove', (ev) => {
  if (!dragging || gameState !== 'playing') return;
  const p = clientToWorld(ev.clientX, ev.clientY);
  const current = birds[currentBirdIndex];
  if (!current) return;

  let dx = p.x - 170;
  let dy = p.y - (WORLD_H - GROUND_HEIGHT - 110);
  const dist = Math.hypot(dx, dy);

  const maxPull = 150;
  if (dist > maxPull) {
    dx = (dx / dist) * maxPull;
    dy = (dy / dist) * maxPull;
  }

  const targetX = 170 + dx;
  const targetY = (WORLD_H - GROUND_HEIGHT - 110) + dy;

  Body.setPosition(current.body, { x: targetX, y: targetY });
  Body.setVelocity(current.body, { x: 0, y: 0 });
});

canvas.addEventListener('pointerup', () => {
  if (!dragging || gameState !== 'playing') return;
  
  dragging = false;
  canvas.style.cursor = 'default';
  releaseBirdFromSling();
});

function renderFrame() {
  if (gameState !== 'playing') return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw sky
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  gradient.addColorStop(0, '#88CCFF');
  gradient.addColorStop(0.6, '#CDEFFD');
  gradient.addColorStop(1, '#E8FBFF');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  updateBackground();
  for (const cloud of clouds) drawCloud(ctx, cloud.x, cloud.y, cloud.size);

  // Draw ground
  ctx.fillStyle = '#3ebd3e';
  ctx.fillRect(0, WORLD_H - GROUND_HEIGHT, WORLD_W, GROUND_HEIGHT);
  drawGrass(ctx);

  // Draw blocks
  for (const blk of blocks) {
    const b = blk.body;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);

    const w = b.bounds.max.x - b.bounds.min.x;
    const h = b.bounds.max.y - b.bounds.min.y;

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.restore();
  }

  // Draw pigs
  for (const pig of pigs) {
    const p = pig.body;
    ctx.save();
    ctx.translate(p.position.x, p.position.y);
    ctx.rotate(p.angle);
    const r = pig.isBoss ? 40 : 30;

    ctx.fillStyle = pig.isBoss ? '#FF6B6B' : '#81C784';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = pig.isBoss ? '#C62828' : '#4CAF50';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Health bar
    const healthColor = pig.health > pig.maxHealth * 0.5 ? '#4CAF50' : pig.health > 1 ? '#FF9800' : '#F44336';
    ctx.fillStyle = healthColor;
    ctx.fillRect(-r, -r - 10, (pig.health / pig.maxHealth) * (r * 2), 4);

    ctx.restore();
  }

  // Draw slingshot
  const sx = 170;
  const sy = WORLD_H - GROUND_HEIGHT - 110;
  const groundY = WORLD_H - GROUND_HEIGHT;

  ctx.fillStyle = '#5D4037';
  ctx.strokeStyle = '#3E2723';
  ctx.lineWidth = 2;

  const forkY = sy + 30;
  ctx.fillRect(sx - 8, forkY, 16, groundY - forkY);
  ctx.strokeRect(sx - 8, forkY, 16, groundY - forkY);

  ctx.save();
  ctx.translate(sx, forkY);
  ctx.rotate(-0.4);
  ctx.fillRect(-8, -80, 16, 80);
  ctx.strokeRect(-8, -80, 16, 80);
  ctx.restore();

  ctx.save();
  ctx.translate(sx, forkY);
  ctx.rotate(0.4);
  ctx.fillRect(-8, -80, 16, 80);
  ctx.strokeRect(-8, -80, 16, 80);
  ctx.restore();

  // Draw slingshot bands when dragging
  if (dragging) {
    const current = birds[currentBirdIndex];
    if (current) {
      const bp = current.body.position;
      const leftX = sx - 28;
      const rightX = sx + 28;
      const topY = sy - 10;

      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(93,64,55,0.9)';
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(leftX, topY);
      ctx.lineTo(bp.x, bp.y);
      ctx.lineTo(rightX, topY);
      ctx.stroke();
    }
  }

  // Draw birds
  for (let i = 0; i < birds.length; i++) {
    const br = birds[i];
    const b = br.body;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    const r = BIRD_RADIUS;

    const fill = br.type === 'red' ? '#DC143C' : (br.type === 'blue' ? '#1E90FF' : '#FFD700');
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    if (!br.launched) {
      ctx.strokeStyle = '#8B0000';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw trajectory line
  if (dragging) {
    const current = birds[currentBirdIndex];
    if (current) {
      const birdBody = current.body;
      const dx = 170 - birdBody.position.x;
      const dy = (WORLD_H - GROUND_HEIGHT - 110) - birdBody.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 15) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(birdBody.position.x, birdBody.position.y);

        const power = Math.min(dist / 60, 2.5);
        const velocityMag = power * 12;
        const vx = (dx / dist) * velocityMag;
        const vy = (dy / dist) * velocityMag;

        for (let t = 0; t < 100; t += 3) {
          const x = birdBody.position.x + vx * t;
          const y = birdBody.position.y + vy * t + 0.5 * world.gravity.y * t * t;
          ctx.lineTo(x, y);
          if (y > WORLD_H - GROUND_HEIGHT) break;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

(function loop() {
  autoAdvance();
  renderFrame();
  requestAnimationFrame(loop);
})();

function showMenu() {
  gameState = 'menu';
  if (menuScreen) menuScreen.style.display = 'flex';
  if (gameUI) gameUI.style.display = 'none';
  if (levelCompleteScreen) levelCompleteScreen.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  if (gameCompletionScreen) gameCompletionScreen.style.display = 'none';
  if (canvas) canvas.style.display = 'none';
  if (muteBtn) muteBtn.style.display = 'none';
}

function showGame() {
  gameState = 'playing';
  if (menuScreen) menuScreen.style.display = 'none';
  if (gameUI) gameUI.style.display = 'block';
  if (levelCompleteScreen) levelCompleteScreen.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  if (gameCompletionScreen) gameCompletionScreen.style.display = 'none';
  if (canvas) canvas.style.display = 'block';
  if (muteBtn) muteBtn.style.display = 'block';
  
  buildWorld();
}

function showLevelComplete() {
  if (gameState !== 'playing') return;
  gameState = 'levelComplete';
  console.log(`Showing level complete for level ${currentLevel}`);
  if (levelCompleteScreen) levelCompleteScreen.style.display = 'flex';
  if (completeLevelEl) completeLevelEl.textContent = `Level ${currentLevel} Complete!`;
  if (finalScoreEl) finalScoreEl.textContent = `Score: ${globalScore}`;
}

function showGameCompletion() {
  gameState = 'levelComplete';
  if (levelCompleteScreen) levelCompleteScreen.style.display = 'none';
  if (gameCompletionScreen) {
    gameCompletionScreen.style.display = 'flex';
    if (finalGameScoreEl) finalGameScoreEl.textContent = `Final Score: ${globalScore}`;
  }
}

function showGameOver() {
  if (gameState !== 'playing') return;
  gameState = 'gameOver';
  console.log('Showing game over');
  if (gameOverScreen) gameOverScreen.style.display = 'flex';
  if (gameOverScoreEl) gameOverScoreEl.textContent = `Score: ${globalScore} | Level: ${currentLevel}`;
}

function initializeEventListeners() {
  const playBtn = document.getElementById('playBtn');
  const nextLevelBtn = document.getElementById('nextLevelBtn');
  const menuFromCompleteBtn = document.getElementById('menuFromCompleteBtn');
  const retryBtn = document.getElementById('retryBtn');
  const menuFromGameOverBtn = document.getElementById('menuFromGameOverBtn');
  const menuFromCompletionBtn = document.getElementById('menuFromCompletionBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');

  if (playBtn) playBtn.addEventListener('click', () => {
    currentLevel = 1;
    globalScore = 0;
    showGame();
  });

  if (nextLevelBtn) nextLevelBtn.addEventListener('click', () => {
    console.log(`Next level clicked. Current: ${currentLevel}`);
    if (currentLevel < 4) {
      currentLevel++;
      showGame();
    } else {
      showGameCompletion();
    }
  });

  if (menuFromCompleteBtn) menuFromCompleteBtn.addEventListener('click', () => {
    currentLevel = 1;
    globalScore = 0;
    showMenu();
  });

  if (retryBtn) retryBtn.addEventListener('click', showGame);
  if (menuFromGameOverBtn) menuFromGameOverBtn.addEventListener('click', () => {
    currentLevel = 1;
    globalScore = 0;
    showMenu();
  });
  if (menuFromCompletionBtn) menuFromCompletionBtn.addEventListener('click', () => {
    currentLevel = 1;
    globalScore = 0;
    showMenu();
  });
  if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
    currentLevel = 1;
    globalScore = 0;
    showGame();
  });

  if (muteBtn) muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
  });
}

window.addEventListener('resize', () => {
  resizeCanvas();
  checkOrientation();
  if (gameState === 'playing') buildWorld();
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    checkOrientation();
    if (gameState === 'playing') {
      setTimeout(() => {
        resizeCanvas();
        buildWorld();
      }, 100);
    }
  }, 100);
});

// Initial setup
loadImages();
checkOrientation();
resizeCanvas();
initializeEventListeners();
showMenu();