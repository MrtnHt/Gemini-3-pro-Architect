import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase'; // Verbinding met europe-west4
import { collection, addDoc, query, orderBy, onSnapshot, limit, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { saveAs } from 'file-saver';

const App = () => {
  // --- States voor V5 Functionaliteit ---
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'architect-dark');
  const [totalCost, setTotalCost] = useState(0);
  const [activeModel, setActiveModel] = useState('gemini-3-pro-preview');
  const [customKey, setCustomKey] = useState(localStorage.getItem('user_api_key') || '');
  const [isMemoryActive, setIsMemoryActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // --- 2025 Model & Tarieven (OMIT 4o/o1) [cite: 2025-12-20] ---
  const models = {
    'gemini-3-pro-preview': { name: 'Gemini 3 Pro', rate: 0.0035 },
    'gpt-5': { name: 'GPT-5', rate: 0.015 },
    'gpt-5-mini': { name: 'GPT-5 Mini', rate: 0.0008 }
  };

  // --- Live Geheugen: Laden van Context & Voorkeuren ---
  useEffect(() => {
    // 1. Injecteer laatste 15 berichten
    const q = query(collection(db, 'chats'), orderBy('timestamp', 'desc'), limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(d => d.data()).reverse();
      setMessages(fetchedMessages);
      if (fetchedMessages.length > 0) setIsMemoryActive(true);
    });

    // 2. Laad gebruikersvoorkeuren uit eur4
    const loadPrefs = async () => {
      const prefDoc = await getDoc(doc(db, 'settings', 'user_prefs'));
      if (prefDoc.exists()) setTheme(prefDoc.data().theme);
    };
    loadPrefs();

    return () => unsubscribe();
  }, []);

  // --- Knowledge Module: Document Upload & Extractie ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      await addDoc(collection(db, 'knowledge'), {
        fileName: file.name,
        content: text,
        timestamp: serverTimestamp()
      });
      alert(`Kennis geladen: ${file.name}`);
    };
    reader.readAsText(file);
  };

  // --- Kostenteller & Chatlog Download [cite: 2025-12-20] ---
  const calculateCost = (inputText, responseText) => {
    const tokens = (inputText.length + responseText.length) / 4;
    const cost = (tokens / 1000) * models[activeModel].rate;
    setTotalCost(prev => prev + cost);
  };

  const downloadChatlog = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    saveAs(blob, `architect-v5-log-${new Date().toISOString()}.json`);
  };

  // --- UI Theme Classes ---
  const themeClasses = {
    'architect-dark': 'bg-slate-950 text-white',
    'midnight': 'bg-black text-white',
    'crystal': 'bg-white text-slate-900'
  };

  return (
    <div className={`min-h-screen ${themeClasses[theme]} transition-colors duration-500 font-sans`}>
      {/* Header met Glassmorphism & Status */}
      <header className='sticky top-0 z-10 backdrop-blur-md bg-white/5 border-b border-white/10 p-4 flex justify-between items-center'>
        <div>
          <h1 className='text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent'>
            Gemini 3 Pro Architecture
          </h1>
          <div className='flex items-center gap-2 text-[10px] mt-1'>
            <span className={`h-2 w-2 rounded-full ${isMemoryActive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></span>
            <span className='opacity-70 uppercase tracking-widest'>{isMemoryActive ? 'Memory Active' : 'Memory Standby'}</span>
          </div>
        </div>
        
        <div className='flex items-center gap-4'>
          <div className='text-right'>
            <p className='text-[10px] opacity-50 uppercase'>Totaal Verbruik</p>
            <p className='font-mono text-indigo-400'>€{totalCost.toFixed(5)}</p>
          </div>
          <select 
            className='bg-white/10 border border-white/20 rounded-lg text-xs p-2 outline-none'
            value={theme}
            onChange={(e) => { setTheme(e.target.value); localStorage.setItem('theme', e.target.value); }}
          >
            <option value='architect-dark'>Architect Dark</option>
            <option value='midnight'>Midnight OLED</option>
            <option value='crystal'>Crystal Light</option>
          </select>
          <button onClick={downloadChatlog} className='bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg transition'>Backup ↓</button>
        </div>
      </header>

      <main className='max-w-6xl mx-auto grid grid-cols-12 gap-6 p-6'>
        {/* Sidebar: Knowledge & Settings */}
        <aside className='col-span-12 md:col-span-3 space-y-6'>
          <div className='bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm'>
            <h2 className='text-sm font-semibold mb-4 flex items-center gap-2'>
              <span>📚</span> Knowledge Module
            </h2>
            <label className='block w-full border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl p-4 text-center cursor-pointer transition'>
              <span className='text-[10px] opacity-50'>Upload .pdf / .txt</span>
              <input type='file' className='hidden' onChange={handleFileUpload} accept='.pdf,.txt' />
            </label>
          </div>

          <div className='bg-white/5 border border-white/10 rounded-2xl p-4'>
            <h2 className='text-sm font-semibold mb-4'>API Config</h2>
            <input 
              type='password' 
              placeholder='Handmatige sleutel...'
              className='w-full bg-black/20 border border-white/10 rounded-lg p-2 text-xs outline-none focus:border-indigo-500'
              value={customKey}
              onChange={(e) => { setCustomKey(e.target.value); localStorage.setItem('user_api_key', e.target.value); }}
            />
          </div>
        </aside>

        {/* Chat Area */}
        <section className='col-span-12 md:col-span-9 flex flex-col h-[75vh]'>
          <div className='flex-1 overflow-y-auto space-y-6 pr-4 scrollbar-thin scrollbar-thumb-white/10'>
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.thoughts && (
                  <details className='w-full max-w-[80%] mb-2 group'>
                    <summary className='text-[10px] opacity-40 cursor-pointer list-none flex items-center gap-2 hover:opacity-100 transition'>
                      <span className='group-open:rotate-90 transition-transform'>▶</span> Bekijk redenering (V5 CoT)
                    </summary>
                    <div className='mt-2 p-3 bg-white/5 border-l-2 border-indigo-500/30 rounded-r-lg text-xs italic opacity-60'>
                      {m.thoughts}
                    </div>
                  </details>
                )}
                <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-xl ${
                  m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white/10 backdrop-blur-md border border-white/10 rounded-tl-none'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isThinking && <div className='text-[10px] animate-pulse opacity-50'>Architect denkt na...</div>}
          </div>

          {/* Input met Model Selector */}
          <div className='mt-6 relative'>
            <div className='absolute -top-10 left-0 flex gap-2'>
              {Object.keys(models).map(id => (
                <button 
                  key={id}
                  onClick={() => setActiveModel(id)}
                  className={`text-[9px] px-2 py-1 rounded-full border transition ${
                    activeModel === id ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 opacity-50'
                  }`}
                >
                  {models[id].name}
                </button>
              ))}
            </div>
            <input 
              className='w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-indigo-500/50 shadow-2xl transition'
              placeholder={`Vraag de Architect (via ${models[activeModel].name})...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isThinking && alert('API Call Logic: ' + activeModel)}
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
