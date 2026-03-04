# ULTRA AUDIT – LexMedical (מחשבון נזק ורשת ידע רשלנות רפואית)

**תאריך:** מרץ 2025  
**סקופ:** פרויקט LexMedical-App – מחשבון נזק (תחשיבי נזק), עוזר חיפוש (בוט), API ו-DB.

---

## A) Executive Summary – 20 הנקודות החשובות

| # | ממצא |
|---|------|
| 1 | **האפליקציה הנוכחית (Frontend)** מציגה רק **מחשבון נזק** + כפתור עוזר; אין בממשק "מחשבון הערכת סיכון" נפרד – החישוב הוא **חשיפת נזק כספי** (תובע/נתבע/ממוצע) עם הפחתות ואשם תורם. |
| 2 | **מנוע "סיכון"** במובן איכות/חוזק ראיות קיים ב-**Backend**: `medicalQualityAnalyzer` (ציון 0–100), `KnowledgeDocument.score` ו-`medicalQualityScore` – לא מחובר ל-Frontend של המחשבון. |
| 3 | **חישוב הנזק** מתבצע כולו ב-**Client** (React): סיכום שורות, אשם תורם, הפחתות (מכפלה), חלוקת נתבעים – אין קריאת API לחישוב. |
| 4 | **הבוט** במצב `calculator`: **placeholder בלבד** – מודל לא קורא ל-API; רק הודעה שהפיצ'ר יגיע "בגרסאות הבאות". |
| 5 | **הבוט** במצב `documents`: קורא ל-`POST /api/assistant/search` – **Query expansion** ב-Azure OpenAI, затем חיפוש ב-**Postgres** (טבלאות Document + Category) ב-ILIKE, לא Azure Search. |
| 6 | **אבטחה:** Auth עם JWT (Bearer / cookie), `requireAuth` על `/api/assistant`; `.env` ב-gitignore; מפתחות Azure לא נחשפים ב-Frontend. |
| 7 | **פרטיות:** `storageGuard` חוסם מפתחות שמתחילים ב-`lexmedical_` ב-localStorage (מדיניות PHI); המחשבון משתמש ב-`calc_*` ולכן מותר. |
| 8 | **נתונים:** המחשבון שומר רק ב-localStorage (גם תבניות); אין DB לצד הלקוח למחשבון. |
| 9 | **Backend:** Express, Prisma, PostgreSQL; יש טבלאות Document, Category, KnowledgeDocument, Case, User, וכו'. |
| 10 | **אין CI/CD** בפרויקט (אין `.github/workflows` ברמת הריפו); דיפלוי מתועד ידנית ל-Render. |
| 11 | **בדיקות:** ב-API יש unit/integration (literature, knowledge, medicalQualityAnalyzer, cases, וכו'); ב-Frontend רק `placeholder.test.ts`. |
| 12 | **סיכוני בוט:** שאילתת המשתמש נשלחת ל-OpenAI (query expansion) ויכולה להכיל תוכן רגיש; אין rate limit ייעודי ל-assistant; אין גיבוי מפני prompt injection. |
| 13 | **RTL ו-a11y:** `dir="rtl"` באפליקציה; כפתורים עם `aria-label`; חסרים תגי `lang`, skip link, ו-focus trap במודלים. |
| 14 | **Validation במחשבון:** אזהרות על סכום אחוזי נתבעים ≠ 100%, שורה > 50M ₪, סה"כ נטו > 100M ₪. |
| 15 | **ייצוא:** JSON, CSV (עם BOM), DOCX (חבילת `docx`) – כולם client-side. |
| 16 | **תלויות:** Frontend – React, docx, pdfjs-dist, @azure/openai, @azure/search-documents; API – @azure/openai, Prisma, Azure Storage, וכו'. |
| 17 | **JWT_SECRET** חובה (מינימום 16 תווים) ב-env; `AUTH_USERS` כ-JSON מערך – חשוב לא להדליף. |
| 18 | **אין rate limiting** גלובלי או ל-endpoints רגישים (auth, assistant) בקוד הנוכחי. |
| 19 | **מגבלת גודל ייבוא JSON** במחשבון: 2MB. |
| 20 | **הערכת סיכון משפטי/רפואי** כפיצ'ר מפורש – לא מיושם בממשק; הבוט יכול לשמש לכך בעתיד עם פרומפטים ו-guardrails מתאימים. |

---

## B) Project Map – עץ תיקיות והסבר

```
LexMedical-App/
├── api/                          # Backend Node/Express + Prisma
│   ├── prisma/
│   │   └── schema.prisma         # מודל DB: User, Case, Document, Category, KnowledgeDocument, וכו'
│   ├── src/
│   │   ├── index.ts               # Entry: Express, CORS, routes, health
│   │   ├── middleware/
│   │   │   └── auth.ts            # requireAuth, requireRole, JWT/cookie
│   │   ├── routes/
│   │   │   ├── auth.ts            # login, session
│   │   │   ├── assistant.ts       # POST /search – בוט חיפוש (query expansion + DB)
│   │   │   ├── documents.ts       # מסמכים, קטגוריות, העלאה, חיפוש
│   │   │   ├── cases.ts           # תיקים
│   │   │   ├── categories.ts
│   │   │   ├── admin.ts
│   │   │   ├── knowledge.ts       # Knowledge document ingest + quality
│   │   │   └── literature.ts      # חיפוש מקורות (PubMed, Crossref, Semantic Scholar)
│   │   ├── services/
│   │   │   ├── env.ts             # קונפיג מ-env (zod)
│   │   │   ├── prisma.ts
│   │   │   ├── authService.ts
│   │   │   ├── openAIClient.ts    # Azure OpenAI: generateSearchQueries, generateChapterMetadata
│   │   │   ├── medicalQualityAnalyzer.ts  # ציון איכות מסמך (0–100) + findings
│   │   │   ├── knowledgeIngest.ts
│   │   │   ├── searchIndexer.ts   # Azure Cognitive Search (אופציונלי)
│   │   │   ├── storageClient.ts   # Azure Blob
│   │   │   ├── ocr/               # OCR pipeline, metrics, preprocessing
│   │   │   └── literature/        # queryBuilder, searchService, linker
│   │   └── jobs/
│   │       └── caseRetention.ts   # מחק תיקים לפי retention
│   └── package.json
├── src/                           # Frontend React (CRA)
│   ├── index.tsx                  # Entry: ReactDOM, applyStorageGuard
│   ├── App.tsx                    # Layout: header, DamagesCalculator, BotAssistantWidget (mode=calculator)
│   ├── components/
│   │   ├── DamagesCalculator.tsx   # מחשבון נזק מלא: טבלה, הפחתות, נתבעים, גרפים, ייצוא, תבניות
│   │   └── BotAssistantWidget.tsx # עוזר: mode documents (חיפוש) / calculator (placeholder)
│   ├── services/
│   │   ├── api.ts                 # API_BASE_URL, auth, apiRequest, authFetch
│   │   └── assistantApi.ts       # assistantSearch(question, { limit, categoryName })
│   └── utils/
│       ├── storageGuard.ts        # חסימת lexmedical_* ב-localStorage (PHI)
│       ├── damagesTemplates.ts    # תבניות מובנות + שמירה במחסן
│       ├── exportDamagesDocx.ts    # ייצוא DOCX
│       └── openAttachment.ts
├── docs/
│   ├── backend-setup.md           # התקנת API, Azure, Render
│   └── ULTRA-AUDIT-REPORT.md      # דוח זה
├── package.json                   # Frontend deps
├── .env / .env.backup             # לא ב-git (gitignore)
└── .gitignore
```

**הסבר מודולים:**
- **Frontend:** אפליקציה אחת – מחשבון נזק; העוזר במצב מחשבון רק מציג הודעה עתידית.
- **API:** שירות מרכזי ל-auth, מסמכים, קטגוריות, תיקים, עוזר חיפוש, knowledge ingest, ספרות.
- **מנועי "ציון":** `medicalQualityAnalyzer` ו-OCR metrics ב-backend – לא חלק מממשק המחשבון הנוכחי.

---

## C) Architecture – תרשים והסבר

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Client)                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  React App (RTL)                                                      │  │
│  │  • DamagesCalculator (state: sheet, undo/redo, localStorage persist)  │  │
│  │  • BotAssistantWidget (mode=calculator → placeholder only)           │  │
│  │  • api.ts → REACT_APP_API_BASE_URL (optional; calculator works alone) │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│           │                                                                  │
│           │  Only when Bot in "documents" mode: POST /api/assistant/search   │
│           ▼                                                                  │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            │  HTTPS (Bearer JWT or cookie)
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RENDER / Node (Express) – api/                                              │
│  • /health                                                                   │
│  • /api/auth (login, session)                                                │
│  • /api/assistant/search  ← requireAuth, requireDatabase                     │
│  • /api/documents, /api/categories, /api/cases, /api/admin, /api/literature  │
│  • /api/knowledge (ingest, timeline)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ├──────────────────────┬─────────────────────┬─────────────────────┐
            ▼                      ▼                     ▼                     ▼
   ┌─────────────────┐   ┌─────────────────┐   ┌──────────────┐   ┌─────────────────┐
   │  PostgreSQL     │   │  Azure OpenAI    │   │  Azure Blob  │   │  Azure AI Doc   │
   │  (Prisma)       │   │  (query expand  │   │  (files)     │   │  Intelligence   │
   │  Document,      │   │  + chapter       │   │              │   │  (OCR)           │
   │  Category,      │   │  metadata)       │   │              │   │                 │
   │  User, Case,    │   │                 │   │              │   │                 │
   │  KnowledgeDoc   │   │                 │   │              │   │                 │
   └─────────────────┘   └─────────────────┘   └──────────────┘   └─────────────────┘
```

**זרימת הבוט (מצב documents):**
1. משתמש שולח שאלה → `assistantSearch(question, { limit, categoryName })`.
2. API: `generateSearchQueries(question)` – Azure OpenAI מחזיר `{ queries: string[] }`.
3. API: חילוץ ציטוטים מהשאלה + union עם השאלה המקורית.
4. API: לכל שאילתה – `searchDocumentsByQuery` (Postgres ILIKE על title, summary, content, topics, keywords).
5. דירוג לפי כמות ה-hits, חיתוך ל-`limit`, החזרת `{ queries, documents }`.
6. Frontend מציג תוצאות + קישור למסמכים/קבצים.

---

## D) Features & User Flows

### מחשבון נזק (DamagesCalculator)

| פיצ'ר | תיאור |
|--------|--------|
| טבלת ראשי נזק | שורות עם סוג (תוספת/הפחתה), תובע/נתבע/ממוצע; אפשר להוסיף/למחוק/לכבות. |
| אשם תורם | אחוז אחד – מופחת ראשון מהסכום הנטו. |
| הפחתות | רשימת הפחתות באחוזים – מכפלה מצטברת אחרי אשם תורם. |
| נתבעים | חלוקת אחריות באחוזים; תצוגה + גרף חלוקה. |
| שכ"ט והוצאות | אחוז שכ"ט ב"כ תובע, הוצאות תובע (₪). |
| Undo/Redo | עד 50 צעדים, Ctrl+Z / Ctrl+Y. |
| תבניות | מובנות (נזק אורטופדי, שיניים, איחור גילוי סרטן, תאונת דרכים, כללי) + שמירה ומחיקה ב-localStorage. |
| ייצוא | JSON, CSV (BOM), DOCX. |
| ייבוא | JSON (גרסה 1/2/3, עד 2MB). |
| Validation | אזהרות: אחוזי נתבעים ≠ 100%, שורה > 50M, סה"כ נטו > 100M. |
| גרפים | עמודות תובע/נתבע/ממוצע; bar אופקי לנתבעים עם צבעים. |
| שמירה אוטומטית | localStorage (calc_damages_v3); הודעת שגיאה ב-QuotaExceeded. |

**זרימת משתמש טיפוסית:** כניסה → עריכת כותרת/שורות/אחוזים → צפייה בתוצאות והאזהרות → ייצוא או שמירה כתבנית → (אופציונלי) פתיחת עוזר (כרגע placeholder).

### עוזר (BotAssistantWidget)

| מצב | התנהגות |
|-----|----------|
| `calculator` | כפתור "עוזר" → חלון עם הודעה: "בגרסאות הבאות תוכל לשאול כאן שאלות על חישובים, הפחתות, אשם תורם ואחוזי שכ"ט." אין קריאת API. |
| `documents` | (לא בשימוש ב-App הנוכחי) – שדה שאלה, קטגוריות, שליחה ל-`/api/assistant/search`, הצגת שאילתות ומסמכים. |

---

## E) Risk Scoring Engine – מפורט

### E1) מחשבון הנזק (חשיפה כספית) – Frontend בלבד

**מיקום:** `src/components/DamagesCalculator.tsx` – פונקציות `totals`, `after`, `applyContribAndReductions`, `attorneyFeeAndGross`.

**משתנים עיקריים:**
- **שורות (HeadRow):** `plaintiff`, `defendant` (₪), `kind` (add/deduct), `enabled`.
- **אשם תורם:** `contributoryNegligencePercent` (0–100).
- **הפחתות:** `reductions[]` – כל אלמנט `{ label, percent, enabled }`.
- **נתבעים:** `defendants[]` – `name`, `percent`, `enabled`.
- **שכ"ט והוצאות:** `attorneyFeePercent`, `plaintiffExpenses`.

**נוסחאות (בקוד):**
1. **נטו:**  
   `plaintiffNet = sum(add rows plaintiff) - sum(deduct rows plaintiff)`;  
   אנלוגי ל-defendant ו-avg (ממוצע תובע/נתבע).
2. **אחרי אשם תורם:**  
   `afterContrib = net * (1 - contributoryNegligencePercent/100)`.
3. **אחרי כל ההפחתות:**  
   `reductionsFactor = product over enabled reductions of (1 - percent/100)`;  
   `afterAll = afterContrib * reductionsFactor`.
4. **שכ"ט:**  
   `attorneyFeePlaintiff = plaintiffNet * (attorneyFeePercent/100)`;  
   `grossPlaintiff = plaintiffNet + attorneyFeePlaintiff + plaintiffExpenses`.

**טיפול בערכים חסרים:** `safeNumber()` מחזיר 0 עבור לא-מספר; `clampPercent()` מגביל ל-0–100.

**דוגמאות קלט/פלט (מבנה Sheet):**
- קלט (מצומצם): `{ version: 3, title: "תיק לדוגמה", rows: [{ id, enabled: true, name: "כאב וסבל", kind: "add", plaintiff: 100000, defendant: 80000 }], contributoryNegligencePercent: 10, reductions: [{ id, enabled: true, label: "פגיעה בסיכויי החלמה", percent: 20 }], defendants: [{ id, enabled: true, name: "נתבע 1", percent: 100 }], attorneyFeePercent: 20, plaintiffExpenses: 5000, updatedAt: "..." }`.
- פלט (תוצאות): `totals.plaintiffNet`, `after.plaintiff.afterAll`, `defendantAmounts.avg` וכו' – מוצגים ב-UI ובייצוא.

### E2) מנוע ציון איכות מסמך (Backend) – לא חלק מהמחשבון ב-UI

**מיקום:** `api/src/services/medicalQualityAnalyzer.ts`, `api/src/routes/knowledge.ts`.

**משתנים:** `claims`, `timeline`, `flags`, `reasoningFindings` מתוך KnowledgeDocument.

**לוגיקה (בקצרה):** ניתוח טיב ראיות, פערים בזמן, טיב טענות – מניב `findings` ו-`score` 0–100. נשמר ב-`KnowledgeDocument.medicalQualityScore` – רלוונטי למודול ה-knowledge/תיקים, לא למחשבון הנזק ב-Frontend.

---

## F) Bot/Assistant Audit – מפורט

### איך הבוט עובד
- **מצב calculator:** אין קריאה לשרת; רק UI עם הודעה.
- **מצב documents:**  
  - Frontend: `assistantSearch(question, { limit, categoryName })` → `POST /api/assistant/search`.  
  - Backend: `generateSearchQueries(question)` (Azure OpenAI) → רשימת שאילתות; חילוץ ציטוטים; חיפוש Postgres (ILIKE) בטבלאות Document + Category; דירוג ואיסוף תוצאות; החזרת `queries` + `documents` (כולל attachmentUrl לקבצים).

### יכולות ומגבלות
- **יכולות:** הרחבת שאלה לשאילתות חיפוש, סינון לפי קטגוריה, החזרת מסמכים עם תקציר וקישור לקובץ.
- **מגבלות:** אין RAG על תוכן PDF מלא (חיפוש על title/summary/content/keywords/topics ב-DB); אין תשובה טקסטואלית מחוללת (רק רשימת מסמכים); במצב מחשבון אין שילוב כלל.

### אילו נתונים הבוט מקבל
- **קלט:** `question` (string 3–2000 תווים), `limit` (1–50), `categoryName` (אופציונלי). השאלה נשלחת ל-Azure OpenAI לצורך הרחבת שאילתות.
- **מאגר:** Postgres – Document (title, summary, content, topics, keywords), Category (name). אין שליחת תוכן המחשבון (נזק/סכומים) לשרת במצב הנוכחי.

### שילוב ב-UI ובזרימה
- במסך המחשבון: כפתור "עוזר" → חלון placeholder.  
- במסך מסמכים (אם יופעל): שדה שאלה + קטגוריות → שליחה → היסטוריית שיחה + תוצאות + קישור למסמכים/קבצים.

### סיכוני פרטיות ורגולציה
- **Prompt injection:** שאלת המשתמש עוברת ל-OpenAI; התקפה יכולה לנסות להסיט את פלט ה-JSON (שאילתות) או להזריק הוראות.
- **דליפת נתונים:** שאלה עלולה להכיל פרטים מזהים או רפואיים – נשלחת ל-Azure OpenAI (לפי מדיניות Microsoft/Azure).
- **אין גיבוי:** אין סינון/סניטציה של הקלט; אין הגבלת אורך מחמירה מעבר ל-2000 תווים; אין rate limit ייעודי.
- **רגולציה:** שימוש ב-PHI בשאלות עשוי לדרוש הסכמה ומדיניות שמירה/מחיקה בהתאם ל-GDPR/חוק הגנת הפרטיות.

### Guardrails מומלצים
- הגבלת אורך שאלה (למשל 500 תווים) ו-rate limit לכל משתמש.
- סינון/הסרה של מספרי ת.ז., שמות מלאים, מונחים רפואיים מזוהים לפני שליחה ל-OpenAI (או הימנעות משליחת תוכן רגיש).
- System prompt יציב עם הוראה: "החזר רק JSON עם queries; אל תכלול מידע מזהה."
- לוג קצר (ללא תוכן מלא) לניטור שימוש.
- דיסקליימר ב-UI: "החיפוש משתמש ב-AI; אל תזין פרטים מזהים."

---

## G) Bugs & Issues

| ממצא | חומרה | איך לשחזר | למה קורה | תיקון מוצע |
|------|--------|-----------|----------|------------|
| במצב calculator העוזר לא עושה כלום | P2 | פתיחת עוזר במסך מחשבון | mode=calculator מציג רק placeholder | להפעיל בעתיד endpoint ייעודי למחשבון או להציג טיפים סטטיים |
| סכום אחוזי נתבעים לא מאומת ב-import | P2 | ייבוא JSON עם defendants שסכומם ≠ 100% | הקוד לא מתקן אוטומטית | להוסיף נרמול אופציונלי או אזהרה בולטת ב-UI |
| שינוי "הוצאות תובע" לא נכנס ל-Undo | P1 | לשנות הוצאות תובע (₪) ואז Ctrl+Z | השדה מעודכן עם `setSheet` במקום `setSheetWithHistory` | לעבור ל-`setSheetWithHistory` בעדכון plaintiffExpenses (שורה ~852) |
| אין rate limit ל-POST /api/assistant/search | P1 | שליחת הרבה בקשות רצופות | אין middleware rate-limit | להוסיף express-rate-limit או דומה ל-route |
| JWT ב-cookie – אין סימון Secure ב-production בלי HTTPS | P2 | בדיקה ב-production | הגדרת cookie תלויה בסביבה | להגדיר secure: true כאשר NODE_ENV=production |
| ייצוא DOCX על מסמך ענק – עלול להאט | P2 | טבלה עם מאות שורות + הפחתות/נתבעים רבים | ייצוא סינכרוני ב-Client | להגביל גודל או לעבור ל-Web Worker |
| תבניות ב-localStorage – מחיקה בדפדפן אחר לא מסונכרנת | P2 | מחיקת נתונים בדפדפן אחר / מכשיר אחר | אחסון מקומי בלבד | להציג אזהרה או לספק גיבוי ייצוא |
| חסר focus trap במודל "ספריית תבניות" | P2 | Tab במצב פתוח – focus יוצא מהמודל | אין useFocusTrap | להוסיף focus trap ו-close ב-Escape |
| הודעת שגיאה מהעוזר (assistant_failed) לא ידידותית | P2 | כיבוי API או 401 → "assistant_failed" | setError(e?.message ?? 'assistant_failed') | לתרגם/למפות הודעות (session_expired, network, server_error) |
| .env.example מכיל דוגמת passwordHash | P2 | צפייה ב-repo | תיעוד | להסיר ערך אמיתי; להשאיר placeholder בלבד |


---

## H) Improvements & Upgrades

| שיפור | ערך | עלות | זמן | תלות |
|--------|-----|------|-----|------|
| חיבור הבוט למחשבון (שאלות על הפחתות/אשם תורם) | גבוה | בינונית | 2–4 שבועות | endpoint + פרומפטים + guardrails |
| Rate limiting על /api/auth ו-/api/assistant | אבטחה | נמוכה | 1–2 ימים | express-rate-limit |
| בדיקות E2E ל-Frontend (מחשבון + ייצוא) | אמינות | בינונית | 1–2 שבועות | Cypress/Playwright |
| נגישות: skip link, focus trap במודלים, lang="he" | תאימות/חוק | נמוכה | 2–5 ימים | - |
| הגבלת גודל ייצוא DOCX / Worker | ביצועים | נמוכה | 1 יום | - |
| נרמול אוטומטי לאחוזי נתבעים (או אזהרה ברורה) | UX | נמוכה | חצי יום | - |
| לוג audit ל-assistant (ללא תוכן שאלה מלא) | אבטחה/רגולציה | נמוכה | 1 יום | - |
| מסך "מסמכים" עם עוזר מלא (mode=documents) באפליקציה הנוכחית | ערך מוצר | בינונית | 1–2 שבועות | API כבר קיים |
| מיגרציות Prisma ו-CI (למשל GitHub Actions) | אמינות דיפלוי | בינונית | 2–3 ימים | GitHub |
| דיסקליימר ו-Data Processing Agreement לתיעוד שימוש ב-OpenAI | רגולציה | נמוכה | 1–2 ימים | משפטי |

---

## I) שאלות פתוחות / חוסרים

1. **האם "מחשבון הערכת סיכון" מתייחס למחשבון הנזק הקיים, או למודול נפרד (למשל ציון סיכון תביעה)?** – בקוד יש מחשבון נזק + ב-backend ציון איכות מסמך; אין מודול "הערכת סיכון" ב-Frontend.
2. **האם יש כוונה לחשוף את `medicalQualityScore` / KnowledgeDocument בממשק?** – כרגע לא מחובר.
3. **האם מסך המסמכים (DocumentsLibrary) אמור להיות נגיש מאותה אפליקציה עם עוזר חיפוש?** – ב-App.tsx רק מחשבון + עוזר במצב calculator.
4. **מה מדיניות השמירה של שאלות משתמש ב-OpenAI (Azure)?** – לצורך DPIA ותיעוד.
5. **האם נדרש backup של תבניות המחשבון לשרת?** – כרגע רק localStorage.

---

## 15 רעיונות שימוש בבוט במסגרת מחשבון הערכת סיכון/נזק

1. **הסבר על אשם תורם** – "מהו אשם תורם ואיך הוא משפיע על הסכום?" → החזרת קטעי הסבר או מסמכים רלוונטיים.
2. **הפחתת "פגיעה בסיכויי החלמה"** – "איך מחשבים הפחתה בגין פגיעה בסיכויי החלמה?" → שאילתות למסמכים/פסקי דין.
3. **השוואת אחוזי שכ"ט** – "מה אחוז שכ"ט מקובל בתביעות נזקי גוף?" → חיפוש במאגר.
4. **ראשי נזק טיפוסיים** – "אילו ראשי נזק מקובלים בתביעת איחור באבחון סרטן?" → רשימת דוגמאות/מסמכים.
5. **תרחיש ממוצע מול תובע/נתבע** – "מתי משתמשים בממוצע בין טענות?" → הסבר קצר + מקורות.
6. **מל"ל (מחלת לוואי)** – "איך מקזזים מל"ל out of scope?" → חיפוש תקדימים.
7. **חלוקת אחריות בין נתבעים** – "תקדימים על חלוקת אחריות בין בית חולים לרופא." → מסמכים.
8. **סכומים חריגים** – כשמופיעה אזהרת validation: "האם יש תקדימים לסכומים מעל X מיליון?" (ללא הזנת סכום מדויק מזהה).
9. **ייצוא ל-Word** – "איך להציג את התחשיב בחוות דעת?" → טיפים או תבנית.
10. **תבניות מומלצות** – "איזו תבנית מתאימה לתביעת שיניים?" → הפניה לתבניות הקיימות.
11. **ריבית והצמדה** – "האם יש ריבית/הצמדה על נזקים?" → חיפוש במסמכים.
12. **הוצאות משפט** – "מה כלול בהוצאות תובע?" → הסבר + מקורות.
13. **תיקון טעות בהזנה** – "איך מתקנים אם הזנתי אחוז שגוי?" → הסבר Undo / עריכה.
14. **גיבוי** – "איך לגבות את המחשבון?" → הסבר ייצוא JSON/שמירה.
15. **דיסקליימר משפטי** – "האם המחשבון מחליף ייעוץ משפטי?" → טקסט דיסקליימר קבוע (ללא הזנה ל-LLM).

---

## 10 פרומפטים מוכנים לבוט (תבניות) – רשלנות רפואית

(מתאימים לשימוש כ-**משפט מערכת** או כ-**דוגמאות למשתמש**, בלי להמציא עובדות ועם דיסקליימר.)

1. **מערכת (system):** "אתה עוזר משפטי תומך החלטה בתחום רשלנות רפואית. אתה לא נותן ייעוץ משפטי ולא מחליף עורך דין. התשובות מבוססות על המסמכים במאגר בלבד."
2. **משתמש:** "הסבר בקצרה מהו אשם תורם בחישוב נזקים, בלי להמציא תקדימים."
3. **משתמש:** "מהם ראשי נזק מקובלים בתביעות נזקי גוף בפסיקה, לפי המסמכים במאגר."
4. **משתמש:** "איך מחשבים הפחתה בגין פגיעה בסיכויי החלמה – הסבר כללי בלבד."
5. **משתמש:** "מה אחוזי שכר טרחה מקובלים בתביעות נזק, לפי המסמכים שיש לך."
6. **משתמש:** "האם יש במאגר התייחסות לחלוקת אחריות בין מספר נתבעים."
7. **משתמש:** "מה ההבדל בין טענות תובעטענות נתבע בתחשיב נזק – הסבר כללי."
8. **משתמש:** "אילו סוגי מסמכים רלוונטיים לחישוב נזק ברשלנות רפואית."
9. **משתמש:** "תן דיסקליימר קצר: שהמחשבון והעוזר אינם ייעוץ משפטי."
10. **משתמש:** "חפש במאגר מסמכים על קיזוז מל\"ל (מחלת לוואי) בתחשיב נזק."

---

## Top 10 Fixes לפי השפעה

| # | תיקון | השפעה |
|---|--------|--------|
| 1 | הוספת rate limiting ל-`/api/assistant/search` (ורצוי ל-auth) | צמצום סיכון ניצול ו-DoS |
| 2 | שיפור הודעות שגיאה בעוזר (תרגום/מפת session_expired, network, server) | חוויית משתמש ואמינות |
| 3 | הסרת/החלפת דוגמת passwordHash ב-.env.example | אבטחה ותיעוד |
| 4 | הוספת דיסקליימר ב-UI לעוזר (שימוש ב-AI, אי-הזנת פרטים מזהים) | פרטיות ורגולציה |
| 5 | נרמול או אזהרה ברורה לאחוזי נתבעים ≠ 100% (כולל אחרי ייבוא) | דיוק חישוב ו-UX |
| 6 | הוספת focus trap וסגירה ב-Escape במודלים (ספריית תבניות, עוזר) | נגישות ותאימות |
| 7 | הגבלת אורך שאלה לעוזר (למשל 500 תווים) ובדיקה בצד שרת | אבטחה ועלויות LLM |
| 8 | בדיקות E2E בסיסיות למחשבון (עריכה, ייצוא CSV/JSON) | אמינות לפני שינויים |
| 9 | יישום חיבור הבוט למחשבון (שאלות על הפחתות/אשם תורם) עם guardrails | ערך מוצר |
| 10 | CI (GitHub Actions): build + test + optional deploy על push ל-main | אמינות דיפלוי |

---

*סוף דוח ULTRA AUDIT.*
