import { useEffect, useMemo, useState } from "react";

const PROD_API_BASE_URL = "https://legal-assistant-backend-1.onrender.com";
const LOCAL_API_BASE_URL = "http://localhost:3001";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? LOCAL_API_BASE_URL : PROD_API_BASE_URL);

interface User {
  username: string;
  role: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

interface FocusOptions {
  negligence: boolean;
  causation: boolean;
  lifeExpectancy: boolean;
}

type AppState = "idle" | "loading" | "success" | "error" | "processing";

interface CaseData {
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

interface CaseDocumentSummary {
  id: string;
  caseId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  extractedTextPreview: string | null;
}

interface CaseDocument extends CaseDocumentSummary {
  extractedText: string | null;
}

interface LiteratureSource {
  title: string;
  journal?: string;
  year?: number;
  url?: string;
  summary: string;
  implication: string;
}

interface LiteratureReviewResult {
  question: string;
  sources: LiteratureSource[];
  overallSummary: string;
}

const defaultFocusOptions: FocusOptions = {
  negligence: false,
  causation: false,
  lifeExpectancy: false,
};

const formatBytes = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

function App() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [cases, setCases] = useState<CaseData[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [newCaseName, setNewCaseName] = useState("");
  const [casesMessage, setCasesMessage] = useState<string | null>(null);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFocusText, setEditFocusText] = useState("");
  const [editFocusOptions, setEditFocusOptions] = useState<FocusOptions>(defaultFocusOptions);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailDeleting, setDetailDeleting] = useState(false);

  const [activeTab, setActiveTab] = useState<"login" | "cases">("login");

  const [documents, setDocuments] = useState<CaseDocumentSummary[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<FileList | null>(null);
  const [documentUploadMessage, setDocumentUploadMessage] = useState<string | null>(null);
  const [documentUploadError, setDocumentUploadError] = useState<string | null>(null);
  const [documentTextLoadingId, setDocumentTextLoadingId] = useState<string | null>(null);
  const [selectedDocumentText, setSelectedDocumentText] = useState<CaseDocument | null>(null);

  const [initialReportLoading, setInitialReportLoading] = useState(false);
  const [comparisonReportLoading, setComparisonReportLoading] = useState(false);
  const [comparisonSelection, setComparisonSelection] = useState({
    reportAId: "",
    reportBId: "",
  });

  const [literatureQuestion, setLiteratureQuestion] = useState("");
  const [literatureLoading, setLiteratureLoading] = useState(false);
  const [literatureError, setLiteratureError] = useState<string | null>(null);
  const [literatureResult, setLiteratureResult] = useState<LiteratureReviewResult | null>(null);

  useEffect(() => {
    if (user && token) {
      setActiveTab("cases");
    }
  }, [user, token]);

  const selectedCase = useMemo(
    () => (selectedCaseId ? cases.find((c) => c.id === selectedCaseId) ?? null : null),
    [cases, selectedCaseId]
  );

  const authHeaders = useMemo<Record<string, string>>(
    () => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
    [token]
  );

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setUser(null);
      setToken(null);
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const loadCases = async () => {
    if (!token) return;
    setCasesLoading(true);
    setCasesError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases`, { headers: authHeaders });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load cases");
      }
      const data: CaseData[] = await response.json();
      setCases(data);
    } catch (error: unknown) {
      setCasesError(error instanceof Error ? error.message : "Unknown error while loading cases");
    } finally {
      setCasesLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadCases();
    } else {
      setCases([]);
      setSelectedCaseId(null);
    }
  }, [token]);

  const fetchDocuments = async (caseId: string) => {
    if (!token) return;
    setDocumentsLoading(true);
    setDocumentsError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/documents`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load documents");
      }

      const data: CaseDocumentSummary[] = await response.json();
      setDocuments(data);
    } catch (error: unknown) {
      setDocumentsError(error instanceof Error ? error.message : "שגיאה בטעינת מסמכים.");
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCaseId && token) {
      void fetchDocuments(selectedCaseId);
    } else {
      setDocuments([]);
      setSelectedDocumentText(null);
    }
  }, [selectedCaseId, token]);

  const handleAddCase = async () => {
    setCasesMessage(null);
    if (!newCaseName.trim()) {
      setCasesMessage("צריך שם תיק.");
      return;
    }
    if (!token) {
      setCasesMessage("צריך להיות מחובר כדי להוסיף תיק.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ name: newCaseName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create case");
      }

      const created: CaseData = await response.json();
      setCases((prev) => [created, ...prev]);
      setNewCaseName("");
      setCasesMessage("התיק נוצר בהצלחה.");
    } catch (error: unknown) {
      setCasesMessage(error instanceof Error ? error.message : "שגיאה ביצירת תיק.");
    }
  };

  const handleSelectCase = (caseItem: CaseData) => {
    setSelectedCaseId(caseItem.id);
    setEditName(caseItem.name);
    setEditFocusText(caseItem.focusText || "");
    setEditFocusOptions(caseItem.focusOptions ?? defaultFocusOptions);
    setDetailMessage(null);
    setDetailError(null);
    setDocumentUploadMessage(null);
    setDocumentUploadError(null);
    setLiteratureResult(null);
    setComparisonSelection({ reportAId: "", reportBId: "" });
  };

  const handleSaveCase = async () => {
    if (!selectedCase || !token) {
      setDetailError("צריך לבחור תיק ולהיות מחוברים.");
      return;
    }

    setDetailSaving(true);
    setDetailError(null);
    setDetailMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${selectedCase.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          name: editName.trim() || selectedCase.name,
          focusText: editFocusText,
          focusOptions: editFocusOptions,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update case");
      }

      const updated: CaseData = await response.json();
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setDetailMessage("התיק נשמר בהצלחה.");
    } catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : "שגיאה בשמירת התיק.");
    } finally {
      setDetailSaving(false);
    }
  };

  const handleDeleteCase = async () => {
    if (!selectedCase || !token) {
      setDetailError("צריך לבחור תיק ולהיות מחוברים.");
      return;
    }

    const confirmed = window.confirm("האם אתה בטוח שברצונך למחוק את התיק?");
    if (!confirmed) return;

    setDetailDeleting(true);
    setDetailError(null);
    setDetailMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${selectedCase.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete case");
      }

      setCases((prev) => prev.filter((c) => c.id !== selectedCase.id));
      setSelectedCaseId(null);
      setDocuments([]);
      setSelectedDocumentText(null);
      setDetailMessage("התיק נמחק.");
    } catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : "שגיאה במחיקת התיק.");
    } finally {
      setDetailDeleting(false);
    }
  };

  const handleUploadDocuments = async () => {
    if (!selectedCase || !token) {
      setDocumentUploadError("צריך לבחור תיק ולהתחבר.");
      return;
    }
    if (!documentFiles || documentFiles.length === 0) {
      setDocumentUploadError("בחר קבצים להעלאה.");
      return;
    }

    setDocumentUploadMessage(null);
    setDocumentUploadError(null);
    setDocumentsError(null);
    setDocumentsLoading(true);

    const formData = new FormData();
    Array.from(documentFiles).forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${selectedCase.id}/documents`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to upload documents");
      }

      const uploaded = data.documents as CaseDocumentSummary[];
      setDocumentUploadMessage(
        uploaded.length === 0
          ? "המסמכים לא הועלו. בדוק את הודעות השגיאה."
          : `הועלו ${uploaded.length} מסמכים בהצלחה.`
      );
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        setDocumentUploadError(data.errors.join("\n"));
      } else {
        setDocumentUploadError(null);
      }
      setDocumentFiles(null);
      await fetchDocuments(selectedCase.id);
    } catch (error: unknown) {
      setDocumentUploadError(error instanceof Error ? error.message : "שגיאה בהעלאת המסמכים.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleViewDocumentText = async (docId: string) => {
    if (!selectedCase || !token) return;
    setDocumentTextLoadingId(docId);
    setDocumentsError(null);
    setSelectedDocumentText(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${selectedCase.id}/documents/${docId}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load document");
      }

      const fullDoc: CaseDocument = await response.json();
      setSelectedDocumentText(fullDoc);
    } catch (error: unknown) {
      setDocumentsError(error instanceof Error ? error.message : "שגיאה בטעינת המסמך.");
    } finally {
      setDocumentTextLoadingId(null);
    }
  };

  const handleGenerateInitialReport = async () => {
    if (!selectedCase || !token) {
      setDetailError("צריך לבחור תיק ולהתחבר.");
      return;
    }

    setInitialReportLoading(true);
    setDetailError(null);
    setDetailMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${selectedCase.id}/initial-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate initial report");
      }

      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id ? { ...c, initialReport: data.initialReport ?? "" } : c
        )
      );
      setDetailMessage("דו\"ח ראשוני נוצר בהצלחה.");
    } catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : "שגיאה ביצירת הדו\"ח.");
    } finally {
      setInitialReportLoading(false);
    }
  };

  const handleGenerateComparisonReport = async () => {
    if (!selectedCase || !token) {
      setDetailError("צריך לבחור תיק ולהתחבר.");
      return;
    }

    if (!comparisonSelection.reportAId || !comparisonSelection.reportBId) {
      setDetailError("בחר שני מסמכים להשוואה.");
      return;
    }

    if (comparisonSelection.reportAId === comparisonSelection.reportBId) {
      setDetailError("יש לבחור שני מסמכים שונים.");
      return;
    }

    setComparisonReportLoading(true);
    setDetailError(null);
    setDetailMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${selectedCase.id}/comparison-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          reportAId: comparisonSelection.reportAId,
          reportBId: comparisonSelection.reportBId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate comparison report");
      }

      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id ? { ...c, comparisonReport: data.comparisonReport ?? "" } : c
        )
      );
      setDetailMessage("דו\"ח השוואתי נוצר בהצלחה.");
    } catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : "שגיאה ביצירת דו\"ח ההשוואה.");
    } finally {
      setComparisonReportLoading(false);
    }
  };

  const handleLiteratureSearch = async () => {
    if (!selectedCase || !token) {
      setLiteratureError("צריך לבחור תיק ולהתחבר.");
      return;
    }
    if (!literatureQuestion.trim()) {
      setLiteratureError("יש להזין שאלת חיפוש קלינית.");
      return;
    }

    setLiteratureLoading(true);
    setLiteratureError(null);
    setLiteratureResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${selectedCase.id}/literature-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ clinicalQuestion: literatureQuestion.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to run literature search");
      }

      setLiteratureResult(data as LiteratureReviewResult);
    } catch (error: unknown) {
      setLiteratureError(error instanceof Error ? error.message : "שגיאה בחיפוש הספרות.");
    } finally {
      setLiteratureLoading(false);
    }
  };

  const handleCopyReport = async (text: string | null, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setDetailMessage(`${label} הועתק ללוח.`);
    } catch {
      setDetailError("לא ניתן להעתיק ללוח בדפדפן זה.");
    }
  };

  const renderDocumentsSection = () => {
    if (!selectedCase) return null;

    return (
      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          background: "#f9fafb",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "8px" }}>מסמכים רפואיים / משפטיים</h3>
        <p style={{ fontSize: "12px", color: "#555" }}>
          ניתן להעלות קבצי PDF או DOCX (עד 10MB לקובץ). הטקסט מופק ונשמר במסד הנתונים.
        </p>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setDocumentFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={handleUploadDocuments}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "none",
              background: "#0ea5e9",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            העלה מסמכים לתיק
          </button>
        </div>
        {documentUploadMessage && (
          <p style={{ color: "#0f766e", fontSize: "13px", marginTop: "8px" }}>{documentUploadMessage}</p>
        )}
        {documentUploadError && (
          <p style={{ color: "red", fontSize: "13px", marginTop: "4px", whiteSpace: "pre-wrap" }}>
            {documentUploadError}
          </p>
        )}
        {documentsError && (
          <p style={{ color: "red", fontSize: "13px", marginTop: "4px" }}>{documentsError}</p>
        )}
        <div style={{ marginTop: "12px" }}>
          {documentsLoading ? (
            <p>טוען מסמכים...</p>
          ) : documents.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#555" }}>אין מסמכים בתיק זה עדיין.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "6px" }}>
                    קובץ
                  </th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "6px" }}>
                    גודל
                  </th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "6px" }}>
                    הועלה ב-
                  </th>
                  <th style={{ borderBottom: "1px solid #e5e7eb", padding: "6px" }} />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ padding: "6px", borderBottom: "1px solid #f3f4f6" }}>{doc.originalFilename}</td>
                    <td style={{ padding: "6px", borderBottom: "1px solid #f3f4f6" }}>
                      {formatBytes(doc.sizeBytes)}
                    </td>
                    <td style={{ padding: "6px", borderBottom: "1px solid #f3f4f6" }}>
                      {new Date(doc.createdAt).toLocaleString("he-IL")}
                    </td>
                    <td style={{ padding: "6px", borderBottom: "1px solid #f3f4f6", textAlign: "left" }}>
                      <button
                        type="button"
                        onClick={() => handleViewDocumentText(doc.id)}
                        disabled={documentTextLoadingId === doc.id}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "4px",
                          border: "1px solid #2563eb",
                          background: "white",
                          color: "#2563eb",
                          cursor: documentTextLoadingId === doc.id ? "default" : "pointer",
                        }}
                      >
                        {documentTextLoadingId === doc.id ? "טוען..." : "צפה בטקסט"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {selectedDocumentText && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              background: "white",
              border: "1px solid #cbd5f5",
              borderRadius: "4px",
              maxHeight: "240px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{selectedDocumentText.originalFilename}</strong>
              <button
                type="button"
                onClick={() => setSelectedDocumentText(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2563eb",
                  cursor: "pointer",
                }}
              >
                סגור
              </button>
            </div>
            <div style={{ marginTop: "8px" }}>
              {selectedDocumentText.extractedText ? selectedDocumentText.extractedText : "לא נמצא טקסט במערכת."}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReportSection = () => {
    if (!selectedCase) return null;

    return (
      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            padding: "12px",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            background: "#fdf2f8",
          }}
        >
          <h3 style={{ marginTop: 0 }}>דו&quot;ח ראשוני (AI)</h3>
          <button
            type="button"
            onClick={handleGenerateInitialReport}
            disabled={initialReportLoading}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "none",
              background: "#ec4899",
              color: "white",
              fontWeight: "bold",
              cursor: initialReportLoading ? "default" : "pointer",
              marginBottom: "8px",
            }}
          >
            {initialReportLoading ? "יוצר דו\"ח..." : "צור דו\"ח ראשוני (AI)"}
          </button>
          {selectedCase.initialReport ? (
            <>
              <div
                style={{
                  background: "white",
                  border: "1px solid #fbcfe8",
                  borderRadius: "4px",
                  padding: "8px",
                  maxHeight: "220px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  fontSize: "13px",
                }}
              >
                {selectedCase.initialReport}
              </div>
              <button
                type="button"
                onClick={() => handleCopyReport(selectedCase.initialReport, "הדו\"ח הראשוני")}
                style={{
                  marginTop: "8px",
                  border: "1px solid #ec4899",
                  borderRadius: "4px",
                  padding: "6px 10px",
                  background: "white",
                  color: "#ec4899",
                  cursor: "pointer",
                }}
              >
                העתק דו&quot;ח ללוח
              </button>
            </>
          ) : (
            <p style={{ fontSize: "13px", color: "#555" }}>עדיין לא נוצר דו&quot;ח ראשוני לתיק זה.</p>
          )}
        </div>

        <div
          style={{
            padding: "12px",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            background: "#eef2ff",
          }}
        >
          <h3 style={{ marginTop: 0 }}>דו&quot;ח השוואתי (AI)</h3>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <select
              value={comparisonSelection.reportAId}
              onChange={(event) =>
                setComparisonSelection((prev) => ({ ...prev, reportAId: event.target.value }))
              }
              style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #c7d2fe" }}
            >
              <option value="">בחר מסמך א'</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.originalFilename}
                </option>
              ))}
            </select>
            <select
              value={comparisonSelection.reportBId}
              onChange={(event) =>
                setComparisonSelection((prev) => ({ ...prev, reportBId: event.target.value }))
              }
              style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #c7d2fe" }}
            >
              <option value="">בחר מסמך ב'</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.originalFilename}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleGenerateComparisonReport}
            disabled={comparisonReportLoading || documents.length < 2}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "none",
              background: "#4f46e5",
              color: "white",
              fontWeight: "bold",
              cursor: comparisonReportLoading ? "default" : "pointer",
              marginBottom: "8px",
            }}
          >
            {comparisonReportLoading ? "יוצר דו\"ח..." : "צור דו\"ח השוואתי (AI)"}
          </button>
          {selectedCase.comparisonReport ? (
            <>
              <div
                style={{
                  background: "white",
                  border: "1px solid #dbeafe",
                  borderRadius: "4px",
                  padding: "8px",
                  maxHeight: "220px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  fontSize: "13px",
                }}
              >
                {selectedCase.comparisonReport}
              </div>
              <button
                type="button"
                onClick={() => handleCopyReport(selectedCase.comparisonReport, "דו\"ח ההשוואה")}
                style={{
                  marginTop: "8px",
                  border: "1px solid #4f46e5",
                  borderRadius: "4px",
                  padding: "6px 10px",
                  background: "white",
                  color: "#4f46e5",
                  cursor: "pointer",
                }}
              >
                העתק דו&quot;ח ללוח
              </button>
            </>
          ) : (
            <p style={{ fontSize: "13px", color: "#555" }}>טרם נוצר דו&quot;ח השוואתי.</p>
          )}
        </div>

        <div
          style={{
            padding: "12px",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            background: "#ecfdf5",
          }}
        >
          <h3 style={{ marginTop: 0 }}>חיפוש ספרות רפואית</h3>
          <textarea
            value={literatureQuestion}
            onChange={(event) => setLiteratureQuestion(event.target.value)}
            rows={3}
            placeholder="תאר בקצרה את השאלה הקלינית או המשפטית..."
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #bbf7d0",
              resize: "vertical",
              marginBottom: "8px",
            }}
          />
          <button
            type="button"
            onClick={handleLiteratureSearch}
            disabled={literatureLoading}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "none",
              background: "#16a34a",
              color: "white",
              fontWeight: "bold",
              cursor: literatureLoading ? "default" : "pointer",
              marginBottom: "8px",
            }}
          >
            {literatureLoading ? "מחפש מאמרים..." : "בצע חיפוש ספרות רפואית"}
          </button>
          {literatureError && (
            <p style={{ color: "red", fontSize: "13px" }}>{literatureError}</p>
          )}
          {literatureResult ? (
            <div
              style={{
                background: "white",
                border: "1px solid #bbf7d0",
                borderRadius: "4px",
                padding: "8px",
              }}
            >
              <strong>שאלה:</strong> {literatureResult.question}
              <ul style={{ fontSize: "13px", paddingInlineStart: "20px", marginTop: "8px" }}>
                {literatureResult.sources.map((source, index) => (
                  <li key={`${source.title}-${index}`} style={{ marginBottom: "6px" }}>
                    <div>
                      <strong>{source.title}</strong>{" "}
                      {source.year && <span>({source.year})</span>}{" "}
                      {source.journal && <em>{source.journal}</em>}
                    </div>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9" }}>
                        קישור למאמר
                      </a>
                    )}
                    <div>תקציר: {source.summary}</div>
                    <div>משמעות הגנתית: {source.implication}</div>
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: "13px", whiteSpace: "pre-wrap" }}>
                <strong>סיכום כולל:</strong> {literatureResult.overallSummary}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "#555" }}>טרם בוצע חיפוש ספרות עבור תיק זה.</p>
          )}
        </div>
      </div>
    );
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
        direction: "rtl",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "24px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "1200px",
        }}
      >
        <h1 style={{ marginBottom: "8px", textAlign: "center" }}>
          Medical Assistant – מערכת ניהול תיקים
        </h1>
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <embed
            src="/logo-lior-perry.pdf#toolbar=0&navpanes=0"
            type="application/pdf"
            style={{ width: "140px", height: "140px" }}
          />
        </div>
        <p style={{ fontSize: "12px", marginBottom: "16px", color: "#555", textAlign: "center" }}>
          כתובת ה-Backend: <strong>{API_BASE_URL}</strong>
        </p>

        <div style={{ display: "flex", marginBottom: "16px", borderBottom: "1px solid #e5e7eb" }}>
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              borderBottom: activeTab === "login" ? "3px solid #2563eb" : "3px solid transparent",
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
              borderBottom: activeTab === "cases" ? "3px solid #2563eb" : "3px solid transparent",
              background: "transparent",
              cursor: user ? "pointer" : "not-allowed",
              opacity: user ? 1 : 0.5,
              fontWeight: activeTab === "cases" ? "bold" : "normal",
            }}
          >
            תיקים
          </button>
        </div>

        {activeTab === "login" && (
          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            {loginError && <p style={{ color: "red", fontSize: "14px" }}>{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "4px",
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: "bold",
                cursor: loginLoading ? "default" : "pointer",
              }}
            >
              {loginLoading ? "מתחבר..." : "התחברות"}
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

        {activeTab === "cases" &&
          (user ? (
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ marginBottom: "12px" }}>התיקים שלי</h2>
                <div style={{ marginBottom: "12px", display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="שם תיק חדש..."
                      value={newCaseName}
                    onChange={(event) => setNewCaseName(event.target.value)}
                    style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
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
                      }}
                    >
                      הוסף תיק
                    </button>
                  </div>
                  {casesMessage && (
                  <p style={{ color: casesMessage.includes("שגיאה") ? "red" : "green", fontSize: "14px" }}>
                      {casesMessage}
                  </p>
                  )}
                  {casesLoading && <p>טוען תיקים...</p>}
                {casesError && <p style={{ color: "red", fontSize: "14px" }}>{casesError}</p>}
                  {!casesLoading && cases.length === 0 ? (
                    <p style={{ fontSize: "14px", color: "#555" }}>
                    אין עדיין תיקים. אפשר להתחיל על ידי הזנת שם תיק ולחיצה על &quot;הוסף תיק&quot;.
                    </p>
                  ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr>
                        <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                            שם התיק
                          </th>
                        <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                            בעלים
                          </th>
                        <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                            נוצר בתאריך
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                      {cases.map((caseItem) => (
                        <tr key={caseItem.id}>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: "8px",
                                cursor: "pointer",
                                color: "#2563eb",
                                textDecoration: "underline",
                              }}
                            onClick={() => handleSelectCase(caseItem)}
                            >
                            {caseItem.name}
                            </td>
                          <td style={{ borderBottom: "1px solid #f3f4f6", padding: "8px" }}>{caseItem.owner}</td>
                          <td style={{ borderBottom: "1px solid #f3f4f6", padding: "8px" }}>
                            {new Date(caseItem.createdAt).toLocaleString("he-IL")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

              <div style={{ width: "420px", borderLeft: "1px solid #e5e7eb", paddingLeft: "16px" }}>
                  <h2 style={{ marginBottom: "12px" }}>פרטי תיק</h2>
                  {!selectedCase ? (
                  <p style={{ fontSize: "14px", color: "#555" }}>בחר תיק מהרשימה כדי לראות ולערוך את פרטיו.</p>
                  ) : (
                    <>
                      <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", marginBottom: "4px" }}>שם התיק</label>
                        <input
                          type="text"
                          value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                        />
                      </div>
                      <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", marginBottom: "4px" }}>מאפייני פוקוס</label>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        {(
                          [
                            { key: "negligence", label: "רשלנות" },
                            { key: "causation", label: "קשר סיבתי" },
                            { key: "lifeExpectancy", label: "תוחלת חיים / נזק" },
                          ] as Array<{ key: keyof FocusOptions; label: string }>
                        ).map((option) => (
                          <label key={option.key} style={{ fontSize: "13px" }}>
                            <input
                              type="checkbox"
                              checked={editFocusOptions[option.key]}
                              onChange={(event) =>
                                setEditFocusOptions((prev) => ({
                                  ...prev,
                                  [option.key]: event.target.checked,
                                }))
                              }
                              style={{ marginInlineStart: "8px" }}
                            />
                            {option.label}
                        </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", marginBottom: "4px" }}>טקסט חופשי / הערות</label>
                        <textarea
                          value={editFocusText}
                        onChange={(event) => setEditFocusText(event.target.value)}
                        rows={5}
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                            resize: "vertical",
                          }}
                        />
                      </div>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                        <button
                          type="button"
                          onClick={handleSaveCase}
                          disabled={detailSaving}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "4px",
                            border: "none",
                            background: "#2563eb",
                            color: "white",
                            fontWeight: "bold",
                            cursor: detailSaving ? "default" : "pointer",
                          }}
                        >
                          {detailSaving ? "שומר..." : "שמור שינויים"}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteCase}
                          disabled={detailDeleting}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "4px",
                            border: "none",
                            background: "#dc2626",
                            color: "white",
                            fontWeight: "bold",
                            cursor: detailDeleting ? "default" : "pointer",
                          }}
                        >
                          {detailDeleting ? "מוחק..." : "מחק תיק"}
                        </button>
                      </div>
                    {detailMessage && <p style={{ color: "green", fontSize: "14px" }}>{detailMessage}</p>}
                    {detailError && <p style={{ color: "red", fontSize: "14px" }}>{detailError}</p>}
                    <div style={{ marginTop: "12px", fontSize: "12px", color: "#555" }}>
                        <div>
                          <strong>בעלים:</strong> {selectedCase.owner}
                        </div>
                        <div>
                          <strong>נוצר בתאריך:</strong>{" "}
                          {new Date(selectedCase.createdAt).toLocaleString("he-IL")}
                        </div>
                        <div>
                        <strong>מצב אפליקציה:</strong> {selectedCase.appState}
                        </div>
                      </div>
                    {renderDocumentsSection()}
                    {renderReportSection()}
                    </>
                  )}
                </div>
              </div>
          ) : (
            <p style={{ color: "red", fontSize: "14px" }}>צריך להתחבר לפני שמציגים תיקים.</p>
          ))}
      </div>
    </div>
  );
}

export default App;
