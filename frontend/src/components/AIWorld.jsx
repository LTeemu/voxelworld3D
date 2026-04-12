import React, { useMemo, useRef, useEffect, useState, useLayoutEffect } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useStore } from '../store';

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
  const { worldId, otherPlayers, user, setSpawnPosition: setGlobalSpawn, uiState, debugMode, spawnPosition } = useStore();
  const [visionData, setVisionData] = useState(null);
  const [worldMaterials, setWorldMaterials] = useState(null);

  const meshRefs = {
    stone: useRef(), grass: useRef(), lava: useRef(), water: useRef(),
    dirt: useRef(), sand: useRef(), forest: useRef(), leaf: useRef(),
    snow: useRef(), ice: useRef(), voidstone: useRef(), fairygrass: useRef(),
    blackstone: useRef(), magma: useRef(), crystal: useRef(), mushroom: useRef(),
    coal: useRef(), iron: useRef(), gold: useRef(), diamond: useRef(), copper: useRef(),
  };

  // Fetch world data
  useEffect(() => {
    const apiUrl = `${window.location.protocol}//${window.location.hostname}:3001/api/world-data/${worldId}`;

    fetch(apiUrl)
      .then(r => r.json())
      .then(data => {
        const voxelArray = data.voxel_data || data.voxels || [];
        setVisionData(voxelArray);
        if (data.spawnPosition) setGlobalSpawn(data.spawnPosition);
        // Store the material colors
        if (data.materials?.colors) {
          setWorldMaterials(data.materials.colors);
        }
      })
      .catch(e => console.error("Vision Genesis failed:", e));
  }, [worldId]);

  const materials = useMemo(() => {
    if (!worldMaterials) return {};

    const mats = {};
    for (const [type, color] of Object.entries(worldMaterials)) {
      // No fallback – backend must provide all colors
      mats[type] = new THREE.MeshStandardMaterial({ color });
    }

    // Small overrides for special blocks (optional – can be removed)
    const overrides = {
      water: { transparent: true, opacity: 0.6 },
      ice: { transparent: true, opacity: 0.85, roughness: 0.2 },
      lava: { emissive: worldMaterials.lava, emissiveIntensity: 2 },
    };

    for (const [type, opts] of Object.entries(overrides)) {
      if (mats[type]) mats[type] = new THREE.MeshStandardMaterial({ color: worldMaterials[type], ...opts });
    }

    return mats;
  }, [worldMaterials]);

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
  }, [visionData]);

  // Count block types (depends on uniqueData)
  const blockCounts = useMemo(() => {
    if (!uniqueData.length) return {};
    const counts = {};
    for (const v of uniqueData) {
      counts[v.type] = (counts[v.type] || 0) + 1;
    }
    return counts;
  }, [uniqueData]);

  // instanceArgs (depends on materials and blockCounts)
  const instanceArgs = useMemo(() => {
    const getCount = (type) => Math.max(blockCounts[type] || 0, 100);
    const args = {};
    for (const type of Object.keys(materials)) {
      args[type] = [boxGeo, materials[type], getCount(type)];
    }
    return args;
  }, [boxGeo, materials, blockCounts]);

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
    if (window.playerPos && now - lastUpdate.current > 0.5) { // update every 0.5 seconds
      setPlayerPos(window.playerPos);
      lastUpdate.current = now;
    }
  });

  // Simple: 15x15 all blocks with nothing above
  const topBlocks = useMemo(() => {
    if (!visionData || !Array.isArray(visionData)) return [];

    const pos = window.playerPos || { x: 0, y: 0, z: 0 };
    const radius = 7;
    const blockSet = new Set(visionData.map(b => `${b.pos[0]},${b.pos[1]},${b.pos[2]}`));

    // Find all blocks in range with nothing above
    const candidates = visionData.filter(v => {
      if (Math.abs(v.pos[0] - pos.x) > radius) return false;
      if (Math.abs(v.pos[2] - pos.z) > radius) return false;
      // No block above
      return !blockSet.has(`${v.pos[0]},${v.pos[1] + 1},${v.pos[2]}`);
    });

    /*
    if (debugMode && candidates.length > 0) {
      console.log(`Player: (${pos.x.toFixed(0)},${pos.y.toFixed(0)},${pos.z.toFixed(0)}) | First: (${candidates[0].pos[0]},${candidates[0].pos[1]},${candidates[0].pos[2]}) type=${candidates[0].type} | Count: ${candidates.length}`);
    }
    */

    return candidates;
  }, [visionData, playerPos, debugMode]);

  // Pre-compute collider positions correctly using array variables
  const colliderPositions = React.useMemo(() => {
    if (!uniqueData || uniqueData.length === 0) return [];
    const positions = [];
    for (let i = 0; i < uniqueData.length; i++) {
      const v = uniqueData[i];
      const x = v.pos[0];
      const y = v.pos[1] + 1;
      const z = v.pos[2];
      positions.push(x, y, z);
    }
    return positions;
  }, [uniqueData]);

  // Replace the old useEffect with this
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
  }, [uniqueData]);

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
          key={type}
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

          {/* Block colliders */}
          {topBlocks.map((v, i) => {
            const px = v.pos[0];
            const py = v.pos[1] + 1.9;
            const pz = v.pos[2];
            const key = `col-${px}-${v.pos[1]}-${pz}-${i}`;
            return (
              <RigidBody key={key} type="fixed" position={[px, py, pz]}>
                <CuboidCollider args={[1, 0.1, 1]} />
                {debugMode && (
                  <mesh position={[0, 0.1, 0]}>
                    <boxGeometry args={[1.8, 0.1, 1.8]} />
                    <meshBasicMaterial color="red" transparent opacity={0.6} />
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