import React, { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { KnowledgeTimelineEvent } from '../types';

interface Props {
  events: KnowledgeTimelineEvent[];
}

const formatDate = (event: KnowledgeTimelineEvent): string => {
  if (!event.date) {
    return 'ללא תאריך';
  }
  switch (event.datePrecision) {
    case 'day': {
      const parsed = new Date(event.date);
      return Number.isNaN(parsed.getTime()) ? event.date : parsed.toLocaleDateString('he-IL');
    }
    case 'month': {
      const [year, month] = event.date.split('-');
      return `${month}/${year}`;
    }
    case 'year':
      return event.date;
    default:
      return 'ללא תאריך';
  }
};

const MedicalTimeline: React.FC<Props> = ({ events }) => {
  const [showHidden, setShowHidden] = useState(false);
  const [openReferences, setOpenReferences] = useState<Record<string, boolean>>({});

  const visibleEvents = useMemo(
    () => (showHidden ? events : events.filter((event) => !event.hidden)),
    [events, showHidden],
  );

  const hasHidden = events.some((event) => event.hidden);

  return (
    <div className="card-shell">
      <div className="card-accent" />
      <div className="card-head">
        <div>
          <p className="text-sm font-semibold">ציר זמן רפואי</p>
          <p className="text-xs text-slate-light">אירועי מפתח כפי שנרשמו בתיק</p>
        </div>
        {hasHidden && (
          <button
            type="button"
            className="btn-outline text-[11px] px-3 py-1"
            aria-pressed={showHidden}
            onClick={() => setShowHidden((prev) => !prev)}
          >
            {showHidden ? 'הסתר פריטים מוסתרים' : 'הצג פריטים מוסתרים'}
          </button>
        )}
      </div>
      <div className="card-underline" />
      <div className="card-body space-y-4 text-sm text-navy">
        {!visibleEvents.length ? (
          <div className="state-block">
            <Inbox className="state-block__icon" aria-hidden="true" />
            <p className="state-block__title">אין אירועים להצגה</p>
            <p className="state-block__description">
              {hasHidden ? 'ניתן לנסות ולהציג פריטים מוסתרים דרך הכפתור שלמעלה.' : 'הוספת אירועים תוצג כאן באופן כרונולוגי.'}
            </p>
          </div>
        ) : (
          <div className="timeline-wrapper space-y-6">
            {visibleEvents.map((event) => {
              const referenceCount = event.references?.length ?? 0;
              const isOpen = Boolean(openReferences[event.id]);
              const referencesId = `timeline-references-${event.id}`;
              return (
                <div key={event.id} className="timeline-item">
                  <span className="timeline-node" aria-hidden="true" />
                  <div className="timeline-card">
                    <div className="flex items-center justify-between text-xs text-slate-light">
                      <span className="font-semibold text-gold" dir="ltr">
                        {formatDate(event)}
                      </span>
                      <span className="text-navy font-semibold">{event.type}</span>
                    </div>
                    <p className="text-sm text-navy whitespace-pre-line">{event.description}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-light">
                      {event.hidden && <span className="badge-warning">פריט מוסתר</span>}
                      {event.aggregatedCount && event.aggregatedCount > 1 && (
                        <span className="badge-muted" dir="ltr">
                          כולל {event.aggregatedCount} אירועים
                        </span>
                      )}
                    </div>
                    {event.source?.snippet && (
                      <p className="rounded-card border border-pearl bg-pearl/40 p-3 text-xs text-slate">
                        {event.source.snippet}
                      </p>
                    )}
                    {(event.source?.page || event.source?.lineRange) && (
                      <div className="text-[11px] text-slate-light">
                        {event.source.page ? `עמוד ${event.source.page}` : ''}
                        {event.source.lineRange
                          ? ` · שורות ${event.source.lineRange[0]}-${event.source.lineRange[1]}`
                          : ''}
                      </div>
                    )}
                    {referenceCount > 0 && (
                      <div className="pt-2">
                        <button
                          type="button"
                          className="btn-outline text-[11px] px-3 py-1"
                          aria-expanded={isOpen}
                          aria-controls={referencesId}
                          onClick={() =>
                            setOpenReferences((prev) => ({
                              ...prev,
                              [event.id]: !prev[event.id],
                            }))
                          }
                        >
                          {isOpen ? 'הסתר מקורות' : `הצג מקורות (${referenceCount})`}
                        </button>
                        {isOpen && (
                          <ul
                            id={referencesId}
                            className="mt-2 space-y-2 rounded-card border border-pearl bg-pearl/30 p-3 text-xs text-slate"
                          >
                            {event.references?.map((reference, index) => (
                              <li key={reference.id ?? `${event.id}-ref-${index}`}>
                                <div>{reference.description}</div>
                                {reference.source && (
                                  <div className="text-[11px] text-slate-light">
                                    {reference.source.page ? `עמוד ${reference.source.page}` : ''}
                                    {reference.source.lineRange
                                      ? ` · שורות ${reference.source.lineRange[0]}-${reference.source.lineRange[1]}`
                                      : ''}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalTimeline;

