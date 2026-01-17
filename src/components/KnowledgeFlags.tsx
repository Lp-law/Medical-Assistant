import React, { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { KnowledgeFlag, KnowledgeFlagSeverity } from '../types';

interface Props {
  flags: KnowledgeFlag[];
}

const severityAccent: Record<KnowledgeFlagSeverity, string> = {
  critical: 'border-danger text-danger',
  warning: 'border-gold text-gold',
  info: 'border-slate-light text-slate',
};

const KnowledgeFlags: React.FC<Props> = ({ flags }) => {
  const [filter, setFilter] = useState<'all' | 'critical'>('all');
  const filteredFlags = useMemo(
    () => (filter === 'critical' ? flags.filter((flag) => flag.severity === 'critical') : flags),
    [flags, filter],
  );

  return (
    <div className="card-shell">
      <div className="card-accent" />
      <div className="card-head">
        <div>
          <p className="text-sm font-semibold">התראות ודגלים</p>
          <p className="text-xs text-slate-light">איתותים דטרמיניסטיים שעלו בניתוח</p>
        </div>
        <div className="segmented-control">
          <button data-active={filter === 'all'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            הכל
          </button>
          <button data-active={filter === 'critical'} aria-pressed={filter === 'critical'} onClick={() => setFilter('critical')}>
            קריטי בלבד
          </button>
        </div>
      </div>
      <div className="card-underline" />
      <div className="card-body space-y-3 text-sm text-navy">
        {filteredFlags.length === 0 ? (
          <div className="state-block text-sm">
            <Inbox className="state-block__icon" aria-hidden="true" />
            <p className="state-block__title">
              {flags.length === 0 ? 'לא אותרו דגלים במסמך זה' : 'אין דגלים ברמת הקריטיות שנבחרה'}
            </p>
            {flags.length > 0 && (
              <p className="state-block__description">שנה את הסינון להצגת שאר הדגלים.</p>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredFlags.map((flag, index) => (
              <li
                key={`${flag.code}-${index}`}
                className={`mini-card border-r-4 ${severityAccent[flag.severity] ?? severityAccent.info}`}
              >
                <div className="flex items-center justify-between text-xs text-slate-light">
                  <span className="font-semibold">{flag.code || 'FLAG'}</span>
                  <span className="text-slate-light">{flag.severity === 'critical' ? 'קריטי' : flag.severity === 'warning' ? 'אזהרה' : 'מידע'}</span>
                </div>
                <p className="text-sm text-navy">{flag.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default KnowledgeFlags;

