import { useEffect, useState } from "react";

// ה-Backend שרץ בענן ב-Render:
const API_BASE_URL = "https://legal-assistant-backend-1.onrender.com";

interface User {
  username: string;
  role: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

interface CaseItem {
  id: string;
  name: string;
  createdAt: string;
  owner: string;
}

function App() {
  // --- מצב התחברות ---
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // --- תיקים מה-backend ---
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [newCaseName, setNewCaseName] = useState("");
  const [casesMessage, setCasesMessage] = useState<string | null>(null);

  // --- טאבים: התחברות / תיקים ---
  const [activeTab, setActiveTab] = useState<"login" | "cases">("login");

  // אחרי התחברות מוצלחת – מעבר אוטומטי לטאב "תיקים"
  useEffect(() => {
    if (user && token) {
      setActiveTab("cases");
    }
  }, [user, token]);

  // טעינת תיקים מה-backend
  const loadCases = async () => {
    if (!token) return;
    setCasesLoading(true);
    setCasesError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load cases");
      }

      const data: CaseItem[] = await response.json();
      setCases(data);
    } catch (err: any) {
      setCasesError(err.message || "Unknown error while loading cases");
    } finally {
      setCasesLoading(false);
    }
  };

  // בכל פעם שעוברים לטאב "תיקים" ויש token – נטען מה-backend
  useEffect(() => {
    if (activeTab === "cases" && token) {
      loadCases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token]);

  // התחברות ל־Backend
  const handleLoginSubmit = async (e: React.FormEvent) => {
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
      setCasesMessage(null);
    } catch (err: any) {
      setUser(null);
      setToken(null);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // הוספת תיק חדש דרך ה-backend
  const handleAddCase = async () => {
    if (!newCaseName.trim()) {
      setCasesMessage("צריך שם תיק.");
      return;
    }

    if (!token) {
      setCasesMessage("צריך להיות מחובר כדי להוסיף תיק.");
      return;
    }

    try {
      setCasesMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCaseName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create case");
      }

      const created: CaseItem = await response.json();

      // מוסיפים לראש הרשימה
      setCases((prev) => [created, ...prev]);
      setNewCaseName("");
    } catch (err: any) {
      setCasesMessage(err.message || "שגיאה ביצירת תיק חדש");
    }
  };

  // UI – מעט עיצוב פשוט
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
          maxWidth: "700px",
        }}
      >
        {/* כותרת */}
        <h1 style={{ marginBottom: "8px", textAlign: "center" }}>
          Legal Assistant – Login & Cases
        </h1>

        <p
          style={{
            fontSize: "12px",
            marginBottom: "16px",
            color: "#555",
            textAlign: "center",
          }}
        >
          ה־Backend כרגע: <strong>{API_BASE_URL}</strong>
        </p>

        {/* טאבים */}
        <div
          style={{
            display: "flex",
            marginBottom: "16px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              borderBottom:
                activeTab === "login"
                  ? "3px solid #2563eb"
                  : "3px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === "login" ? "bold" : "normal",
            }}
          >
            התחברות
          </button>
          <button
            type="button"
            onClick={() => user && setActiveTab("cases")}
            disabled={!user}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              borderBottom:
                activeTab === "cases"
                  ? "3px solid #2563eb"
                  : "3px solid transparent",
              background: "transparent",
              cursor: user ? "pointer" : "not-allowed",
              opacity: user ? 1 : 0.5,
              fontWeight: activeTab === "cases" ? "bold" : "normal",
            }}
          >
            תיקים
          </button>
        </div>

        {/* טאב התחברות */}
        {activeTab === "login" && (
          <form onSubmit={handleLoginSubmit}>
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
                <div>
                  מחובר בתור: <strong>{user.username}</strong>
                </div>
                <div>
                  תפקיד: <strong>{user.role}</strong>
                </div>
              </div>
            )}
          </form>
        )}

        {/* טאב תיקים */}
        {activeTab === "cases" && user && (
          <div>
            <h2 style={{ marginBottom: "12px" }}>התיקים שלי</h2>

            {casesLoading && <p>טוען תיקים...</p>}

            <div
              style={{
                marginBottom: "12px",
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                type="text"
                placeholder="שם תיק חדש..."
                value={newCaseName}
                onChange={(e) => setNewCaseName(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
              <button
                type="button"
                onClick={handleAddCase}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "none",
                  background: "#16a34a",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                הוסף תיק
              </button>
            </div>

            {casesMessage && (
              <div
                style={{
                  marginBottom: "12px",
                  color: "red",
                  fontSize: "14px",
                }}
              >
                {casesMessage}
              </div>
            )}

            {casesError && (
              <div
                style={{
                  marginBottom: "12px",
                  color: "red",
                  fontSize: "14px",
                }}
              >
                שגיאה בטעינת תיקים: {casesError}
              </div>
            )}

            {cases.length === 0 && !casesLoading ? (
              <p style={{ fontSize: "14px", color: "#555" }}>
                אין עדיין תיקים. אפשר להתחיל על ידי הזנת שם תיק ולחיצה על
                &quot;הוסף תיק&quot;.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "right",
                        borderBottom: "1px solid #e5e7eb",
                        padding: "8px",
                      }}
                    >
                      שם התיק
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        borderBottom: "1px solid #e5e7eb",
                        padding: "8px",
                      }}
                    >
                      בעלים
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        borderBottom: "1px solid #e5e7eb",
                        padding: "8px",
                      }}
                    >
                      נוצר בתאריך
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id}>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: "8px",
                        }}
                      >
                        {c.name}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: "8px",
                        }}
                      >
                        {c.owner}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: "8px",
                        }}
                      >
                        {new Date(c.createdAt).toLocaleString("he-IL")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "cases" && !user && (
          <p style={{ color: "red", fontSize: "14px" }}>
            צריך להתחבר לפני שמציגים תיקים.
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
