import { useMemo, useRef, useEffect, useState, useLayoutEffect } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useStore } from '../store';

const BLOCK_SIZE = 2;
const SCAN_RANGE = 4;
const SCAN_RATE = 0.2; // Collider scan update rate
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function Avatar({ player }) {
  const meshRef = useRef();
  const labelRef = useRef();

  useFrame(() => {
    if (!meshRef.current || !labelRef.current) return;
    meshRef.current.position.lerp(new THREE.Vector3(player.x, player.y, player.z), 0.35);
    meshRef.current.rotation.y = player.ry ?? 0;
    labelRef.current.position.copy(meshRef.current.position);
  });

  return (
    <>
      <group ref={meshRef} position={[player.x, player.y, player.z]}>
        <mesh position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.4, 0.8, 4, 8]} />
          <meshStandardMaterial color={player.color || '#fff'} transparent opacity={player.online === false ? 0.3 : 1} />
        </mesh>
        <mesh position={[0, 1.1, -0.4]}>
          <boxGeometry args={[0.6, 0.2, 0.2]} />
          <meshStandardMaterial color="#000" />
        </mesh>
      </group>
      <group ref={labelRef} position={[player.x, player.y, player.z]}>
        <Billboard position={[0, 1.8, 0]}>
          <Text fontSize={0.4} color={player.online === false ? '#aaa' : 'white'} outlineWidth={0.04} outlineColor="black">
            {player.username}{player.online === false ? ' (Offline)' : ''}
          </Text>
        </Billboard>
      </group>
    </>
  );
}

const cyrb53 = (str, seed = 0) => {
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
};

export default function AIWorld() {
  const { worldId, otherPlayers, user, setSpawnPosition: setGlobalSpawn, uiState, debugMode, spawnPosition, setWorldLoading } = useStore();
  const [visionData, setVisionData] = useState(null);
  const [worldMaterials, setWorldMaterials] = useState(null);
  const [loading, setLoading] = useState(true);

  const meshRefs = {
    stone: useRef(), grass: useRef(), lava: useRef(), water: useRef(),
    dirt: useRef(), sand: useRef(), forest: useRef(), leaf: useRef(),
    snow: useRef(), ice: useRef(), voidstone: useRef(), fairygrass: useRef(),
    blackstone: useRef(), magma: useRef(), crystal: useRef(), mushroom: useRef(),
    coal: useRef(), iron: useRef(), gold: useRef(), diamond: useRef(), copper: useRef(),
  };

  // Fetch world data
  useEffect(() => {
    setLoading(true);
    setWorldLoading(true);
    const apiUrl = `${API_URL}/api/world-data/${worldId}`;

    fetch(apiUrl)
      .then(r => r.json())
      .then(data => {
        const voxelArray = data.voxel_data || data.voxels || [];
        setVisionData(voxelArray);
        if (data.spawnPosition) setGlobalSpawn(data.spawnPosition);
        if (data.materials?.colors) {
          setWorldMaterials(data.materials.colors);
        }
      })
      .catch(e => console.error("Vision Genesis failed:", e))
      .finally(() => {
        setLoading(false);
        setWorldLoading(false);
      });
  }, [worldId]);

  const materials = useMemo(() => {
    if (!worldMaterials) return {};

    const mats = {};
    for (const [type, color] of Object.entries(worldMaterials)) {
      const opts = debugMode ? { transparent: true, opacity: 0.6 } : {};
      mats[type] = new THREE.MeshStandardMaterial({ color, ...opts });
    }

    // Small overrides for special blocks (optional – can be removed)
    const overrides = {
      water: { transparent: true, opacity: debugMode ? 0.9 : 0.6 },
      ice: { transparent: true, opacity: debugMode ? 0.9 : 0.85, roughness: 0.2 },
      lava: { emissive: worldMaterials.lava, emissiveIntensity: 2 },
    };

    for (const [type, opts] of Object.entries(overrides)) {
      if (mats[type]) mats[type] = new THREE.MeshStandardMaterial({ color: worldMaterials[type], ...opts });
    }

    return mats;
  }, [worldMaterials, debugMode]);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(2, 2, 2), []);

  // Create uniqueData from visionData
  const uniqueData = useMemo(() => {
    if (!visionData || !Array.isArray(visionData)) return [];
    const keyMap = new Map();
    for (const v of visionData) {
      let type = v.type;
      // fallback for unsupported (if you didn't add all meshes)
      if (!meshRefs[type]) {
        if (type === 'snow') type = 'stone';
        else if (type === 'ice') type = 'stone';
        else if (type === 'voidstone') type = 'stone';
        else if (type === 'fairygrass') type = 'grass';
        else if (type === 'crystal') type = 'diamond';
        else if (type === 'mushroom') type = 'forest';
        else type = 'stone';
      }
      const key = `${v.pos[0]},${v.pos[1]},${v.pos[2]}:${type}`;
      if (!keyMap.has(key)) keyMap.set(key, { ...v, type });
    }
    return Array.from(keyMap.values());
  }, [visionData, debugMode]);

  // Count block types (depends on uniqueData)
  const blockCounts = useMemo(() => {
    if (!uniqueData.length) return {};
    const counts = {};
    for (const v of uniqueData) {
      counts[v.type] = (counts[v.type] || 0) + 1;
    }
    return counts;
  }, [uniqueData, debugMode]);

  // instanceArgs (depends on materials and blockCounts)
  const instanceArgs = useMemo(() => {
    const getCount = (type) => Math.max(blockCounts[type] || 0, 100);
    const args = {};
    for (const type of Object.keys(materials)) {
      args[type] = [boxGeo, materials[type], getCount(type)];
    }
    return args;
  }, [boxGeo, materials, blockCounts, debugMode]);

  const visionDataRef = useRef(null);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });

  // Track player position for collider selection (throttled + instant on spawn)
  const lastUpdate = useRef(0);
  const forceUpdate = useRef(0);

  // Instant update on spawn position change
  useEffect(() => {
    if (spawnPosition) {
      setPlayerPos(spawnPosition);
    }
  }, [spawnPosition]);

  useFrame((state) => {
    const now = state.clock.getElapsedTime();
    if (window.playerPos && now - lastUpdate.current > SCAN_RATE) {
      setPlayerPos(window.playerPos);
      lastUpdate.current = now;
    }
  });

  // Find collidable blocks: ground (jump/fall) and walls
  // Single pass optimization: filter blocks by scan range once, use blockLookup for O(1) neighbor checks
  const topBlocks = useMemo(() => {
    if (!visionData || !Array.isArray(visionData)) return [];

    const pos = window.playerPos || { x: 0, y: 0, z: 0 };
    const radius = SCAN_RANGE * 2 + 1; // XZ radius matches debug visual (16x16)
    const yRange = SCAN_RANGE * 2 + 1; // Use same range for Y consistency
    const playerFeetY = pos.y - 1;

    // Single pass: build blockLookup AND collect blocks in scan range
    const blockLookup = new Map();
    const blocksInRange = []; // Only blocks within scan range (avoid re-filtering)
    const blocksByXZ = new Map();

    for (const b of visionData) {
      const [x, y, z] = b.pos;
      const key = `${x},${y},${z}`;
      blockLookup.set(key, b);

      // Filter once - skip blocks outside XZ or Y range
      if (Math.abs(x - pos.x) >= radius - 1 || Math.abs(z - pos.z) >= radius - 1) continue;
      if (y >= playerFeetY + yRange || y < playerFeetY - yRange) continue;

      blocksInRange.push(b);

      const xzKey = `${x},${z}`;
      if (!blocksByXZ.has(xzKey)) blocksByXZ.set(xzKey, new Set());
      blocksByXZ.get(xzKey).add(y);
    }

    // Find max Y in scan range for jump collider exclusion
    let maxYInRange = -Infinity;
    for (const ySet of blocksByXZ.values()) {
      for (const y of ySet) {
        if (y > maxYInRange) maxYInRange = y;
      }
    }

    // Process blocks in range: find jump/fall colliders, then walls/floors (single iteration)
    const results = [];
    const wallResults = [];
    const processedFloors = new Set(); // Track floors to avoid duplicates

    for (const b of blocksInRange) {
      const [x, y, z] = b.pos;
      const xzKey = `${x},${z}`;
      const ySet = blocksByXZ.get(xzKey);
      if (!ySet) continue;

      const sortedY = Array.from(ySet).sort((a, b) => b - a);

      // Jump: block above player feet with no block immediately above
      const jumpCandidates = sortedY.slice(0, -1).filter(yc => {
        if (yc <= playerFeetY) return false;
        return !ySet.has(yc + BLOCK_SIZE);
      }).filter(yc => yc < maxYInRange);

      // Fall: block at or below player feet with nothing above
      const fallCandidates = sortedY.filter(yc => {
        if (yc > playerFeetY) return false;
        return !ySet.has(yc + BLOCK_SIZE);
      });

      // Find closest jump above and fall below
      let jumpY = null, fallY = null;
      for (const yc of jumpCandidates) {
        if (jumpY === null || yc < jumpY) jumpY = yc;
      }
      for (const yc of fallCandidates) {
        if (fallY === null || yc > fallY) fallY = yc;
      }

      // Add jump/fall colliders
      if (jumpY !== null) results.push({ ...blockLookup.get(`${x},${jumpY},${z}`), colliderType: 'jump' });
      if (fallY !== null) results.push({ ...blockLookup.get(`${x},${fallY},${z}`), colliderType: 'fall' });

      // Wall detection: check neighbors at same Y level
      const directions = [
        { dx: 2, dz: 0, name: 'east' },
        { dx: -2, dz: 0, name: 'west' },
        { dx: 0, dz: 2, name: 'north' },
        { dx: 0, dz: -2, name: 'south' },
      ];

      const inset = 0.09;
      for (const { dx, dz, name } of directions) {
        const nx = x + dx;
        const nz = z + dz;

        if (Math.abs(nx - pos.x) > radius - 1 || Math.abs(nz - pos.z) > radius - 1) continue;

        // Wall: no neighbor at same Y
        if (!blockLookup.has(`${nx},${y},${nz}`)) {
          const wallX = x + dx / 2 + (dx > 0 ? -inset : dx < 0 ? inset : 0);
          const wallZ = z + dz / 2 + (dz > 0 ? -inset : dz < 0 ? inset : 0);
          const isNS = name === 'north' || name === 'south';
          wallResults.push({
            pos: [wallX, y, wallZ],
            wallY: y + 1,
            wallArgs: isNS ? [1, 1, 0.1] : [0.1, 1, 1],
            wallNS: isNS,
            colliderType: 'wall',
          });
        }

        // Floor: check once per block (not per direction) using Set to dedupe
        const floorKey = `${x},${z},${y}`;
        if (!processedFloors.has(floorKey)) {
          processedFloors.add(floorKey);
          const belowY = y - BLOCK_SIZE;
          if (!blockLookup.has(`${x},${belowY},${z}`)) {
            wallResults.push({
              pos: [x, belowY, z],
              wallY: belowY + BLOCK_SIZE + inset,
              wallArgs: [1, 0.1, 1],
              wallNS: false,
              colliderType: 'floor',
            });
          }
        }
      }
    }

    return [...results, ...wallResults];
  }, [visionData, playerPos, debugMode]);

  useLayoutEffect(() => {
    if (!uniqueData.length) return;

    // Compute counts per type
    const counts = {};
    for (const v of uniqueData) {
      counts[v.type] = (counts[v.type] || 0) + 1;
    }

    // For each mesh ref, ensure instance count matches needed count
    Object.entries(meshRefs).forEach(([type, ref]) => {
      const mesh = ref.current;
      if (!mesh) return;

      const needed = counts[type] || 0;
      if (needed === 0) {
        mesh.count = 0;
        mesh.instanceMatrix.needsUpdate = true;
        return;
      }

      // Expand instance buffer if needed (R3F handles this automatically, but we can set count)
      mesh.count = needed;

      const tempMatrix = new THREE.Matrix4();
      let idx = 0;

      for (const v of uniqueData) {
        if (v.type !== type) continue;

        const size = v.size || [BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE];
        const sx = size[0] / 2;
        const sy = size[1] / 2;
        const sz = size[2] / 2;

        tempMatrix.makeTranslation(v.pos[0], v.pos[1] + size[1] / 2, v.pos[2]);
        tempMatrix.scale(new THREE.Vector3(sx, sy, sz));

        mesh.setMatrixAt(idx, tempMatrix);
        idx++;
      }

      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [uniqueData, debugMode]);

  if (!visionData) return null;

  // Only render colliders when in game
  const showColliders = uiState === 'game' && visionData;

  return (
    <group>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} color="#fff5e0" />

      {/* Debug: scan area - 16x16 centered on player */}
      {debugMode && (
        <group>
          <mesh position={[playerPos.x, playerPos.y + 1, playerPos.z]}>
            <boxGeometry args={[SCAN_RANGE*2, SCAN_RANGE*2, SCAN_RANGE*2]} />
            <meshBasicMaterial color="magenta" wireframe transparent opacity={0.8} />
          </mesh>
          <mesh position={[playerPos.x, playerPos.y + 1, playerPos.z]}>
            <boxGeometry args={[SCAN_RANGE*2, SCAN_RANGE*2, SCAN_RANGE*2]} />
            <meshBasicMaterial color="magenta" transparent opacity={0.1} />
          </mesh>
        </group>
      )}

      {otherPlayers.filter(p => !user || p.id !== user.id).map((p) => (
        <Avatar key={p.id} player={p} />
      ))}

      {Object.keys(meshRefs).map(type => (
        <instancedMesh
          key={`${type}-${debugMode}`}
          ref={meshRefs[type]}
          args={instanceArgs[type] || [boxGeo, materials.stone, 100]}
          frustumCulled={false}
        />
      ))}

      {showColliders && (
        <>
          <RigidBody type="fixed">
            <CuboidCollider args={[250, 2, 250]} position={[0, -2, 0]} />
          </RigidBody>

{/* Block colliders - jump (blue), fall (red), wall/floor (yellow) */}
          {topBlocks.map((v, i) => {
            const isWall = v.colliderType === 'wall';
            const isFloor = v.colliderType === 'floor';
            const px = isWall || isFloor ? v.pos[0] : v.pos[0];
            const pz = isWall || isFloor ? v.pos[2] : v.pos[2];
            const py = isWall ? v.wallY : isFloor ? v.wallY : v.pos[1] + 1.9 + 0.01;
            // Round ALL positions in key to ensure proper reconciliation
            const calcPy = isWall ? v.wallY : isFloor ? v.wallY : v.pos[1] + 1.9 + 0.01;
            const key = `col-${Math.round(px * 10)}-${Math.round(calcPy * 10)}-${Math.round(pz * 10)}-${v.colliderType}-${i}`;
            const isJump = v.colliderType === 'jump';
            const isFall = v.colliderType === 'fall';
            const color = isWall || isFloor ? 'yellow' : isJump ? 'blue' : 'red';
            const args = isWall || isFloor ? v.wallArgs : [1, 0.1, 1];
            return (
              <RigidBody key={key} type="fixed" position={[px, py, pz]}>
                <CuboidCollider args={args} />
                {debugMode && (
                  <mesh position={[0, 0, 0]} frustumCulled={false}>
                    <boxGeometry args={isFloor ? [1.8, 0.2, 1.8] : isWall ? (v.wallNS ? [1.8, 1.8, 0.2] : [0.2, 1.8, 1.8]) : [1.8, 0.2, 1.8]} />
                    <meshBasicMaterial color={color} transparent opacity={0.9} />
                  </mesh>
                )}
              </RigidBody>
            );
          })}
        </>
      )}
    </group>
  );
}