import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ArrowLeft, Archive, ChevronRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import api, { resolveAssetUrl } from '../utils/api';

const GlobalChatArchivePage = ({ user }) => {
  const [archives, setArchives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const isMod = user?.is_admin || user?.is_moderator || user?.role === 'Moderator' || user?.role === 'Admin' || user?.role === 'Owner';
  
  useEffect(() => {
    if (!isMod) { navigate('/'); return; }
    loadArchives();
  }, []);

  const loadArchives = async () => {
    try {
      const r = await api.get('/chat/archives');
      setArchives(r.data);
    } catch { toast.error('Failed to load archives'); }
    finally { setLoading(false); }
  };

  const loadDetail = async (archive_id) => {
    try {
      const r = await api.get(`/chat/archives/${archive_id}`);
      setSelected(r.data);
    } catch { toast.error('Failed to load archive'); }
  };

  const triggerArchive = async () => {
    if (!confirm('Archive current global chat now? This will clear all current messages.')) return;
    try {
      await api.post('/chat/archive-now');
      toast.success('Chat archived successfully');
      loadArchives();
    } catch { toast.error('Failed'); }
  };

  const fmt = (d) => {
    try { return new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return d; }
  };

  if (!isMod) return null;

  if (selected) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={() => setSelected(null)} className="rounded-xl border font-bold p-2"
            style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="font-black text-lg" style={{ color: 'var(--text-1)' }}>Archive — {fmt(selected.archived_at)}</h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{selected.message_count} messages · {selected.chat_room}</p>
          </div>
        </div>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="p-4 space-y-3">
              {(selected.messages || []).map(msg => (
                <div key={msg.message_id} className="flex items-start gap-2.5">
                  <Avatar className="w-8 h-8 flex-shrink-0 border" style={{ borderColor: 'var(--border-c)' }}>
                    <AvatarImage src={resolveAssetUrl(msg.user?.profile_picture)} />
                    <AvatarFallback className="text-[10px] font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>
                      {(msg.user?.display_name || 'U')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--blue)' }}>
                        {msg.user?.username ? `@${msg.user.username}` : msg.user?.display_name || 'User'}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmt(msg.created_at)}</span>
                    </div>
                    <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--text-1)' }}>{msg.content}</p>
                  </div>
                </div>
              ))}
              {(!selected.messages || selected.messages.length === 0) && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>No messages in this archive</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={() => navigate('/')} className="rounded-xl border font-bold p-2"
            style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1">
            <h1 className="font-black text-xl flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <Archive size={20} /> Global Chat Archive
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Auto-archived every 12h at 1:00 AM & 1:00 PM (UTC+3) · Moderators only
            </p>
          </div>
          <Button onClick={triggerArchive} className="rounded-xl border font-bold px-3 py-2 text-xs"
            style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}>
            Archive Now
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : archives.length === 0 ? (
          <div className="text-center py-16">
            <Archive size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text-3)' }} />
            <p className="font-bold text-lg" style={{ color: 'var(--text-2)' }}>No archives yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Chat will be automatically archived at 1:00 AM and 1:00 PM UTC+3</p>
          </div>
        ) : (
          <div className="space-y-2">
            {archives.map(a => (
              <button key={a.archive_id} onClick={() => loadDetail(a.archive_id)}
                className="w-full text-left p-4 rounded-xl border flex items-center justify-between"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{fmt(a.archived_at)}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {a.message_count} messages · #{a.chat_room}
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalChatArchivePage;
