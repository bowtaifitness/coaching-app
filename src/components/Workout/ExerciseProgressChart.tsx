import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ExerciseHistoryEntry, ExercisePersonalBest } from '../../types/workoutLog';
import { Trophy, TrendingUp, Dumbbell, Calendar } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface ExerciseProgressChartProps {
  history: ExerciseHistoryEntry[];
  personalBest: ExercisePersonalBest | null;
  exerciseName: string;
}

const ExerciseProgressChart: React.FC<ExerciseProgressChartProps> = ({
  history,
  personalBest,
  exerciseName,
}) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No logged data yet for {exerciseName}</p>
      </div>
    );
  }

  const last10 = history.slice(-10);
  const labels = last10.map((e) =>
    new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );

  const weightData = {
    labels,
    datasets: [
      {
        label: 'Max Weight (lb)',
        data: last10.map((e) => e.max_weight || 0),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(34, 197, 94)',
      },
    ],
  };

  const volumeData = {
    labels,
    datasets: [
      {
        label: 'Total Volume (lb × reps)',
        data: last10.map((e) => e.total_volume || 0),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(59, 130, 246)',
      },
    ],
  };

  const rpeEntries = last10.filter((e) => e.avg_rpe !== null);
  const rpeData =
    rpeEntries.length > 1
      ? {
          labels: rpeEntries.map((e) =>
            new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          ),
          datasets: [
            {
              label: 'Avg RPE',
              data: rpeEntries.map((e) => e.avg_rpe ?? 0),
              borderColor: 'rgb(249, 115, 22)',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              tension: 0.4,
              fill: true,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: 'rgb(249, 115, 22)',
            },
          ],
        }
      : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const },
      title: { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: { font: { size: 11 } } },
      x: { ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 45 } },
    },
  };

  return (
    <div className="space-y-6">
      {/* Personal Bests */}
      {personalBest && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-900">Personal Bests</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Max Weight</p>
              <p className="text-xl font-bold text-gray-900">
                {personalBest.max_weight ? `${personalBest.max_weight}` : '—'}
              </p>
              <p className="text-[10px] text-gray-400">lb</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Max Reps</p>
              <p className="text-xl font-bold text-gray-900">
                {personalBest.max_reps_single_set || '—'}
              </p>
              <p className="text-[10px] text-gray-400">single set</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Max Volume</p>
              <p className="text-xl font-bold text-gray-900">
                {personalBest.max_volume_session || '—'}
              </p>
              <p className="text-[10px] text-gray-400">lb×reps</p>
            </div>
          </div>
        </div>
      )}

      {/* Weight Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <h4 className="text-sm font-semibold text-gray-700">Weight Progress</h4>
        </div>
        <div className="h-56 sm:h-64">
          <Line data={weightData} options={chartOptions} />
        </div>
      </div>

      {/* Volume Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Dumbbell className="h-4 w-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-700">Volume Progress</h4>
        </div>
        <div className="h-56 sm:h-64">
          <Line data={volumeData} options={chartOptions} />
        </div>
      </div>

      {/* RPE Chart */}
      {rpeData && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-orange-600" />
            <h4 className="text-sm font-semibold text-gray-700">RPE Trend</h4>
          </div>
          <div className="h-56 sm:h-64">
            <Line data={rpeData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Session History Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Session History</h4>
        <div className="space-y-2">
          {[...history].reverse().map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-sm"
            >
              <div>
                <p className="font-medium text-gray-900">{entry.workout_title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(entry.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{entry.max_weight || '—'}</p>
                  <p className="text-gray-400">lb</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">{entry.total_volume || '—'}</p>
                  <p className="text-gray-400">vol</p>
                </div>
                {entry.avg_rpe !== null && (
                  <div className="text-center">
                    <p className="font-bold text-orange-600">{entry.avg_rpe}</p>
                    <p className="text-gray-400">RPE</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExerciseProgressChart;
