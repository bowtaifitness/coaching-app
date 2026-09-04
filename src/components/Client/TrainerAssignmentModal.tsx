import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserCheck, Users, X, Loader, CheckCircle, AlertCircle } from 'lucide-react';

interface TrainerAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  currentTrainerId?: string;
  onAssignmentComplete: () => void;
}

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  created_at: string;
}

const TrainerAssignmentModal: React.FC<TrainerAssignmentModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientName,
  currentTrainerId,
  onAssignmentComplete
}) => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>(currentTrainerId || '');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTrainers();
    }
  }, [isOpen]);

  const fetchTrainers = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: trainersData, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, created_at')
        .or('role.eq.coach,role.eq.admin')
        .order('first_name', { ascending: true });

      if (error) throw error;

      setTrainers(trainersData || []);
    } catch (err) {
      console.error('Error fetching trainers:', err);
      setError('Failed to load trainers');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignment = async () => {
    if (!selectedTrainerId) {
      setError('Please select a trainer');
      return;
    }

    try {
      setAssigning(true);
      setError('');

      // First, delete any existing assignments for this client to avoid unique constraint conflicts
      const { error: deleteError } = await supabase
        .from('coach_client_assignments')
        .delete()
        .eq('client_id', clientId);

      if (deleteError) throw deleteError;

      // Create new assignment record
      const { error: assignError } = await supabase
        .from('coach_client_assignments')
        .insert([{
          coach_id: selectedTrainerId,
          client_id: clientId,
          active: true,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          notes: `Assigned by admin on ${new Date().toLocaleDateString()}`
        }]);

      if (assignError) throw assignError;

      onAssignmentComplete();
      onClose();
    } catch (err) {
      console.error('Error assigning trainer:', err);
      
      // Provide more specific error messages
      if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
        setError('Assignment conflict detected. Please try again or contact support.');
      } else if (err.message?.includes('foreign key') || err.message?.includes('violates')) {
        setError('Invalid trainer or client selection. Please refresh and try again.');
      } else {
        setError(`Failed to assign trainer: ${err.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!currentTrainerId) return;

    const confirmed = window.confirm(
      `Are you sure you want to unassign the current trainer from ${clientName}?`
    );

    if (!confirmed) return;

    try {
      setAssigning(true);
      setError('');

      // Delete the assignment record entirely
      const { error } = await supabase
        .from('coach_client_assignments')
        .delete()
        .eq('client_id', clientId)
        .eq('coach_id', currentTrainerId);

      if (error) throw error;

      onAssignmentComplete();
      onClose();
    } catch (err) {
      console.error('Error unassigning trainer:', err);
      setError(`Failed to unassign trainer: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-6 w-full max-w-md sm:mx-4 max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Assign Trainer to {clientName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading trainers...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Trainer
              </label>
              <select
                value={selectedTrainerId}
                onChange={(e) => setSelectedTrainerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={assigning}
              >
                <option value="">-- Select a trainer --</option>
                {trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.first_name} {trainer.last_name}
                    {trainer.email && ` (${trainer.email})`}
                  </option>
                ))}
              </select>
            </div>

            {currentTrainerId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Current Assignment:</strong> This client is currently assigned to{' '}
                  {trainers.find(t => t.id === currentTrainerId)?.first_name}{' '}
                  {trainers.find(t => t.id === currentTrainerId)?.last_name}
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleAssignment}
                disabled={assigning || !selectedTrainerId}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2 inline" />
                    {currentTrainerId ? 'Reassign Trainer' : 'Assign Trainer'}
                  </>
                )}
              </button>
              
              {currentTrainerId && (
                <button
                  onClick={handleUnassign}
                  disabled={assigning}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Unassign
                </button>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                <strong>Note:</strong> Assigning a new trainer will automatically unassign the current trainer. 
                The client will be able to see workouts and communicate with their assigned trainer.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerAssignmentModal;