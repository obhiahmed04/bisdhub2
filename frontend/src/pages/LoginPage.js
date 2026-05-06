import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Eye, EyeSlash, Key } from '@phosphor-icons/react';
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
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { id_number: idNumber, password });
      const { token, user } = response.data;
      onLogin(token, user);
      navigate('/');
    } catch (error) {
      const detail = error.response?.data?.detail || 'Login failed';
      if (detail.includes('pending')) {
        toast.info('Your registration is still pending approval');
        navigate('/pending-registration');
      } else {
        toast.error(detail);
      }
    } finally { setLoading(false); }
  };

  const requestReset = async () => {
    try {
      const response = await axios.post(`${API_BASE}/auth/password-reset/request`, { id_number: resetId });
      toast.success(response.data.message);
      if (response.data.dev_otp) toast.info(`Dev OTP: ${response.data.dev_otp}`);
      setResetStep(2);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to send reset OTP'); }
  };

  const verifyReset = async () => {
    try {
      await axios.post(`${API_BASE}/auth/password-reset/verify`, { id_number: resetId, otp: resetOtp, new_password: newPassword });
      toast.success('Password reset! You can now login.');
      setResetOpen(false);
      setResetStep(1);
    } catch (error) { toast.error(error.response?.data?.detail || 'Reset failed'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/bisdhub-logo.png" alt="BISD HUB" className="w-44 h-auto mx-auto mb-3 object-contain" data-testid="login-logo" />
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Your school community</p>
        </div>

        <div className="card p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>ID Number</Label>
              <Input data-testid="login-id-input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
                className="input-styled" placeholder="Enter your ID number" />
            </div>
            <div>
              <Label className="badge-mono mb-2 block" style={{ color: 'var(--text-2)' }}>Password</Label>
              <div className="relative">
                <Input data-testid="login-password-input" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input-styled pr-10" placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-3)' }}>
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button data-testid="login-submit-button" type="submit" disabled={loading}
              className="w-full btn btn-primary py-3">
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={() => setResetOpen(true)} className="text-xs font-semibold hover:underline" style={{ color: 'var(--blue)' }}>
              Forgot password?
            </button>
          </div>
        </div>

        <div className="mt-4 text-center space-y-2">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            New here? <Link to="/register" data-testid="register-link" className="font-bold hover:underline" style={{ color: 'var(--blue)' }}>Register</Link>
          </p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            <Link to="/pending-registration" data-testid="check-status-link" className="font-bold hover:underline" style={{ color: 'var(--text-3)' }}>
              Check registration status
            </Link>
          </p>
        </div>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="card max-w-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <DialogHeader>
            <DialogTitle className="heading text-lg font-black flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <Key size={18} weight="bold" /> Reset Password
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-2)' }}>
              {resetStep === 1 ? 'Enter your ID number to receive a reset OTP via email' : 'Enter the OTP and your new password'}
            </DialogDescription>
          </DialogHeader>

          {resetStep === 1 ? (
            <div className="space-y-3 py-2">
              <Input value={resetId} onChange={(e) => setResetId(e.target.value)} className="input-styled" placeholder="Your ID number" />
              <Button onClick={requestReset} className="w-full btn btn-primary py-2.5">Send Reset OTP</Button>
              <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
                Or <button onClick={() => { setResetOpen(false); navigate('/pending-registration'); }} className="font-bold hover:underline" style={{ color: 'var(--blue)' }}>
                  contact admin
                </button> for help
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <Input value={resetOtp} onChange={(e) => setResetOtp(e.target.value)} className="input-styled" placeholder="6-digit OTP" />
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-styled" placeholder="New password" />
              <Button onClick={verifyReset} className="w-full btn btn-primary py-2.5">Reset Password</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
