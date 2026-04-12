import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress deprecation warnings from library internals (THREE.Clock in R3F,
// Rapier WASM init, PCFSoftShadowMap) that cannot be fixed from userland until packages update.
const _warn = console.warn.bind(console);
console.warn = (...args) => {
  const msg = args[0];
  if (typeof msg === 'string' && (
    msg.includes('Clock') ||
    msg.includes('deprecated parameters for the initialization') ||
    msg.includes('PCFSoftShadowMap')
  )) return;
  _warn(...args);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
