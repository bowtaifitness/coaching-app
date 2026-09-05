import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageCircle, X } from 'lucide-react';

interface MessageNotificationProps {
  onMessageClick?: () => void;
}

const MessageNotification: React.FC<MessageNotificationProps> = ({ onMessageClick }) => {
  const { user } = useAuth();
  const [notification, setNotification] = useState<{
    senderName: string;
    message: string;
    timestamp: Date;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    // Subscribe to new messages
    const channel = supabase
      .channel('new-message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          const newMessage = payload.new as any;

          // Fetch sender details
          const { data: senderData } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', newMessage.sender_id)
            .maybeSingle();

          if (senderData) {
            setNotification({
              senderName: `${senderData.first_name} ${senderData.last_name}`,
              message: newMessage.content,
              timestamp: new Date()
            });

            // Auto-dismiss after 5 seconds
            setTimeout(() => {
              setNotification(null);
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!notification) return null;

  return (
    <div className="fixed top-20 right-4 z-50 animate-slide-in-right safe-right">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              New message from {notification.senderName}
            </p>
            <p className="text-sm text-gray-600 truncate mt-1">
              {notification.message}
            </p>
            {onMessageClick && (
              <button
                onClick={() => {
                  onMessageClick();
                  setNotification(null);
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
              >
                View message
              </button>
            )}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageNotification;
