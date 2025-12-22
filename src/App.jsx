import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, orderBy, onSnapshot, addDoc, limit } from 'firebase/firestore';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isMemoryActive, setIsMemoryActive] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"), limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data()).reverse();
      setMessages(docs);
      if (docs.length > 0) setIsMemoryActive(true);
    });
    return () => unsubscribe();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    await addDoc(collection(db, "chats"), { role: 'user', text: input, timestamp: new Date() });
    setInput('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans">
      <header className="border-b border-white/10 pb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-400">Architect V5</h1>
        <div className="text-[10px] uppercase">{isMemoryActive ? '● Memory Active' : '○ Standby'}</div>
      </header>
      <main className="h-[75vh] overflow-y-auto py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`p-3 rounded-xl ${m.role === 'user' ? 'bg-indigo-600 ml-auto' : 'bg-white/10'} max-w-[85%]`}>
            {m.text}
          </div>
        ))}
      </main>
      <div className="flex gap-2">
        <input className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Type naar Architect..." />
        <button onClick={handleSend} className="bg-indigo-600 px-6 rounded-xl">Stuur</button>
      </div>
    </div>
  );
};
export default App;
