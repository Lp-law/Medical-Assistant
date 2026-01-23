import React from 'react';
import { ArrowRight } from 'lucide-react';
import { CaseStatusType } from '../types';

const statusLabel: Record<CaseStatusType, string> = {
  ACTIVE: 'פעיל',
  ARCHIVED: 'בארכיון',
  PENDING_DELETE: 'ממתין למחיקה',
};

interface Props {
  mode: string;
  caseName?: string;
  status?: CaseStatusType;
  isReadOnly?: boolean;
  onBack?: () => void;
}

const ContextRibbon: React.FC<Props> = ({ mode, caseName, status, isReadOnly, onBack }) => {
  const handleBack = () => {
    // If no callback is provided, we don't want to unexpectedly navigate away from the SPA.
    // In this app we pass onBack whenever there is a meaningful in-app "back".
    if (!onBack) return;
    onBack();
  };

  return (
    <div className="w-full bg-navy-dark/80 text-pearl px-4 py-3 rounded-b-card shadow-card-xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">{mode}</span>
        {isReadOnly && <span className="badge-readonly">קריאה בלבד</span>}
        {caseName && (
          <span className="badge-owner bg-pearl text-navy">
            {caseName}
          </span>
        )}
        {status && <span className="badge-status bg-gold/15 text-navy">{statusLabel[status] ?? status}</span>}
      </div>
      {onBack && (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-xs text-gold hover:text-gold-light transition"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה למסך הקודם
        </button>
      )}
    </div>
  );
};

export default ContextRibbon;

