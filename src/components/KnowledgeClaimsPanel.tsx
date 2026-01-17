import React, { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { KnowledgeClaim, KnowledgeClaimSource } from '../types';
import { LEGAL_DISCLAIMER_TEXT } from './LegalDisclaimer';

interface Props {
  claims: KnowledgeClaim[];
  limit?: number;
}

interface ModalState {
  open: boolean;
  loading: boolean;
  error: string | null;
  source: KnowledgeClaimSource | null;
  claimTitle: string;
}

const initialModalState: ModalState = {
  open: false,
  loading: false,
  error: null,
  source: null,
  claimTitle: '',
};

const assertionLabel: Record<string, { label: string; className: string }> = {
  FACT: { label: 'עובדה', className: 'badge-warning' },
  INTERPRETATION: { label: 'פרשנות מקצועית', className: 'badge-info' },
  POSSIBILITY: { label: 'אפשרות / השערה', className: 'badge-muted' },
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('he-IL');
};

const KnowledgeClaimsPanel: React.FC<Props> = ({ claims, limit = 5 }) => {
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState<ModalState>(initialModalState);

  const visibleClaims = useMemo(() => (showAll ? claims : claims.slice(0, limit)), [claims, showAll, limit]);

  const handleOpenSource = (claim: KnowledgeClaim) => {
    if (!claim.source?.snippet) {
      setModal({
        open: true,
        loading: false,
        error: 'מקור לא זמין',
        source: null,
        claimTitle: claim.type,
      });
      return;
    }
    setModal({
      open: true,
      loading: false,
      error: null,
      source: claim.source,
      claimTitle: claim.type,
    });
  };

  const closeModal = () => setModal(initialModalState);

  return (
    <div className="card-shell">
      <div className="card-accent" />
      <div className="card-head">
        <div>
          <h3 className="text-sm font-semibold">טענות רפואיות</h3>
          <p className="text-xs text-slate-light">טענות רשומות מתוך חוות הדעת</p>
        </div>
        {claims.length > limit && (
          <button className="btn-outline text-[11px] px-3 py-1" onClick={() => setShowAll((prev) => !prev)}>
            {showAll ? 'הצג פחות' : 'צפה בכל הטענות'}
          </button>
        )}
      </div>
      <div className="card-underline" />
      <div className="card-body px-0">
        {!claims.length ? (
          <div className="px-6 pb-6">
            <div className="state-block">
              <ClipboardList className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">אין טענות רפואיות להצגה</p>
              <p className="state-block__description">כאשר יתווספו טענות חדשות הן יופיעו כאן עם פרטי המקור המלאים.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[420px]">
            <table className="min-w-full text-sm">
              <thead className="bg-pearl text-slate text-xs uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-right font-semibold">סוג</th>
                  <th className="px-4 py-2 text-right font-semibold">ערך</th>
                  <th className="px-4 py-2 text-right font-semibold">תאריך</th>
                  <th className="px-4 py-2 text-right font-semibold">סיווג</th>
                  <th className="px-4 py-2 text-right font-semibold">אמון מספרי</th>
                  <th className="px-4 py-2 text-right font-semibold">איכות מקור</th>
                  <th className="px-4 py-2 text-right font-semibold">מה חסר לחיזוק</th>
                  <th className="px-4 py-2 text-right font-semibold">מקור</th>
                </tr>
              </thead>
              <tbody className="text-navy">
                {visibleClaims.map((claim) => (
                  <tr
                    key={claim.id}
                    className="border-b border-pearl/60 odd:bg-pearl/20 hover:bg-pearl/40 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{claim.type}</td>
                    <td className="px-4 py-3">
                      <div>{claim.value}</div>
                      {claim.basis && claim.basis.length > 0 && (
                        <div className="mt-1 text-[11px] text-slate-light">{claim.basis[0]}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-left" dir="ltr">
                      {formatDate(claim.date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {claim.assertionType ? (
                        <span className={assertionLabel[claim.assertionType]?.className ?? 'badge-muted'}>
                          {assertionLabel[claim.assertionType]?.label ?? claim.assertionType}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-light">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-left" dir="ltr">
                      {claim.confidence ? `${Math.round(claim.confidence * 100)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {claim.evidenceQuality ? (
                        <span
                          className={
                            claim.evidenceQuality === 'high'
                              ? 'badge-strong'
                              : claim.evidenceQuality === 'medium'
                              ? 'badge-info'
                              : 'badge-critical'
                          }
                          title={claim.evidenceNotes || 'הערכת איכות מקור'}
                        >
                          {claim.evidenceQuality === 'high'
                            ? 'גבוהה'
                            : claim.evidenceQuality === 'medium'
                            ? 'בינונית'
                            : 'נמוכה'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-light">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {claim.missingEvidence && claim.missingEvidence.length > 0 ? (
                        <span className="text-xs text-slate">{claim.missingEvidence[0]}</span>
                      ) : (
                        <span className="text-xs text-slate-light">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <button className="btn-outline text-[11px] px-3 py-1" onClick={() => handleOpenSource(claim)}>
                        מקור
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="border-t border-pearl/80 px-6 py-3 text-[11px] text-slate-light">
        הממצאים מסומנים לשימוש משפטי זהיר בלבד. {LEGAL_DISCLAIMER_TEXT}
      </div>
      {modal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-shell max-w-xl w-full">
            <div className="card-accent" />
            <div className="card-head">
              <h4 className="text-sm font-semibold text-navy">{modal.claimTitle || 'מקור'}</h4>
              <button onClick={closeModal} className="text-xs text-slate-light hover:text-navy" aria-label="סגור חלון המקור">
                סגור
              </button>
            </div>
            <div className="card-underline" />
            <div className="card-body text-sm text-navy">
              {modal.loading && <div className="text-sm text-slate">טוען מקור...</div>}
              {!modal.loading && modal.error && <div className="text-sm text-danger">{modal.error}</div>}
              {!modal.loading && !modal.error && modal.source && (
                <div className="space-y-3">
                  <p className="rounded-card border border-pearl bg-pearl/40 p-4 text-sm text-navy whitespace-pre-line">
                    {modal.source.snippet}
                  </p>
                  <div className="text-xs text-slate-light">
                    {modal.source.page ? `עמוד ${modal.source.page}` : ''}
                    {modal.source.lineRange?.length ? ` · שורות ${modal.source.lineRange.join('–')}` : ''}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeClaimsPanel;

