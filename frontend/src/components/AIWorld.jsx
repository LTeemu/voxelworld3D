import { useMemo, useRef, useEffect, useState, useLayoutEffect } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useStore } from '../store';

const BLOCK_SIZE = 2;
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
    if (window.playerPos && now - lastUpdate.current > 0.3) { // update every 0.3 seconds
      setPlayerPos(window.playerPos);
      lastUpdate.current = now;
    }
  });

  // Find collidable blocks: 2 per x,z - one for jumping onto (closest above player),
  // one for falling onto (closest below player)
  // Optimized with spatial lookup Map for O(1) lookups instead of O(n) find
  const topBlocks = useMemo(() => {
    if (!visionData || !Array.isArray(visionData)) return [];

    const pos = window.playerPos || { x: 0, y: 0, z: 0 };
    const radius = 7;
    const colliderRadius = radius - 1;

    // Build spatial lookup: key "x,z,y" -> block
    const blockLookup = new Map();
    for (const b of visionData) {
      const key = `${b.pos[0]},${b.pos[1]},${b.pos[2]}`;
      blockLookup.set(key, b);
    }

    // First pass: collect unique block y positions per x,z
    const blocksByXZ = new Map();
    for (const b of visionData) {
      const x = b.pos[0];
      const z = b.pos[2];
      if (Math.abs(x - pos.x) > radius || Math.abs(z - pos.z) > radius) continue;
      if (b.pos[1] > pos.y + 3) continue;

      const key = `${x},${z}`;
      if (!blocksByXZ.has(key)) blocksByXZ.set(key, new Set());
      blocksByXZ.get(key).add(b.pos[1]);
    }

    // Find max y in entire scan range (to exclude highest blocks)
    const maxYInRange = Math.max(...Array.from(blocksByXZ).flatMap(([k, ys]) => Array.from(ys)));

    // Second pass: find 2 colliders per x,z
    const results = [];
    for (const [key, ySet] of blocksByXZ) {
      const [x, z] = key.split(',').map(Number);
      // Skip outer edge - can't know about blocks above outside scan range
      if (Math.abs(x - pos.x) >= colliderRadius - 1 || Math.abs(z - pos.z) >= colliderRadius - 1) continue;

      const sortedY = Array.from(ySet).sort((a, b) => b - a); // descending

      // Skip if not enough blocks to check (at least 2 needed to know if highest has block above)
      if (sortedY.length < 2) continue;

      const playerFeetY = pos.y - 1; // approximate player feet position

      // For jump: block above player feet with no block immediately above, and not the highest in scan range
      const jumpCandidates = sortedY.slice(0, -1).filter(y => {
        if (y <= playerFeetY) return false;
        if (!sortedY.includes(y + BLOCK_SIZE)) return true;
        return false;
      }).filter(y => y < maxYInRange); // Exclude blocks at absolute max Y in scan range
      const fallCandidates = sortedY.filter(y => {
        if (y > playerFeetY) return false;
        if (!sortedY.includes(y + BLOCK_SIZE)) return true;
        return false;
      });

      let jumpY = null, fallY = null;

      // Jump: closest candidate above player feet
      for (const y of jumpCandidates) {
        if (y > playerFeetY && (jumpY === null || y < jumpY)) jumpY = y;
      }

      // Fall: closest block at or below player feet
      for (const y of fallCandidates) {
        if (fallY === null || y > fallY) fallY = y;
      }

      // O(1) lookup instead of O(n) find
      if (jumpY !== null) {
        const block = blockLookup.get(`${x},${jumpY},${z}`);
        if (block) results.push({ ...block, colliderType: 'jump' });
      }
      if (fallY !== null) {
        const block = blockLookup.get(`${x},${fallY},${z}`);
        if (block) results.push({ ...block, colliderType: 'fall' });
      }
    }

    return results;
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

      {/* Debug: scan area */}
      {debugMode && (
        <mesh position={[playerPos.x, playerPos.y, playerPos.z]}>
          <boxGeometry args={[12, 12, 12]} />
          <meshBasicMaterial color="yellow" wireframe transparent opacity={0.3} />
        </mesh>
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

          {/* Block colliders - jump (blue) and fall (red) */}
          {topBlocks.map((v, i) => {
const px = v.pos[0];
            const pz = v.pos[2];
            const py = v.pos[1] + 1.9 + 0.01; // block bottom + full block height (2) - collider half-height (0.1) + tiny offset
            const key = `col-${px}-${v.pos[1]}-${pz}`;
            const isJump = v.colliderType === 'jump';
            const color = isJump ? 'blue' : 'red';
            return (
              <RigidBody key={key} type="fixed" position={[px, py, pz]}>
                <CuboidCollider args={[1, 0.1, 1]} />
                {debugMode && (
                  <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[1.8, 0.2, 1.8]} />
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