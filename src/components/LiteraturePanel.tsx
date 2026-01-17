import React, { useMemo, useState } from 'react';
import { AlertTriangle, BookOpenCheck } from 'lucide-react';
import { LiteratureResource } from '../types';
import { downloadLiterature, searchLiterature, summarizeLiterature } from '../services/literatureApi';

interface Props {
  knowledgeId: string;
  resources: LiteratureResource[];
  onRefresh: () => Promise<void>;
}

const oaLabel = (status?: string): string => {
  if (status === 'open') return 'Open Access';
  if (status === 'no_oa') return 'No OA';
  if (status === 'closed') return 'Closed';
  return status || 'unknown';
};

const summaryQualityLabel: Record<string, string> = {
  good: 'סיכום מלא',
  partial: 'סיכום חלקי',
  failed: 'סיכום נכשל',
  unknown: 'לא זמין',
};

const summaryTone: Record<string, string> = {
  good: 'badge-strong',
  partial: 'badge-warning',
  failed: 'badge-critical',
};

const LiteraturePanel: React.FC<Props> = ({ knowledgeId, resources, onRefresh }) => {
  const [loadingAction, setLoadingAction] = useState<'search' | 'download' | 'summarize' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openResource, setOpenResource] = useState<string | null>(null);

  const sortedResources = useMemo(
    () =>
      [...(resources ?? [])].sort((a, b) => (b.fetchedAt ?? '').localeCompare(a.fetchedAt ?? '')),
    [resources],
  );

  const handleAction = async (action: 'search' | 'download' | 'summarize', targetId?: string) => {
    try {
      setLoadingAction(action);
      setError(null);
      if (action === 'search') {
        await searchLiterature(knowledgeId);
      } else if (action === 'download') {
        await downloadLiterature(knowledgeId, targetId ? [targetId] : undefined);
      } else if (action === 'summarize') {
        await summarizeLiterature(knowledgeId, targetId ? [targetId] : undefined);
      }
      await onRefresh();
    } catch (err: any) {
      setError(err?.message ?? 'literature_action_failed');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="card-shell">
      <div className="card-accent" />
      <div className="card-head">
        <div>
          <h3 className="text-sm font-semibold">נספחי ספרות רפואית</h3>
          <p className="text-xs text-slate-light">מקורות תומכים לחיזוק התיק</p>
        </div>
        <button
          type="button"
          className="btn-primary text-[11px] px-4 py-1.5"
          onClick={() => handleAction('search')}
          disabled={loadingAction === 'search'}
        >
          {loadingAction === 'search' ? 'מחפש...' : 'סרוק מאמרים'}
        </button>
      </div>
      <div className="card-underline" />
      {error && (
        <div className="px-6">
          <div className="state-block state-block--error text-sm">
            <AlertTriangle className="state-block__icon" aria-hidden="true" />
            <p className="state-block__title">אירעה תקלה בחיפוש</p>
            <p className="state-block__description">{error}</p>
          </div>
        </div>
      )}
      <div className="card-body space-y-3 text-sm text-navy">
        {!sortedResources.length ? (
          <div className="state-block">
            <BookOpenCheck className="state-block__icon" aria-hidden="true" />
            <p className="state-block__title">עדיין אין נספחים רפואיים</p>
            <p className="state-block__description">התחלת סריקה תאסוף מאמרים ותוסיף אותם לרשימה.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedResources.map((resource) => {
              const isOpen = openResource === resource.id;
              return (
                <article key={resource.id} className="mini-card">
                  <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p
                        className={`text-base font-semibold ${isOpen ? '' : 'truncate'}`}
                        title={resource.title}
                      >
                        {resource.title}
                      </p>
                      <p className="text-xs text-slate-light">
                        {resource.journal || 'כתב עת לא ידוע'} · {resource.year ?? '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="badge-muted">{oaLabel(resource.oaStatus)}</span>
                      {resource.summaryQuality && resource.summaryQuality !== 'unknown' && (
                        <span className={summaryTone[resource.summaryQuality] ?? 'badge-info'}>
                          {summaryQualityLabel[resource.summaryQuality] ?? resource.summaryQuality}
                        </span>
                      )}
                    </div>
                  </header>
                  {resource.linkedClaimIds && resource.linkedClaimIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[11px] text-slate-light">
                      {resource.linkedClaimIds.map((claimId) => (
                        <span key={claimId} className="rounded-full bg-pearl px-2 py-0.5">
                          טענה #{claimId}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      className="btn-secondary text-[11px] px-4 py-1.5"
                      aria-expanded={isOpen}
                      onClick={() => setOpenResource((prev) => (prev === resource.id ? null : resource.id))}
                    >
                      {isOpen ? 'הסתר נספח' : 'פתח נספח'}
                    </button>
                    {resource.oaStatus === 'open' && (
                      <button
                        type="button"
                        className="btn-outline text-[11px] px-4 py-1.5"
                        onClick={() => handleAction('download', resource.id)}
                        disabled={loadingAction === 'download'}
                      >
                        {resource.downloadStatus === 'downloaded' ? 'PDF קיים' : 'הורד PDF'}
                      </button>
                    )}
                    {resource.downloadStatus === 'downloaded' && (
                      <button
                        type="button"
                        className="btn-outline text-[11px] px-4 py-1.5"
                        onClick={() => handleAction('summarize', resource.id)}
                        disabled={loadingAction === 'summarize'}
                      >
                        {resource.summaryJson ? 'סיכום מוכן' : 'בצע סיכום'}
                      </button>
                    )}
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-outline text-[11px] px-4 py-1.5"
                        aria-label={`פתח מקור חיצוני עבור ${resource.title}`}
                      >
                        פתח מקור
                      </a>
                    )}
                  </div>
                  {isOpen && (
                    <div className="space-y-3 pt-3 border-t border-pearl/60">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-light tracking-wide uppercase">תקציר חופשי</p>
                        <p className="text-sm text-navy leading-relaxed">
                          {resource.summaryJson?.summary ?? 'לא זמין'}
                        </p>
                      </div>
                      {!!resource.summaryJson?.keyFindings?.length && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-light tracking-wide uppercase">מסקנות</p>
                          <ul className="list-disc space-y-1 pr-5 text-sm text-navy leading-relaxed">
                            {resource.summaryJson.keyFindings.map((finding: string, index: number) => (
                              <li key={`${resource.id}-finding-${index}`}>{finding}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!!resource.summaryJson?.limitations?.length && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-light tracking-wide uppercase">מגבלות</p>
                          <ul className="list-disc space-y-1 pr-5 text-sm text-navy leading-relaxed">
                            {resource.summaryJson.limitations.map((limitation: string, index: number) => (
                              <li key={`${resource.id}-limitation-${index}`}>{limitation}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {resource.summaryJson?.bottomLine && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-light tracking-wide uppercase">Bottom line</p>
                          <p className="text-sm text-navy leading-relaxed">{resource.summaryJson.bottomLine}</p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiteraturePanel;

