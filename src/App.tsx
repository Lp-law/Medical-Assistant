import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

interface User {
  username: string;
  role: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

function App() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Login failed");
      }

      const data: LoginResponse = await response.json();
      setUser(data.user);
      setToken(data.token);
    } catch (err: any) {
      setUser(null);
      setToken(null);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "24px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <h1 style={{ marginBottom: "16px", textAlign: "center" }}>
          Legal Assistant – Login
        </h1>

        <p style={{ fontSize: "12px", marginBottom: "12px", color: "#555" }}>
          ה־Backend: <strong>{API_BASE_URL}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: "12px",
                color: "red",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "none",
              background: "#2563eb",
              color: "white",
              fontWeight: "bold",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "מתחבר..." : "התחברות"}
          </button>
        </form>

        {user && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "4px",
              background: "#ecfdf5",
              border: "1px solid #4ade80",
              fontSize: "14px",
            }}
          >
            <div>מחובר בתור: <strong>{user.username}</strong></div>
            <div>תפקיד: <strong>{user.role}</strong></div>
            <div style={{ marginTop: "8px", wordBreak: "break-all" }}>
              <div style={{ fontWeight: "bold" }}>Token:</div>
              <div style={{ fontSize: "11px" }}>{token}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
