import React from 'react';
import { AlertTriangle, Home, RefreshCw, Copy, Check } from 'lucide-react';
import { clearCorruptedSession } from '../utils/recovery.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Sudoku ErrorBoundary Caught Exception]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReturnHome = () => {
    clearCorruptedSession();
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopyError = () => {
    const details = `Error: ${this.state.error?.toString()}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || 'N/A'}`;
    navigator.clipboard?.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 sm:p-8 rounded-3xl border border-rose-500/40 shadow-2xl text-center space-y-5 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-lg border border-rose-500/30">
              <AlertTriangle size={36} className="animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-rose-400 tracking-tight">
                Game Session Interrupted
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 opacity-80 leading-relaxed">
                An unexpected UI render error occurred. Don't worry — your profile is safe, and you can recover instantly to the home lobby.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={this.handleReturnHome}
                className="w-full py-3.5 bg-accent-custom hover:bg-accent-hover text-white font-extrabold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-custom/25 cursor-pointer text-sm"
              >
                <Home size={17} />
                Return to Home & Recover
              </button>

              <button
                onClick={this.handleReload}
                className="w-full py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <RefreshCw size={14} />
                Try Reloading Page
              </button>
            </div>

            {/* Collapsible Error Debug Details */}
            <div className="text-left pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span className="font-mono font-semibold uppercase tracking-wider">Error Details</span>
                <button
                  onClick={this.handleCopyError}
                  className="hover:text-slate-200 transition-colors flex items-center gap-1 text-[10px] cursor-pointer"
                >
                  {this.state.copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{this.state.copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-[10px] font-mono text-rose-300/90 overflow-x-auto max-h-24 scrollbar-thin">
                {this.state.error?.toString() || 'Unknown runtime error'}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
