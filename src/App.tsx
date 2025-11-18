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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type ReportBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; listType: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "divider" }
  | { kind: "table"; headers: string[]; rows: string[][] };

const convertReportTextToBlocks = (content: string): ReportBlock[] => {
  if (!content) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const blocks: ReportBlock[] = [];
  let paragraphBuffer: string[] = [];
  let activeList: { listType: "ul" | "ol"; items: string[] } | null = null;
  let tableBuilder:
    | {
        headers: string[] | null;
        rows: string[][];
        lastRowIndex: number;
        lastColIndex: number;
      }
    | null = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const paragraphText = paragraphBuffer.join("\n").trim();
      if (paragraphText) {
        blocks.push({ kind: "paragraph", text: paragraphText });
      }
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (activeList && activeList.items.length > 0) {
      blocks.push({ kind: "list", listType: activeList.listType, items: activeList.items });
    }
    activeList = null;
  };

  const flushTable = () => {
    if (!tableBuilder) {
      return;
    }

    if (tableBuilder.rows.length > 0) {
      const normalizedHeaders = (
        tableBuilder.headers ??
        tableBuilder.rows[0].map((_, index) => `עמודה ${index + 1}`)
      ).map((header, index) => header || `שדה ${index + 1}`);

      const normalizedRows = tableBuilder.rows.map((row) => {
        if (row.length < normalizedHeaders.length) {
          return [...row, ...Array(normalizedHeaders.length - row.length).fill("")];
        }
        return row;
      });

      blocks.push({
        kind: "table",
        headers: normalizedHeaders,
        rows: normalizedRows,
      });
    }

    tableBuilder = null;
  };

  const isTableLine = (line: string) => {
    const trimmed = line.trimEnd();
    if (!trimmed.includes("|")) {
      return false;
    }
    const pipeCount = (trimmed.match(/\|/g) ?? []).length;
    return pipeCount >= 2 && /^\s*[\-|>\s|=_.א-תA-Za-z0-9]/.test(trimmed);
  };

  const extractTableCells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const isDividerRow = (cells: string[]) =>
    cells.length > 0 && cells.every((cell) => /^[-–—_=]+$/.test(cell));

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");
    const trimmed = line.trim();
    const lineIsTable = isTableLine(line);

    if (!lineIsTable && tableBuilder) {
      if (!trimmed) {
        flushTable();
        continue;
      }

      if (tableBuilder.lastRowIndex >= 0 && tableBuilder.lastColIndex >= 0) {
        const currentRow = tableBuilder.rows[tableBuilder.lastRowIndex];
        if (currentRow && typeof currentRow[tableBuilder.lastColIndex] === "string") {
          currentRow[tableBuilder.lastColIndex] = `${currentRow[tableBuilder.lastColIndex]} ${trimmed}`.trim();
          continue;
        }
      }
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (lineIsTable) {
      flushParagraph();
      flushList();

      const cells = extractTableCells(line);
      if (cells.length === 0 || isDividerRow(cells)) {
        continue;
      }

      if (!tableBuilder) {
        tableBuilder = {
          headers: null,
          rows: [],
          lastRowIndex: -1,
          lastColIndex: -1,
        };
      }

      if (!tableBuilder.headers) {
        tableBuilder.headers = [...cells];
      } else {
        const headers = tableBuilder.headers;
        const row = [...cells];
        if (headers) {
          while (headers.length < row.length) {
            headers.push(`שדה ${headers.length + 1}`);
          }
          while (row.length < headers.length) {
            row.push("");
          }
        }
        tableBuilder.rows.push(row);
        tableBuilder.lastRowIndex = tableBuilder.rows.length - 1;
        tableBuilder.lastColIndex = headers ? headers.length - 1 : row.length - 1;
      }

      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushTable();
      const level = Math.min(6, headingMatch[1].length);
      blocks.push({ kind: "heading", level, text: headingMatch[2].trim() });
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushTable();
      blocks.push({ kind: "divider" });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      flushTable();
      blocks.push({ kind: "quote", text: trimmed.replace(/^>\s?/, "") });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!activeList || activeList.listType !== "ul") {
        flushList();
        activeList = { listType: "ul", items: [] };
      }
      activeList.items.push(bulletMatch[1].trim());
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      if (!activeList || activeList.listType !== "ol") {
        flushList();
        activeList = { listType: "ol", items: [] };
      }
      activeList.items.push(numberedMatch[1].trim());
      continue;
    }

    paragraphBuffer.push(line.trimEnd());
  }

  flushParagraph();
  flushList();
  flushTable();

  if (blocks.length === 0 && content.trim()) {
    return [{ kind: "paragraph", text: content.trim() }];
  }

  return blocks;
};

const renderMultiline = (value: string) => escapeHtml(value).replace(/\n/g, "<br />");

const renderBlocksToHtml = (blocks: ReportBlock[]) => {
  if (blocks.length === 0) {
    return "<p class=\"report-paragraph\">עדיין לא נוצר תוכן לדו\"ח זה.</p>";
  }

  return blocks
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `<h${block.level} class="report-heading report-heading-${block.level}">${renderMultiline(
            block.text
          )}</h${block.level}>`;
        case "paragraph":
          return `<p class="report-paragraph">${renderMultiline(block.text)}</p>`;
        case "list": {
          const tag = block.listType === "ol" ? "ol" : "ul";
          const items = block.items.map((item) => `<li>${renderMultiline(item)}</li>`).join("");
          return `<${tag} class="report-list report-list-${block.listType}">${items}</${tag}>`;
        }
        case "quote":
          return `<blockquote class="report-quote">${renderMultiline(block.text)}</blockquote>`;
        case "divider":
          return `<hr class="report-divider" />`;
        case "table":
          return `<div class="report-table">
            ${block.rows
              .map(
                (row) => `
                <div class="report-table-card">
                  ${row
                    .map(
                      (cell, cellIndex) => `
                      <div class="report-table-field">
                        <div class="report-table-label">${escapeHtml(
                          block.headers[cellIndex] ?? `שדה ${cellIndex + 1}`
                        )}</div>
                        <div class="report-table-value">${renderMultiline(cell || "—")}</div>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              `
              )
              .join("")}
          </div>`;
        default:
          return "";
      }
    })
    .join("\n");
};

const buildWordHtml = (content: string) => {
  const blocks = convertReportTextToBlocks(content);
  const bodyContent = renderBlocksToHtml(blocks);

  const styles = `
    @page {
      margin: 2.5cm 2cm;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', 'Assistant', 'Alef', sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      direction: rtl;
    }

    .report-shell {
      margin: 0;
      padding: 40px 0;
    }

    .report-brand {
      max-width: 960px;
      margin: 0 auto 16px;
      text-align: right;
      color: #475569;
      font-size: 13px;
    }

    .report-brand strong {
      font-size: 16px;
      letter-spacing: 0.04em;
    }

    .report-container {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.12);
      border: 3px solid #e2e8f0;
    }

    .report-heading {
      font-weight: 700;
      margin-top: 1.6em;
      margin-bottom: 0.6em;
      color: #0f172a;
    }

    .report-heading-1 {
      font-size: 32px;
      border-bottom: 3px solid #f472b6;
      padding-bottom: 0.4em;
      margin-top: 0;
    }

    .report-heading-2 {
      font-size: 24px;
      border-right: 6px solid #c084fc;
      padding-right: 12px;
      color: #312e81;
    }

    .report-heading-3 {
      font-size: 20px;
      color: #0f766e;
    }

    .report-paragraph {
      font-size: 15px;
      line-height: 1.8;
      margin: 0 0 0.9em;
      color: #0f172a;
    }

    .report-list {
      font-size: 15px;
      line-height: 1.8;
      padding-inline-start: 1.2em;
      margin: 0 0 1em;
    }

    .report-list-ul li {
      margin-bottom: 0.4em;
    }

    .report-list-ol {
      padding-inline-start: 1.4em;
    }

    .report-quote {
      margin: 1.4em 0;
      padding: 1em 1.2em;
      border-right: 4px solid #38bdf8;
      background: #f0f9ff;
      border-radius: 12px;
      font-size: 15px;
      color: #0f172a;
    }

    .report-divider {
      border: none;
      border-top: 2px dashed #cbd5f5;
      margin: 2em 0;
    }

    .report-table {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin: 1.4em 0;
    }

    .report-table-card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: linear-gradient(135deg, #f8fafc 0%, #ffffff 60%);
      padding: 18px;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
    }

    .report-table-field {
      display: flex;
      flex-direction: column;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px dashed rgba(15, 23, 42, 0.12);
    }

    .report-table-field:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .report-table-label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: #0f172a;
      text-transform: uppercase;
      opacity: 0.7;
    }

    .report-table-value {
      font-size: 14px;
      line-height: 1.7;
      margin-top: 4px;
      color: #111827;
    }
  `;

  return `<!DOCTYPE html>
  <html lang="he" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>Medical Legal Report</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="report-shell">
        <div class="report-brand">
          <strong>Lior Perry · Medical-Legal Intelligence</strong><br />
          דו\"ח מיועד לעיון פנימי בלבד · סודי וחסוי
        </div>
        <div class="report-container">
          ${bodyContent}
        </div>
      </div>
    </body>
  </html>`;
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

interface DocumentClaim {
  id: string;
  caseId: string;
  documentId: string;
  orderIndex: number;
  claimTitle: string;
  claimSummary: string;
  category: string;
  confidence: number | null;
  sourceExcerpt: string | null;
  recommendation: string | null;
  tags: string[];
  createdAt: string;
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
  const [claimsByDocument, setClaimsByDocument] = useState<Record<string, DocumentClaim[]>>({});
  const [claimsModalDocument, setClaimsModalDocument] = useState<CaseDocumentSummary | null>(null);
  const [claimsLoadingId, setClaimsLoadingId] = useState<string | null>(null);
  const [claimsExtractingId, setClaimsExtractingId] = useState<string | null>(null);
  const [claimsMessage, setClaimsMessage] = useState<string | null>(null);
  const [claimsError, setClaimsError] = useState<string | null>(null);

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
    setClaimsByDocument({});
    setClaimsModalDocument(null);
    setClaimsMessage(null);
    setClaimsError(null);
    setClaimsLoadingId(null);
    setClaimsExtractingId(null);
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
      setClaimsByDocument((prev) => {
        if (!prev[docId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[docId];
        return next;
      });
      if (claimsModalDocument?.id === docId) {
        setClaimsModalDocument(null);
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

  const handleViewDocumentClaims = async (doc: CaseDocumentSummary) => {
    if (!selectedCase || !token) {
      setClaimsError("צריך לבחור תיק ולהתחבר.");
      return;
    }
    setClaimsLoadingId(doc.id);
    setClaimsError(null);
    setClaimsMessage(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cases/${selectedCase.id}/documents/${doc.id}/claims`,
        { headers: authHeaders }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "שגיאה בטעינת הטענות.");
      }

      const claimList: DocumentClaim[] = await response.json();
      setClaimsByDocument((prev) => ({ ...prev, [doc.id]: claimList }));
      setClaimsModalDocument(doc);
      if (claimList.length === 0) {
        setClaimsMessage("טרם נוצרו טענות למסמך זה.");
      }
    } catch (error: unknown) {
      setClaimsError(error instanceof Error ? error.message : "שגיאה בטעינת הטענות.");
    } finally {
      setClaimsLoadingId(null);
    }
  };

  const handleExtractDocumentClaims = async (doc: CaseDocumentSummary) => {
    if (!selectedCase || !token) {
      setClaimsError("צריך לבחור תיק ולהתחבר.");
      return;
    }

    setClaimsExtractingId(doc.id);
    setClaimsError(null);
    setClaimsMessage(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cases/${selectedCase.id}/documents/${doc.id}/claims/extract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "שגיאה בחילוץ הטענות מהמסמך.");
      }

      const claimList = data.claims as DocumentClaim[];
      setClaimsByDocument((prev) => ({ ...prev, [doc.id]: claimList }));
      setClaimsModalDocument(doc);
      setClaimsMessage(
        claimList.length > 0 ? "הטענות הופקו בהצלחה." : "לא נמצאו טענות חדשות במסמך."
      );
    } catch (error: unknown) {
      setClaimsError(error instanceof Error ? error.message : "שגיאה בחילוץ הטענות.");
    } finally {
      setClaimsExtractingId(null);
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

    const fileName = `${sanitizeFileName(baseName)}.doc`;
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
        {claimsMessage && (
          <p style={{ color: "#0f766e", fontSize: "12px", marginTop: "4px" }}>{claimsMessage}</p>
        )}
        {claimsError && (
          <p style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{claimsError}</p>
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
                {documents.map((doc) => {
                  const isTextLoading = documentTextLoadingId === doc.id;
                  const isDeleting = documentDeletingId === doc.id;
                  const isClaimsLoading = claimsLoadingId === doc.id;
                  const isClaimsExtracting = claimsExtractingId === doc.id;

                  return (
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
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => handleViewDocumentText(doc.id)}
                            disabled={isTextLoading}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "4px",
                              border: "1px solid #2563eb",
                              background: "white",
                              color: "#2563eb",
                              cursor: isTextLoading ? "default" : "pointer",
                            }}
                          >
                            {isTextLoading ? "טוען..." : "צפה בטקסט"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewDocumentClaims(doc)}
                            disabled={isClaimsLoading}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "4px",
                              border: "1px solid #0f766e",
                              background: "white",
                              color: "#0f766e",
                              cursor: isClaimsLoading ? "default" : "pointer",
                            }}
                          >
                            {isClaimsLoading ? "טוען טענות..." : "צפה בטענות"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExtractDocumentClaims(doc)}
                            disabled={isClaimsExtracting}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "4px",
                              border: "1px solid #0d9488",
                              background: "#0d9488",
                              color: "white",
                              cursor: isClaimsExtracting ? "default" : "pointer",
                            }}
                          >
                            {isClaimsExtracting ? "מחלץ..." : "חילוץ טענות"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            disabled={isDeleting}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "4px",
                              border: "1px solid #dc2626",
                              background: "white",
                              color: "#dc2626",
                              cursor: isDeleting ? "default" : "pointer",
                            }}
                          >
                            {isDeleting ? "מוחק..." : "מחק"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            <>
              <p style={{ fontSize: "13px", color: "#555" }}>עדיין לא נוצר דו&quot;ח ראשוני לתיק זה.</p>
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled
                  title="העתקה תתאפשר לאחר יצירת הדו&quot;ח"
                  style={{
                    border: "1px solid #f9a8d4",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    background: "#fff7fb",
                    color: "#f472b6",
                    cursor: "not-allowed",
                  }}
                >
                  העתק דו&quot;ח ללוח
                </button>
                <button
                  type="button"
                  disabled
                  title="ייצוא לקובץ Word זמין לאחר יצירת הדו&quot;ח"
                  style={{
                    border: "1px solid #f9a8d4",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    background: "#fff7fb",
                    color: "#f472b6",
                    cursor: "not-allowed",
                  }}
                >
                  יצוא לקובץ Word
                </button>
              </div>
            </>
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
            <>
              <p style={{ fontSize: "13px", color: "#555" }}>טרם נוצר דו&quot;ח השוואתי.</p>
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled
                  title="העתקה תתאפשר לאחר יצירת הדו&quot;ח"
                  style={{
                    border: "1px solid #c7d2fe",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    background: "#eef2ff",
                    color: "#818cf8",
                    cursor: "not-allowed",
                  }}
                >
                  העתק דו&quot;ח ללוח
                </button>
                <button
                  type="button"
                  disabled
                  title="ייצוא לקובץ Word זמין לאחר יצירת הדו&quot;ח"
                  style={{
                    border: "1px solid #c7d2fe",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    background: "#eef2ff",
                    color: "#818cf8",
                    cursor: "not-allowed",
                  }}
                >
                  יצוא לקובץ Word
                </button>
              </div>
            </>
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

  const renderClaimsModal = () => {
    if (!claimsModalDocument) {
      return null;
    }
    const claimList = claimsByDocument[claimsModalDocument.id] ?? [];
    const isLoadingClaims = claimsLoadingId === claimsModalDocument.id || claimsExtractingId === claimsModalDocument.id;

    return (
      <div className="modal-overlay">
        <div className="modal-card" style={{ maxWidth: "640px" }}>
          <div className="modal-header">
            <div>
              <strong>טענות מזוהות · {claimsModalDocument.originalFilename}</strong>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                הועלה ב-{new Date(claimsModalDocument.createdAt).toLocaleString("he-IL")}
              </div>
            </div>
            <button type="button" className="modal-close" onClick={() => setClaimsModalDocument(null)}>
              ✕
            </button>
          </div>
          <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {isLoadingClaims ? (
              <p style={{ fontSize: "13px" }}>טוען טענות מהמסמך...</p>
            ) : claimList.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#555" }}>
                לא נמצאו טענות שמורות למסמך זה. נסה לבצע חילוץ טענות.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                {claimList.map((claim) => (
                  <li
                    key={claim.id}
                    style={{
                      border: "1px solid #d1fae5",
                      borderRadius: "6px",
                      padding: "10px",
                      background: "#ecfdf5",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div>
                        <strong style={{ fontSize: "14px" }}>{claim.claimTitle}</strong>
                        <div style={{ fontSize: "12px", color: "#047857" }}>{claim.category}</div>
                      </div>
                      {typeof claim.confidence === "number" && (
                        <span style={{ fontSize: "12px", color: "#0f766e" }}>
                          אמינות: {(claim.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "13px", margin: "8px 0" }}>{claim.claimSummary}</p>
                    {claim.sourceExcerpt && (
                      <p style={{ fontSize: "12px", color: "#6b7280" }}>
                        <strong>ציטוט:</strong> {claim.sourceExcerpt}
                      </p>
                    )}
                    {claim.recommendation && (
                      <p style={{ fontSize: "12px", color: "#0f172a" }}>
                        <strong>המלצה:</strong> {claim.recommendation}
                      </p>
                    )}
                    {claim.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                        {claim.tags.map((tag) => (
                          <span
                            key={`${claim.id}-${tag}`}
                            style={{
                              fontSize: "11px",
                              background: "white",
                              border: "1px solid #a7f3d0",
                              borderRadius: "999px",
                              padding: "2px 8px",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
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
      {renderClaimsModal()}
    </div>
  );
}

export default App;
