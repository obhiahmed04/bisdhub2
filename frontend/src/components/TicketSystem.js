import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { Ticket, Plus, PaperPlaneRight, ArrowLeft, Clock, CheckCircle, XCircle, Spinner, Tag } from '@phosphor-icons/react';
import api from '../utils/api';
import axios from 'axios';
import { API_BASE } from '../utils/api';

const CATEGORIES = [
  { value: 'general', label: '💬 General' },
  { value: 'registration', label: '📋 Registration' },
  { value: 'account', label: '👤 Account Help' },
  { value: 'bug', label: '🐛 Bug Report' },
  { value: 'content', label: '📣 Content Issue' },
  { value: 'other', label: '✨ Other' },
];

const STATUS_CONFIG = {
  open: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '🔵', label: 'Open' },
  in_progress: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🟡', label: 'In Progress' },
  resolved: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '🟢', label: 'Resolved' },
  closed: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: '⚫', label: 'Closed' },
};

// For logged-in users
export const TicketSystem = ({ user }) => {
  const [view, setView] = useState('list'); // list | new | detail
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [newTicket, setNewTicket] = useState({ subject: '', category: 'general', message: '' });
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { loadTickets(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selected?.messages]);

  const loadTickets = async () => {
    try { const r = await api.get('/tickets'); setTickets(r.data); } catch {}
  };

  const loadTicket = async (ticketId) => {
    try { const r = await api.get(`/tickets/${ticketId}`); setSelected(r.data); } catch {}
  };

  const submitTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error('Please fill in subject and message'); return;
    }
    setLoading(true);
    try {
      await api.post('/tickets', newTicket);
      toast.success('Ticket submitted!');
      setNewTicket({ subject: '', category: 'general', message: '' });
      setView('list');
      loadTickets();
    } catch { toast.error('Failed to submit ticket'); }
    finally { setLoading(false); }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      await api.post(`/tickets/${selected.ticket_id}/reply`, { message: replyText });
      setReplyText('');
      await loadTicket(selected.ticket_id);
    } catch { toast.error('Failed to send reply'); }
  };

  const formatTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  if (view === 'new') return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setView('list')} style={{ color: 'var(--text-3)' }}><ArrowLeft size={18} /></button>
        <h3 className="font-black text-base" style={{ color: 'var(--text-1)' }}>New Support Ticket</h3>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Category</label>
        <Select value={newTicket.category} onValueChange={v => setNewTicket(p => ({ ...p, category: v }))}>
          <SelectTrigger className="rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Subject *</label>
        <Input value={newTicket.subject} onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))}
          placeholder="Brief description of your issue" className="rounded-xl border"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Message *</label>
        <Textarea value={newTicket.message} onChange={e => setNewTicket(p => ({ ...p, message: e.target.value }))}
          placeholder="Describe your issue in detail..." rows={4} className="rounded-xl border resize-none"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
      </div>
      <Button onClick={submitTicket} disabled={loading} className="w-full rounded-xl border font-bold py-3"
        style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
        {loading ? 'Submitting...' : 'Submit Ticket'}
      </Button>
    </div>
  );

  if (view === 'detail' && selected) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => { setView('list'); setSelected(null); }} style={{ color: 'var(--text-3)' }}><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm truncate" style={{ color: 'var(--text-1)' }}>#{selected.serial_number} {selected.subject}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: STATUS_CONFIG[selected.status]?.bg, color: STATUS_CONFIG[selected.status]?.color }}>
              {STATUS_CONFIG[selected.status]?.label}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{selected.category}</span>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 mb-3" style={{ maxHeight: 300 }}>
        <div className="space-y-3 pr-1">
          {selected.messages?.map((msg) => (
            <div key={msg.message_id} className={`flex ${msg.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[85%] px-3 py-2 rounded-xl text-sm"
                style={{
                  background: msg.sender_type === 'admin' ? 'var(--bg-surface)' : 'var(--blue)',
                  color: msg.sender_type === 'admin' ? 'var(--text-1)' : '#fff'
                }}>
                <p className="text-[10px] font-bold opacity-70 mb-0.5">{msg.sender_type === 'admin' ? `👮 ${msg.sender_name || 'Support'}` : '👤 You'}</p>
                <p>{msg.message}</p>
                <p className="text-[10px] mt-1 opacity-60">{formatTime(msg.created_at)}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      {['open', 'in_progress'].includes(selected.status) && (
        <div className="flex gap-2">
          <Input value={replyText} onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendReply()}
            placeholder="Reply..." className="rounded-xl border flex-1 text-sm"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
          <Button onClick={sendReply} disabled={!replyText.trim()}
            className="rounded-xl border px-3"
            style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
            <PaperPlaneRight size={14} weight="bold" />
          </Button>
        </div>
      )}
      {selected.status === 'resolved' && (
        <p className="text-xs text-center py-2 font-semibold" style={{ color: 'var(--green)' }}>✅ This ticket has been resolved</p>
      )}
    </div>
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
              <button key={t.ticket_id} onClick={() => { loadTicket(t.ticket_id); setView('detail'); }}
                className="w-full text-left p-3 rounded-xl border transition-colors"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>#{t.serial_number} {t.subject}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{t.category} • {formatTime(t.updated_at || t.created_at)}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                    style={{ background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// For anonymous users (pending registration)
export const AnonymousTicketSystem = ({ idNumber, name }) => {
  const [view, setView] = useState('new'); // new | submitted | detail
  const [ticketId, setTicketId] = useState('');
  const [lookupId, setLookupId] = useState(idNumber || '');
  const [ticket, setTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [newTicket, setNewTicket] = useState({ subject: '', category: 'registration', message: '' });
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.messages]);

  const submitTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error('Please fill in subject and message'); return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE}/tickets/anonymous?id_number=${encodeURIComponent(lookupId)}&name=${encodeURIComponent(name || lookupId)}`,
        newTicket
      );
      setTicketId(res.data.ticket_id);
      toast.success(`Ticket #${res.data.serial_number} created!`);
      setView('submitted');
    } catch { toast.error('Failed to submit ticket'); }
    finally { setLoading(false); }
  };

  const loadTicket = async () => {
    if (!ticketId || !lookupId) return;
    try {
      const r = await axios.get(`${API_BASE}/tickets/anonymous/${ticketId}?id_number=${encodeURIComponent(lookupId)}`);
      setTicket(r.data);
      setView('detail');
    } catch { toast.error('Ticket not found or ID mismatch'); }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      await axios.post(`${API_BASE}/tickets/anonymous/${ticketId}/reply?id_number=${encodeURIComponent(lookupId)}`, { message: replyText });
      setReplyText('');
      await loadTicket();
    } catch { toast.error('Failed to send reply'); }
  };

  const formatTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  if (view === 'submitted') return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="text-4xl mb-3">🎫</div>
        <h3 className="font-black text-base mb-1" style={{ color: 'var(--text-1)' }}>Ticket Submitted!</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>Save your ticket ID: <span className="font-mono font-bold" style={{ color: 'var(--blue)' }}>{ticketId.slice(0, 8)}...</span></p>
        <Button onClick={loadTicket} className="rounded-xl border font-bold px-4 py-2 text-sm"
          style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
          View Ticket
        </Button>
      </div>
    </div>
  );

  if (view === 'detail' && ticket) return (
    <div className="flex flex-col" style={{ maxHeight: 400 }}>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setView('submitted')} style={{ color: 'var(--text-3)' }}><ArrowLeft size={16} /></button>
        <div>
          <h3 className="font-black text-sm" style={{ color: 'var(--text-1)' }}>#{ticket.serial_number} {ticket.subject}</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: STATUS_CONFIG[ticket.status]?.bg, color: STATUS_CONFIG[ticket.status]?.color }}>
            {STATUS_CONFIG[ticket.status]?.label}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 mb-3" style={{ maxHeight: 250 }}>
        <div className="space-y-2 pr-1">
          {ticket.messages?.map((msg) => (
            <div key={msg.message_id} className={`flex ${msg.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[85%] px-3 py-2 rounded-xl text-xs"
                style={{ background: msg.sender_type === 'admin' ? 'var(--bg-surface)' : 'var(--blue)', color: msg.sender_type === 'admin' ? 'var(--text-1)' : '#fff' }}>
                <p className="font-bold opacity-60 mb-0.5">{msg.sender_type === 'admin' ? `👮 ${msg.sender_name || 'Support'}` : '👤 You'}</p>
                <p>{msg.message}</p>
                <p className="opacity-50 mt-0.5 text-[10px]">{formatTime(msg.created_at)}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      {['open', 'in_progress'].includes(ticket.status) && (
        <div className="flex gap-2">
          <Input value={replyText} onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendReply()}
            placeholder="Reply..." className="rounded-xl border flex-1 text-sm"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
          <Button onClick={sendReply} disabled={!replyText.trim()}
            className="rounded-xl border px-3" style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
            <PaperPlaneRight size={14} weight="bold" />
          </Button>
        </div>
      )}
    </div>
  );

  // New ticket form
  return (
    <div className="space-y-3">
      <h3 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
        <Ticket size={16} /> Contact Support
      </h3>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-2)' }}>Category</label>
        <Select value={newTicket.category} onValueChange={v => setNewTicket(p => ({ ...p, category: v }))}>
          <SelectTrigger className="rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-2)' }}>Subject *</label>
        <Input value={newTicket.subject} onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))}
          placeholder="Brief description" className="rounded-xl border text-sm"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-2)' }}>Message *</label>
        <Textarea value={newTicket.message} onChange={e => setNewTicket(p => ({ ...p, message: e.target.value }))}
          placeholder="Describe your issue in detail..." rows={3} className="rounded-xl border resize-none text-sm"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
      </div>
      <Button onClick={submitTicket} disabled={loading} className="w-full rounded-xl border font-bold py-2.5 text-sm"
        style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
        {loading ? 'Submitting...' : 'Submit Ticket'}
      </Button>
      <p className="text-[11px] text-center" style={{ color: 'var(--text-3)' }}>
        Already have a ticket? Enter your ticket ID to view it.
      </p>
      <div className="flex gap-2">
        <Input value={ticketId} onChange={e => setTicketId(e.target.value)}
          placeholder="Ticket ID" className="rounded-xl border flex-1 text-xs font-mono"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
        <Button onClick={loadTicket} className="rounded-xl border px-3 text-xs font-bold"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
          View
        </Button>
      </div>
    </div>
  );
};

export default TicketSystem;
