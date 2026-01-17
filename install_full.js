
const fs = require('fs');
const path = require('path');

console.log("Starting full LexMedical installation...");

const files = {
  'package.json': `{
  "name": "lexmedical-app",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@azure/openai": "^1.0.0-beta.11",
    "@azure/search-documents": "^12.0.0",
    "lucide-react": "^0.263.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "typescript": "^4.9.5",
    "web-vitals": "^2.1.4",
    "html2canvas": "^1.4.1"
  },
  "devDependencies": {
    "@types/node": "^16.18.126",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "es5",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": [
    "src"
  ]
}`,

  'public/index.html': `<!DOCTYPE html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LexMedical - מערכת הגנה משולבת</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Rubik', sans-serif;
        background-color: #f8fafc;
      }
      h1, h2, h3, .serif {
        font-family: 'Frank Ruhl Libre', serif;
      }
      /* Custom print styles */
      @media print {
        @page { size: A4; margin: 1.5cm; }
        body { background-color: white; -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        aside, header { display: none !important; }
        main { height: auto !important; overflow: visible !important; display: block !important; }
        #legal-report { 
          width: 100% !important; 
          box-shadow: none !important; 
          border: none !important; 
          margin: 0 !important; 
          padding: 0 !important; 
        }
      }
    </style>
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased">
    <div id="root"></div>
  </body>
</html>`,

  'src/index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

  'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out;
  }
  .animate-slideInRight {
    animation: slideInRight 0.3s ease-out;
  }
  .animate-slideInLeft {
    animation: slideInLeft 0.3s ease-out;
  }
  .animate-gradient-x {
    background-size: 200% 200%;
    animation: gradient-x 3s ease infinite;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes gradient-x {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #0f172a; 
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155; 
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569; 
}`,

  'src/types.ts': `
export enum UserRole {
  USER_A = 'User A',
  USER_B = 'User B',
  USER_C = 'User C',
  USER_D = 'User D',
  USER_E = 'User E',
  ADMIN_LIOR = 'Lior (Admin)',
  ADMIN_HAVA = 'Hava (Admin)',
}

export interface UserProfile {
  id: UserRole;
  name: string;
  password?: string;
  isAdmin?: boolean;
}

export interface AzureConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  searchEndpoint?: string;
  searchKey?: string;
  searchIndexName?: string;
}

export interface AttachedFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  contentSummary?: string;
}

export interface BookChapter {
  id: string;
  title: string;
  content: string;
  tags: string[];
  rules: string[];
}

export interface GlobalPrecedent extends LegalPrecedent {
  tags: string[];
  relevantIssues: string[];
}

export interface ConsistencyWarning {
  id: string;
  severity: 'High' | 'Medium';
  message: string;
  suggestedAction: string;
  ruleSource?: string;
}

export interface Issue {
  id: string;
  description: string;
  plaintiffAllegation: string;
  defenseAllegation: string;
  breachFactors: string;
  causationFactors: string;
  linkedBookChapters?: string[];
}

export interface LegalPrecedent {
  id: string;
  caseName: string;
  citation?: string;
  keyTakeaway: string;
  attachedFile?: AttachedFile;
  tags?: string[];
}

export type ExpertStance = 'Plaintiff' | 'Defense' | 'Neutral' | 'None';

export interface ExpertOpinion {
  id: string;
  name: string;
  specialty: string;
  summary: string;
  attachedFile?: AttachedFile;
}

export interface LiabilityAnalysis {
  issues: Issue[];
  medicalRecordQuality: 'Complete' | 'Partial' | 'Missing' | 'Contradictory';
  doctrines: string[];
  precedents: LegalPrecedent[];
  expertsPlaintiff: ExpertOpinion[];
  expertsDefense: ExpertOpinion[];
  expertCourtOpinions: ExpertOpinion[];
  expertCourtStance: ExpertStance;
  aggravatingFactors: number;
  mitigatingFactors: number;
  probability: number;
  probabilityRange: [number, number];
  uncertainty: 'Low' | 'Medium' | 'High';
  strengthsPlaintiff: string[];
  weaknessesPlaintiff: string[];
  strengthsDefense: string[];
  weaknessesDefense: string[];
  activeConsistencyWarnings?: ConsistencyWarning[];
}

export interface DamagesHead {
  id: string;
  name: string; 
  isActive: boolean;
  parameters: Record<string, number | string>; 
  calculatedAmount: number;
  notes: string;
}

export interface DamagesData {
  dateOfBirth: string; 
  gender: 'Male' | 'Female'; 
  dateOfEvent: string; 
  dateOfCalc: string; 
  dateOfRetirement: string; 
  ageAtInjury: number; 
  currentAge: number; 
  lifeExpectancy: number; 
  wagePreInjury: number; 
  wagePostInjury: number;
  permanentDisabilityMedical: number;
  permanentDisabilityFunctional: number;
  daysOfHospitalization: number; 
  interestRate: number; 
  heads: DamagesHead[];
  precedents: LegalPrecedent[];
}

export interface CaseData {
  id: string;
  name: string;
  attorney: UserRole;
  summary: string;
  summaryFiles: AttachedFile[];
  liability: LiabilityAnalysis;
  damages: DamagesData;
  lastUpdated: string;
}`,

  'src/services/auth.ts': `import { UserRole, UserProfile } from '../types';

const MOCK_USERS: UserProfile[] = [
  { id: UserRole.USER_A, name: 'User A', password: '123' },
  { id: UserRole.USER_B, name: 'User B', password: '123' },
  { id: UserRole.USER_C, name: 'User C', password: '123' },
  { id: UserRole.USER_D, name: 'User D', password: '123' },
  { id: UserRole.USER_E, name: 'User E', password: '123' },
  { id: UserRole.ADMIN_LIOR, name: 'Lior (Admin)', password: 'admin', isAdmin: true },
  { id: UserRole.ADMIN_HAVA, name: 'Hava (Admin)', password: 'admin', isAdmin: true },
];

export const authenticateUser = (username: string, pass: string): UserRole | null => {
  const user = MOCK_USERS.find(u => u.name === username || u.id === username);
  if (user && user.password === pass) {
    return user.id;
  }
  return null;
};

export const isAdmin = (role: UserRole): boolean => {
  return role === UserRole.ADMIN_LIOR || role === UserRole.ADMIN_HAVA;
};`,

  'src/services/azureService.ts': `import { AzureConfig, CaseData, Issue, ConsistencyWarning } from '../types';

export const isAzureConfigured = (): boolean => {
  const configStr = localStorage.getItem('lex_azure_config');
  if (!configStr) return false;
  const config: AzureConfig = JSON.parse(configStr);
  return !!config.apiKey && !!config.endpoint;
};

export const getAzureConfig = (): AzureConfig | null => {
  const configStr = localStorage.getItem('lex_azure_config');
  return configStr ? JSON.parse(configStr) : null;
};

export const saveAzureConfig = (config: AzureConfig) => {
  localStorage.setItem('lex_azure_config', JSON.stringify(config));
};

const callOpenAI = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  console.log("Azure Simulation Call:", { systemPrompt, userPrompt });
  return new Promise(resolve => {
    setTimeout(() => {
      resolve("Mock Response: Azure API connected successfully. This text is generated by the simulation layer. In production, this would be the GPT-4o response based on your custom prompts.");
    }, 1500);
  });
};

export const azureGenerateArgument = async (issue: Issue, side: 'Plaintiff' | 'Defense', caseSummary: string): Promise<string> => {
  if (!isAzureConfigured()) return "Azure configuration missing.";
  const systemPrompt = \`You are a senior Israeli medical malpractice attorney. Role: Draft a legal argument for the \${side}.\`;
  const userPrompt = \`Case Summary: \${caseSummary}. Issue: \${issue.description}\`;
  return await callOpenAI(systemPrompt, userPrompt);
};

export const azureAnalyzeConsistency = async (caseData: CaseData): Promise<ConsistencyWarning[]> => {
  if (!isAzureConfigured()) return [];
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        {
          id: 'azure_sim_1',
          severity: 'Medium',
          message: 'Azure Analysis: Identified tension between high liability score and neutral court expert.',
          suggestedAction: 'Review recent Supreme Court rulings on expert weight.',
          ruleSource: 'Azure AI Logic'
        }
      ]);
    }, 2000);
  });
};`,

  'src/services/calculations.ts': `import { DamagesData, DamagesHead, ExpertStance, CaseData } from '../types';

declare const html2canvas: any;

export const formatCurrency = (val: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(val);
export const formatPercent = (val: number) => \`\${val}%\`;

export const getMonthsDiff = (d1: string, d2: string): number => {
  const start = new Date(d1);
  const end = new Date(d2);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + (end.getDate() - start.getDate()) / 30;
};

export const calculateAge = (dob: string, targetDate: string): number => {
  const birth = new Date(dob);
  const target = new Date(targetDate);
  if (isNaN(birth.getTime()) || isNaN(target.getTime())) return 0;
  let age = target.getFullYear() - birth.getFullYear();
  const m = target.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && target.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const getLifeExpectancy = (gender: 'Male' | 'Female'): number => {
  return gender === 'Male' ? 82 : 85;
};

export const captureAndCopy = async (elementId: string, title: string = 'Visual') => {
  const element = document.getElementById(elementId);
  if (!element) return;
  try {
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = '#ffffff';
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
    element.style.backgroundColor = originalBg;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item]).then(() => { alert('הועתק ללוח!'); });
    });
  } catch (err) { console.error(err); alert('שגיאה ביצירת התמונה.'); }
};

export const generateDamageAssessmentCSV = (caseData: CaseData) => {
  const liabilityProb = caseData.liability.probability;
  const rows = [];
  rows.push(['דוח תחשיב נזק - ייצוא לאקסל']);
  rows.push(['שם התיק:', caseData.name]);
  rows.push(['תאריך הפקה:', new Date().toLocaleDateString('he-IL')]);
  rows.push(['הסתברות לחבות:', \`\${liabilityProb}%\`]);
  rows.push([]); 
  rows.push(['ראש נזק','פירוט / הערות','סכום מלא (100%) - MPL','אחוז חבות','סכום משוקלל (תוחלת נזק)']);

  let totalMPL = 0;
  let totalExpected = 0;

  caseData.damages.heads.forEach(head => {
    if (!head.isActive) return;
    const amount = head.calculatedAmount;
    const weightedAmount = Math.round(amount * (liabilityProb / 100));
    totalMPL += amount;
    totalExpected += weightedAmount;
    let details = '';
    if (head.parameters.isGlobalSum) details = 'סכום גלובלי';
    else if (head.parameters.monthlyCost) details = \`לפי עלות חודשית: \${head.parameters.monthlyCost}\`;
    else details = 'חישוב אקטוארי';
    rows.push([head.name, details, amount, \`\${liabilityProb}%\`, weightedAmount]);
  });

  rows.push([]);
  rows.push(['סה"כ כללי','',totalMPL,'',totalExpected]);

  const csvContent = rows.map(e => e.join(",")).join("\\n");
  const blob = new Blob(["\\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", \`tahshiv_\${caseData.name}.csv\`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const calculateLiabilityScore = (baseScore: number, aggravating: number, mitigating: number, recordQuality: string, courtExpertStance: ExpertStance) => {
  let score = baseScore;
  score += aggravating * 2.5;
  score -= mitigating * 2.5;
  if (recordQuality === 'Missing') score += 15;
  if (recordQuality === 'Contradictory') score += 5;
  if (courtExpertStance === 'Plaintiff') score += 25;
  if (courtExpertStance === 'Defense') score -= 25;
  score = Math.max(0, Math.min(100, score));
  
  let rangeWidth = 10;
  let uncertainty: 'Low' | 'Medium' | 'High' = 'Low';
  if (recordQuality === 'Missing' || recordQuality === 'Contradictory') { rangeWidth = 20; uncertainty = 'High'; }
  else if (courtExpertStance === 'Neutral' || courtExpertStance === 'None') { rangeWidth = 15; uncertainty = 'Medium'; }

  const min = Math.max(0, Math.floor(score - rangeWidth / 2));
  const max = Math.min(100, Math.ceil(score + rangeWidth / 2));
  return { probability: Math.round(score), range: [min, max], uncertainty };
};

export const getCapitalizationCoeff = (months: number, interestRateYearly: number = 0.03): number => {
  if (months <= 0) return 0;
  const i = interestRateYearly / 12;
  if (interestRateYearly === 0) return months;
  return (1 - Math.pow(1 + i, -months)) / i;
};

export const calculateMPL = (data: DamagesData): number => {
  return data.heads.filter(h => h.isActive).reduce((acc, curr) => acc + (curr.calculatedAmount || 0), 0);
};

export const calculateHeadValue = (head: DamagesHead, data: DamagesData): number => {
  const p = head.parameters;
  switch (head.name) {
    case 'הפסד שכר לעבר': {
      const months = getMonthsDiff(data.dateOfEvent, data.dateOfCalc);
      if (months <= 0) return 0;
      const baseTotal = months * data.wagePreInjury * ((data.permanentDisabilityFunctional || 0) / 100);
      return Math.round(baseTotal * (1 + ((months / 12) / 2 * 0.03)));
    }
    case 'הפסד שכר לעתיד': {
      const monthsToRetire = Math.max(0, 67 - data.currentAge) * 12;
      return Math.round(data.wagePreInjury * ((data.permanentDisabilityFunctional || 0) / 100) * getCapitalizationCoeff(monthsToRetire, 0.03));
    }
    case 'הפסד פנסיה ותנאים סוציאליים': {
      const pastVal = calculateHeadValue({ ...head, name: 'הפסד שכר לעבר', parameters: {} }, data);
      const futureVal = calculateHeadValue({ ...head, name: 'הפסד שכר לעתיד', parameters: {} }, data);
      return Math.round((pastVal + futureVal) * 0.125);
    }
    case 'כאב וסבל': {
      const daysComp = (data.daysOfHospitalization || 0) * 400;
      const ageFactor = Math.max(0.4, 1 - ((data.currentAge - 30) * 0.01));
      const disabilityComp = (data.permanentDisabilityMedical || 0) * 4000 * (data.currentAge > 30 ? ageFactor : 1);
      return Math.round(daysComp + disabilityComp);
    }
    default:
      if (p.isGlobalSum) return Number(p.globalSum || 0);
      const monthly = Number(p.monthlyCost || 0);
      if (head.name.includes('עבר')) return Math.round(getMonthsDiff(data.dateOfEvent, data.dateOfCalc) * monthly);
      const yearsRemaining = Math.max(0, data.lifeExpectancy - data.currentAge);
      return Math.round(monthly * getCapitalizationCoeff(yearsRemaining * 12, 0.03));
  }
};`,

  'src/services/knowledgeBase.ts': `import { BookChapter, GlobalPrecedent } from '../types';

const INITIAL_BOOK_CHAPTERS: BookChapter[] = [
  {
    id: 'ch_1',
    title: 'פרק א׳: איחור באבחון (Delayed Diagnosis)',
    content: 'הפרק עוסק באחריות רופא לאבחן מחלה במועד. הכלל הקובע: האם רופא סביר היה מגלה את הממצאים במועד מוקדם יותר?',
    tags: ['איחור', 'אבחון', 'דיאגנוזה', 'סרטן', 'החמרה'],
    rules: ['יש לבדוק האם היו תסמינים מחשידים בזמן אמת.','האם בוצעו בדיקות סקר לפי הפרוטוקול?','קשר סיבתי: האם האיחור גרם לנזק ראייתי?']
  },
  {
    id: 'ch_2',
    title: 'פרק ב׳: הסכמה מדעת (Informed Consent)',
    content: 'חובת הגילוי של הרופא למטופל אודות סיכונים וחלופות טיפול.',
    tags: ['הסכמה', 'ניתוח', 'סיכון', 'הסבר', 'חלופות'],
    rules: ['מבחן המטופל הסביר.','חובה לפרט סיכונים שכיחים.','החתמה על טופס אינה מספיקה ללא הסבר.']
  },
  {
    id: 'ch_3',
    title: 'פרק ג׳: נזק ראייתי (Evidential Damage)',
    content: 'היעדר רשומות רפואיות והשפעתו על נטל הראיה.',
    tags: ['רשומה', 'תיעוד', 'חסר', 'נטל', 'ראיה'],
    rules: ['היעדר רישום מעביר את נטל הראיה.','נזק ראייתי מובנה מעצם אי ביצוע בדיקה.']
  }
];

const INITIAL_GLOBAL_PRECEDENTS: GlobalPrecedent[] = [
  {
    id: 'gp_1',
    caseName: 'ע"א 1234/18 פלוני נ" שירותי בריאות כללית',
    keyTakeaway: 'נקבע כי איחור של 4 חודשים באבחון סרטן השד מהווה רשלנות. נפסק כי יש לפצות לפי "אובדן סיכויי החלמה".',
    tags: ['סרטן', 'שד', 'איחור', 'אבחון'],
    citation: 'תק-על 2019(1)',
    relevantIssues: []
  },
  {
    id: 'gp_2',
    caseName: 'ת"א (חיפה) 555/20 אלמונית נ" בי"ח רמב"ם',
    keyTakeaway: 'היעדר הסכמה מדעת בניתוח אלקטיבי - נפסק פיצוי בגין פגיעה באוטונומיה בלבד. סכום: 150,000 ש"ח.',
    tags: ['הסכמה', 'אוטונומיה', 'ניתוח', 'אלקטיבי'],
    citation: 'פס"ד מחוזי 2020',
    relevantIssues: []
  }
];

export const getKnowledgeBase = () => {
  const storedBooks = localStorage.getItem('lex_brain_books');
  const storedPrecedents = localStorage.getItem('lex_brain_precedents');
  return {
    chapters: storedBooks ? JSON.parse(storedBooks) : INITIAL_BOOK_CHAPTERS,
    precedents: storedPrecedents ? JSON.parse(storedPrecedents) : INITIAL_GLOBAL_PRECEDENTS
  };
};

export const saveBookChapter = (chapter: BookChapter) => {
  const kb = getKnowledgeBase();
  const updated = [...kb.chapters, chapter];
  localStorage.setItem('lex_brain_books', JSON.stringify(updated));
};

export const saveGlobalPrecedent = (precedent: GlobalPrecedent) => {
  const kb = getKnowledgeBase();
  const updated = [...kb.precedents, precedent];
  localStorage.setItem('lex_brain_precedents', JSON.stringify(updated));
};

export const findRelevantKnowledge = (query: string) => {
  if (!query || query.length < 3) return { chapters: [], precedents: [] };
  const kb = getKnowledgeBase();
  const terms = query.toLowerCase().split(' ').filter(t => t.length > 2);
  const scoreItem = (text: string, tags: string[]) => {
    let score = 0;
    terms.forEach(term => {
      if (text.includes(term)) score += 1;
      if (tags.some(t => t.includes(term))) score += 3;
    });
    return score;
  };
  return {
    chapters: kb.chapters.map(ch => ({ ...ch, score: scoreItem(ch.title + ' ' + ch.content, ch.tags) })).filter(ch => ch.score > 0).sort((a, b) => b.score - a.score),
    precedents: kb.precedents.map(pr => ({ ...pr, score: scoreItem(pr.caseName + ' ' + pr.keyTakeaway, pr.tags || []) })).filter(pr => pr.score > 0).sort((a, b) => b.score - a.score)
  };
};`,

  'src/services/aiReasoning.ts': `import { CaseData, ConsistencyWarning, Issue } from '../types';
import { getKnowledgeBase } from './knowledgeBase';
import { isAzureConfigured, azureGenerateArgument, azureAnalyzeConsistency } from './azureService';

export const checkConsistency = async (caseData: CaseData): Promise<ConsistencyWarning[]> => {
  const localWarnings = checkLocalConsistency(caseData);
  if (isAzureConfigured()) {
    try {
      const azureWarnings = await azureAnalyzeConsistency(caseData);
      return [...localWarnings, ...azureWarnings];
    } catch (e) { return localWarnings; }
  }
  return localWarnings;
};

export const generateLegalArgument = async (issue: Issue, side: 'Plaintiff' | 'Defense', caseSummary: string): Promise<string> => {
  if (isAzureConfigured()) {
    try { return await azureGenerateArgument(issue, side, caseSummary); } catch (e) {}
  }
  return generateLocalArgument(issue.description, side);
};

const checkLocalConsistency = (caseData: CaseData): ConsistencyWarning[] => {
  const warnings: ConsistencyWarning[] = [];
  const { liability } = caseData;
  if ((liability.medicalRecordQuality === 'Missing' || liability.medicalRecordQuality === 'Contradictory') && liability.probability < 50) {
    warnings.push({
      id: 'warn_records_1',
      severity: 'High',
      message: 'סתירה לוגית (מקומי): סומן חוסר ברשומות, אך ציון החבות נמוך.',
      suggestedAction: 'לפי פרק ג\\' בספר, היעדר רישום מעביר נטל. שקול העלאת סיכון.',
      ruleSource: 'חוקי הספר (Local)'
    });
  }
  if (liability.expertCourtStance === 'Defense' && liability.probability > 60) {
    warnings.push({
      id: 'warn_expert_1',
      severity: 'High',
      message: 'חריגה סטטיסטית (מקומי): מומחה ביהמ"ש תומך בהגנה, אך ציון החבות גבוה.',
      suggestedAction: 'בדוק האם יש סיבה חריגה לסטות מחוות דעת המומחה.',
      ruleSource: 'פסיקה (Local)'
    });
  }
  return warnings;
};

const generateLocalArgument = (issueDescription: string, side: 'Plaintiff' | 'Defense'): string => {
  const kb = getKnowledgeBase();
  const relevantChapter = kb.chapters.find(ch => ch.tags.some(tag => issueDescription.includes(tag)));
  if (!relevantChapter) return 'לא נמצא מידע מספיק ב"ספר" המקומי. (חבר את Azure לקבלת ניסוח יצירתי מלא)';
  if (side === 'Plaintiff') return \`בהתבסס על \${relevantChapter.title}, נטען כי הרופא הסביר היה פועל אחרת. \${relevantChapter.rules[0] || ''}\`;
  else return \`מנגד, ההגנה תטען כי הפעולות בוצעו בהתאם לשיקול דעת סביר (Ex Ante). \${relevantChapter.title} קובע כי לא כל טעות היא רשלנות.\`;
};`,

  'src/components/LoginScreen.tsx': `import React, { useState } from 'react';
import { authenticateUser } from '../services/auth';
import { UserRole } from '../types';
import { Shield, Lock, User } from 'lucide-react';

interface Props {
  onLogin: (role: UserRole) => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const role = authenticateUser(username, password);
    if (role) {
      onLogin(role);
    } else {
      setError('שם משתמש או סיסמה שגויים');
    }
  };

  const quickLogin = (role: UserRole, pass: string) => {
    onLogin(role);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="bg-slate-900 w-16 h-16 rounded-lg mx-auto flex items-center justify-center mb-4 text-white shadow-xl">
             <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 serif">LexMedical</h1>
          <p className="text-slate-500 mt-2">מערכת הגנה וניהול סיכונים רפואיים</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
             <label className="block text-sm font-bold text-slate-700 mb-1">שם משתמש / ID</label>
             <div className="relative">
               <User className="w-5 h-5 absolute top-2.5 right-3 text-slate-400" />
               <input 
                 type="text" 
                 className="w-full p-2 pr-10 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                 placeholder="הזן שם משתמש..."
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
               />
             </div>
          </div>
          <div>
             <label className="block text-sm font-bold text-slate-700 mb-1">סיסמה</label>
             <div className="relative">
               <Lock className="w-5 h-5 absolute top-2.5 right-3 text-slate-400" />
               <input 
                 type="password" 
                 className="w-full p-2 pr-10 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                 placeholder="הזן סיסמה..."
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
               />
             </div>
          </div>
          {error && <div className="text-red-500 text-sm text-center font-bold">{error}</div>}
          <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded font-bold hover:bg-slate-800 transition shadow-lg">כניסה למערכת</button>
        </form>

        <div className="mt-8 border-t pt-4">
           <p className="text-center text-xs text-slate-400 mb-3">כניסה מהירה (Demo Mode)</p>
           <div className="grid grid-cols-2 gap-2">
             <button onClick={() => quickLogin(UserRole.USER_A, '123')} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded">User A (Attorney)</button>
             <button onClick={() => quickLogin(UserRole.ADMIN_LIOR, 'admin')} className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 py-2 rounded">Lior (Admin)</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;`,

  'src/components/AdminDashboard.tsx': `import React, { useState } from 'react';
import { UserRole, BookChapter, GlobalPrecedent } from '../types';
import { saveBookChapter, saveGlobalPrecedent, getKnowledgeBase } from '../services/knowledgeBase';
import { Book, Gavel, LogOut, Save, Layout } from 'lucide-react';

interface Props {
  currentUser: UserRole;
  onEditCase: (caseData: any) => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<Props> = ({ currentUser, onEditCase, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'cases' | 'knowledge'>('knowledge');
  const [brain, setBrain] = useState(getKnowledgeBase());
  const [newChapter, setNewChapter] = useState<Partial<BookChapter>>({ title: '', content: '', tags: [], rules: [] });
  const [newPrecedent, setNewPrecedent] = useState<Partial<GlobalPrecedent>>({ caseName: '', keyTakeaway: '', tags: [] });

  const handleSaveChapter = () => {
    if (!newChapter.title || !newChapter.content) return alert('חובה למלא כותרת ותוכן');
    const chapter: BookChapter = {
      id: Date.now().toString(),
      title: newChapter.title!,
      content: newChapter.content!,
      tags: newChapter.tags || [],
      rules: newChapter.rules || []
    };
    saveBookChapter(chapter);
    setBrain(getKnowledgeBase());
    setNewChapter({ title: '', content: '', tags: [], rules: [] });
    alert('פרק נוסף למוח בהצלחה!');
  };

  const handleSavePrecedent = () => {
    if (!newPrecedent.caseName || !newPrecedent.keyTakeaway) return alert('חובה למלא שם ותובנה');
    const prec: GlobalPrecedent = {
      id: Date.now().toString(),
      caseName: newPrecedent.caseName!,
      keyTakeaway: newPrecedent.keyTakeaway!,
      citation: newPrecedent.citation || '',
      tags: newPrecedent.tags || [],
      relevantIssues: []
    };
    saveGlobalPrecedent(prec);
    setBrain(getKnowledgeBase());
    setNewPrecedent({ caseName: '', keyTakeaway: '', tags: [] });
    alert('פסק דין נוסף למוח בהצלחה!');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans" dir="rtl">
      <header className="bg-slate-900 text-white p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold serif">LexMedical Admin</h1>
          <div className="text-sm text-slate-400">ממשק ניהול מערכת וניהול ידע</div>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-sm bg-slate-800 px-3 py-1 rounded-full">מחובר: {currentUser}</span>
           <button onClick={onLogout} className="flex items-center gap-2 hover:text-red-400 transition"><LogOut className="w-4 h-4" /> יציאה</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">
        <div className="flex gap-4 mb-8 border-b border-slate-300 pb-1">
           <button onClick={() => setActiveTab('knowledge')} className={\`px-4 py-2 font-bold flex items-center gap-2 border-b-2 transition \${activeTab === 'knowledge' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500'}\`}>
             <Book className="w-4 h-4" /> ניהול המוח (Knowledge Base)
           </button>
           <button onClick={() => setActiveTab('cases')} className={\`px-4 py-2 font-bold flex items-center gap-2 border-b-2 transition \${activeTab === 'cases' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}\`}>
             <Layout className="w-4 h-4" /> ניהול תיקים
           </button>
        </div>
        {activeTab === 'knowledge' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
               <h2 className="text-xl font-bold text-purple-800 mb-4 flex items-center gap-2"><Book className="w-5 h-5" /> הזנת "הספר"</h2>
               <div className="space-y-4">
                 <input className="w-full p-2 border rounded" placeholder="כותרת הפרק..." value={newChapter.title} onChange={e => setNewChapter({...newChapter, title: e.target.value})} />
                 <textarea className="w-full p-2 border rounded h-32" placeholder="תוכן הפרק..." value={newChapter.content} onChange={e => setNewChapter({...newChapter, content: e.target.value})} />
                 <input className="w-full p-2 border rounded text-sm" placeholder="תגיות..." value={newChapter.tags?.join(', ')} onChange={e => setNewChapter({...newChapter, tags: e.target.value.split(',').map(t => t.trim())})} />
                 <button onClick={handleSaveChapter} className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex justify-center items-center gap-2"><Save className="w-4 h-4" /> שמור פרק</button>
               </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
               <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2"><Gavel className="w-5 h-5" /> מאגר פסקי דין</h2>
               <div className="space-y-4">
                 <input className="w-full p-2 border rounded" placeholder="שם פסק הדין..." value={newPrecedent.caseName} onChange={e => setNewPrecedent({...newPrecedent, caseName: e.target.value})} />
                 <textarea className="w-full p-2 border rounded h-24" placeholder="השורה התחתונה..." value={newPrecedent.keyTakeaway} onChange={e => setNewPrecedent({...newPrecedent, keyTakeaway: e.target.value})} />
                 <input className="w-full p-2 border rounded text-sm" placeholder="תגיות..." value={newPrecedent.tags?.join(', ')} onChange={e => setNewPrecedent({...newPrecedent, tags: e.target.value.split(',').map(t => t.trim())})} />
                 <button onClick={handleSavePrecedent} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex justify-center items-center gap-2"><Save className="w-4 h-4" /> שמור פסק דין</button>
               </div>
            </div>
          </div>
        )}
        {activeTab === 'cases' && (
           <div className="bg-white p-10 text-center rounded border shadow-sm">
              <h3 className="text-lg text-slate-600">כאן יוצגו כל התיקים של כל עורכי הדין במשרד לניהול מרוכז.</h3>
              <p className="text-sm text-slate-400 mt-2">כרגע בפיתוח (משתמש באחסון מקומי דפדפן).</p>
           </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;`,

  'src/components/CaseDashboard.tsx': `import React from 'react';
import { CaseData } from '../types';
import { calculateMPL } from '../services/calculations';
import { Activity, Shield, TrendingUp, Clock, FileText, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';

interface Props {
  caseData: CaseData;
  navigateToStep: (step: number) => void;
}

const CaseDashboard: React.FC<Props> = ({ caseData, navigateToStep }) => {
  const mpl = calculateMPL(caseData.damages);
  const liability = caseData.liability.probability;
  const expectedLoss = Math.round(mpl * (liability / 100));

  const getNextAction = () => {
    if (!caseData.summary) return { text: 'הזן סיכום תיק', step: 1 };
    if (caseData.liability.issues.length === 0) return { text: 'הגדר סוגיות חבות', step: 1 };
    if (caseData.damages.wagePreInjury === 0 && mpl === 0) return { text: 'הזן נתוני שכר ונזק', step: 2 };
    return { text: 'הפק דוח מסכם', step: 4 };
  };

  const nextAction = getNextAction();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
         <div>
           <h1 className="text-3xl font-bold serif text-slate-800">לוח בקרה (Dashboard)</h1>
           <p className="text-slate-500 mt-1">סקירה כללית לתיק: {caseData.name}</p>
         </div>
         <div className="text-xs text-slate-400">עודכן לאחרונה: {new Date(caseData.lastUpdated).toLocaleString('he-IL')}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition cursor-pointer" onClick={() => navigateToStep(1)}>
            <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
            <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Shield className="w-6 h-6" /></div>
               <span className={\`text-xs font-bold px-2 py-1 rounded \${liability > 60 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}\`}>
                  {liability > 60 ? 'סיכון גבוה' : 'סיכון סביר'}
               </span>
            </div>
            <div className="text-slate-500 text-sm mb-1">הסתברות לחבות</div>
            <div className="text-3xl font-bold text-slate-800">{liability}%</div>
         </div>
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition cursor-pointer" onClick={() => navigateToStep(2)}>
            <div className="absolute top-0 right-0 w-1 h-full bg-purple-500"></div>
            <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Activity className="w-6 h-6" /></div>
            </div>
            <div className="text-slate-500 text-sm mb-1">הערכת MPL (100%)</div>
            <div className="text-3xl font-bold text-slate-800">{mpl.toLocaleString()} ₪</div>
         </div>
         <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden group hover:bg-slate-900 transition cursor-pointer" onClick={() => navigateToStep(2)}>
            <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-slate-700 rounded-lg text-green-400"><TrendingUp className="w-6 h-6" /></div>
            </div>
            <div className="text-slate-400 text-sm mb-1">תוחלת נזק (פיצוי צפוי)</div>
            <div className="text-3xl font-bold text-white">{expectedLoss.toLocaleString()} ₪</div>
         </div>
      </div>
    </div>
  );
};

export default CaseDashboard;`,

  'src/components/LiabilityStep.tsx': `import React, { useState, useEffect } from 'react';
import { CaseData, Issue, ExpertStance, ExpertOpinion, AttachedFile, LegalPrecedent, ConsistencyWarning, LiabilityAnalysis } from '../types';
import { calculateLiabilityScore } from '../services/calculations';
import { checkConsistency, generateLegalArgument } from '../services/aiReasoning';
import SmartAssistant from './SmartAssistant';
import { Scale, AlertTriangle, Gavel, Sparkles, Wand2, Loader2 } from 'lucide-react';

interface Props {
  caseData: CaseData;
  updateCaseData: (data: CaseData) => void;
}

const LiabilityStep: React.FC<Props> = ({ caseData, updateCaseData }) => {
  const [localAnalysis, setLocalAnalysis] = useState(caseData.liability);
  const [consistencyWarnings, setConsistencyWarnings] = useState(caseData.liability.activeConsistencyWarnings || []);
  const [loadingArg, setLoadingArg] = useState(null); 
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [activeContext, setActiveContext] = useState('');

  useEffect(() => {
     const timer = setTimeout(async () => {
        const warnings = await checkConsistency({ ...caseData, liability: localAnalysis });
        setConsistencyWarnings(warnings);
     }, 1000);
     return () => clearTimeout(timer);
  }, [localAnalysis.probability, localAnalysis.medicalRecordQuality, localAnalysis.issues]);

  useEffect(() => {
    const result = calculateLiabilityScore(
      50, 
      localAnalysis.aggravatingFactors,
      localAnalysis.mitigatingFactors,
      localAnalysis.medicalRecordQuality,
      localAnalysis.expertCourtStance
    );

    setLocalAnalysis((prev) => ({
      ...prev,
      probability: result.probability,
      probabilityRange: result.range,
      uncertainty: result.uncertainty
    }));
  }, [
    localAnalysis.aggravatingFactors,
    localAnalysis.mitigatingFactors,
    localAnalysis.medicalRecordQuality,
    localAnalysis.expertCourtStance
  ]);

  useEffect(() => {
    updateCaseData({ ...caseData, liability: { ...localAnalysis, activeConsistencyWarnings: consistencyWarnings } });
  }, [localAnalysis, consistencyWarnings]);

  const addIssue = () => {
    const newIssue = {
      id: Date.now().toString(),
      description: '',
      plaintiffAllegation: '',
      defenseAllegation: '',
      breachFactors: '',
      causationFactors: ''
    };
    setLocalAnalysis(prev => ({ ...prev, issues: [...prev.issues, newIssue] }));
  };

  const updateIssue = (id, field, value) => {
    setLocalAnalysis(prev => ({
      ...prev,
      issues: prev.issues.map(i => i.id === id ? { ...i, [field]: value } : i)
    }));
    if (field === 'description' || field === 'plaintiffAllegation') setActiveContext(value);
  };

  const generateArgumentForIssue = async (id, side) => {
      const issue = localAnalysis.issues.find(i => i.id === id);
      if (!issue || !issue.description) return alert('יש למלא תיאור סוגיה תחילה');
      setLoadingArg(\`\${id}-\${side}\`);
      const argument = await generateLegalArgument(issue, side, caseData.summary);
      updateIssue(id, side === 'Plaintiff' ? 'plaintiffAllegation' : 'defenseAllegation', argument);
      setLoadingArg(null);
  };

  const handleInputFocus = (text) => setActiveContext(text);
  const handleFactorChange = (type, val) => setLocalAnalysis(prev => ({ ...prev, [type === 'agg' ? 'aggravatingFactors' : 'mitigatingFactors']: val }));
  const handleImportPrecedent = (prec) => setLocalAnalysis(prev => ({ ...prev, precedents: [...(prev.precedents || []), prec] }));
  const handleImportRule = (ruleText) => setLocalAnalysis(prev => ({ ...prev, strengthsDefense: [...prev.strengthsDefense, ruleText] }));

  return (
    <div className="flex relative">
      <SmartAssistant 
        isOpen={assistantOpen} 
        onClose={() => setAssistantOpen(false)}
        contextQuery={activeContext}
        onImportPrecedent={handleImportPrecedent}
        onImportRule={handleImportRule}
      />
      <div className={\`flex-1 space-y-8 pb-12 transition-all \${assistantOpen ? 'ml-80' : ''}\`}>
        {!assistantOpen && (
           <button onClick={() => setAssistantOpen(true)} className="fixed left-0 top-24 bg-slate-900 text-white p-2 rounded-r shadow-lg z-50 hover:bg-purple-700 transition"><Sparkles className="w-5 h-5" /></button>
        )}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 serif flex items-center gap-2"><Scale className="w-5 h-5 text-blue-600 ml-2" /> 1. ניתוח חבות (מונחה בינה)</h2>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">סוגיות במחלוקת</h3>
              <button onClick={addIssue} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded text-slate-700 font-medium transition">+ הוסף סוגיה</button>
            </div>
            {localAnalysis.issues.map((issue, idx) => (
              <div key={issue.id} className="p-4 bg-slate-50 rounded border border-slate-200 space-y-3 group hover:border-blue-300 transition">
                <div className="flex justify-between"><span className="font-bold text-slate-400">סוגיה מס' {idx + 1}</span></div>
                <input className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none" placeholder="תיאור הסוגיה..." value={issue.description} onChange={(e) => updateIssue(issue.id, 'description', e.target.value)} onFocus={() => handleInputFocus(issue.description || 'רשלנות רפואית כללי')} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <div className="flex justify-between mb-1">
                        <label className="text-xs font-medium text-slate-500">טענת התובע</label>
                        <button onClick={() => generateArgumentForIssue(issue.id, 'Plaintiff')} disabled={loadingArg === \`\${issue.id}-Plaintiff\`} className="flex items-center gap-1 text-[10px] text-purple-600 hover:bg-purple-50 px-1 rounded transition disabled:opacity-50">
                            {loadingArg === \`\${issue.id}-Plaintiff\` ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3" />} {loadingArg === \`\${issue.id}-Plaintiff\` ? 'כותב...' : 'כתוב עבורי'}
                        </button>
                    </div>
                    <textarea className="w-full p-2 border rounded text-sm h-24 focus:ring-2 focus:ring-purple-200 outline-none" value={issue.plaintiffAllegation} onChange={(e) => updateIssue(issue.id, 'plaintiffAllegation', e.target.value)} onFocus={() => handleInputFocus(issue.plaintiffAllegation || issue.description)} />
                  </div>
                  <div className="relative">
                    <div className="flex justify-between mb-1">
                        <label className="text-xs font-medium text-slate-500">טענת ההגנה</label>
                        <button onClick={() => generateArgumentForIssue(issue.id, 'Defense')} disabled={loadingArg === \`\${issue.id}-Defense\`} className="flex items-center gap-1 text-[10px] text-blue-600 hover:bg-blue-50 px-1 rounded transition disabled:opacity-50">
                            {loadingArg === \`\${issue.id}-Defense\` ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3" />} {loadingArg === \`\${issue.id}-Defense\` ? 'כותב...' : 'כתוב עבורי'}
                        </button>
                    </div>
                    <textarea className="w-full p-2 border rounded text-sm h-24 focus:ring-2 focus:ring-purple-200 outline-none" value={issue.defenseAllegation} onChange={(e) => updateIssue(issue.id, 'defenseAllegation', e.target.value)} onFocus={() => handleInputFocus(issue.defenseAllegation || issue.description)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mb-8 bg-slate-50 p-4 rounded border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-2">איכות הרשומה הרפואית</h3>
              <div className="flex gap-4">
                  {['Complete', 'Partial', 'Missing', 'Contradictory'].map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="recordQuality" value={status} checked={localAnalysis.medicalRecordQuality === status} onChange={() => setLocalAnalysis({...localAnalysis, medicalRecordQuality: status})} className="accent-blue-600" />
                          <span className="text-sm">{status}</span>
                      </label>
                  ))}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiabilityStep;`,

  'src/components/DamagesStep.tsx': `import React, { useState, useEffect } from 'react';
import { CaseData, LegalPrecedent, AttachedFile } from '../types';
import { calculateHeadValue, calculateMPL, calculateAge, getLifeExpectancy, captureAndCopy, generateDamageAssessmentCSV, formatCurrency } from '../services/calculations';
import { Calculator, TrendingUp, Calendar, HeartPulse, User, Info, Gavel, UploadCloud, FileText, Trash2, Book, Camera, FileSpreadsheet, Sliders, X } from 'lucide-react';

interface Props {
  caseData: CaseData;
  updateCaseData: (data: CaseData) => void;
}

const DamagesStep: React.FC<Props> = ({ caseData, updateCaseData }) => {
  const [damages, setDamages] = useState(caseData.damages);
  const [showSimulator, setShowSimulator] = useState(false);

  useEffect(() => {
    const newAgeAtInjury = calculateAge(damages.dateOfBirth, damages.dateOfEvent);
    const newCurrentAge = calculateAge(damages.dateOfBirth, damages.dateOfCalc);
    const newLifeExpectancy = getLifeExpectancy(damages.gender);
    if (newAgeAtInjury !== damages.ageAtInjury || newCurrentAge !== damages.currentAge || newLifeExpectancy !== damages.lifeExpectancy) {
        setDamages(prev => ({ ...prev, ageAtInjury: newAgeAtInjury, currentAge: newCurrentAge, lifeExpectancy: newLifeExpectancy }));
    }
  }, [damages.dateOfBirth, damages.dateOfEvent, damages.dateOfCalc, damages.gender]);

  useEffect(() => {
    const updatedHeads = damages.heads.map(head => {
      if (!head.isActive) return { ...head, calculatedAmount: 0 };
      return { ...head, calculatedAmount: calculateHeadValue(head, damages) };
    });
    const currentTotals = damages.heads.map(h => h.calculatedAmount).join(',');
    const newTotals = updatedHeads.map(h => h.calculatedAmount).join(',');
    if (currentTotals !== newTotals) { setDamages(prev => ({ ...prev, heads: updatedHeads })); }
  }, [damages.ageAtInjury, damages.currentAge, damages.lifeExpectancy, damages.wagePreInjury, damages.permanentDisabilityFunctional, damages.dateOfEvent, damages.dateOfCalc, damages.daysOfHospitalization, JSON.stringify(damages.heads.map(h => h.parameters)), JSON.stringify(damages.heads.map(h => h.isActive))]);

  useEffect(() => { updateCaseData({ ...caseData, damages }); }, [damages]);

  const updateGlobalParam = (field, value) => setDamages(prev => ({ ...prev, [field]: value }));
  const updateHeadParam = (headId, param, value) => setDamages(prev => ({ ...prev, heads: prev.heads.map(h => h.id === headId ? { ...h, parameters: { ...h.parameters, [param]: value } } : h) }));
  const toggleHead = (headId) => setDamages(prev => ({ ...prev, heads: prev.heads.map(h => h.id === headId ? { ...h, isActive: !h.isActive } : h) }));
  const addPrecedent = () => setDamages(prev => ({ ...prev, precedents: [...(prev.precedents || []), { id: Date.now().toString(), caseName: '', keyTakeaway: '' }] }));
  const updatePrecedent = (id, field, value) => setDamages(prev => ({ ...prev, precedents: prev.precedents.map(p => p.id === id ? { ...p, [field]: value } : p) }));
  const removePrecedent = (id) => setDamages(prev => ({ ...prev, precedents: prev.precedents.filter(p => p.id !== id) }));
  const mpl = calculateMPL(damages);
  const expectedLoss = Math.round(mpl * (caseData.liability.probability / 100));

  return (
    <div className="space-y-8 pb-12 relative">
      {showSimulator && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-end no-print">
           <div className="w-96 bg-white h-full shadow-2xl flex flex-col animate-slideInRight">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Sliders className="w-4 h-4" /> סימולטור (What-If)</h3><button onClick={() => setShowSimulator(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button></div>
           </div>
        </div>
      )}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 relative">
        <button onClick={() => setShowSimulator(true)} className="absolute top-6 left-6 flex items-center gap-2 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded shadow-sm transition"><Sliders className="w-3 h-3" /> פתח סימולטור</button>
        <h2 className="text-xl font-bold text-slate-800 serif flex items-center gap-2 mb-4"><Calculator className="w-5 h-5 text-blue-600 ml-2" /> 2. נתונים אקטואריים ורפואיים</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
          <div className="bg-slate-50 p-3 rounded border border-slate-200"><label className="text-xs font-bold text-slate-600 block mb-2 flex items-center gap-1"><User className="w-3 h-3 ml-1" /> תאריך לידה</label><input type="date" className="w-full p-2 border rounded text-sm" value={damages.dateOfBirth} onChange={e => updateGlobalParam('dateOfBirth', e.target.value)} /></div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200"><label className="text-xs font-bold text-slate-600 block mb-2">מגדר</label><select className="w-full p-2 border rounded text-sm" value={damages.gender} onChange={e => updateGlobalParam('gender', e.target.value)}><option value="Male">זכר</option><option value="Female">נקבה</option></select></div>
          <div className="bg-blue-50 p-3 rounded border border-blue-100"><label className="text-xs font-bold text-blue-800 block mb-2 flex items-center gap-1"><Calendar className="w-3 h-3 ml-1" /> תאריך האירוע</label><input type="date" className="w-full p-2 border rounded text-sm" value={damages.dateOfEvent} onChange={e => updateGlobalParam('dateOfEvent', e.target.value)} /></div>
          <div className="p-3"><label className="text-xs font-bold text-slate-600 block mb-2">תאריך חישוב</label><input type="date" className="w-full p-2 border rounded text-sm bg-slate-100 text-slate-500 cursor-not-allowed" value={damages.dateOfCalc} readOnly /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          <div><label className="text-xs font-semibold text-slate-500 block mb-1">שכר בסיס (ברוטו)</label><input type="number" className="w-full p-2 border rounded" value={damages.wagePreInjury} onChange={e => updateGlobalParam('wagePreInjury', Number(e.target.value))} /></div>
          <div><label className="text-xs font-semibold text-slate-500 block mb-1">נכות תפקודית (%)</label><input type="number" className="w-full p-2 border rounded" value={damages.permanentDisabilityFunctional} onChange={e => updateGlobalParam('permanentDisabilityFunctional', Number(e.target.value))} /></div>
          <div><label className="text-xs font-semibold text-slate-500 block mb-1">נכות רפואית (%)</label><input type="number" className="w-full p-2 border rounded" value={damages.permanentDisabilityMedical} onChange={e => updateGlobalParam('permanentDisabilityMedical', Number(e.target.value))} /></div>
          <div><label className="text-xs font-semibold text-slate-500 block mb-1 flex items-center gap-1"><HeartPulse className="w-3 h-3 ml-1" /> ימי אשפוז</label><input type="number" className="w-full p-2 border rounded" value={damages.daysOfHospitalization} onChange={e => updateGlobalParam('daysOfHospitalization', Number(e.target.value))} /></div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200"><h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">ראשי נזק</h3><div className="space-y-4">{damages.heads.map(head => (<div key={head.id} className={\`border rounded transition-colors \${head.isActive ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-100 opacity-75'}\`}><div className="flex items-center justify-between p-3 bg-slate-50/50 border-b border-slate-100"><div className="flex items-center gap-3"><input type="checkbox" checked={head.isActive} onChange={() => toggleHead(head.id)} className="w-4 h-4 accent-blue-600" /><span className={\`font-medium \${head.isActive ? 'text-slate-800' : 'text-slate-400'}\`}>{head.name}</span></div><span className="font-mono font-bold text-slate-700">{head.isActive ? head.calculatedAmount.toLocaleString() : '-'} ₪</span></div></div>))}</div></div>
      <div className="relative group"><div id="damages-visual-dashboard" className="bg-slate-900 text-white p-8 rounded-lg shadow-lg mb-12"><h2 className="text-xl font-bold serif mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-400 ml-2" /> 3. חישוב תוחלת נזק</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-700"><div className="py-4 md:py-0"><div className="text-slate-400 text-sm uppercase tracking-widest mb-2">MPL (100%)</div><div className="text-3xl font-light">{mpl.toLocaleString()} <span className="text-sm text-slate-500">₪</span></div></div><div className="py-4 md:py-0"><div className="text-slate-400 text-sm uppercase tracking-widest mb-2">סיכוי לתביעה</div><div className="text-3xl font-light text-blue-400">{caseData.liability.probability}%</div></div><div className="py-4 md:py-0"><div className="text-slate-400 text-sm uppercase tracking-widest mb-2">תוחלת נזק (פיצוי צפוי)</div><div className="text-4xl font-bold text-green-400">{expectedLoss.toLocaleString()} <span className="text-sm text-green-700">₪</span></div></div></div></div></div>
    </div>
  );
};

export default DamagesStep;`,

  'src/components/ReasoningStep.tsx': `import React, { useState } from 'react';
import { CaseData, DamagesHead } from '../types';
import { getCapitalizationCoeff, getMonthsDiff, formatCurrency } from '../services/calculations';
import { Scale, BookOpen, Calculator, Copy, Gavel, Quote, ArrowLeft, Edit3 } from 'lucide-react';

interface Props {
  caseData: CaseData;
}

const ReasoningStep: React.FC<Props> = ({ caseData }) => {
  const [activeHead, setActiveHead] = useState<string | null>('liability'); 

  const getLiabilityContent = () => {
    const { liability } = caseData;
    const missingRecords = liability.medicalRecordQuality === 'Missing' || liability.medicalRecordQuality === 'Contradictory';
    return \`ניתוח סוגיית החבות - מתודולוגיה:\\nהערכת סיכויי התביעה בתיק זה (\${liability.probability}%) מבוססת על שקלול הפרמטרים המשפטיים והרפואיים הבאים.\\n\\n1. נטל הראיה:\\n\${missingRecords ? 'בתיק זה אותרו חוסרים משמעותיים ברשומה הרפואית. בהתאם לדוקטרינת הנזק הראייתי, חוסר זה עשוי להוביל להיפוך נטל הראיה.' : 'הרשומה הרפואית נראית תקינה, ונטל הראיה נותר על התובע.'}\\n\\n2. חוות דעת מומחים:\\n\${liability.expertCourtOpinions.length > 0 ? \`מונה מומחה מטעם בית המשפט. עמדתו שוקללה כ-\${liability.expertCourtStance}.\` : 'טרם מונה מומחה מטעם בית המשפט.'}\`;
  };

  const getDamagesContent = (head: DamagesHead) => {
    return \`חישוב \${head.name} מבוסס על הנתונים שהוזנו בתיק והכללים המקובלים בתחשיבי נזק.\\nסכום מחושב: \${formatCurrency(head.calculatedAmount)}.\\n\${head.parameters.isGlobalSum ? 'החישוב בוצע על דרך האומדנה (סכום גלובלי).' : 'החישוב אקטוארי/מלא.'}\`;
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 overflow-hidden">
      <div className="w-full md:w-1/3 flex flex-col gap-4 overflow-y-auto pb-20">
         <div className="bg-blue-900 text-white p-4 rounded-lg shadow-md"><h2 className="font-bold serif text-lg flex items-center gap-2"><BookOpen className="w-5 h-5" /> מוקד ההנמקה</h2></div>
         <div className="space-y-2">
            <button onClick={() => setActiveHead('liability')} className={\`w-full text-right p-3 rounded border transition flex items-center justify-between \${activeHead === 'liability' ? 'bg-white border-purple-500 shadow-sm border-r-4' : 'bg-slate-50 border-slate-200 hover:bg-white'}\`}><span className="font-bold text-sm text-slate-700">ניתוח חבות וסיכון</span></button>
            {caseData.damages.heads.filter(h => h.isActive).map(head => (
               <button key={head.id} onClick={() => setActiveHead(head.id)} className={\`w-full text-right p-3 rounded border transition flex items-center justify-between \${activeHead === head.id ? 'bg-white border-blue-500 shadow-sm border-r-4' : 'bg-slate-50 border-slate-200 hover:bg-white'}\`}><span className="text-sm text-slate-700">{head.name}</span></button>
            ))}
         </div>
      </div>
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-700">{activeHead === 'liability' ? 'טיוטת טיעון לחבות' : caseData.damages.heads.find(h => h.id === activeHead)?.name || 'טיעון'}</h3><button onClick={() => { const text = activeHead === 'liability' ? getLiabilityContent() : getDamagesContent(caseData.damages.heads.find(h => h.id === activeHead)!); navigator.clipboard.writeText(text); alert('הועתק!'); }} className="text-xs flex items-center gap-1 bg-white border px-2 py-1 rounded hover:bg-slate-50"><Copy className="w-3 h-3" /> העתק טקסט</button></div>
          <div className="flex-1 p-6 overflow-y-auto font-serif text-lg leading-loose text-slate-800 whitespace-pre-wrap">{activeHead === 'liability' ? getLiabilityContent() : activeHead ? getDamagesContent(caseData.damages.heads.find(h => h.id === activeHead)!) : 'בחר סעיף משמאל לצפייה בנימוקים'}</div>
      </div>
    </div>
  );
};

export default ReasoningStep;`,

  'src/components/ReportStep.tsx': `import React from 'react';
import { CaseData, UserRole, ExpertOpinion, LegalPrecedent } from '../types';
import { calculateMPL } from '../services/calculations';
import { FileText, Copy, Sparkles, Printer, Scale } from 'lucide-react';

interface Props {
  caseData: CaseData;
  userRole: UserRole;
}

const ReportStep: React.FC<Props> = ({ caseData, userRole }) => {
  const mpl = calculateMPL(caseData.damages);
  const expectedLoss = Math.round(mpl * (caseData.liability.probability / 100));
  
  const handleCopyReport = () => {
    const content = document.getElementById('legal-report');
    if (content) {
      navigator.clipboard.writeText(content.innerText).then(() => alert('הדוח הועתק ללוח בהצלחה!'));
    }
  };

  const handlePrint = () => { window.print(); };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-6 no-print">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 ml-2" /> הפקת דוח מסכם</h2>
        <div className="flex gap-3"><button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition shadow-sm text-sm"><Printer className="w-4 h-4" /> הדפס ל-PDF</button></div>
      </div>
      <div id="legal-report" className="bg-white p-12 shadow-lg border border-slate-200 text-slate-900 font-serif leading-relaxed print:shadow-none print:border-none print:p-0 print:w-full" dir="rtl">
        <div className="flex items-center justify-between border-b-4 border-slate-900 pb-6 mb-8 break-inside-avoid">
           <div className="flex items-center gap-3"><div className="p-2 bg-slate-900 text-white rounded"><Scale className="w-8 h-8" /></div><div><h1 className="text-2xl font-bold uppercase tracking-wider">LexMedical</h1><div className="text-xs tracking-widest uppercase text-slate-500">Legal Analytics & Defense</div></div></div>
           <div className="text-left text-xs text-slate-500 font-sans"><div>תאריך הפקה: {new Date().toLocaleDateString('he-IL')}</div><div>עורך דין: {userRole.split('(')[0]}</div><div>אסמכתא: {caseData.id.substring(0,8)}</div></div>
        </div>
        <div className="text-center mb-8 break-inside-avoid"><h2 className="text-xl font-bold underline decoration-slate-300 underline-offset-4 mb-2">הערכת חבות ונזק בתיק רשלנות רפואית</h2><h3 className="text-lg font-semibold text-slate-700">תיק: {caseData.name || '[ללא שם]'}</h3></div>
        <section className="mb-8 break-inside-avoid"><h3 className="text-base font-bold uppercase border-b border-slate-300 mb-3 text-slate-700">1. רקע עובדתי ורפואי</h3><p className="mb-4 text-justify whitespace-pre-wrap text-sm font-sans bg-slate-50 p-4 border-l-4 border-slate-300">{caseData.summary || 'לא הוזן סיכום.'}</p></section>
        <section className="mb-8 break-inside-avoid"><h3 className="text-base font-bold uppercase border-b border-slate-300 mb-3 text-slate-700">2. ניתוח שאלת החבות</h3><div className="p-4 border-2 border-slate-200 bg-slate-50 rounded mb-4 flex justify-between items-center"><div><div className="font-bold font-sans text-slate-600 text-xs uppercase tracking-wide">הסתברות לחבות</div><div className="font-bold text-2xl">{caseData.liability.probability}%</div></div></div></section>
        <section className="mb-8 break-inside-avoid"><h3 className="text-base font-bold uppercase border-b border-slate-300 mb-3 text-slate-700">3. תחשיב נזק (MPL)</h3><table className="w-full text-sm font-sans border-collapse"><thead><tr className="bg-slate-100 text-right"><th className="p-2 border-b border-slate-300 font-bold text-xs uppercase text-slate-600 w-2/3">ראש נזק</th><th className="p-2 border-b border-slate-300 text-left pl-4 font-bold text-xs uppercase text-slate-600">סכום (₪)</th></tr></thead><tbody>{caseData.damages.heads.filter(h => h.isActive).map(head => (<tr key={head.id} className="border-b border-slate-100"><td className="p-2">{head.name}</td><td className="p-2 text-left pl-4 font-mono">{head.calculatedAmount.toLocaleString()}</td></tr>))}<tr className="font-bold bg-slate-50 border-t-2 border-slate-300"><td className="p-2">סה"כ נזק מלא (MPL 100%)</td><td className="p-2 text-left pl-4 text-base">{mpl.toLocaleString()}</td></tr></tbody></table></section>
        <section className="break-inside-avoid bg-slate-900 text-white p-6 rounded"><div className="flex justify-between items-center"><div><h3 className="text-lg font-bold uppercase mb-1">תוחלת נזק (לסילוק)</h3><div className="text-xs text-slate-400">שקלול: {mpl.toLocaleString()} ₪ × {caseData.liability.probability}%</div></div><div className="text-3xl font-bold">{expectedLoss.toLocaleString()} ₪</div></div></section>
      </div>
    </div>
  );
};

export default ReportStep;`,

  'src/components/SmartAssistant.tsx': `import React, { useEffect, useState } from 'react';
import { findRelevantKnowledge } from '../services/knowledgeBase';
import { BookChapter, GlobalPrecedent, LegalPrecedent } from '../types';
import { Sparkles, Book, Gavel, PlusCircle, X, Lightbulb, ArrowRight } from 'lucide-react';

interface Props {
  contextQuery: string;
  onImportPrecedent: (p: LegalPrecedent) => void;
  onImportRule: (rule: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const SmartAssistant: React.FC<Props> = ({ contextQuery, onImportPrecedent, onImportRule, isOpen, onClose }) => {
  const [suggestions, setSuggestions] = useState<{ chapters: BookChapter[], precedents: GlobalPrecedent[] }>({ chapters: [], precedents: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && contextQuery.length > 2) {
      setLoading(true);
      const timer = setTimeout(() => {
        const results = findRelevantKnowledge(contextQuery);
        setSuggestions(results);
        setLoading(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [contextQuery, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-16 bottom-0 w-80 bg-slate-900 text-white shadow-2xl border-r border-purple-500/30 flex flex-col z-40 animate-slideInLeft no-print">
      <div className="p-4 border-b border-slate-700 bg-slate-900 relative overflow-hidden">
        <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3"><div className="p-2 bg-slate-800 rounded-full border border-purple-500"><Sparkles className="w-5 h-5 text-purple-400" /></div><div><h3 className="font-bold font-serif text-base">Lex Super-Brain</h3></div></div>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-900">
        {loading ? <div className="text-center text-xs text-slate-500">חושב...</div> : (
          <>
            {suggestions.chapters.length === 0 && suggestions.precedents.length === 0 && <div className="text-center text-slate-500 text-sm">לא נמצאו התאמות.</div>}
            {suggestions.chapters.length > 0 && <div className="space-y-3"><h4 className="text-xs font-bold uppercase text-purple-400">חוקים מהספר</h4>{suggestions.chapters.map(chapter => (<div key={chapter.id} className="bg-slate-800 border border-slate-700 rounded p-3"><div className="text-sm font-bold text-purple-200">{chapter.title}</div><p className="text-xs text-slate-400">{chapter.content}</p></div>))}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default SmartAssistant;`,

  'src/App.tsx': `import React, { useState, useEffect, useRef } from 'react';
import { UserRole, CaseData, AttachedFile, AzureConfig, LiabilityAnalysis } from './types';
import { authenticateUser, isAdmin } from './services/auth';
import { saveAzureConfig, getAzureConfig } from './services/azureService';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import LiabilityStep from './components/LiabilityStep';
import DamagesStep from './components/DamagesStep';
import ReasoningStep from './components/ReasoningStep';
import ReportStep from './components/ReportStep';
import CaseDashboard from './components/CaseDashboard';
import { Users, FolderOpen, ChevronLeft, Shield, Activity, CheckCircle, Save, UploadCloud, FileText, LogOut, LayoutDashboard, BookOpen, Download, Upload, Home, Settings, Cloud } from 'lucide-react';

const createEmptyCase = (attorney: UserRole): CaseData => ({
  id: Date.now().toString(),
  name: 'תיק חדש ' + new Date().toLocaleDateString('he-IL'),
  attorney: attorney,
  lastUpdated: new Date().toISOString(),
  summary: '',
  summaryFiles: [],
  liability: {
    issues: [],
    medicalRecordQuality: 'Complete',
    doctrines: [],
    precedents: [],
    expertsPlaintiff: [],
    expertsDefense: [],
    expertCourtOpinions: [], 
    expertCourtStance: 'None', 
    aggravatingFactors: 2,
    mitigatingFactors: 2,
    probability: 50,
    probabilityRange: [40, 60],
    uncertainty: 'Medium',
    strengthsPlaintiff: [''],
    weaknessesPlaintiff: [''],
    strengthsDefense: [''],
    weaknessesDefense: ['']
  },
  damages: {
    dateOfBirth: '1990-01-01', 
    gender: 'Male',
    dateOfEvent: new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().split('T')[0], 
    dateOfCalc: new Date().toISOString().split('T')[0],
    dateOfRetirement: '',
    ageAtInjury: 0, 
    currentAge: 0, 
    lifeExpectancy: 82, 
    wagePreInjury: 10000,
    wagePostInjury: 0,
    permanentDisabilityMedical: 10,
    permanentDisabilityFunctional: 10,
    daysOfHospitalization: 0,
    interestRate: 3,
    heads: [
      { id: '1', name: 'הפסד שכר לעבר', isActive: true, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '2', name: 'הפסד שכר לעתיד', isActive: true, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '3', name: 'הפסד פנסיה ותנאים סוציאליים', isActive: true, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '4', name: 'כאב וסבל', isActive: true, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '5', name: 'עזרת צד ג׳ לעבר', isActive: false, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '6', name: 'עזרת צד ג׳ לעתיד', isActive: false, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '7', name: 'הוצאות רפואיות', isActive: false, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '8', name: 'ניידות ונסיעות', isActive: false, parameters: {}, calculatedAmount: 0, notes: '' },
    ],
    precedents: []
  }
});

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserRole | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0); 
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [azureConfig, setAzureConfig] = useState<AzureConfig>({ apiKey: '', endpoint: '', deploymentName: 'gpt-4o' });
  const [currentCase, setCurrentCase] = useState<CaseData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (role: UserRole) => {
    setCurrentUser(role);
    const savedCase = localStorage.getItem(\`lexmedical_case_\${role}\`);
    if (savedCase) {
      const parsed = JSON.parse(savedCase);
      if (!parsed.liability.precedents) parsed.liability.precedents = [];
      if (!parsed.damages.precedents) parsed.damages.precedents = [];
      setCurrentCase(parsed);
    } else {
      setCurrentCase(createEmptyCase(role));
    }
    const savedAzure = getAzureConfig();
    if (savedAzure) setAzureConfig(savedAzure);
    if (isAdmin(role)) setShowAdminDashboard(true);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentCase(null);
    setShowAdminDashboard(false);
    setActiveStep(0);
  };

  const handleAdminEditCase = (caseData: CaseData) => {
    setCurrentCase(caseData);
    setShowAdminDashboard(false);
    setActiveStep(0);
  };

  useEffect(() => {
    if (currentUser && currentCase && !showAdminDashboard) {
      const storageKey = \`lexmedical_case_\${currentCase.attorney}\`;
      localStorage.setItem(storageKey, JSON.stringify(currentCase));
      setCurrentCase((prev: CaseData | null) => prev ? { ...prev, lastUpdated: new Date().toISOString() } : null);
    }
  }, [currentCase?.liability, currentCase?.damages, currentCase?.summary]);

  const handleSummaryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentCase) {
      const file = e.target.files[0];
      const newFile: AttachedFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };
      setCurrentCase({
        ...currentCase,
        summaryFiles: [...(currentCase.summaryFiles || []), newFile]
      });
    }
  };

  const removeSummaryFile = (fileName: string) => {
    if (currentCase) {
      setCurrentCase({
        ...currentCase,
        summaryFiles: currentCase.summaryFiles.filter((f: AttachedFile) => f.name !== fileName)
      });
    }
  };

  const handleSaveSettings = () => {
    saveAzureConfig(azureConfig);
    setShowSettings(false);
    alert('הגדרות Azure נשמרו בהצלחה! המערכת כעת תשתמש במנוע ה-AI.');
  };

  const handleExportCase = () => {
    if (!currentCase) return;
    const dataStr = JSON.stringify(currentCase, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = \`lexmedical_\${currentCase.name.replace(/\\s+/g, '_')}.json\`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => { fileInputRef.current?.click(); };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.id && json.liability && json.damages) {
           setCurrentCase(json);
           alert('התיק נטען בהצלחה!');
           setActiveStep(0);
        } else { alert('קובץ לא תקין.'); }
      } catch (err) { alert('שגיאה בטעינת הקובץ'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;
  if (showAdminDashboard) return <AdminDashboard currentUser={currentUser} onEditCase={handleAdminEditCase} onLogout={handleLogout} />;
  if (!currentCase) return <div>Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 text-slate-900 font-sans print:bg-white" dir="rtl">
      {showSettings && (
         <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center">
           <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
             <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Cloud className="w-6 h-6 text-blue-600" /> הגדרות Azure AI</h2>
             <div className="space-y-4">
               <div><label className="block text-sm font-bold text-slate-700 mb-1">API Endpoint</label><input className="w-full p-2 border rounded ltr" dir="ltr" placeholder="https://resource.openai.azure.com" value={azureConfig.endpoint} onChange={e => setAzureConfig({...azureConfig, endpoint: e.target.value})} /></div>
               <div><label className="block text-sm font-bold text-slate-700 mb-1">API Key</label><input type="password" className="w-full p-2 border rounded ltr" dir="ltr" placeholder="Ex: 12345678..." value={azureConfig.apiKey} onChange={e => setAzureConfig({...azureConfig, apiKey: e.target.value})} /></div>
               <div><label className="block text-sm font-bold text-slate-700 mb-1">Deployment Name (GPT Model)</label><input className="w-full p-2 border rounded ltr" dir="ltr" value={azureConfig.deploymentName} onChange={e => setAzureConfig({...azureConfig, deploymentName: e.target.value})} /></div>
               <div className="flex justify-end gap-3 mt-6"><button onClick={() => setShowSettings(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">ביטול</button><button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">שמור חיבור</button></div>
             </div>
           </div>
         </div>
      )}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 no-print">
        <div className="p-6 border-b border-slate-800"><h1 className="text-xl font-bold text-white serif tracking-wide">LexMedical</h1><div className="flex items-center gap-2 mt-2 text-xs text-slate-400"><div className="w-2 h-2 rounded-full bg-green-500"></div>מחובר: {currentUser.split('(')[0]}</div></div>
        <div className="p-6 flex-1 overflow-y-auto">
          <nav className="space-y-2">
             <button onClick={() => setActiveStep(0)} className={\`w-full flex items-center justify-between p-3 rounded text-sm transition \${activeStep === 0 ? 'bg-blue-900/50 text-white border-r-2 border-blue-500' : 'hover:bg-slate-800'}\`}><div className="flex items-center gap-3"><Home className="w-4 h-4" /> לוח בקרה</div></button>
             <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-6 mb-2 flex items-center gap-2"><FolderOpen className="w-3 h-3" /> תהליך עבודה</div>
             <button onClick={() => setActiveStep(1)} className={\`w-full flex items-center justify-between p-3 rounded text-sm transition \${activeStep === 1 ? 'bg-blue-900/50 text-white border-r-2 border-blue-500' : 'hover:bg-slate-800'}\`}><div className="flex items-center gap-3"><Shield className="w-4 h-4" /> ניתוח חבות</div>{activeStep > 1 && <CheckCircle className="w-3 h-3 text-green-500" />}</button>
             <button onClick={() => setActiveStep(2)} className={\`w-full flex items-center justify-between p-3 rounded text-sm transition \${activeStep === 2 ? 'bg-blue-900/50 text-white border-r-2 border-blue-500' : 'hover:bg-slate-800'}\`}><div className="flex items-center gap-3"><Activity className="w-4 h-4" /> נזק ותחשיב</div>{activeStep > 2 && <CheckCircle className="w-3 h-3 text-green-500" />}</button>
             <button onClick={() => setActiveStep(3)} className={\`w-full flex items-center justify-between p-3 rounded text-sm transition \${activeStep === 3 ? 'bg-blue-900/50 text-white border-r-2 border-blue-500' : 'hover:bg-slate-800'}\`}><div className="flex items-center gap-3"><BookOpen className="w-4 h-4" /> נימוקים והסברים</div>{activeStep > 3 && <CheckCircle className="w-3 h-3 text-green-500" />}</button>
             <button onClick={() => setActiveStep(4)} className={\`w-full flex items-center justify-between p-3 rounded text-sm transition \${activeStep === 4 ? 'bg-blue-900/50 text-white border-r-2 border-blue-500' : 'hover:bg-slate-800'}\`}><div className="flex items-center gap-3"><FileText className="w-4 h-4" /> דוח מסכם</div></button>
          </nav>
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ניהול נתונים</div>
            <button onClick={handleExportCase} className="w-full flex items-center gap-3 p-2 text-sm hover:bg-slate-800 rounded text-slate-400 hover:text-white"><Download className="w-4 h-4" /> שמור תיק לקובץ</button>
            <button onClick={handleImportClick} className="w-full flex items-center gap-3 p-2 text-sm hover:bg-slate-800 rounded text-slate-400 hover:text-white"><Upload className="w-4 h-4" /> טען תיק מקובץ</button>
            <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".json" />
          </div>
        </div>
        <div className="p-6 border-t border-slate-800 space-y-3">
          <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"><Settings className="w-4 h-4" /> הגדרות חיבור Azure</button>
          {isAdmin(currentUser) && <button onClick={() => setShowAdminDashboard(true)} className="w-full flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"><LayoutDashboard className="w-4 h-4" /> חזרה לדשבורד</button>}
          <button onClick={handleLogout} className="w-full flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition"><LogOut className="w-4 h-4" /> התנתק</button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 no-print">
           <div className="flex items-center gap-2 text-sm text-slate-500">
             <span className="font-semibold text-slate-800">שם התיק:</span>
             <input className="border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 transition w-64" value={currentCase.name} onChange={(e) => setCurrentCase({...currentCase, name: e.target.value})} />
             {currentCase.attorney !== currentUser && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">צפייה בתיק של {currentCase.attorney}</span>}
           </div>
           <div className="flex items-center gap-4">
             <button onClick={() => setActiveStep(prev => Math.max(0, prev - 1))} disabled={activeStep === 0} className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-30">חזור</button>
             <button onClick={() => setActiveStep(prev => Math.min(4, prev + 1))} disabled={activeStep === 4} className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50">{activeStep === 0 ? 'התחל עבודה' : 'לשלב הבא'} <ChevronLeft className="w-4 h-4" /></button>
           </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
          <div className="max-w-5xl mx-auto print:max-w-none pb-20">
            {activeStep === 0 && <div className="animate-fadeIn"><CaseDashboard caseData={currentCase} navigateToStep={setActiveStep} /></div>}
            {activeStep === 1 && <div className="animate-fadeIn space-y-8"><div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200"><div className="flex justify-between items-center mb-2"><label className="block text-sm font-bold text-slate-700">רקע עובדתי / סיכום תיק</label><div className="relative"><input type="file" id="summary-upload" className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleSummaryFileUpload} /><label htmlFor="summary-upload" className="cursor-pointer flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-100 transition"><UploadCloud className="w-3 h-3" /> צרף קובץ</label></div></div><textarea className="w-full p-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition h-32" placeholder="הזן כאן את העובדות..." value={currentCase.summary} onChange={(e) => setCurrentCase({...currentCase, summary: e.target.value})} />{currentCase.summaryFiles && currentCase.summaryFiles.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{currentCase.summaryFiles.map((file: AttachedFile, idx: number) => (<div key={idx} className="flex items-center gap-2 bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full border border-slate-200"><FileText className="w-3 h-3" /><span className="truncate max-w-[150px]">{file.name}</span><button onClick={() => removeSummaryFile(file.name)} className="text-slate-400 hover:text-red-500 ml-1">×</button></div>))}</div>}</div><LiabilityStep caseData={currentCase} updateCaseData={setCurrentCase} /></div>}
            {activeStep === 2 && <div className="animate-fadeIn"><DamagesStep caseData={currentCase} updateCaseData={setCurrentCase} /></div>}
            {activeStep === 3 && <div className="animate-fadeIn"><ReasoningStep caseData={currentCase} /></div>}
            {activeStep === 4 && <div className="animate-fadeIn"><ReportStep caseData={currentCase} userRole={currentUser} /></div>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;`
};

// Function to write files recursively
function writeFile(filePath, content) {
  const absolutePath = path.join(__dirname, filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(\`Created directory: \${dir}\`);
  }

  fs.writeFileSync(absolutePath, content);
  console.log(\`Created file: \${filePath}\`);
}

// Execute
console.log("Writing files...");
Object.entries(files).forEach(([filePath, content]) => {
  writeFile(filePath, content);
});

console.log("-----------------------------------");
console.log("Installation Complete!");
console.log("Now run: npm start");
console.log("-----------------------------------");
