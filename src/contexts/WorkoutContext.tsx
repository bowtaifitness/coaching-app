import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import type { WorkoutPhase } from '../utils/programGenerator';
import {
  calculateCurrentBlock,
  calculateCurrentWeek,
  deriveProgramStatus,
  PROGRAM_TOTAL_BLOCKS,
  buildBlockWeeks,
  type ProgramStatus,
} from '../utils/programProgress';

export interface WorkoutBlock {
  blockNumber: 1 | 2 | 3 | 4;
  weeks: number[];
  workoutPhaseData: WorkoutPhase[];
}

export interface WorkoutProgram {
  id: string;
  userId: string;
  programStartDate: Date;
  currentWeek: number;
  blocks: WorkoutBlock[];
  programStatus: ProgramStatus;
}

interface WorkoutContextValue {
  program: WorkoutProgram | null;
  loading: boolean;
  error: string | null;
  currentBlock: number;
  refresh: () => Promise<void>;
  startProgram: (
    blocks: WorkoutBlock[],
    options?: { startDate?: Date; replaceExisting?: boolean }
  ) => Promise<WorkoutProgram | null>;
  setProgramStatus: (status: ProgramStatus) => Promise<void>;
}

const WorkoutContext = createContext<WorkoutContextValue | undefined>(undefined);

export const useWorkoutStore = (): WorkoutContextValue => {
  const ctx = useContext(WorkoutContext);
  if (!ctx) {
    throw new Error('useWorkoutStore must be used within a WorkoutProvider');
  }
  return ctx;
};

interface DbProgramRow {
  id: string;
  user_id: string;
  program_start_date: string;
  current_week: number;
  program_status: ProgramStatus;
  blocks: WorkoutBlock[] | null;
}

function rowToProgram(row: DbProgramRow): WorkoutProgram {
  return {
    id: row.id,
    userId: row.user_id,
    programStartDate: new Date(`${row.program_start_date}T00:00:00`),
    currentWeek: row.current_week,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    programStatus: row.program_status,
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const syncProgress = useCallback(
    async (row: DbProgramRow): Promise<WorkoutProgram> => {
      const base = rowToProgram(row);
      const computedWeek = calculateCurrentWeek(base.programStartDate);
      const computedStatus = deriveProgramStatus(base.programStartDate, base.programStatus);

      const needsUpdate =
        computedWeek !== base.currentWeek || computedStatus !== base.programStatus;

      if (!needsUpdate) return base;

      const { data: updated, error: updateError } = await supabase
        .from('swing_programs')
        .update({
          current_week: computedWeek,
          program_status: computedStatus,
        })
        .eq('id', base.id)
        .select('id, user_id, program_start_date, current_week, program_status, blocks')
        .maybeSingle();

      if (updateError || !updated) {
        return { ...base, currentWeek: computedWeek, programStatus: computedStatus };
      }
      return rowToProgram(updated as DbProgramRow);
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!userId) {
      setProgram(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('swing_programs')
      .select('id, user_id, program_start_date, current_week, program_status, blocks')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to load swing program', fetchError);
      setError(fetchError.message);
      setProgram(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setProgram(null);
      setLoading(false);
      return;
    }

    const synced = await syncProgress(data as DbProgramRow);
    setProgram(synced);
    setLoading(false);
  }, [userId, syncProgress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startProgram = useCallback(
    async (
      blocks: WorkoutBlock[],
      options?: { startDate?: Date; replaceExisting?: boolean }
    ): Promise<WorkoutProgram | null> => {
      if (!userId) {
        setError('You must be signed in to start a program.');
        return null;
      }
      if (blocks.length !== PROGRAM_TOTAL_BLOCKS) {
        console.warn(
          `Expected ${PROGRAM_TOTAL_BLOCKS} blocks, received ${blocks.length}. Continuing anyway.`
        );
      }

      const normalisedBlocks: WorkoutBlock[] = blocks.map((b, idx) => ({
        blockNumber: (b.blockNumber ?? idx + 1) as WorkoutBlock['blockNumber'],
        weeks: b.weeks?.length ? b.weeks : buildBlockWeeks(idx + 1),
        workoutPhaseData: b.workoutPhaseData ?? [],
      }));

      const startDate = options?.startDate ?? new Date();
      const isoStart = toIsoDate(startDate);

      if (options?.replaceExisting) {
        await supabase
          .from('swing_programs')
          .update({ program_status: 'completed' })
          .eq('user_id', userId)
          .eq('program_status', 'active');
      }

      const { data, error: insertError } = await supabase
        .from('swing_programs')
        .insert({
          user_id: userId,
          program_start_date: isoStart,
          current_week: calculateCurrentWeek(startDate),
          program_status: 'active',
          blocks: normalisedBlocks,
        })
        .select('id, user_id, program_start_date, current_week, program_status, blocks')
        .maybeSingle();

      if (insertError || !data) {
        const message = insertError?.message ?? 'Failed to create program.';
        console.error('Failed to start swing program', insertError);
        setError(message);
        return null;
      }

      const created = rowToProgram(data as DbProgramRow);
      setProgram(created);
      return created;
    },
    [userId]
  );

  const setProgramStatus = useCallback(
    async (status: ProgramStatus) => {
      if (!program) return;
      const { data, error: updateError } = await supabase
        .from('swing_programs')
        .update({ program_status: status })
        .eq('id', program.id)
        .select('id, user_id, program_start_date, current_week, program_status, blocks')
        .maybeSingle();
      if (updateError || !data) {
        console.error('Failed to update program status', updateError);
        return;
      }
      setProgram(rowToProgram(data as DbProgramRow));
    },
    [program]
  );

  const currentBlock = useMemo(
    () => (program ? calculateCurrentBlock(program.currentWeek) : 0),
    [program]
  );

  const value = useMemo<WorkoutContextValue>(
    () => ({
      program,
      loading,
      error,
      currentBlock,
      refresh,
      startProgram,
      setProgramStatus,
    }),
    [program, loading, error, currentBlock, refresh, startProgram, setProgramStatus]
  );

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
};
