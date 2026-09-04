import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, CreditCard as Edit3, Trash2, Calendar, Tag, Percent, Clock, Users, CheckCircle, XCircle } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  code: string | null;
  discount_type: 'percentage' | 'free_days';
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  created_at: string;
}

const PromotionsManagement: React.FC = () => {
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    discount_type: 'free_days' as 'percentage' | 'free_days',
    discount_value: 30,
    start_date: '',
    end_date: '',
    is_active: true,
    max_uses: ''
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const promotionData = {
        name: formData.name,
        code: formData.code || null,
        discount_type: formData.discount_type,
        discount_value: parseInt(formData.discount_value.toString()),
        start_date: fromEasternDateTimeLocal(formData.start_date),
        end_date: fromEasternDateTimeLocal(formData.end_date),
        is_active: formData.is_active,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        created_by: user?.id
      };

      if (editingPromotion) {
        const { error } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', editingPromotion.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('promotions')
          .insert([promotionData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingPromotion(null);
      resetForm();
      fetchPromotions();
    } catch (error) {
      console.error('Error saving promotion:', error);
      alert('Error saving promotion. Please try again.');
    }
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      code: promotion.code || '',
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      start_date: toEasternDateTimeLocal(promotion.start_date),
      end_date: toEasternDateTimeLocal(promotion.end_date),
      is_active: promotion.is_active,
      max_uses: promotion.max_uses?.toString() || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;

    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchPromotions();
    } catch (error) {
      console.error('Error deleting promotion:', error);
      alert('Error deleting promotion. Please try again.');
    }
  };

  const toggleActive = async (promotion: Promotion) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !promotion.is_active })
        .eq('id', promotion.id);

      if (error) throw error;
      fetchPromotions();
    } catch (error) {
      console.error('Error toggling promotion:', error);
      alert('Error updating promotion. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      discount_type: 'free_days',
      discount_value: 30,
      start_date: '',
      end_date: '',
      is_active: true,
      max_uses: ''
    });
  };

  const isPromotionActive = (promotion: Promotion) => {
    const now = new Date();
    const start = new Date(promotion.start_date);
    const end = new Date(promotion.end_date);
    return promotion.is_active && now >= start && now <= end;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  };

  const toEasternDateTimeLocal = (utcDateString: string) => {
    const utcDate = new Date(utcDateString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(utcDate);
    const partsMap: Record<string, string> = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        partsMap[part.type] = part.value;
      }
    });

    return `${partsMap.year}-${partsMap.month}-${partsMap.day}T${partsMap.hour}:${partsMap.minute}`;
  };

  const fromEasternDateTimeLocal = (dateTimeLocalString: string) => {
    const localDateStr = dateTimeLocalString.replace('T', ' ') + ':00';
    const easternDate = new Date(localDateStr + ' GMT-0500');

    const isDST = (date: Date) => {
      const jan = new Date(date.getFullYear(), 0, 1);
      const jul = new Date(date.getFullYear(), 6, 1);
      return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset()) !== date.getTimezoneOffset();
    };

    const testDate = new Date(dateTimeLocalString);
    const offset = isDST(testDate) ? -4 : -5;

    const [datePart, timePart] = dateTimeLocalString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    const utcDate = new Date(Date.UTC(year, month - 1, day, hours - offset, minutes));
    return utcDate.toISOString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promotions Management</h1>
          <p className="text-gray-600 mt-2">Create and manage sales and promotional offers</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingPromotion(null);
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Promotion
        </button>
      </div>

      <div className="grid gap-6">
        {promotions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Tag className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No promotions yet</h3>
            <p className="text-gray-600 mb-6">Create your first promotion to start offering sales and discounts.</p>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create First Promotion
            </button>
          </div>
        ) : (
          promotions.map((promotion) => {
            const active = isPromotionActive(promotion);
            const usageLimited = promotion.max_uses !== null;
            const usagePercentage = usageLimited
              ? (promotion.current_uses / promotion.max_uses!) * 100
              : 0;

            return (
              <div
                key={promotion.id}
                className={`bg-white rounded-lg shadow-lg border-2 ${
                  active ? 'border-green-500' : 'border-gray-200'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{promotion.name}</h3>
                        {active ? (
                          <span className="flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            ACTIVE NOW
                          </span>
                        ) : (
                          <span className="flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                            <XCircle className="h-3 w-3 mr-1" />
                            {promotion.is_active ? 'SCHEDULED' : 'DISABLED'}
                          </span>
                        )}
                      </div>
                      {promotion.code && (
                        <div className="flex items-center text-gray-600 mb-2">
                          <Tag className="h-4 w-4 mr-2" />
                          <span className="font-mono font-semibold">{promotion.code}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(promotion)}
                        className={`p-2 rounded-lg transition-colors ${
                          promotion.is_active
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={promotion.is_active ? 'Disable' : 'Enable'}
                      >
                        {promotion.is_active ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(promotion)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <Edit3 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(promotion.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center text-gray-700">
                      {promotion.discount_type === 'percentage' ? (
                        <>
                          <Percent className="h-5 w-5 mr-2 text-blue-600" />
                          <span className="font-semibold">{promotion.discount_value}% Off</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                          <span className="font-semibold">{promotion.discount_value} Free Days</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Clock className="h-5 w-5 mr-2 text-gray-600" />
                      <span className="text-sm">{formatDate(promotion.start_date)}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Clock className="h-5 w-5 mr-2 text-gray-600" />
                      <span className="text-sm">{formatDate(promotion.end_date)}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Users className="h-5 w-5 mr-2 text-gray-600" />
                      <span className="text-sm">
                        {promotion.current_uses} {usageLimited ? `/ ${promotion.max_uses}` : ''} uses
                      </span>
                    </div>
                  </div>

                  {usageLimited && (
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Usage</span>
                        <span>{usagePercentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
          <div className="modal-panel bg-white rounded-t-2xl sm:rounded-lg max-w-2xl w-full max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingPromotion ? 'Edit Promotion' : 'Create New Promotion'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Promotion Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Cyber Monday Sale"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Promo Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., CYBER2025"
                  />
                  <p className="text-sm text-gray-500 mt-1">Leave blank for automatic application</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Type
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discount_type: e.target.value as 'percentage' | 'free_days'
                      })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="free_days">Free Days (extends trial)</option>
                    <option value="percentage">Percentage Discount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.discount_type === 'percentage' ? 'Discount Percentage' : 'Number of Free Days'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={formData.discount_type === 'percentage' ? '100' : undefined}
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_value: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date & Time <span className="text-xs text-gray-500">(Eastern Time)</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date & Time <span className="text-xs text-gray-500">(Eastern Time)</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Uses (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave blank for unlimited uses"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Enable promotion immediately
                  </label>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingPromotion(null);
                      resetForm();
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingPromotion ? 'Update Promotion' : 'Create Promotion'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromotionsManagement;
