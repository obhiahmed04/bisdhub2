import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Eye, EyeSlash, Key, MagnifyingGlass, ArrowRight } from '@phosphor-icons/react';
import axios from 'axios';
import { API_BASE } from '../utils/api';

const LoginPage = ({ onLogin }) => {
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetId, setResetId] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkId, setCheckId] = useState('');
  const [checkPassword, setCheckPassword] = useState('');
  const [showCheckPw, setShowCheckPw] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!idNumber.trim() || !password.trim()) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { id_number: idNumber.trim(), password });
      const { token, user } = res.data;
      onLogin(token, user);
      navigate('/');
    } catch (error) {
      const detail = error.response?.data?.detail || 'Login failed';
      toast.error(detail);
    } finally { setLoading(false); }
  };

  const requestReset = async () => {
    if (!resetId.trim()) { toast.error('Enter your ID number'); return; }
    try {
      const res = await axios.post(`${API_BASE}/auth/password-reset/request`, { id_number: resetId.trim() });
      toast.success(res.data.message);
      if (res.data.dev_otp) toast.info(`Dev OTP: ${res.data.dev_otp}`);
      setResetStep(2);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to send OTP'); }
  };

  const verifyReset = async () => {
    if (!resetOtp.trim() || !newPassword.trim()) { toast.error('Fill in all fields'); return; }
    try {
      await axios.post(`${API_BASE}/auth/password-reset/verify`, { id_number: resetId, otp: resetOtp, new_password: newPassword });
      toast.success('Password reset! You can now login.');
      setResetOpen(false); setResetStep(1); setResetId(''); setResetOtp(''); setNewPassword('');
    } catch (e) { toast.error(e.response?.data?.detail || 'Reset failed'); }
  };

  const checkStatus = async () => {
    if (!checkId.trim()) { toast.error('Enter your ID number'); return; }
    if (!checkPassword.trim()) { toast.error('Enter your registration password'); return; }
    setCheckLoading(true);
    try {
      // First verify password access
      const verifyRes = await axios.post(`${API_BASE}/auth/verify-registration-access`, {
        id_number: checkId.trim(), password: checkPassword
      }).catch(() => ({ data: { valid: false } }));
      
      const res = await axios.get(`${API_BASE}/auth/check-registration/${checkId.trim()}`);
      
      if (res.data.status === 'not_found') {
        setCheckResult({ status: 'not_found' });
      } else if (!verifyRes.data.valid) {
        toast.error('Incorrect password');
        setCheckResult(null);
      } else {
        setCheckResult(res.data);
      }
    } catch {
      setCheckResult({ status: 'not_found' });
    } finally { setCheckLoading(false); }
  };

  const statusConfig = {
    pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⏳', label: 'Pending Approval', msg: 'Your registration is under review. Check back later.' },
    approved: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '✅', label: 'Approved!', msg: 'Your registration was approved. Please login.' },
    rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '❌', label: 'Not Approved', msg: 'Your registration was not approved.' },
    not_found: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: '🔍', label: 'Not Found', msg: 'No registration found for this ID. Check the ID or register.' },
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">

        {/* Logo + Title */}
        <div className="text-center mb-8">
          <img src="/bisdhub-logo.png" alt="BISD HUB"
            className="w-24 h-24 mx-auto mb-3 object-contain rounded-2xl"
            onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
          />
          <div className="w-20 h-20 mx-auto mb-3 rounded-2xl items-center justify-center border-2 text-2xl font-black text-white"
            style={{ background: 'var(--blue)', borderColor: 'var(--blue)', display: 'none' }}>B</div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>BISD HUB</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Your school community</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <h2 className="text-lg font-black mb-5" style={{ color: 'var(--text-1)' }}>Sign In</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>School ID Number</Label>
              <Input value={idNumber} onChange={e => setIdNumber(e.target.value)}
                className="rounded-xl border-2 font-mono" placeholder="Your school ID"
                style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>Password</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="rounded-xl border-2 pr-10" placeholder="Enter your password"
                  style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setResetOpen(true)}
                className="text-xs font-semibold hover:underline" style={{ color: 'var(--blue)' }}>
                Forgot password?
              </button>
            </div>
            <Button type="submit" disabled={loading} className="w-full py-3 font-bold rounded-xl border-2 flex items-center justify-center gap-2"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              {loading ? 'Signing in...' : <><span>Sign In</span><ArrowRight size={16} weight="bold" /></>}
            </Button>
          </form>
        </div>

        {/* Bottom Links */}
        <div className="mt-4 space-y-2 text-center">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            New here?{' '}
            <Link to="/register" className="font-bold hover:underline" style={{ color: 'var(--blue)' }}>Register for BISD HUB</Link>
          </p>
          <button onClick={() => { setCheckOpen(true); setCheckResult(null); setCheckId(''); }}
            className="text-sm font-semibold hover:underline flex items-center gap-1.5 mx-auto"
            style={{ color: 'var(--text-3)' }}>
            <MagnifyingGlass size={14} /> Check registration status
          </button>
        </div>
      </div>

      {/* Check Status Dialog */}
      <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
        <DialogContent className="max-w-sm rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <MagnifyingGlass size={18} /> Check Registration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="flex gap-2">
              <Input value={checkId} onChange={e => setCheckId(e.target.value)}
                className="rounded-xl border-2 font-mono" placeholder="Your School ID"
                style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
              <div className="relative">
                <Input type={showCheckPw ? 'text' : 'password'} value={checkPassword} onChange={e => setCheckPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && checkStatus()}
                  className="rounded-xl border-2 pr-9" placeholder="Registration Password"
                  style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                <button type="button" onClick={() => setShowCheckPw(!showCheckPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                  {showCheckPw ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <Button onClick={checkStatus} disabled={checkLoading}
                className="w-full rounded-xl border-2 font-bold py-2.5"
                style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                {checkLoading ? 'Checking...' : 'Check Status'}
              </Button>
            </div>
            {checkResult && (() => {
              const cfg = statusConfig[checkResult.status] || statusConfig.not_found;
              return (
                <div className="rounded-xl p-4 border" style={{ background: cfg.bg, borderColor: cfg.color }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{cfg.icon}</span>
                    <span className="font-black text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>{cfg.msg}</p>
                  {checkResult.status === 'rejected' && checkResult.rejection_reason && (
                    <p className="text-xs mt-1 font-semibold" style={{ color: cfg.color }}>Reason: {checkResult.rejection_reason}</p>
                  )}
                  {checkResult.serial_number && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Application #{checkResult.serial_number}</p>
                  )}
                  {checkResult.status === 'pending' && checkResult.reg_id && (
                    <button onClick={() => {
                      setCheckOpen(false);
                      navigate('/pending-registration', { state: { regId: checkResult.reg_id, registration: checkResult.registration, serialNumber: checkResult.serial_number, editableUntil: checkResult.editable_until }});
                    }} className="text-xs font-bold hover:underline mt-2 block" style={{ color: cfg.color }}>
                      View registration details →
                    </button>
                  )}
                  {checkResult.status === 'approved' && (
                    <button onClick={() => setCheckOpen(false)}
                      className="text-xs font-bold hover:underline mt-2 block" style={{ color: cfg.color }}>
                      Go to login →
                    </button>
                  )}
                </div>
              );
            })()}
            {!checkResult && (
              <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>Enter your School ID to check if your registration was received.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={open => { setResetOpen(open); if (!open) { setResetStep(1); setResetId(''); setResetOtp(''); setNewPassword(''); } }}>
        <DialogContent className="max-w-sm rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <Key size={18} weight="bold" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          {resetStep === 1 ? (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>Enter your School ID to receive a reset OTP via email.</p>
              <Input value={resetId} onChange={e => setResetId(e.target.value)} onKeyDown={e => e.key === 'Enter' && requestReset()}
                className="rounded-xl border-2 font-mono" placeholder="Your School ID"
                style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
              <Button onClick={requestReset} className="w-full py-3 font-bold rounded-xl border-2"
                style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                Send Reset OTP
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>Enter the OTP sent to your email and set a new password.</p>
              <Input value={resetOtp} onChange={e => setResetOtp(e.target.value)}
                className="rounded-xl border-2 font-mono text-center tracking-widest" placeholder="6-digit OTP"
                style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
              <div className="relative">
                <Input type={showNewPassword ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="rounded-xl border-2 pr-10" placeholder="New password"
                  style={{ borderColor: 'var(--border-c)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                  {showNewPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button onClick={verifyReset} className="w-full py-3 font-bold rounded-xl border-2"
                style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                Reset Password
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
