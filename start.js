const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const dockerPathWindows = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';

function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

async function startDocker() {
  console.log("🐳 Docker engine is not responding. Attempting to start Docker Desktop...");
  
  if (fs.existsSync(dockerPathWindows)) {
    // Start it detached
    const dockerProcess = spawn(dockerPathWindows, [], {
      detached: true,
      stdio: 'ignore'
    });
    dockerProcess.unref();

    console.log("⏳ Waiting for Docker Engine to boot (this usually takes 10-30 seconds)...");
    
    // Poll until docker info succeeds
    while (!isDockerRunning()) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.log("✅ Docker Engine is now running!");
  } else {
    console.error("❌ Could not find Docker Desktop at " + dockerPathWindows);
    console.error("Please start Docker manually and try again.");
    process.exit(1);
  }
}

async function run() {
  if (!isDockerRunning()) {
    await startDocker();
  }

  console.log("🚀 Booting up the Virtual World environment...");
  
  try {
    // Start database
    console.log("📦 Starting PostgreSQL...");
    execSync('docker-compose up -d', { stdio: 'inherit' });

    // Start frontend and backend concurrently
    console.log("🌐 Starting Frontend and Backend...");
    
    // Since concurrently is locally installed via package.json, we can use npx
    const concurrent = spawn('npx', [
      'concurrently',
      '--kill-others',
      '"npm run start --prefix backend"',
      '"npm run dev --prefix frontend"'
    ], { stdio: 'inherit', shell: true });

    concurrent.on('close', (code) => {
      console.log(`Processes exited with code ${code}`);
    });

  } catch (err) {
    console.error("❌ Failed to start services:", err.message);
  }
}

run();
