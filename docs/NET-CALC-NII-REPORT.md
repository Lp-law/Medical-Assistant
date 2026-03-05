# דוח: יישור חישוב Net (After) — NII סכומי וסדר הפחתות קבוע

## דיווח סריקה (שלב 1)

- **reductions היום:** מערך אובייקטים `{ id, enabled, label, percent }` — כולם אחוזיים (מכפלתיים). לא היה reduction סכומי.
- **הוספת NII:** הרחבנו את השדות ל-`type?: 'percent' | 'nii'` ו-`value?: number`. כאשר `type === 'nii'`, `value` = סכום ב-₪ שמקוזז אחרי אשם תורם. קיימים ישנים נשארים ללא `type` (מטופלים כאחוז).

## רשימת קבצים ששונו

| קובץ | סיבת שינוי |
|------|-------------|
| `src/utils/netCalc.ts` | **חדש.** אמת אחת: `calcNetTotals(baseTotal, sheet, params?)` — סדר Before → contrib → NII (סכום) → risk (%) — ו-`getNiiAmount` / `getRiskPctFromSheet`. |
| `src/components/DamagesCalculator.tsx` | הרחבת `Reduction` ל-`type?: 'percent' \| 'nii'`, `value?: number`; החלפת `computeAfter` לשימוש ב-`calcNetTotals`; פרסור import/JSON עם type ו-value; כפתור "מל״ל (סכום)" והוספת שורת NII ב-UI (שדה סכום ₪). |
| `src/utils/scenarios.ts` | מעבר מ-`applyAdjustmentsInOrder` ל-`calcNetTotals`; NII ו-contrib/risk מתוך sheet ו-scenario params. |
| `src/components/ScenariosPanel.tsx` | עדכון טיפוס `sheetReductions` כדי לכלול `type` ו-`value`. |
| `src/utils/questionnaire.ts` | שאלת NII ("תגמולי מל״ל (NII) — מה הסכום?"); `buildProposal` מוסיף/מעדכן reduction מסוג `nii` עם `value`; הרחבת `SheetLike` ו-`QuestionnairePatch` ל-type/value. |
| `src/components/QuestionnaireModal.tsx` | תצוגת מקדימה של NII (מל״ל: ₪ X). |
| `src/utils/calcI18n.ts` | `niiLabel` (מל״ל / NII); עדכון `scenarioAssumptions` ל-NII כסכום. |

---

## סדר החישוב המחייב

1. **Total Before** — נטו משורות (תוספות − קיזוזים).
2. **Contributory Negligence** — `afterContrib = before * (1 - contribPct/100)`.
3. **NII (תגמולי מל״ל)** — חיסור סכומי: `afterNii = max(afterContrib - niiAmount, 0)`; `niiAmount` = סכום reductions עם `enabled`, `type === 'nii'`, ו-`value` מספרי וחיובי בלבד.
4. **Risk / Loss of Chance** — `afterRisk = afterNii * (1 - riskPct/100)`; `riskPct` מהגיליון: קודם מ-`type === 'risk'`, אחרת fallback לפי label.
5. **Defendants allocation** — על **Total After** (`afterRisk`).

---

## בדיקות מספריות (חובה)

| מקרה | before | contrib | nii | risk | אחרי contrib | אחרי NII | after |
|------|--------|---------|-----|------|--------------|----------|-------|
| 1 | 1000 | 10% | 0 | 0 | 900 | 900 | **900** |
| 2 | 1000 | 10% | 100 | 0 | 900 | 800 | **800** |
| 3 | 1000 | 10% | 100 | 25% | 900 | 800 | **600** |
| 4 | 1000 | 10% | 950 | 0 | 900 | 0 | **0** (afterNii=0) |

**Allocation:** after=600, נתבעים 60%/40% ⇒ 360 / 240.

---

## קטעי קוד לדיווח

### 1) `src/utils/netCalc.ts` — הפונקציה המרכזית

```ts
export function calcNetTotals(
  baseTotal: number,
  sheet: SheetForNet,
  params?: { riskPct?: number }
): CalcNetTotalsResult {
  const before = baseTotal;
  const contribFactor = 1 - clampPct(sheet.contributoryNegligencePercent) / 100;
  const afterContrib = before * contribFactor;

  const niiAmount = getNiiAmount(sheet.reductions);
  const afterNii = Math.max(afterContrib - niiAmount, 0);

  const riskPct = params?.riskPct !== undefined && params?.riskPct !== null
    ? clampPct(params.riskPct)
    : getRiskPctFromSheet(sheet.reductions);
  const afterRisk = afterNii * (1 - riskPct / 100);

  return {
    before,
    afterContrib,
    afterNii,
    afterRisk,
    after: afterRisk,
  };
}
```

### 2) `computeScenarioResult` (scenarios.ts)

```ts
export function computeScenarioResult(
  baseNets: { plaintiffNet: number; defendantNet: number; avgNet: number },
  params: ScenarioParams,
  sheetReductions: ScenarioSheetReductions
): Omit<ScenarioResult, 'labelKey'> {
  const sheetForNet: SheetForNet = {
    contributoryNegligencePercent: params.contribNegPct,
    reductions: sheetReductions.map((r) => ({
      enabled: r.enabled,
      type: r.type,
      percent: r.percent,
      value: r.value,
      label: r.label,
    })),
  };
  const plaintiffRes = calcNetTotals(baseNets.plaintiffNet, sheetForNet, { riskPct: params.lossOfChancePct });
  const defendantRes = calcNetTotals(baseNets.defendantNet, sheetForNet, { riskPct: params.lossOfChancePct });
  const avgRes = calcNetTotals(baseNets.avgNet, sheetForNet, { riskPct: params.lossOfChancePct });
  // ...
  const after = {
    plaintiff: plaintiffRes.after,
    defendant: defendantRes.after,
    avg: avgRes.after,
  };
  return { params, before, after };
}
```

### 3) DamagesCalculator — חישוב `after`

```ts
function computeAfter(
  base: number,
  sheet: { contributoryNegligencePercent: number; reductions: Reduction[] }
): { afterContrib: number; afterAll: number; contribFactor: number; reductionsFactor: number } {
  const res = calcNetTotals(base, {
    contributoryNegligencePercent: sheet.contributoryNegligencePercent,
    reductions: sheet.reductions.map((r) => ({
      enabled: r.enabled,
      type: r.type,
      percent: r.percent,
      value: r.value,
      label: r.label,
    })),
  });
  const contribFactor = res.before > 0 ? res.afterContrib / res.before : 1;
  const reductionsFactor = res.afterContrib > 0 ? res.after / res.afterContrib : 0;
  return {
    afterContrib: res.afterContrib,
    afterAll: res.after,
    contribFactor,
    reductionsFactor,
  };
}

// useMemo:
const sheetForNet = { contributoryNegligencePercent: sheet.contributoryNegligencePercent, reductions: sheet.reductions };
const plaintiff = computeAfter(totals.plaintiffNet, sheetForNet);
// ...
```

---

## Hardening (NII / Risk) — עדכון

- **getNiiAmount (netCalc.ts):** מסכמים רק reductions עם `enabled === true`, `type === 'nii'`, ו-`value` מספרי וחיובי. ערך לא מספרי או ≤0 לא נספר.
- **טיפוס reduction type 'risk':** הורחב ל-`type?: 'percent' | 'nii' | 'risk'` בכל המקומות (DamagesCalculator, netCalc, questionnaire, scenarios, ScenariosPanel).
- **getRiskPctFromSheet (netCalc.ts):**  
  א) קודם מחפשים `enabled && type === 'risk'` ומחזירים את ה-`percent` שלהם.  
  ב) אם לא נמצא — fallback לזיהוי לפי label (סיכוי|חלמה|loss|chance|risk) לתאימות לאחור.
- **UI:** כפתור "סיכון (%)" / "Risk (%)" שמוסיף הפחתה עם `type: 'risk'` ו-`percent`. ברירת המחדל של ההפחתה "פגיעה בסיכויי החלמה (%)" היא `type: 'risk'`. בשאלון — כשמוסיפים הפחתת loss of chance נוצר reduction עם `type: 'risk'`.
- **Import/JSON:** בעת טעינה שומרים `type: 'risk'` כשקיים (פרסור reductions).

לוגיקה עסקית (סדר החישוב, נוסחאות) לא השתנתה.

---

## Build

`npm run build` — מסתיים בהצלחה (Compiled successfully).
