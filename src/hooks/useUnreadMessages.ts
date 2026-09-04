import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '../lib/capacitor-shim';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Fetch initial unread count
    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    };

    fetchUnreadCount();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New message received
            setUnreadCount(prev => prev + 1);

            // Show browser notification if available and permission granted (web only)
            if (!Capacitor.isNativePlatform() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try {
                new Notification('New Message', {
                  body: 'You have received a new message'
                });
              } catch (error) {
                console.log('Notification error:', error);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // Message marked as read
            const newMessage = payload.new as any;
            if (newMessage.read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    // Clean up subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Request notification permission on first load (web only)
  useEffect(() => {
    if (user && !Capacitor.isNativePlatform() && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch (error) {
        console.log('Notification permission request failed:', error);
      }
    }
  }, [user]);

  return unreadCount;
};
