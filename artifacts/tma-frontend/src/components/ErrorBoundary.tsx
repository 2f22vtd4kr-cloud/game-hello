import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: unknown) {
    console.error("[ErrorBoundary]", err, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100dvh", padding: "2rem",
        background: "#050507", color: "#ef4444", textAlign: "center",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h2 style={{ marginBottom: "0.5rem", fontSize: "1.2rem" }}>
          Произошла системная ошибка
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
          Пожалуйста, перезапустите приложение.
        </p>
        <button
          onClick={() => this.setState({ hasError: false, message: "" })}
          style={{
            background: "linear-gradient(135deg,#a855f7,#db2777)",
            color: "#fff", border: "none", borderRadius: "12px",
            padding: "0.75rem 2rem", cursor: "pointer", fontSize: "0.9rem",
          }}
        >
          Перезапустить
        </button>
      </div>
    );
  }
}
