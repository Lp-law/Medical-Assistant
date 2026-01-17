import React, { Dispatch, SetStateAction } from 'react';
import { CaseData } from '../types';
import { calculateMPL } from '../services/calculations';
import { Calculator } from 'lucide-react';

interface Props {
  caseData: CaseData;
  updateCaseData: Dispatch<SetStateAction<CaseData | null>>;
}

const DamagesStep: React.FC<Props> = ({ caseData, updateCaseData }) => {
  const mpl = calculateMPL(caseData.damages);
  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calculator className="w-5 h-5" /> נזק</h2>
        <p>MPL: {mpl}</p>
      </div>
    </div>
  );
};
export default DamagesStep;