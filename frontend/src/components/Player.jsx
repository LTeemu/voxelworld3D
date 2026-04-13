import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointerLockControls, useKeyboardControls } from '@react-three/drei';
import { RigidBody, useRapier, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useStore } from '../store';
import { socket } from '../socket';

const SPEED = 8;
const JUMP_FORCE = 10;
const FALL_DEATH_Y = -10;
const FLY_SPEED = 40;

export default function Player() {
  const rigidBody = useRef();
  const { rapier, world: rapierWorld } = useRapier();
  const [, get] = useKeyboardControls();
  const { user, worldId, spawnPosition, noclip } = useStore();
  const lastEmitTime = useRef(0);
  const lastJumpRef = useRef(0);

  // controlsRef → the PointerLockControls instance
  const controlsRef = useRef();
  // ryRef → always holds the latest camera yaw, updated via the controls' change event
  const ryRef = useRef(0);

  const [lockCooldown, setLockCooldown] = useState(false);
  const isLockedRef = useRef(false);

  const handleUnlock = () => {
    isLockedRef.current = false;
    setLockCooldown(true);
    setTimeout(() => setLockCooldown(false), 1000);
  };

  useEffect(() => {
    window.rigidBodyRef = rigidBody;
  }, []);

  useEffect(() => {
    if (rigidBody.current && user) {
      const pos = { x: user.x, y: user.y, z: user.z };
      rigidBody.current.setTranslation(pos, true);
    }
  }, [user]);

  useEffect(() => {
    if (rigidBody.current && spawnPosition && user) {
      const isNewPlayer = user.x === 0 && user.y === 0 && user.z === 0;
      if (isNewPlayer) {
        rigidBody.current.setTranslation({ x: spawnPosition.x, y: spawnPosition.y, z: spawnPosition.z }, true);
        rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }, [worldId, spawnPosition, user]);

  useEffect(() => {
    if (lockCooldown) return;
    
    const timer = setTimeout(() => {
      const controls = controlsRef.current;
      if (!controls) return;

      const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
      const onControlsChange = () => {
        const cam = controls.camera ?? controls.object;
        if (!cam) return;
        _euler.setFromQuaternion(cam.quaternion, 'YXZ');
        ryRef.current = _euler.y;
      };

      controls.addEventListener('change', onControlsChange);
      return () => controls.removeEventListener('change', onControlsChange);
    }, 10);

    return () => clearTimeout(timer);
  }, [lockCooldown]);

  useFrame((state) => {
    if (!rigidBody.current || !user) return;

    const camera = state.camera;
    if (!camera || !camera.isPerspectiveCamera || camera.fov === 0) return;

    const currentPos = rigidBody.current.translation();

    // Switch between dynamic and kinematic based on noclip mode
    if (noclip && rigidBody.current.bodyType() !== 2) {
      rigidBody.current.setBodyType(2); // kinematicPosition
    } else if (!noclip && rigidBody.current.bodyType() !== 0) {
      rigidBody.current.setBodyType(0); // dynamic
    }

    // Death / fall out of world
    if (!noclip && currentPos.y < FALL_DEATH_Y) {
      rigidBody.current.setTranslation({ x: 0, y: 5, z: 0 }, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const ry = ryRef.current;

    // Camera forward for WASD movement
    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();

    // Emit at ~20hz
    const now = Date.now();
    if (now - lastEmitTime.current > 50) {
      socket.emit('player_move', { x: currentPos.x, y: currentPos.y, z: currentPos.z, ry });
      lastEmitTime.current = now;
      // Update global player position for AIWorld
      window.playerPos = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
    }

    const { forward, backward, left, right, jump } = get();

    const camRight = new THREE.Vector3();
    camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

    let moveZ = (forward ? 1 : 0) - (backward ? 1 : 0);
    let moveX = (right ? 1 : 0) - (left ? 1 : 0);

    let direction = new THREE.Vector3();
    
    if (noclip) {
      // Fly in camera direction - use kinematic setNextKinematicTranslation
      const flyDir = new THREE.Vector3();
      camera.getWorldDirection(flyDir);
      
      direction.set(0, 0, 0);
      if (moveZ !== 0) direction.addScaledVector(flyDir, moveZ);
      if (moveX !== 0) direction.addScaledVector(camRight, moveX);
      // In noclip: Space for up, S for down
      if (jump) {
        direction.y = 1;
      } else if (backward) {
        direction.y = -1;
      }
      if (direction.lengthSq() > 0) direction.normalize().multiplyScalar(FLY_SPEED);
      
      const newPos = {
        x: currentPos.x + direction.x * 0.016,
        y: currentPos.y + direction.y * 0.016,
        z: currentPos.z + direction.z * 0.016
      };
      rigidBody.current.setNextKinematicTranslation(newPos);
    } else {
      const velocity = rigidBody.current.linvel();
      if (moveZ !== 0) direction.addScaledVector(camForward, moveZ);
      if (moveX !== 0) direction.addScaledVector(camRight, moveX);
      if (direction.lengthSq() > 0) direction.normalize().multiplyScalar(SPEED);

      // Grounded check via raycast
      const rayOrigin = { x: currentPos.x, y: currentPos.y - 1.05, z: currentPos.z };
      const ray = new rapier.Ray(rayOrigin, { x: 0, y: -1, z: 0 });
      const hit = rapierWorld.castRay(ray, 0.2, true);
      const isGrounded = (hit && hit.toi < 0.2) || Math.abs(velocity.y) < 0.05;

      if (jump && isGrounded && now - lastJumpRef.current > 300) {
        lastJumpRef.current = now;
        rigidBody.current.setLinvel({ x: direction.x, y: JUMP_FORCE, z: direction.z }, true);
      } else {
        rigidBody.current.setLinvel({ x: direction.x, y: velocity.y, z: direction.z }, true);
      }
      rigidBody.current.setGravityScale(1, true);
    }

    // Attach camera position to rigid body
    camera.position.set(currentPos.x, currentPos.y + 1.5, currentPos.z);
  });

  if (!user) return null;

  // Only render PointerLockControls after user interaction to avoid immediate lock failures
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const handleClick = () => setShowControls(true);
    window.addEventListener('click', handleClick, { once: true });
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <>
      {showControls && !lockCooldown && <PointerLockControls 
          ref={controlsRef} 
          onUnlock={handleUnlock}
          onLock={() => { isLockedRef.current = true; }}
        />}
      <RigidBody ref={rigidBody} colliders={false} mass={1} type="dynamic" position={[0, 1, 0]} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[0.5, 0.4]} position={[0, 0.9, 0]} />
      </RigidBody>
    </>
  );
}