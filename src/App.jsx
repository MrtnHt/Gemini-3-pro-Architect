import React, { useEffect, useMemo, useRef, useState } from 'react';
import {  Send, Bot, User, Loader2, Trash2, Download,  BarChart3, Database, MessageSquare, Bug, Book,  UserCheck, Plus, FileText, Layers, Zap, Shield,  Home, Bookmark, Wrench, LineChart, Settings} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';

// --- INITIALISATIE & CONFIGURATIE ---
let parsedFirebase = {};
try {
  parsedFirebase = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : (import.meta?.env?.VITE_FIREBASE_CONFIG_JSON || '{}'));
} catch (e) { parsedFirebase = {}; }
const firebaseConfig = parsedFirebase;
// Fallback init om crashes te voorkomen als config leeg is
const app = Object.keys(firebaseConfig).length ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

const appId = typeof __app_id !== 'undefined' ? __app_id : (import.meta?.env?.VITE_APP_ID || 'architect-pro-ultra-v3');
const apiKey = (typeof window !== 'undefined' && window.__gemini_api_key) ? window.__gemini_api_key : (import.meta?.env?.VITE_GEMINI_API_KEY || '');
const GEMINI_MODEL = 'gemini-1.5-pro'; 

const BottomNav = ({ activeTab, setActiveTab, totalCost }) => {
  const items = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'knowledge', label: 'Kennis', icon: Book },
    { id: 'debugger', label: 'Debug', icon: Bug },
    { id: 'profile', label: 'Profiel', icon: UserCheck },
    { id: 'analytics', label: 'Audit', icon: BarChart3 }
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 pb-4 bg-slate-950/90 backdrop-blur border-t border-slate-800">
      <ul className="grid grid-cols-5 h-16 items-center">
        {items.map(({ id, label, icon: Icon }) => (
          <li key={id} className="flex justify-center">
            <button onClick={() => setActiveTab(id)} className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors ${activeTab === id ? 'text-indigo-400' : 'text-slate-500'}`}>
              <Icon size={20} />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [userProfile, setUserProfile] = useState({ name: 'Architect', role: 'Admin', preferences: '', currentSummary: '' });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [debugCode, setDebugCode] = useState('');
  const [debugResult, setDebugResult] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if(!auth) return;
    signInAnonymously(auth).catch(e => console.warn('Auth error', e));
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'messages'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(data);
      setTotalCost(data.reduce((acc, curr) => acc + (curr.cost || 0), 0));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const callArchitect = async (userPrompt, isDebug = false) => {
    if (!userPrompt?.trim() || isLoading) return;
    setIsLoading(true);
    
    // Fallback UI update voor offline/no-db mode
    if (!db) {
        setMessages(prev => [...prev, { role: 'user', text: userPrompt, timestamp: new Date().toISOString() }]);
    }

    try {
      if(!apiKey) throw new Error('Geen API Key. Stel VITE_GEMINI_API_KEY in.');
      
      const systemPrompt = isDebug ? 'Je bent een Code Debugger. Output JSON.' : `Je bent Architect AI. Gebruiker: ${userProfile.name}.`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      const data = await response.json();
      const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Geen antwoord.';
      
      if (isDebug) {
         try { setDebugResult(JSON.parse(aiResponse)); } catch { setDebugResult({ raw: aiResponse }); }
      } else {
         if (db && user) {
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'messages'), { role: 'user', text: userPrompt, timestamp: new Date().toISOString() });
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'messages'), { role: 'model', text: aiResponse, timestamp: new Date().toISOString() });
         } else {
            setMessages(prev => [...prev, { role: 'model', text: aiResponse, timestamp: new Date().toISOString() }]);
         }
      }
    } catch (err) {
      if(!db) setMessages(prev => [...prev, { role: 'model', text: `Error: ${err.message}`, timestamp: new Date().toISOString() }]);
      console.error(err);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c12] text-slate-300 font-sans flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-slate-950 border-r border-slate-800 flex-col p-6">
        <div className="text-white font-bold text-xl mb-10 flex items-center gap-2"><Zap className="text-indigo-500"/> Architect Pro</div>
        <nav className="space-y-2">
          {['chat', 'knowledge', 'debugger', 'profile', 'analytics'].map(id => (
            <button key={id} onClick={() => setActiveTab(id)} className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${activeTab === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-[100dvh] pb-20 md:pb-0">
        <header className="h-16 border-b border-slate-800 flex items-center px-6 justify-between shrink-0">
            <div className="font-mono text-xs text-slate-500 uppercase tracking-widest">{activeTab} MODULE</div>
            <div className="flex gap-2 items-center text-sm font-bold"><UserCheck size={16} className="text-indigo-500"/> {userProfile.name}</div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
            {activeTab === 'chat' && (
                <div className="space-y-4">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl shadow-md ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 border border-slate-700 rounded-tl-sm'}`}>
                                <div className="prose prose-invert prose-sm">{m.text}</div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            )}
            
            {activeTab === 'debugger' && (
                <div className="space-y-4">
                    <textarea 
                        className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-sm text-indigo-300 focus:outline-none focus:border-indigo-500" 
                        placeholder="Plak hier je code..."
                        value={debugCode}
                        onChange={e => setDebugCode(e.target.value)}
                    />
                    <button onClick={() => callArchitect(debugCode, true)} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2">
                        {isLoading ? <Loader2 className="animate-spin"/> : <Bug/>} Analyseer Code
                    </button>
                    {debugResult && <pre className="bg-slate-900 p-4 rounded-xl text-xs overflow-auto border border-slate-800">{JSON.stringify(debugResult, null, 2)}</pre>}
                </div>
            )}
            
            {(activeTab === 'knowledge' || activeTab === 'profile' || activeTab === 'analytics') && (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                    <Layers size={48} className="mb-4 opacity-50"/>
                    <p>Module {activeTab} is geactiveerd.</p>
                </div>
            )}
        </div>

        {/* Chat Input */}
        {activeTab === 'chat' && (
            <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <input 
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && callArchitect(input)}
                        placeholder="Vraag de Architect..."
                    />
                    <button onClick={() => callArchitect(input)} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-2xl disabled:opacity-50 transition-colors">
                        {isLoading ? <Loader2 className="animate-spin"/> : <Send />}
                    </button>
                </div>
            </div>
        )}
      </main>
      
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} totalCost={totalCost} />
    </div>
  );
};

export default App;
