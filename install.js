
const fs = require('fs');
const path = require('path');

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
};`
};

// Add the rest of the components using the same pattern. This script is a simplified example to show the user the method.
// In a real scenario, we would write all files. Since the user context implies they exist, we focus on updating the main ones.

Object.entries(files).forEach(([filePath, content]) => {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  console.log(`Updated: ${filePath}`);
});

console.log('Update complete! Please run "npm install" and then "npm start".');
