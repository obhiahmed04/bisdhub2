import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { Clock, Lifebuoy, PaperPlaneRight, ArrowLeft, PencilSimple, CheckCircle, XCircle, Ticket } from '@phosphor-icons/react';
import axios from 'axios';
import { API_BASE } from '../utils/api';

const PendingRegistrationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { serialNumber, regId, registration, editableUntil } = location.state || {};
  const [checkId, setCheckId] = useState('');
  const [status, setStatus] = useState(registration ? { status: 'pending', reg_id: regId, serial_number: serialNumber, registration, editable_until: editableUntil } : null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ticketDraft, setTicketDraft] = useState({ subject: 'Registration help', category: 'registration', message: '' });
  const endRef = useRef(null);

  useEffect(() => { if (!status?.editable_until) return; const interval = setInterval(() => { const diff = Math.max(0, Math.floor((new Date(status.editable_until) - new Date())/1000)); setTimeLeft(diff); if (diff<=0) clearInterval(interval); }, 1000); return () => clearInterval(interval); }, [status?.editable_until]);
  useEffect(() => { if (status?.reg_id) loadTickets(); }, [status?.reg_id]);
  useEffect(() => { if (activeTicket?.ticket_id) loadTicketMessages(activeTicket.ticket_id); }, [activeTicket?.ticket_id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticketMessages]);

  const reg = status?.registration;
  const senderId = useMemo(() => checkId || reg?.id_number || 'anonymous', [checkId, reg]);

  const checkStatus = async () => {
    if (!checkId.trim()) return toast.error('Enter your ID number');
    try {
      const res = await axios.get(`${API_BASE}/auth/check-registration/${checkId}`);
      setStatus(res.data);
      if (res.data.status === 'approved') toast.success('Your registration has been approved.');
    } catch { toast.error('Failed to check status'); }
  };

  const loadTickets = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tickets/by-registration/${status.reg_id}`);
      setTickets(res.data || []);
      if (!activeTicket && res.data?.length) setActiveTicket(res.data[0]);
    } catch { setTickets([]); }
  };

  const loadTicketMessages = async (ticketId) => {
    try {
      const res = await axios.get(`${API_BASE}/tickets/${ticketId}/messages`);
      setTicketMessages(res.data || []);
    } catch { setTicketMessages([]); }
  };

  const createTicket = async () => {
    if (!ticketDraft.message.trim() || !status?.reg_id) return toast.error('Write your issue first');
    try {
      const res = await axios.post(`${API_BASE}/tickets`, { registration_id: status.reg_id, sender_id: senderId, subject: ticketDraft.subject, category: ticketDraft.category, message: ticketDraft.message });
      toast.success(`Ticket ${res.data.ticket.ticket_number} created`);
      setTicketDraft({ subject: 'Registration help', category: 'registration', message: '' });
      await loadTickets();
      setActiveTicket(res.data.ticket);
    } catch { toast.error('Failed to create ticket'); }
  };

  const replyTicket = async () => {
    if (!newMessage.trim() || !activeTicket) return;
    try {
      await axios.post(`${API_BASE}/tickets/${activeTicket.ticket_id}/messages`, { sender_id: senderId, sender_type: 'user', message: newMessage });
      setNewMessage('');
      loadTicketMessages(activeTicket.ticket_id);
      loadTickets();
    } catch { toast.error('Failed to send reply'); }
  };

  const saveEdit = async () => {
    try {
      const res = await axios.put(`${API_BASE}/auth/registration/${status.reg_id}`, editData);
      setStatus(prev => ({ ...prev, registration: res.data.registration }));
      setEditMode(false);
      toast.success('Registration updated');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update'); }
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return <div className="min-h-screen p-4 bg-[#FDFBF7] dark:bg-[#111111] flex items-center justify-center"><div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">
    <div className="bg-white dark:bg-[#171717] border border-[#D1D1D1] rounded-2xl p-6">
      <div className="text-center mb-4"><div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 border-2 border-[#111111] bg-[#F5F5F5]">{status?.status === 'rejected' ? <XCircle size={32} weight="fill" className="text-red-500" /> : status?.status === 'approved' ? <CheckCircle size={32} weight="fill" className="text-green-500" /> : <Clock size={32} weight="fill" className="text-yellow-500" />}</div><h1 className="text-xl font-black">{status?.status === 'rejected' ? 'Registration Rejected' : status?.status === 'approved' ? 'Registration Approved' : status ? 'Registration Pending' : 'Check Registration Status'}</h1></div>
      {status?.serial_number ? <div className="text-center mb-4"><span className="px-3 py-1.5 rounded-lg inline-block bg-[#FAFAFA] border border-[#D1D1D1]">Application #{status.serial_number}</span></div> : null}
      {status?.status === 'pending' && timeLeft > 0 ? <div className="text-center mb-4"><p className="text-xs text-[#4B4B4B]">Edit window: <span className="font-bold text-yellow-600">{formatTime(timeLeft)}</span></p><Button onClick={() => { setEditMode(true); setEditData(reg || {}); }} className="mt-2 bg-white text-[#111111] border-2 border-[#111111]"><PencilSimple size={12} /> Edit details</Button></div> : null}
      {reg && !editMode ? <div className="rounded-xl p-4 mb-4 space-y-2 text-sm bg-[#FAFAFA] border border-[#D1D1D1]">{[['ID Number', reg.id_number], ['Username', reg.username || reg.id_number.toLowerCase()], ['Full Name', reg.full_name], ['Date of Birth', reg.date_of_birth], ['Class', reg.current_class], ['Section', reg.section], ['Email', reg.email], reg.phone_number && ['Phone', reg.phone_number], ['Student Type', reg.is_ex_student ? 'EX Student' : 'Current Student'], reg.date_of_leaving && ['Date of Leaving', reg.date_of_leaving], reg.last_class && ['Last Class', reg.last_class], reg.current_status && ['Current Status', reg.current_status]].filter(Boolean).map(([label, value]) => <div key={label} className="flex justify-between gap-4"><span className="text-[#6B7280]">{label}:</span><span className="font-semibold text-right">{value}</span></div>)}</div> : null}
      {editMode ? <div className="rounded-xl p-4 mb-4 space-y-3 bg-[#FAFAFA] border border-[#D1D1D1]">{['full_name','username','email','phone_number'].map(field => <div key={field}><label className="block mb-1 text-xs uppercase tracking-wide text-[#6B7280]">{field.replace('_',' ')}</label><Input value={editData[field] || ''} onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))} /></div>)}<div className="flex gap-2"><Button onClick={() => setEditMode(false)} className="flex-1 bg-white text-[#111111] border-2 border-[#111111]">Cancel</Button><Button onClick={saveEdit} className="flex-1 bg-[#2563EB] text-white border-2 border-[#111111]">Save</Button></div></div> : null}
      {status?.status === 'rejected' && status?.rejection_reason ? <div className="rounded-xl p-3 mb-4 bg-red-50 border border-red-200"><p className="text-xs font-bold text-red-500 mb-1">Reason</p><p className="text-sm">{status.rejection_reason}</p></div> : null}
      {!status ? <div className="flex gap-2 mb-4"><Input value={checkId} onChange={(e)=>setCheckId(e.target.value)} placeholder="Enter your ID number" onKeyDown={(e)=>e.key==='Enter' && checkStatus()} /><Button onClick={checkStatus} className="bg-[#2563EB] text-white border-2 border-[#111111]">Check</Button></div> : null}
      <div className="flex gap-2 justify-center">{status?.status === 'approved' ? <Button onClick={() => navigate('/login')} className="bg-[#2563EB] text-white border-2 border-[#111111]">Go to Login</Button> : null}<Button onClick={() => navigate('/login')} className="bg-white text-[#111111] border-2 border-[#111111]"><ArrowLeft size={14} /> Back to Login</Button></div>
    </div>

    {status?.reg_id ? <div className="bg-white dark:bg-[#171717] border border-[#D1D1D1] rounded-2xl p-4 flex flex-col min-h-[70vh]"><div className="flex items-center gap-2 mb-4"><Lifebuoy size={18} /><h2 className="font-black">Support Tickets</h2></div>
      <div className="rounded-xl border border-[#D1D1D1] p-3 bg-[#FAFAFA] mb-4"><div className="flex items-center gap-2 mb-2 text-sm font-bold"><Ticket size={16} /> Open a ticket</div><Input value={ticketDraft.subject} onChange={(e)=>setTicketDraft(prev => ({ ...prev, subject: e.target.value }))} placeholder="Subject" className="mb-2" /><Input value={ticketDraft.category} onChange={(e)=>setTicketDraft(prev => ({ ...prev, category: e.target.value }))} placeholder="Category" className="mb-2" /><Input value={ticketDraft.message} onChange={(e)=>setTicketDraft(prev => ({ ...prev, message: e.target.value }))} placeholder="Describe your issue..." onKeyDown={(e)=>e.key==='Enter' && createTicket()} /><Button onClick={createTicket} className="w-full mt-2 bg-[#2563EB] text-white border-2 border-[#111111]">Create Ticket</Button></div>
      <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-4 flex-1 min-h-0">
        <ScrollArea className="h-[240px] xl:h-full border border-[#D1D1D1] rounded-xl p-2">
          <div className="space-y-2">{tickets.map(ticket => <button key={ticket.ticket_id} onClick={() => setActiveTicket(ticket)} className={`w-full text-left rounded-xl border p-3 ${activeTicket?.ticket_id===ticket.ticket_id ? 'bg-[#DBEAFE] border-[#2563EB]' : 'bg-white border-[#D1D1D1]'}`}><p className="font-bold text-sm">{ticket.ticket_number}</p><p className="text-xs text-[#6B7280] truncate">{ticket.subject}</p><p className="text-[11px] mt-1 uppercase tracking-wide text-[#6B7280]">{ticket.status} · {ticket.priority}</p></button>)}{!tickets.length ? <p className="text-sm text-[#6B7280]">No tickets yet.</p> : null}</div>
        </ScrollArea>
        <div className="border border-[#D1D1D1] rounded-xl p-3 flex flex-col min-h-[300px]">
          {activeTicket ? <>
            <div className="mb-3 border-b pb-3"><p className="font-black">{activeTicket.ticket_number}</p><p className="text-sm">{activeTicket.subject}</p><p className="text-xs text-[#6B7280] uppercase tracking-wide">{activeTicket.category} · {activeTicket.status}</p></div>
            <ScrollArea className="flex-1"><div className="space-y-2 pr-2">{ticketMessages.map(msg => <div key={msg.ticket_message_id} className={`flex ${msg.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${msg.sender_type === 'admin' ? 'bg-[#F5F5F5]' : 'bg-[#2563EB] text-white'}`}><p className="text-[10px] font-bold opacity-70 mb-1">{msg.sender_type === 'admin' ? 'Admin' : 'You'}</p><p>{msg.message}</p></div></div>)}<div ref={endRef} /></div></ScrollArea>
            <div className="flex gap-2 mt-3"><Input value={newMessage} onChange={(e)=>setNewMessage(e.target.value)} onKeyDown={(e)=>e.key==='Enter' && replyTicket()} placeholder="Reply to this ticket..." /><Button onClick={replyTicket} className="bg-[#2563EB] text-white border-2 border-[#111111]"><PaperPlaneRight size={14} /></Button></div>
          </> : <div className="flex-1 flex items-center justify-center text-sm text-[#6B7280]">Select a ticket to view the thread.</div>}
        </div>
      </div>
    </div> : null}
  </div></div>;
};

export default PendingRegistrationPage;
