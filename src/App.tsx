import { useEffect, useState } from "react";

// ה-Backend ברנדר:
const API_BASE_URL = "https://legal-assistant-backend-1.onrender.com";

// ===== Types =====

type AppState = "idle" | "loading" | "success" | "error";

interface FocusOptions {
  negligence: boolean;
  causation: boolean;
  lifeExpectancy: boolean;
}

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
  focusOptions: FocusOptions;
  focusText: string;
  initialReport: string | null;
  comparisonReport: string | null;
  appState: AppState;
}

// ===== Component =====

function App() {
  // --- התחברות ---
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // --- תיקים ---
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [newCaseName, setNewCaseName] = useState("");

  // --- פרטי תיק ---
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editCase, setEditCase] = useState<CaseItem | null>(null);
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);

  // --- טאבים: התחברות / תיקים ---
  const [activeTab, setActiveTab] = useState<"login" | "cases">("login");

  // אחרי התחברות מוצלחת – נחליף אוטומטית לטאב "תיקים"
  useEffect(() => {
    if (user && token) {
      setActiveTab("cases");
    }
  }, [user, token]);

  // כאשר נבחר תיק – נטען אותו ל-editCase
  useEffect(() => {
    if (!selectedCaseId) {
      setEditCase(null);
      return;
    }
    const found = cases.find((c) => c.id === selectedCaseId) || null;
    setEditCase(found ? { ...found } : null);
    setDetailsMessage(null);
  }, [selectedCaseId, cases]);

  // ===== קריאות ל-API =====

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Login failed");
      }

      const data: LoginResponse = await response.json();
      setUser(data.user);
      setToken(data.token);
      setError(null);
    } catch (err: any) {
      setUser(null);
      setToken(null);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCases() {
    if (!token) return;
    setCasesLoading(true);
    setCasesError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load cases");
      }

      const data: CaseItem[] = await res.json();
      setCases(data);
    } catch (err: any) {
      setCasesError(err.message || "Unknown error while loading cases");
    } finally {
      setCasesLoading(false);
    }
  }

  // נטען תיקים כשעוברים לטאב "תיקים" אחרי התחברות
  useEffect(() => {
    if (activeTab === "cases" && user && token) {
      fetchCases();
    }
  }, [activeTab, user, token]);

  async function handleAddCase() {
    if (!newCaseName.trim()) {
      setCasesError("צריך שם תיק.");
      return;
    }
    if (!token) {
      setCasesError("צריך להיות מחובר כדי להוסיף תיק.");
      return;
    }

    setCasesError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCaseName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create case");
      }

      const created: CaseItem = await res.json();
      setCases((prev) => [created, ...prev]);
      setNewCaseName("");
      setCasesError(null);
      setSelectedCaseId(created.id);
    } catch (err: any) {
      setCasesError(err.message || "Unknown error while creating case");
    }
  }

  async function handleSaveCase() {
    if (!editCase || !token) return;

    setDetailsMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases/${editCase.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editCase.name,
          focusOptions: editCase.focusOptions,
          focusText: editCase.focusText,
          initialReport: editCase.initialReport,
          comparisonReport: editCase.comparisonReport,
          appState: editCase.appState,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save case");
      }

      const updated: CaseItem = await res.json();
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditCase(updated);
      setDetailsMessage("השינויים נשמרו בהצלחה ✔");
    } catch (err: any) {
      setDetailsMessage(err.message || "שגיאה בשמירת התיק");
    }
  }

  async function handleDeleteCase() {
    if (!editCase || !token) return;
    const confirmDelete = window.confirm(
      `למחוק את התיק "${editCase.name}"? לא ניתן לבטל.`
    );
    if (!confirmDelete) return;

    setDetailsMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases/${editCase.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete case");
      }

      setCases((prev) => prev.filter((c) => c.id !== editCase.id));
      setSelectedCaseId(null);
      setEditCase(null);
      setDetailsMessage("התיק נמחק.");
    } catch (err: any) {
      setDetailsMessage(err.message || "שגיאה במחיקת התיק");
    }
  }

  // ===== UI Helpers =====

  const selectedCase = editCase;

  // ===== UI =====

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
          maxWidth: "950px",
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
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px" }}>
            {/* צד שמאל – רשימת תיקים */}
            <div>
              <h2 style={{ marginBottom: "12px" }}>התיקים שלי</h2>

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

              {casesLoading && <p>טוען תיקים...</p>}

              {casesError && (
                <p style={{ color: "red", fontSize: "14px" }}>{casesError}</p>
              )}

              {!casesLoading && cases.length === 0 ? (
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
                      <th
                        style={{
                          textAlign: "right",
                          borderBottom: "1px solid #e5e7eb",
                          padding: "8px",
                        }}
                      >
                        פעולה
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
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: "8px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedCaseId(c.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "1px solid #2563eb",
                              background:
                                selectedCaseId === c.id ? "#2563eb" : "white",
                              color:
                                selectedCaseId === c.id ? "white" : "#2563eb",
                              cursor: "pointer",
                            }}
                          >
                            פרטי תיק
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* צד ימין – פרטי תיק */}
            <div
              style={{
                borderLeft: "1px solid #e5e7eb",
                paddingLeft: "16px",
              }}
            >
              <h2 style={{ marginBottom: "12px" }}>פרטי תיק</h2>

              {!selectedCase && (
                <p style={{ fontSize: "14px", color: "#555" }}>
                  בחר תיק מהרשימה כדי לראות ולערוך את פרטיו.
                </p>
              )}

              {selectedCase && (
                <>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ display: "block", marginBottom: "4px" }}>
                      שם התיק
                    </label>
                    <input
                      type="text"
                      value={selectedCase.name}
                      onChange={(e) =>
                        setEditCase(
                          selectedCase
                            ? { ...selectedCase, name: e.target.value }
                            : null
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      marginBottom: "10px",
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      fontSize: "14px",
                    }}
                  >
                    <span>
                      בעלים: <strong>{selectedCase.owner}</strong>
                    </span>
                    <span>
                      נוצר:{` `}
                      <strong>
                        {new Date(selectedCase.createdAt).toLocaleString(
                          "he-IL"
                        )}
                      </strong>
                    </span>
                    <span>
                      מצב אפליקציה: <strong>{selectedCase.appState}</strong>
                    </span>
                  </div>

                  <fieldset
                    style={{
                      marginBottom: "10px",
                      borderRadius: "4px",
                      border: "1px solid #e5e7eb",
                      padding: "8px",
                    }}
                  >
                    <legend style={{ padding: "0 4px" }}>מוקדי דגש</legend>
                    <label style={{ display: "block", marginBottom: "4px" }}>
                      <input
                        type="checkbox"
                        checked={selectedCase.focusOptions.negligence}
                        onChange={(e) =>
                          setEditCase(
                            selectedCase
                              ? {
                                  ...selectedCase,
                                  focusOptions: {
                                    ...selectedCase.focusOptions,
                                    negligence: e.target.checked,
                                  },
                                }
                              : null
                          )
                        }
                      />{" "}
                      רשלנות
                    </label>
                    <label style={{ display: "block", marginBottom: "4px" }}>
                      <input
                        type="checkbox"
                        checked={selectedCase.focusOptions.causation}
                        onChange={(e) =>
                          setEditCase(
                            selectedCase
                              ? {
                                  ...selectedCase,
                                  focusOptions: {
                                    ...selectedCase.focusOptions,
                                    causation: e.target.checked,
                                  },
                                }
                              : null
                          )
                        }
                      />{" "}
                      קשר סיבתי
                    </label>
                    <label style={{ display: "block", marginBottom: "4px" }}>
                      <input
                        type="checkbox"
                        checked={selectedCase.focusOptions.lifeExpectancy}
                        onChange={(e) =>
                          setEditCase(
                            selectedCase
                              ? {
                                  ...selectedCase,
                                  focusOptions: {
                                    ...selectedCase.focusOptions,
                                    lifeExpectancy: e.target.checked,
                                  },
                                }
                              : null
                          )
                        }
                      />{" "}
                      תוחלת חיים
                    </label>
                  </fieldset>

                  <div style={{ marginBottom: "8px" }}>
                    <label style={{ display: "block", marginBottom: "4px" }}>
                      טקסט חופשי למיקוד
                    </label>
                    <textarea
                      rows={3}
                      value={selectedCase.focusText}
                      onChange={(e) =>
                        setEditCase(
                          selectedCase
                            ? { ...selectedCase, focusText: e.target.value }
                            : null
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "8px" }}>
                    <label style={{ display: "block", marginBottom: "4px" }}>
                      דו"ח ראשוני
                    </label>
                    <textarea
                      rows={4}
                      value={selectedCase.initialReport ?? ""}
                      onChange={(e) =>
                        setEditCase(
                          selectedCase
                            ? {
                                ...selectedCase,
                                initialReport: e.target.value || null,
                              }
                            : null
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "8px" }}>
                    <label style={{ display: "block", marginBottom: "4px" }}>
                      דו"ח השוואתי
                    </label>
                    <textarea
                      rows={4}
                      value={selectedCase.comparisonReport ?? ""}
                      onChange={(e) =>
                        setEditCase(
                          selectedCase
                            ? {
                                ...selectedCase,
                                comparisonReport: e.target.value || null,
                              }
                            : null
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  {detailsMessage && (
                    <p
                      style={{
                        color: detailsMessage.includes("שגיאה") ? "red" : "green",
                        fontSize: "14px",
                        marginBottom: "8px",
                      }}
                    >
                      {detailsMessage}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      justifyContent: "flex-end",
                      marginTop: "8px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleDeleteCase}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "4px",
                        border: "none",
                        background: "#b91c1c",
                        color: "white",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      מחיקת תיק
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCase}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "4px",
                        border: "none",
                        background: "#2563eb",
                        color: "white",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      שמירת שינויים
                    </button>
                  </div>
                </>
              )}
            </div>
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
