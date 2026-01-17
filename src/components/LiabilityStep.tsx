import React, { useState, useEffect, Dispatch, SetStateAction, useCallback } from 'react';
import {
  CaseData,
  LiabilityAnalysis,
  KnowledgeDocumentSummary,
  KnowledgeDocumentDetail,
} from '../types';
import { calculateLiabilityScore } from '../services/calculations';
import { Scale, Loader2, AlertTriangle, Book } from 'lucide-react';
import LegalDisclaimer from './LegalDisclaimer';
import SmartAssistant from './SmartAssistant';
import { listKnowledgeDocuments, getKnowledgeDocument } from '../services/knowledgeApi';
import QualityBadge from './QualityBadge';
import KnowledgeFlags from './KnowledgeFlags';
import KnowledgeClaimsPanel from './KnowledgeClaimsPanel';
import MedicalTimeline from './MedicalTimeline';
import MedicalQualityBox from './MedicalQualityBox';
import LiteraturePanel from './LiteraturePanel';

interface Props {
  caseData: CaseData;
  updateCaseData: Dispatch<SetStateAction<CaseData | null>>;
}

const LiabilityStep: React.FC<Props> = ({ caseData, updateCaseData }) => {
  const [localAnalysis, setLocalAnalysis] = useState<LiabilityAnalysis>(caseData.liability);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceInitialized, setEvidenceInitialized] = useState(false);
  const [medicalDocs, setMedicalDocs] = useState<KnowledgeDocumentSummary[]>([]);
  const [selectedMedicalId, setSelectedMedicalId] = useState<string>('');
  const [medicalDetail, setMedicalDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [medicalListLoading, setMedicalListLoading] = useState(false);
  const [medicalDetailLoading, setMedicalDetailLoading] = useState(false);
  const [medicalError, setMedicalError] = useState<string | null>(null);

  useEffect(() => {
    const result = calculateLiabilityScore(
      50,
      localAnalysis.aggravatingFactors,
      localAnalysis.mitigatingFactors,
      localAnalysis.medicalRecordQuality,
      localAnalysis.expertCourtStance
    );
    setLocalAnalysis((prev: LiabilityAnalysis) => ({
      ...prev,
      probability: result.probability,
      probabilityRange: result.range,
      uncertainty: result.uncertainty,
    }));
  }, [localAnalysis.aggravatingFactors, localAnalysis.mitigatingFactors, localAnalysis.medicalRecordQuality, localAnalysis.expertCourtStance]);

  useEffect(() => {
    if (caseData.liability === localAnalysis) return;
    setLocalAnalysis(caseData.liability);
  }, [caseData.liability, localAnalysis]);

  useEffect(() => {
    updateCaseData((prev) => {
      if (!prev) return prev;
      if (prev.liability === localAnalysis) return prev;
      return { ...prev, liability: localAnalysis };
    });
  }, [localAnalysis, updateCaseData]);

  useEffect(() => {
    if (!evidenceOpen || evidenceInitialized) return;
    let cancelled = false;
    const loadDocuments = async () => {
      setMedicalListLoading(true);
      setMedicalError(null);
      try {
        const docs = await listKnowledgeDocuments({ docType: 'chapter', limit: 10 });
        if (!cancelled) {
          setMedicalDocs(docs);
          setSelectedMedicalId(docs[0]?.id ?? '');
          setEvidenceInitialized(true);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMedicalError('טעינת ניתוחים רפואיים נכשלה.');
        }
      } finally {
        if (!cancelled) {
          setMedicalListLoading(false);
        }
      }
    };
    loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [evidenceOpen, evidenceInitialized]);

  useEffect(() => {
    if (!evidenceOpen || !selectedMedicalId) {
      setMedicalDetail(null);
      return;
    }
    let cancelled = false;
    setMedicalDetailLoading(true);
    setMedicalError(null);
    const loadDetail = async () => {
      try {
        const doc = await getKnowledgeDocument(selectedMedicalId);
        if (!cancelled) {
          setMedicalDetail(doc);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMedicalError('טעינת המסמך הרפואי נכשלה.');
          setMedicalDetail(null);
        }
      } finally {
        if (!cancelled) {
          setMedicalDetailLoading(false);
        }
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [evidenceOpen, selectedMedicalId]);

  const refreshEvidenceDetail = useCallback(async () => {
    if (!selectedMedicalId) return;
    try {
      const doc = await getKnowledgeDocument(selectedMedicalId);
      setMedicalDetail(doc);
    } catch (error) {
      console.error(error);
      setMedicalError('טעינת המסמך הרפואי נכשלה.');
    }
  }, [selectedMedicalId]);

  const requiresHumanExpert = medicalDetail?.flags?.some((flag) => flag.code === 'HUMAN_EXPERT_REQUIRED');
  const hasAssertionConflict =
    Boolean(medicalDetail?.claims?.some((claim) => claim.assertionType === 'FACT')) &&
    Boolean(medicalDetail?.flags?.some((flag) => flag.severity === 'critical'));

  return (
    <div className="flex relative">
      <SmartAssistant
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        contextQuery=""
        onImportPrecedent={() => {}}
        onImportRule={() => {}}
      />
      <div className="flex-1 space-y-8 pb-12">
        <div className="card-shell">
          <div className="card-accent" />
          <div className="card-head">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Scale className="w-5 h-5 text-gold" /> ניתוח חבות
            </h2>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-6">
            <div className="rounded-card border border-pearl bg-pearl/40 p-4 text-center">
              <div className="text-4xl font-bold text-navy" dir="ltr">
                {localAnalysis.probability}%
              </div>
              <div className="text-sm text-slate-light">סיכוי לתביעה</div>
            </div>
            <div className="pt-4 border-t border-pearl/60">
              <button
                type="button"
                className="btn-outline w-full justify-between px-4 py-3"
                onClick={() => setEvidenceOpen((prev) => !prev)}
                aria-expanded={evidenceOpen}
              >
                <span>Medical Evidence</span>
                <span>{evidenceOpen ? 'הסתר' : 'הצג'}</span>
              </button>
            {(requiresHumanExpert || hasAssertionConflict) && (
              <div className="mt-4 state-block state-block--error text-sm">
                <AlertTriangle className="state-block__icon" aria-hidden="true" />
                <p className="state-block__title">
                  {requiresHumanExpert ? 'נדרש מומחה אנושי' : 'זוהתה סתירה בין הטענות לדגלים'}
                </p>
                <p className="state-block__description">
                  {requiresHumanExpert
                    ? 'קיים דגל HUMAN_EXPERT_REQUIRED בתיק. מומלץ לערב מומחה רפואי לפני המשך טיפול.'
                    : 'יש דגלים קריטיים לצד טענות המסומנות כעובדה. ודא את הממצאים לפני הסתמכות.'}
                </p>
              </div>
            )}
              {evidenceOpen && (
                <div className="mt-4 space-y-4">
                  {medicalError && (
                    <div className="state-block state-block--error text-sm">
                      <AlertTriangle className="state-block__icon" aria-hidden="true" />
                      <p className="state-block__title">טעינת המסמך נכשלה</p>
                      <p className="state-block__description">{medicalError}</p>
                    </div>
                  )}
                  {medicalListLoading && (
                    <div className="loader-inline">
                      <Loader2 className="loader-inline__icon" aria-hidden="true" />
                      טוען מסמכים רפואיים...
                    </div>
                  )}
                  {!medicalListLoading && medicalDocs.length === 0 && (
                    <div className="state-block text-sm">
                      <Book className="state-block__icon" aria-hidden="true" />
                      <p className="state-block__title">אין מסמכים רפואיים זמינים</p>
                      <p className="state-block__description">ייבא או בחר מסמך רפואי כדי לצפות בניתוח.</p>
                    </div>
                  )}
                  {medicalDocs.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-light">בחר מסמך</label>
                      <select
                        className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                        value={selectedMedicalId}
                        onChange={(e) => setSelectedMedicalId(e.target.value)}
                        disabled={medicalListLoading}
                      >
                        {medicalDocs.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {medicalDetailLoading && (
                    <div className="loader-inline">
                      <Loader2 className="loader-inline__icon" aria-hidden="true" />
                      טוען ניתוח רפואי...
                    </div>
                  )}
                  {medicalDetail && (
                    <>
                      <QualityBadge score={medicalDetail.score} label="מדד איכות רפואית" />
                      <MedicalQualityBox
                        score={medicalDetail.medicalQualityScore}
                        findings={medicalDetail.qualityFindings ?? []}
                        reasoningFindings={medicalDetail.reasoningFindings ?? []}
                      />
                      <KnowledgeFlags flags={medicalDetail.flags || []} />
                      <KnowledgeClaimsPanel claims={medicalDetail.claims || []} limit={5} />
                      <MedicalTimeline events={medicalDetail.timeline || []} />
                      <LiteraturePanel
                        knowledgeId={medicalDetail.id}
                        resources={medicalDetail.literatureResources ?? []}
                        onRefresh={refreshEvidenceDetail}
                      />
                    </>
                  )}
                <LegalDisclaimer />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LiabilityStep;