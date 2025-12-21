import React, { useState, useEffect, useRef } from 'react';
// ... rest van de imports ...
import { getFirestore, collection, addDoc } from 'firebase/firestore';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: '20px' }}>
          Er is iets misgegaan bij het laden van de applicatie. Kijk in de console voor details.
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const [hasError, setHasError] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Voeg een check toe bovenaan de component
  if (hasError) {
    return <div style={{color: 'white', padding: '20px'}}>Er is iets misgegaan bij het laden. Check de console of de Secrets.</div>;
  }

  // Berekening voor de kostenteller (gebaseerd op geschatte tokens)
  const calculateCost = (text) => {
    const tokens = text.length / 4; 
    return (tokens / 1000000) * 3.50; // Voorbeeldprijs Gemini 1.5 Pro
  };

  const downloadChatlog = () => {
    try {
      const data = JSON.stringify(messagesRef.current, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `architect-log-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  useEffect(() => {
    try {
      // Controleer of een API key aanwezig is (ondersteunt zowel VITE_OPENAI_API_KEY als VITE_API_KEY)
      const openaiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_API_KEY;
      if (!openaiKey) {
        console.warn('API key ontbreekt (VITE_OPENAI_API_KEY / VITE_API_KEY). Sommige functies zijn uitgeschakeld.');
        setApiKeyMissing(true);
      }

      // Optionele extra secrets
      const required = ['VITE_API_KEY', 'VITE_OTHER_SECRET'];
      const missing = required.filter(k => !import.meta.env[k]);
      if (missing.length > 0) {
        console.warn('Missing env variables:', missing);
      }
    } catch (err) {
      console.error('Error tijdens initialisatie:', err);
      setHasError(true);
    }
  }, []);

  const saveAIResponseToFirestore = async (responseText, metadata = {}) => {
    try {
      // Verwacht dat Firebase elders is geïnitialiseerd. getFirestore zal falen als dat niet zo is.
      const db = getFirestore();
      const doc = await addDoc(collection(db, 'chatResponses'), {
        text: responseText,
        createdAt: new Date().toISOString(),
        metadata,
      });
      console.log('AI response opgeslagen in Firestore, id:', doc.id);
    } catch (err) {
      console.warn('Kon AI response niet opslaan in Firestore (misschien niet geïnitialiseerd):', err.message || err);
    }
  };

  const sendMessage = async () => {
    if (!input || loading) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Tel tokens en kosten voor de gebruikersinvoer (optioneel)
    const userCost = calculateCost(userMsg.content);
    setTotalCost(prev => prev + userCost);

    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_API_KEY;
      let aiText = '';

      if (!apiKey) {
        // Geen key: bied visuele fallback en een gesimuleerde antwoord
        setApiKeyMissing(true);
        aiText = "API key ontbreekt. Dit is een lokale simulatie van het AI-antwoord. Voeg je API key toe in de environment variables om echte antwoorden te krijgen.";
      } else {
        // Voorbeeld: OpenAI Chat Completions call (verwacht key beschikbaar)
        const payload = {
          model: 'gpt-4o',
          messages: [...messagesRef.current, userMsg].map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
        };

        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`API-fout: ${resp.status} ${errText}`);
        }

        const data = await resp.json();
        // compatibel met OpenAI response-structuur
        aiText = data?.choices?.[0]?.message?.content ?? JSON.stringify(data);
      }

      const aiMsg = { role: 'assistant', content: aiText };

      // Bereken tokens en cost voor het AI-antwoord
      const aiCost = calculateCost(aiText);
      setTotalCost(prev => prev + aiCost);

      setMessages(prev => [...prev, aiMsg]);

      // Sla AI-response op in Firestore (met metadata zoals kosten en token-schatting)
      await saveAIResponseToFirestore(aiText, { costEstimated: aiCost, length: aiText.length });

    } catch (err) {
      console.error('Fout tijdens berichtverwerking:', err);
      // Toon foutbericht in de UI
      setMessages(prev => [...prev, { role: 'system', content: 'Er trad een fout op bij het ophalen van een AI-antwoord. Kijk in de console.' }] );
    } finally {
      setLoading(false);
    }
  };

  const formattedCost = (c) => {
    return '€' + c.toFixed(6);
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: '20px', color: '#fff', background: '#0b1020', minHeight: '100vh', boxSizing: 'border-box' }}>

        {apiKeyMissing && (
          <div style={{ background: '#8b0000', color: '#fff', padding: '10px', marginBottom: '12px', borderRadius: '6px' }}>
            API key ontbreekt — sommige functies (echte AI-aanroepen, nauwkeurige logging) zijn uitgeschakeld. Voeg VITE_OPENAI_API_KEY of VITE_API_KEY toe aan je environment variables.
          </div>
        )}

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0 }}>Architect Chat</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Totale geschatte kosten: <strong>{formattedCost(totalCost)}</strong></div>
            <button onClick={downloadChatlog} style={{ padding: '8px 12px', cursor: 'pointer' }}>Download Chatlog</button>
          </div>
        </header>

        <main style={{ marginBottom: '12px' }}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px', borderRadius: '8px', background: '#071225' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>{m.role}</div>
                <div style={{ padding: '8px', background: m.role === 'assistant' ? '#142134' : '#0f1b2a', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <div style={{ color: '#9aa6b2' }}>Begin een gesprek door een vraag te typen en op Verzenden te klikken.</div>
            )}
          </div>
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
