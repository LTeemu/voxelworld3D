import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { KeyboardControls, PerspectiveCamera } from '@react-three/drei';
import UI from './components/UI';
import AIWorld from './components/AIWorld';
import Player from './components/Player';
import { ErrorBoundary } from './components/ErrorBoundary';
import { socket } from './socket';
import { useStore } from './store';

function MenuCamera() {
  useFrame((state) => {
    const time = state.clock.getElapsedTime() * 0.1; // Slow rotation
    const distance = 60;
    const x = Math.sin(time) * distance;
    const z = Math.cos(time) * distance;
    const y = 40; // Maintain height

    state.camera.position.set(x, y, z);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <PerspectiveCamera 
      makeDefault 
      fov={75}
      near={0.1}
      far={1000}
    />
  );
}

export default function App() {
  const { uiState, isAuthenticated, token, worldId, fetchInitialPlayers, updatePlayer, removePlayer, setPlayerOffline } = useStore();

  useEffect(() => {
    fetchInitialPlayers();
  }, []);

  useEffect(() => {
    socket.connect();

    const onPlayerConnected = (p) => updatePlayer(p);
    const onPlayerMoved = (p) => updatePlayer(p);
    const onPlayerDisconnected = (id) => setPlayerOffline(id);
    const onPlayerDeleted = (id) => removePlayer(id);

    socket.on('player_connected', onPlayerConnected);
    socket.on('player_moved', onPlayerMoved);
    socket.on('player_disconnected', onPlayerDisconnected);
    socket.on('account_deleted', onPlayerDeleted);

    return () => {
      socket.off('player_connected', onPlayerConnected);
      socket.off('player_moved', onPlayerMoved);
      socket.off('player_disconnected', onPlayerDisconnected);
      socket.off('account_deleted', onPlayerDeleted);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      socket.emit('join_game', { token });
    } else {
      socket.emit('logout');
    }
  }, [isAuthenticated, token]);

  return (
    <>
      <UI />
      <ErrorBoundary>
        <KeyboardControls
          map={[
            { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
            { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
            { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
            { name: 'right', keys: ['ArrowRight', 'KeyD'] },
            { name: 'jump', keys: ['Space'] },
          ]}
        >
          <Canvas 
            gl={{ 
              powerPreference: 'low-power',
              antialias: false,
              failIfMajorPerformanceCaveat: false,
            }} 
            dpr={[1, 1]}
            camera={{ fov: 75, near: 0.1, far: 2000, position: [0, 10, 0] }} 
          >
            <color attach="background" args={['#87CEEB']} />
            
            {uiState !== 'game' && <MenuCamera />}

            <Physics gravity={[0, -20, 0]}>
              <AIWorld />
              {uiState === 'game' && <Player />}
            </Physics>
          </Canvas>
        </KeyboardControls>
      </ErrorBoundary>
    </>
  );
}
