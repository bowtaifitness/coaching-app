import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PerformanceChartProps {
  data: Array<{
    date: string;
    value: number;
    notes?: string;
  }>;
  metric: {
    id: string;
    label: string;
    unit: string;
    color: string;
  };
  stats: {
    average: number;
    best: number;
    improvement: number;
  };
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, metric, stats }) => {
  const chartRef = useRef<ChartJS<'line'>>(null);

  const getColorByMetric = (color: string) => {
    const colors = {
      blue: { primary: 'rgb(59, 130, 246)', secondary: 'rgba(59, 130, 246, 0.1)' },
      green: { primary: 'rgb(34, 197, 94)', secondary: 'rgba(34, 197, 94, 0.1)' },
      purple: { primary: 'rgb(147, 51, 234)', secondary: 'rgba(147, 51, 234, 0.1)' },
      orange: { primary: 'rgb(249, 115, 22)', secondary: 'rgba(249, 115, 22, 0.1)' },
      red: { primary: 'rgb(239, 68, 68)', secondary: 'rgba(239, 68, 68, 0.1)' },
      indigo: { primary: 'rgb(99, 102, 241)', secondary: 'rgba(99, 102, 241, 0.1)' }
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const colors = getColorByMetric(metric.color);

  // Prepare chart data
  const chartData = {
    labels: data.slice().reverse().map(entry => new Date(entry.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })),
    datasets: [
      {
        label: metric.label,
        data: data.slice().reverse().map(entry => entry.value),
        borderColor: colors.primary,
        backgroundColor: colors.secondary,
        borderWidth: 3,
        pointBackgroundColor: colors.primary,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        fill: true,
        tension: 0.4,
      },
      // Average line
      {
        label: 'Average',
        data: Array(data.length).fill(stats.average),
        borderColor: 'rgba(156, 163, 175, 0.8)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '500' as const,
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: colors.primary,
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex;
            const reversedData = data.slice().reverse();
            return new Date(reversedData[index].date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          },
          label: (context: any) => {
            const value = context.parsed.y;
            const index = context.dataIndex;
            const reversedData = data.slice().reverse();
            const entry = reversedData[index];
            
            let label = `${metric.label}: ${value} ${metric.unit}`;
            
            if (entry.notes) {
              label += `\nNotes: ${entry.notes}`;
            }
            
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
        ticks: {
          font: {
            size: 11,
          },
          maxRotation: 45,
        }
      },
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
        ticks: {
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return `${value} ${metric.unit}`;
          }
        }
      },
    },
    elements: {
      point: {
        hoverBorderWidth: 3,
      }
    }
  };

  const getTrendIcon = () => {
    if (stats.improvement > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (stats.improvement < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getTrendColor = () => {
    if (stats.improvement > 0) return 'text-green-600';
    if (stats.improvement < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{metric.label} Progress</h3>
          <p className="text-sm text-gray-600">{data.length} data points</p>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="text-center">
            <p className="font-medium text-gray-900">{stats.average.toFixed(1)} {metric.unit}</p>
            <p className="text-xs text-gray-500">Average</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-green-600">{stats.best.toFixed(1)} {metric.unit}</p>
            <p className="text-xs text-gray-500">Best</p>
          </div>
          <div className="text-center">
            <div className={`flex items-center space-x-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="font-medium">
                {stats.improvement !== 0 ? (stats.improvement > 0 ? '+' : '') + stats.improvement.toFixed(1) : '0'}%
              </span>
            </div>
            <p className="text-xs text-gray-500">Trend</p>
          </div>
        </div>
      </div>

      <div className="h-80">
        {data.length > 0 ? (
          <Line ref={chartRef} data={chartData} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No data available for {metric.label}</p>
              <p className="text-sm text-gray-400">Add your first entry to see the chart</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceChart;