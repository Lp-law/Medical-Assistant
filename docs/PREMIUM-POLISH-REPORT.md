# חבילת דיווח – מקצה ליטושים פרימיום (בוט Sanity / Questionnaire / Scenarios+Word)

## 1) רשימת קבצים ששונו

| קובץ | מטרת שינוי |
|------|------------|
| `src/utils/calcI18n.ts` | הוספת מפתחות i18n: כותרת השוואת תרחישים, הנחות, כפתורי העתקה, דלג, תצוגת מקדימה/החל תיקון, plaintiffExpenses/reductionsSection/defendantsSection/defendantName |
| `src/utils/scenariosExport.ts` | כותרת מסודרת (he/en-GB), שורת הנחות, עיגול למספר שלם, הדגשת שורת סיום (bold + border-top), RTL/LTR לתאים, פונקציות copyScenariosTableOnly / copyScenariosChartOnly, exportScenariosToWord עם fallback |
| `src/components/ScenariosPanel.tsx` | שלושה כפתורים: העתק טבלה, העתק תרשים, העתק ללוח + הודעת סטטוס (כולל fallback כשאין הרשאת תמונה) |
| `src/utils/chartToPng.ts` | תוויות ערך (מספר) מעל כל עמודה בגרף + מקרא קיים |
| `src/components/SanityCheckPanel.tsx` | Badge חומרה P0/P1/P2 עם צבע/סגנון, תצוגת מקדימה "לפני → אחרי" לפני החלת תיקון, כפתור "החל תיקון" |
| `src/utils/questionnaire.ts` | SKIP_SENTINEL, buildProposal מתעלם משדות שדולגו (לא מוסיף ל-patch) |
| `src/components/QuestionnaireModal.tsx` | כפתור "דלג" לכל שאלה, תצוגת מקדימה רק לשינויים שיקרו, Build proposal בלי חובת מילוי כל השדות |
| `src/utils/exportForWordHtml.ts` | שימוש ב-thNum/tdNum ב-cell(), הסרת numAlign לא בשימוש, טיפול ב-includeReductions ב-buildWordPlainText |
| `src/components/DamagesCalculator.tsx` | הסרת sumDefendantsPercent לא בשימוש, eslint-disable ל-useCallback של applySanityPatch/applyQuestionnairePatch |
| `src/components/BotAssistantWidget.tsx` | הסרת setExpandedDocId לא בשימוש (state רק לקריאה) |

---

## 2) התנהגות סופית לפי נקודות

### 1) Word Export לתרחישים
- **1.1** שלושה כפתורים: "העתק טבלה" / "Copy table" – רק HTML+plain; "העתק תרשים" / "Copy chart" – רק PNG; "העתק ללוח" / "Copy to clipboard" – HTML+plain+PNG עם fallback אוטומטי ל־HTML+plain אם אין הרשאת תמונה, + הודעה (copiedWithImage / copiedWithoutImage).
- **1.2** כותרת ב-HTML: עברית "השוואת תרחישים – תחשיב נזק", אנגלית "Scenario Comparison – Damages Calculation".
- **1.3** שורת הנחות מתחת לכותרת (לא דיסקליימר): עברית/אנגלית כבמפרט.
- **1.4** עיגול: 0 ספרות אחרי הנקודה (מטבע שלם) – Math.round בעת בניית HTML ו-plain.
- **1.5** שורת השורה האחרונה בטבלה (לאחר שלושת התרחישים): bold + border-top כפול (3px double).
- **1.6** בגרף: value labels מעל כל עמודה (לפני/אחרי), מקרא "לפני הפחתות" / "After reductions" וכו' כפי שהיה.
- **1.7** RTL/LTR: div עם dir=rtl/ltr, יישור טקסט/מספרים לפי שפה (תווית עמודה ראשונה: ימין בעברית, שמאל באנגלית; מספרים ימין).

### 2) Sanity Panel
- **2.1** Badge חומרה: P0/P1/P2 עם צבע ו-border (אדום/כתום/אפור).
- **2.2** ניסוח תוצאות באמצעות calcI18n (titleKey, detailsKey, detailsVars) – ללא שינוי לוגיקה.
- **2.3** בלחיצה על "תקן" או "תקן את כל הבטוחים": מוצגת חלונית "לפני → אחרי" עם תיאור השינויים (נרמל אחוזי נתבעים / הסר הפחתה כפולה), ואז "החל תיקון". לאחר Apply, Undo ממשיך לעבוד (setSheetWithHistory).

### 3) Smart Questionnaire
- **3.1** כפתור "דלג" / "Skip" ליד כל שאלה.
- **3.2** דלג מגדיר ערך SKIP_SENTINEL; buildProposal לא כולל שדה זה ב-patch.
- **3.3** תצוגת מקדימה מציגה רק את השינויים שיקרו (רק שדות שהופיעו ב-patch).

### 4) ניקוי Build
- **4.1** טיפול ב-unused: הסרה או שימוש או eslint-disable לפי הצורך (פורט לעיל).
- **4.2** `npm run build` מסתיים בלי warnings (Compiled successfully).

---

## 3) שמונה תרחישי בדיקה ידניים (Step-by-step)

1. **הדבקה ב-Word בעברית – טבלה+תרשים, כיוון נכון**  
   בחר שפה עברית, פתח "שלושה תרחישים", לחץ "העתק ללוח". הדבק ב-Word. לוודא: כותרת "השוואת תרחישים – תחשיב נזק", שורת הנחות, טבלה RTL, תמונה מתחת (אם הועתקה). כיוון עמודות וטקסט ימין-לשמאל.

2. **הדבקה ב-Word באנגלית – טבלה+תרשים, כיוון נכון**  
   בחר English (UK), אותו פאנל, "Copy to clipboard". הדבק ב-Word. כותרת "Scenario Comparison – Damages Calculation", הנחות באנגלית, טבלה LTR, תמונה. מספרים ימין, תוויות שמאל.

3. **כפתור "העתק טבלה" בלבד**  
   לחץ "העתק טבלה" / "Copy table". הדבק ב-Word. רק טבלה (HTML), בלי תמונה. הודעה "הטבלה הועתקה" / "Table copied."

4. **כפתור "העתק תרשים" בלבד**  
   לחץ "העתק תרשים" / "Copy chart". הדבק ב-Word. רק תמונת PNG. הודעה "התרשים הועתק" / "Chart copied."

5. **Fallback כשאין הרשאת clipboard image**  
   (בדפדפן/הגדרות שמגבילות clipboard לתמונה) לחץ "העתק ללוח". לוודא שהטבלה מועתקת ולהודעה מופיעה "הטבלה הועתקה; לא ניתן להעתיק תמונה (הרשאות)" / "Table copied; image not available (permissions)."

6. **Sanity fix עם preview + undo**  
   צור מצב שמופעל "אחוזי נתבעים ≠ 100%". הרץ "בדיקת שפיות", לחץ "תקן" על הרלוונטי. לוודא חלונית "לפני → אחרי" ו"החל תיקון". החל. לוודא שהגיליון מתעדכן. לחץ Undo – לוודא שהמצב חוזר.

7. **Questionnaire skip + preview + apply + undo**  
   פתח "שאלון חכמה". דלג על חלק מהשאלות (כפתור "דלג"). ענה על שאלה אחת לפחות. "בנה הצעה". לוודא שתצוגת המקדימה מציגה רק שדות שענית עליהם (לא דילוגים). "החל". לוודא שרק השדות שבחרת מתעדכנים. Undo – לוודא חזרה.

8. **Build clean**  
   הרץ `npm run build`. תוצאה: "Compiled successfully" ללא warnings.

---

## 4) ציטוטי קוד להעברה ל-ChatGPT לאימות

### א) `src/utils/scenarios.ts`
(לוגיקת תרחישים ו-applyContribAndLossOfChance – ללא שינוי; רק לאימות עקביות.)

```ts
// applyContribAndLossOfChance + computeScenarioResult + defaultScenarioParams
function applyContribAndLossOfChance(
  net: number,
  contribPct: number,
  lossOfChancePct: number
): number {
  const afterContrib = net * (1 - clamp(contribPct, 0, 100) / 100);
  const afterLoss = afterContrib * (1 - clamp(lossOfChancePct, 0, 100) / 100);
  return afterLoss;
}

export function computeScenarioResult(
  baseNets: { plaintiffNet: number; defendantNet: number; avgNet: number },
  params: ScenarioParams
): Omit<ScenarioResult, 'labelKey'> {
  const before = { plaintiff: baseNets.plaintiffNet, defendant: baseNets.defendantNet, avg: baseNets.avgNet };
  const after = {
    plaintiff: applyContribAndLossOfChance(baseNets.plaintiffNet, params.contribNegPct, params.lossOfChancePct),
    defendant: applyContribAndLossOfChance(baseNets.defendantNet, params.contribNegPct, params.lossOfChancePct),
    avg: applyContribAndLossOfChance(baseNets.avgNet, params.contribNegPct, params.lossOfChancePct),
  };
  return { params, before, after };
}
```

### ב) `src/utils/scenariosExport.ts` – HTML builder + clipboard
(מבנה ה-HTML עם dir, כותרת, הנחות, עיגול, שורת הדגשה; ושלוש פונקציות ההעתקה.)

- **buildScenariosWordHtml**: div עם `dir="${dir}"`, כותרת `scenarioComparisonTitle`, פסקת `scenarioAssumptions`, טבלה עם תא ראשון לפי `tdLabel` (RTL/LTR), תאים מספריים עם `Math.round`, שורה אחרונה עם `font-weight:bold;border-top:3px double #333`.
- **copyScenariosTableOnly**: בונה HTML + plain, כותב ל-clipboard כ-text/html + text/plain.
- **copyScenariosChartOnly**: בונה PNG מ-barChartToPngBlob, כותב image/png.
- **exportScenariosToWord**: בונה HTML+plain+PNG; try לכתוב את שלושתם, ב-catch כותב רק HTML+plain ומחזיר `imageCopied: false`.

### ג) `src/components/DamagesCalculator.tsx` – totals + after
(החלק שמחשב totals ו-after עם applyContribAndReductions – לא applyContribAndLossOfChance; לוגיקה מקבילה לתרחישים.)

```ts
const totals = useMemo(() => {
  // ... addRows, deductRows, plaintiffNet, defendantNet, avgNet
  return { plaintiffAdd, defendantAdd, avgAdd, plaintiffDeduct, defendantDeduct, avgDeduct, plaintiffNet, defendantNet, avgNet };
}, [activeRows]);

const after = useMemo(() => {
  const plaintiff = applyContribAndReductions(totals.plaintiffNet, sheet.contributoryNegligencePercent, sheet.reductions);
  const defendant = applyContribAndReductions(totals.defendantNet, sheet.contributoryNegligencePercent, sheet.reductions);
  const avg = applyContribAndReductions(totals.avgNet, sheet.contributoryNegligencePercent, sheet.reductions);
  return { plaintiff, defendant, avg };
}, [sheet.contributoryNegligencePercent, sheet.reductions, totals...]);

// applyContribAndReductions: contribFactor = 1 - contrib%/100, afterContrib = base * contribFactor,
// reductionsFactor = product of (1 - reduction.percent/100), afterAll = afterContrib * reductionsFactor.
```

---

## 5) דוגמת HTML שנוצר (קטע) – RTL/LTR ו-styling

**עברית (RTL):**
```html
<div style="direction:rtl;font-family:Calibri,Arial,sans-serif;font-size:11pt;padding:12px;" dir="rtl">
  <p style="font-size:14pt;font-weight:bold;margin-bottom:12px;">השוואת תרחישים – תחשיב נזק</p>
  <p style="font-size:10pt;color:#555;margin-bottom:12px;">התרחישים מבוססים על: אשם תורם (%)...</p>
  <table style="border-collapse:collapse;...">
    <thead><tr>
      <th style="...text-align:right;">תרחישים</th>
      <th style="...text-align:right;">סה״כ לפני (₪)</th>
      <th style="...text-align:right;">סה״כ לאחר (₪)</th>
    </tr></thead>
    <tbody>
      <tr>...</tr>
      <tr style="font-weight:bold;border-top:3px double #333;">...</tr>
    </tbody>
  </table>
</div>
```

**אנגלית (LTR):**
```html
<div style="direction:ltr;..." dir="ltr">
  <p ...>Scenario Comparison – Damages Calculation</p>
  <p ...>Scenarios are based on: contributory negligence (%)...</p>
  <table ...>
    <th style="...text-align:left;">Scenarios</th>
    <th style="...text-align:right;">Total before (₪)</th>
    <th style="...text-align:right;">Total after (₪)</th>
    ...
  </table>
</div>
```

תיאור קצר: ה-wrapper עם `dir` קובע כיוון. בעברית כל העמודות ימין; באנגלית עמודת התוויות שמאל והמספרים ימין. שורת השורה האחרונה: bold ו-border-top כפול. אין דיסקליימר משפטי.
