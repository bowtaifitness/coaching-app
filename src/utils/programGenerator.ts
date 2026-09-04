// Stub: swing fault type removed for general fitness fork
export interface SwingFault {
  id: string;
  label: string;
  detected: boolean;
  severity?: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description: string | null;
  instructions: string[] | null;
  video_url: string | null;
  body_regions: string[] | null;
  movement_patterns: string[] | null;
  tags: string[] | null;
  swing_faults?: string[] | null;
  physical_traits: string[] | null;
  equipment: string[] | null;
}

export interface PhaseExercise {
  exercise: Exercise;
  slotName: string;
  prescription: string;
  fixesFault?: string;
}

export interface WorkoutPhase {
  phaseNumber: 1 | 2 | 3 | 4;
  phaseName: string;
  duration: string;
  exercises: PhaseExercise[];
}

export interface MacrocycleBlock {
  blockNumber: 1 | 2 | 3 | 4;
  weeks: number[];
  workoutPhaseData: WorkoutPhase[];
  dailyVariations?: WorkoutPhase[][];
}

export interface Macrocycle {
  blocks: MacrocycleBlock[];
}

const FAULT_ID_TO_LABEL: Record<string, string> = {
  'early-extension': 'Early Extension',
  'loss-of-posture': 'Loss of Posture',
  'sway': 'Sway/Slide',
  'slide': 'Sway/Slide',
  'over-the-top': 'Over the Top',
  'over_the_top': 'Over the Top',
  'casting': 'Casting/Early Release',
  'chicken-wing': 'Chicken Wing',
  'reverse-spine-angle': 'Reverse Spine Angle',
  'flat-shoulder-plane': 'Flat Shoulder Plane',
  'flat_shoulder_plane': 'Flat Shoulder Plane',
  'c-posture': 'C-Posture',
  'c_posture': 'C-Posture',
  's-posture': 'S-Posture',
  's_posture': 'S-Posture',
};

export type EquipmentTier = 'bodyweight' | 'bands' | 'dumbbells' | 'full-gym';

const TIER_ALLOWED: Record<EquipmentTier, ReadonlyArray<string>> = {
  bodyweight: ['bodyweight'],
  bands: ['bodyweight', 'bands', 'trx'],
  dumbbells: ['bodyweight', 'bands', 'trx', 'dumbbell', 'med_ball'],
  'full-gym': [
    'bodyweight',
    'bands',
    'trx',
    'dumbbell',
    'kettlebell',
    'barbell',
    'cable',
    'machine',
    'med_ball',
  ],
};

const TIER_WEIGHTED: Record<EquipmentTier, ReadonlyArray<string>> = {
  bodyweight: [],
  bands: ['bands'],
  dumbbells: ['dumbbell', 'bands'],
  'full-gym': ['barbell', 'dumbbell', 'kettlebell'],
};

const TOTAL_BLOCKS = 4;

function faultLabels(detectedFaults: SwingFault[]): string[] {
  const labels = new Set<string>();
  for (const f of detectedFaults) {
    if (!f.detected) continue;
    const mapped = FAULT_ID_TO_LABEL[f.id] ?? f.label;
    if (mapped) labels.add(mapped);
  }
  return Array.from(labels);
}

function hasAny(arr: string[] | null | undefined, values: string[]): boolean {
  if (!arr || arr.length === 0) return false;
  return arr.some((v) => values.includes(v));
}

function isWeighted(ex: Exercise, weightedSet: Set<string>): boolean {
  if (weightedSet.size === 0) return false;
  return (ex.equipment ?? []).some((e) => weightedSet.has(e.toLowerCase()));
}

function passesEquipment(ex: Exercise, allowed: Set<string>): boolean {
  const eq = ex.equipment ?? [];
  if (eq.length === 0) return allowed.has('bodyweight');
  // An exercise is allowed only if every piece of required equipment is in the tier.
  return eq.every((e) => allowed.has(e.toLowerCase()));
}

interface Filter {
  category?: string;
  patterns?: string[];
  bodyRegions?: string[];
  faultLabel?: string;
  requireWeighted?: boolean;
}

function matches(ex: Exercise, f: Filter, weightedSet: Set<string>): boolean {
  if (f.category && ex.category !== f.category) return false;
  if (f.requireWeighted && !isWeighted(ex, weightedSet)) return false;
  if (f.patterns && f.patterns.length > 0 && !hasAny(ex.movement_patterns, f.patterns)) return false;
  if (f.bodyRegions && f.bodyRegions.length > 0 && !hasAny(ex.body_regions, f.bodyRegions)) return false;
  if (f.faultLabel && !(ex.tags ?? ex.swing_faults ?? []).includes(f.faultLabel)) return false;
  return true;
}

/**
 * Given a library and an ordered list of fallback filters, build a single ranked
 * pool of candidates. Earlier filters win, duplicates are removed, and the final
 * order is interleaved by body region so consecutive picks stress different
 * areas — that way assigning candidates 1..4 to four blocks in order yields a
 * balanced spread across muscle groups.
 */
function orderedPool(
  library: Exercise[],
  filters: Filter[],
  weightedSet: Set<string>
): Exercise[] {
  const seen = new Set<string>();
  const ranked: Exercise[] = [];
  for (const filter of filters) {
    for (const ex of library) {
      if (seen.has(ex.id)) continue;
      if (!matches(ex, filter, weightedSet)) continue;
      seen.add(ex.id);
      ranked.push(ex);
    }
  }
  return interleaveByBodyRegion(ranked);
}

function interleaveByBodyRegion(list: Exercise[]): Exercise[] {
  if (list.length <= 1) return list;
  const buckets = new Map<string, Exercise[]>();
  for (const ex of list) {
    const region = (ex.body_regions ?? [])[0] ?? '__none__';
    if (!buckets.has(region)) buckets.set(region, []);
    buckets.get(region)!.push(ex);
  }
  const queues = Array.from(buckets.values());
  const out: Exercise[] = [];
  while (out.length < list.length) {
    let pushedThisRound = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        pushedThisRound = true;
      }
    }
    if (!pushedThisRound) break;
  }
  return out;
}

interface SlotPicker {
  /**
   * Returns the next exercise to use for this slot in a given block, or null if
   * the library is too thin. Tracks both per-slot history (avoid re-using inside
   * the same slot across blocks) and global history (avoid the same exercise
   * appearing in two different slots in the same macrocycle).
   */
  next(blockNumber: number, globalUsed: Set<string>): { exercise: Exercise; matchedFault?: string } | null;

  /**
   * Pick N distinct exercises for this slot in a single block (one per day).
   * Falls back to repeating if the pool is too thin.
   */
  nextN(count: number, globalUsed: Set<string>): Array<{ exercise: Exercise; matchedFault?: string }>;
}

function makeSlotPicker(
  pools: Array<{ pool: Exercise[]; matchedFault?: string }>,
): SlotPicker {
  const slotUsed = new Set<string>();
  return {
    next(_blockNumber, globalUsed) {
      for (const { pool, matchedFault } of pools) {
        for (const ex of pool) {
          if (slotUsed.has(ex.id)) continue;
          if (globalUsed.has(ex.id)) continue;
          slotUsed.add(ex.id);
          globalUsed.add(ex.id);
          return { exercise: ex, matchedFault };
        }
      }
      for (const { pool, matchedFault } of pools) {
        for (const ex of pool) {
          if (slotUsed.has(ex.id)) continue;
          slotUsed.add(ex.id);
          return { exercise: ex, matchedFault };
        }
      }
      return null;
    },

    nextN(count, globalUsed) {
      const results: Array<{ exercise: Exercise; matchedFault?: string }> = [];
      const batchUsed = new Set<string>();

      // First pass: pick unique exercises respecting global uniqueness
      for (let i = 0; i < count; i++) {
        let picked = false;
        for (const { pool, matchedFault } of pools) {
          for (const ex of pool) {
            if (slotUsed.has(ex.id)) continue;
            if (globalUsed.has(ex.id)) continue;
            if (batchUsed.has(ex.id)) continue;
            slotUsed.add(ex.id);
            globalUsed.add(ex.id);
            batchUsed.add(ex.id);
            results.push({ exercise: ex, matchedFault });
            picked = true;
            break;
          }
          if (picked) break;
        }
        if (!picked) {
          // Relax global uniqueness, still avoid duplicates within this batch
          for (const { pool, matchedFault } of pools) {
            for (const ex of pool) {
              if (batchUsed.has(ex.id)) continue;
              if (slotUsed.has(ex.id)) continue;
              slotUsed.add(ex.id);
              batchUsed.add(ex.id);
              results.push({ exercise: ex, matchedFault });
              picked = true;
              break;
            }
            if (picked) break;
          }
        }
        // If still not picked, we'll handle below by cycling existing picks
      }

      // If we couldn't fill all days, cycle through what we did get
      if (results.length > 0 && results.length < count) {
        const base = results.length;
        while (results.length < count) {
          results.push(results[results.length % base]);
        }
      }

      return results;
    },
  };
}

interface SlotDefinition {
  phase: 1 | 2 | 3 | 4;
  slotName: string;
  prescription: string;
  picker: SlotPicker;
  carriesFaultBadge?: boolean;
}

function buildSlotDefinitions(
  library: Exercise[],
  faults: string[],
  weightedSet: Set<string>
): SlotDefinition[] {
  // When the tier has no weighted equipment (bodyweight only), Phase III
  // strength slots must not require weighted equipment — otherwise the slot
  // pool is empty and Phase III renders as "No matching exercises".
  const strengthRequiresWeighted = weightedSet.size > 0;
  const slots: SlotDefinition[] = [];
  const mkPool = (filters: Filter[]) => orderedPool(library, filters, weightedSet);

  // Phase I — Mobility & Reset
  slots.push({
    phase: 1,
    slotName: 'Soft Tissue',
    prescription: '2-3 mins',
    picker: makeSlotPicker([
      { pool: mkPool([{ category: 'Mobility/Reset', patterns: ['Locomotion'] }]) },
      { pool: mkPool([{ category: 'Mobility/Reset' }]) },
    ]),
  });

  // Phase I — Correctives. One slot per detected fault. Each slot is locked to
  // that specific fault and rotates through different exercises across blocks.
  // Falls back to general mobility correctives if needed.
  const correctiveCount = Math.max(faults.length, 1);
  for (let i = 0; i < correctiveCount; i++) {
    const fault = faults[i];
    const pools: Array<{ pool: Exercise[]; matchedFault?: string }> = [];
    if (fault) {
      pools.push({
        pool: mkPool([{ category: 'Mobility/Reset', faultLabel: fault }]),
        matchedFault: fault,
      });
    }
    pools.push({
      pool: mkPool([{ category: 'Mobility/Reset' }]),
    });
    slots.push({
      phase: 1,
      slotName: 'Corrective',
      prescription: '2 x 10 each side',
      picker: makeSlotPicker(pools),
      carriesFaultBadge: !!fault,
    });
  }

  // Phase I — Activation: glute-biased Hinge/Squat
  slots.push({
    phase: 1,
    slotName: 'Activation',
    prescription: '2 x 12',
    picker: makeSlotPicker([
      { pool: mkPool([{ patterns: ['Hinge', 'Squat'], bodyRegions: ['glutes'] }]) },
      { pool: mkPool([{ patterns: ['Hinge', 'Squat'] }]) },
    ]),
  });

  // Phase II — Speed & Power
  slots.push({
    phase: 2,
    slotName: 'Rotational Power',
    prescription: '3 x 5 each side',
    picker: makeSlotPicker([
      { pool: mkPool([{ category: 'Speed/Power', patterns: ['Rotation'] }]) },
    ]),
  });
  slots.push({
    phase: 2,
    slotName: 'Vertical / Linear Power',
    prescription: '3 x 5',
    picker: makeSlotPicker([
      { pool: mkPool([{ category: 'Speed/Power', patterns: ['Squat', 'Locomotion'] }]) },
    ]),
  });

  // Phase III — Primary Strength. CRITICAL: weighted only.
  slots.push({
    phase: 3,
    slotName: 'Knee Dominant',
    prescription: '3 x 6-8',
    picker: makeSlotPicker([
      {
        pool: mkPool([
          { category: 'Primary Strength', patterns: ['Squat'], requireWeighted: strengthRequiresWeighted },
        ]),
      },
      { pool: mkPool([{ category: 'Primary Strength', patterns: ['Squat'] }]) },
    ]),
  });
  slots.push({
    phase: 3,
    slotName: 'Hip Dominant',
    prescription: '3 x 6-8',
    picker: makeSlotPicker([
      {
        pool: mkPool([
          { category: 'Primary Strength', patterns: ['Hinge'], requireWeighted: strengthRequiresWeighted },
        ]),
      },
      { pool: mkPool([{ category: 'Primary Strength', patterns: ['Hinge'] }]) },
    ]),
  });
  slots.push({
    phase: 3,
    slotName: 'Push / Pull',
    prescription: '3 x 8-10',
    picker: makeSlotPicker([
      {
        pool: mkPool([
          { category: 'Primary Strength', patterns: ['Push', 'Pull'], requireWeighted: strengthRequiresWeighted },
        ]),
      },
      { pool: mkPool([{ category: 'Primary Strength', patterns: ['Push', 'Pull'] }]) },
    ]),
  });

  // Phase IV — Rotary Stability & Core. Anti-Rotation slot prefers a fault match.
  const antiRotationPools: Array<{ pool: Exercise[]; matchedFault?: string }> = [];
  for (const fault of faults) {
    antiRotationPools.push({
      pool: mkPool([
        { category: 'Rotary/Core', patterns: ['Anti-Rotation'], faultLabel: fault },
      ]),
      matchedFault: fault,
    });
  }
  antiRotationPools.push({
    pool: mkPool([{ category: 'Rotary/Core', patterns: ['Anti-Rotation'] }]),
  });
  slots.push({
    phase: 4,
    slotName: 'Anti-Rotation',
    prescription: '3 x 10 each side',
    picker: makeSlotPicker(antiRotationPools),
    carriesFaultBadge: faults.length > 0,
  });

  slots.push({
    phase: 4,
    slotName: 'Disassociation',
    prescription: '3 x 8 each side',
    picker: makeSlotPicker([
      { pool: mkPool([{ category: 'Rotary/Core', patterns: ['Rotation'] }]) },
    ]),
  });

  return slots;
}

const PHASE_META: Record<1 | 2 | 3 | 4, { name: string; duration: string }> = {
  1: { name: 'Mobility & Reset', duration: '10-15 min' },
  2: { name: 'Speed & Power', duration: '10 min' },
  3: { name: 'Primary Strength', duration: '20 min' },
  4: { name: 'Rotary Stability & Core', duration: '10 min' },
};

function buildPhasesForBlock(
  blockNumber: number,
  slots: SlotDefinition[],
  globalUsed: Set<string>
): WorkoutPhase[] {
  const phaseMap = new Map<1 | 2 | 3 | 4, PhaseExercise[]>([
    [1, []],
    [2, []],
    [3, []],
    [4, []],
  ]);

  for (const slot of slots) {
    const picked = slot.picker.next(blockNumber, globalUsed);
    if (!picked) continue;
    const list = phaseMap.get(slot.phase)!;
    list.push({
      exercise: picked.exercise,
      slotName: slot.slotName,
      prescription: slot.prescription,
      fixesFault:
        slot.carriesFaultBadge && picked.matchedFault ? picked.matchedFault : undefined,
    });
  }

  return ([1, 2, 3, 4] as const).map((n) => ({
    phaseNumber: n,
    phaseName: PHASE_META[n].name,
    duration: PHASE_META[n].duration,
    exercises: phaseMap.get(n)!,
  }));
}

function buildDailyVariationsForBlock(
  daysPerWeek: number,
  slots: SlotDefinition[],
  globalUsed: Set<string>
): WorkoutPhase[][] {
  // For each slot, pick `daysPerWeek` distinct exercises
  const slotPicks: Array<{
    slot: SlotDefinition;
    picks: Array<{ exercise: Exercise; matchedFault?: string }>;
  }> = [];

  for (const slot of slots) {
    const picks = slot.picker.nextN(daysPerWeek, globalUsed);
    slotPicks.push({ slot, picks });
  }

  // Build one WorkoutPhase[] per day
  const variations: WorkoutPhase[][] = [];
  for (let dayIdx = 0; dayIdx < daysPerWeek; dayIdx++) {
    const phaseMap = new Map<1 | 2 | 3 | 4, PhaseExercise[]>([
      [1, []],
      [2, []],
      [3, []],
      [4, []],
    ]);

    for (const { slot, picks } of slotPicks) {
      const pick = picks[dayIdx % picks.length];
      if (!pick) continue;
      phaseMap.get(slot.phase)!.push({
        exercise: pick.exercise,
        slotName: slot.slotName,
        prescription: slot.prescription,
        fixesFault:
          slot.carriesFaultBadge && pick.matchedFault ? pick.matchedFault : undefined,
      });
    }

    variations.push(
      ([1, 2, 3, 4] as const).map((n) => ({
        phaseNumber: n,
        phaseName: PHASE_META[n].name,
        duration: PHASE_META[n].duration,
        exercises: phaseMap.get(n)!,
      }))
    );
  }

  return variations;
}

/**
 * Build a 12-week macrocycle of 4 progressive 3-week blocks. Each training
 * slot rotates through distinct exercises across the blocks. When daysPerWeek > 1,
 * each day within a block gets a different workout variation so exercises vary
 * day-to-day. Phase III stays strictly weighted. Phase I correctives and Phase IV
 * anti-rotation prioritise the user's detected weaknesses.
 */
export function generate12WeekMacrocycle(
  detectedFaults: SwingFault[],
  exerciseLibrary: Exercise[],
  options?: { equipmentTier?: EquipmentTier; daysPerWeek?: number }
): Macrocycle {
  const tier: EquipmentTier = options?.equipmentTier ?? 'full-gym';
  const daysPerWeek = Math.max(1, Math.min(5, options?.daysPerWeek ?? 1));
  const allowed = new Set(TIER_ALLOWED[tier]);
  const weightedSet = new Set(TIER_WEIGHTED[tier]);
  const filteredLibrary = exerciseLibrary.filter((ex) => passesEquipment(ex, allowed));

  const faults = faultLabels(detectedFaults);
  const slots = buildSlotDefinitions(filteredLibrary, faults, weightedSet);

  const globalUsed = new Set<string>();
  const blocks: MacrocycleBlock[] = [];
  for (let i = 0; i < TOTAL_BLOCKS; i++) {
    const blockNumber = (i + 1) as 1 | 2 | 3 | 4;
    const weekStart = i * 3 + 1;

    if (daysPerWeek <= 1) {
      const blockUsed = new Set<string>();
      const phases = buildPhasesForBlock(blockNumber, slots, blockUsed);
      blocks.push({
        blockNumber,
        weeks: [weekStart, weekStart + 1, weekStart + 2],
        workoutPhaseData: phases,
      });
    } else {
      const dailyVariations = buildDailyVariationsForBlock(daysPerWeek, slots, globalUsed);
      blocks.push({
        blockNumber,
        weeks: [weekStart, weekStart + 1, weekStart + 2],
        workoutPhaseData: dailyVariations[0],
        dailyVariations,
      });
    }
  }

  return { blocks };
}

export function macrocycleBlockPhases(
  macro: Macrocycle,
  blockNumber: number
): WorkoutPhase[] {
  const block = macro.blocks.find((b) => b.blockNumber === blockNumber);
  return block?.workoutPhaseData ?? [];
}
