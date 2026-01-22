export type UserRole = 'admin' | 'attorney';

export type DocumentSourceKey = 'email' | 'manual';

export interface CategoryRecord {
  id: string;
  name: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  summary: string;
  content?: string | null;
  categoryId: string;
  category?: CategoryRecord;
  keywords: string[];
  topics: string[];
  source: 'EMAIL' | 'MANUAL';
  emailFrom?: string | null;
  emailSubject?: string | null;
  emailDate?: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttachedFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export type ExpertStance = 'None' | 'Plaintiff' | 'Defense';
export type MedicalRecordQuality = 'Complete' | 'Partial' | 'Poor';
export type UncertaintyLevel = 'Low' | 'Medium' | 'High';
export type Gender = 'Male' | 'Female' | 'Other';

export interface Issue {
  id: string;
  title: string;
  description: string;
  strength: number;
  stance: ExpertStance;
  priority: 'High' | 'Medium' | 'Low';
}

export interface LiabilityAnalysis {
  issues: Issue[];
  medicalRecordQuality: MedicalRecordQuality;
  doctrines: string[];
  precedents: string[];
  expertsPlaintiff: string[];
  expertsDefense: string[];
  expertCourtOpinions: string[];
  expertCourtStance: ExpertStance;
  aggravatingFactors: number;
  mitigatingFactors: number;
  probability: number;
  probabilityRange: [number, number];
  uncertainty: UncertaintyLevel;
  strengthsPlaintiff: string[];
  weaknessesPlaintiff: string[];
  strengthsDefense: string[];
  weaknessesDefense: string[];
}

export interface DamagesHead {
  id: string;
  name: string;
  isActive: boolean;
  parameters: Record<string, number | string | boolean>;
  calculatedAmount: number;
  notes: string;
}

export interface DamagesData {
  dateOfBirth: string;
  gender: Gender;
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
  precedents: GlobalPrecedent[];
}

export interface CaseData {
  id: string;
  name: string;
  attorney: string;
  lastUpdated: string;
  summary: string;
  summaryFiles: AttachedFile[];
  liability: LiabilityAnalysis;
  damages: DamagesData;
}

export type CaseStatusType = 'ACTIVE' | 'ARCHIVED' | 'PENDING_DELETE';

export interface CaseSummaryRecord {
  id: string;
  title: string;
  topicSummary: string;
  status: CaseStatusType;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  retentionExpiresAt?: string;
  daysRemaining?: number;
  ownerUserId?: string;
  isOwner?: boolean;
}

export interface CaseRecord extends CaseSummaryRecord {
  data: CaseData;
  retentionWarningSent?: boolean;
  retentionFinalWarningSent?: boolean;
}

export interface NotificationRecord {
  id: string;
  type: string;
  message: string;
  caseId?: string;
  metadata?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface BookChapter {
  id: string;
  title: string;
  content: string;
  tags: string[];
  rules: string[];
}

export interface GlobalPrecedent {
  id: string;
  caseName: string;
  keyTakeaway: string;
  citation: string;
  tags: string[];
  relevantIssues: Issue[];
}

export interface KnowledgeBase {
  book: BookChapter[];
  precedents: GlobalPrecedent[];
  lastUpdated: string;
}

export interface IngestedDocument {
  id: string;
  title: string;
  summary: string;
  content?: string;
  tags: string[];
  rules: string[];
  docType: 'chapter' | 'precedent';
  sourceFile?: string;
  sourceUrl?: string | null;
  insights?: AIInsight[];
  createdAt?: string;
}

export interface AIInsight {
  title: string;
  content: string;
  confidence: UncertaintyLevel;
}

export interface AIReasoningResponse {
  summary: string;
  insights: AIInsight[];
  usedAzure: boolean;
  timestamp: string;
}

export type KnowledgeFlagSeverity = 'info' | 'warning' | 'critical';

export type AssertionType = 'FACT' | 'INTERPRETATION' | 'POSSIBILITY';

export interface ReliabilityNote {
  level: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface ScoreComponent {
  value?: number;
  reasons?: string[];
}

export interface KnowledgeScore {
  value: number;
  breakdown?: {
    ocr?: number | ScoreComponent;
    coverage?: number;
    consistency?: number;
    density?: number;
  };
}

export interface KnowledgeClaimSource {
  page?: number;
  lineRange?: [number, number];
  snippet?: string;
}

export interface KnowledgeClaim {
  id: string;
  type: string;
  value: string;
  unit?: string;
  date?: string;
  confidence?: number;
  source?: KnowledgeClaimSource;
  evidenceQuality?: 'high' | 'medium' | 'low';
  evidenceNotes?: string;
  assertionType?: AssertionType;
  basis?: string[];
  missingEvidence?: string[];
  reliability?: ReliabilityNote;
  caution?: string;
}

export interface KnowledgeFlag {
  code: string;
  message: string;
  severity: KnowledgeFlagSeverity;
}

export interface LiteratureSummary {
  summary: string;
  keyFindings: string[];
  limitations: string[];
  bottomLine: string;
}

export interface LiteratureResource {
  id: string;
  knowledgeId: string;
  title: string;
  authors: Array<{ name: string }>;
  journal?: string;
  year?: number;
  source?: string;
  doi?: string;
  pmid?: string;
  url?: string;
  oaStatus?: string;
  oaUrl?: string;
  downloadStatus?: string;
  summaryJson?: LiteratureSummary;
  fetchedAt?: string;
  linkedClaimIds?: string[];
  summaryQuality?: 'good' | 'partial' | 'failed' | 'unknown';
  summaryQualityNote?: string;
}

export interface MedicalQualityFinding {
  code: string;
  message: string;
  severity: KnowledgeFlagSeverity;
  relatedClaimIds?: string[];
  domain?: string;
  assertionType?: AssertionType;
  basis?: string[];
  missingEvidence?: string[];
  reliability?: ReliabilityNote;
  caution?: string;
}

export interface KnowledgeTimelineEvent {
  id: string;
  date?: string;
  datePrecision: 'day' | 'month' | 'year' | 'unknown';
  type: string;
  description: string;
  source?: KnowledgeClaimSource;
  aggregatedCount?: number;
  references?: Array<{
    id?: string;
    description?: string;
    source?: KnowledgeClaimSource;
  }>;
  hidden?: boolean;
}

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  docType: string;
  score?: KnowledgeScore;
  flagsCount?: number;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocumentSummary {
  summary?: string;
  sections?: Record<string, unknown>;
  claims: KnowledgeClaim[];
  flags: KnowledgeFlag[];
  timeline: KnowledgeTimelineEvent[];
  qualityFindings?: MedicalQualityFinding[];
  medicalQualityScore?: number;
  literatureQueries?: string[];
  literatureResources?: LiteratureResource[];
  reasoningFindings?: MedicalQualityFinding[];
  ocrModeUsed?: 'base' | 'enhanced';
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeDocumentListResponse {
  documents: KnowledgeDocumentSummary[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}

