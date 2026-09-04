export const PROGRAM_TOTAL_WEEKS = 12;
export const BLOCK_LENGTH_WEEKS = 3;
export const PROGRAM_TOTAL_BLOCKS = PROGRAM_TOTAL_WEEKS / BLOCK_LENGTH_WEEKS;

export type ProgramStatus = 'active' | 'completed' | 'needs_assessment';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function calculateCurrentWeek(startDate: Date): number {
  if (!startDate || Number.isNaN(startDate.getTime())) return 1;
  const start = startOfDay(startDate);
  const today = startOfDay(new Date());
  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY);
  if (elapsedDays < 0) return 1;
  const week = Math.floor(elapsedDays / 7) + 1;
  if (week < 1) return 1;
  if (week > PROGRAM_TOTAL_WEEKS) return PROGRAM_TOTAL_WEEKS;
  return week;
}

export function calculateCurrentBlock(currentWeek: number): number {
  const w = Math.max(1, Math.min(PROGRAM_TOTAL_WEEKS, currentWeek));
  return Math.ceil(w / BLOCK_LENGTH_WEEKS);
}

export function isProgramComplete(startDate: Date): boolean {
  const start = startOfDay(startDate);
  const today = startOfDay(new Date());
  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY);
  return elapsedDays >= PROGRAM_TOTAL_WEEKS * 7;
}

export function deriveProgramStatus(
  startDate: Date,
  currentStatus: ProgramStatus
): ProgramStatus {
  if (currentStatus === 'needs_assessment') return 'needs_assessment';
  if (isProgramComplete(startDate)) return 'completed';
  return 'active';
}

export function buildBlockWeeks(blockNumber: number): number[] {
  const start = (blockNumber - 1) * BLOCK_LENGTH_WEEKS + 1;
  return [start, start + 1, start + 2];
}
