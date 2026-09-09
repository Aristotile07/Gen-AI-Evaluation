import { startOfDay, endOfDay, subDays, startOfMonth, parseISO, isValid } from 'date-fns';

export type RangePreset = 'today' | 'week' | 'month' | 'all' | 'custom';

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

/**
 * Resolve a preset to an ISO {from,to} window.
 * - `{}` means "all time" (no bounds)
 * - `null` means "custom range is incomplete — don't query yet"
 */
export function resolveRange(
  preset: RangePreset,
  customFrom = '',
  customTo = ''
): { from?: string; to?: string } | null {
  const now = new Date();
  if (preset === 'today') return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (preset === 'week') return { from: subDays(now, 7).toISOString(), to: now.toISOString() };
  if (preset === 'month') return { from: startOfMonth(now).toISOString(), to: now.toISOString() };
  if (preset === 'custom') {
    const f = customFrom ? parseISO(customFrom) : null;
    const t = customTo ? parseISO(customTo) : null;
    if (f && isValid(f) && t && isValid(t)) {
      return { from: startOfDay(f).toISOString(), to: endOfDay(t).toISOString() };
    }
    return null;
  }
  return {}; // all time
}

export function rangeToQuery(range: { from?: string; to?: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (range.from) p.set('from', range.from);
  if (range.to) p.set('to', range.to);
  return p;
}
