import { useState } from 'react';
import { useStore } from '../store';
import PromptSearch from './PromptSearch';

export default function UI() {
  const { uiState, login, register, logout, spawnPosition, noclip, toggleNoclip, debugMode, toggleDebugMode, worldLoading } = useStore();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (uiState === 'game') {
    return (
      <div className="ui-layer" style={{ pointerEvents: 'none' }}>
        <div className="crosshair" />
        {worldLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.7)',
            padding: '1rem 2rem',
            borderRadius: '8px',
            color: '#fff',
            pointerEvents: 'auto',
          }}>
            Loading world...
          </div>
        )}
        <div className="hud">
          <div>WASD to move</div>
          <div>Mouse to look</div>
          <div>ESC to free mouse</div>
          <button
            type="button"
            className="btn-secondary"
            style={{ pointerEvents: 'auto', marginTop: '10px', marginRight: '10px' }}
            onClick={() => {
              const pos = spawnPosition || { x: 0, y: 5, z: 0 };
              if (window.rigidBodyRef?.current) {
                window.rigidBodyRef.current.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
                window.rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
              }
            }}
          >
            Respawn
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ pointerEvents: 'auto', marginTop: '10px' }}
            onClick={() => toggleNoclip()}
          >
            {noclip ? 'Fly Off' : 'Fly On'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ pointerEvents: 'auto', marginTop: '10px' }}
            onClick={() => toggleDebugMode()}
          >
            {debugMode ? 'Debug Off' : 'Debug On'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ pointerEvents: 'auto', marginTop: '10px' }}
            onClick={() => {
              logout();
            }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (uiState === 'dead') {
    return (
      <div className="ui-layer" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <div className="dead-screen">
          <h1>YOU DIED</h1>
          <p>You fell off the edge. Your account has been deleted permanently.</p>
          <button className="btn-primary" onClick={() => window.location.reload()} style={{ marginTop: '2rem' }}>
            Reincarnate
          </button>
        </div>
      </div>
    );
  }

  // Menu State
  return (
    <div className="ui-layer menu-layout">
      <form className="auth-panel" onSubmit={handleSubmit}>

        {error && <div className="error-msg">{error}</div>}

        <PromptSearch />

        <div className="auth-inputs">
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Loading...' : isLogin ? 'Enter' : 'Create'}
          </button>
        </div>

        <div className="auth-footer">
          <button
            type="button"
            className="btn-link"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
          >
            {isLogin ? "Create account" : "Already a member?"}
          </button>
        </div>
      </form>
    </div>
  );
}
