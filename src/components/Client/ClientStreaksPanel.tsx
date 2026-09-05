import React, { useEffect, useMemo, useState } from 'react';
import { Flame, Trophy, CalendarDays, Loader2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  StreakProgressRow,
  daysAgoKey,
  summarizeProgress,
} from '../../lib/streaks';

interface ClientStreaksPanelProps {
  clientId: string;
  clientFirstName?: string;
}

const ClientStreaksPanel: React.FC<ClientStreaksPanelProps> = ({ clientId, clientFirstName }) => {
  const [rows, setRows] = useState<StreakProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('swing_training_progress')
        .select('plan_key, day_id, exercise_name, completed, completed_at, updated_at')
        .eq('user_id', clientId)
        .eq('completed', true)
        .order('completed_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load client streaks', error);
        setError('Unable to load streak data for this client.');
        setRows([]);
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const summary = useMemo(() => summarizeProgress(rows), [rows]);

  const last30 = useMemo(() => {
    const cells: { key: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const key = daysAgoKey(i);
      cells.push({ key, count: summary.perDay[key] ?? 0 });
    }
    return cells;
  }, [summary.perDay]);

  const recent = rows.slice(0, 10);
  const displayName = clientFirstName ? `${clientFirstName}'s` : "Client's";

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
        <Flame className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-gray-900">No streak activity yet</h3>
        <p className="text-sm text-gray-500 mt-1">
          {displayName} training plan completions will appear here once they check off their first exercise.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          iconClass="text-orange-600 bg-orange-50 ring-orange-200"
          label="Current streak"
          value={`${summary.current}`}
          unit={summary.current === 1 ? 'day' : 'days'}
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          iconClass="text-amber-600 bg-amber-50 ring-amber-200"
          label="Longest streak"
          value={`${summary.longest}`}
          unit={summary.longest === 1 ? 'day' : 'days'}
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          iconClass="text-blue-600 bg-blue-50 ring-blue-200"
          label="This week"
          value={`${summary.thisWeekCount}`}
          unit="moves"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          iconClass="text-blue-600 bg-blue-50 ring-blue-200"
          label="Last active"
          value={summary.lastCompletionAt
            ? new Date(summary.lastCompletionAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
            : '--'}
          unit=""
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Last 30 Days
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {summary.totalCompleted} total completions
            </p>
          </div>
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}
        >
          {last30.map((d) => {
            const intensity =
              d.count === 0
                ? 'bg-gray-100 border-gray-200'
                : d.count < 3
                ? 'bg-blue-200 border-blue-300'
                : d.count < 6
                ? 'bg-blue-400 border-blue-500'
                : 'bg-blue-600 border-blue-700';
            return (
              <div
                key={d.key}
                className={`aspect-square rounded-sm border ${intensity}`}
                title={`${d.key}: ${d.count} moves`}
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-gray-500">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
          <div className="w-3 h-3 rounded-sm bg-blue-200 border border-blue-300" />
          <div className="w-3 h-3 rounded-sm bg-blue-400 border border-blue-500" />
          <div className="w-3 h-3 rounded-sm bg-blue-600 border border-blue-700" />
          <span>More</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">
          Recent Completions
        </h3>
        <ul className="space-y-2">
          {recent.map((r, idx) => {
            const stamp = r.completed_at ?? r.updated_at;
            const when = stamp ? new Date(stamp) : null;
            return (
              <li
                key={`${r.plan_key}-${r.day_id}-${r.exercise_name}-${idx}`}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {r.exercise_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Day {r.day_id} &middot; {r.plan_key === 'baseline' ? 'Baseline plan' : 'Custom plan'}
                  </p>
                </div>
                {when && (
                  <span className="flex-shrink-0 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                    {when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  unit: string;
}> = ({ icon, iconClass, label, value, unit }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ring-1 ${iconClass}`}>
      {icon}
    </div>
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-3">{label}</p>
    <div className="flex items-baseline gap-1.5 mt-1">
      <span className="text-2xl font-bold text-gray-900 leading-none">{value}</span>
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  </div>
);

export default ClientStreaksPanel;
