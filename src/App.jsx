import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, orderBy, onSnapshot, addDoc, limit, doc, getDoc } from 'firebase/firestore';

// --- EMERGENCY RESTORE: ARCHITECT V5 (No external deps) ---
const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  // Fallback thema als localStorage leeg is
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'architect-dark');
  const [totalCost, setTotalCost] = useState(0);
  const [activeModel, setActiveModel] = useState('gemini-3-pro-preview');
  const [customKey, setCustomKey] = useState(localStorage.getItem('user_api_key') || '');
  const [isThinking, setIsThinking] = useState(false);

  // 2025 Modellen (OMIT 4o/o1 strict)
  const models = {
    'gemini-3-pro-preview': { name: 'Gemini 3 Pro', rate: 0.0035 },
    'gpt-5': { name: 'GPT-5', rate: 0.015 },
    'gpt-5-mini': { name: 'GPT-5 Mini', rate: 0.0008 }
  };

  // Veilige effect hook voor Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, "chats"), orderBy("timestamp", "desc"), limit(20));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => doc.data()).reverse());
      }, (error) => {
        console.error("Firestore error:", error);
        // Voeg een dummy bericht toe bij error zodat scherm niet wit blijft
        setMessages([{ role: 'system', text: 'Verbinding met geheugen verbroken. Check Firestore rules.' }]);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Setup error:", err);
    }
  }, []);

  // Native Download functie (geen 'file-saver' nodig)
  const downloadChatlog = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architect-restore-log-${new Date().toISOString()}.json`;
    a.click();
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input, timestamp: new Date() };
    
    // Optimistic UI update (zodat je meteen iets ziet)
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      // Hier zou de echte API call komen
      // Simuleer even een antwoord om de interface te testen
      await new Promise(r => setTimeout(r, 1000));
      
      const aiMsg = { 
        role: 'assistant', 
        text: `[Systeem Hersteld] Ik ben weer online via ${models[activeModel].name}.`,
        thoughts: 'Herstart protocol succesvol uitgevoerd.'
      };
      
      // Probeer op te slaan in DB, maar crash niet als het faalt
      try {
        await addDoc(collection(db, "chats"), userMsg);
        await addDoc(collection(db, "chats"), aiMsg);
      } catch (e) {
        console.error("Save failed", e);
        setMessages(prev => [...prev, aiMsg]); // Lokaal tonen als fallback
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsThinking(false);
    }
  };

  // Styling classes
  const getThemeBg = () => {
    if (theme === 'midnight') return 'bg-black text-white';
    if (theme === 'crystal') return 'bg-white text-slate-900';
    return 'bg-slate-950 text-white'; // Architect Dark default
  };

  return (
    <div className={`min-h-screen ${getThemeBg()} font-sans transition-colors duration-300`}>
      {/* HEADER */}
      <header className="p-4 border-b border-white/10 flex justify-between items-center backdrop-blur-md sticky top-0 z-50">
        <div>
          <h1 className="text-lg font-bold text-indigo-400">Architect V5 <span className="text-xs text-red-400 border border-red-400 px-1 rounded">RESCUE MODE</span></h1>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={downloadChatlog} className="bg-indigo-600 px-3 py-1 rounded text-white">Backup</button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="max-w-5xl mx-auto p-4 grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* SIDEBAR */}
        <aside className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h2 className="font-bold mb-2">Status</h2>
            <div className="text-xs space-y-2 opacity-70">
              <p>Model: {models[activeModel].name}</p>
              <p>Kosten: €{totalCost.toFixed(5)}</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h2 className="font-bold mb-2">Instellingen</h2>
            <select 
              className="w-full bg-black/20 p-2 rounded text-xs mb-2 border border-white/10"
              value={theme}
              onChange={e => {setTheme(e.target.value); localStorage.setItem('theme', e.target.value)}}
            >
              <option value="architect-dark">Architect Dark</option>
              <option value="midnight">Midnight OLED</option>
              <option value="crystal">Crystal Light</option>
            </select>
            <input 
              type="password"
              placeholder="API Key..."
              className="w-full bg-black/20 p-2 rounded text-xs border border-white/10"
              value={customKey}
              onChange={e => setCustomKey(e.target.value)}
            />
          </div>
        </aside>

        {/* CHAT AREA */}
        <section className="col-span-1 md:col-span-3 h-[70vh] flex flex-col relative">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-20">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.thoughts && (
                  <div className="text-[10px] opacity-50 mb-1 ml-2 italic">
                     Thinking: {m.thoughts.substring(0, 50)}...
                  </div>
                )}
                <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${
                  m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white/10 border border-white/10'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isThinking && <div className="text-xs animate-pulse opacity-50">Systeem herstarten...</div>}
          </div>

          {/* INPUT */}
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-slate-900 pt-4">
            <input 
              className="w-full bg-white/10 border border-white/20 p-4 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
              placeholder="Typ een commando om te testen..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
