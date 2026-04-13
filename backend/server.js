const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { pool, initializeDatabase } = require('./db');
const { generateWorld, generateWorldFromImage, findSpawnPosition } = require('./worldGenerator');

// Input validation helpers
const isValidUsername = (username) => {
  return typeof username === 'string' && username.length >= 3 && username.length <= 30 && /^[a-zA-Z0-9_]+$/.test(username);
};

const isValidPassword = (password) => {
  return typeof password === 'string' && password.length >= 4;
};

const isValidWorldId = (worldId) => {
  return typeof worldId === 'string' && worldId.length > 0 && worldId.length <= 100 && /^[\w\s\-]+$/.test(worldId);
};

const isValidImageUrl = (url) => {
  if (typeof url !== 'string' || url.length > 2000) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && /\.(png|jpg|jpeg|bmp|gif|tiff?)$/i.test(url);
  } catch {
    return false;
  }
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

// Initialize the database table
initializeDatabase();

// In-memory state of online players
// player socket_id -> { id, username, x, y, z, color, world_id }
const onlinePlayers = {};

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // { id, username }
    next();
  });
};

// Colors for character default
const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50'];

// AUTH ROUTES
app.post('/api/register', async (req, res) => {
  const { username, password, world_id } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }
  
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-30 characters, alphanumeric + underscores only' });
  }
  
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  
  if (world_id && !isValidWorldId(world_id)) {
    return res.status(400).json({ error: 'Invalid world ID format' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const targetWorld = world_id || 'Lobby';
    const result = await pool.query(
      'INSERT INTO users (username, password, x, y, z, world_id, color) VALUES ($1, $2, 0, 5, 0, $3, $4) RETURNING id, username, x, y, z, world_id, color',
      [username, hashedPassword, targetWorld, color]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
    res.status(201).json({ token, user: { id: user.id, username: user.username, x: user.x, y: user.y, z: user.z, world_id: user.world_id, color: user.color } });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password, world_id } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }
  
  if (world_id && !isValidWorldId(world_id)) {
    return res.status(400).json({ error: 'Invalid world ID format' });
  }
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // If a specific world was chosen in the menu, update the user's world in the DB
    if (world_id) {
      await pool.query('UPDATE users SET world_id = $1 WHERE id = $2', [world_id, user.id]);
      user.world_id = world_id;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, x: user.x, y: user.y, z: user.z, world_id: user.world_id, color: user.color } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/user', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

    // Also disconnect them from sockets if they are active
    for (let socketId in onlinePlayers) {
      if (onlinePlayers[socketId].id === req.user.id) {
        io.to(socketId).emit('account_deleted', req.user.id);
        // Let others know this user disappeared completely
        io.emit('account_deleted', req.user.id);
        delete onlinePlayers[socketId];
      }
    }

    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Retrieves ALL users (to display offline avatars as statues, and merge with online players on frontend)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, x, y, z, color, world_id FROM users');
    const onlineIds = new Set(Object.values(onlinePlayers).map(p => p.id));

    const users = result.rows.map(user => ({
      ...user,
      online: onlineIds.has(user.id)
    }));

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET active worlds (worlds with at least one inhabitant)
app.get('/api/worlds', async (req, res) => {
  try {
    const result = await pool.query('SELECT world_id, COUNT(*) as count FROM users GROUP BY world_id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET cached worlds
app.get('/api/cached-worlds', async (req, res) => {
  try {
    const result = await pool.query('SELECT world_id, seed, created_at, expires_at FROM worlds ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE all cached worlds (must be before parameterized route)
app.delete('/api/cached-worlds', async (req, res) => {
  try {
    await pool.query('DELETE FROM worlds');
    res.json({ message: 'All cached worlds deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE a cached world
app.delete('/api/cached-worlds/:worldId', async (req, res) => {
  const { worldId } = req.params;
  console.log('[DELETE] Cached world:', worldId);
  try {
    await pool.query('DELETE FROM worlds WHERE world_id = $1', [worldId]);
    res.json({ message: 'World deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WEBSOCKETS
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User authenticates the socket connection
  socket.on('join_game', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      const result = await pool.query('SELECT id, username, x, y, z, color, world_id FROM users WHERE id = $1', [decoded.id]);
      if (result.rows.length === 0) return;

      const user = result.rows[0];
      const worldId = user.world_id || 'Lobby';

      // Join the world room
      socket.join(worldId);

      onlinePlayers[socket.id] = { ...user, world_id: worldId, ry: 0 };

      // Let others in same world know a player joined
      socket.to(worldId).emit('player_connected', { ...user, online: true });
    } catch (err) {
      console.log('Invalid token on socket join');
    }
  });

  socket.on('move_world', async (data) => {
    // data = { worldId }
    const p = onlinePlayers[socket.id];
    if (!p || !data.worldId) return;

    console.log(`${p.username} moving to world: ${data.worldId}`);

    // Leave old room
    socket.leave(p.world_id);
    // Tell old room I'm gone
    socket.to(p.world_id).emit('player_disconnected', p.id);

    // Join new room
    p.world_id = data.worldId;
    socket.join(p.world_id);

    // Reset position to center for the new world
    p.x = 0; p.y = 5; p.z = 0;

    // Update DB
    try {
      await pool.query('UPDATE users SET world_id = $1, x = 0, y = 5, z = 0 WHERE id = $2', [p.world_id, p.id]);
    } catch (err) {
      console.error('Error updating world in DB:', err);
    }

    // Tell new room I'm here
    socket.to(p.world_id).emit('player_connected', { ...p, online: true });
    // Tell the sender themselves to refresh statues etc if needed
    socket.emit('world_changed', p.world_id);
  });

  socket.on('player_move', (data) => {
    const p = onlinePlayers[socket.id];
    if (p) {
      p.x = data.x; p.y = data.y; p.z = data.z;
      if (data.ry !== undefined) p.ry = data.ry;

      // Broadcast only to people in the same world
      socket.to(p.world_id).emit('player_moved', p);
    }
  });

  socket.on('logout', async () => {
    const player = onlinePlayers[socket.id];
    if (player) {
      console.log(`User logged out: ${player.username}`);
      try {
        await pool.query('UPDATE users SET x = $1, y = $2, z = $3, world_id = $4 WHERE id = $5', [
          player.x, player.y, player.z, player.world_id, player.id
        ]);
        io.to(player.world_id).emit('player_disconnected', player.id);
      } catch (err) {
        console.error('Error saving player state on logout:', err);
      }
      socket.leave(player.world_id);
      delete onlinePlayers[socket.id];
    }
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    const player = onlinePlayers[socket.id];
    if (player) {
      try {
        await pool.query('UPDATE users SET x = $1, y = $2, z = $3, world_id = $4 WHERE id = $5', [
          player.x, player.y, player.z, player.world_id, player.id
        ]);
        io.to(player.world_id).emit('player_disconnected', player.id);
      } catch (err) {
        console.error('Error saving player state on disconnect:', err);
      }
      delete onlinePlayers[socket.id];
    }
  });
});

// Helper: safely parse JSON fields from DB
const parseJsonField = (field) => {
  if (!field) return null;
  return typeof field === 'string' ? JSON.parse(field) : field;
};

// GET world data (cached or generated)
app.get('/api/world-data/:worldId', async (req, res) => {
  const { worldId } = req.params;

  if (!isValidWorldId(worldId)) {
    return res.status(400).json({ error: 'Invalid world ID format' });
  }

  // Set a timeout to prevent hanging requests
  const timeout = setTimeout(() => {
    console.error(`[World] Request timeout for: ${worldId}`);
    if (!res.headersSent) {
      res.status(504).json({ error: 'World generation timeout' });
    }
  }, 30000); // 30 seconds

  try {
    console.log(`[World] Request for: ${worldId}`);

    // 1. Check cache
    console.log(`[World] Checking cache for: ${worldId}`);
    const cached = await pool.query(
      'SELECT voxel_data, materials, structures, stats FROM worlds WHERE world_id = $1',
      [worldId]
    );
    console.log(`[World] Cache query complete, rows: ${cached.rows.length}`);

    if (cached.rows.length > 0) {
      const row = cached.rows[0];
      const voxelData = parseJsonField(row.voxel_data) || [];
      const materials = parseJsonField(row.materials) || {};
      const structures = parseJsonField(row.structures) || [];
      const stats = parseJsonField(row.stats) || {};
      const spawnPosition = findSpawnPosition(voxelData);

      clearTimeout(timeout);
      return res.json({
        voxel_data: voxelData,
        materials,
        structures,
        stats,
        spawnPosition,
        cached: true,
      });
    }

    // 2. Generate new world
    console.log(`[World] Generating new world for: ${worldId}`);
    const generated = await generateWorld(worldId);
    console.log(`[World] Generation complete for: ${worldId}`);

    // Validate generated object
    if (!generated || typeof generated !== 'object') {
      throw new Error('World generation returned invalid data');
    }

    const voxelData = Array.isArray(generated.voxel_data) ? generated.voxel_data : [];
    const materials = generated.materials || {};
    const structures = Array.isArray(generated.structures) ? generated.structures : [];
    const stats = generated.stats || {};
    const spawnPosition = generated.spawnPosition || findSpawnPosition(voxelData);

    console.log(`[World] Generated ${voxelData.length} voxels, seed: ${generated.seed}`);

    // 3. Store in database
    console.log(`[World] Saving to database: ${worldId}`);
    await pool.query(
      `INSERT INTO worlds (world_id, seed, voxel_data, materials, structures, stats)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        worldId,
        generated.seed,
        JSON.stringify(voxelData),
        JSON.stringify(materials),
        JSON.stringify(structures),
        JSON.stringify(stats),
      ]
    );
    console.log(`[World] Saved to database: ${worldId}`);

    clearTimeout(timeout);
    res.json({
      voxel_data: voxelData,
      materials,
      structures,
      stats,
      spawnPosition,
      cached: false,
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('[World] Generation error:', err.stack || err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to generate world',
        details: err.message,
      });
    }
  }
});

// POST generate world from image
app.post('/api/world-from-image', async (req, res) => {
  const { worldId, imageUrl } = req.body;

  if (!worldId || !imageUrl) {
    return res.status(400).json({ error: 'Missing worldId or imageUrl' });
  }

  if (!isValidWorldId(worldId)) {
    return res.status(400).json({ error: 'Invalid world ID format' });
  }

  if (!isValidImageUrl(imageUrl)) {
    return res.status(400).json({ error: 'Invalid image URL. Must be HTTP/HTTPS and end in .png, .jpg, .jpeg, .bmp, .gif, or .tiff' });
  }

  // Set a timeout to prevent hanging requests
  const timeout = setTimeout(() => {
    console.error(`[World] Image request timeout for: ${worldId}`);
    if (!res.headersSent) {
      res.status(504).json({ error: 'Image processing timeout' });
    }
  }, 30000); // 30 seconds

  try {
    console.log(`[World] Image generation request for: ${worldId}`);
    console.log(`[World] Image URL: ${imageUrl}`);

    const generated = await generateWorldFromImage(imageUrl);
    console.log(`[World] Image generation complete for: ${worldId}`);

    const voxelData = Array.isArray(generated.voxel_data) ? generated.voxel_data : [];
    const materials = generated.materials || {};
    const structures = Array.isArray(generated.structures) ? generated.structures : [];
    const stats = generated.stats || {};
    const spawnPosition = generated.spawnPosition || findSpawnPosition(voxelData);

    console.log(`[World] Image generated ${voxelData.length} voxels`);
    if (stats.blockTypes) {
      console.log(`[World] Block types used: ${stats.blockTypes.join(', ')}`);
    }

    // Upsert to database
    console.log(`[World] Saving image world to database: ${worldId}`);
    await pool.query(
      `INSERT INTO worlds (world_id, seed, voxel_data, materials, structures, stats)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (world_id) DO UPDATE SET
         seed = EXCLUDED.seed,
         voxel_data = EXCLUDED.voxel_data,
         materials = EXCLUDED.materials,
         structures = EXCLUDED.structures,
         stats = EXCLUDED.stats`,
      [
        worldId,
        generated.seed,
        JSON.stringify(voxelData),
        JSON.stringify(materials),
        JSON.stringify(structures),
        JSON.stringify(stats),
      ]
    );
    console.log(`[World] Saved image world to database: ${worldId}`);

    clearTimeout(timeout);
    res.json({
      voxel_data: voxelData,
      materials,
      structures,
      stats,
      spawnPosition,
      image: generated.image || null,
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('[World] Image processing error:', err.stack || err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to process image',
        details: err.message,
      });
    }
  }
});

// Clean up expired world caches
const cleanupExpiredWorlds = async () => {
  try {
    const result = await pool.query('DELETE FROM worlds WHERE expires_at < NOW() RETURNING world_id');
    if (result.rowCount > 0) {
      console.log(`[Cache] Cleaned up ${result.rowCount} expired worlds`);
    }
  } catch (err) {
    console.error('[Cache] Error cleaning up expired worlds:', err);
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredWorlds, 5 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
