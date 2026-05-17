import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ArrowLeft, Archive, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';
import api, { resolveAssetUrl } from '../utils/api';

const GlobalChatArchivePage = ({ user }) => {
  const [archives, setArchives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [msgSearch, setMsgSearch] = useState('');
  const [archiveResults, setArchiveResults] = useState(null); // null = no search yet
  const navigate = useNavigate();

  const isMod = user?.is_admin || user?.is_moderator || ['Moderator','Admin','Owner'].includes(user?.role);

  useEffect(() => {
    if (!isMod) { navigate('/'); return; }
    loadArchives();
  }, []);

  const loadArchives = async () => {
    try {
      const r = await api.get('/chat/archives?limit=100');
      setArchives(r.data);
    } catch { toast.error('Failed to load archives'); }
    finally { setLoading(false); }
  };

  const loadDetail = async (archive_id) => {
    try {
      const r = await api.get(`/chat/archives/${archive_id}`);
      setSelected(r.data);
      setMsgSearch('');
    } catch { toast.error('Failed to load archive'); }
  };

  // Search across ALL archives for a text/user/ID match
  const searchAllArchives = async () => {
    if (!archiveSearch.trim()) { setArchiveResults(null); return; }
    const q = archiveSearch.toLowerCase();
    const results = [];
    for (const a of archives) {
      try {
        const r = await api.get(`/chat/archives/${a.archive_id}`);
        const matches = (r.data.messages || []).filter(msg =>
          msg.content?.toLowerCase().includes(q) ||
          msg.user?.display_name?.toLowerCase().includes(q) ||
          msg.user?.username?.toLowerCase().includes(q) ||
          msg.user?.id_number?.toLowerCase().includes(q)
        );
        if (matches.length > 0) results.push({ archive: a, matches });
      } catch {}
    }
    setArchiveResults(results);
  };

  // Filter messages in current archive view
  const filteredMsgs = selected
    ? (msgSearch.trim()
        ? (selected.messages || []).filter(msg =>
            msg.content?.toLowerCase().includes(msgSearch.toLowerCase()) ||
            msg.user?.display_name?.toLowerCase().includes(msgSearch.toLowerCase()) ||
            msg.user?.username?.toLowerCase().includes(msgSearch.toLowerCase()) ||
            msg.user?.id_number?.toLowerCase().includes(msgSearch.toLowerCase())
          )
        : (selected.messages || []))
    : [];

  const fmt = (d) => { try { return new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch { return d; } };

  if (!isMod) return null;

  // ── Archive detail view ────────────────────────────────────────────────────
  if (selected) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={() => setSelected(null)} className="rounded-xl border font-bold p-2"
            style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-lg truncate" style={{ color: 'var(--text-1)' }}>
              Archive — {fmt(selected.archived_at)}
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {selected.message_count} messages · #{selected.chat_room}
              {msgSearch && filteredMsgs.length !== selected.message_count && ` · ${filteredMsgs.length} match${filteredMsgs.length !== 1 ? 'es' : ''}`}
            </p>
          </div>
        </div>

        {/* Search within this archive */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <Input value={msgSearch} onChange={e => setMsgSearch(e.target.value)}
              placeholder="Search messages, users, IDs..." className="pl-9 rounded-xl border text-sm"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
          </div>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="p-4 space-y-3">
              {filteredMsgs.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>
                  {msgSearch ? 'No messages match your search' : 'No messages in this archive'}
                </p>
              )}
              {filteredMsgs.map(msg => (
                <div key={msg.message_id} className={`flex items-start gap-2.5 rounded-lg px-2 py-1 -mx-2 ${
                  msgSearch && (
                    msg.content?.toLowerCase().includes(msgSearch.toLowerCase()) ||
                    msg.user?.display_name?.toLowerCase().includes(msgSearch.toLowerCase())
                  ) ? 'bg-yellow-50' : ''
                }`}>
                  <Avatar className="w-8 h-8 flex-shrink-0 border" style={{ borderColor: 'var(--border-c)' }}>
                    <AvatarImage src={resolveAssetUrl(msg.user?.profile_picture)} />
                    <AvatarFallback className="text-[10px] font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>
                      {(msg.user?.display_name || 'U')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-black" style={{ color: 'var(--blue)' }}>
                        {msg.user?.username ? `@${msg.user.username}` : msg.user?.display_name || 'User'}
                      </span>
                      {msg.user?.display_name && msg.user?.username && (
                        <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>{msg.user.display_name}</span>
                      )}
                      {msg.user?.id_number && (
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>#{msg.user.id_number}</span>
                      )}
                      <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmt(msg.created_at)}</span>
                    </div>
                    <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--text-1)' }}>{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );

  // ── Archive list view ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={() => navigate('/')} className="rounded-xl border font-bold p-2"
            style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1">
            <h1 className="font-black text-xl flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <Archive size={20} /> Global Chat Archive
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Auto-saved every 12h at 1:00 AM & 1:00 PM UTC+3 · Moderators only · Archives are permanent
            </p>
          </div>
        </div>

        {/* Global search across all archives */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <Input value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchAllArchives()}
              placeholder="Search all archives: text, username, real name, ID…"
              className="pl-9 rounded-xl border text-sm"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
          </div>
          <Button onClick={searchAllArchives} className="rounded-xl border font-bold px-4"
            style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
            Search
          </Button>
          {archiveResults !== null && (
            <Button onClick={() => { setArchiveResults(null); setArchiveSearch(''); }} className="rounded-xl border font-bold px-3"
              style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
              Clear
            </Button>
          )}
        </div>

        {/* Global search results */}
        {archiveResults !== null && (
          <div className="mb-4 space-y-3">
            <p className="text-sm font-bold" style={{ color: 'var(--text-2)' }}>
              Found {archiveResults.reduce((a,r)=>a+r.matches.length, 0)} result{archiveResults.reduce((a,r)=>a+r.matches.length,0) !== 1 ? 's' : ''} across {archiveResults.length} archive{archiveResults.length !== 1 ? 's' : ''}
            </p>
            {archiveResults.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>No results found</p>
            )}
            {archiveResults.map(({ archive, matches }) => (
              <div key={archive.archive_id} className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
                <button onClick={() => loadDetail(archive.archive_id)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-black/5">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmt(archive.archived_at)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{matches.length} match{matches.length !== 1 ? 'es' : ''}</p>
                  </div>
                  <CaretRight size={14} style={{ color: 'var(--text-3)' }} />
                </button>
                <div className="border-t px-3 pb-3 pt-1 space-y-2" style={{ borderColor: 'var(--border-c)' }}>
                  {matches.slice(0, 3).map(msg => (
                    <div key={msg.message_id} className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                      <span className="font-bold" style={{ color: 'var(--blue)' }}>
                        {msg.user?.username ? `@${msg.user.username}` : msg.user?.display_name}
                        {msg.user?.id_number && ` · #${msg.user.id_number}`}
                      </span>
                      <span style={{ color: 'var(--text-3)' }}> · {fmt(msg.created_at)}</span>
                      <p className="mt-0.5" style={{ color: 'var(--text-1)' }}>{msg.content}</p>
                    </div>
                  ))}
                  {matches.length > 3 && (
                    <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>+{matches.length - 3} more — click to view full archive</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Archive list */}
        {archiveResults === null && (
          loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : archives.length === 0 ? (
            <div className="text-center py-16">
              <Archive size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text-3)' }} />
              <p className="font-bold text-lg" style={{ color: 'var(--text-2)' }}>No archives yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Chat is archived at 1:00 AM and 1:00 PM UTC+3</p>
            </div>
          ) : (
            <div className="space-y-2">
              {archives.map(a => (
                <button key={a.archive_id} onClick={() => loadDetail(a.archive_id)}
                  className="w-full text-left p-4 rounded-xl border flex items-center justify-between transition-colors hover:bg-black/5"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{fmt(a.archived_at)}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {a.message_count} messages · #{a.chat_room}
                    </p>
                  </div>
                  <CaretRight size={16} style={{ color: 'var(--text-3)' }} />
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default GlobalChatArchivePage;
