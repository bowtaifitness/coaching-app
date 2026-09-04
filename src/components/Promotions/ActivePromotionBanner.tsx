import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Tag, Calendar, Percent, Sparkles } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  discount_type: 'percentage' | 'free_days';
  discount_value: number;
  end_date: string;
}

const ActivePromotionBanner: React.FC = () => {
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivePromotion();
  }, []);

  const fetchActivePromotion = async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_promotions');

      if (!error && data && data.length > 0) {
        setPromotion(data[0]);
      }
    } catch (error) {
      console.error('Error fetching active promotion:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !promotion) return null;

  const formatEndDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const hoursLeft = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (hoursLeft < 24) {
      return `Ends in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`;
    } else {
      return `Ends ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  };

  return (
    <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg overflow-hidden animate-pulse-slow">
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-5 w-5 text-blue-200" />
              <h3 className="text-white font-bold text-lg">
                {promotion.name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm">
              <div className="flex items-center gap-2">
                {promotion.discount_type === 'percentage' ? (
                  <>
                    <Percent className="h-4 w-4" />
                    <span className="font-semibold">{promotion.discount_value}% Off</span>
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    <span className="font-semibold">{promotion.discount_value} Free Days</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>{formatEndDate(promotion.end_date)}</span>
              </div>
            </div>
            <p className="text-white/90 text-sm mt-2">
              Sign up now to automatically claim this limited-time offer!
            </p>
          </div>
        </div>
      </div>
      <div className="bg-white/10 px-4 sm:px-6 py-2">
        <p className="text-white/80 text-xs text-center">
          This promotion will be automatically applied to your account when you sign up
        </p>
      </div>
    </div>
  );
};

export default ActivePromotionBanner;
