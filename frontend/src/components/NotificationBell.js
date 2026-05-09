import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from '@phosphor-icons/react';
import api from '../utils/api';

const NotificationBell = ({ user, ws }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => { loadUnread(); }, []);

  useEffect(() => {
    if (!ws) return;
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          setUnreadCount(prev => prev + 1);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('BISD HUB', {
              body: data.notification?.content || 'New notification',
              icon: '/bisdhub-logo.png'
            });
          }
        }
      } catch {}
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws]);

  const loadUnread = async () => {
    try {
      const r = await api.get('/notifications?limit=50');
      setUnreadCount((r.data || []).filter(n => !n.read).length);
    } catch {}
  };

  return (
    <button
      data-testid="notification-bell"
      onClick={() => navigate('/notifications')}
      className="relative p-2 rounded-lg hover:bg-black/5 transition-colors"
      style={{ color: 'var(--text-1)' }}
      title="Notifications"
    >
      <Bell size={22} weight={unreadCount > 0 ? 'fill' : 'bold'} />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 text-[9px] font-black text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center"
          style={{ background: '#FF6B6B' }}
          data-testid="notification-count"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
