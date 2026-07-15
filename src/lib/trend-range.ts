import type { TrendPoint } from '@/src/types/admin';

export type TrendRangeKey = '24h' | '7d' | '30d';

export type TrendQueryRange = {
  start_date: string;
  end_date: string;
  granularity: 'day' | 'hour';
  timezone?: string;
};

export type TrendRange = {
  key: TrendRangeKey;
  query: TrendQueryRange;
  bucketKeys: string[];
};

const TREND_NUMBER_FIELDS = [
  'requests',
  'input_tokens',
  'output_tokens',
  'cache_creation_tokens',
  'cache_read_tokens',
  'total_tokens',
  'cost',
  'actual_cost',
] as const;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatLocalDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function formatLocalHour(value: Date) {
  return `${formatLocalDate(value)} ${pad(value.getHours())}:00`;
}

function getLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function createTrendRange(key: TrendRangeKey, now = new Date()): TrendRange {
  const end = new Date(now);
  const bucketKeys: string[] = [];

  if (key === '24h') {
    end.setMinutes(0, 0, 0);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);

    for (let index = 0; index <= end.getHours(); index += 1) {
      const bucket = new Date(start);
      bucket.setHours(index);
      bucketKeys.push(formatLocalHour(bucket));
    }

    return {
      key,
      query: {
        start_date: formatLocalDate(start),
        end_date: formatLocalDate(end),
        granularity: 'hour',
        timezone: getLocalTimeZone(),
      },
      bucketKeys,
    };
  }

  end.setHours(0, 0, 0, 0);
  const days = key === '30d' ? 30 : 7;
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  for (let index = 0; index < days; index += 1) {
    const bucket = new Date(start);
    bucket.setDate(start.getDate() + index);
    bucketKeys.push(formatLocalDate(bucket));
  }

  return {
    key,
    query: {
      start_date: formatLocalDate(start),
      end_date: formatLocalDate(end),
      granularity: 'day',
      timezone: getLocalTimeZone(),
    },
    bucketKeys,
  };
}

function getBucketKey(value: string, granularity: TrendQueryRange['granularity']) {
  const trimmed = value.trim();

  if (granularity === 'hour') {
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2})/);
    return match ? `${match[1]} ${match[2]}:00` : null;
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function emptyTrendPoint(date: string): TrendPoint {
  return {
    date,
    requests: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
    total_tokens: 0,
    cost: 0,
    actual_cost: 0,
  };
}

export function fillTrendRange(points: TrendPoint[], range: TrendRange) {
  const byBucket = new Map<string, TrendPoint>();

  points.forEach((point) => {
    const bucketKey = getBucketKey(point.date, range.query.granularity);
    if (!bucketKey || !range.bucketKeys.includes(bucketKey)) return;

    const merged = byBucket.get(bucketKey) ?? emptyTrendPoint(bucketKey);
    TREND_NUMBER_FIELDS.forEach((field) => {
      merged[field] += Number(point[field] ?? 0);
    });
    byBucket.set(bucketKey, merged);
  });

  return range.bucketKeys.map((bucketKey) => byBucket.get(bucketKey) ?? emptyTrendPoint(bucketKey));
}

export function formatTrendLabel(value: string, granularity: TrendQueryRange['granularity']) {
  return granularity === 'hour' ? value.slice(11, 16) : value.slice(5, 10);
}
