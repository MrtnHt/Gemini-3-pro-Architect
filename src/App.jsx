import React, { useState, useEffect } from 'react';
// ... rest van de imports ...

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
  
  // Voeg een check toe bovenaan de component
  if (hasError) {
    return <div style={{color: 'white', padding: '20px'}}>Er is iets misgegaan bij het laden. Check de console of de Secrets.</div>;
  }

  useEffect(() => {
    try {
      // Controleer of vereiste env-variabelen (Vite) aanwezig zijn
      const required = ['VITE_API_KEY', 'VITE_OTHER_SECRET'];
      const missing = required.filter(k => !import.meta.env[k]);
      if (missing.length > 0) {
        console.error('Missing env variables:', missing);
        setHasError(true);
      }
    } catch (err) {
      console.error('Error tijdens initialisatie:', err);
      setHasError(true);
    }
  }, []);

  return (
    <ErrorBoundary>
      <div style={{ padding: '20px', color: '#fff', background: '#111', minHeight: '100vh' }}>
        <h1>App geladen</h1>
        <p>De applicatie draait. Controleer de console voor eventuele waarschuwingen of fouten.</p>
      </div>
    </ErrorBoundary>
  );
};

export default App;
