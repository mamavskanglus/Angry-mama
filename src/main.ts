// src/main.ts
import * as Matter from 'matter-js';
// Import images as modules
const { Engine, World, Bodies, Body, Runner, Events, Constraint, Composite } = Matter;

let gameState: 'menu' | 'playing' | 'levelComplete' | 'gameOver' = 'menu';
let currentLevel = 1;
let globalScore = 0;
let isMuted = false;
let isLandscapeMode = false;
let landscapeCheckTimer: number | null = null;

// Audio elements
let bgMusic: HTMLAudioElement | null = null;
let currentBgMusic: string | null = null;
let victorySound: HTMLAudioElement | null = null;
let defeatSound: HTMLAudioElement | null = null;
let isPlayingVictoryOrDefeat = false;

// Audio file paths
const AUDIO_PATHS = {
  level1: new URL('./assets/audio/level1-bg.mp3', import.meta.url).href,
  level2: new URL('./assets/audio/level2-bg.mp3', import.meta.url).href,
  level3: new URL('./assets/audio/level3-bg.mp3', import.meta.url).href,
  level4: new URL('./assets/audio/level4-bg.mp3', import.meta.url).href,
  victory: new URL('./assets/audio/victory.mp3', import.meta.url).href,
  defeat: new URL('./assets/audio/defeat.mp3', import.meta.url).href
};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const menuScreen = document.getElementById('menuScreen') as HTMLDivElement;
const gameUI = document.getElementById('gameUI') as HTMLDivElement;
const levelCompleteScreen = document.getElementById('levelCompleteScreen') as HTMLDivElement;
const gameOverScreen = document.getElementById('gameOverScreen') as HTMLDivElement;
const gameCompletionScreen = document.getElementById('gameCompletionScreen') as HTMLDivElement;
const muteBtn = document.getElementById('muteBtn') as HTMLButtonElement;
const rotateMessage = document.getElementById('rotateMessage') as HTMLDivElement;

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

// Improved physics for mobile
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

// Enhanced orientation handling with 5-second delay
function checkOrientation() {
  const isMobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  
  if (isMobile) {
    if (isLandscape) {
      // Clear any existing timer
      if (landscapeCheckTimer) {
        clearTimeout(landscapeCheckTimer);
        landscapeCheckTimer = null;
      }
      
      // Wait 5 seconds before enabling landscape mode
      landscapeCheckTimer = setTimeout(() => {
        document.body.classList.add('landscape-mode');
        isLandscapeMode = true;
        
        // If we were in the menu and just rotated to landscape, show the menu
        if (gameState === 'menu') {
          showMenu();
        }
        
        // Resize and rebuild if playing
        if (gameState === 'playing') {
          setTimeout(() => {
            resizeCanvas();
            buildWorld();
          }, 100);
        }
      }, 5000); // 5 second delay
      
    } else {
      // We're on mobile and in portrait - show rotate message
      document.body.classList.remove('landscape-mode');
      isLandscapeMode = false;
      
      // Clear timer if switching back to portrait
      if (landscapeCheckTimer) {
        clearTimeout(landscapeCheckTimer);
        landscapeCheckTimer = null;
      }
    }
  } else {
    // We're on desktop - always enable game immediately
    document.body.classList.add('landscape-mode');
    isLandscapeMode = true;
  }
}

// Initialize all audio elements
function initializeAudio() {
  victorySound = null;
  defeatSound = null;
}

// Create and play audio with better error handling
function createAndPlayAudio(src: string, volume: number = 0.7, loop: boolean = false): HTMLAudioElement | null {
  if (isMuted) return null;
  
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.loop = loop;
    
    audio.addEventListener('error', (e) => {
      console.log('Audio element error:', e, 'Src:', src);
    });
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Audio play failed:', error, 'Src:', src);
      });
    }
    
    return audio;
  } catch (error) {
    console.log('Audio creation failed:', error, 'Src:', src);
    return null;
  }
}

// Stop background music
function stopBackgroundMusic() {
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
    bgMusic = null;
    currentBgMusic = null;
  }
}

// Play background music for current level
function playLevelMusic() {
  if (isPlayingVictoryOrDefeat) return;
  
  stopBackgroundMusic();
  
  let musicPath = '';
  switch(currentLevel) {
    case 1: musicPath = AUDIO_PATHS.level1; break;
    case 2: musicPath = AUDIO_PATHS.level2; break;
    case 3: musicPath = AUDIO_PATHS.level3; break;
    case 4: musicPath = AUDIO_PATHS.level4; break;
    default: musicPath = AUDIO_PATHS.level1;
  }
  
  if (musicPath && !isMuted) {
    bgMusic = createAndPlayAudio(musicPath, 0.5, true);
    currentBgMusic = musicPath;
  }
}

// Play victory sound
function playVictorySound() {
  if (isMuted) return;
  
  stopBackgroundMusic();
  isPlayingVictoryOrDefeat = true;
  
  if (victorySound) {
    victorySound.pause();
    victorySound = null;
  }
  
  victorySound = createAndPlayAudio(AUDIO_PATHS.victory, 0.7, false);
  
  if (victorySound) {
    victorySound.addEventListener('ended', () => {
      isPlayingVictoryOrDefeat = false;
      victorySound = null;
    });
    
    victorySound.addEventListener('error', () => {
      isPlayingVictoryOrDefeat = false;
      victorySound = null;
    });
  } else {
    isPlayingVictoryOrDefeat = false;
  }
}

// Play defeat sound  
function playDefeatSound() {
  if (isMuted) return;
  
  stopBackgroundMusic();
  isPlayingVictoryOrDefeat = true;
  
  if (defeatSound) {
    defeatSound.pause();
    defeatSound = null;
  }
  
  defeatSound = createAndPlayAudio(AUDIO_PATHS.defeat, 0.7, false);
  
  if (defeatSound) {
    defeatSound.addEventListener('ended', () => {
      isPlayingVictoryOrDefeat = false;
      defeatSound = null;
    });
    
    defeatSound.addEventListener('error', () => {
      isPlayingVictoryOrDefeat = false;
      defeatSound = null;
    });
  } else {
    isPlayingVictoryOrDefeat = false;
  }
}

// Update mute functionality
function updateMuteState() {
  isMuted = !isMuted;
  muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
  
  if (isMuted) {
    stopBackgroundMusic();
    if (victorySound) {
      victorySound.pause();
      victorySound.volume = 0;
    }
    if (defeatSound) {
      defeatSound.pause();
      defeatSound.volume = 0;
    }
  } else {
    if (gameState === 'playing' && !isPlayingVictoryOrDefeat) {
      playLevelMusic();
    }
    if (victorySound) victorySound.volume = 0.7;
    if (defeatSound) defeatSound.volume = 0.7;
  }
}

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  
  if (isLandscapeMode && (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))) {
    // Mobile landscape - use full viewport with better scaling
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Adjust for iPhone notch/safe areas
    const safeWidth = w;
    const safeHeight = h;
    
    canvas.style.width = `${safeWidth}px`;
    canvas.style.height = `${safeHeight}px`;
    canvas.width = Math.floor(safeWidth * dpr);
    canvas.height = Math.floor(safeHeight * dpr);
  } else {
    // Desktop or tablet
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(480, window.innerHeight);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  
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
  damageState: 'intact' | 'cracked' | 'broken' | 'destroyed';
  cracks: {x: number, y: number, angle: number, size: number}[];
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

// LAG FIX: Reduced particle count
const MAX_PARTICLES = 20;
let activeParticles: Matter.Body[] = [];

let clouds: { x: number; y: number; size: number; speed: number }[] = [];

// FIXED IMAGE LOADING - Using imported paths
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

    const onImageError = (err: string) => {
      console.error('Failed to load image:', err);
      imagesLoadedCount++;
      if (imagesLoadedCount === imagesToLoad) {
        imagesLoaded = false;
        resolve(false);
      }
    };

    friend1Image.onload = onImageLoad;
    friend2Image.onload = onImageLoad;
    friend3Image.onload = onImageLoad;
    friend4Image.onload = onImageLoad;

    friend1Image.onerror = () => onImageError('friend1-face.png');
    friend2Image.onerror = () => onImageError('friend2-face.png');
    friend3Image.onerror = () => onImageError('friend3-face.png');
    friend4Image.onerror = () => onImageError('friend4-face.png');

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

  const startX = slingAnchor.x - 100;
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
  Body.setPosition(birdObj.body, { x: slingAnchor.x, y: slingAnchor.y });
  Body.setAngle(birdObj.body, 0);

  if (slingConstraint) {
    try { World.remove(world, slingConstraint); } catch (e) {}
  }

  slingConstraint = Constraint.create({
    pointA: { x: slingAnchor.x, y: slingAnchor.y },
    bodyB: birdObj.body,
    stiffness: 0.05,
    damping: 0.08,
    length: 0,
    render: { visible: false }
  } as any);
  
  Composite.add(world, slingConstraint);
  birdObj.launched = false;
}

function releaseBirdFromSling() {
  if (!slingConstraint) return;
  const birdBody = slingConstraint.bodyB as Matter.Body;
  const dx = slingAnchor.x - birdBody.position.x;
  const dy = slingAnchor.y - birdBody.position.y;
  const dist = Math.hypot(dx, dy);

  try { World.remove(world, slingConstraint); } catch (e) {}
  slingConstraint = null;

  // FIXED: Better launch detection to prevent backwards launches
  if (dist < 15) {
    // Too small pull - reset bird
    Body.setPosition(birdBody, { x: slingAnchor.x, y: slingAnchor.y });
    Body.setVelocity(birdBody, { x: 0, y: 0 });
    Body.setAngularVelocity(birdBody, 0);
    attachBirdToSling(currentBirdIndex);
    return;
  }

  const power = Math.min(dist / 60, 2.5);
  const velocityMag = power * 12;

  // FIXED: Ensure proper launch direction (always away from slingshot)
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
  const densities: Record<Block['type'], number> = {
    glass: 0.0008,
    cardboard: 0.0006,
    wood: 0.0015,
    stone: 0.003,
    bamboo: 0.0012,
    thatch: 0.0007,
    clay: 0.0025
  };

  const body = Bodies.rectangle(x, y, w, h, {
    label: 'block',
    isStatic: true,
    friction: 0.8,
    restitution: 0.2,
    density: densities[type],
    collisionFilter: { group: 0 }
  });

  World.add(world, body);
  
  blocks.push({ 
    body, 
    health, 
    maxHealth: health, 
    type, 
    isStatic: true,
    damageState: 'intact',
    cracks: []
  });
  return body;
}

function makeBlockDynamic(block: Block) {
  if (!block.isStatic) return;
  Body.setStatic(block.body, false);
  block.isStatic = false;
  
  Body.set(block.body, {
    restitution: 0.2,
    friction: 0.8
  });
  
  Body.setVelocity(block.body, {
    x: block.body.velocity.x + (Math.random() - 0.5) * 2,
    y: block.body.velocity.y + (Math.random() - 0.5) * 2
  });
}

// Adjusted pig sizes for better mobile spacing
function addPig(x: number, y: number, health: number, isBoss: boolean): Matter.Body {
  const radius = isBoss ? 40 : 30; // Reduced sizes for better spacing
  
  const body = Bodies.circle(x, y, radius, {
    label: 'pig',
    restitution: 0.2,
    friction: 0.8,
    density: 0.0025,
    collisionFilter: { group: 0 },
    isStatic: false
  });

  World.add(world, body);
  pigs.push({ body, health, maxHealth: health, isBoss, lastY: y });
  return body;
}

// REAL ANGRY BIRDS DAMAGE: Much more sensitive
function calculateDamage(impactSpeed: number, birdType: string, blockType: string): number {
  let damage = impactSpeed * 1.2;
  
  const birdModifiers = {
    'red': 3.0,
    'blue': 1.5,
    'yellow': 0.8
  };
  
  damage *= birdModifiers[birdType as keyof typeof birdModifiers] || 1;
  
  const blockResistance = {
    'glass': 0.1,
    'cardboard': 0.2,
    'thatch': 0.4,
    'bamboo': 0.7,
    'wood': 1.0,
    'clay': 1.5,
    'stone': 2.0
  };
  
  damage /= blockResistance[blockType as keyof typeof blockResistance] || 1;
  
  return Math.max(1.0, damage);
}

function addCrackToBlock(block: Block, impactPoint: Matter.Vector) {
  if (block.cracks.length < 6) {
    const relativeX = (impactPoint.x - block.body.position.x) / ((block.body.bounds.max.x - block.body.bounds.min.x) / 2);
    const relativeY = (impactPoint.y - block.body.position.y) / ((block.body.bounds.max.y - block.body.bounds.min.y) / 2);
    
    block.cracks.push({
      x: relativeX * 0.8,
      y: relativeY * 0.8,
      angle: Math.random() * Math.PI * 2,
      size: 8 + Math.random() * 12
    });
  }
}

function updateBlockDamageState(block: Block) {
  const healthRatio = block.health / block.maxHealth;
  
  if (healthRatio > 0.7) {
    block.damageState = 'intact';
  } else if (healthRatio > 0.4) {
    block.damageState = 'cracked';
  } else if (healthRatio > 0.1) {
    block.damageState = 'broken';
  } else {
    block.damageState = 'destroyed';
  }
}

// LAG FIX: Optimized collision handling
function handleCollision(event: Matter.IEventCollision<Matter.Engine>) {
  const pairs = event.pairs;
  
  for (const pair of pairs) {
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;

    if (
      bodyA.label === 'ground' || bodyB.label === 'ground' ||
      bodyA.label === 'wall' || bodyB.label === 'wall' ||
      bodyA.label === 'platform' || bodyB.label === 'platform' ||
      bodyA.label === 'slingBase' || bodyB.label === 'slingBase'
    ) {
      continue;
    }

    const relV = { x: bodyA.velocity.x - bodyB.velocity.x, y: bodyA.velocity.y - bodyB.velocity.y };
    const impactSpeed = Math.hypot(relV.x, relV.y);

    // REAL ANGRY BIRDS: Blocks take damage from any impact
    if ((bodyA.label === 'block' && bodyB.label === 'bird') || 
        (bodyB.label === 'block' && bodyA.label === 'bird')) {
      
      const blockBody = bodyA.label === 'block' ? bodyA : bodyB;
      const birdBody = bodyA.label === 'bird' ? bodyA : bodyB;
      const block = blocks.find(b => b.body === blockBody);
      const bird = birds.find(b => b.body === birdBody);
      
      if (block && bird) {
        if (block.isStatic) {
          makeBlockDynamic(block);
        }
        
        const damage = calculateDamage(Math.max(impactSpeed, 2), bird.type, block.type);
        block.health -= damage;
        updateBlockDamageState(block);
        
        const collisionPoint = (pair as any).collision?.supports?.[0] || blockBody.position;
        if (damage > 0.5) {
          addCrackToBlock(block, collisionPoint);
          createDamageEffect(collisionPoint.x, collisionPoint.y, damage, block.type);
        }
        
        if (block.health <= 0) {
          try {
            World.remove(world, block.body);
            blocks = blocks.filter(b => b !== block);
            addScore(50);
            createDestructionEffect(blockBody.position.x, blockBody.position.y, block.type);
          } catch (e) {}
        }
      }
    }

    // Pig collisions
    if ((bodyA.label === 'pig' && bodyB.label === 'block') || 
        (bodyB.label === 'pig' && bodyA.label === 'block')) {
      
      const pigBody = bodyA.label === 'pig' ? bodyA : bodyB;
      const blockBody = bodyA.label === 'pig' ? bodyB : bodyA;
      
      const pig = pigs.find(p => p.body === pigBody);
      const block = blocks.find(b => b.body === blockBody);
      
      if (pig && block && !block.isStatic && impactSpeed > 2) {
        const blockMass = blockBody.mass || 1;
        const damage = (impactSpeed * blockMass) / 8;
        
        pig.health -= damage;
        createDamageEffect(pigBody.position.x, pigBody.position.y, damage, 'flesh');
        
        if (pig.health <= 0) {
          try {
            World.remove(world, pig.body);
            pigs = pigs.filter(p => p !== pig);
            addScore(pig.isBoss ? 300 : 150);
            createPigDeathEffect(pig.body.position.x, pig.body.position.y, pig.isBoss);
          } catch (e) {}
        }
      }
    }

    // Bird vs Pig collisions
    if ((bodyA.label === 'pig' && bodyB.label === 'bird') || 
        (bodyB.label === 'pig' && bodyA.label === 'bird')) {
      
      const pigBody = bodyA.label === 'pig' ? bodyA : bodyB;
      const birdBody = bodyA.label === 'pig' ? bodyB : bodyA;
      
      const pig = pigs.find(p => p.body === pigBody);
      const bird = birds.find(b => b.body === birdBody);
      
      if (pig && bird && impactSpeed > 2) {
        let damage = impactSpeed / 2;
        
        if (bird) {
          switch (bird.type) {
            case 'red': damage *= 2.0; break;
            case 'blue': damage *= 1.5; break;
            case 'yellow': damage *= 1.0; break;
          }
        }
        
        pig.health -= damage;
        createDamageEffect(pigBody.position.x, pigBody.position.y, damage, 'flesh');
        
        if (pig.health <= 0) {
          try {
            World.remove(world, pig.body);
            pigs = pigs.filter(p => p !== pig);
            addScore(pig.isBoss ? 300 : 150);
            createPigDeathEffect(pig.body.position.x, pig.body.position.y, pig.isBoss);
          } catch (e) {}
        }
      }
    }

    // Block vs Block collisions
    if (bodyA.label === 'block' && bodyB.label === 'block') {
      const blockA = blocks.find(b => b.body === bodyA);
      const blockB = blocks.find(b => b.body === bodyB);
      
      if (impactSpeed > 1) {
        if (blockA && blockB) {
          const transferredDamage = impactSpeed * 0.4;
          
          if (!blockA.isStatic) blockA.health -= transferredDamage;
          if (!blockB.isStatic) blockB.health -= transferredDamage;
          
          if (blockA.isStatic && impactSpeed > 1.5) makeBlockDynamic(blockA);
          if (blockB.isStatic && impactSpeed > 1.5) makeBlockDynamic(blockB);
          
          if (blockA) updateBlockDamageState(blockA);
          if (blockB) updateBlockDamageState(blockB);
        }
      }
    }
  }
}

// LAG FIX: Reduced particle effects
function createDamageEffect(x: number, y: number, intensity: number, material: string) {
  const particleCount = Math.min(Math.floor(intensity * 2), 6);
  
  for (let i = 0; i < particleCount; i++) {
    if (activeParticles.length >= MAX_PARTICLES) break;
    
    setTimeout(() => {
      const particle = Bodies.circle(x, y, 1.5 + Math.random() * 1.5, {
        restitution: 0.7,
        friction: 0.02,
        density: 0.001,
        frictionAir: 0.03,
        collisionFilter: { mask: 0 },
        render: { 
          fillStyle: material === 'flesh' ? '#FF6B6B' : 
                   material === 'glass' ? '#87CEEB' : 
                   material === 'stone' ? '#888888' : '#8B4513'
        },
        label: 'particle'
      });
      
      World.add(world, particle);
      activeParticles.push(particle);
      
      Body.setVelocity(particle, {
        x: (Math.random() - 0.5) * 8 * intensity,
        y: (Math.random() - 0.5) * 8 * intensity
      });
      
      setTimeout(() => {
        try { 
          World.remove(world, particle);
          activeParticles = activeParticles.filter(p => p !== particle);
        } catch (e) {}
      }, 600 + Math.random() * 300);
    }, i * 25);
  }
}

function createDestructionEffect(x: number, y: number, blockType: Block['type']) {
  const particleCount = 8;
  
  for (let i = 0; i < particleCount; i++) {
    if (activeParticles.length >= MAX_PARTICLES) break;
    
    setTimeout(() => {
      const particle = Bodies.circle(x, y, 2 + Math.random() * 2, {
        restitution: 0.6,
        friction: 0.03,
        density: 0.002,
        frictionAir: 0.02,
        collisionFilter: { mask: 0 },
        render: { fillStyle: getBlockColor(blockType) },
        label: 'particle'
      });
      
      World.add(world, particle);
      activeParticles.push(particle);
      
      Body.setVelocity(particle, {
        x: (Math.random() - 0.5) * 12,
        y: (Math.random() - 0.5) * 12
      });
      
      setTimeout(() => {
        try { 
          World.remove(world, particle);
          activeParticles = activeParticles.filter(p => p !== particle);
        } catch (e) {}
      }, 800);
    }, i * 35);
  }
}

function createPigDeathEffect(x: number, y: number, isBoss: boolean) {
  const particleCount = isBoss ? 10 : 6;
  
  for (let i = 0; i < particleCount; i++) {
    if (activeParticles.length >= MAX_PARTICLES) break;
    
    setTimeout(() => {
      const particle = Bodies.circle(x, y, isBoss ? 3 : 2, {
        restitution: 0.5,
        friction: 0.02,
        density: 0.001,
        frictionAir: 0.03,
        collisionFilter: { mask: 0 },
        render: { fillStyle: isBoss ? '#FF6B6B' : '#81C784' },
        label: 'particle'
      });
      
      World.add(world, particle);
      activeParticles.push(particle);
      
      Body.setVelocity(particle, {
        x: (Math.random() - 0.5) * 15,
        y: (Math.random() - 0.5) * 15
      });
      
      setTimeout(() => {
        try { 
          World.remove(world, particle);
          activeParticles = activeParticles.filter(p => p !== particle);
        } catch (e) {}
      }, 600);
    }, i * 45);
  }
}

function getBlockColor(type: Block['type']): string {
  switch (type) {
    case 'wood': return '#8B4513';
    case 'stone': return '#6f6f6f';
    case 'glass': return '#87CEEB';
    case 'cardboard': return '#DEB887';
    case 'bamboo': return '#9ACD32';
    case 'thatch': return '#DAA520';
    case 'clay': return '#CD5C5C';
    default: return '#999';
  }
}

// Helper function for original pig rendering (fallback)
function drawOriginalPig(pig: Pig, r: number) {
  ctx.fillStyle = pig.isBoss ? '#FF6B6B' : '#81C784';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = pig.isBoss ? '#C62828' : '#4CAF50';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(-7, -5, 6, 0, Math.PI * 2);
  ctx.arc(7, -5, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-6, -4, 3, 0, Math.PI * 2);
  ctx.arc(8, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pig.isBoss ? '#FF8A65' : '#FFB74D';
  ctx.beginPath();
  ctx.ellipse(0, 5, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pig.isBoss ? '#D84315' : '#E65100';
  ctx.beginPath();
  ctx.arc(-3, 5, 2, 0, Math.PI * 2);
  ctx.arc(3, 5, 2, 0, Math.PI * 2);
  ctx.fill();

  if (pig.isBoss) {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(-12, -r - 5);
    ctx.lineTo(-8, -r - 12);
    ctx.lineTo(-4, -r - 5);
    ctx.lineTo(0, -r - 12);
    ctx.lineTo(4, -r - 5);
    ctx.lineTo(8, -r - 12);
    ctx.lineTo(12, -r - 5);
    ctx.lineTo(12, -r + 2);
    ctx.lineTo(-12, -r + 2);
    ctx.closePath();
    ctx.fill();
  }
}

// UPDATED: More birds per level (5,6,7,8)
// REAL ANGRY BIRDS: Low health values for easy destruction
function buildAssamHouse(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  // Adjusted platform width for better mobile spacing
  const platform = Bodies.rectangle(x, baseY, 400, 30, {
    isStatic: true, 
    label: 'platform', 
    friction: 0.9, 
    restitution: 0.1
  });
  World.add(world, platform);

  // Adjusted spacing for better mobile layout
  addStableBlock(x - 80, baseY - 20, 35, 25, 'clay', 3);
  addStableBlock(x - 40, baseY - 20, 35, 25, 'clay', 3);
  addStableBlock(x, baseY - 20, 35, 25, 'clay', 3);
  addStableBlock(x + 40, baseY - 20, 35, 25, 'clay', 3);
  addStableBlock(x + 80, baseY - 20, 35, 25, 'clay', 3);

  addStableBlock(x, baseY - 50, 220, 20, 'wood', 2);

  addStableBlock(x - 70, baseY - 85, 18, 60, 'wood', 4);
  addStableBlock(x + 70, baseY - 85, 18, 60, 'wood', 4);
  addStableBlock(x - 30, baseY - 85, 18, 60, 'wood', 4);
  addStableBlock(x + 30, baseY - 85, 18, 60, 'wood', 4);

  addStableBlock(x - 45, baseY - 120, 90, 20, 'thatch', 1);
  addStableBlock(x + 45, baseY - 120, 90, 20, 'thatch', 1);

  addStableBlock(x - 50, baseY - 70, 30, 20, 'glass', 1);
  addStableBlock(x + 50, baseY - 70, 30, 20, 'glass', 1);

  addStableBlock(x, baseY - 145, 200, 20, 'thatch', 1);
  
  addStableBlock(x, baseY - 155, 50, 12, 'wood', 2);
  addStableBlock(x, baseY - 30, 70, 25, 'wood', 3);

  // Adjusted pig positions for better spacing
  addPig(x - 30, baseY - 60, 5, false);
  addPig(x + 30, baseY - 60, 5, false);
  addPig(x, baseY - 100, 5, false);
  addPig(x - 70, baseY - 40, 5, false);
}

function buildTwoStory(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  // Adjusted platform width
  const platform = Bodies.rectangle(x, baseY, 450, 30, {
    isStatic: true, label: 'platform', friction: 0.9, restitution: 0.1
  });
  World.add(world, platform);

  addStableBlock(x - 120, baseY - 35, 30, 60, 'stone', 5);
  addStableBlock(x + 120, baseY - 35, 30, 60, 'stone', 5);
  addStableBlock(x, baseY - 70, 270, 25, 'stone', 4);

  addStableBlock(x - 100, baseY - 105, 28, 60, 'stone', 5);
  addStableBlock(x + 100, baseY - 105, 28, 60, 'stone', 5);
  addStableBlock(x, baseY - 140, 230, 25, 'stone', 4);

  addStableBlock(x - 80, baseY - 175, 25, 60, 'wood', 4);
  addStableBlock(x + 80, baseY - 175, 25, 60, 'wood', 4);
  addStableBlock(x, baseY - 210, 190, 25, 'wood', 3);

  addStableBlock(x - 90, baseY - 50, 30, 35, 'glass', 1);
  addStableBlock(x + 90, baseY - 50, 30, 35, 'glass', 1);
  addStableBlock(x - 80, baseY - 120, 25, 30, 'glass', 1);
  addStableBlock(x + 80, baseY - 120, 25, 30, 'glass', 1);

  addStableBlock(x, baseY - 85, 150, 15, 'wood', 2);
  addStableBlock(x, baseY - 225, 220, 20, 'wood', 2);

  // Adjusted pig positions for better spacing
  addPig(x - 80, baseY - 45, 6, false);
  addPig(x + 80, baseY - 45, 6, false);
  addPig(x - 60, baseY - 115, 6, false);
  addPig(x + 60, baseY - 115, 6, false);
  addPig(x, baseY - 185, 6, false);
}

function buildThreeStory(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  // Adjusted platform width
  const platform = Bodies.rectangle(x, baseY, 500, 30, {
    isStatic: true, label: 'platform', friction: 0.9, restitution: 0.1
  });
  World.add(world, platform);

  addStableBlock(x - 140, baseY - 40, 30, 70, 'stone', 6);
  addStableBlock(x + 140, baseY - 40, 30, 70, 'stone', 6);
  addStableBlock(x, baseY - 80, 290, 25, 'stone', 5);

  addStableBlock(x - 120, baseY - 120, 28, 70, 'stone', 5);
  addStableBlock(x + 120, baseY - 120, 28, 70, 'stone', 5);
  addStableBlock(x, baseY - 160, 250, 25, 'stone', 4);

  addStableBlock(x - 100, baseY - 200, 25, 70, 'stone', 4);
  addStableBlock(x + 100, baseY - 200, 25, 70, 'stone', 4);
  addStableBlock(x, baseY - 240, 210, 25, 'stone', 3);

  addStableBlock(x - 80, baseY - 280, 25, 70, 'wood', 3);
  addStableBlock(x + 80, baseY - 280, 25, 70, 'wood', 3);
  addStableBlock(x, baseY - 320, 170, 25, 'wood', 2);

  addStableBlock(x - 90, baseY - 55, 28, 40, 'glass', 1);
  addStableBlock(x + 90, baseY - 55, 28, 40, 'glass', 1);
  addStableBlock(x - 80, baseY - 135, 25, 35, 'glass', 1);
  addStableBlock(x + 80, baseY - 135, 25, 35, 'glass', 1);
  addStableBlock(x - 60, baseY - 215, 25, 30, 'glass', 1);
  addStableBlock(x + 60, baseY - 215, 25, 30, 'glass', 1);

  addStableBlock(x, baseY - 350, 190, 20, 'wood', 2);

  // Adjusted pig positions for better spacing
  addPig(x - 90, baseY - 50, 8, false);
  addPig(x + 90, baseY - 50, 8, false);
  addPig(x - 70, baseY - 130, 8, false);
  addPig(x + 70, baseY - 130, 8, false);
  addPig(x, baseY - 270, 12, true);
}

function buildFinalLevel(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  // Adjusted platform width
  const platform = Bodies.rectangle(x, baseY, 550, 30, {
    isStatic: true, label: 'platform', friction: 0.9, restitution: 0.1
  });
  World.add(world, platform);

  addStableBlock(x - 160, baseY - 60, 35, 100, 'stone', 8);
  addStableBlock(x + 160, baseY - 60, 35, 100, 'stone', 8);

  addStableBlock(x - 100, baseY - 40, 30, 70, 'stone', 6);
  addStableBlock(x + 100, baseY - 40, 30, 70, 'stone', 6);
  addStableBlock(x, baseY - 80, 230, 25, 'stone', 5);

  addStableBlock(x - 80, baseY - 120, 28, 70, 'stone', 4);
  addStableBlock(x + 80, baseY - 120, 28, 70, 'stone', 4);
  addStableBlock(x, baseY - 160, 190, 25, 'stone', 3);

  addStableBlock(x - 60, baseY - 200, 25, 70, 'stone', 3);
  addStableBlock(x + 60, baseY - 200, 25, 70, 'stone', 3);
  addStableBlock(x, baseY - 240, 150, 25, 'stone', 2);

  // Adjusted pig positions for better spacing
  addPig(x - 160, baseY - 120, 8, false);
  addPig(x + 160, baseY - 120, 8, false);
  addPig(x - 80, baseY - 50, 8, false);
  addPig(x + 80, baseY - 50, 8, false);
  addPig(x, baseY - 120, 8, false);
  addPig(x, baseY - 200, 8, false);
  addPig(x, baseY - 240, 15, true);
}

let ground: Matter.Body;
let leftWall: Matter.Body;
let rightWall: Matter.Body;
let slingAnchor = { x: 170, y: 0 };

function buildWorld() {
  // Update world dimensions based on orientation with better mobile scaling
  if (isLandscapeMode && (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))) {
    WORLD_W = window.innerWidth;
    WORLD_H = window.innerHeight;
    
    // Adjust sizes for better mobile experience
    BIRD_RADIUS = Math.max(18, Math.min(22, Math.floor(Math.min(WORLD_W, WORLD_H) * 0.025)));
  } else {
    WORLD_W = Math.max(320, window.innerWidth);
    WORLD_H = Math.max(480, window.innerHeight);
    BIRD_RADIUS = 25;
  }
  
  STRUCTURE_BASE_Y = WORLD_H - GROUND_HEIGHT - 10;
  slingAnchor.x = Math.max(120, Math.floor(WORLD_W * 0.12));
  slingAnchor.y = WORLD_H - GROUND_HEIGHT - 90;

  activeParticles.forEach(particle => {
    try { World.remove(world, particle); } catch (e) {}
  });
  activeParticles = [];

  Composite.clear(world, false);
  birds = [];
  blocks = [];
  pigs = [];
  currentBirdIndex = 0;
  slingConstraint = null;
  score = 0;
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  if (levelEl) levelEl.textContent = `Level: ${currentLevel}`;
  advanceTimer = 0;
  dragging = false;

  createBackground();

  // Load images if not already loaded
  if (!imagesLoaded) {
    loadImages().then((success) => {
      console.log('Image loading completed:', success ? 'Success' : 'Failed');
    }).catch((error) => {
      console.error('Image loading error:', error);
    });
  }

  // FIXED: Ground with less bounciness
  ground = Bodies.rectangle(
    WORLD_W / 2,
    WORLD_H - GROUND_HEIGHT / 2,
    WORLD_W * 3,
    GROUND_HEIGHT,
    {
      isStatic: true,
      label: 'ground',
      friction: 0.9,
      restitution: 0.1
    }
  );

  leftWall = Bodies.rectangle(-50, WORLD_H / 2, 100, WORLD_H * 3, { 
    isStatic: true, 
    label: 'wall',
    friction: 0.8,
    restitution: 0.1
  });
  rightWall = Bodies.rectangle(WORLD_W + 50, WORLD_H / 2, 100, WORLD_H * 3, { 
    isStatic: true, 
    label: 'wall',
    friction: 0.8,
    restitution: 0.1
  });
  World.add(world, [ground, leftWall, rightWall]);

  const structureX = WORLD_W - Math.floor(WORLD_W * 0.25); // Moved closer for better mobile gameplay
  
  console.log(`Building level ${currentLevel}`);
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

  // UPDATED: More birds per level (5,6,7,8)
  const birdTypesList: ('red' | 'blue' | 'yellow')[][] = [
    ['red', 'red', 'red', 'blue', 'yellow'], // Level 1: 5 birds
    ['red', 'blue', 'red', 'blue', 'yellow', 'red'], // Level 2: 6 birds
    ['red', 'blue', 'yellow', 'red', 'blue', 'yellow', 'red'], // Level 3: 7 birds
    ['red', 'blue', 'yellow', 'blue', 'yellow', 'red', 'blue', 'yellow'] // Level 4: 8 birds
  ];
  
  const birdTypes = birdTypesList[currentLevel - 1] || ['red', 'red', 'red', 'blue', 'yellow'];
  spawnBirds(birdTypes);
  
  if (birds.length > 0) {
    attachBirdToSling(0);
  }

  Events.off(engine, 'collisionStart');
  Events.on(engine, 'collisionStart', handleCollision);
}

function autoAdvance() {
  if (gameState !== 'playing') return;

  for (let i = pigs.length - 1; i >= 0; i--) {
    const pig = pigs[i];
    const fallDistance = pig.body.position.y - pig.lastY;
    if (fallDistance > 40 && Math.abs(pig.body.velocity.y) > 10) {
      const damage = (fallDistance * Math.abs(pig.body.velocity.y)) / 150;
      pig.health -= damage;
      
      if (pig.health <= 0) {
        try {
          World.remove(world, pig.body);
          pigs.splice(i, 1);
          addScore(pig.isBoss ? 300 : 150);
          createPigDeathEffect(pig.body.position.x, pig.body.position.y, pig.isBoss);
        } catch (e) {}
      }
    }
    if (pig.body) pig.lastY = pig.body.position.y;
  }

  if (pigs.length === 0) {
    console.log(`Level ${currentLevel} completed! No pigs left.`);
    setTimeout(() => {
      if (gameState === 'playing' && pigs.length === 0) {
        showLevelComplete();
      }
    }, 1000);
    return;
  }

  const now = Date.now();
  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    if (b.launched && b.launchTime > 0 && (now - b.launchTime) > 12000) {
      try {
        World.remove(world, b.body);
        birds.splice(i, 1);
        if (i === currentBirdIndex) {
          currentBirdIndex = Math.min(currentBirdIndex, birds.length - 1);
        } else if (i < currentBirdIndex) {
          currentBirdIndex--;
        }
      } catch (e) {}
    }
  }

  const current = birds[currentBirdIndex];
  
  if (!current || current.launched) {
    const nextIndex = birds.findIndex(b => !b.launched);
    if (nextIndex >= 0) {
      currentBirdIndex = nextIndex;
      attachBirdToSling(currentBirdIndex);
      advanceTimer = 0;
    } else if (birds.every(b => b.launched)) {
      advanceTimer++;
      if (advanceTimer > 180) {
        if (pigs.length > 0) {
          showGameOver();
        }
        advanceTimer = 0;
      }
    }
    return;
  }

  advanceTimer = 0;
}

function clientToWorld(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (WORLD_W / rect.width);
  const y = (clientY - rect.top) * (WORLD_H / rect.height);
  return { x, y };
}

let dragStartTime = 0;
let isDraggingTooLong = false;

canvas.addEventListener('pointerdown', (ev) => {
  if (gameState !== 'playing') return;
  const p = clientToWorld(ev.clientX, ev.clientY);
  const current = birds[currentBirdIndex];
  if (!current || current.launched) return;
  const d = Math.hypot(p.x - current.body.position.x, p.y - current.body.position.y);
  if (d < BIRD_RADIUS * 3) {
    dragging = true;
    dragStartTime = Date.now();
    isDraggingTooLong = false;
    ev.preventDefault();
    if (slingConstraint) {
      try { World.remove(world, slingConstraint); } catch (e) {}
      slingConstraint = null;
    }
    canvas.style.cursor = 'grabbing';
    
    // Set timeout to prevent too long drags
    setTimeout(() => {
      if (dragging) {
        isDraggingTooLong = true;
      }
    }, 2000); // 2 second timeout
  }
});

canvas.addEventListener('pointermove', (ev) => {
  if (!dragging || gameState !== 'playing') return;
  ev.preventDefault();
  const p = clientToWorld(ev.clientX, ev.clientY);
  const current = birds[currentBirdIndex];
  if (!current) return;

  let dx = p.x - slingAnchor.x;
  let dy = p.y - slingAnchor.y;
  const dist = Math.hypot(dx, dy);

  const maxPull = 150;
  if (dist > maxPull) {
    dx = (dx / dist) * maxPull;
    dy = (dy / dist) * maxPull;
  }
  if (dx > 25) dx = 25;
  if (dy < -maxPull * 0.8) dy = -maxPull * 0.8;

  const targetX = slingAnchor.x + dx;
  const targetY = slingAnchor.y + dy;
  const smoothFactor = 0.7;
  const newX = current.body.position.x + (targetX - current.body.position.x) * smoothFactor;
  const newY = current.body.position.y + (targetY - current.body.position.y) * smoothFactor;

  Body.setPosition(current.body, { x: newX, y: newY });
  Body.setVelocity(current.body, { x: 0, y: 0 });
  Body.setAngularVelocity(current.body, 0);
});

canvas.addEventListener('pointerup', (ev) => {
  if (!dragging || gameState !== 'playing') return;
  ev.preventDefault();
  
  const current = birds[currentBirdIndex];
  if (current) {
    slingConstraint = Constraint.create({
      pointA: { x: slingAnchor.x, y: slingAnchor.y },
      bodyB: current.body,
      stiffness: 0.05,
      damping: 0.08,
      length: 0,
      render: { visible: false }
    } as any);
    Composite.add(world, slingConstraint);
  }
  
  dragging = false;
  canvas.style.cursor = 'default';
  
  const dragDuration = Date.now() - dragStartTime;
  
  // FIXED: Better launch logic to prevent weird launches
  if (isDraggingTooLong || dragDuration > 2000) {
    // If dragged too long, reset to slingshot
    attachBirdToSling(currentBirdIndex);
  } else if (dragDuration > 100) {
    // Normal launch
    setTimeout(() => releaseBirdFromSling(), 50);
  } else {
    // Too quick tap - minimal launch
    releaseBirdFromSling();
  }
  
  isDraggingTooLong = false;
});

canvas.addEventListener('pointercancel', (ev) => {
  if (dragging && gameState === 'playing') {
    dragging = false;
    canvas.style.cursor = 'default';
    isDraggingTooLong = false;
    // Reset bird on cancel
    attachBirdToSling(currentBirdIndex);
  }
});

function renderFrame() {
  if (gameState !== 'playing') return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  gradient.addColorStop(0, '#88CCFF');
  gradient.addColorStop(0.6, '#CDEFFD');
  gradient.addColorStop(1, '#E8FBFF');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  updateBackground();
  for (const cloud of clouds) drawCloud(ctx, cloud.x, cloud.y, cloud.size);

  ctx.fillStyle = '#3ebd3e';
  ctx.fillRect(0, WORLD_H - GROUND_HEIGHT, WORLD_W, GROUND_HEIGHT);

  drawGrass(ctx);

  // Render blocks with damage states
  for (const blk of blocks) {
    const b = blk.body;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);

    const w = b.bounds.max.x - b.bounds.min.x;
    const h = b.bounds.max.y - b.bounds.min.y;
    const damageRatio = blk.health / blk.maxHealth;

    let color = '#999';
    let pattern = '';
    let strokeColor = '#333';
    let opacity = 1;
    
    switch (blk.damageState) {
      case 'intact':
        opacity = 1.0;
        break;
      case 'cracked':
        opacity = 0.8;
        break;
      case 'broken':
        opacity = 0.6;
        break;
      case 'destroyed':
        opacity = 0.4;
        break;
    }
    
    switch (blk.type) {
      case 'wood': 
        color = damageRatio > 0.5 ? '#8B4513' : '#6b3f1b'; 
        pattern = 'wood'; 
        strokeColor = '#5D4037';
        break;
      case 'stone': 
        color = damageRatio > 0.5 ? '#6f6f6f' : '#525252'; 
        pattern = 'stone'; 
        strokeColor = '#424242';
        break;
      case 'glass': 
        color = damageRatio > 0.5 ? 'rgba(173,216,230,0.8)' : 'rgba(135,206,250,0.5)'; 
        pattern = 'glass'; 
        strokeColor = 'rgba(30,144,255,0.8)';
        break;
      case 'cardboard': 
        color = damageRatio > 0.5 ? '#DEB887' : '#CD853F'; 
        pattern = 'cardboard'; 
        strokeColor = '#A0522D';
        break;
      case 'bamboo': 
        color = damageRatio > 0.5 ? '#9ACD32' : '#6B8E23'; 
        pattern = 'bamboo'; 
        strokeColor = '#556B2F';
        break;
      case 'thatch': 
        color = damageRatio > 0.5 ? '#DAA520' : '#B8860B'; 
        pattern = 'thatch'; 
        strokeColor = '#8B6914';
        break;
      case 'clay': 
        color = damageRatio > 0.5 ? '#CD5C5C' : '#8B3A3A'; 
        pattern = 'clay'; 
        strokeColor = '#8B0000';
        break;
    }

    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    if (blk.damageState !== 'intact' && blk.cracks.length > 0) {
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      
      for (const crack of blk.cracks) {
        ctx.save();
        ctx.translate(crack.x * (w/2), crack.y * (h/2));
        ctx.rotate(crack.angle);
        
        ctx.beginPath();
        ctx.moveTo(-crack.size/2, 0);
        ctx.lineTo(crack.size/2, 0);
        ctx.stroke();
        
        ctx.restore();
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    if (pattern === 'wood' || pattern === 'bamboo') {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 4, -h / 2 + (i + 1) * h / 5);
        ctx.lineTo(w / 2 - 4, -h / 2 + (i + 1) * h / 5);
        ctx.stroke();
      }
    } else if (pattern === 'stone') {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.arc(-w / 3 + (i * w / 3), -h / 3 + (j * h / 3), 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (pattern === 'thatch') {
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 3, -h / 2 + i * 4);
        ctx.lineTo(w / 2 - 3, -h / 2 + i * 4);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.restore();
  }

  // RENDER PIGS (with friend faces based on level and boss status)
  for (const pig of pigs) {
    const p = pig.body;
    ctx.save();
    ctx.translate(p.position.x, p.position.y);
    ctx.rotate(p.angle);
    const r = pig.isBoss ? 40 : 30;

    // Draw appropriate friend face on pig
    if (imagesLoaded) {
      let pigImage: HTMLImageElement;
      
      // Logic for choosing the right image
      if (pig.isBoss) {
        if (currentLevel === 3) {
          pigImage = friend3Image;
        } else if (currentLevel === 4) {
          pigImage = friend4Image;
        } else {
          pigImage = friend2Image;
        }
      } else {
        pigImage = friend2Image;
      }
      
      if (pigImage && pigImage.complete) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        
        ctx.drawImage(pigImage, -r, -r, r * 2, r * 2);
        
        ctx.restore();
        ctx.save();
        ctx.translate(p.position.x, p.position.y);
        ctx.rotate(p.angle);
      } else {
        drawOriginalPig(pig, r);
      }
    } else {
      drawOriginalPig(pig, r);
    }

    // Health bar
    const healthColor = pig.health > pig.maxHealth * 0.5 ? '#4CAF50' : pig.health > 1 ? '#FF9800' : '#F44336';
    ctx.fillStyle = healthColor;
    ctx.fillRect(-r, -r - 10, (pig.health / pig.maxHealth) * (r * 2), 4);

    ctx.restore();
  }

  // RENDER SLINGSHOT
  const sx = slingAnchor.x;
  const sy = slingAnchor.y;
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

  if (slingConstraint && slingConstraint.bodyB && !dragging) {
    const bp = (slingConstraint.bodyB as Matter.Body).position;
    const leftX = sx - 28;
    const rightX = sx + 28;
    const topY = sy - 10;

    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(93,64,55,0.7)';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(bp.x, bp.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightX, topY);
    ctx.lineTo(bp.x, bp.y);
    ctx.stroke();
  }

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

  // RENDER BIRDS (with friend1 faces)
  for (let i = 0; i < birds.length; i++) {
    const br = birds[i];
    const b = br.body;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    const r = BIRD_RADIUS;

    // Draw friend1 face on bird
    if (imagesLoaded && friend1Image && friend1Image.complete) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      
      ctx.drawImage(friend1Image, -r, -r, r * 2, r * 2);
      
      ctx.restore();
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
    } else {
      const fill = br.type === 'red' ? '#DC143C' : (br.type === 'blue' ? '#1E90FF' : '#FFD700');
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!br.launched) {
      ctx.strokeStyle = '#8B0000';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Render trajectory line
  if (dragging) {
    const current = birds[currentBirdIndex];
    if (current) {
      const birdBody = current.body;
      const dx = slingAnchor.x - birdBody.position.x;
      const dy = slingAnchor.y - birdBody.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 15) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
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
  stopBackgroundMusic();
  isPlayingVictoryOrDefeat = false;
  
  if (victorySound) {
    victorySound.pause();
    victorySound = null;
  }
  if (defeatSound) {
    defeatSound.pause();
    defeatSound = null;
  }
  
  if (menuScreen) menuScreen.style.display = 'flex';
  if (gameUI) gameUI.style.display = 'none';
  if (levelCompleteScreen) levelCompleteScreen.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  if (gameCompletionScreen) gameCompletionScreen.style.display = 'none';
  if (canvas) canvas.style.display = 'none';
  if (muteBtn) muteBtn.style.display = 'none';
}

function showGame() {
  // Enhanced landscape check with better mobile detection
  const isMobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile && !isLandscapeMode) {
    alert('Please rotate your device to landscape mode and wait 5 seconds for the game to start.');
    return;
  }
  
  gameState = 'playing';
  isPlayingVictoryOrDefeat = false;
  
  if (menuScreen) menuScreen.style.display = 'none';
  if (gameUI) gameUI.style.display = 'block';
  if (levelCompleteScreen) levelCompleteScreen.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  if (gameCompletionScreen) gameCompletionScreen.style.display = 'none';
  if (canvas) canvas.style.display = 'block';
  if (muteBtn) muteBtn.style.display = 'block';
  
  playLevelMusic();
  buildWorld();
}

function showLevelComplete() {
  if (gameState !== 'playing') return;
  gameState = 'levelComplete';
  
  stopBackgroundMusic();
  playVictorySound();
  
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
  
  stopBackgroundMusic();
  playDefeatSound();
  
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

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      currentLevel = 1;
      globalScore = 0;
      showGame();
    });
  }

  if (nextLevelBtn) {
    nextLevelBtn.addEventListener('click', () => {
      if (currentLevel < 4) {
        currentLevel++;
        showGame();
      } else {
        showGameCompletion();
      }
    });
  }

  if (menuFromCompleteBtn) {
    menuFromCompleteBtn.addEventListener('click', () => {
      currentLevel = 1;
      globalScore = 0;
      showMenu();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      showGame();
    });
  }

  if (menuFromGameOverBtn) {
    menuFromGameOverBtn.addEventListener('click', () => {
      currentLevel = 1;
      globalScore = 0;
      showMenu();
    });
  }

  if (menuFromCompletionBtn) {
    menuFromCompletionBtn.addEventListener('click', () => {
      currentLevel = 1;
      globalScore = 0;
      showMenu();
    });
  }

  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      currentLevel = 1;
      globalScore = 0;
      showGame();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', updateMuteState);
  }
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

// LAG FIX: Performance monitoring and cleanup
setInterval(() => {
  if (activeParticles.length > MAX_PARTICLES) {
    const excess = activeParticles.splice(MAX_PARTICLES);
    excess.forEach(particle => {
      try { World.remove(world, particle); } catch (e) {}
    });
  }
}, 1000);

// Pre-load images when the script loads
loadImages().then((success) => {
  console.log('Initial image loading:', success ? 'Success' : 'Failed');
}).catch((error) => {
  console.error('Initial image loading error:', error);
});

// Initialize audio system
initializeAudio();

// Initial orientation check
checkOrientation();

initializeEventListeners();
showMenu();