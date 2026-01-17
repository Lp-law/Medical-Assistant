import React from 'react';
import { KnowledgeScore } from '../types';

interface Props {
  score?: KnowledgeScore;
  label?: string;
}

const getStatusLabel = (value: number) => {
  if (value >= 0.75) return 'איכות גבוהה';
  if (value >= 0.45) return 'איכות בינונית';
  return 'איכות נמוכה';
};

const formatBreakdownValue = (value?: number | { value?: number; reasons?: string[] }): string => {
  if (value === undefined || value === null) return 'N/A';
  if (typeof value === 'number') {
    return `${(value * 100).toFixed(0)}%`;
  }
  const base = value.value !== undefined ? `${(value.value * 100).toFixed(0)}%` : 'N/A';
  const reasons = value.reasons?.length ? ` (${value.reasons.join('; ')})` : '';
  return `${base}${reasons}`;
};

const buildTooltip = (score?: KnowledgeScore): string => {
  if (!score) return 'אין מדד איכות';
  const rows: string[] = [`ציון כולל: ${(score.value * 100).toFixed(0)}%`];
  Object.entries(score.breakdown ?? {}).forEach(([key, value]) => rows.push(`${key}: ${formatBreakdownValue(value as any)}`));
  return rows.join(' | ');
};

const QualityBadge: React.FC<Props> = ({ score, label }) => {
  if (!score) {
    return (
      <div className="card-shell">
        <div className="card-accent" />
        <div className="card-head">
          <p className="text-sm font-semibold text-slate">אין נתוני איכות רפואית זמינים</p>
        </div>
      </div>
    );
  }
  const percent = Math.round((score.value ?? 0) * 100);
  const statusText = getStatusLabel(score.value ?? 0);
  const breakdownEntries = Object.entries(score.breakdown ?? {});

  return (
    <div className="card-shell" title={buildTooltip(score)}>
      <div className="card-accent" />
      <div className="card-head">
        <div>
          <p className="text-sm font-semibold">{label ?? 'מדד איכות רפואית'}</p>
          <p className="text-xs text-slate-light">{statusText}</p>
        </div>
        <div className="quality-seal">
          <span className="quality-seal__value">{percent}</span>
          <span className="quality-seal__label">% איכות</span>
        </div>
      </div>
      <div className="card-underline" />
      <div className="card-body text-xs text-slate space-y-2">
        {breakdownEntries.length === 0 ? (
          <p>לא סופקה חלוקת משנה של המדד.</p>
        ) : (
          <dl className="grid gap-2">
            {breakdownEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <dt className="text-slate-light capitalize">{key}</dt>
                <dd className="font-semibold text-navy">{formatBreakdownValue(value as any)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
};

export default QualityBadge;

