import React, { useEffect, useMemo } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Loader2,
  RotateCw,
  Sparkles,
  Target,
  Trophy,
  Wand2,
} from 'lucide-react';
import { useWorkoutStore } from '../../contexts/WorkoutContext';
import {
  PROGRAM_TOTAL_WEEKS,
  calculateCurrentBlock,
  calculateCurrentWeek,
} from '../../utils/programProgress';
import type { WorkoutPhase } from '../../utils/programGenerator';

interface UserDashboardProps {
  onNavigate?: (view: string) => void;
}

const BLOCK_MESSAGES: Record<number, string> = {
  1: 'Block 1: Build your foundation. Master the core movements over the next 3 weeks.',
  2: 'Block 2: Focus on mastering these variations for the next 3 weeks.',
  3: 'Block 3: Deepen your patterns and push intensity for the next 3 weeks.',
  4: 'Block 4: Peak phase. Sharpen power and rotational control before re-assessment.',
};

const PHASE_THEME: Record<
  number,
  { accent: string; pill: string; ring: string; icon: React.FC<{ className?: string }> }
> = {
  1: {
    accent: 'from-emerald-500 to-teal-500',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ring: 'ring-emerald-100',
    icon: Sparkles,
  },
  2: {
    accent: 'from-orange-500 to-amber-500',
    pill: 'bg-orange-50 text-orange-700 border-orange-200',
    ring: 'ring-orange-100',
    icon: Flame,
  },
  3: {
    accent: 'from-slate-700 to-slate-900',
    pill: 'bg-slate-100 text-slate-800 border-slate-200',
    ring: 'ring-slate-200',
    icon: Dumbbell,
  },
  4: {
    accent: 'from-cyan-500 to-blue-500',
    pill: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    ring: 'ring-cyan-100',
    icon: RotateCw,
  },
};

function toRoman(n: number): string {
  return ['I', 'II', 'III', 'IV'][n - 1] ?? String(n);
}

const UserDashboard: React.FC<UserDashboardProps> = ({ onNavigate }) => {
  const { program, loading, setProgramStatus } = useWorkoutStore();

  const computedWeek = useMemo(() => {
    if (!program) return 0;
    const elapsedWeek = calculateCurrentWeek(program.programStartDate);
    const start = new Date(program.programStartDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const elapsedDays = Math.floor(
      (today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    );
    const rawWeek = Math.floor(elapsedDays / 7) + 1;
    return rawWeek > PROGRAM_TOTAL_WEEKS ? rawWeek : elapsedWeek;
  }, [program]);

  useEffect(() => {
    if (!program) return;
    if (program.programStatus !== 'active') return;
    if (computedWeek > PROGRAM_TOTAL_WEEKS) {
      void setProgramStatus('needs_assessment');
    }
  }, [program, computedWeek, setProgramStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!program) {
    return <NoProgramState onNavigate={onNavigate} />;
  }

  if (program.programStatus === 'needs_assessment') {
    return <ReassessmentView onNavigate={onNavigate} />;
  }

  if (program.programStatus === 'completed') {
    return <ProgramCompletedView onNavigate={onNavigate} />;
  }

  const safeWeek = Math.max(1, Math.min(PROGRAM_TOTAL_WEEKS, program.currentWeek));
  const currentBlockNumber = calculateCurrentBlock(safeWeek);
  const currentBlock = program.blocks.find((b) => b.blockNumber === currentBlockNumber);
  const progressPct = Math.min(100, Math.round((safeWeek / PROGRAM_TOTAL_WEEKS) * 100));
  const blockMessage = BLOCK_MESSAGES[currentBlockNumber] ?? '';

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6">
      <ProgressHeader
        currentWeek={safeWeek}
        currentBlock={currentBlockNumber}
        progressPct={progressPct}
        blockMessage={blockMessage}
        startDate={program.programStartDate}
      />

      {currentBlock ? (
        <BlockWorkout
          blockNumber={currentBlockNumber}
          weeks={currentBlock.weeks}
          phases={currentBlock.workoutPhaseData}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            No workout data found for Block {currentBlockNumber}. Try regenerating your program.
          </p>
        </div>
      )}
    </div>
  );
};

interface ProgressHeaderProps {
  currentWeek: number;
  currentBlock: number;
  progressPct: number;
  blockMessage: string;
  startDate: Date;
}

const ProgressHeader: React.FC<ProgressHeaderProps> = ({
  currentWeek,
  currentBlock,
  progressPct,
  blockMessage,
  startDate,
}) => {
  const startLabel = startDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-slate-800 rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 sm:px-8 pt-6 pb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-400">
              Training Program
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1.5 leading-tight">
              Week {currentWeek} <span className="text-white/50 font-medium">of {PROGRAM_TOTAL_WEEKS}</span>
            </h1>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/60">
              <Calendar className="h-3.5 w-3.5" />
              <span>Started {startLabel}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-[11px] font-bold uppercase tracking-wider">
              <Target className="h-3 w-3" />
              Block {currentBlock} of 4
            </span>
            <span className="text-[11px] text-white/60">{progressPct}% complete</span>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((b) => {
              const reached = currentBlock >= b;
              const active = currentBlock === b;
              return (
                <div
                  key={b}
                  className={`text-[10px] font-bold uppercase tracking-wider py-1 text-center rounded
                    ${
                      active
                        ? 'bg-white text-gray-900'
                        : reached
                          ? 'text-teal-200'
                          : 'text-white/40'
                    }`}
                >
                  Block {b}
                </div>
              );
            })}
          </div>
        </div>

        {blockMessage && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <Wand2 className="h-4 w-4 text-teal-300 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-white/85 leading-snug">{blockMessage}</p>
          </div>
        )}
      </div>
    </section>
  );
};

interface BlockWorkoutProps {
  blockNumber: number;
  weeks: number[];
  phases: WorkoutPhase[];
}

const BlockWorkout: React.FC<BlockWorkoutProps> = ({ blockNumber, weeks, phases }) => {
  const totalMovements = phases.reduce((s, p) => s + p.exercises.length, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            Your Current Workout
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight mt-0.5">
            Block {blockNumber} - Weeks {weeks[0]}-{weeks[weeks.length - 1]}
          </h2>
        </div>
        <p className="text-[12px] text-gray-500">{totalMovements} movements - 4 phases</p>
      </div>

      {phases.map((phase) => {
        const theme = PHASE_THEME[phase.phaseNumber];
        const PhaseIcon = theme.icon;
        return (
          <article
            key={phase.phaseNumber}
            className={`bg-white rounded-2xl border border-gray-200 shadow-sm ring-1 ${theme.ring} overflow-hidden`}
          >
            <header
              className={`bg-gradient-to-r ${theme.accent} px-5 py-3 flex items-center justify-between`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
                  <PhaseIcon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                    Phase {toRoman(phase.phaseNumber)}
                  </p>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                    {phase.phaseName}
                  </h3>
                </div>
              </div>
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-white bg-white/15 backdrop-blur border border-white/20 px-2.5 py-1 rounded-full">
                <Clock className="h-3 w-3" />
                {phase.duration}
              </span>
            </header>
            <ul className="divide-y divide-gray-100">
              {phase.exercises.length === 0 ? (
                <li className="px-5 py-5 text-center text-[12px] text-gray-400">
                  No exercises in this phase yet.
                </li>
              ) : (
                phase.exercises.map((item, idx) => (
                  <li
                    key={`${phase.phaseNumber}-${idx}-${item.exercise.id}`}
                    className="px-5 py-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${theme.pill}`}
                          >
                            {item.slotName}
                          </span>
                          {item.fixesFault && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide
                                             text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
                              <Target className="h-2.5 w-2.5" />
                              Fixes {item.fixesFault}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1 leading-snug">
                          {item.exercise.name}
                        </p>
                        {item.exercise.description && (
                          <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">
                            {item.exercise.description}
                          </p>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-[11px] font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
                        {item.prescription}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </article>
        );
      })}
    </section>
  );
};

const NoProgramState: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => (
  <div className="max-w-2xl mx-auto px-4 py-16 text-center">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 mb-5">
      <Sparkles className="h-7 w-7 text-teal-600" />
    </div>
    <h2 className="text-2xl font-bold text-gray-900">Build your 12-week program</h2>
    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
      Your coach will assign a personalized training program based on your fitness goals and assessment.
    </p>
    <button
      onClick={() => onNavigate?.('workouts')}
      className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500
                 text-white text-sm font-bold shadow-sm transition-colors"
    >
      View Workouts
      <ArrowRight className="h-4 w-4" />
    </button>
  </div>
);

const ProgramCompletedView: React.FC<{ onNavigate?: (view: string) => void }> = ({
  onNavigate,
}) => (
  <ReassessmentView onNavigate={onNavigate} />
);

const ReassessmentView: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl shadow-xl overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-10 -left-10 h-48 w-48 rounded-full bg-white/40 blur-3xl" />
          <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-white/30 blur-3xl" />
        </div>

        <div className="relative px-6 sm:px-10 py-10 sm:py-12 text-white">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/20 backdrop-blur border border-white/30">
            <Trophy className="h-7 w-7 text-white" />
          </div>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
            Program Complete
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold leading-tight">
            Congratulations on completing 12 weeks!
          </h1>
          <p className="mt-4 text-[14px] sm:text-base leading-relaxed text-white/90 max-w-xl">
            Your body has adapted. It's time to reassess your progress and start your next
            training cycle.
          </p>

          <div className="mt-7">
            <button
              onClick={() => onNavigate?.('workouts')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-teal-700
                         hover:bg-teal-50 active:bg-teal-100 text-sm font-bold shadow-lg
                         transition-colors"
            >
              View Workouts
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            title: 'Re-measure',
            body: 'Log your updated metrics so your coach can spot what has changed since week 1.',
            Icon: Target,
          },
          {
            title: 'Adapt',
            body: 'Your next training cycle rotates fresh exercises matched to your updated goals.',
            Icon: Wand2,
          },
          {
            title: 'Progress',
            body: 'Build on the strength and mobility you have already earned with new variations.',
            Icon: CheckCircle2,
          },
        ].map(({ title, body, Icon }) => (
          <div
            key={title}
            className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
          >
            <div className="inline-flex h-9 w-9 rounded-lg bg-teal-50 border border-teal-100 items-center justify-center">
              <Icon className="h-4 w-4 text-teal-600" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-[12px] text-gray-600 leading-snug">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserDashboard;
