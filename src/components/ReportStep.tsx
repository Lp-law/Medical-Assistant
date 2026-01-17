import React from 'react';
import { CaseData } from '../types';
import { FileText } from 'lucide-react';
import LegalDisclaimer from './LegalDisclaimer';

interface Props { caseData: CaseData; }
const ReportStep: React.FC<Props> = ({ caseData }) => {
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="bg-white p-12 shadow-lg border border-slate-200 text-slate-900" id="legal-report">
         <h1 className="text-2xl font-bold mb-4"><FileText className="inline w-6 h-6"/> דוח מסכם: {caseData.name}</h1>
         <p>{caseData.summary}</p>
      </div>
      <LegalDisclaimer className="text-right" />
    </div>
  );
};
export default ReportStep;