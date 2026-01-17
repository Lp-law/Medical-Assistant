import React from 'react';
import { Sparkles } from 'lucide-react';
interface Props { isOpen: boolean; onClose: () => void; contextQuery: string; onImportPrecedent: any; onImportRule: any; }
const SmartAssistant: React.FC<Props> = ({ isOpen }) => {
  if (!isOpen) return null;
  return <div className="fixed left-0 top-16 bottom-0 w-80 bg-slate-900 text-white p-4"><Sparkles /> Assistant Active</div>;
};
export default SmartAssistant;