const { createNoise2D, createNoise3D } = require('simplex-noise');
const seedrandom = require('seedrandom');

// ----- World Aspects & Word Influence Map -----
const ASPECTS = {
  temperature: 0.5,      // 0=cold, 1=hot
  moisture: 0.5,         // 0=arid, 1=wet
  heightScale: 1.0,      // terrain amplitude
  roughness: 0.5,        // high‑frequency detail
  weirdness: 0.0,        // alien/otherworldly factor
  vegetation: 0.5,       // tree/plant density
  oreRichness: 0.5,      // ore probability
  caveDensity: 0.5,      // cave threshold inverse
  colorHue: 0.3,         // base hue shift (0=red, 0.3=green, 0.6=blue)
  colorSaturation: 0.6,
  colorBrightness: 0.7,
};

// Word → aspect delta (can be extended freely)
const WORD_INFLUENCE = {
  // Temperature ────────────────────────────────────────────────
  snow: { temperature: -0.4 }, ice: { temperature: -0.5 }, frost: { temperature: -0.3 },
  cold: { temperature: -0.3 }, winter: { temperature: -0.4 }, freeze: { temperature: -0.4 },
  hot: { temperature: 0.3 }, lava: { temperature: 0.5, weirdness: 0.2 },
  magma: { temperature: 0.5, weirdness: 0.15 }, molten: { temperature: 0.4, weirdness: 0.1 },
  fire: { temperature: 0.4 }, flame: { temperature: 0.4 }, burn: { temperature: 0.3 },
  volcano: { temperature: 0.4, heightScale: 0.4, roughness: 0.3 },
  volcanic: { temperature: 0.35, weirdness: 0.1, heightScale: 0.2 },
  desert: { temperature: 0.3, moisture: -0.4 }, arid: { moisture: -0.4 },
  heat: { temperature: 0.2 }, warm: { temperature: 0.1 },

  // Moisture ───────────────────────────────────────────────────
  wet: { moisture: 0.3 }, water: { moisture: 0.3 }, rain: { moisture: 0.3 },
  swamp: { moisture: 0.4, vegetation: 0.2 }, bog: { moisture: 0.4 },
  marsh: { moisture: 0.4 }, ocean: { moisture: 0.5 }, sea: { moisture: 0.5 },
  river: { moisture: 0.2 }, lake: { moisture: 0.2 },
  dry: { moisture: -0.3 }, drought: { moisture: -0.4 },

  // Terrain ────────────────────────────────────────────────────
  mountain: { heightScale: 0.5, roughness: 0.3 }, peak: { heightScale: 0.4 },
  hill: { heightScale: 0.2 }, hills: { heightScale: 0.2 },
  flat: { heightScale: -0.3, roughness: -0.2 }, plain: { heightScale: -0.2 },
  canyon: { roughness: 0.4 }, gorge: { roughness: 0.3 },
  cliff: { heightScale: 0.2, roughness: 0.2 }, ridge: { heightScale: 0.1, roughness: 0.1 },
  valley: { heightScale: -0.1 },

  // Vegetation ─────────────────────────────────────────────────
  forest: { vegetation: 0.4 }, woods: { vegetation: 0.3 },
  jungle: { vegetation: 0.5, moisture: 0.2 }, rainforest: { vegetation: 0.5, moisture: 0.3 },
  tree: { vegetation: 0.2 }, trees: { vegetation: 0.2 },
  barren: { vegetation: -0.5 }, dead: { vegetation: -0.4, weirdness: 0.1 },
  grass: { vegetation: 0.1 }, flower: { vegetation: 0.1, weirdness: 0.1 },
  mushroom: { weirdness: 0.2 }, fungi: { weirdness: 0.2 },

  // Resources ──────────────────────────────────────────────────
  rich: { oreRichness: 0.4 }, treasure: { oreRichness: 0.3 },
  poor: { oreRichness: -0.3 }, sparse: { oreRichness: -0.2 },
  cave: { caveDensity: 0.3 }, cavern: { caveDensity: 0.4 },
  tunnel: { caveDensity: 0.2 }, mine: { oreRichness: 0.2, caveDensity: 0.1 },

  // Weird / Otherworldly ───────────────────────────────────────
  alien: { weirdness: 0.6, colorHue: 0.8 }, space: { weirdness: 0.7, colorHue: 0.7 },
  cosmic: { weirdness: 0.6, colorHue: 0.7 }, moon: { weirdness: 0.5, colorBrightness: -0.1 },
  fairy: { weirdness: 0.4, colorSaturation: 0.2, colorBrightness: 0.2 },
  magic: { weirdness: 0.3, colorHue: 0.9 }, enchanted: { weirdness: 0.3 },
  dream: { weirdness: 0.5 }, nightmare: { weirdness: 0.6, colorBrightness: -0.2 },
  void: { weirdness: 0.8, colorBrightness: -0.3 }, abyss: { weirdness: 0.7, colorBrightness: -0.2 },
  crystal: { weirdness: 0.2, colorSaturation: 0.3 }, gem: { weirdness: 0.1, oreRichness: 0.2 },
  toxic: { weirdness: 0.4, colorHue: 0.2 }, poison: { weirdness: 0.3 },
  haunted: { weirdness: 0.3, colorBrightness: -0.2 },
  ethereal: { weirdness: 0.4, colorSaturation: 0.1, colorBrightness: 0.1 },

  // Color shifts ───────────────────────────────────────────────
  pink: { colorHue: 0.9, colorSaturation: 0.2 }, purple: { colorHue: 0.8 },
  blue: { colorHue: 0.6 }, cyan: { colorHue: 0.55 },
  red: { colorHue: 0.0 }, crimson: { colorHue: 0.0, colorBrightness: -0.1 },
  green: { colorHue: 0.3 }, lime: { colorHue: 0.25, colorSaturation: 0.2 },
  yellow: { colorHue: 0.15 }, orange: { colorHue: 0.08 },
  dark: { colorBrightness: -0.3 }, light: { colorBrightness: 0.2 },
  bright: { colorBrightness: 0.2, colorSaturation: 0.1 },
  pale: { colorSaturation: -0.2, colorBrightness: 0.1 },
  vivid: { colorSaturation: 0.3 },
};

function computeWorldParams(prompt, seed) {
  const words = prompt.toLowerCase().match(/[a-z]+/g) || [];
  const params = { ...ASPECTS };
  
  // Apply word influences
  for (const word of words) {
    const influence = WORD_INFLUENCE[word];
    if (influence) {
      for (const [aspect, delta] of Object.entries(influence)) {
        params[aspect] = Math.max(0, Math.min(1, (params[aspect] || 0) + delta));
      }
    }
  }
  
  // Deterministic random jitter based on full prompt hash
  const rng = seedrandom(seed + '_params');
  for (const aspect of Object.keys(params)) {
    const jitter = (rng() - 0.5) * 0.2;
    params[aspect] = Math.max(0, Math.min(1, params[aspect] + jitter));
  }
  
  // Weirdness pushes colors further
  if (params.weirdness > 0.5) {
    params.colorHue = (params.colorHue + rng() * 0.3) % 1.0;
    params.colorSaturation = Math.min(1, params.colorSaturation + 0.2);
  }
  
  return params;
}

function selectBlocksFromParams(params) {
  const t = params.temperature;      // 0=cold, 1=hot
  const m = params.moisture;         // 0=dry, 1=wet
  const w = params.weirdness;        // 0=normal, 1=alien

  // Surface block: blend based on temperature and moisture
  let surface;
  if (t < 0.2) surface = 'snow';
  else if (t > 0.8 && m < 0.4) surface = 'sand';      // hot dry → desert
  else if (t > 0.9 && w > 0.15) surface = 'magma';    // extreme heat + weird → volcanic
  else if (w > 0.6) surface = 'voidstone';
  else if (w > 0.3) surface = 'fairygrass';
  else surface = 'grass';

  // Ground block: typically one layer below surface
  let ground;
  if (surface === 'snow') ground = 'ice';
  else if (surface === 'sand') ground = 'dirt';
  else if (surface === 'magma') ground = 'blackstone';
  else if (surface === 'voidstone') ground = 'blackstone';
  else if (surface === 'fairygrass') ground = 'dirt';
  else ground = 'dirt';

  // Stone block: base underground material
  let stone;
  if (w > 0.7) stone = 'voidstone';
  else if (t > 0.8 && w > 0.2) stone = 'magma';
  else if (t > 0.7) stone = 'blackstone';
  else stone = 'stone';

  return { surface, ground, stone };
}

function generateColorPalette(params) {
  const hue = params.colorHue;
  const sat = params.colorSaturation;
  const light = params.colorBrightness;
  const hsl = (h, s, l) => `hsl(${h * 360}, ${s * 100}%, ${l * 100}%)`;

  return {
    // Terrain
    grass: hsl(0.3 + (hue - 0.3) * 0.3, sat * 0.8, light * 0.6),
    dirt: hsl(0.07, sat * 0.5, light * 0.4),
    stone: hsl(0, 0, light * 0.5),
    sand: hsl(0.1, sat * 0.6, light * 0.7),
    snow: hsl(0, 0, light * 0.95),
    ice: hsl(0.6, sat * 0.3, light * 0.8),
    voidstone: hsl(hue, sat, light * 0.3),
    fairygrass: hsl(0.9, sat * 0.4, light * 0.7),
    blackstone: hsl(0, 0, light * 0.2),
    magma: hsl(0.05, sat, light * 0.4),
    // Flora
    forest: hsl(0.3, sat * 0.7, light * 0.3),
    leaf: hsl(0.3, sat * 0.6, light * 0.25),
    mushroom: hsl(0.8, sat * 0.5, light * 0.6),
    crystal: hsl(hue, sat * 0.9, light * 0.7),
    // Ores
    coal: '#2a2a2a',
    iron: '#8a6a5a',
    gold: '#d4a017',
    diamond: '#4ae3e3',
    copper: '#b87333',
    // Liquids
    lava: '#ff4d00',
    water: '#00ccff',
  };
}

function makeNoise2D(seed) {
  const rng = seedrandom(seed);
  const prng = () => rng();
  return createNoise2D(prng);
}

function makeNoise3D(seed) {
  const rng = seedrandom(seed);
  const prng = () => rng();
  return createNoise3D(prng);
}

const GRID_SIZE = 48;
const BLOCK_SIZE = 2;
const HEIGHT = 32;

const BIOMES = {
  desert: { surface: 'sand', ground: 'dirt', minHeight: 2, maxHeight: 5, moisture: 0.2 },
  plains: { surface: 'grass', ground: 'dirt', minHeight: 3, maxHeight: 7, moisture: 0.5 },
  forest: { surface: 'grass', ground: 'dirt', minHeight: 4, maxHeight: 8, moisture: 0.7 },
  mountains: { surface: 'stone', ground: 'stone', minHeight: 8, maxHeight: 16, moisture: 0.4 },
  taiga: { surface: 'forest', ground: 'dirt', minHeight: 5, maxHeight: 10, moisture: 0.6 },
  swamp: { surface: 'dirt', ground: 'dirt', minHeight: 1, maxHeight: 4, moisture: 0.9 },
};

const ORE_CONFIG = {
  coal: { veinSize: 8, minY: 5, maxY: 30, probability: 0.012 },
  iron: { veinSize: 6, minY: 5, maxY: 25, probability: 0.009 },
  gold: { veinSize: 4, minY: 1, maxY: 15, probability: 0.004 },
  diamond: { veinSize: 3, minY: 1, maxY: 8, probability: 0.002 },
  copper: { veinSize: 5, minY: 5, maxY: 20, probability: 0.01 },
};

function seededRandom(seed) {
  return seedrandom(seed);
}

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// ====== WORLD GENERATOR ======
class WorldGenerator {
  constructor(seed, params) {
    this.seed = seed;
    this.params = params;
    this.rng = seededRandom(seed);
    
    // Offset noise seeds based on temperature/moisture
    const tempOffset = Math.floor(params.temperature * 2000);
    const moistOffset = Math.floor(params.moisture * 2000);
    
    this.heightNoise = makeNoise2D(seed);
    this.tempNoise = makeNoise2D(seed + 1000 + tempOffset);
    this.moistureNoise = makeNoise2D(seed + 2000 + moistOffset);
    this.caveNoise = makeNoise3D(seed + 3000);
    this.oreNoise = makeNoise3D(seed + 4000);
  }

  getClimate(x, z) {
    let temp = (this.tempNoise(x * 0.02, z * 0.02) + 1) / 2;
    let moisture = (this.moistureNoise(x * 0.02, z * 0.02) + 1) / 2;
    
    // Blend with global parameters
    temp = temp * 0.6 + this.params.temperature * 0.4;
    moisture = moisture * 0.6 + this.params.moisture * 0.4;
    
    return { temperature: temp, moisture };
  }

  getHeight(x, z, climate) {
    const baseScale = 0.03 * this.params.heightScale;
    const detailScale = 0.1 * this.params.roughness;
    
    let baseHeight = this.heightNoise(x * baseScale, z * baseScale) * 8;
    let detail = this.heightNoise(x * detailScale, z * detailScale) * 2;
    
    // Slight influence from temperature (warmer = slightly higher)
    baseHeight += climate.temperature * 2 - 1;
    
    return Math.floor(Math.max(2, baseHeight + detail + 4));
  }

  isCave(x, y, z) {
    if (y < 5 || y > 20) return false;
    // More cave density -> lower threshold
    const threshold = 0.5 - this.params.caveDensity * 0.4;
    const cave = this.caveNoise(x * 0.05, y * 0.05, z * 0.05);
    const cave2 = this.caveNoise(x * 0.08 + 100, y * 0.08, z * 0.08 + 100);
    return (cave + cave2) > threshold;
  }

  getOre(x, y, z) {
    if (y < 2) return null;
    const oreMult = 0.5 + this.params.oreRichness * 1.5;
    
    for (const [oreName, config] of Object.entries(ORE_CONFIG)) {
      if (y < config.minY || y > config.maxY) continue;
      const noise = this.oreNoise(x * 0.5, y * 0.5, z * 0.5);
      if (noise > 1 - config.probability * 50 * oreMult) {
        return oreName;
      }
    }
    return null;
  }

  generate() {
  try {
    const voxels = [];
    const center = (GRID_SIZE * BLOCK_SIZE) / 2;
    const rng = this.rng;
    
    const blocks = selectBlocksFromParams(this.params);
    const treeChance = this.params.vegetation * 0.8;
    const weirdness = this.params.weirdness;
    
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const climate = this.getClimate(x, z);
        const surfaceHeight = this.getHeight(x, z, climate);
        
        for (let y = 0; y <= surfaceHeight; y++) {
          const bx = x * BLOCK_SIZE - center;
          const bz = z * BLOCK_SIZE - center;
          
          let blockType;
          if (y === surfaceHeight) blockType = blocks.surface;
          else if (y >= surfaceHeight - 3) blockType = blocks.ground;
          else blockType = blocks.stone;
          
          // Caves and ores override
          if (this.isCave(x, y, z)) {
            const ore = this.getOre(x, y, z);
            if (ore) blockType = ore;
            else continue;
          }
          
          voxels.push({
            pos: [bx, y * BLOCK_SIZE, bz],
            size: [BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE],
            type: blockType,
            height: y
          });
        }
        
        if (surfaceHeight >= 4 && rng() < treeChance) {
          this.addFeature(voxels, x, z, surfaceHeight, center, rng, weirdness);
        }
      }
    }
    return voxels;
  } catch (err) {
    console.error('Error in WorldGenerator.generate():', err);
    return []; // fallback empty world
  }
}

  addFeature(voxels, x, z, surfaceHeight, center, rng, weirdness) {
    const bx = x * BLOCK_SIZE - center;
    const bz = z * BLOCK_SIZE - center;
    const baseY = (surfaceHeight + 1) * BLOCK_SIZE;
    
    if (weirdness > 0.5) {
      // Crystals or mushrooms instead of normal trees
      const height = Math.floor(rng() * 3) + 2;
      for (let h = 0; h < height; h++) {
        voxels.push({
          pos: [bx, baseY + h * BLOCK_SIZE, bz],
          size: [BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE],
          type: weirdness > 0.7 ? 'crystal' : 'mushroom',
          height: surfaceHeight + h + 1,
          isFeature: true
        });
      }
      // Add a cap or crystal cluster
      voxels.push({
        pos: [bx, baseY + height * BLOCK_SIZE, bz],
        size: [BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE],
        type: weirdness > 0.7 ? 'crystal' : 'mushroom',
        height: surfaceHeight + height + 1,
        isFeature: true
      });
    } else {
      // Normal trees (similar to original, but can be adapted)
      const treeHeight = Math.floor(rng() * 3) + 3;
      for (let ty = 0; ty < treeHeight; ty++) {
        voxels.push({
          pos: [bx, baseY + ty * BLOCK_SIZE, bz],
          size: [BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE],
          type: 'forest',
          height: surfaceHeight + ty + 1,
          isFeature: true
        });
      }
      const leafStart = treeHeight - 2;
      for (let ly = leafStart; ly <= treeHeight + 1; ly++) {
        for (let lx = -1; lx <= 1; lx++) {
          for (let lz = -1; lz <= 1; lz++) {
            if (lx === 0 && lz === 0 && ly < treeHeight + 1) continue;
            if (Math.abs(lx) + Math.abs(lz) === 2 && ly === treeHeight + 1) continue;
            voxels.push({
              pos: [bx + lx * BLOCK_SIZE, baseY + ly * BLOCK_SIZE, bz + lz * BLOCK_SIZE],
              size: [BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE],
              type: 'leaf',
              height: surfaceHeight + ly + 1,
              isFeature: true
            });
          }
        }
      }
    }
  }
}

// ====== MAIN GENERATE FUNCTION ======
function generateWorld(prompt, existingSeed = null) {
  const seed = existingSeed || cyrb53(prompt.toLowerCase());
  console.log(`Generating world: "${prompt}" | seed: ${seed}`);
  
  const params = computeWorldParams(prompt, seed);
  console.log('World params:', params);
  
  const generator = new WorldGenerator(seed, params);
  let voxelData = generator.generate();
  
  // Validate output
  if (!Array.isArray(voxelData)) {
    console.error('Generator returned non-array, using fallback empty world');
    voxelData = [];
  }
  
  console.log(`Generated voxels: ${voxelData.length}`);
  
  // --- Analyze block types used ---
  const blockCounts = {};
  const blockSet = new Set();
  for (const v of voxelData) {
    const type = v.type;
    blockCounts[type] = (blockCounts[type] || 0) + 1;
    blockSet.add(type);
  }
  const blockTypes = Array.from(blockSet).sort();
  
  // Log distribution for debugging
  console.log('Block type distribution:');
  for (const type of blockTypes) {
    const count = blockCounts[type];
    const pct = ((count / voxelData.length) * 100).toFixed(1);
    console.log(`  ${type}: ${count} (${pct}%)`);
  }
  
  const spawnPosition = findSpawnPosition(voxelData);
  const colorPalette = generateColorPalette(params);
  
  // Determine which blocks from the palette are actually used
  const usedColors = {};
  for (const type of blockTypes) {
    if (colorPalette[type]) {
      usedColors[type] = colorPalette[type];
    } else {
      console.warn(`Missing color for block type: ${type}`);
    }
  }
  
  // Also include any special materials that might be needed for features
  const materials = {
    colors: colorPalette,        // full palette
    usedBlockTypes: blockTypes,  // list of types present in world
    blockCounts,                 // raw counts per type
  };
  
  return {
    seed,
    voxel_data: voxelData,
    spawnPosition,
    materials,
    structures: [],
    stats: {
      gridSize: GRID_SIZE * BLOCK_SIZE,
      voxelCount: voxelData.length,
      uniqueBlockTypes: blockTypes.length,
      blockTypes,
      blockCounts,
      prompt: prompt.substring(0, 50),
      params,
    }
  };
}

function findSpawnPosition(voxels) {
  // Find topmost block near center
  let spawnVoxel = null;
  
  for (const v of voxels) {
    if (v.isFeature) continue;
    // Check within 5 blocks of center
    if (Math.abs(v.pos[0]) <= 10 && Math.abs(v.pos[2]) <= 10) {
      if (!spawnVoxel || v.height > spawnVoxel.height) {
        spawnVoxel = v;
      }
    }
  }
  
  // Fallback: find any top block
  if (!spawnVoxel) {
    for (const v of voxels) {
      if (v.isFeature || v.height <= 0) continue;
      if (!spawnVoxel || v.height > spawnVoxel.height) {
        spawnVoxel = v;
      }
    }
  }
  
  // Player stands on top of block: block.y + BLOCK_SIZE (block top) + 2 (player eye height)
  const spawnY = spawnVoxel ? spawnVoxel.pos[1] + BLOCK_SIZE + 2 : 4;
  
  return {
    x: spawnVoxel ? spawnVoxel.pos[0] : 0,
    y: spawnY,
    z: spawnVoxel ? spawnVoxel.pos[2] : 0
  };
}

async function generateWorldFromImage(imageUrl) {
  const axios = require('axios');
  const { Jimp } = require('jimp');
  
  const gridSize = GRID_SIZE;
  const blockSize = BLOCK_SIZE;
  
  const image = await Jimp.read(imageUrl);
  image.resize({ w: gridSize, h: gridSize });
  
  const voxels = [];
  const center = (gridSize * blockSize) / 2;
  
  // Track block type usage
  const blockCounts = {};
  
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const pixelColor = image.getPixelColor(x, z);
      // Jimp color format is 0xRRGGBBAA or similar; extract RGB correctly
      const r = (pixelColor >> 24) & 0xFF;
      const g = (pixelColor >> 16) & 0xFF;
      const b = (pixelColor >> 8) & 0xFF;
      const brightness = (r + g + b) / (255 * 3);
      
      const height = Math.floor(brightness * 8) + 2; // ensure min height 2
      const bx = x * blockSize - center;
      const bz = z * blockSize - center;
      
      // Determine block type based on brightness
      let type;
      if (brightness > 0.7) type = 'stone';
      else if (brightness > 0.4) type = 'grass';
      else type = 'water';
      
      // For ground blocks below surface
      for (let y = 0; y <= height; y++) {
        let blockType;
        if (y === height) {
          blockType = type;
        } else if (y >= height - 2) {
          blockType = 'dirt';
        } else {
          blockType = 'stone';
        }
        
        voxels.push({
          pos: [bx, y * blockSize, bz],
          size: [blockSize, blockSize, blockSize],
          type: blockType,
          height: y
        });
        
        blockCounts[blockType] = (blockCounts[blockType] || 0) + 1;
      }
    }
  }
  
  const seed = Date.now();
  const spawnPosition = findSpawnPosition(voxels);
  
  // Build a simple color palette based on the image's dominant colors
  // or use standard defaults
  const colors = {
    grass: '#4a7c3f',
    dirt: '#8b6914',
    stone: '#6a6a6a',
    water: '#1e4d6b',
    sand: '#c9b896', // not used but included for completeness
  };
  
  const blockTypes = Object.keys(blockCounts);
  
  return {
    seed,
    voxel_data: voxels,
    spawnPosition,
    materials: {
      colors,
      usedBlockTypes: blockTypes,
      blockCounts,
    },
    structures: [],
    stats: {
      gridSize: gridSize * blockSize,
      voxelCount: voxels.length,
      uniqueBlockTypes: blockTypes.length,
      blockTypes,
      blockCounts,
      biome: 'custom',
    }
  };
}

module.exports = { generateWorld, generateWorldFromImage, cyrb53, findSpawnPosition };