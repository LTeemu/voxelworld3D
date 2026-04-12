const { generateWorld } = require('./worldGenerator');

// Test different prompts to see if they generate different worlds
const testPrompts = [
  'Lava Kingdom',
  'Frozen Ice World',
  'Desert Oasis',
  'Green Forest',
  'Mountain Peak',
  'Swamp Land'
];

console.log('Testing world generation with different prompts...\n');

testPrompts.forEach((prompt, index) => {
  console.log(`=== Test ${index + 1}: "${prompt}" ===`);
  const world = generateWorld(prompt);
  console.log(`Seed: ${world.seed}`);
  console.log(`Biome: ${world.stats.biome}`);
  console.log(`Voxels: ${world.stats.voxelCount}`);
  console.log(`Prompt hash: ${world.stats.prompt}`);
  console.log('');
});