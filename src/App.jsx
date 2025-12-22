import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp } from 'firebase/firestore';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_KEY || ""; 

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).reverse());
    });
    return () => unsubscribe();
  }, []);

  const handlePush = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setIsTyping(true);
    try {
      await addDoc(collection(db, "chats"), { text: userMsg, timestamp: serverTimestamp(), user: "User" });
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ contents: [{ parts: [{ text: userMsg }] }] })
      });
      const data = await resp.json();
      const aiResp = data.candidates[0].content.parts[0].text;
      await addDoc(collection(db, "chats"), { text: aiResp, timestamp: serverTimestamp(), user: "Architect" });
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{backgroundColor: '#020617', color: '#f8fafc', minHeight: '100vh', fontFamily: 'monospace', padding: '20px'}}>
      <header style={{borderBottom: '1px solid #1e293b', marginBottom: '20px'}}>
        <h2>ARCHITECT_RECOVERY_MODE</h2>
        <p>Status: {isTyping ? 'THINKING...' : 'ONLINE'}</p>
      </header>
      <div style={{height: '60vh', overflowY: 'auto', marginBottom: '20px'}}>
        {messages.map(m => <div key={m.id} style={{marginBottom: '10px'}}><strong>{m.user}:</strong> {m.text}</div>)}
      </div>
      <form onSubmit={handlePush} style={{display: 'flex', gap: '10px'}}>
        <input value={input} onChange={e => setInput(e.target.value)} style={{flexGrow: 1, padding: '10px', background: '#0f172a', border: '1px solid #334155', color: 'white'}} />
        <button type="submit" style={{padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none'}}>SEND</button>
      </form>
    </div>
  );
};
export default App;
