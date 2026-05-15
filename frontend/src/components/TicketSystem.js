import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { Ticket, Plus, PaperPlaneRight, ArrowLeft, Paperclip, X, ArrowClockwise } from '@phosphor-icons/react';
import api from '../utils/api';
import axios from 'axios';
import { API_BASE, resolveAssetUrl } from '../utils/api';

const CATEGORIES = [
  { value: 'general', label: '💬 General' },
  { value: 'registration', label: '📋 Registration' },
  { value: 'account', label: '👤 Account Help' },
  { value: 'bug', label: '🐛 Bug Report' },
  { value: 'content', label: '📣 Content Issue' },
  { value: 'other', label: '✨ Other' },
];

const STATUS_CONFIG = {
  open: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Open' },
  in_progress: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'In Progress' },
  resolved: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Resolved' },
  closed: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Closed' },
};

const fmt = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

// ─── Message bubble ────────────────────────────────────────────────────────
const MsgBubble = ({ msg, isAdmin }) => (
  <div className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
    <div className="max-w-[85%] space-y-1">
      <div className="px-3 py-2 rounded-xl text-sm"
        style={{ background: isAdmin ? 'var(--bg-surface)' : 'var(--blue)', color: isAdmin ? 'var(--text-1)' : '#fff' }}>
        <p className="text-[10px] font-bold opacity-60 mb-0.5">{isAdmin ? '👮 Support' : '👤 You'}</p>
        <p className="whitespace-pre-wrap">{msg.message}</p>
        {msg.attachments?.map((url, i) => (
          <a key={i} href={resolveAssetUrl(url)} target="_blank" rel="noreferrer"
            className="block mt-1.5">
            <img src={resolveAssetUrl(url)} alt="attachment"
              className="max-h-40 rounded-lg object-cover border border-white/20"
              onError={e => { e.target.style.display='none'; }} />
          </a>
        ))}
        <p className="text-[10px] mt-1 opacity-50">{fmt(msg.created_at)}</p>
      </div>
    </div>
  </div>
);

// ─── Attachment picker ─────────────────────────────────────────────────────
const AttachPicker = ({ attachments, onChange, apiCall }) => {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiCall('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange([...attachments, res.data.url]);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {attachments.map((url, i) => (
        <div key={i} className="relative">
          <img src={resolveAssetUrl(url)} alt="" className="w-14 h-14 rounded-lg object-cover border" style={{ borderColor: 'var(--border-c)' }} />
          <button onClick={() => onChange(attachments.filter((_, j) => j !== i))}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px]"
            style={{ background: '#ef4444' }}>✕</button>
        </div>
      ))}
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold border"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)', color: 'var(--text-2)' }}>
        <Paperclip size={12} /> {uploading ? 'Uploading...' : 'Attach'}
      </button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={upload} />
    </div>
  );
};

// ─── Chat view for a single ticket ─────────────────────────────────────────
const TicketChat = ({ ticket, onBack, apiCall, isAnon = false, anonId = '' }) => {
  const [messages, setMessages] = useState(ticket.messages || []);
  const [replyText, setReplyText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);

  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadTicket = useCallback(async () => {
    try {
      let r;
      if (isAnon) r = await axios.get(`${API_BASE}/tickets/anonymous/${ticket.ticket_id}?id_number=${encodeURIComponent(anonId)}`);
      else r = await apiCall.get(`/tickets/${ticket.ticket_id}`);
      setMessages(r.data.messages || []);
    } catch {}
  }, [ticket.ticket_id, isAnon, anonId, apiCall]);

  // Poll every 8 seconds for updates
  useEffect(() => {
    pollRef.current = setInterval(loadTicket, 8000);
    return () => clearInterval(pollRef.current);
  }, [loadTicket]);

  // Listen for WS ticket_update events
  useEffect(() => {
    if (isAnon) return;
    const handler = (e) => {
      if (e.detail?.ticket_id === ticket.ticket_id) loadTicket();
    };
    window.addEventListener('ticket_update', handler);
    return () => window.removeEventListener('ticket_update', handler);
  }, [ticket.ticket_id, isAnon, loadTicket]);

  const sendReply = async () => {
    if (!replyText.trim() && attachments.length === 0) return;
    setSending(true);
    try {
      if (isAnon) {
        await axios.post(
          `${API_BASE}/tickets/anonymous/${ticket.ticket_id}/reply?id_number=${encodeURIComponent(anonId)}`,
          { message: replyText || '📎 Attachment', attachments }
        );
      } else {
        await apiCall.post(`/tickets/${ticket.ticket_id}/reply`, { message: replyText || '📎 Attachment', attachments });
      }
      setReplyText('');
      setAttachments([]);
      await loadTicket();
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <button onClick={onBack} style={{ color: 'var(--text-3)' }}><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-black text-sm truncate" style={{ color: 'var(--text-1)' }}>#{ticket.serial_number} {ticket.subject}</p>
            <button onClick={loadTicket} title="Refresh" style={{ color: 'var(--text-3)', flexShrink: 0 }}><ArrowClockwise size={13} /></button>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>ID: {ticket.ticket_id.slice(0, 8)}…</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 mb-3 min-h-0" style={{ maxHeight: 320 }}>
        <div className="space-y-3 pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>No messages yet. Send your first message below.</p>
          )}
          {messages.map(msg => (
            <MsgBubble key={msg.message_id} msg={msg} isAdmin={msg.sender_type === 'admin'} />
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {['open', 'in_progress'].includes(ticket.status) ? (
        <div className="flex-shrink-0 space-y-2">
          {!isAnon && <AttachPicker attachments={attachments} onChange={setAttachments} apiCall={apiCall} />}
          <div className="flex gap-2">
            <Input value={replyText} onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
              placeholder="Type your reply..." className="rounded-xl border flex-1 text-sm"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
            <Button onClick={sendReply} disabled={sending || (!replyText.trim() && attachments.length === 0)}
              className="rounded-xl border px-3"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              <PaperPlaneRight size={14} weight="bold" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-center py-2 font-semibold flex-shrink-0" style={{ color: '#22c55e' }}>
          ✅ This ticket is {ticket.status}
        </p>
      )}
    </div>
  );
};

// ─── New ticket form ────────────────────────────────────────────────────────
const NewTicketForm = ({ onBack, onCreated, apiCall, isAnon = false, anonId = '', anonName = '' }) => {
  const [form, setForm] = useState({ subject: '', category: 'general', message: '' });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.subject.trim() || !form.message.trim()) { toast.error('Fill in subject and message'); return; }
    setLoading(true);
    try {
      let res;
      if (isAnon) {
        res = await axios.post(
          `${API_BASE}/tickets/anonymous?id_number=${encodeURIComponent(anonId)}&name=${encodeURIComponent(anonName)}`,
          form
        );
      } else {
        res = await apiCall.post('/tickets', form);
      }
      toast.success('Ticket submitted! Our support team will respond soon.');
      onCreated(res.data.ticket_id);
    } catch { toast.error('Failed to submit ticket'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} style={{ color: 'var(--text-3)' }}><ArrowLeft size={18} /></button>
        <h3 className="font-black text-base" style={{ color: 'var(--text-1)' }}>New Support Ticket</h3>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Category</label>
        <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
          <SelectTrigger className="rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Subject *</label>
        <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
          placeholder="Brief description of your issue" className="rounded-xl border"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Message *</label>
        <Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          placeholder="Describe your issue in detail..." rows={4} className="rounded-xl border resize-none"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
      </div>
      <Button onClick={submit} disabled={loading} className="w-full rounded-xl border font-bold py-3"
        style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
        {loading ? 'Submitting...' : 'Submit Ticket'}
      </Button>
    </div>
  );
};

// ─── MAIN: For logged-in users (tickets linked to account) ─────────────────
export const TicketSystem = ({ user, ws }) => {
  const [view, setView] = useState('list');
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadTickets(); }, []);

  // Listen for WS ticket updates
  useEffect(() => {
    const handler = (e) => { loadTickets(); };
    window.addEventListener('ticket_update', handler);
    return () => window.removeEventListener('ticket_update', handler);
  }, []);

  const loadTickets = async () => {
    try { const r = await api.get('/tickets'); setTickets(r.data); } catch {}
  };

  const openTicket = async (ticketId) => {
    try { const r = await api.get(`/tickets/${ticketId}`); setSelected(r.data); setView('detail'); }
    catch { toast.error('Could not load ticket'); }
  };

  if (view === 'new') return (
    <NewTicketForm
      onBack={() => setView('list')}
      onCreated={async (tid) => { await loadTickets(); const r = await api.get(`/tickets/${tid}`); setSelected(r.data); setView('detail'); }}
      apiCall={api}
    />
  );

  if (view === 'detail' && selected) return (
    <TicketChat ticket={selected} onBack={() => { setView('list'); loadTickets(); }} apiCall={api} />
  );

  // List view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-base flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
          <Ticket size={18} /> Support Tickets
        </h3>
        <Button onClick={() => setView('new')} className="rounded-xl border font-bold px-3 py-1.5 text-xs flex items-center gap-1"
          style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
          <Plus size={12} weight="bold" /> New Ticket
        </Button>
      </div>
      {tickets.length === 0 ? (
        <div className="text-center py-8">
          <Ticket size={36} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-3)' }} />
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>No tickets yet</p>
          <Button onClick={() => setView('new')} className="mt-3 rounded-xl border font-bold px-4 py-2 text-sm"
            style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
            Create your first ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
            return (
              <button key={t.ticket_id} onClick={() => openTicket(t.ticket_id)}
                className="w-full text-left p-3 rounded-xl border"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>#{t.serial_number} {t.subject}</p>
                    <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-3)' }}>
                      {t.category} · {fmt(t.updated_at || t.created_at)}
                      {t.messages?.length > 0 && ` · ${t.messages.length} message${t.messages.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                    style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Anonymous: For pending registration users ─────────────────────────────
export const AnonymousTicketSystem = ({ idNumber, name }) => {
  const [view, setView] = useState('list'); // list | new | detail
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [lookupTicketId, setLookupTicketId] = useState('');

  useEffect(() => { if (idNumber) loadTickets(); }, [idNumber]);

  const loadTickets = async () => {
    if (!idNumber) return;
    try {
      // Fetch all tickets for this id_number
      const r = await axios.get(`${API_BASE}/tickets/by-id-number/${encodeURIComponent(idNumber)}`);
      setTickets(r.data || []);
    } catch {
      setTickets([]);
    }
  };

  const openTicket = async (tid) => {
    try {
      const r = await axios.get(`${API_BASE}/tickets/anonymous/${tid}?id_number=${encodeURIComponent(idNumber)}`);
      setSelected(r.data);
      setView('detail');
    } catch { toast.error('Could not load ticket'); }
  };

  const lookupById = async () => {
    if (!lookupTicketId.trim()) return;
    await openTicket(lookupTicketId.trim());
  };

  if (view === 'new') return (
    <NewTicketForm
      onBack={() => setView('list')}
      onCreated={async (tid) => {
        await loadTickets();
        await openTicket(tid);
      }}
      apiCall={null}
      isAnon
      anonId={idNumber}
      anonName={name || idNumber}
    />
  );

  if (view === 'detail' && selected) return (
    <TicketChat
      ticket={selected}
      onBack={() => { setView('list'); loadTickets(); }}
      apiCall={null}
      isAnon
      anonId={idNumber}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
          <Ticket size={16} /> Contact Support
        </h3>
        <Button onClick={() => setView('new')} className="rounded-xl border font-bold px-3 py-1.5 text-xs flex items-center gap-1"
          style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
          <Plus size={12} weight="bold" /> New
        </Button>
      </div>

      {tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map(t => {
            const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
            return (
              <button key={t.ticket_id} onClick={() => openTicket(t.ticket_id)}
                className="w-full text-left p-3 rounded-xl border"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate" style={{ color: 'var(--text-1)' }}>#{t.serial_number} {t.subject}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmt(t.updated_at || t.created_at)}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                    style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tickets.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-3)' }}>
          {idNumber ? 'No tickets yet. Create one to reach support.' : 'Enter your ID above to see your tickets.'}
        </p>
      )}

      <div className="border-t pt-3" style={{ borderColor: 'var(--border-c)' }}>
        <p className="text-[11px] mb-2" style={{ color: 'var(--text-3)' }}>Have a ticket ID? Look it up:</p>
        <div className="flex gap-2">
          <Input value={lookupTicketId} onChange={e => setLookupTicketId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupById()}
            placeholder="Paste full ticket ID" className="rounded-xl border flex-1 text-xs font-mono"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
          <Button onClick={lookupById} className="rounded-xl border px-3 text-xs font-bold"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
            Open
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TicketSystem;
