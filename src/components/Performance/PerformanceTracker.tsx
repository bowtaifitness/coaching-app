import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import PerformanceChart from './PerformanceChart';
import { TrendingUp, Target, Calendar, Plus, Loader, Users, Eye, BarChart3, User, Search } from 'lucide-react';

interface PerformanceMetric {
  id: string;
  client_id: string;
  date: string;
  max_pushups?: number;
  max_situps?: number;
  max_pullups?: number;
  max_squat?: number;
  max_bench?: number;
  max_deadlift?: number;
  mile_time?: number;
  plank_time?: number;
  weight?: number;
  body_fat_percentage?: number;
  resting_heart_rate?: number;

  sleep_hours?: number;
  notes?: string;
  created_at: string;
}

interface ClientPerformance {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  latest_metrics?: PerformanceMetric;
  total_entries: number;
  improvement_trend?: number;
  last_entry_date?: string;
}

const PerformanceTracker: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'gym' | 'lifestyle'>('gym');
  const [selectedMetric, setSelectedMetric] = useState('max_pushups');
  const [showAddForm, setShowAddForm] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>([]);
  const [clientsPerformance, setClientsPerformance] = useState<ClientPerformance[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientPerformance[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const performanceFormRef = useRef<HTMLFormElement>(null);

  const gymMetrics = [
    { id: 'max_pushups', label: 'Max Push-ups', unit: 'reps', icon: TrendingUp, color: 'blue' },
    { id: 'max_situps', label: 'Max Sit-ups', unit: 'reps', icon: TrendingUp, color: 'green' },
    { id: 'max_pullups', label: 'Max Pull-ups', unit: 'reps', icon: TrendingUp, color: 'purple' },
    { id: 'max_squat', label: 'Max Squat', unit: 'lbs', icon: Target, color: 'orange' },
    { id: 'max_bench', label: 'Max Bench Press', unit: 'lbs', icon: Target, color: 'red' },
    { id: 'max_deadlift', label: 'Max Deadlift', unit: 'lbs', icon: Target, color: 'indigo' },
    { id: 'plank_time', label: 'Plank Time', unit: 'sec', icon: TrendingUp, color: 'blue' },
    { id: 'mile_time', label: 'Mile Time', unit: 'min', icon: TrendingUp, color: 'green' }
  ];

  const lifestyleMetrics = [
    { id: 'weight', label: 'Weight', unit: 'lbs', icon: TrendingUp, color: 'blue' },
    { id: 'body_fat_percentage', label: 'Body Fat %', unit: '%', icon: Target, color: 'green' },
    { id: 'resting_heart_rate', label: 'Resting Heart Rate', unit: 'bpm', icon: TrendingUp, color: 'purple' },

    { id: 'sleep_hours', label: 'Sleep', unit: 'hours', icon: TrendingUp, color: 'red' }
  ];

  const metrics = activeTab === 'gym' ? gymMetrics : lifestyleMetrics;

  useEffect(() => {
    if (user?.role === 'coach' || user?.role === 'admin') {
      fetchClientsPerformance();
    } else {
      fetchPerformanceData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClient) {
      fetchClientPerformanceData(selectedClient);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (clientSearchTerm.trim() === '') {
      setFilteredClients(clientsPerformance);
    } else {
      const searchLower = clientSearchTerm.toLowerCase();
      const filtered = clientsPerformance.filter(client =>
        client.first_name.toLowerCase().includes(searchLower) ||
        client.last_name.toLowerCase().includes(searchLower) ||
        `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchLower)
      );
      setFilteredClients(filtered);
    }
  }, [clientSearchTerm, clientsPerformance]);

  const fetchClientsPerformance = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get all clients
      const { data: clients, error: clientsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('role', 'client')
        .order('first_name', { ascending: true });

      if (clientsError) throw clientsError;

      // For each client, get their performance summary
      const clientsWithPerformance = await Promise.all(
        (clients || []).map(async (client) => {
          // Get total entries count
          const { count: totalEntries } = await supabase
            .from('performance_metrics')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', client.id);

          // Get latest metrics
          const { data: latestMetrics } = await supabase
            .from('performance_metrics')
            .select('*')
            .eq('client_id', client.id)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...client,
            latest_metrics: latestMetrics,
            total_entries: totalEntries || 0,
            improvement_trend: 0,
            last_entry_date: latestMetrics?.date
          };
        })
      );

      setClientsPerformance(clientsWithPerformance);
    } catch (error) {
      console.error('Error fetching clients performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientPerformanceData = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: false });

      if (error) throw error;
      setPerformanceData(data || []);
    } catch (error) {
      console.error('Error fetching client performance data:', error);
    }
  };

  const fetchPerformanceData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('client_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setPerformanceData(data || []);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!performanceFormRef.current) return;

    const formData = new FormData(performanceFormRef.current);

    try {
      setSubmitting(true);
      
      // Prepare data for insertion
      const dataToInsert: any = {
        client_id: user.id,
        date: formData.get('date') as string,
        notes: (formData.get('notes') as string) || null
      };

      // Only include numeric fields that have values
      const numericFields = [
        'max_pushups', 'max_situps', 'max_pullups',
        'max_squat', 'max_bench', 'max_deadlift', 'mile_time', 'plank_time',
        'weight', 'body_fat_percentage', 'resting_heart_rate', 'sleep_hours'
      ];

      numericFields.forEach(field => {
        const value = formData.get(field) as string;
        if (value && value.trim() !== '') {
          let numValue = parseFloat(value);
          // Convert mile_time from minutes to seconds for storage
          if (field === 'mile_time') {
            numValue = numValue * 60;
          }
          dataToInsert[field] = numValue;
        }
      });

      const { error } = await supabase
        .from('performance_metrics')
        .insert([dataToInsert]);

      if (error) throw error;

      // Reset form and refresh data
      if (performanceFormRef.current) performanceFormRef.current.reset();
      setShowAddForm(false);
      fetchPerformanceData();
    } catch (error) {
      console.error('Error saving performance data:', error);
      alert('Error saving data. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [user]);

  const currentMetric = metrics.find(m => m.id === selectedMetric);
  const metricData = performanceData
    .filter(entry => entry[selectedMetric as keyof PerformanceMetric] != null)
    .map(entry => {
      let value = entry[selectedMetric as keyof PerformanceMetric] as number;
      // Convert mile_time from seconds to minutes for display
      if (selectedMetric === 'mile_time' && value) {
        value = value / 60;
      }
      return {
        date: entry.date,
        value: value,
        notes: entry.notes || ''
      };
    });

  const getMetricColor = (color: string) => {
    const colors = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
      indigo: 'bg-indigo-500'
    };
    return colors[color as keyof typeof colors] || 'bg-gray-500';
  };

  const calculateStats = () => {
    if (metricData.length === 0) return { average: 0, best: 0, improvement: 0 };
    
    const values = metricData.map(d => d.value);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const best = Math.max(...values);
    
    // Calculate improvement (compare first half vs second half of data)
    const midPoint = Math.floor(values.length / 2);
    if (midPoint === 0) return { average, best, improvement: 0 };
    
    const firstHalf = values.slice(midPoint);
    const secondHalf = values.slice(0, midPoint);
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    const improvement = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    return { average, best, improvement };
  };

  const stats = calculateStats();

  const renderAddMetricForm = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
        <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-6 w-full max-w-2xl sm:mx-4 max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Performance Data</h3>
          <form ref={performanceFormRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>

            {/* Gym Metrics Section */}
            <div className="border-t pt-4">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Gym Metrics</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Push-ups</label>
                    <input
                      name="max_pushups"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Sit-ups</label>
                    <input
                      name="max_situps"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Pull-ups</label>
                    <input
                      name="max_pullups"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Squat (lbs)</label>
                    <input
                      name="max_squat"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="225"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Bench (lbs)</label>
                    <input
                      name="max_bench"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="185"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Deadlift (lbs)</label>
                    <input
                      name="max_deadlift"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="315"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plank Time (seconds)</label>
                    <input
                      name="plank_time"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="90"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mile Time (minutes)</label>
                    <input
                      name="mile_time"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="7.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lifestyle Metrics Section */}
            <div className="border-t pt-4">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Lifestyle Metrics</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                    <input
                      name="weight"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="175"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body Fat %</label>
                    <input
                      name="body_fat_percentage"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="15.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resting HR (bpm)</label>
                    <input
                      name="resting_heart_rate"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sleep (hours)</label>
                    <input
                      name="sleep_hours"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="7.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                name="notes"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={2}
                placeholder="Weather conditions, equipment changes, workout notes..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                    Saving...
                  </>
                ) : (
                  'Save Data'
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading performance data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Coach/Admin view - Client performance dashboard
  if (user?.role === 'coach' || user?.role === 'admin') {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Client Performance Dashboard</h1>
          <p className="text-gray-600">Monitor and analyze your clients' fitness performance metrics at a glance.</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">{clientsPerformance.length}</p>
              </div>
              <div className="bg-blue-500 rounded-lg p-3">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Active Trackers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clientsPerformance.filter(c => c.total_entries > 0).length}
                </p>
              </div>
              <div className="bg-green-500 rounded-lg p-3">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clientsPerformance.reduce((sum, c) => sum + c.total_entries, 0)}
                </p>
              </div>
              <div className="bg-orange-500 rounded-lg p-3">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Client Performance Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Client Performance Overview</h3>
              <div className="text-sm text-gray-600">
                {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}
              </div>
            </div>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                placeholder="Search clients by name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
          <div className="p-6">
            {filteredClients.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredClients.map((client) => (
                  <div key={client.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {client.first_name[0]}{client.last_name[0]}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {client.first_name} {client.last_name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {client.total_entries} entries
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedClient(client.id)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {client.improvement_trend !== 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Improvement</span>
                          <span className={`font-medium ${
                            client.improvement_trend > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {client.improvement_trend > 0 ? '+' : ''}{client.improvement_trend.toFixed(1)}%
                          </span>
                        </div>
                      )}

                      {client.last_entry_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Last Entry</span>
                          <span className="text-sm text-gray-900">
                            {new Date(client.last_entry_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {client.total_entries === 0 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500">No performance data yet</p>
                        <p className="text-xs text-gray-400">Encourage client to start tracking</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                {clientSearchTerm ? (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No clients match your search</h3>
                    <p className="text-gray-600 mb-4">Try adjusting your search terms</p>
                    <button
                      onClick={() => setClientSearchTerm('')}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Clear Search
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
                    <p className="text-gray-600">Add clients to start tracking their performance.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Client Detail Modal */}
        {selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
            <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl w-full max-w-4xl sm:mx-4 max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {clientsPerformance.find(c => c.id === selectedClient)?.first_name} {clientsPerformance.find(c => c.id === selectedClient)?.last_name} - Performance Details
                  </h3>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {/* Tab Switcher */}
                <div className="flex space-x-2 mb-6 border-b border-gray-200">
                  <button
                    onClick={() => {
                      setActiveTab('gym');
                      setSelectedMetric('max_pushups');
                    }}
                    className={`px-6 py-3 font-medium transition-colors ${
                      activeTab === 'gym'
                        ? 'text-green-600 border-b-2 border-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Gym
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('lifestyle');
                      setSelectedMetric('weight');
                    }}
                    className={`px-6 py-3 font-medium transition-colors ${
                      activeTab === 'lifestyle'
                        ? 'text-green-600 border-b-2 border-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Lifestyle
                  </button>
                </div>

                {/* Metric Selector */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {metrics.map((metric) => (
                    <button
                      key={metric.id}
                      onClick={() => setSelectedMetric(metric.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all min-w-[100px] flex-1 basis-[calc(33.333%-0.5rem)] max-w-[calc(33.333%-0.5rem)] md:basis-[calc(16.666%-0.5rem)] md:max-w-[calc(16.666%-0.5rem)] ${
                        selectedMetric === metric.id
                          ? `border-${metric.color}-500 bg-${metric.color}-50`
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`${getMetricColor(metric.color)} rounded-md p-2 mb-1.5`}>
                        <metric.icon className="h-5 w-5 text-white" />
                      </div>
                      <p className="font-medium text-gray-900 text-xs text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">{metric.label}</p>
                    </button>
                  ))}
                </div>

                {/* Chart and Recent Data */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Chart Area */}
                  <div className="md:col-span-2 mb-6">
                    <PerformanceChart 
                      data={metricData}
                      metric={currentMetric || metrics[0]}
                      stats={stats}
                    />
                  </div>

                  {/* Recent Data */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Entries</h4>
                    <div className="space-y-4">
                      {metricData.slice(0, 5).map((entry, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {entry.value} {currentMetric?.unit}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(entry.date).toLocaleDateString()}
                            </p>
                            {entry.notes && (
                              <p className="text-xs text-gray-600 mt-1 truncate max-w-32" title={entry.notes}>
                                {entry.notes}
                              </p>
                            )}
                          </div>
                          <div className={`w-2 h-8 ${getMetricColor(currentMetric?.color || 'blue')} rounded-full`}></div>
                        </div>
                      ))}
                      {metricData.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No entries for {currentMetric?.label}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Summary */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-sm font-medium text-gray-600 mb-1">Current Average</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.average > 0 ? stats.average.toFixed(1) : '0'}
                      <span className="text-sm text-gray-500 ml-1">{currentMetric?.unit}</span>
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-sm font-medium text-gray-600 mb-1">Best Performance</p>
                    <p className="text-2xl font-bold text-green-600">
                      {stats.best > 0 ? stats.best.toFixed(1) : '0'}
                      <span className="text-sm text-gray-500 ml-1">{currentMetric?.unit}</span>
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-sm font-medium text-gray-600 mb-1">Improvement</p>
                    <p className={`text-2xl font-bold ${stats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.improvement !== 0 ? (stats.improvement > 0 ? '+' : '') + stats.improvement.toFixed(1) : '0'}
                      <span className="text-sm text-gray-500 ml-1">%</span>
                    </p>
                    <p className="text-xs text-gray-500">vs previous period</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Client view - Individual performance tracking
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Performance Tracker</h1>
          <p className="text-gray-600">Track your fitness performance metrics to monitor improvement over time.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Data
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex space-x-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => {
            setActiveTab('gym');
            setSelectedMetric('max_pushups');
          }}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'gym'
              ? 'text-green-600 border-b-2 border-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Gym
        </button>
        <button
          onClick={() => {
            setActiveTab('lifestyle');
            setSelectedMetric('weight');
          }}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'lifestyle'
              ? 'text-green-600 border-b-2 border-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Lifestyle
        </button>
      </div>

      {/* Metric Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {metrics.map((metric) => (
          <button
            key={metric.id}
            onClick={() => setSelectedMetric(metric.id)}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all min-w-[100px] flex-1 basis-[calc(33.333%-0.5rem)] max-w-[calc(33.333%-0.5rem)] md:basis-[calc(16.666%-0.5rem)] md:max-w-[calc(16.666%-0.5rem)] ${
              selectedMetric === metric.id
                ? `border-${metric.color}-500 bg-${metric.color}-50`
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className={`${getMetricColor(metric.color)} rounded-md p-2 mb-1.5`}>
              <metric.icon className="h-5 w-5 text-white" />
            </div>
            <p className="font-medium text-gray-900 text-xs text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">{metric.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Chart Area */}
        <div className="md:col-span-2">
          <PerformanceChart 
            data={metricData}
            metric={currentMetric || metrics[0]}
            stats={stats}
          />
        </div>

        {/* Recent Data */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Entries</h3>
          <div className="space-y-4">
            {metricData.slice(0, 5).map((entry, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {entry.value} {currentMetric?.unit}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.date).toLocaleDateString()}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-gray-600 mt-1 truncate max-w-32" title={entry.notes}>
                      {entry.notes}
                    </p>
                  )}
                </div>
                <div className={`w-2 h-8 ${getMetricColor(currentMetric?.color || 'blue')} rounded-full`}></div>
              </div>
            ))}
            {metricData.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No entries for {currentMetric?.label}</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-green-600 hover:text-green-700 text-sm mt-2"
                >
                  Add your first entry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm font-medium text-gray-600 mb-1">Current Average</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.average > 0 ? stats.average.toFixed(1) : '0'}
            <span className="text-sm text-gray-500 ml-1">{currentMetric?.unit}</span>
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm font-medium text-gray-600 mb-1">Best Performance</p>
          <p className="text-2xl font-bold text-green-600">
            {stats.best > 0 ? stats.best.toFixed(1) : '0'}
            <span className="text-sm text-gray-500 ml-1">{currentMetric?.unit}</span>
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm font-medium text-gray-600 mb-1">Improvement</p>
          <p className={`text-2xl font-bold ${stats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.improvement !== 0 ? (stats.improvement > 0 ? '+' : '') + stats.improvement.toFixed(1) : '0'}
            <span className="text-sm text-gray-500 ml-1">%</span>
          </p>
          <p className="text-xs text-gray-500">vs previous period</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm font-medium text-gray-600 mb-1">Data Points</p>
          <p className="text-2xl font-bold text-gray-900">{performanceData.length}</p>
          <p className="text-xs text-gray-500">total entries</p>
        </div>
      </div>

      {showAddForm && renderAddMetricForm()}
    </div>
  );
};

export default PerformanceTracker;