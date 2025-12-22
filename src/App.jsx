import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const q = query(collection(db, "chats"), orderBy("timestamp", "desc"), limit(10));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => doc.data()).reverse());
      }, (err) => {
        console.error(err);
        setError("Firebase Config Fout: Controleer src/firebase.js");
      });
      return () => unsubscribe();
    } catch (e) {
      setError("Opstartfout: " + e.message);
    }
  }, []);

  return (
    <div style={{backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif'}}>
      <header style={{borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '20px'}}>
        <h1 style={{color: '#818cf8', margin: 0}}>Architect V5</h1>
        <p style={{fontSize: '10px', opacity: 0.5}}>STATUS: ONLINE</p>
      </header>
      {error && <div style={{background: '#450a0a', color: '#fecaca', padding: '15px', borderRadius: '8px', border: '1px solid #7f1d1d'}}>{error}</div>}
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
        {messages.length === 0 && !error && <p style={{opacity: 0.5}}>Geheugen wordt geladen...</p>}
        {messages.map((m, i) => (
          <div key={i} style={{background: '#1e293b', padding: '15px', borderRadius: '12px', border: '1px solid #334155'}}>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
};
export default App;
