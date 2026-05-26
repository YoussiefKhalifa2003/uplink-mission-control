import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UPLINK render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.wrap}>
          <h1>Something went wrong</h1>
          <p>{this.state.error.message}</p>
          <p className={styles.hint}>
            Try a hard refresh. If the API is not running, start it with{" "}
            <code>pnpm --filter @uplink/api dev</code> in a separate terminal.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
