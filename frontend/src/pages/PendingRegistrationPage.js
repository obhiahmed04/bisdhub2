import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { Clock, Lifebuoy, PaperPlaneRight, ArrowLeft, PencilSimple, CheckCircle, XCircle } from '@phosphor-icons/react';
import axios from 'axios';
import { API_BASE } from '../utils/api';

const PendingRegistrationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { serialNumber, regId, registration, editableUntil } = location.state || {};

  const [checkId, setCheckId] = useState('');
  const [status, setStatus] = useState(
    registration
      ? { status: 'pending', reg_id: regId, serial_number: serialNumber, registration, editable_until: editableUntil }
      : null
  );
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [helpMessages, setHelpMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!status?.editable_until) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(status.editable_until) - new Date()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [status?.editable_until]);

  useEffect(() => {
    if (!status?.reg_id) return;
    loadHelpMessages();
    pollRef.current = setInterval(loadHelpMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [status?.reg_id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [helpMessages]);

  const reg = status?.registration;
  const senderId = checkId || reg?.id_number || 'anonymous';

  const checkStatus = async () => {
    if (!checkId.trim()) return toast.error('Enter your ID number');
    try {
      const res = await axios.get(`${API_BASE}/auth/check-registration/${checkId}`);
      setStatus(res.data);
      if (res.data.status === 'approved') toast.success('Your registration has been approved!');
    } catch { toast.error('Failed to check status'); }
  };

  const loadHelpMessages = async () => {
    if (!status?.reg_id) return;
    try {
      const res = await axios.get(`${API_BASE}/help-chat/${status.reg_id}/messages`);
      setHelpMessages(res.data || []);
    } catch { /* Silently fail on poll */ }
  };

  const sendHelpMessage = async () => {
    if (!newMessage.trim() || !status?.reg_id) return;
    setSendingMessage(true);
    try {
      await axios.post(
        `${API_BASE}/help-chat/${status.reg_id}/message?user_type=user`,
        { sender_id: senderId, content: newMessage }
      );
      setNewMessage('');
      await loadHelpMessages();
    } catch { toast.error('Failed to send message'); }
    finally { setSendingMessage(false); }
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
  const formatMsgTime = (dateStr) => dateStr ? new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="min-h-screen p-4 bg-[#FDFBF7] dark:bg-[#111111] flex items-center justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">

        {/* Status Panel */}
        <div className="bg-white dark:bg-[#171717] border border-[#D1D1D1] rounded-2xl p-6">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 border-2 border-[#111111] bg-[#F5F5F5]">
              {status?.status === 'rejected' ? <XCircle size={32} weight="fill" className="text-red-500" />
                : status?.status === 'approved' ? <CheckCircle size={32} weight="fill" className="text-green-500" />
                : <Clock size={32} weight="fill" className="text-yellow-500" />}
            </div>
            <h1 className="text-xl font-black">
              {status?.status === 'rejected' ? 'Registration Rejected'
                : status?.status === 'approved' ? 'Registration Approved'
                : status ? 'Registration Pending'
                : 'Check Registration Status'}
            </h1>
          </div>

          {status?.serial_number && (
            <div className="text-center mb-4">
              <span className="px-3 py-1.5 rounded-lg inline-block bg-[#FAFAFA] border border-[#D1D1D1] text-sm font-mono">
                Application #{status.serial_number}
              </span>
            </div>
          )}

          {status?.status === 'pending' && timeLeft > 0 && (
            <div className="text-center mb-4">
              <p className="text-xs text-[#4B4B4B]">Edit window: <span className="font-bold text-yellow-600">{formatTime(timeLeft)}</span></p>
              <Button onClick={() => { setEditMode(true); setEditData(reg || {}); }}
                className="mt-2 bg-white text-[#111111] border-2 border-[#111111] text-xs">
                <PencilSimple size={12} /> Edit details
              </Button>
            </div>
          )}

          {reg && !editMode && (
            <div className="rounded-xl p-4 mb-4 space-y-2 text-sm bg-[#FAFAFA] border border-[#D1D1D1]">
              {[
                ['ID Number', reg.id_number], ['Full Name', reg.full_name],
                ['Date of Birth', reg.date_of_birth], ['Class', reg.current_class],
                ['Section', reg.section], ['Email', reg.email],
                reg.phone_number && ['Phone', reg.phone_number],
                ['Student Type', reg.is_ex_student ? 'EX Student' : 'Current Student'],
                reg.date_of_leaving && ['Date of Leaving', reg.date_of_leaving],
                reg.last_class && ['Last Class', reg.last_class],
                reg.current_status && ['Current Status', reg.current_status],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-[#6B7280]">{label}:</span>
                  <span className="font-semibold text-right">{value}</span>
                </div>
              ))}
            </div>
          )}

          {editMode && (
            <div className="rounded-xl p-4 mb-4 space-y-3 bg-[#FAFAFA] border border-[#D1D1D1]">
              {['full_name', 'email', 'phone_number'].map(field => (
                <div key={field}>
                  <label className="block mb-1 text-xs uppercase tracking-wide text-[#6B7280]">{field.replace(/_/g, ' ')}</label>
                  <Input value={editData[field] || ''} onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button onClick={() => setEditMode(false)} className="flex-1 bg-white text-[#111111] border-2 border-[#111111]">Cancel</Button>
                <Button onClick={saveEdit} className="flex-1 bg-[#2563EB] text-white border-2 border-[#111111]">Save</Button>
              </div>
            </div>
          )}

          {status?.status === 'rejected' && status?.rejection_reason && (
            <div className="rounded-xl p-3 mb-4 bg-red-50 border border-red-200">
              <p className="text-xs font-bold text-red-500 mb-1">Reason</p>
              <p className="text-sm">{status.rejection_reason}</p>
            </div>
          )}

          {!status && (
            <div className="flex gap-2 mb-4">
              <Input value={checkId} onChange={(e) => setCheckId(e.target.value)}
                placeholder="Enter your ID number" onKeyDown={(e) => e.key === 'Enter' && checkStatus()} />
              <Button onClick={checkStatus} className="bg-[#2563EB] text-white border-2 border-[#111111]">Check</Button>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            {status?.status === 'approved' && (
              <Button onClick={() => navigate('/login')} className="bg-[#2563EB] text-white border-2 border-[#111111]">Go to Login</Button>
            )}
            <Button onClick={() => navigate('/login')} className="bg-white text-[#111111] border-2 border-[#111111]">
              <ArrowLeft size={14} /> Back to Login
            </Button>
          </div>
        </div>

        {/* Help Chat Panel */}
        {status?.reg_id && (
          <div className="bg-white dark:bg-[#171717] border border-[#D1D1D1] rounded-2xl p-4 flex flex-col min-h-[70vh]">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#D1D1D1]">
              <Lifebuoy size={18} />
              <div>
                <h2 className="font-black text-sm">Admin Help Chat</h2>
                <p className="text-[10px] text-[#6B7280]">Chat with an admin about your registration</p>
              </div>
            </div>

            <ScrollArea className="flex-1 mb-3">
              <div className="space-y-3 pr-2">
                {helpMessages.length === 0 && (
                  <p className="text-sm text-[#6B7280] text-center py-8">
                    No messages yet. Send a message to reach out to an admin.
                  </p>
                )}
                {helpMessages.map((msg) => (
                  <div key={msg.message_id} className={`flex ${msg.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                      msg.sender_type === 'admin' ? 'bg-[#F5F5F5] text-[#111111]' : 'bg-[#2563EB] text-white'
                    }`}>
                      <p className="text-[10px] font-bold opacity-70 mb-1">{msg.sender_type === 'admin' ? 'Admin' : 'You'}</p>
                      <p>{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender_type === 'admin' ? 'text-[#6B7280]' : 'text-white/60'}`}>
                        {formatMsgTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendHelpMessage()}
                placeholder="Type your message to admin..."
                className="border-2 border-[#111111] rounded-xl" />
              <Button onClick={sendHelpMessage} disabled={sendingMessage || !newMessage.trim()}
                className="bg-[#2563EB] text-white border-2 border-[#111111]">
                <PaperPlaneRight size={14} weight="bold" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingRegistrationPage;
