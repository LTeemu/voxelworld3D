const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

async function processBlueprint(imagePath, outputJsonPath) {
  try {
    const image = await Jimp.read(imagePath);
    // Resize to a manageable grid (Jimp v1+ use object arg)
    image.resize({ w: 64, h: 64 });

    const voxels = [];
    const gridSize = 64;
    const heightScale = 12; // Max height

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const idx = (z * gridSize + x) * 4;
        const r = image.bitmap.data[idx] / 255;
        const g = image.bitmap.data[idx + 1] / 255;
        const b = image.bitmap.data[idx + 2] / 255;
        
        // Convert RGB to HSL for better semantic matching
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
          h = s = 0; // achromatic
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }

        const height = Math.floor(l * heightScale);
        const hueDegrees = h * 360;

        // Semantic Material Mapping
        let type = 'stone';
        if (s < 0.2) type = 'stone'; // Desaturated = stone/foundation
        else if (hueDegrees > 80 && hueDegrees < 160) type = 'grass'; // Green
        else if (hueDegrees > 330 || hueDegrees < 30) type = 'lava'; // Red/Orange
        else if (hueDegrees > 180 && hueDegrees < 260) type = 'water'; // Blue
        else type = 'dirt';

        // Dark pixels = Hollow interiors (if they are within high walls)
        if (l < 0.1) continue;

        // Generate columns of blocks
        for (let y = 0; y <= height; y++) {
          voxels.push({
            pos: [x - gridSize / 2, y, z - gridSize / 2],
            type: y === height ? type : 'stone' // Top is specific, bottom is stone
          });
        }
      }
    }

    fs.writeFileSync(outputJsonPath, JSON.stringify(voxels));
    console.log(`Successfully generated ${voxels.length} voxels to ${outputJsonPath}`);
  } catch (err) {
    console.error("Failed to process blueprint:", err);
  }
}

// CLI usage: node visionProcessor.js <imagePath> <outputPath>
const args = process.argv.slice(2);
if (args.length >= 2) {
  processBlueprint(args[0], args[1]);
}

module.exports = { processBlueprint };
