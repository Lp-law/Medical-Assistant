import React from 'react';
import { CaseData } from '../types';
import { BookOpen } from 'lucide-react';

interface Props { caseData: CaseData; }
const ReasoningStep: React.FC<Props> = ({ caseData }) => {
  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
       <div className="w-full md:w-1/3 bg-white p-4 rounded shadow"><BookOpen className="w-5 h-5" /> נימוקים</div>
       <div className="flex-1 bg-white p-4 rounded shadow">תוכן הטיעונים...</div>
    </div>
  );
};
export default ReasoningStep;