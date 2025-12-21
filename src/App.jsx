import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';

// Sleutel-parameters
const MODELS = {
  gemini: 'gemini-3-pro-preview',
  gpt5: 'gpt-5',
  gpt5mini: 'gpt-5-mini'
};

// Voorbeeld tarieven (EUR per 1M tokens) - update volgens actuele tarieven
const RATES_EUR_PER_1M = {
  gemini: 4.5,
  gpt5: 6.0,
  gpt5mini: 1.2
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: '20px' }}>
          Er is iets misgegaan bij het laden van de applicatie. Bekijk de console voor details.
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  const [modelKey, setModelKey] = useState('gemini');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [totalCost, setTotalCost] = useState(0);

  // Knowledge module
  const [knowledge, setKnowledge] = useState([]);
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');

  // Audit module
  const [auditEntries, setAuditEntries] = useState([]);
  const [avgGeminiResponseMs, setAvgGeminiResponseMs] = useState(null);
  const [totalConsumedEuro, setTotalConsumedEuro] = useState(0);

  // UI panel: 'knowledge' or 'audit'
  const [panel, setPanel] = useState('knowledge');

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const activeModel = MODELS[modelKey];

  // Helpers: tokens & cost
  const estimateTokens = (text) => {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
  };

  const calculateCost = (text, modelKeyParam = modelKey) => {
    const tokens = estimateTokens(text);
    const rate = RATES_EUR_PER_1M[modelKeyParam] ?? RATES_EUR_PER_1M.gemini;
    return (tokens / 1_000_000) * rate;
  };

  const formattedCost = (c) => {
    return '€' + Number(c).toFixed(6);
  };

  // Re-evaluate API key presence whenever the active model changes or on mount
  useEffect(() => {
    try {
      // For Gemini require VITE_GEMINI_API_KEY specifically
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const openaiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_API_KEY;

      let present = true;
      if (modelKey === 'gemini') {
        present = !!geminiKey;
      } else {
        present = !!openaiKey;
      }

      setApiKeyMissing(!present);

      if (!present) {
        console.warn('API key ontbreekt voor het geselecteerde model. Gemini vereist VITE_GEMINI_API_KEY; GPT modellen vereisen VITE_OPENAI_API_KEY of VITE_API_KEY.');
      }
    } catch (err) {
      console.error('Fout bij controle van API keys:', err);
      setApiKeyMissing(true);
    }
  }, [modelKey]);

  // Firestore: realtime kennis listener
  useEffect(() => {
    let unsub = null;
    try {
      const db = getFirestore();
      const col = collection(db, 'knowledge');
      unsub = onSnapshot(col, (snap) => {
        const docs = [];
        snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
        setKnowledge(docs);
      }, (err) => {
        console.warn('Realtime kennislistener faalde:', err.message || err);
      });
    } catch (err) {
      console.warn('Firestore niet beschikbaar voor kennislistener:', err.message || err);
      // fallback: eenmalige fetch
      (async () => {
        try {
          const db = getFirestore();
          const snap = await getDocs(collection(db, 'knowledge'));
          const docs = [];
          snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
          setKnowledge(docs);
        } catch (e) {
          console.warn('Kon kennis niet laden:', e.message || e);
        }
      })();
    }
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // Firestore: audit & consumption listeners
  useEffect(() => {
    let unsubAudit = null;
    let unsubChat = null;
    try {
      const db = getFirestore();

      // last 5 audit entries ordered by createdAt desc
      const auditCol = collection(db, 'audit');
      const auditQuery = query(auditCol, orderBy('createdAt', 'desc'), limit(5));
      unsubAudit = onSnapshot(auditQuery, (snap) => {
        const entries = [];
        snap.forEach(d => entries.push({ id: d.id, ...d.data() }));
        setAuditEntries(entries);
      }, (err) => {
        console.warn('Audit listener failed:', err.message || err);
      });

      // total consumption & average Gemini response time from audit collection (live)
      const fullAuditCol = collection(db, 'audit');
      unsubChat = onSnapshot(fullAuditCol, (snap) => {
        let totalEuro = 0;
        let geminiTimes = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.costEstimated) totalEuro += Number(data.costEstimated) || 0;
          if (data.model === MODELS.gemini && data.responseTimeMs != null) geminiTimes.push(Number(data.responseTimeMs));
        });
        setTotalConsumedEuro(totalEuro);
        if (geminiTimes.length > 0) {
          const avg = geminiTimes.reduce((a, b) => a + b, 0) / geminiTimes.length;
          setAvgGeminiResponseMs(avg);
        } else {
          setAvgGeminiResponseMs(null);
        }
      }, (err) => {
        console.warn('Full audit listener failed:', err.message || err);
      });

    } catch (err) {
      console.warn('Firestore not available for audit listeners:', err.message || err);
    }

    return () => {
      if (typeof unsubAudit === 'function') unsubAudit();
      if (typeof unsubChat === 'function') unsubChat();
    };
  }, []);

  const downloadChatlog = () => {
    try {
      const data = JSON.stringify({ generatedAt: new Date().toISOString(), model: activeModel, messages }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `architect-log-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download Chatlog faalde:', err);
    }
  };

  const saveAIResponseToFirestore = async (responseText, metadata = {}) => {
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'chatResponses'), {
        text: responseText,
        model: activeModel,
        metadata,
        createdAt: new Date().toISOString()
      });

      // Also add an audit entry for this response (helps the audit module)
      await addDoc(collection(db, 'audit'), {
        action: 'ai_response',
        model: activeModel,
        costEstimated: Number(metadata.costEstimated) || 0,
        responseTimeMs: metadata.responseTimeMs ?? null,
        createdAt: new Date().toISOString(),
        info: metadata.info || null
      });

      console.log('AI response + audit entry opgeslagen.');
    } catch (err) {
      console.warn('AI response niet opgeslagen (Firestor niet beschikbaar of permissies):', err.message || err);
    }
  };

  // Knowledge ops with optimistic UI update
  const addKnowledge = async () => {
    if (!newKnowledgeTitle || !newKnowledgeContent) return;
    const optimistic = {
      id: 'local-' + Date.now(),
      title: newKnowledgeTitle,
      content: newKnowledgeContent,
      createdAt: new Date().toISOString()
    };

    // Optimistisch tonen
    setKnowledge(prev => [optimistic, ...prev]);
    setNewKnowledgeTitle('');
    setNewKnowledgeContent('');

    try {
      const db = getFirestore();
      await addDoc(collection(db, 'knowledge'), {
        title: optimistic.title,
        content: optimistic.content,
        createdAt: optimistic.createdAt
      });
      // onSnapshot zal de echte doc binnenhalen en de lokale optimistische entry vervangen wanneer beschikbaar
    } catch (err) {
      console.warn('Kon kennisitem niet toevoegen aan Firestore:', err.message || err);
    }
  };

  const updateKnowledge = async (id, updates) => {
    try {
      const db = getFirestore();
      const d = doc(db, 'knowledge', id);
      await setDoc(d, { ...updates }, { merge: true });
    } catch (err) {
      console.warn('Kon kennisitem niet bijwerken:', err.message || err);
    }
  };

  const deleteKnowledgeItem = async (id) => {
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'knowledge', id));
    } catch (err) {
      console.warn('Kon kennisitem niet verwijderen:', err.message || err);
    }
  };

  const sendMessage = async () => {
    if (!input || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // update cost with user tokens
    const userCost = calculateCost(userMsg.content, modelKey);
    setTotalCost(prev => prev + userCost);

    setLoading(true);
    let startMs = performance.now();
    try {
      // select the correct key depending on model
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const openaiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_API_KEY;
      const apiKey = modelKey === 'gemini' ? geminiKey : openaiKey;

      let aiText = '';

      if (!apiKey) {
        setApiKeyMissing(true);
        aiText = 'API key ontbreekt. Dit is een lokale simulatie van het AI-antwoord. Voeg je API key toe in de environment variables om echte antwoorden te krijgen.';
      } else {
        const payload = {
          model: activeModel,
          messages: [...messagesRef.current, userMsg].map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7
        };

        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`API-fout: ${resp.status} ${errText}`);
        }

        const data = await resp.json();
        aiText = data?.choices?.[0]?.message?.content ?? JSON.stringify(data);
      }

      const endMs = performance.now();
      const durationMs = Math.round(endMs - startMs);

      const aiMsg = { role: 'assistant', content: aiText };

      // cost voor AI antwoord
      const aiCost = calculateCost(aiText, modelKey);
      setTotalCost(prev => prev + aiCost);

      setMessages(prev => [...prev, aiMsg]);

      // sla antwoord en audit op in Firestore (indien beschikbaar)
      await saveAIResponseToFirestore(aiText, { costEstimated: aiCost, length: aiText.length, responseTimeMs: durationMs });

    } catch (err) {
      console.error('Fout tijdens message flow:', err);
      setMessages(prev => [...prev, { role: 'system', content: 'Er trad een fout op bij het ophalen van een AI-antwoord. Bekijk de console.' }]);
      // attempt to create an audit entry even in failure
      try {
        const db = getFirestore();
        await addDoc(collection(db, 'audit'), {
          action: 'ai_error',
          model: activeModel,
          error: String(err?.message ?? err),
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: '20px', color: '#fff', background: '#071022', minHeight: '100vh', boxSizing: 'border-box' }}>

        {apiKeyMissing && (
          <div style={{ background: '#b22222', color: '#fff', padding: '10px', marginBottom: '12px', borderRadius: '6px' }}>
            API key ontbreekt voor het geselecteerde model — sommige functies (echte AI-aanroepen, Firestore-writes) kunnen beperkt zijn. Voor Gemini voeg VITE_GEMINI_API_KEY toe; voor GPT modellen VITE_OPENAI_API_KEY of VITE_API_KEY.
          </div>
        )}

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h1 style={{ margin: 0 }}>Gemini 3 Pro Architecture</h1>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Actief model: <strong>{activeModel}</strong></div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ fontSize: '14px' }}>Totale geschatte kosten: <strong>{formattedCost(totalCost)}</strong></div>

            <select value={modelKey} onChange={(e) => setModelKey(e.target.value)} style={{ padding: '8px', borderRadius: '6px', background: '#0b1724', color: '#fff' }}>
              <option value='gemini'>Gemini 3 Pro Preview</option>
              <option value='gpt5'>GPT-5</option>
              <option value='gpt5mini'>GPT-5 Mini</option>
            </select>

            <button onClick={downloadChatlog} style={{ padding: '8px 12px', cursor: 'pointer' }}>Download Chatlog</button>
          </div>
        </header>

        <nav style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button onClick={() => setPanel('knowledge')} style={{ padding: '8px', background: panel === 'knowledge' ? '#0e2233' : '#071225', color: '#fff', borderRadius: '6px' }}>Knowledge</button>
          <button onClick={() => setPanel('audit')} style={{ padding: '8px', background: panel === 'audit' ? '#0e2233' : '#071225', color: '#fff', borderRadius: '6px' }}>Audit</button>
        </nav>

        <main style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px', marginBottom: '12px' }}>

          <section>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px', borderRadius: '8px', background: '#0b1a2b' }}>
              {messages.length === 0 && (
                <div style={{ color: '#9aa6b2' }}>Begin een gesprek door een vraag te typen en op Verzenden te klikken.</div>
              )}

              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>{m.role}</div>
                  <div style={{ padding: '10px', background: m.role === 'assistant' ? '#102033' : '#0d2233', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                </div>
              ))}
            </div>
          </section>

          <aside>
            {panel === 'knowledge' && (
              <div style={{ padding: '12px', borderRadius: '8px', background: '#071225' }}>
                <h3 style={{ marginTop: 0 }}>Knowledge Module</h3>

                <div style={{ marginBottom: '8px' }}>
                  <input placeholder='Titel' value={newKnowledgeTitle} onChange={(e) => setNewKnowledgeTitle(e.target.value)} style={{ width: '100%', marginBottom: '6px', padding: '8px', borderRadius: '6px', border: '1px solid #203040', background: '#031021', color: '#fff' }} />
                  <textarea placeholder='Inhoud' value={newKnowledgeContent} onChange={(e) => setNewKnowledgeContent(e.target.value)} rows={4} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #203040', background: '#031021', color: '#fff' }} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button onClick={addKnowledge} style={{ padding: '8px 10px', cursor: 'pointer' }}>Toevoegen</button>
                  </div>
                </div>

                <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                  {knowledge.length === 0 && <div style={{ color: '#9aa6b2' }}>Geen kennisitems gevonden.</div>}
                  {knowledge.map(k => (
                    <div key={k.id} style={{ marginBottom: '8px', padding: '8px', borderRadius: '6px', background: '#021827' }}>
                      <div style={{ fontWeight: '600' }}>{k.title}</div>
                      <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap', marginBottom: '6px' }}>{k.content}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { const updated = prompt('Bewerk inhoud:', k.content); if (updated !== null) updateKnowledge(k.id, { content: updated }); }} style={{ padding: '6px 8px' }}>Bewerk</button>
                        <button onClick={() => deleteKnowledgeItem(k.id)} style={{ padding: '6px 8px' }}>Verwijder</button>
                        <button onClick={() => { setMessages(prev => [...prev, { role: 'system', content: `Kennis item toegevoegd aan conversation context: ${k.title}` }, { role: 'assistant', content: k.content }]); }} style={{ padding: '6px 8px' }}>Gebruik</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {panel === 'audit' && (
              <div style={{ padding: '12px', borderRadius: '8px', background: '#071225' }}>
                <h3 style={{ marginTop: 0 }}>Audit</h3>
                <div style={{ marginBottom: '8px' }}>
                  <div>Gemiddelde Gemini responstijd: <strong>{avgGeminiResponseMs == null ? 'n.v.t.' : Math.round(avgGeminiResponseMs) + ' ms'}</strong></div>
                  <div>Totaal verbruik (EUR): <strong>{formattedCost(totalConsumedEuro)}</strong></div>
                </div>

                <div style={{ maxHeight: '48vh', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #203040' }}>
                        <th style={{ padding: '6px' }}>Tijd</th>
                        <th style={{ padding: '6px' }}>Actie</th>
                        <th style={{ padding: '6px' }}>Model</th>
                        <th style={{ padding: '6px' }}>Resp. (ms)</th>
                        <th style={{ padding: '6px' }}>Kosten</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEntries.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '8px', color: '#9aa6b2' }}>Geen recente audit-acties gevonden.</td></tr>
                      )}
                      {auditEntries.map(a => (
                        <tr key={a.id} style={{ borderBottom: '1px solid #0f2433' }}>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{new Date(a.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{a.action}</td>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{a.model || '-'}</td>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{a.responseTimeMs != null ? a.responseTimeMs + ' ms' : '-'}</td>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{a.costEstimated ? formattedCost(Number(a.costEstimated)) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </aside>

        </main>

        <footer style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
            placeholder={apiKeyMissing ? 'API key ontbreekt — invoer is beperkt' : 'Type je bericht...'}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #203040', background: '#071025', color: '#fff' }}
            disabled={loading && false}
          />
          <button onClick={sendMessage} disabled={loading} style={{ padding: '10px 14px', cursor: 'pointer' }}>{loading ? 'Bezig...' : 'Verzenden'}</button>
        </footer>

      </div>
    </ErrorBoundary>
  );
};

export default App;
