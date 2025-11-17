import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const PROD_API_BASE_URL = "https://legal-assistant-backend-1.onrender.com";
const LOCAL_API_BASE_URL = "http://localhost:3001";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? LOCAL_API_BASE_URL : PROD_API_BASE_URL);

const DEFAULT_MAX_UPLOAD_SIZE_MB = 25;
const configuredMaxUploadSizeMb = Number(
  import.meta.env.VITE_MAX_UPLOAD_SIZE_MB ?? `${DEFAULT_MAX_UPLOAD_SIZE_MB}`
);
const MAX_UPLOAD_SIZE_MB =
  Number.isFinite(configuredMaxUploadSizeMb) && configuredMaxUploadSizeMb > 0
    ? configuredMaxUploadSizeMb
    : DEFAULT_MAX_UPLOAD_SIZE_MB;

const sanitizeFileName = (value: string) => {
  const fallback = "medical_report";
  if (!value) {
    return fallback;
  }
  return value.trim().replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_") || fallback;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildWordHtml = (content: string) => {
  const escaped = escapeHtml(content);
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><pre style="font-family:'Segoe UI', sans-serif; white-space: pre-wrap;">${escaped}</pre></body></html>`;
};

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
  searchSuggestions?: string[];
}

type CaseActivityEventType = "case-created" | "document-uploaded" | "ai-event";

interface CaseActivityEvent {
  id: string;
  type: CaseActivityEventType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface CaseActivityResponse {
  events: CaseActivityEvent[];
}

interface AiUsageByAction {
  action: string;
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
}

interface AiUsageRecentEvent {
  id: string;
  caseId: string;
  username: string;
  action: string;
  status: "success" | "error";
  durationMs: number | null;
  costUsd: number | null;
  createdAt: string;
}

interface AiUsageSummaryResponse {
  rangeDays: number;
  summary: {
    totalCalls: number;
    totalCostUsd: number;
    avgDurationMs: number;
    totalTokens: number;
  };
  byAction: AiUsageByAction[];
  recent: AiUsageRecentEvent[];
}

const defaultFocusOptions: FocusOptions = {
  negligence: false,
  causation: false,
  lifeExpectancy: false,
};

const highlightDictionary: Record<keyof FocusOptions, string[]> = {
  negligence: ["רשלנות", "סטנדרט הטיפול", "negligence", "standard of care"],
  causation: ["קשר סיבתי", "causation", "etiology", "proximate cause"],
  lifeExpectancy: ["תוחלת חיים", "נכות", "life expectancy", "prognosis", "disability"],
};

const linkifyLine = (line: string, keyPrefix: string): ReactNode => {
  const regex = /(https?:\/\/[^\s]+)/g;
  const pieces: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      pieces.push(line.slice(lastIndex, match.index));
    }
    const url = match[0];
    pieces.push(
      <a key={`${keyPrefix}-url-${match.index}`} href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }

  if (lastIndex < line.length) {
    pieces.push(line.slice(lastIndex));
  }

  if (pieces.length === 0) {
    return line;
  }

  return pieces;
};

const renderTextWithLinks = (text: string | null) => {
  if (!text) {
    return null;
  }
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => (
    <span key={`line-${lineIndex}`}>
      {linkifyLine(line, `line-${lineIndex}`)}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </span>
  ));
};

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString("he-IL");
  } catch {
    return value;
  }
};

const extractHighlightedParagraphs = (text: string, focus: FocusOptions) => {
  const keywords = Object.entries(focus)
    .filter(([, enabled]) => enabled)
    .flatMap(([key]) => highlightDictionary[key as keyof FocusOptions])
    .filter(Boolean);

  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return paragraphs.map((paragraph, index) => {
    const highlighted =
      keywords.length > 0
        ? keywords.some((keyword) => paragraph.toLowerCase().includes(keyword.toLowerCase()))
        : false;
    return { id: `para-${index}`, content: paragraph, highlighted };
  });
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
  const [documentDeletingId, setDocumentDeletingId] = useState<string | null>(null);
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
  const [caseActivity, setCaseActivity] = useState<CaseActivityEvent[]>([]);
  const [caseActivityLoading, setCaseActivityLoading] = useState(false);
  const [caseActivityError, setCaseActivityError] = useState<string | null>(null);

  const [aiUsageSummary, setAiUsageSummary] = useState<AiUsageSummaryResponse | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [aiUsageError, setAiUsageError] = useState<string | null>(null);
  const [aiUsageRange, setAiUsageRange] = useState(30);

  useEffect(() => {
    if (user && token) {
      setActiveTab("cases");
    }
  }, [user, token]);

  const selectedCase = useMemo(
    () => (selectedCaseId ? cases.find((c) => c.id === selectedCaseId) ?? null : null),
    [cases, selectedCaseId]
  );

  const highlightedDocumentParagraphs = useMemo(() => {
    if (!selectedDocumentText?.extractedText) {
      return [];
    }
    const focusOptions = selectedCase?.focusOptions ?? defaultFocusOptions;
    return extractHighlightedParagraphs(selectedDocumentText.extractedText, focusOptions).map((paragraph, index) => ({
      id: `${selectedDocumentText.id}-p-${index}`,
      text: paragraph.content,
      highlight: paragraph.highlighted,
    }));
  }, [selectedCase?.focusOptions, selectedDocumentText]);

  const authHeaders = useMemo<Record<string, string>>(
    () => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
    [token]
  );

  const copyToClipboard = useCallback(
    async (value: string, label: string) => {
      if (!value) {
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        setDetailMessage(`${label} הועתק ללוח.`);
      } catch {
        setDetailError("העתקה ללוח נכשלה בדפדפן הנוכחי.");
      }
    },
    []
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

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setActiveTab("login");
    setCases([]);
    setSelectedCaseId(null);
    setDocuments([]);
    setCaseActivity([]);
    setSelectedDocumentText(null);
    setAiUsageSummary(null);
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

  const fetchCaseActivity = useCallback(
    async (caseId: string) => {
      if (!token) return;
      setCaseActivityLoading(true);
      setCaseActivityError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/activity`, {
          headers: authHeaders,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Failed to load case activity");
        }

        const data: CaseActivityResponse = await response.json();
        setCaseActivity(data.events);
      } catch (error: unknown) {
        setCaseActivityError(error instanceof Error ? error.message : "שגיאה בטעינת ציר הזמן.");
      } finally {
        setCaseActivityLoading(false);
      }
    },
    [authHeaders, token]
  );

  const loadAiUsage = useCallback(async () => {
    if (!token || user?.role !== "admin") {
      return;
    }

    setAiUsageLoading(true);
    setAiUsageError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/ai-usage?rangeDays=${aiUsageRange}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load AI usage summary");
      }

      const data: AiUsageSummaryResponse = await response.json();
      setAiUsageSummary(data);
    } catch (error: unknown) {
      setAiUsageError(error instanceof Error ? error.message : "שגיאה בטעינת נתוני ה-AI.");
    } finally {
      setAiUsageLoading(false);
    }
  }, [aiUsageRange, authHeaders, token, user]);

  useEffect(() => {
    if (selectedCaseId && token) {
      void fetchDocuments(selectedCaseId);
      void fetchCaseActivity(selectedCaseId);
    } else {
      setDocuments([]);
      setSelectedDocumentText(null);
      setCaseActivity([]);
    }
  }, [selectedCaseId, token, fetchCaseActivity]);

  useEffect(() => {
    if (user?.role === "admin" && token) {
      void loadAiUsage();
    } else {
      setAiUsageSummary(null);
    }
  }, [loadAiUsage, token, user]);

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
    setCaseActivity([]);
    setCaseActivityError(null);
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
      await fetchCaseActivity(selectedCase.id);
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

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedCase || !token) {
      setDocumentsError("צריך לבחור תיק ולהתחבר.");
      return;
    }

    const confirmed = window.confirm("האם למחוק את המסמך לצמיתות?");
    if (!confirmed) return;

    setDocumentDeletingId(docId);
    setDocumentsError(null);
    setDocumentUploadMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/${selectedCase.id}/documents/${docId}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "שגיאה במחיקת המסמך.");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      if (selectedDocumentText?.id === docId) {
        setSelectedDocumentText(null);
      }
      setDocumentsError(null);
      setDocumentUploadMessage("המסמך נמחק.");
      await fetchCaseActivity(selectedCase.id);
    } catch (error: unknown) {
      setDocumentsError(error instanceof Error ? error.message : "שגיאה במחיקת המסמך.");
    } finally {
      setDocumentDeletingId(null);
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
      await fetchCaseActivity(selectedCase.id);
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
      await fetchCaseActivity(selectedCase.id);
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
      await fetchCaseActivity(selectedCase.id);
    }
  };

  const handleCopyReport = (text: string | null, label: string) => {
    if (!text) return;
    void copyToClipboard(text, label);
  };

  const handleExportReportToWord = useCallback((text: string | null, baseName: string) => {
    if (!text) {
      return;
    }

    const fileName = `${sanitizeFileName(baseName)}.docx`;
    const html = buildWordHtml(text);
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const renderCaseSidebar = () => (
    <div className="sidebar-stack">
      <div className="panel-card">
        <h3 style={{ marginTop: 0 }}>צור תיק חדש</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="שם תיק..."
            value={newCaseName}
            onChange={(event) => setNewCaseName(event.target.value)}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
            }}
          />
          <button
            type="button"
            onClick={handleAddCase}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "none",
              background: "#0d9488",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            הוסף
          </button>
        </div>
        {casesMessage && (
          <p style={{ color: casesMessage.includes("שגיאה") ? "red" : "#0f766e", fontSize: "13px", marginTop: "8px" }}>
            {casesMessage}
          </p>
        )}
      </div>

      <div className="panel-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0 }}>התיקים שלי</h3>
          {casesLoading && <span style={{ fontSize: "12px", color: "#6b7280" }}>טוען...</span>}
        </div>
        {casesError && <p style={{ color: "red", fontSize: "13px" }}>{casesError}</p>}
        {!casesLoading && cases.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#555" }}>אין עדיין תיקים. אפשר להתחיל לפתוח תיק חדש.</p>
        ) : (
          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "6px" }}>שם התיק</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "6px" }}>בעלים</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: "6px" }}>נוצר</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => (
                  <tr key={caseItem.id}>
                    <td
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        padding: "6px",
                        cursor: "pointer",
                        color: "#2563eb",
                        textDecoration: selectedCaseId === caseItem.id ? "underline" : "none",
                      }}
                      onClick={() => handleSelectCase(caseItem)}
                    >
                      {caseItem.name}
                    </td>
                    <td style={{ borderBottom: "1px solid #f3f4f6", padding: "6px" }}>{caseItem.owner}</td>
                    <td style={{ borderBottom: "1px solid #f3f4f6", padding: "6px" }}>
                      {new Date(caseItem.createdAt).toLocaleDateString("he-IL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderCaseDetailsPanel = () => (
    <div className="panel-card">
      <h3 style={{ marginTop: 0 }}>פרטי תיק</h3>
      {!selectedCase ? (
        <p style={{ fontSize: "13px", color: "#555" }}>בחר תיק מהרשימה כדי לערוך את פרטיו.</p>
      ) : (
        <>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>שם התיק</label>
            <input
              type="text"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }}
            />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>מאפייני פוקוס</label>
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
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>טקסט חופשי / הערות</label>
            <textarea
              value={editFocusText}
              onChange={(event) => setEditFocusText(event.target.value)}
              rows={4}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #d1d5db",
                resize: "vertical",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
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
              {detailSaving ? "שומר..." : "שמור"}
            </button>
            <button
              type="button"
              onClick={handleDeleteCase}
              disabled={detailDeleting}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "4px",
                border: "none",
                background: "#dc2626",
                color: "white",
                fontWeight: "bold",
                cursor: detailDeleting ? "default" : "pointer",
              }}
            >
              {detailDeleting ? "מוחק..." : "מחק"}
            </button>
          </div>
          {detailMessage && <p style={{ color: "#0f766e", fontSize: "13px", marginTop: "8px" }}>{detailMessage}</p>}
          {detailError && <p style={{ color: "red", fontSize: "13px", marginTop: "8px" }}>{detailError}</p>}
          <div style={{ marginTop: "12px", fontSize: "12px", color: "#555" }}>
            <div>
              <strong>בעלים:</strong> {selectedCase.owner}
            </div>
            <div>
              <strong>נוצר:</strong> {new Date(selectedCase.createdAt).toLocaleString("he-IL")}
            </div>
            <div>
              <strong>מצב אפליקציה:</strong> {selectedCase.appState}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderDocumentsSection = () => {
    if (!selectedCase) return null;

    return (
      <div className="panel-card">
        <h3 style={{ marginTop: 0, marginBottom: "8px" }}>מסמכים רפואיים / משפטיים</h3>
        <p style={{ fontSize: "12px", color: "#555" }}>
          ניתן להעלות קבצי PDF או DOCX (עד {MAX_UPLOAD_SIZE_MB}MB לקובץ). הטקסט מופק ונשמר במסד הנתונים.
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
                    <td
                      style={{
                        padding: "6px",
                        borderBottom: "1px solid #f3f4f6",
                        wordBreak: "break-word",
                      }}
                    >
                      {doc.originalFilename}
                    </td>
                    <td style={{ padding: "6px", borderBottom: "1px solid #f3f4f6" }}>
                      {formatBytes(doc.sizeBytes)}
                    </td>
                    <td style={{ padding: "6px", borderBottom: "1px solid #f3f4f6" }}>
                      {new Date(doc.createdAt).toLocaleString("he-IL")}
                    </td>
                    <td style={{ padding: "6px", borderBottom: "1px solid #f3f4f6", textAlign: "left" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
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
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={documentDeletingId === doc.id}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "4px",
                            border: "1px solid #dc2626",
                            background: "white",
                            color: "#dc2626",
                            cursor: documentDeletingId === doc.id ? "default" : "pointer",
                          }}
                        >
                          {documentDeletingId === doc.id ? "מוחק..." : "מחק"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {renderTextWithLinks(selectedCase.initialReport)}
              </div>
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleCopyReport(selectedCase.initialReport, "הדו\"ח הראשוני")}
                  style={{
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
                <button
                  type="button"
                  onClick={() =>
                    handleExportReportToWord(
                      selectedCase.initialReport,
                      `initial-report-${selectedCase.name ?? selectedCase.id}`
                    )
                  }
                  style={{
                    border: "1px solid #ec4899",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    background: "#ec4899",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  יצוא לקובץ Word
                </button>
              </div>
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
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {renderTextWithLinks(selectedCase.comparisonReport)}
              </div>
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleCopyReport(selectedCase.comparisonReport, "דו\"ח ההשוואה")}
                  style={{
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
                <button
                  type="button"
                  onClick={() =>
                    handleExportReportToWord(
                      selectedCase.comparisonReport,
                      `comparison-report-${selectedCase.name ?? selectedCase.id}`
                    )
                  }
                  style={{
                    border: "1px solid #4f46e5",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    background: "#4f46e5",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  יצוא לקובץ Word
                </button>
              </div>
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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <a href={source.url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9" }}>
                          קישור למאמר
                        </a>
                        <button
                          type="button"
                          className="copy-chip"
                          onClick={() => copyToClipboard(source.url ?? "", `הקישור למאמר ${source.title}`)}
                          aria-label={`העתק קישור למאמר ${source.title}`}
                        >
                          העתק
                        </button>
                      </div>
                    )}
                    <div>תקציר: {source.summary}</div>
                    <div>משמעות הגנתית: {source.implication}</div>
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
                <strong>סיכום כולל:</strong>{" "}
                <span>{renderTextWithLinks(literatureResult.overallSummary)}</span>
              </div>
              {literatureResult.searchSuggestions && literatureResult.searchSuggestions.length > 0 && (
                <div style={{ marginTop: "8px", fontSize: "13px" }}>
                  <strong>מילות/משפטי חיפוש מומלצים:</strong>
                  <ul style={{ paddingInlineStart: "18px", marginTop: "4px" }}>
                    {literatureResult.searchSuggestions.map((suggestion, index) => (
                      <li key={`search-suggestion-${index}`}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "#555" }}>טרם בוצע חיפוש ספרות עבור תיק זה.</p>
          )}
        </div>
        {renderAiAnalyticsSection()}
      </div>
    );
  };

  function renderAiAnalyticsSection() {
    if (!user || user.role !== "admin") {
      return null;
    }
    return (
      <div
        style={{
          padding: "12px",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          background: "#fff7ed",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
          <h3 style={{ margin: 0 }}>מעקב עלויות AI</h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={aiUsageRange}
              onChange={(event) => setAiUsageRange(Number(event.target.value))}
              style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #fdba74", fontSize: "13px" }}
            >
              <option value={7}>7 ימים</option>
              <option value={30}>30 ימים</option>
              <option value={90}>90 ימים</option>
            </select>
            <button
              type="button"
              onClick={() => loadAiUsage()}
              disabled={aiUsageLoading}
              style={{
                padding: "6px 10px",
                borderRadius: "4px",
                border: "1px solid #fb923c",
                background: "white",
                color: "#ea580c",
                cursor: aiUsageLoading ? "default" : "pointer",
              }}
            >
              רענן
            </button>
          </div>
        </div>
        {aiUsageError && <p style={{ color: "red", fontSize: "13px" }}>{aiUsageError}</p>}
        {aiUsageLoading || !aiUsageSummary ? (
          <p style={{ fontSize: "13px" }}>טוען נתונים...</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "12px",
                marginTop: "12px",
                fontSize: "13px",
              }}
            >
              <div style={{ background: "#fff", borderRadius: "6px", padding: "8px", border: "1px solid #fed7aa" }}>
                <div style={{ color: "#9a3412" }}>סה"כ קריאות</div>
                <strong style={{ fontSize: "18px" }}>{aiUsageSummary.summary.totalCalls}</strong>
              </div>
              <div style={{ background: "#fff", borderRadius: "6px", padding: "8px", border: "1px solid #fed7aa" }}>
                <div style={{ color: "#9a3412" }}>עלות משוערת</div>
                <strong style={{ fontSize: "18px" }}>${aiUsageSummary.summary.totalCostUsd.toFixed(4)}</strong>
              </div>
              <div style={{ background: "#fff", borderRadius: "6px", padding: "8px", border: "1px solid #fed7aa" }}>
                <div style={{ color: "#9a3412" }}>זמן ממוצע</div>
                <strong style={{ fontSize: "18px" }}>{Math.round(aiUsageSummary.summary.avgDurationMs)}ms</strong>
              </div>
              <div style={{ background: "#fff", borderRadius: "6px", padding: "8px", border: "1px solid #fed7aa" }}>
                <div style={{ color: "#9a3412" }}>סה"כ טוקנים</div>
                <strong style={{ fontSize: "18px" }}>{aiUsageSummary.summary.totalTokens}</strong>
              </div>
            </div>
            {aiUsageSummary.byAction.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #fed7aa", padding: "6px" }}>פעולה</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #fed7aa", padding: "6px" }}>קריאות</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #fed7aa", padding: "6px" }}>עלות</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #fed7aa", padding: "6px" }}>
                        זמן ממוצע
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiUsageSummary.byAction.map((action) => (
                      <tr key={action.action}>
                        <td style={{ borderBottom: "1px solid #fff7ed", padding: "6px" }}>{action.action}</td>
                        <td style={{ borderBottom: "1px solid #fff7ed", padding: "6px" }}>{action.totalCalls}</td>
                        <td style={{ borderBottom: "1px solid #fff7ed", padding: "6px" }}>
                          ${action.totalCostUsd.toFixed(4)}
                        </td>
                        <td style={{ borderBottom: "1px solid #fff7ed", padding: "6px" }}>
                          {Math.round(action.avgDurationMs)}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {aiUsageSummary.recent.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <strong style={{ fontSize: "13px" }}>פעולות אחרונות:</strong>
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: "12px" }}>
                  {aiUsageSummary.recent.slice(0, 5).map((event) => (
                    <li key={event.id} style={{ borderBottom: "1px solid #ffe4c7", padding: "6px 0" }}>
                      {new Date(event.createdAt).toLocaleString("he-IL")} · {event.action} ·{" "}
                      {event.status === "success" ? "הצלחה" : "שגיאה"} ·{" "}
                      {event.costUsd ? `$${event.costUsd.toFixed(4)}` : "ללא עלות"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const renderDocumentModal = () => {
    if (!selectedDocumentText) {
      return null;
    }
    return (
      <div className="modal-overlay">
        <div className="modal-card">
          <div className="modal-header">
            <div>
              <strong>{selectedDocumentText.originalFilename}</strong>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                הועלה ב-{new Date(selectedDocumentText.createdAt).toLocaleString("he-IL")}
              </div>
            </div>
            <button type="button" className="modal-close" onClick={() => setSelectedDocumentText(null)}>
              ✕
            </button>
          </div>
          <div className="modal-body">
            {highlightedDocumentParagraphs.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#555" }}>לא נמצא טקסט זמין למסמך זה.</p>
            ) : (
              highlightedDocumentParagraphs.map((paragraph) => (
                <p
                  key={paragraph.id}
                  className={paragraph.highlight ? "highlighted-paragraph" : undefined}
                  style={{ fontSize: "13px", lineHeight: 1.6 }}
                >
                  {paragraph.text}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTimelinePanel = () => {
    if (!selectedCase) {
      return null;
    }

    return (
      <div className="panel-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>ציר זמן</h3>
          <button
            type="button"
            onClick={() => fetchCaseActivity(selectedCase.id)}
            style={{ border: "none", background: "transparent", color: "#2563eb", cursor: "pointer", fontSize: "13px" }}
          >
            רענן
          </button>
        </div>
        {caseActivityError && <p style={{ color: "red", fontSize: "13px" }}>{caseActivityError}</p>}
        {caseActivityLoading ? (
          <p style={{ fontSize: "13px" }}>טוען אירועים...</p>
        ) : caseActivity.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#555" }}>טרם נרשמו אירועים בתיק זה.</p>
        ) : (
          <ul className="timeline-list" style={{ marginTop: "12px" }}>
            {caseActivity.slice(0, 18).map((event) => (
              <li key={event.id} className="timeline-item">
                <p className="timeline-title">{event.title}</p>
                <p className="timeline-meta">{formatDateTime(event.timestamp)}</p>
                {event.description && (
                  <p style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>{event.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const showWorkspace = Boolean(user && activeTab === "cases");
  const showLoginView = !user || activeTab === "login";

  return (
    <div className="app-shell">
      <header className="app-toolbar">
        <div className="toolbar-left">
          <object
            data="/logo-lior-perry.pdf#toolbar=0&navpanes=0"
            type="application/pdf"
            className="toolbar-logo"
          >
            <p>Logo</p>
          </object>
          <div>
            <div className="app-title">Medical Assistant</div>
            <div className="app-subtitle">Lior Perry Law Office</div>
          </div>
        </div>
        <div className="toolbar-right">
          <span className="backend-url">Backend: {API_BASE_URL}</span>
          {user ? (
            <>
              <span>שלום, {user.username}</span>
              <button type="button" className="ghost-btn" onClick={handleLogout}>
                יציאה
              </button>
            </>
          ) : (
            <span>לא מחובר</span>
          )}
        </div>
      </header>

      <div className="app-body">
        {showLoginView ? (
          <div className="login-card">
            <h2>התחברות</h2>
            <form onSubmit={handleLoginSubmit} style={{ width: "100%" }}>
              <div className="form-field">
                <label>Username</label>
                <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
              </div>
              <div className="form-field">
                <label>Password</label>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              {loginError && <p className="error-text">{loginError}</p>}
              <button type="submit" className="primary-btn" disabled={loginLoading}>
                {loginLoading ? "מתחבר..." : "התחברות"}
              </button>
            </form>
          </div>
        ) : showWorkspace ? (
          <div className="workspace-grid">
            <aside className="sidebar-column">{renderCaseSidebar()}</aside>
            <div className="workspace-column" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {renderCaseDetailsPanel()}
              {renderDocumentsSection()}
              {renderTimelinePanel()}
            </div>
            <div className="workspace-column">{renderReportSection()}</div>
          </div>
        ) : null}
      </div>
      {renderDocumentModal()}
    </div>
  );
}

export default App;
