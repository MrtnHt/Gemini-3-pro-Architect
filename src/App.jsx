import React, { useState } from 'react';

const App = () => {
  const [cost] = useState(0.0035);
  const [memory] = useState(true);

  return (
    <div style={{backgroundColor: '#020617', color: '#f8fafc', minHeight: '100vh', fontFamily: 'monospace', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{border: '1px solid #1e293b', padding: '40px', borderRadius: '16px', textAlign: 'center', background: '#0f172a', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'}}>
        <h1 style={{color: '#6366f1', margin: '0 0 10px 0', fontSize: '2rem', letterSpacing: '-1px'}}>ARCHITECT V5</h1>
        <div style={{fontSize: '0.8rem', opacity: 0.5, marginBottom: '20px'}}>REPO: MrtnHt/Gemini-3-pro-Architect</div>
        
        <div style={{display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '20px'}}>
          <div style={{color: '#10b981'}}>● MEMORY_ACTIVE</div>
          <div style={{color: '#818cf8'}}>COST: €{cost.toFixed(4)}</div>
        </div>

        <div style={{padding: '10px', background: '#1e293b', borderRadius: '4px', fontSize: '0.9rem'}}>
          STATUS: <span style={{color: '#10b981'}}>STABLE_BYPASS_RUNNING</span>
        </div>
      </div>
    </div>
  );
};

export default App;
