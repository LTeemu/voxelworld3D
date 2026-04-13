import { create } from 'zustand';
import axios from 'axios';
import { socket } from './socket';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

// Setup interceptor to inject token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('vw_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const useStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('vw_token') || null,
  isAuthenticated: false,
  otherPlayers: [],
  uiState: 'menu',
  worldId: 'Lobby',
  activeWorlds: [],
spawnPosition: null,
  noclip: true,
  debugMode: true,
  
  setNoclip: (val) => set({ noclip: val }),
  toggleNoclip: () => set(state => ({ noclip: !state.noclip })),
  setDebugMode: (val) => set({ debugMode: val }),
  toggleDebugMode: () => set(state => ({ debugMode: !state.debugMode })),
  
  setToken: (token) => {
    localStorage.setItem('vw_token', token);
    set({ token, isAuthenticated: true });
  },

  setSpawnPosition: (pos) => set({ spawnPosition: pos }),

  logout: () => {
    localStorage.removeItem('vw_token');
    set({ user: null, token: null, isAuthenticated: false, uiState: 'menu' });
  },

  register: async (username, password) => {
    const targetWorld = get().worldId;
    const res = await api.post('/register', { username, password, world_id: targetWorld });
    set({ user: res.data.user, worldId: res.data.user.world_id || 'Lobby' });
    get().setToken(res.data.token);
    set({ uiState: 'game' });
    get().fetchInitialPlayers();
  },

  login: async (username, password) => {
    const targetWorld = get().worldId;
    const res = await api.post('/login', { username, password, world_id: targetWorld });
    
    set({ user: res.data.user, worldId: res.data.user.world_id || 'Lobby' });
    get().setToken(res.data.token);
    set({ uiState: 'game' });
    get().fetchInitialPlayers();
  },

  deleteAccount: async () => {
    await api.delete('/user');
    get().logout();
    set({ uiState: 'dead' });
  },

  fetchInitialPlayers: async () => {
    const res = await api.get('/users');
    const currentUser = get().user;
    const currentWorld = get().worldId;
    // Filter out ourselves AND only show people in SAME WORLD
    const others = res.data.filter(u => 
      (!currentUser || u.id !== currentUser.id) && 
      (u.world_id === currentWorld)
    );
    set({ otherPlayers: others });
  },

  fetchActiveWorlds: async () => {
    try {
      const res = await api.get('/worlds');
      set({ activeWorlds: res.data });
    } catch (err) {
      console.error('Failed to fetch active worlds:', err);
    }
  },

  // Called via socket events
  updatePlayer: (player) => {
    // If it's us, ignore
    if (get().user && player.id === get().user.id) return;

    set(state => {
      const idx = state.otherPlayers.findIndex(p => p.id === player.id);
      if (idx !== -1) {
        const newPlayers = [...state.otherPlayers];
        // Merge data and force online: true since we just got a live update
        newPlayers[idx] = { ...newPlayers[idx], ...player, online: true };
        return { otherPlayers: newPlayers };
      } else {
        // New player discovered via live update
        return { otherPlayers: [...state.otherPlayers, { ...player, online: true }] };
      }
    });
  },

  removePlayer: (playerId) => {
    set(state => ({
      otherPlayers: state.otherPlayers.filter(p => p.id !== playerId)
    }));
  },

  setPlayerOffline: (playerId) => {
    set(state => ({
      otherPlayers: state.otherPlayers.map(p => 
        p.id === playerId ? { ...p, online: false } : p
      )
    }));
  },

  enterWorld: (prompt) => {
    const newWorld = prompt || 'Lobby';
    set({ worldId: newWorld });
    
    // If authenticated, sync with server
    if (get().isAuthenticated) {
      socket.emit('move_world', { worldId: newWorld });
    }

    get().fetchInitialPlayers();
  }
}));
