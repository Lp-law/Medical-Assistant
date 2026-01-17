import React from 'react';
import { CaseData } from '../types';
import { Shield, Activity } from 'lucide-react';

interface Props { caseData: CaseData; navigateToStep: (step: number) => void; }
const CaseDashboard: React.FC<Props> = ({ caseData, navigateToStep }) => {
  const activeHeads = caseData.damages.heads.filter((head) => head.isActive).length;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-navy">לוח בקרה: {caseData.name}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-shell cursor-pointer hover:shadow-2xl transition" onClick={() => navigateToStep(1)}>
          <div className="card-accent" />
          <div className="card-head">
            <div className="flex items-center gap-2 text-slate text-sm">
              <Shield className="w-5 h-5 text-gold" />
              <span>ניתוח חבות</span>
            </div>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-3">
            <div className="text-3xl font-bold text-navy" dir="ltr">
              {caseData.liability.probability}%
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-light">
              <Activity className="w-4 h-4" />
              {activeHeads} ראשי נזק פעילים
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CaseDashboard;