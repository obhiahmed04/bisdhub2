import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Bell } from '@phosphor-icons/react';
import api from '../utils/api';

const NotificationBell = ({ user, ws }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { loadNotifications(); }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!ws) return;
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('BISD HUB', { body: data.notification.content, icon: '/bisdhub-logo.png' });
          }
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws]);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications?limit=20');
      setNotifications(response.data);
      setUnreadCount(response.data.filter(n => !n.read).length);
    } catch (error) { console.error('Failed to load notifications'); }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(notifications.filter(n => !n.read).map(n => api.put(`/notifications/${n.notification_id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const markAsRead = async (notif) => {
    try {
      await api.put(`/notifications/${notif.notification_id}/read`);
      setNotifications(prev => prev.map(n => n.notification_id === notif.notification_id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {}

    setShowDropdown(false);
    if (notif.target_url) {
      navigate(notif.target_url);
    } else if (notif.post_id) {
      navigate('/');
    } else if (notif.type === 'follow' || notif.type === 'friend_request' || notif.type === 'friend_accept') {
      try {
        const res = await api.get(`/users/by-id/${notif.from_user_id}`);
        if (res.data?.id_number) navigate(`/profile/${res.data.id_number}`);
      } catch (e) { navigate('/settings'); }
    } else if (notif.type === 'dm') {
      navigate('/');
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const getNotifIcon = (type) => {
    switch(type) {
      case 'like': return '❤';
      case 'comment': return '💬';
      case 'follow': return '👤';
      case 'friend_request': return '🤝';
      case 'friend_accept': return '✓';
      case 'dm': return '✉';
      default: return '•';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setShowDropdown(!showDropdown)} className="relative p-2 rounded-lg hover:bg-black/5 transition-colors"
        style={{ color: 'var(--text-1)' }} data-testid="notification-bell">
        <Bell size={20} weight={unreadCount > 0 ? 'fill' : 'bold'} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[16px] text-center animate-pulse"
            style={{ background: '#FF6B6B' }} data-testid="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowDropdown(false)} />
          
          {/* Dropdown */}
          <div data-testid="notification-dropdown"
            className="fixed md:absolute right-2 md:right-0 top-14 md:top-full md:mt-2 z-50 w-[calc(100vw-1rem)] md:w-80 max-w-sm rounded-xl overflow-hidden"
            style={{ 
              background: 'var(--bg-card, white)', 
              border: '2px solid #111111',
              boxShadow: '4px 4px 0px 0px rgba(17,17,17,1)'
            }}>
            
            {/* Header */}
            <div className="p-3 flex items-center justify-between" style={{ borderBottom: '2px solid #111111' }}>
              <h3 className="text-sm font-black" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-1, #111)' }}>Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-black/5" 
                  style={{ color: '#2563EB' }} data-testid="mark-all-read">
                  Mark all read
                </button>
              )}
            </div>
            
            <ScrollArea className="max-h-72">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell size={32} weight="thin" className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs" style={{ color: 'var(--text-3, #999)' }}>No notifications yet</p>
                </div>
              ) : (
                <div>
                  {notifications.map((notif) => (
                    <button key={notif.notification_id} data-testid={`notification-${notif.notification_id}`}
                      onClick={() => markAsRead(notif)}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-black/5 transition-colors"
                      style={{ 
                        borderBottom: '1px solid var(--border, #eee)', 
                        background: notif.read ? 'transparent' : 'rgba(37, 99, 235, 0.04)' 
                      }}>
                      <span className="text-sm mt-0.5 flex-shrink-0 w-5 text-center">{getNotifIcon(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-1, #111)' }}>{notif.content}</p>
                        <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--text-3, #999)' }}>{formatTime(notif.created_at)}</p>
                      </div>
                      {!notif.read && <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#2563EB' }} />}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
