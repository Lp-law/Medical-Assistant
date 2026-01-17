import { randomUUID } from 'crypto';

export interface KnowledgeClaimSource {
  page?: number;
  lineRange?: [number, number];
  snippet?: string;
}

export interface KnowledgeClaim {
  id?: string;
  type?: string;
  value?: string;
  date?: string;
  source?: KnowledgeClaimSource;
}

export type TimelineDatePrecision = 'day' | 'month' | 'year' | 'unknown';

export interface TimelineReference {
  id?: string;
  description?: string;
  source?: KnowledgeClaimSource;
}

export interface TimelineEvent {
  id: string;
  date?: string;
  datePrecision: TimelineDatePrecision;
  type: string;
  description: string;
  source?: KnowledgeClaimSource;
  references?: TimelineReference[];
  aggregatedCount?: number;
  hidden?: boolean;
}

export interface TimelineFlag {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

const ADVANCED_TYPE_RULES: Array<{ matcher: RegExp; type: string }> = [
  { matcher: /(medication|תרופה|טיפול תרופתי|antibiotic|steroid|capsule|tablet)/i, type: 'MEDICATION' },
  { matcher: /(ct|mri|x-?ray|אולטרסאונד|צילום|radiolog|הדמיה)/i, type: 'IMAGING' },
  { matcher: /(physio|פיזיותרפיה|rehab|שיקום|התעמלות רפואית)/i, type: 'PHYSIOTHERAPY' },
  { matcher: /(follow[\s-]?up|מעקב|ביקורת|followup)/i, type: 'FOLLOW_UP' },
];

const FALLBACK_TYPE_RULES: Array<{ matcher: RegExp; type: string }> = [
  { matcher: /surgery|ניתוח/i, type: 'SURGERY' },
  { matcher: /hospital|אשפוז/i, type: 'HOSPITALIZATION' },
  { matcher: /exam|examination|בדיקה/i, type: 'EXAMINATION' },
  { matcher: /disability|נכות/i, type: 'DISABILITY' },
];

const SUBJECT_GROUP: Record<string, string> = {
  SURGERY: 'procedure',
  HOSPITALIZATION: 'procedure',
  MEDICATION: 'treatment',
  PHYSIOTHERAPY: 'treatment',
  FOLLOW_UP: 'follow',
  EXAMINATION: 'diagnostics',
  IMAGING: 'diagnostics',
  DISABILITY: 'assessment',
  EVENT: 'general',
};

const GENERIC_TERMS = ['event', 'אירוע', 'note', 'הערה', 'record', 'תיעוד', 'מסמך', 'summary', 'סיכום'];

const classifyEventType = (claim: KnowledgeClaim): string => {
  const haystack = `${claim.type ?? ''} ${claim.value ?? ''} ${claim.source?.snippet ?? ''}`.toLowerCase();
  const advanced = ADVANCED_TYPE_RULES.find((rule) => rule.matcher.test(haystack));
  if (advanced) {
    return advanced.type;
  }
  const fallback = FALLBACK_TYPE_RULES.find((rule) => rule.matcher.test(claim.type ?? ''));
  return fallback ? fallback.type : 'EVENT';
};

const getSubject = (type: string): string => SUBJECT_GROUP[type] ?? type;

type ParsedDate = {
  value?: string;
  precision: TimelineDatePrecision;
  sortTimestamp?: number;
};

const pad = (value: string | number): string => value.toString().padStart(2, '0');

const parseDateFromText = (text: string): ParsedDate | undefined => {
  const fullMatch = text.match(/(20\d{2}|19\d{2})[-/\.](\d{1,2})[-/\.](\d{1,2})/);
  if (fullMatch) {
    const iso = `${fullMatch[1]}-${pad(fullMatch[2])}-${pad(fullMatch[3])}`;
    const timestamp = new Date(iso).getTime();
    if (!Number.isNaN(timestamp)) {
      return { value: iso, precision: 'day', sortTimestamp: timestamp };
    }
  }

  const monthMatch = text.match(/(20\d{2}|19\d{2})[-/\.](\d{1,2})/);
  if (monthMatch) {
    const value = `${monthMatch[1]}-${pad(monthMatch[2])}`;
    const timestamp = new Date(`${value}-01`).getTime();
    if (!Number.isNaN(timestamp)) {
      return { value, precision: 'month', sortTimestamp: timestamp };
    }
  }

  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const value = yearMatch[0];
    const timestamp = new Date(`${value}-01-01`).getTime();
    if (!Number.isNaN(timestamp)) {
      return { value, precision: 'year', sortTimestamp: timestamp };
    }
  }

  return undefined;
};

const parseDateFromClaim = (claim: KnowledgeClaim): ParsedDate => {
  const sources = [claim.date, claim.value, claim.source?.snippet, claim.type];
  for (const source of sources) {
    if (!source) continue;
    const parsed = parseDateFromText(source);
    if (parsed) {
      return parsed;
    }
  }
  return { precision: 'unknown' };
};

const DAYS_THRESHOLD = 180;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const GROUPING_WINDOW_DAYS = 30;
const DENSE_WINDOW_DAYS = 30;
const DENSE_EVENT_THRESHOLD = 4;

const normalizeTimestamp = (value?: string, precision: TimelineDatePrecision): number | undefined => {
  if (!value) return undefined;
  if (precision === 'day') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.getTime();
  }
  if (precision === 'month') {
    const date = new Date(`${value}-01`);
    return Number.isNaN(date.getTime()) ? undefined : date.getTime();
  }
  if (precision === 'year') {
    const date = new Date(`${value}-01-01`);
    return Number.isNaN(date.getTime()) ? undefined : date.getTime();
  }
  return undefined;
};

const shouldGroupEvents = (prev: InternalTimelineEvent, current: InternalTimelineEvent): boolean => {
  if (getSubject(prev.type) !== getSubject(current.type)) {
    return false;
  }
  if (prev.sortTimestamp === undefined || current.sortTimestamp === undefined) {
    return false;
  }
  const diff = Math.abs(prev.sortTimestamp - current.sortTimestamp);
  if (diff <= GROUPING_WINDOW_DAYS * MS_PER_DAY) {
    return true;
  }
  if (prev.datePrecision === 'year' && current.datePrecision === 'year' && prev.date === current.date) {
    return true;
  }
  if (prev.datePrecision === 'month' && current.datePrecision === 'month' && prev.date === current.date) {
    return true;
  }
  return false;
};

const isGenericDescription = (description: string, type: string): boolean => {
  const normalized = description.trim().toLowerCase();
  if (!normalized || normalized.length < 6) {
    return true;
  }
  if (type === 'EVENT') {
    return true;
  }
  return GENERIC_TERMS.some((term) => normalized === term || normalized.startsWith(`${term} `));
};

interface InternalTimelineEvent extends TimelineEvent {
  sortTimestamp?: number;
  references: TimelineReference[];
  orderIndexes: number[];
}

const attachHiddenReferences = (events: InternalTimelineEvent[]) => {
  const visible = events.filter((event) => !event.hidden);
  if (!visible.length) {
    return;
  }

  const findNearest = (event: InternalTimelineEvent): InternalTimelineEvent | null => {
    if (event.sortTimestamp === undefined) {
      return visible[0] ?? null;
    }
    let best: InternalTimelineEvent | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    visible.forEach((candidate) => {
      if (candidate.sortTimestamp === undefined) {
        return;
      }
      const diff = Math.abs(candidate.sortTimestamp - event.sortTimestamp);
      if (diff < bestDiff) {
        best = candidate;
        bestDiff = diff;
      }
    });
    return best ?? visible[0] ?? null;
  };

  events.forEach((event) => {
    if (!event.hidden) {
      return;
    }
    const target = findNearest(event);
    if (!target) {
      return;
    }
    target.references = [...(target.references ?? []), ...(event.references ?? [])];
  });
};

export const buildTimelineFromClaims = (
  claims: KnowledgeClaim[] = [],
): { events: TimelineEvent[]; flags: TimelineFlag[] } => {
  const flags: TimelineFlag[] = [];

  const baseEvents: InternalTimelineEvent[] = claims.map((claim, index) => {
    const parsed = parseDateFromClaim(claim);
    if (parsed.precision === 'unknown') {
      flags.push({
        code: 'EVENT_WITHOUT_DATE',
        message: `אירוע ללא תאריך (${claim.type ?? 'לא ידוע'})`,
        severity: 'info',
      });
    }
    const type = classifyEventType(claim);
    const description = (claim.value ?? claim.type ?? 'אירוע').trim() || 'אירוע';
    const sortTimestamp = parsed.sortTimestamp ?? normalizeTimestamp(parsed.value, parsed.precision);
    const evidenceQuality = claim.evidenceQuality ?? 'high';

    return {
      id: claim.id ?? randomUUID(),
      date: parsed.value,
      datePrecision: parsed.precision,
      type,
      description,
      source: claim.source,
      sortTimestamp,
      aggregatedCount: 1,
      references: [
        {
          id: claim.id,
          description,
          source: claim.source,
        },
      ],
      orderIndexes: [index],
      hidden: isGenericDescription(description, type) || evidenceQuality === 'low',
    };
  });

  const datedEvents = baseEvents
    .filter((event) => event.sortTimestamp !== undefined)
    .sort((a, b) => (a.sortTimestamp! - b.sortTimestamp!));

  const groupedEvents: InternalTimelineEvent[] = [];
  datedEvents.forEach((event) => {
    const last = groupedEvents[groupedEvents.length - 1];
    if (last && shouldGroupEvents(last, event)) {
      last.description = `${last.description}\n• ${event.description}`;
      last.references = [...last.references, ...event.references];
      last.aggregatedCount = (last.aggregatedCount ?? 1) + (event.aggregatedCount ?? 1);
      last.orderIndexes.push(...event.orderIndexes);
      last.hidden = last.hidden && event.hidden;
      if (event.datePrecision === 'day' && last.datePrecision !== 'day') {
        last.date = event.date;
        last.datePrecision = 'day';
        last.sortTimestamp = event.sortTimestamp;
      }
    } else {
      groupedEvents.push({
        ...event,
        references: [...event.references],
        orderIndexes: [...event.orderIndexes],
      });
    }
  });

  const undatedEvents = baseEvents.filter((event) => event.sortTimestamp === undefined);

  const hasUndatedBetween = (prev: InternalTimelineEvent, next: InternalTimelineEvent): boolean => {
    const prevIndex = Math.min(...prev.orderIndexes);
    const nextIndex = Math.min(...next.orderIndexes);
    return baseEvents.some(
      (event) =>
        event.sortTimestamp === undefined &&
        event.orderIndexes[0] > prevIndex &&
        event.orderIndexes[0] < nextIndex,
    );
  };

  for (let i = 1; i < groupedEvents.length; i += 1) {
    const prev = groupedEvents[i - 1];
    const current = groupedEvents[i];
    if (prev.sortTimestamp === undefined || current.sortTimestamp === undefined) {
      continue;
    }
    const deltaDays = Math.round((current.sortTimestamp - prev.sortTimestamp) / MS_PER_DAY);
    if (deltaDays > DAYS_THRESHOLD) {
      const loweredSeverity = hasUndatedBetween(prev, current);
      flags.push({
        code: 'TIMELINE_GAP',
        message: `פער של ${deltaDays} ימים בין ${prev.date ?? 'תאריך לא ידוע'} ל-${current.date ?? 'תאריך לא ידוע'}`,
        severity: loweredSeverity ? 'info' : 'warning',
      });
    }
  }

  const datedForDensity = baseEvents
    .filter((event) => event.sortTimestamp !== undefined)
    .sort((a, b) => (a.sortTimestamp! - b.sortTimestamp!));
  for (let i = 0; i < datedForDensity.length; i += 1) {
    let count = 1;
    const start = datedForDensity[i];
    for (let j = i + 1; j < datedForDensity.length; j += 1) {
      const next = datedForDensity[j];
      if (next.sortTimestamp! - start.sortTimestamp! <= DENSE_WINDOW_DAYS * MS_PER_DAY) {
        count += 1;
      } else {
        break;
      }
    }
    if (count >= DENSE_EVENT_THRESHOLD) {
      flags.push({
        code: 'DENSE_PERIOD',
        message: `${count} אירועים בתוך ${DENSE_WINDOW_DAYS} ימים (מתחיל ב-${start.date ?? 'תאריך לא ידוע'})`,
        severity: 'warning',
      });
      break;
    }
  }

  const combinedEvents = [...groupedEvents, ...undatedEvents];
  attachHiddenReferences(combinedEvents);

  const finalEvents: TimelineEvent[] = combinedEvents.map((event) => ({
    id: event.id,
    date: event.date,
    datePrecision: event.datePrecision,
    type: event.type,
    description: event.description,
    source: event.source,
    references: event.references,
    aggregatedCount: event.aggregatedCount,
    hidden: event.hidden,
  }));

  const hiddenCount = finalEvents.filter((event) => event.hidden).length;
  if (finalEvents.length > 0 && hiddenCount / finalEvents.length > 0.3) {
    flags.push({
      code: 'TIMELINE_TOO_GENERIC',
      message: 'מעל 30% מהאירועים בציר הזמן הוגדרו כלליים או מוסתרים',
      severity: 'warning',
    });
  }

  return { events: finalEvents, flags };
};

