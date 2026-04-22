import { Component, type ReactNode } from "react"

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="h-full flex items-center justify-center bg-app font-mono p-8">
          <div className="text-center max-w-sm">
            <p className="text-3xl mb-4 opacity-40">⚠</p>
            <p className="text-text font-bold mb-2">Váratlan hiba</p>
            <p className="text-muted text-xs mb-6 break-all">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-accent text-sm hover:underline"
            >
              Újratöltés
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
