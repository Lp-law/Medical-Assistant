# Bot AI Features – הוראות שימוש ומגבלות

## שימוש (כל הפיצ'רים דו־לשוניים: עברית / English UK)

### 1) Sanity Check (בדיקת שפיות)
- בחר שפה (עברית / English) בראש המחשבון.
- לחץ **"בדיקת שפיות"** (או Sanity Check).
- יוצגו דגלים: אחוזי נתבעים ≠ 100%, הפחתות כפולות, after > before, ערכים שליליים, שורה חריגה, אי-התאמת סיכום.
- לכל דגל עם **תקן**: לחץ **"תקן"** להחלת תיקון בודד.
- **"תקן את כל הבטוחים"**: מחיל כל התיקונים הבטוחים (נרמול נתבעים, הסרת כפילות).
- כל תיקון עובר דרך Undo – אפשר לבטל (Ctrl+Z).

### 2) Smart Questionnaire (שאלון חכמה)
- לחץ **"שאלון חכמה"** (או Smart questionnaire).
- המערכת מציגה שאלות לפי חוסרים (אשם תורם, פגיעה בסיכויי החלמה, מספר נתבעים, הוצאות תובע, אחוז שכ"ט).
- הזן תשובות ולחץ **"בנה הצעה"**.
- בדוק תצוגת מקדימה ולחץ **"החל"** – השינויים יוחלו על הגיליון (עם Undo).

### 3) Three Scenarios (שלושה תרחישים)
- מתחת לבדיקת שפיות מופיע פאנל **"שלושה תרחישים"**.
- לכל תרחיש (שמרני / סביר / אגרסיבי) הזן: אשם תורם (%), פגיעה בסיכויי החלמה (%).
- התוצאות (לפני / לאחר) מתעדכנות אוטומטית.
- **"יצוא תרחישים ל-Word"**: מעתיק ללוח טבלת סיכום + תרשים PNG להדבקה ב-Word.

---

## רשימת קבצים ששונו/נוספו

| קובץ | למה |
|------|-----|
| `src/utils/calcI18n.ts` | מילון he/en-GB לכל הטקסטים (sanity, questionnaire, scenarios), פונקציות t/tReplace |
| `src/context/LangContext.tsx` | Context לשפת ממשק (he | en-GB) |
| `src/utils/sanityCheck.ts` | בדיקות דטרמיניסטיות, buildFixPatch, buildFixAllSafePatch |
| `src/components/SanityCheckPanel.tsx` | UI לבדיקת שפיות + כפתורי תקן |
| `src/utils/questionnaire.ts` | getGapQuestions, buildProposal (Patch מהתשובות) |
| `src/components/QuestionnaireModal.tsx` | מודל שאלות, תשובות, תצוגת מקדימה, החל |
| `src/utils/scenarios.ts` | ScenarioParams, computeScenarioResult, defaultScenarioParams |
| `src/utils/scenariosExport.ts` | buildScenariosWordHtml, exportScenariosToWord (לוח) |
| `src/components/ScenariosPanel.tsx` | קלט 3 תרחישים, תצוגה, יצוא ל-Word |
| `src/components/DamagesCalculator.tsx` | מתג שפה, SanityCheckPanel, QuestionnaireModal, ScenariosPanel, applySanityPatch, applyQuestionnairePatch |
| `src/App.tsx` | גלילת LangProvider |
| `docs/BOT-FEATURES-PLAN.md` | תוכנית וסריקה |
| `docs/BOT-FEATURES-USAGE.md` | דף זה |

---

## מגבלות ידועות (Known limitations)

- **Questionnaire:** חלוקת נתבעים מוגדרת לפי "כמה נתבעים" (1–10) עם חלוקת אחוזים שווה; אין עריכת שם/אחוז per defendant בשאלון.
- **Scenarios:** כרגיל רק אשם תורם ופגיעה בסיכויי החלמה; חלוקת נתבעים per תרחיש לא מוזנת ב-UI (נשארת מהגיליון).
- **Export scenarios:** ההעתקה כוללת טבלה + תמונה; בדפדפנים מסוימים רק הטבלה מועתקת – אז יש להדביק את התמונה בנפרד או להשתמש ב-DOCX.
- אין קריאות ל-LLM; כל הלוגיקה דטרמיניסטית ב-frontend.

---

## מה לשפר ב-V2

- Questionnaire: עריכת שמות ואחוזים לנתבעים מתוך השאלון.
- Scenarios: הזנת חלוקת נתבעים שונה לכל תרחיש.
- API אופציונלי: endpoints לניסוח טקסט (כותרות/הסברים) בעברית/אנגלית בלי לשלוח נתונים רגישים.
- ייצוא DOCX ישיר לתרחישים (קובץ להורדה) במקום העתקה ללוח.
