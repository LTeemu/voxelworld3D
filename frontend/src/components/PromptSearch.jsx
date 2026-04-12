import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Sparkles, Users, Globe, Image } from 'lucide-react';

export default function PromptSearch() {
  const { enterWorld, worldId, activeWorlds, fetchActiveWorlds } = useStore();
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Periodically refresh active worlds
  useEffect(() => {
    fetchActiveWorlds();
    const interval = setInterval(fetchActiveWorlds, 10000); // every 10s
    return () => clearInterval(interval);
  }, [fetchActiveWorlds]);

  const handlePromptSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!prompt.trim()) return;
    enterWorld(prompt);
    setPrompt('');
  };

  const handleImageSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imageUrl.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/world-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          worldId: prompt.trim() || 'image-world', 
          imageUrl: imageUrl.trim() 
        })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        alert('Server error: ' + text.substring(0, 200));
        return;
      }
      
      if (response.ok) {
        enterWorld(prompt.trim() || 'image-world');
        setImageUrl('');
        setPrompt('');
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="prompt-search">
      {/* World creation from prompt */}
      <div className="search-bar">
        <Sparkles size={16} className="sparkle-icon" />
        <input 
          type="text" 
          placeholder="Manifest a world (e.g. Lava Kingdom)" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handlePromptSubmit(e);
            }
          }}
        />
        <button type="button" onClick={handlePromptSubmit}>Create</button>
      </div>

      {/* Image URL input for generating world from image */}
      <div className="search-bar" style={{ marginTop: '0.5rem' }}>
        <Image size={16} className="sparkle-icon" />
        <input 
          type="text" 
          placeholder="Image URL (PNG, JPG, BMP, GIF, TIFF) to generate 3D world"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleImageSubmit(e);
            }
          }}
        />
        <button type="button" onClick={handleImageSubmit} disabled={loading}>
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      <div className="active-dimensions">
        <div className="label">
          <Globe size={12} />
          <span>Active Dimensions</span>
        </div>
        <div className="tag-cloud">
          {activeWorlds.length > 0 ? (
            activeWorlds.map((world, i) => (
              <div 
                key={i} 
                className={`world-tag ${world.world_id === worldId ? 'active' : ''}`}
                onClick={() => enterWorld(world.world_id)}
              >
                <span className="world-name">{world.world_id}</span>
                <span className="player-count">
                  <Users size={10} />
                  {world.count}
                </span>
              </div>
            ))
          ) : (
            <div className="empty-msg">No active dimensions. Start one!</div>
          )}
        </div>
      </div>
    </div>
  );
}
