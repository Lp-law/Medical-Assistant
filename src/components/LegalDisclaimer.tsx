import React from 'react';

export const LEGAL_DISCLAIMER_TEXT = 'המערכת אינה מחליפה מומחה רפואי. זהו כלי תומך החלטה משפטית בלבד.';

interface Props {
  className?: string;
}

const LegalDisclaimer: React.FC<Props> = ({ className }) => (
  <p className={`text-center text-[11px] text-slate-light mt-6 ${className ?? ''}`}>{LEGAL_DISCLAIMER_TEXT}</p>
);

export default LegalDisclaimer;

