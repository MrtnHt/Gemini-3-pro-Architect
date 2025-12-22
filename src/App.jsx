import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp } from 'firebase/firestore';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_KEY || ""; 

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [cost, setCost] = useState(0.0050);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).reverse());
    });
    return () => unsubscribe();
  }, []);

  const askGemini = async (userText) => {
    if (!GEMINI_API_KEY) return "ERROR: API_KEY_NOT_FOUND. Check GitHub Secrets.";
    setIsTyping(true);
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ contents: [{ parts: [{ text: userText }] }] })
      });
      const data = await resp.json();
      return data.candidates[0].content.parts[0].text;
    } catch (e) { return "Link Failure: " + e.message; }
    finally { setIsTyping(false); }
  };

  const handlePush = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setCost(prev => prev + 0.00015);
    await addDoc(collection(db, "chats"), { text: userMsg, timestamp: serverTimestamp(), user: "User" });
    const aiResp = await askGemini(userMsg);
    await addDoc(collection(db, "chats"), { text: aiResp, timestamp: serverTimestamp(), user: "Architect_V5" });
  };

  return (
    <div style={{backgroundColor: '#020617', color: '#f8fafc', minHeight: '100vh', fontFamily: 'monospace', display: 'flex', flexDirection: 'column'}}>
      <header style={{padding: '15px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', background: '#0f172a'}}>
        <div><h1 style={{color: '#6366f1', margin: 0, fontSize: '1.1rem'}}>ARCHITECT V5_CORE</h1></div>
        <div style={{textAlign: 'right'}}>
          <div style={{color: '#10b981', fontSize: '0.7rem'}}>● {isTyping ? 'THINKING...' : 'MEMORY_SYNCED'}</div>
          <div style={{fontSize: '0.9rem'}}>COST: €{cost.toFixed(5)}</div>
        </div>
      </header>
      <main style={{flexGrow: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
        {messages.map((m) => (
          <div key={m.id} style={{background: m.user === 'User' ? '#1e293b' : '#0f172a', padding: '10px', borderRadius: '4px', borderLeft: m.user === 'User' ? '3px solid #6366f1' : '3px solid #10b981'}}>
            <div style={{fontSize: '0.55rem', opacity: 0.5}}>{m.user}</div>
            <div style={{fontSize: '0.85rem'}}>{m.text}</div>
          </div>
        ))}
      </main>
      <footer style={{padding: '15px', background: '#0f172a', borderTop: '1px solid #1e293b'}}>
        <form onSubmit={handlePush} style={{display: 'flex', gap: '8px'}}>
          <input value={input} onChange={(e) => setInput(e.target.value)} style={{flexGrow: 1, background: '#020617', border: '1px solid #334155', color: 'white', padding: '12px'}} placeholder="SYSTEM_INPUT..." />
          <button type="submit" style={{background: '#6366f1', color: 'white', border: 'none', padding: '0 20px'}}>EXEC</button>
        </form>
      </footer>
    </div>
  );
};
export default App;
