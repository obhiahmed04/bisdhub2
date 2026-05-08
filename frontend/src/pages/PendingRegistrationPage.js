import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Clock, ArrowLeft, PencilSimple, CheckCircle, XCircle, Eye, EyeSlash } from '@phosphor-icons/react';
import axios from 'axios';
import { API_BASE } from '../utils/api';
import { AnonymousTicketSystem } from '../components/TicketSystem';

const PendingRegistrationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { serialNumber, regId, registration, editableUntil } = location.state || {};

  const [checkId, setCheckId] = useState('');
  const [checkPassword, setCheckPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState(
    registration
      ? { status: 'pending', reg_id: regId, serial_number: serialNumber, registration, editable_until: editableUntil }
      : null
  );
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!status?.editable_until) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(status.editable_until) - new Date()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [status?.editable_until]);

  const reg = status?.registration;

  const checkStatus = async () => {
    if (!checkId.trim()) { toast.error('Enter your School ID'); return; }
    if (!checkPassword.trim()) { toast.error('Enter your registration password'); return; }
    setChecking(true);
    try {
      const res = await axios.get(`${API_BASE}/auth/check-registration/${checkId}`);
      if (res.data.status === 'not_found') { toast.error('No registration found for this ID'); setChecking(false); return; }
      // Verify password against preset hash
      const verifyRes = await axios.post(`${API_BASE}/auth/verify-registration-access`, {
        id_number: checkId, password: checkPassword
      });
      if (!verifyRes.data.valid) { toast.error('Incorrect password'); setChecking(false); return; }
      setStatus(res.data);
      if (res.data.status === 'approved') toast.success('Your registration has been approved!');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to check status');
    } finally { setChecking(false); }
  };

  const saveEdit = async () => {
    try {
      const res = await axios.put(`${API_BASE}/auth/registration/${status.reg_id}`, editData);
      setStatus(prev => ({ ...prev, registration: res.data.registration }));
      setEditMode(false);
      toast.success('Registration updated!');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update'); }
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const editableFields = [
    { key: 'full_name', label: 'Full Name', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone_number', label: 'Phone Number', type: 'text' },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'text' },
    { key: 'current_class', label: 'Grade / Class', type: 'text' },
    { key: 'section', label: 'Section', type: 'text' },
    { key: 'current_status', label: 'Current Status', type: 'text' },
    { key: 'date_of_leaving', label: 'Date of Leaving', type: 'text' },
    { key: 'last_class', label: 'Last Class', type: 'text' },
  ];

  return (
    <div className="min-h-screen p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">

        {/* Status Panel */}
        <div className="rounded-2xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 border-2"
              style={{ borderColor: status?.status === 'rejected' ? '#ef4444' : status?.status === 'approved' ? '#22c55e' : '#f59e0b', background: 'var(--bg-surface)' }}>
              {status?.status === 'rejected' ? <XCircle size={32} weight="fill" className="text-red-500" />
                : status?.status === 'approved' ? <CheckCircle size={32} weight="fill" className="text-green-500" />
                : <Clock size={32} weight="fill" className="text-yellow-500" />}
            </div>
            <h1 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>
              {status?.status === 'rejected' ? 'Registration Rejected'
                : status?.status === 'approved' ? 'Registration Approved!'
                : status ? 'Registration Pending Review'
                : 'Check Registration Status'}
            </h1>
          </div>

          {status?.serial_number && (
            <div className="text-center mb-4">
              <span className="px-3 py-1.5 rounded-lg inline-block text-sm font-mono font-bold border"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }}>
                Application #{status.serial_number}
              </span>
            </div>
          )}

          {/* Edit window countdown */}
          {status?.status === 'pending' && timeLeft > 0 && (
            <div className="text-center mb-4 p-3 rounded-xl border" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                Edit window closes in: <span className="font-black text-yellow-500">{formatTime(timeLeft)}</span>
              </p>
              <Button onClick={() => { setEditMode(true); setEditData(reg || {}); }}
                className="mt-2 rounded-xl border font-bold px-4 py-1.5 text-xs flex items-center gap-1.5 mx-auto"
                style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
                <PencilSimple size={12} /> Edit My Details
              </Button>
            </div>
          )}

          {/* Registration details */}
          {reg && !editMode && (
            <div className="rounded-xl p-4 mb-4 space-y-2 text-sm border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)' }}>
              {[
                ['School ID', reg.id_number], ['Full Name', reg.full_name],
                ['Date of Birth', reg.date_of_birth], ['Grade', reg.current_class],
                ['Section', reg.section], ['Email', reg.email],
                reg.phone_number && ['Phone', reg.phone_number],
                ['Student Type', reg.is_ex_student ? 'EX Student' : 'Current Student'],
                reg.date_of_leaving && ['Date of Leaving', reg.date_of_leaving],
                reg.last_class && ['Last Grade', reg.last_class],
                reg.current_status && ['Current Status', reg.current_status],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span style={{ color: 'var(--text-3)' }}>{label}:</span>
                  <span className="font-semibold text-right" style={{ color: 'var(--text-1)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Edit form */}
          {editMode && (
            <div className="rounded-xl p-4 mb-4 space-y-3 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)' }}>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>Edit Your Registration Details</h3>
              {editableFields.map(({ key, label, type }) => (
                reg?.[key] !== undefined && (
                  <div key={key}>
                    <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-2)' }}>{label}</label>
                    <Input type={type} value={editData[key] ?? reg[key] ?? ''}
                      onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                      className="rounded-xl border text-sm"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
                  </div>
                )
              ))}
              <div className="flex gap-2">
                <Button onClick={() => setEditMode(false)} className="flex-1 rounded-xl border font-bold"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>Cancel</Button>
                <Button onClick={saveEdit} className="flex-1 rounded-xl border font-bold"
                  style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>Save Changes</Button>
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {status?.status === 'rejected' && status?.rejection_reason && (
            <div className="rounded-xl p-3 mb-4 border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
              <p className="text-xs font-bold text-red-500 mb-1">Rejection Reason:</p>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{status.rejection_reason}</p>
            </div>
          )}

          {/* Check status form */}
          {!status && (
            <div className="space-y-3 mb-4">
              <p className="text-sm text-center" style={{ color: 'var(--text-2)' }}>Enter your School ID and registration password to check your status.</p>
              <Input value={checkId} onChange={e => setCheckId(e.target.value)}
                placeholder="School ID Number" className="rounded-xl border font-mono"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
              <div className="relative">
                <Input type={showPw ? 'text' : 'password'} value={checkPassword} onChange={e => setCheckPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && checkStatus()}
                  placeholder="Registration Password" className="rounded-xl border pr-10"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                  {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button onClick={checkStatus} disabled={checking} className="w-full rounded-xl border font-bold py-3"
                style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                {checking ? 'Checking...' : 'Check Status'}
              </Button>
            </div>
          )}

          <div className="flex gap-2 justify-center flex-wrap">
            {status?.status === 'approved' && (
              <Button onClick={() => navigate('/login')} className="rounded-xl border font-bold px-6"
                style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                Go to Login
              </Button>
            )}
            <Button onClick={() => navigate('/login')} className="rounded-xl border font-bold px-4 flex items-center gap-1.5"
              style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
              <ArrowLeft size={14} /> Back to Login
            </Button>
          </div>
        </div>

        {/* Ticket System Panel */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <AnonymousTicketSystem
            idNumber={reg?.id_number || checkId}
            name={reg?.full_name || checkId}
          />
        </div>
      </div>
    </div>
  );
};

export default PendingRegistrationPage;
