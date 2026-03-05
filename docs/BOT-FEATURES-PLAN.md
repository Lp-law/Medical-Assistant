# Bot AI Features – סריקה ותוכנית

## שלב 0 — סריקה ומיפוי

### א) מודל הנתונים (Sheet v3)
- **מיקום:** `src/components/DamagesCalculator.tsx` (types בראש הקובץ)
- **מבנה:** `Sheet`: `version: 3`, `title`, `rows` (HeadRow: id, enabled, name, kind add|deduct, plaintiff, defendant), `contributoryNegligencePercent`, `reductions` (id, enabled, label, percent), `defendants` (id, enabled, name, percent), `attorneyFeePercent`, `plaintiffExpenses`, `updatedAt`
- **חישובים:** `totals` (plaintiffAdd/Deduct/Net, defendant*, avg*) מ-`activeRows`; `after` מ-`applyContribAndReductions(net, contrib%, reductions)`; `defendantAmounts` = חלוקה של after.*.afterAll לפי אחוזי נתבעים

### ב) פונקציות חישוב וקריאות ב-UI
- **פונקציות:** `sum`, `calcAvg`, `clampPercent`, `safeNumber`, `applyContribAndReductions`, `normalizeDefendants` — כולן טהורות
- **שימוש ב-UI:** `totals` ב-foot של טבלה, ב-`attorneyFeeAndGross`, ב-`after`; `after` בכרטיסי תרחישים, בגרף, ב-`defendantAmounts`; `validationWarnings` (defendants ≠ 100%, שורה > 50M, סה"כ > 100M)

### ג) בוט ומסלולי API
- **Frontend:** `BotAssistantWidget` — mode `calculator` = placeholder (אין קריאת API)
- **API:** `POST /api/assistant/search` — הרחבת שאילתות + חיפוש מסמכים; לא משמש את המחשבון כרגע
- **החלטה:** שלושת הפיצ'רים ימומשו ב-**Frontend בלבד** (ללא שליחת PHI/מספרים ל-LLM); אופציונלי בעתיד: endpoints לניסוח טקסט בלבד

### ד) תשתית i18n
- **קיים:** `src/utils/exportForWordI18n.ts` — `ExportLang = 'he' | 'en-GB'`, `getLabels(lang)`, `formatNumber`, `formatPercent`, `formatCurrency`, `isRtl`
- **חסר:** מילון מרכזי לכל ה-UI של המחשבון + בוט; Context/prop ל-`lang` ברמת האפליקציה

---

## רשימת קבצים רלוונטיים

| קובץ | תפקיד |
|------|--------|
| `src/components/DamagesCalculator.tsx` | מודל Sheet, חישובים, UI טבלאות/הפחתות/נתבעים, validationWarnings, Export for Word |
| `src/utils/exportForWordI18n.ts` | i18n לייצוא (labels, formatters) |
| `src/utils/exportForWordHtml.ts` | בניית HTML ל-Word |
| `src/utils/chartToPng.ts` | תרשים ל-PNG |
| `src/App.tsx` | עטיפה, BotAssistantWidget |
| `api/src/routes/assistant.ts` | חיפוש עוזר (לא מחשבון) |

---

## נקודות כניסה

- **מחשבון:** `DamagesCalculator` — state `sheet`, `setSheetWithHistory` (עם Undo), `totals`, `after`, `attorneyFeeAndGross`, `defendantAmounts`
- **ייצוא ל-Word:** `ExportForWordModal` + `exportForWord(payload, options)` — HTML + PNG ללוח
- **נרמול נתבעים:** `normalizeDefendants(sheet.defendants)` כבר קיים; ניתן למחזר ל-Sanity Fix

---

## מה למחזר ומה להוסיף

| למחזר | להוסיף |
|--------|--------|
| `applyContribAndReductions`, `sum`, `calcAvg`, `normalizeDefendants`, `clampPercent` | מודול `sanityCheck.ts` (בדיקות טהורות + fix actions) |
| `exportForWordI18n` (להרחיב ל-`calcI18n` או להשאיר + מילון נוסף) | `LangContext` + מילון מפתחות ל-UI בוט/סניטי/שאלון/תרחישים |
| `setSheetWithHistory` לכל תיקון (Patch) | `SanityCheckPanel`, `QuestionnaireModal`, `ScenariosPanel` |
| לוגיקת ייצוא Word (HTML + chart) | מצב "Scenarios" בייצוא: 3 תרחישים → טבלה + תרשים |

---

## תוכנית קבצים לשינויים

1. **src/utils/calcI18n.ts** — `Lang = 'he' | 'en-GB'`, `t(key, lang)`, הרחבת מפתחות (sanity, questionnaire, scenarios), שימוש ב-formatters קיימים
2. **src/context/LangContext.tsx** — React Context + Provider, `useLang()`
3. **src/utils/sanityCheck.ts** — טיפוסים מינימליים, `runSanityChecks(sheet, totals, after)`, `applyFix(sheet, fixAction)`
4. **src/components/SanityCheckPanel.tsx** — כפתור "בדיקת שפיות", פאנל תוצאות, "תקן" / "תקן את כל הבטוחים"
5. **src/utils/questionnaire.ts** — `getGapQuestions(sheet)`, `buildProposal(answers)`, טיפוס Patch
6. **src/components/QuestionnaireModal.tsx** — שאלות, תשובות, Preview, Apply/Cancel
7. **src/utils/scenarios.ts** — `ScenarioParams`, `computeScenarioTotals(sheet, params)`, טיפוס ל-3 תרחישים
8. **src/components/ScenariosPanel.tsx** — טבלת קלט 3 תרחישים, תצוגה + גרף, "יצוא תרחישים ל-Word"
9. **src/components/DamagesCalculator.tsx** — שילוב SanityCheckPanel, QuestionnaireModal, ScenariosPanel; העברת lang מ-Context; חיבור Apply ל-Patch
10. **src/App.tsx** — גלילת LangProvider (אופציונלי אם lang רק בתוך מחשבון)
11. **docs/BOT-FEATURES-USAGE.md** — הוראות שימוש, מגבלות, V2
