# דוח: יישור קו לוגיקת "After" – סדר הפחתות קבוע

## רשימת קבצים ששונו

| קובץ | שינוי |
|------|--------|
| `src/utils/adjustmentsOrder.ts` | **חדש.** פונקציה טהורה `applyAdjustmentsInOrder(baseTotal, contribPct, reductions, riskPctOverride?)` – סדר: Before → contrib → NII/others → risk. זיהוי loss-of-chance לפי label (סיכוי|חלמה|loss|chance). |
| `src/components/DamagesCalculator.tsx` | החלפת `applyContribAndReductions` ב-`computeAfter` שמשתמש ב-`applyAdjustmentsInOrder`. העברת `sheet.reductions` ל-`ScenariosPanel`. |
| `src/utils/scenarios.ts` | שימוש ב-`applyAdjustmentsInOrder` ב-`computeScenarioResult`; חתימה חדשה עם `sheetReductions`; סדר: contrib (מהתרחיש) → NII/others (מהגיליון) → risk (lossOfChancePct מהתרחיש). |
| `src/components/ScenariosPanel.tsx` | קבלת `sheetReductions` כ-prop והעברה ל-`computeScenarioResult`. |
| `src/utils/calcI18n.ts` | עדכון `totalBefore` / `totalAfter` ו-`scenarioAssumptions` לדו-לשוני מדויק (לפני/אחרי אשם תורם + מל"ל + סיכון). |
| `src/utils/exportForWordI18n.ts` | עדכון `totalAfter` ל־he/en-GB כמו ב-calcI18n. |

---

## סדר החישוב המחייב (אמת אחת)

1. **Total Before** = נטו משורות (תוספות − קיזוזים).
2. **אשם תורם (Contrib)** = Before × (1 − contribPct/100).
3. **NII/אחרים** = אחרי contrib × מכפלת (1 − pct/100) להפחתות שאינן "סיכוי/חלמה".
4. **סיכון (Risk / Loss of chance)** = אחרי NII × (1 − riskPct/100) — או מכפלת הפחתות שכן מסומנות כ-loss-of-chance.
5. **חלוקת נתבעים** = על Total After (afterRisk).

בתרחישים: contrib ו-risk מגיעים מפרמטרי התרחיש; NII/אחרים מגיעים מ-`sheet.reductions` של הגיליון.

---

## דוגמה מספרית (4 שלבים)

**נתונים:**  
Before = 1,000,000 ₪  
אשם תורם = 10%  
הפחתה "אחרת" (לא סיכוי) = 5%  
פגיעה בסיכויי החלמה = 20%

| שלב | חישוב | תוצאה (₪) |
|-----|--------|------------|
| Before | — | 1,000,000 |
| afterContrib | 1,000,000 × 0.9 | 900,000 |
| afterNii | 900,000 × 0.95 | 855,000 |
| afterRisk | 855,000 × 0.8 | **684,000** |

**Total After** = 684,000 ₪.

**שתי שפות (תוויות):**
- he: סה״כ לפני = 1,000,000 | סה״כ אחרי (אשם תורם + מל״ל + סיכון) = 684,000
- en-GB: Total (Before) = 1,000,000 | Total (After: contrib. negligence + NII + risk) = 684,000

---

## בדיקות מומלצות (ידניות)

1. **בלי NII ובלי risk:** רק אשם תורם → After = Before × (1 − contrib/100).
2. **עם NII בלבד:** Before → contrib → הפחתה לא-סיכוי (למשל 5%) → After.
3. **עם risk בלבד:** Before → contrib → הפחתת סיכוי (למשל 15%) → After.
4. **עם NII + risk:** Before → contrib → NII → risk (כמו בדוגמה למעלה).
5. **חלוקת נתבעים:** סכום לכל נתבע = Total After × (אחוז הנתבע/100).
6. **תרחיש מול מחשבון:** תרחיש "סביר" עם אותם אחוזי contrib ו-loss of chance כמו בגיליון, ואותם reductions – Total After זהה למחשבון.

---

## Build

`npm run build` — מסתיים בהצלחה (Compiled successfully).
