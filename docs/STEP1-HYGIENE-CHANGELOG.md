# שלב 1 — היגיינה ואמינות: סיכום שינויים

## רשימת קבצים ששונו

| קובץ | מה בוצע |
|------|---------|
| **api/src/routes/assistant.ts** | הוספת rate limiter ל-`POST /search`: 10 בקשות לדקה למשתמש (או IP), keyGenerator לפי `req.user?.id ?? req.ip`. תגובת 429: `{ error: 'rate_limited', retryAfterSeconds: 60 }`, כותרת Retry-After, לוג `[rate-limit] assistant/search 429`. |
| **api/src/routes/auth.ts** | עדכון login limiter: handler מותאם שמחזיר 429 עם `{ error: 'rate_limited', retryAfterSeconds: 900 }` ו-Retry-After. הוספת `generalAuthLimiter` (10 לדקה ל-IP) על כל הראוטר של auth (login, logout, me) עם אותו פורמט 429 ולוג. |
| **src/services/api.ts** | טיפול בשגיאות: 401/403 מחזירים Error עם `status`. לכל תגובה לא-OK: פרסור JSON, זיהוי 429 (rate_limited) ו-5xx (server_error), השלכת `ApiError` עם `status` ו-`retryAfterSeconds` (ב-429). |
| **src/services/assistantApi.ts** | Timeout 18 שניות עם `AbortController`; השלכת שגיאה עם `status: 408` במקרה timeout. ייצוא `ASSISTANT_REQUEST_TIMEOUT_MS`. |
| **src/components/BotAssistantWidget.tsx** | מיפוי שגיאות: `getAssistantErrorInfo()` מחזיר הודעה ברורה (session_expired, rate_limited, timeout, server_error, network_error). תצוגת שגיאה: קופסה עם הודעה + כפתור "נסה שוב" + כפתור "התחבר מחדש" ב-401/403 (אופציונלי `onReLogin`). |
| **src/components/DamagesCalculator.tsx** | **Undo:** עדכון "הוצאות תובע" דרך `setSheetWithHistory` במקום `setSheet` כדי ש-Undo יתפוס את השינוי. **נתבעים:** הוספת `sumDefendantsPercent`, `normalizeDefendants` (חלוקה יחסית ל-100%, עיגול + תיקון אחרון). אזהרה בולטת כשסכום ≠ 100% + כפתור "נרמל ל-100%". |

---

## איך לבדוק ידנית

1. **Rate limit → 429 והודעת UI**
   - להריץ את ה-API מקומית; לשלוח 11+ בקשות POST ל-`/api/assistant/search` בתוך דקה (עם Authorization תקף).
   - לצפות ב-429 עם body: `{ "error": "rate_limited", "retryAfterSeconds": 60 }`.
   - ב-Frontend (מסך מסמכים עם עוזר): לאחר 429 לראות הודעה "יותר מדי בקשות. נא לנסות שוב בעוד X שניות" וכפתור "נסה שוב".

2. **401 → הודעת session expired**
   - לשלוח POST ל-`/api/assistant/search` בלי token או עם token לא תקף.
   - ב-UI: הודעה "ההתחברות פגה. נא להתחבר מחדש." + כפתורים "נסה שוב" ו"התחבר מחדש".

3. **שגיאת רשת**
   - לכבות את הרשת או להצביע על כתובת API לא נכונה; לשלוח שאלה בעוזר.
   - לצפות בהודעה בסגנון "בעיית רשת. וודא את החיבור ונסה שוב." וכפתור "נסה שוב".

4. **Undo הוצאות תובע**
   - במחשבון הנזק: לשנות "הוצאות תובע" לערך כלשהו.
   - ללחוץ Ctrl+Z (או "בטל").
   - לוודא שהערך חוזר למצב הקודם.

5. **אזהרה + נרמול אחוזי נתבעים**
   - לשנות אחוזי נתבעים כך שהסכום ≠ 100% (למשל 60% + 50%).
   - לוודא: תג אזהרה "סה״כ אחוזים: X%", קופסת אזהרה ברורה, כפתור "נרמל ל-100%".
   - ללחוץ "נרמל ל-100%" — האחוזים מתעדכנים יחסית וסכומם 100%.

6. **נרמול אחרי ייבוא**
   - לייבא JSON שבו defendants עם סכום אחוזים ≠ 100%.
   - לוודא שהופיעה האזהרה וכפתור "נרמל ל-100%"; ללחוץ ולוודא נרמול.

7. **Timeout**
   - (אופציונלי) להאט את ה-API או לחסום תשובה ל-`/api/assistant/search` יותר מ-18 שניות — ב-UI להופיע הודעת timeout ו"נסה שוב".

---

## בדיקות אוטומטיות

- **API:** `cd api && npm run test` — כל 46 הטסטים עברו.
- **Frontend:** `npm run test` — טסט placeholder עבר.

---

## הערות

- דיסקליימר לא נוסף (לפי ההגבלות).
- `onReLogin` ב-`BotAssistantWidget` אופציונלי; אם האפליקציה מספקת callback (למשל פתיחת מסך התחברות), יש להעבירו כ-prop.
- Rate limit ב-auth: login 5 כל 15 דקות; שאר auth (logout, me) 10 לדקה ל-IP.
