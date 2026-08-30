import React from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; title?: string },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      const label = this.props.title || "Erro ao renderizar a página";
      return (
        <div className="p-8 m-8 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive">
          <h2 className="text-sm font-semibold mb-2">{label}</h2>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error.message}</pre>
          <pre className="text-[10px] mt-2 opacity-70 whitespace-pre-wrap max-h-60 overflow-auto">{this.state.error.stack}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 text-xs underline"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
