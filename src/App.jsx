import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp } from 'firebase/firestore';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [cost, setCost] = useState(0.0050); 
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).reverse());
    }, (err) => setError("SYNC_ERROR: " + err.message));
    return () => unsubscribe();
  }, []);

  const handlePush = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      setCost(prev => prev + 0.00015); await addDoc(collection(db, "chats"), {
        text: input,
        timestamp: serverTimestamp(),
        user: "Architect_Master",
        model_restriction: "NO_GPT01_NO_4O"
      });
      setInput('');
      setCost(prev => prev + 0.00015);
    } catch (err) { setError("PUSH_ERROR: " + err.message); }
  };

  const downloadBackup = () => {
    const data = JSON.stringify(messages, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architect_v5_backup_${new Date().toISOString()}.json`;
    a.click();
  };

  return (
    <div style={{backgroundColor: '#020617', color: '#f8fafc', minHeight: '100vh', fontFamily: 'monospace', display: 'flex', flexDirection: 'column'}}>
      <header style={{padding: '15px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', background: '#0f172a'}}>
        <div>
          <h1 style={{color: '#6366f1', margin: 0, fontSize: '1.1rem'}}>ARCHITECT V5_CORE</h1>
          <div style={{fontSize: '0.6rem', color: '#10b981'}}>STRICT_MODE: ACTIVE (NO_GPT01/4O)</div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{color: error ? '#ef4444' : '#10b981', fontSize: '0.7rem'}}>● MEMORY_SYNCED</div>
          <div style={{fontSize: '0.9rem', fontWeight: 'bold'}}>COST: €{cost.toFixed(5)}</div>
        </div>
      </header>
      <main style={{flexGrow: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
        {messages.map((m) => (
          <div key={m.id} style={{background: '#1e293b', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #6366f1'}}>
            <div style={{fontSize: '0.55rem', opacity: 0.5, marginBottom: '4px'}}>
              {m.timestamp?.toDate().toLocaleString()} | {m.user}
            </div>
            <div style={{fontSize: '0.85rem'}}>{m.text}</div>
          </div>
        ))}
      </main>
      <footer style={{padding: '15px', background: '#0f172a', borderTop: '1px solid #1e293b'}}>
        <form onSubmit={handlePush} style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            style={{flexGrow: 1, background: '#020617', border: '1px solid #334155', color: 'white', padding: '12px', borderRadius: '4px'}}
            placeholder="SYSTEM_INPUT > Typ bericht..."
          />
          <button type="submit" style={{background: '#6366f1', color: 'white', border: 'none', padding: '0 20px', borderRadius: '4px', fontWeight: 'bold'}}>EXEC</button>
        </form>
        <button onClick={downloadBackup} style={{width: '100%', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '8px', fontSize: '0.7rem', cursor: 'pointer'}}>
          DOWNLOAD_ARCHITECT_LOG_BACKUP
        </button>
      </footer>
    </div>
  );
};

export default App;
