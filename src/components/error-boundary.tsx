
'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Você também pode registrar o erro em um serviço de relatórios de erro
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // Você pode renderizar qualquer UI de fallback personalizada
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'sans-serif',
          padding: '20px',
          textAlign: 'center',
          border: '1px solid #ff000030',
          backgroundColor: '#fff0f0',
          color: '#333'
        }}>
          <h1 style={{ color: '#cc0000', marginBottom: '10px' }}>Oops! Algo deu errado.</h1>
          <p style={{ marginBottom: '5px' }}>Nossa equipe foi notificada e estamos trabalhando para corrigir.</p>
          <p style={{ marginBottom: '20px' }}>Por favor, tente atualizar a página ou volte mais tarde.</p>
          {/* Em desenvolvimento, você pode querer mostrar o erro */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '20px', textAlign: 'left', width: '100%', maxWidth: '800px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Detalhes do Erro (Dev)</summary>
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                background: '#f5f5f5',
                border: '1px solid #eee',
                padding: '15px',
                marginTop: '10px',
                borderRadius: '4px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {this.state.error.toString()}
                <br />
                <br />
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
