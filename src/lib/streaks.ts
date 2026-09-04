export interface StreakProgressRow {
  plan_key: string;
  day_id: number;
  exercise_name: string;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

export function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date().toISOString());
}

export function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d.toISOString());
}

export function computeStreaks(activeDays: Set<string>): { current: number; longest: number } {
  let current = 0;
  const today = todayKey();
  const yesterday = daysAgoKey(1);
  if (activeDays.has(today) || activeDays.has(yesterday)) {
    let cursor = activeDays.has(today) ? 0 : 1;
    while (activeDays.has(daysAgoKey(cursor))) {
      current += 1;
      cursor += 1;
    }
  }

  const sorted = Array.from(activeDays).sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const d = new Date(`${key}T00:00:00`);
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }
  return { current, longest };
}

export interface StreakSummary {
  current: number;
  longest: number;
  thisWeekCount: number;
  totalCompleted: number;
  activeDays: Set<string>;
  perDay: Record<string, number>;
  lastCompletionAt: string | null;
}

export function summarizeProgress(rows: StreakProgressRow[]): StreakSummary {
  const activeDays = new Set<string>();
  const perDay: Record<string, number> = {};
  let lastCompletionAt: string | null = null;

  for (const r of rows) {
    const stamp = r.completed_at ?? r.updated_at;
    if (!stamp) continue;
    const key = toDateKey(stamp);
    activeDays.add(key);
    perDay[key] = (perDay[key] ?? 0) + 1;
    if (!lastCompletionAt || stamp > lastCompletionAt) lastCompletionAt = stamp;
  }

  const { current, longest } = computeStreaks(activeDays);

  let thisWeekCount = 0;
  for (let i = 0; i < 7; i++) {
    thisWeekCount += perDay[daysAgoKey(i)] ?? 0;
  }

  return {
    current,
    longest,
    thisWeekCount,
    totalCompleted: rows.length,
    activeDays,
    perDay,
    lastCompletionAt,
  };
}
