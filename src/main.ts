import * as Matter from 'matter-js';

const { Engine, World, Bodies, Body, Runner, Events, Constraint, Composite } = Matter;

let gameState: 'menu' | 'playing' | 'levelComplete' | 'gameOver' = 'menu';
let currentLevel = 1;
let globalScore = 0;
let isMuted = false;

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
const fullscreenBtn = document.getElementById('fullscreenBtn') as HTMLButtonElement;

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

// PERFECTED PHYSICS SETTINGS
world.gravity.y = 1;
engine.timing.timeScale = 1.0;

const runner = Runner.create();
Runner.run(runner, engine);

const GROUND_HEIGHT = 90;

// Friend images
let friend1Image: HTMLImageElement;
let friend2Image: HTMLImageElement;
let friend3Image: HTMLImageElement;
let friend4Image: HTMLImageElement;
let imagesLoaded = false;

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
    
    // Simple play with error handling
    setTimeout(() => {
      audio.play().catch(error => {
        console.log('Audio play failed:', error);
      });
    }, 50);
    
    return audio;
  } catch (error) {
    console.log('Audio creation failed:', error);
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
    console.log('Playing level music:', musicPath);
    bgMusic = createAndPlayAudio(musicPath, 0.5, true);
    currentBgMusic = musicPath;
  }
}

// Play victory sound
function playVictorySound() {
  if (isMuted) return;
  
  console.log('Playing victory sound');
  
  stopBackgroundMusic();
  
  isPlayingVictoryOrDefeat = true;
  
  // Create new audio instance each time for better iOS compatibility
  victorySound = new Audio(AUDIO_PATHS.victory);
  victorySound.volume = 0.7;
  
  // iOS FIX: Use a small timeout to ensure the audio context is ready
  setTimeout(() => {
    victorySound!.play().catch(error => {
      console.log('Victory sound play failed:', error);
    });
  }, 100);
  
  victorySound.addEventListener('ended', () => {
    console.log('Victory sound ended');
    isPlayingVictoryOrDefeat = false;
    victorySound = null;
  });
  
  victorySound.addEventListener('error', () => {
    console.log('Victory sound error');
    isPlayingVictoryOrDefeat = false;
    victorySound = null;
  });
}

// Play defeat sound  
function playDefeatSound() {
  if (isMuted) return;
  
  console.log('Playing defeat sound');
  
  stopBackgroundMusic();
  
  isPlayingVictoryOrDefeat = true;
  
  // Create new audio instance each time for better iOS compatibility
  defeatSound = new Audio(AUDIO_PATHS.defeat);
  defeatSound.volume = 0.7;
  
  // iOS FIX: Use a small timeout to ensure the audio context is ready
  setTimeout(() => {
    defeatSound!.play().catch(error => {
      console.log('Defeat sound play failed:', error);
    });
  }, 100);
  
  defeatSound.addEventListener('ended', () => {
    console.log('Defeat sound ended');
    isPlayingVictoryOrDefeat = false;
    defeatSound = null;
  });
  
  defeatSound.addEventListener('error', () => {
    console.log('Defeat sound error');
    isPlayingVictoryOrDefeat = false;
    defeatSound = null;
  });
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

// FIXED: PERFECT CANVAS RESIZING
function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.scale(dpr, dpr);
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
let advanceTimer = 0;

const MAX_PARTICLES = 20;
let activeParticles: Matter.Body[] = [];

let clouds: { x: number; y: number; size: number; speed: number }[] = [];

// FIXED IMAGE LOADING
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
      console.log(`✅ Loaded image ${imagesLoadedCount}/${imagesToLoad}`);
      if (imagesLoadedCount === imagesToLoad) {
        imagesLoaded = true;
        console.log('🎉 All friend images loaded successfully!');
        resolve(true);
      }
    };

    const onImageError = (err: string) => {
      console.error('❌ Failed to load image:', err);
      imagesLoadedCount++;
      if (imagesLoadedCount === imagesToLoad) {
        imagesLoaded = false;
        console.warn('⚠️ Some images failed to load, using fallback rendering');
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
      console.log('🔍 Trying to load images with import.meta.url');
    } catch (e) {
      console.error('import.meta.url failed, trying relative paths', e);
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
      restitution: 0.4,
      friction: 0.8,
      frictionAir: 0.005,
      density: 0.003,
      collisionFilter: { group: -1 }
    });
    World.add(world, body);
    
    Body.setStatic(body, false);
    
    birds.push({ body, launched: false, type: types[i], launchTime: 0 });
  }
}

// FIXED: PERFECT SLINGSHOT ATTACHMENT FUNCTION
function attachBirdToSling(index: number) {
  if (index < 0 || index >= birds.length) return;
  
  currentBirdIndex = index;
  const birdObj = birds[index];

  if (slingConstraint) {
    World.remove(world, slingConstraint);
    slingConstraint = null;
  }

  Body.setPosition(birdObj.body, { x: slingAnchor.x, y: slingAnchor.y });
  Body.setVelocity(birdObj.body, { x: 0, y: 0 });
  Body.setAngularVelocity(birdObj.body, 0);
  Body.setAngle(birdObj.body, 0);
  Body.setStatic(birdObj.body, false);

  birdObj.launched = false;
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

function addPig(x: number, y: number, health: number, isBoss: boolean): Matter.Body {
  const radius = isBoss ? 60 : 50;
  
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

function buildAssamHouse(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  const platform = Bodies.rectangle(x, baseY, 450, 30, {
    isStatic: true, 
    label: 'platform', 
    friction: 0.9, 
    restitution: 0.1
  });
  World.add(world, platform);

  addStableBlock(x - 90, baseY - 20, 40, 30, 'clay', 3);
  addStableBlock(x - 45, baseY - 20, 40, 30, 'clay', 3);
  addStableBlock(x, baseY - 20, 40, 30, 'clay', 3);
  addStableBlock(x + 45, baseY - 20, 40, 30, 'clay', 3);
  addStableBlock(x + 90, baseY - 20, 40, 30, 'clay', 3);

  addStableBlock(x, baseY - 50, 260, 20, 'wood', 2);

  addStableBlock(x - 80, baseY - 85, 20, 70, 'wood', 4);
  addStableBlock(x + 80, baseY - 85, 20, 70, 'wood', 4);
  addStableBlock(x - 35, baseY - 85, 20, 70, 'wood', 4);
  addStableBlock(x + 35, baseY - 85, 20, 70, 'wood', 4);

  addStableBlock(x - 50, baseY - 120, 110, 25, 'thatch', 1);
  addStableBlock(x + 50, baseY - 120, 110, 25, 'thatch', 1);

  addStableBlock(x - 60, baseY - 70, 35, 25, 'glass', 1);
  addStableBlock(x + 60, baseY - 70, 35, 25, 'glass', 1);

  addStableBlock(x, baseY - 145, 240, 20, 'thatch', 1);
  
  addStableBlock(x, baseY - 155, 60, 15, 'wood', 2);
  addStableBlock(x, baseY - 30, 80, 30, 'wood', 3);

  addPig(x - 35, baseY - 60, 5, false);
  addPig(x + 35, baseY - 60, 5, false);
  addPig(x, baseY - 100, 5, false);
  addPig(x - 80, baseY - 40, 5, false);
}

function buildTwoStory(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  const platform = Bodies.rectangle(x, baseY, 500, 30, {
    isStatic: true, label: 'platform', friction: 0.9, restitution: 0.1
  });
  World.add(world, platform);

  addStableBlock(x - 130, baseY - 35, 35, 70, 'stone', 5);
  addStableBlock(x + 130, baseY - 35, 35, 70, 'stone', 5);
  addStableBlock(x, baseY - 70, 300, 25, 'stone', 4);

  addStableBlock(x - 110, baseY - 105, 30, 70, 'stone', 5);
  addStableBlock(x + 110, baseY - 105, 30, 70, 'stone', 5);
  addStableBlock(x, baseY - 140, 260, 25, 'stone', 4);

  addStableBlock(x - 90, baseY - 175, 30, 70, 'wood', 4);
  addStableBlock(x + 90, baseY - 175, 30, 70, 'wood', 4);
  addStableBlock(x, baseY - 210, 220, 25, 'wood', 3);

  addStableBlock(x - 100, baseY - 50, 35, 40, 'glass', 1);
  addStableBlock(x + 100, baseY - 50, 35, 40, 'glass', 1);
  addStableBlock(x - 90, baseY - 120, 30, 35, 'glass', 1);
  addStableBlock(x + 90, baseY - 120, 30, 35, 'glass', 1);

  addStableBlock(x, baseY - 85, 170, 15, 'wood', 2);
  addStableBlock(x, baseY - 225, 260, 20, 'wood', 2);

  addPig(x - 90, baseY - 45, 6, false);
  addPig(x + 90, baseY - 45, 6, false);
  addPig(x - 70, baseY - 115, 6, false);
  addPig(x + 70, baseY - 115, 6, false);
  addPig(x, baseY - 185, 6, false);
}

// FIXED: Level 3 - Now a 2-story building but keeping all pigs including boss
function buildThreeStory(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  const platform = Bodies.rectangle(x, baseY, 500, 30, {
    isStatic: true, label: 'platform', friction: 0.9, restitution: 0.1
  });
  World.add(world, platform);

  // First story - stone foundation
  addStableBlock(x - 130, baseY - 35, 35, 70, 'stone', 6);
  addStableBlock(x + 130, baseY - 35, 35, 70, 'stone', 6);
  addStableBlock(x, baseY - 70, 300, 25, 'stone', 5);

  // Second story - wood structure
  addStableBlock(x - 110, baseY - 105, 30, 70, 'wood', 4);
  addStableBlock(x + 110, baseY - 105, 30, 70, 'wood', 4);
  addStableBlock(x, baseY - 140, 260, 25, 'wood', 3);

  // Windows
  addStableBlock(x - 100, baseY - 50, 35, 40, 'glass', 1);
  addStableBlock(x + 100, baseY - 50, 35, 40, 'glass', 1);
  addStableBlock(x - 90, baseY - 120, 30, 35, 'glass', 1);
  addStableBlock(x + 90, baseY - 120, 30, 35, 'glass', 1);

  // Internal supports
  addStableBlock(x, baseY - 85, 170, 15, 'wood', 2);
  addStableBlock(x, baseY - 155, 220, 20, 'wood', 2);

  // Pigs - keeping all pigs including boss
  addPig(x - 90, baseY - 45, 8, false);
  addPig(x + 90, baseY - 45, 8, false);
  addPig(x - 70, baseY - 115, 8, false);
  addPig(x + 70, baseY - 115, 8, false);
  addPig(x, baseY - 125, 12, true); // Boss pig in the center
}

function buildFinalLevel(x: number) {
  const baseY = STRUCTURE_BASE_Y;
  
  const platform = Bodies.rectangle(x, baseY, 600, 30, {
    isStatic: true, label: 'platform', friction: 0.9, restitution: 0.1
  });
  World.add(world, platform);

  addStableBlock(x - 180, baseY - 60, 40, 120, 'stone', 8);
  addStableBlock(x + 180, baseY - 60, 40, 120, 'stone', 8);

  addStableBlock(x - 110, baseY - 40, 35, 80, 'stone', 6);
  addStableBlock(x + 110, baseY - 40, 35, 80, 'stone', 6);
  addStableBlock(x, baseY - 80, 260, 25, 'stone', 5);

  addStableBlock(x - 90, baseY - 120, 32, 80, 'stone', 4);
  addStableBlock(x + 90, baseY - 120, 32, 80, 'stone', 4);
  addStableBlock(x, baseY - 160, 220, 25, 'stone', 3);

  addStableBlock(x - 70, baseY - 200, 30, 80, 'stone', 3);
  addStableBlock(x + 70, baseY - 200, 30, 80, 'stone', 3);
  addStableBlock(x, baseY - 240, 180, 25, 'stone', 2);

  addPig(x - 180, baseY - 120, 8, false);
  addPig(x + 180, baseY - 120, 8, false);
  addPig(x - 90, baseY - 50, 8, false);
  addPig(x + 90, baseY - 50, 8, false);
  addPig(x, baseY - 120, 8, false);
  addPig(x, baseY - 200, 8, false);
  addPig(x, baseY - 240, 15, true);
}

let ground: Matter.Body;
let leftWall: Matter.Body;
let rightWall: Matter.Body;
let slingAnchor = { x: 170, y: 0 };

// FIXED: PERFECT WORLD BUILDING
function buildWorld() {
  WORLD_W = window.innerWidth;
  WORLD_H = window.innerHeight;
  STRUCTURE_BASE_Y = WORLD_H - GROUND_HEIGHT - 10;
  BIRD_RADIUS = 25;
  slingAnchor.x = Math.max(140, Math.floor(WORLD_W * 0.15));
  slingAnchor.y = WORLD_H - GROUND_HEIGHT - 110;

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

  createBackground();

  if (!imagesLoaded) {
    loadImages().then((success) => {
      console.log('Image loading completed:', success ? 'Success' : 'Failed');
    }).catch((error) => {
      console.error('Image loading error:', error);
    });
  }

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

  const structureX = WORLD_W - Math.floor(WORLD_W * 0.3);
  
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

  const birdTypesList: ('red' | 'blue' | 'yellow')[][] = [
    ['red', 'red', 'red', 'red', 'red'],
    ['red', 'blue', 'red', 'blue', 'red'],
    ['red', 'blue', 'yellow', 'red', 'blue'],
    ['red', 'blue', 'yellow', 'blue', 'yellow', 'red']
  ];
  
  const birdTypes = birdTypesList[currentLevel - 1] || ['red', 'red', 'red'];
  spawnBirds(birdTypes);
  
  if (birds.length > 0) {
    attachBirdToSling(0);
  }

  Events.off(engine, 'collisionStart');
  Events.on(engine, 'collisionStart', handleCollision);
}

// FIXED: Auto-advance to next bird
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
  
  if (current && current.launched) {
    const speed = Math.hypot(current.body.velocity.x, current.body.velocity.y);
    const isOutOfBounds = current.body.position.x < -100 || 
                          current.body.position.x > WORLD_W + 100 ||
                          current.body.position.y > WORLD_H + 100;
    
    if (speed < 0.5 || isOutOfBounds) {
      advanceTimer++;
      
      if (advanceTimer > 60) {
        const nextIndex = birds.findIndex(b => !b.launched);
        
        if (nextIndex >= 0) {
          console.log(`Advancing to bird ${nextIndex + 1}`);
          currentBirdIndex = nextIndex;
          attachBirdToSling(currentBirdIndex);
          advanceTimer = 0;
        } else {
          if (advanceTimer > 180 && pigs.length > 0) {
            console.log('All birds used, pigs remain - GAME OVER');
            showGameOver();
            advanceTimer = 0;
          }
        }
      }
    } else {
      advanceTimer = 0;
    }
  } else if (!current) {
    const nextIndex = birds.findIndex(b => !b.launched);
    if (nextIndex >= 0) {
      currentBirdIndex = nextIndex;
      attachBirdToSling(currentBirdIndex);
    }
  }
}

// ========== WORKING SLINGSHOT SYSTEM ==========
let isDragging = false;

canvas.addEventListener('pointerdown', (ev) => {
  if (gameState !== 'playing') return;
  
  const current = birds[currentBirdIndex];
  if (!current || current.launched) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = ev.clientX - rect.left;
  const mouseY = ev.clientY - rect.top;
  
  const distToBird = Math.hypot(mouseX - current.body.position.x, mouseY - current.body.position.y);
  
  if (distToBird < BIRD_RADIUS * 3) {
    isDragging = true;
    
    if (slingConstraint) {
      World.remove(world, slingConstraint);
      slingConstraint = null;
    }
    
    canvas.style.cursor = 'grabbing';
    ev.preventDefault();
  }
});

canvas.addEventListener('pointermove', (ev) => {
  if (!isDragging || gameState !== 'playing') return;
  
  const current = birds[currentBirdIndex];
  if (!current) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = ev.clientX - rect.left;
  const mouseY = ev.clientY - rect.top;
  
  let dragX = mouseX - slingAnchor.x;
  let dragY = mouseY - slingAnchor.y;
  const dragDist = Math.hypot(dragX, dragY);
  
  const maxDrag = 150;
  if (dragDist > maxDrag) {
    dragX = (dragX / dragDist) * maxDrag;
    dragY = (dragY / dragDist) * maxDrag;
  }
  
  if (dragX > 30) dragX = 30;
  
  Body.setPosition(current.body, {
    x: slingAnchor.x + dragX,
    y: slingAnchor.y + dragY
  });
  
  ev.preventDefault();
});

canvas.addEventListener('pointerup', (ev) => {
  if (!isDragging || gameState !== 'playing') return;
  
  const current = birds[currentBirdIndex];
  if (!current) {
    isDragging = false;
    return;
  }
  
  const dragX = current.body.position.x - slingAnchor.x;
  const dragY = current.body.position.y - slingAnchor.y;
  const dragDist = Math.hypot(dragX, dragY);
  
  if (dragDist > 15) {
    current.launched = true;
    current.launchTime = Date.now();
    
    const launchPower = 0.22;
    const velX = -dragX * launchPower;
    const velY = -dragY * launchPower;
    
    Body.setStatic(current.body, false);
    
    Body.setVelocity(current.body, { x: velX, y: velY });
    
    const speed = Body.getSpeed(current.body);
    if (speed > 75) {
      Body.setSpeed(current.body, 75);
    }
    
    console.log('LAUNCHED! Velocity:', velX.toFixed(2), velY.toFixed(2), 'Speed:', speed.toFixed(2));
    
  } else {
    Body.setPosition(current.body, { x: slingAnchor.x, y: slingAnchor.y });
    attachBirdToSling(currentBirdIndex);
  }
  
  isDragging = false;
  canvas.style.cursor = 'default';
  ev.preventDefault();
});

canvas.addEventListener('pointercancel', (ev) => {
  if (isDragging) {
    const current = birds[currentBirdIndex];
    if (current) {
      Body.setPosition(current.body, { x: slingAnchor.x, y: slingAnchor.y });
      attachBirdToSling(currentBirdIndex);
    }
    isDragging = false;
    canvas.style.cursor = 'default';
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

  for (const pig of pigs) {
    const p = pig.body;
    ctx.save();
    ctx.translate(p.position.x, p.position.y);
    ctx.rotate(p.angle);
    const r = pig.isBoss ? 60 : 50;

    if (imagesLoaded) {
      let pigImage: HTMLImageElement;
      
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

    const healthColor = pig.health > pig.maxHealth * 0.5 ? '#4CAF50' : pig.health > 1 ? '#FF9800' : '#F44336';
    ctx.fillStyle = healthColor;
    ctx.fillRect(-r, -r - 10, (pig.health / pig.maxHealth) * (r * 2), 4);

    ctx.restore();
  }

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

  if (isDragging) {
    const current = birds[currentBirdIndex];
    if (current) {
      const bp = current.body.position;
      const leftX = sx - 28;
      const rightX = sx + 28;
      const topY = sy - 10;

      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(139,69,19,0.95)';
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(leftX, topY);
      ctx.lineTo(bp.x, bp.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightX, topY);
      ctx.lineTo(bp.x, bp.y);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(160,82,45,0.6)';
      ctx.beginPath();
      ctx.moveTo(leftX, topY);
      ctx.lineTo(bp.x, bp.y);
      ctx.moveTo(rightX, topY);
      ctx.lineTo(bp.x, bp.y);
      ctx.stroke();
    }
  } else {
    const current = birds[currentBirdIndex];
    if (current && !current.launched) {
      const bp = current.body.position;
      const leftX = sx - 28;
      const rightX = sx + 28;
      const topY = sy - 10;

      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(139,69,19,0.8)';
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
  }

  for (let i = 0; i < birds.length; i++) {
    const br = birds[i];
    const b = br.body;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    const r = BIRD_RADIUS;

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

  if (isDragging) {
    const current = birds[currentBirdIndex];
    if (current) {
      const dragX = current.body.position.x - slingAnchor.x;
      const dragY = current.body.position.y - slingAnchor.y;
      const dragDist = Math.hypot(dragX, dragY);

      if (dragDist > 15) {
        const launchPower = 0.22;
        const velX = -dragX * launchPower;
        const velY = -dragY * launchPower;

        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(current.body.position.x, current.body.position.y);

        for (let t = 0; t < 100; t += 2) {
          const x = current.body.position.x + velX * t;
          const y = current.body.position.y + velY * t + 0.5 * world.gravity.y * t * t;
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
  if (fullscreenBtn) fullscreenBtn.style.display = 'none';
}

function showGame() {
  gameState = 'playing';
  
  isPlayingVictoryOrDefeat = false;
  
  if (menuScreen) menuScreen.style.display = 'none';
  if (gameUI) gameUI.style.display = 'block';
  if (levelCompleteScreen) levelCompleteScreen.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  if (gameCompletionScreen) gameCompletionScreen.style.display = 'none';
  if (canvas) canvas.style.display = 'block';
  if (muteBtn) muteBtn.style.display = 'block';
  if (fullscreenBtn) fullscreenBtn.style.display = 'flex';
  
  playLevelMusic();
  buildWorld();
}

function showLevelComplete() {
  if (gameState !== 'playing') return;
  gameState = 'levelComplete';
  
  stopBackgroundMusic();
  playVictorySound();
  
  console.log(`Showing level complete screen for level ${currentLevel}`);
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

// FIXED: SIMPLE FULLSCREEN FUNCTION
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// FIXED: Handle fullscreen changes
function handleFullscreenChange() {
  const isFullscreen = !!document.fullscreenElement;
  
  if (fullscreenBtn) {
    fullscreenBtn.innerHTML = isFullscreen ? '✕' : '⛶';
  }
  
  // Rebuild world when fullscreen changes
  setTimeout(() => {
    if (gameState === 'playing') {
      buildWorld();
    }
  }, 100);
}

function initializeEventListeners() {
  const playBtn = document.getElementById('playBtn');
  const nextLevelBtn = document.getElementById('nextLevelBtn');
  const menuFromCompleteBtn = document.getElementById('menuFromCompleteBtn');
  const retryBtn = document.getElementById('retryBtn');
  const menuFromGameOverBtn = document.getElementById('menuFromGameOverBtn');
  const menuFromCompletionBtn = document.getElementById('menuFromCompletionBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');

  // FIXED: Add fullscreen button event listener
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      currentLevel = 1;
      globalScore = 0;
      showGame();
    });
  }

  if (nextLevelBtn) {
    nextLevelBtn.addEventListener('click', () => {
      console.log(`Next level clicked. Current level: ${currentLevel}`);
      if (currentLevel < 4) {
        currentLevel++;
        console.log(`Moving to level ${currentLevel}`);
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

// FIXED: PERFECT ORIENTATION HANDLING
function checkOrientation() {
  const isLandscape = window.innerWidth > window.innerHeight;
  const rotateMessage = document.getElementById('rotateMessage');
  
  if (isLandscape) {
    document.body.classList.add('landscape-mode');
    if (rotateMessage) rotateMessage.style.display = 'none';
  } else {
    document.body.classList.remove('landscape-mode');
    if (rotateMessage) rotateMessage.style.display = 'flex';
  }
  
  WORLD_W = window.innerWidth;
  WORLD_H = window.innerHeight;
  STRUCTURE_BASE_Y = WORLD_H - GROUND_HEIGHT - 10;
  slingAnchor.x = Math.max(140, Math.floor(WORLD_W * 0.15));
  slingAnchor.y = WORLD_H - GROUND_HEIGHT - 110;
  
  if (gameState === 'playing') {
    resizeCanvas();
  }
}

window.addEventListener('resize', () => {
  checkOrientation();
  resizeCanvas();
  WORLD_W = window.innerWidth;
  WORLD_H = window.innerHeight;
  STRUCTURE_BASE_Y = WORLD_H - GROUND_HEIGHT - 10;
  slingAnchor.x = Math.max(140, Math.floor(WORLD_W * 0.15));
  slingAnchor.y = WORLD_H - GROUND_HEIGHT - 110;
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    checkOrientation();
    resizeCanvas();
  }, 100);
});

// Add fullscreen change event listeners
document.addEventListener('fullscreenchange', handleFullscreenChange);

// IMPORTANT: Call this immediately when page loads
checkOrientation();

// Pre-load images when the script loads
loadImages().then((success) => {
  console.log('Initial image loading:', success ? 'Success' : 'Failed');
}).catch((error) => {
  console.error('Initial image loading error:', error);
});

// Initialize audio system
initializeAudio();

initializeEventListeners();
resizeCanvas();
showMenu();