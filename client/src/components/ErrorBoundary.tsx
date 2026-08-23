import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="glass-card p-8 max-w-md text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold mb-2">出了点小问题</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="btn-primary text-sm"
            >
              重新加载
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
