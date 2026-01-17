import React, { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { MedicalQualityFinding, KnowledgeFlagSeverity } from '../types';
import { LEGAL_DISCLAIMER_TEXT } from './LegalDisclaimer';

interface Props {
  score?: number;
  findings?: MedicalQualityFinding[];
  reasoningFindings?: MedicalQualityFinding[];
}

const getStatusLabel = (value?: number) => {
  if (value === undefined || value === null) return 'לא זמין';
  if (value >= 75) return 'גבוהה';
  if (value >= 55) return 'בינונית';
  return 'נמוכה';
};

const severityLabel: Record<KnowledgeFlagSeverity, string> = {
  critical: 'קריטי',
  warning: 'אזהרה',
  info: 'מידע',
};

const severityTone: Record<KnowledgeFlagSeverity, string> = {
  critical: 'badge-critical',
  warning: 'badge-warning',
  info: 'badge-muted',
};

const assertionBadge: Record<string, { label: string; className: string }> = {
  FACT: { label: 'עובדה', className: 'badge-warning' },
  INTERPRETATION: { label: 'פרשנות מקצועית', className: 'badge-info' },
  POSSIBILITY: { label: 'אפשרות / השערה', className: 'badge-muted' },
};

const domainLabel: Record<string, string> = {
  GENERAL: 'כללי',
  ORTHO: 'אורתופדיה',
  NEURO: 'נוירולוגיה',
  CARDIO: 'קרדיולוגיה',
  PSYCH: 'פסיכיאטריה',
  REHAB: 'שיקום',
  DENTAL: 'רפואת שיניים',
  ENT: 'אף־אוזן־גרון',
  GASTRO: 'גסטרואנטרולוגיה',
  OBGYN: 'מיילדות וגינקולוגיה',
  EMERGENCY: 'רפואה דחופה',
  ICU: 'טיפול נמרץ',
  GENERAL_SURGERY: 'כירורגיה כללית',
  PLASTIC_SURGERY: 'כירורגיה פלסטית',
  COSMETIC_INJECTABLES: 'אסתטיקה/הזרקות',
};

const MedicalQualityBox: React.FC<Props> = ({ score, findings = [], reasoningFindings = [] }) => {
  const statusLabel = getStatusLabel(score);
  const [reasoningFilter, setReasoningFilter] = useState<'all' | 'critical'>('all');
  const filteredReasoning = useMemo(
    () =>
      reasoningFilter === 'critical'
        ? reasoningFindings.filter((finding) => finding.severity === 'critical')
        : reasoningFindings,
    [reasoningFilter, reasoningFindings],
  );

const renderAssertionBadge = (type?: string, rationale?: string) => {
    if (!type) return null;
  const config = assertionBadge[type] ?? { label: type, className: 'badge-muted' };
    return (
      <span className={config.className} title={rationale}>
        {config.label}
      </span>
    );
  };

  const findingsList = findings.length ? (
    <ul className="grid gap-3">
      {findings.map((finding) => (
        <li key={`${finding.code}-${finding.message}`} className="mini-card">
          <div className="flex items-center justify-between text-[11px]">
            <span className={severityTone[finding.severity] ?? 'badge-muted'}>
              {severityLabel[finding.severity] ?? finding.severity}
            </span>
            <span className="text-slate-light">{finding.code}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-light">
            {finding.domain && (
              <span className="rounded-full bg-pearl px-2 py-0.5 text-[10px] font-semibold">
                {domainLabel[finding.domain] ?? finding.domain}
              </span>
            )}
            {renderAssertionBadge(finding.assertionType, finding.reliability?.rationale)}
          </div>
          <p className="text-sm text-navy">{finding.message}</p>
          {finding.basis && finding.basis.length > 0 && (
            <p className="text-[11px] text-slate-light">מבוסס על: {finding.basis[0]}</p>
          )}
          {finding.missingEvidence && finding.missingEvidence.length > 0 && (
            <p className="text-[11px] text-slate">מה חסר: {finding.missingEvidence[0]}</p>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <div className="state-block">
      <ClipboardList className="state-block__icon" aria-hidden="true" />
      <p className="state-block__title">אין ממצאי איכות חריגים</p>
      <p className="state-block__description">הניתוח לא מצא ליקויים בולטים עבור חוות הדעת הנוכחית.</p>
    </div>
  );

  return (
    <div className="card-shell">
      <div className="card-accent" />
      <div className="card-head">
        <div>
          <p className="text-sm font-semibold">חותמת איכות רפואית</p>
          <p className="text-xs text-slate-light">מבוסס על ניתוח טענות, ציר זמן ואיתותי איכות</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-light">{statusLabel}</div>
          <div className="text-3xl font-bold text-gold">{score !== undefined ? score : '—'}</div>
          <div className="text-[10px] text-slate-light">/100</div>
        </div>
      </div>
      <div className="card-underline" />
      <div className="card-body space-y-6 text-sm text-navy">
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-light">ממצאי איכות</div>
          {findingsList}
        </div>
        {reasoningFindings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-light">בדיקות עקביות רפואית</span>
              <div className="segmented-control">
                <button
                  data-active={reasoningFilter === 'all'}
                  aria-pressed={reasoningFilter === 'all'}
                  onClick={() => setReasoningFilter('all')}
                >
                  הכל
                </button>
                <button
                  data-active={reasoningFilter === 'critical'}
                  aria-pressed={reasoningFilter === 'critical'}
                  onClick={() => setReasoningFilter('critical')}
                >
                  קריטיים בלבד
                </button>
              </div>
            </div>
            {filteredReasoning.length === 0 ? (
              <div className="state-block text-xs">
                <ClipboardList className="state-block__icon" aria-hidden="true" />
                <p className="state-block__title text-sm">לא נמצאו ממצאים למסנן</p>
                <p className="state-block__description">נסה להרחיב את טווח הסינון כדי לצפות בכל הבדיקות.</p>
              </div>
            ) : (
              <ul className="grid gap-3">
                {filteredReasoning.map((finding) => (
                  <li key={`reason-${finding.code}-${finding.message}`} className="mini-card">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={severityTone[finding.severity] ?? 'badge-muted'}>
                        {severityLabel[finding.severity] ?? finding.severity}
                      </span>
                      <span className="text-slate-light">{finding.code}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-light">
                      {finding.domain && (
                        <span className="rounded-full bg-pearl px-2 py-0.5 text-[10px] font-semibold">
                          {domainLabel[finding.domain] ?? finding.domain}
                        </span>
                      )}
                      {renderAssertionBadge(finding.assertionType, finding.reliability?.rationale)}
                    </div>
                    <p className="text-sm text-navy">{finding.message}</p>
                    {finding.basis && finding.basis.length > 0 && (
                      <p className="text-[11px] text-slate-light">מבוסס על: {finding.basis[0]}</p>
                    )}
                    {finding.missingEvidence && finding.missingEvidence.length > 0 && (
                      <p className="text-[11px] text-slate">מה חסר: {finding.missingEvidence[0]}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-pearl/80 px-6 py-3 text-[11px] text-slate-light">{LEGAL_DISCLAIMER_TEXT}</div>
    </div>
  );
};

export default MedicalQualityBox;

