import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, Bell, Heart, ChatCircle, UserPlus, Envelope, ArrowsClockwise, Trophy, Warning } from '@phosphor-icons/react';
import api from '../utils/api';

const ICONS = {
  like: <Heart size={18} weight="fill" className="text-red-400" />,
  comment: <ChatCircle size={18} weight="fill" className="text-blue-400" />,
  follow: <UserPlus size={18} weight="fill" className="text-green-400" />,
  follow_request: <UserPlus size={18} weight="fill" className="text-yellow-400" />,
  dm: <Envelope size={18} weight="fill" className="text-purple-400" />,
  repost: <ArrowsClockwise size={18} weight="fill" className="text-green-400" />,
  friend_request: <UserPlus size={18} weight="fill" className="text-teal-400" />,
  friend_accept: <UserPlus size={18} weight="fill" className="text-teal-400" />,
  mention: <span className="text-blue-400 font-black text-sm">@</span>,
  punishment: <Warning size={18} weight="fill" className="text-red-500" />,
};

const NotificationsPage = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const r = await api.get('/notifications?limit=50');
      setNotifications(r.data);
    } catch {}
    finally { setLoading(false); }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(notifications.filter(n => !n.read).map(n => api.put(`/notifications/${n.notification_id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const markRead = async (notif) => {
    try { await api.put(`/notifications/${notif.notification_id}/read`); } catch {}
    setNotifications(prev => prev.map(n => n.notification_id === notif.notification_id ? { ...n, read: true } : n));
    if (notif.target_url) navigate(notif.target_url);
    else if (notif.type === 'follow' || notif.type === 'follow_request' || notif.type === 'friend_request') {
      try {
        const r = await api.get(`/users/by-id/${notif.from_user_id}`);
        if (r.data?.id_number) navigate(`/profile/${r.data.id_number}`);
      } catch { navigate('/'); }
    } else if (notif.post_id || notif.type === 'like' || notif.type === 'comment' || notif.type === 'repost') {
      navigate('/');
    } else if (notif.type === 'dm') {
      navigate('/');
    }
  };

  const formatTime = (d) => {
    if (!d) return '';
    try {
      const diff = Math.floor((Date.now() - new Date(d)) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
      return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const FILTERS = ['all', 'like', 'comment', 'follow', 'dm', 'repost', 'friend_request'];
  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unread = notifications.filter(n => !n.read).length;

  const groupByDate = (notifs) => {
    const groups = {};
    notifs.forEach(n => {
      try {
        const d = new Date(n.created_at);
        const now = new Date();
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        const key = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : diffDays < 7 ? `${diffDays} days ago` : d.toLocaleDateString([], { month: 'long', day: 'numeric' });
        if (!groups[key]) groups[key] = [];
        groups[key].push(n);
      } catch { if (!groups['Earlier']) groups['Earlier'] = []; groups['Earlier'].push(n); }
    });
    return groups;
  };

  const groups = groupByDate(filtered);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate('/')} className="rounded-xl border p-2"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
              <ArrowLeft size={18} weight="bold" />
            </Button>
            <div>
              <h1 className="font-black text-lg" style={{ color: 'var(--text-1)' }}>Notifications</h1>
              {unread > 0 && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{unread} unread</p>}
            </div>
          </div>
          {unread > 0 && (
            <Button onClick={markAllRead} className="text-xs font-bold rounded-xl border px-3 py-1.5"
              style={{ background: 'transparent', color: 'var(--blue)', borderColor: 'var(--blue)' }}>
              Mark all read
            </Button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 px-4 py-3 overflow-x-auto border-b" style={{ borderColor: 'var(--border-c)' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap capitalize"
              style={{
                background: filter === f ? 'var(--blue)' : 'var(--bg-surface)',
                color: filter === f ? '#fff' : 'var(--text-2)',
              }}>
              {f === 'all' ? `All (${notifications.length})` : f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Notifications */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text-3)' }} />
            <p className="font-bold text-lg" style={{ color: 'var(--text-2)' }}>No notifications</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>You're all caught up!</p>
          </div>
        ) : (
          Object.entries(groups).map(([date, notifs]) => (
            <div key={date}>
              <div className="px-4 py-2 sticky top-[61px]" style={{ background: 'var(--bg-base)' }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{date}</p>
              </div>
              {notifs.map(notif => (
                <button key={notif.notification_id} onClick={() => markRead(notif)}
                  className="w-full flex items-start gap-3 px-4 py-3 border-b text-left transition-colors"
                  style={{
                    borderColor: 'var(--border-c)',
                    background: notif.read ? 'transparent' : 'rgba(37,99,235,0.04)',
                  }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--bg-surface)' }}>
                    {ICONS[notif.type] || <Bell size={18} style={{ color: 'var(--text-3)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-1)' }}>{notif.content}</p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-3)' }}>{formatTime(notif.created_at)}</p>
                  </div>
                  {!notif.read && (
                    <div className="w-2.5 h-2.5 rounded-full mt-2 shrink-0" style={{ background: 'var(--blue)' }} />
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
