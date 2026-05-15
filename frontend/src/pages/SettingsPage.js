import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  ArrowLeft, Moon, Bell, Lock, PencilSimple, Key,
  Envelope, UsersThree, SignOut, Info, CaretRight, CaretDown,
  Link as LinkIcon, ShieldCheck
} from '@phosphor-icons/react';
import api from '../utils/api';
import { useTheme } from '../App';
import { TicketSystem } from '../components/TicketSystem';

const SettingsPage = ({ user, onLogout, updateUser }) => {
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profileData, setProfileData] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [saving, setSaving] = useState(false);

  // Personal info
  const [editPhone, setEditPhone] = useState('');

  // Email change (OTP based)
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  // Password change
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Email-based password change (dev mode)
  const [pwLinkOtp, setPwLinkOtp] = useState(searchParams.get('pw_otp') || '');
  const [pwLinkNew, setPwLinkNew] = useState('');
  const [pwLinkConfirm, setPwLinkConfirm] = useState('');
  const [pwLinkSent, setPwLinkSent] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const r = await api.get('/users/me');
      setProfileData(r.data);
      setEditPhone(r.data.phone_number || '');
    } catch {}
  };

  const updateSetting = async (field, value) => {
    try {
      await api.put('/users/me', { [field]: value });
      setProfileData(prev => ({ ...prev, [field]: value }));
      if (updateUser) updateUser({ ...user, [field]: value });
      toast.success('Setting saved');
    } catch { toast.error('Failed to update'); }
  };

  const savePhone = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', { phone_number: editPhone });
      toast.success('Phone number updated');
      loadProfile();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  // Email change - step 1: send OTP to NEW email
  const requestEmailOtp = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) { toast.error('Enter a valid email'); return; }
    setSaving(true);
    try {
      const r = await api.post('/auth/request-email-change', { new_email: newEmail });
      toast.success(r.data.message);
      if (r.data.dev_otp) toast.info(`Dev OTP: ${r.data.dev_otp}`);
      setEmailOtpSent(true);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  // Email change - step 2: verify OTP
  const verifyEmailOtp = async () => {
    if (!emailOtp.trim()) { toast.error('Enter OTP'); return; }
    setSaving(true);
    try {
      const r = await api.post('/auth/verify-email-change', { otp: emailOtp });
      toast.success('Email updated to ' + r.data.new_email);
      if (updateUser) updateUser({ ...user, email: r.data.new_email });
      setEmailOtpSent(false); setNewEmail(''); setEmailOtp('');
      loadProfile();
    } catch (e) { toast.error(e.response?.data?.detail || 'Invalid OTP'); }
    finally { setSaving(false); }
  };

  // Password change (old password method)
  const changePassword = async () => {
    if (!oldPw || !newPw) { toast.error('Fill all fields'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length < 6) { toast.error('Min 6 characters'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { old_password: oldPw, new_password: newPw });
      toast.success('Password changed!');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  // Email-based password change (dev mode)
  const requestPwLink = async () => {
    setSaving(true);
    try {
      const r = await api.post('/auth/request-password-change-link');
      toast.success(r.data.message);
      if (r.data.dev_otp) { toast.info(`DEV CODE: ${r.data.dev_otp}`, { duration: 15000 }); setPwLinkOtp(r.data.dev_otp); }
      if (r.data.dev_link) toast.info(`DEV Link: ${r.data.dev_link}`, { duration: 15000 });
      setPwLinkSent(true);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const verifyPwLink = async () => {
    if (!pwLinkOtp || !pwLinkNew) { toast.error('Fill all fields'); return; }
    if (pwLinkNew !== pwLinkConfirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.post('/auth/verify-password-change-link', { otp: pwLinkOtp, new_password: pwLinkNew });
      toast.success('Password changed via email verification!');
      setPwLinkOtp(''); setPwLinkNew(''); setPwLinkConfirm(''); setPwLinkSent(false);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const Section = ({ id, title, icon, badge, children }) => {
    const isOpen = activeSection === id;
    return (
      <div className="rounded-2xl border overflow-hidden mb-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
        <button className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setActiveSection(isOpen ? null : id)}>
          <div className="flex items-center gap-3">
            <span style={{ color: 'var(--blue)' }}>{icon}</span>
            <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>{title}</span>
            {badge && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{badge}</span>}
          </div>
          {isOpen ? <CaretDown size={16} style={{ color: 'var(--text-3)' }} /> : <CaretRight size={16} style={{ color: 'var(--text-3)' }} />}
        </button>
        {isOpen && <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-c)' }}>{children}</div>}
      </div>
    );
  };

  const Toggle = ({ label, desc, checked, onChange }) => (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border-c)' }}>
      <div className="flex-1 pr-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{desc}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );

  const Field = ({ label, value, onChange, type = 'text', disabled, placeholder }) => (
    <div className="py-2">
      <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        placeholder={placeholder}
        className="rounded-xl border text-sm"
        style={{ background: disabled ? 'var(--bg-surface)' : 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)', opacity: disabled ? 0.7 : 1 }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={() => navigate('/')} className="rounded-xl border font-bold p-2"
            style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
            <ArrowLeft size={18} weight="bold" />
          </Button>
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>Settings</h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Manage your account</p>
          </div>
        </div>

        {/* Account card */}
        <div className="rounded-2xl border p-4 mb-4 flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl"
            style={{ background: 'var(--blue)', color: '#fff' }}>
            {(user?.display_name || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black truncate" style={{ color: 'var(--text-1)' }}>{user?.full_name || user?.display_name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
              @{user?.username || user?.id_number} · Grade {user?.current_class}
            </p>
          </div>
          <Button onClick={() => navigate(`/profile/${user?.id_number}`)}
            className="text-xs font-bold rounded-xl border px-3 py-2"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', borderColor: 'var(--border-c)' }}>
            Profile
          </Button>
        </div>

        {/* Appearance */}
        <Section id="appearance" title="Appearance" icon={<Moon size={18} />}>
          <div className="pt-3">
            <Toggle label="Dark Mode" desc="Switch between light and dark themes" checked={darkMode} onChange={toggleDarkMode} />
          </div>
        </Section>

        {/* Phone */}
        <Section id="phone" title="Phone Number" icon={<Info size={18} />}>
          <div className="pt-3 space-y-2">
            <Field label="Phone Number" value={editPhone} onChange={setEditPhone} type="tel" placeholder="+973 XXXX XXXX" />
            <Button onClick={savePhone} disabled={saving} className="w-full rounded-xl border font-bold py-2.5"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              Save Phone Number
            </Button>
            <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
              School ID and Full Name can only be changed by contacting admin.
            </p>
          </div>
        </Section>

        {/* Email change - OTP based */}
        <Section id="email" title="Change Email" icon={<Envelope size={18} />}>
          <div className="pt-3 space-y-3">
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Current: <strong>{profileData?.email || user?.email || '—'}</strong>
            </p>
            {!emailOtpSent ? (
              <>
                <Field label="New Email Address" value={newEmail} onChange={setNewEmail} type="email" placeholder="new@example.com" />
                <Button onClick={requestEmailOtp} disabled={saving} className="w-full rounded-xl border font-bold py-2.5"
                  style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                  Send Verification OTP to New Email
                </Button>
              </>
            ) : (
              <>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--blue)' }}>OTP sent to {newEmail}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Check your inbox and enter the code below.</p>
                </div>
                <Field label="6-Digit OTP" value={emailOtp} onChange={setEmailOtp} placeholder="••••••" />
                <div className="flex gap-2">
                  <Button onClick={() => { setEmailOtpSent(false); setEmailOtp(''); }} className="flex-1 rounded-xl border font-bold py-2.5"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
                    Cancel
                  </Button>
                  <Button onClick={verifyEmailOtp} disabled={saving} className="flex-1 rounded-xl border font-bold py-2.5"
                    style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                    Verify & Change Email
                  </Button>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Password change */}
        <Section id="password" title="Change Password" icon={<Key size={18} />}>
          <div className="pt-3 space-y-2">
            <Field label="Current Password" value={oldPw} onChange={setOldPw} type="password" placeholder="Your current password" />
            <Field label="New Password" value={newPw} onChange={setNewPw} type="password" placeholder="Min 6 characters" />
            <Field label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Repeat new password" />
            <Button onClick={changePassword} disabled={saving} className="w-full rounded-xl border font-bold py-2.5"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              Change Password
            </Button>
          </div>
        </Section>

        {/* Email-based password change (dev mode) */}
        <Section id="pw_email" title="Password Reset via Email" icon={<ShieldCheck size={18} />} badge="DEV MODE">
          <div className="pt-3 space-y-3">
            <div className="p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>⚠️ Development Mode</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                In production this sends an email. Currently the OTP is shown on screen for testing.
              </p>
            </div>
            {!pwLinkSent ? (
              <Button onClick={requestPwLink} disabled={saving} className="w-full rounded-xl border font-bold py-2.5"
                style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                Send Password Reset Code to My Email
              </Button>
            ) : (
              <>
                <Field label="Reset Code (from email)" value={pwLinkOtp} onChange={setPwLinkOtp} placeholder="6-digit code" />
                <Field label="New Password" value={pwLinkNew} onChange={setPwLinkNew} type="password" placeholder="Min 6 characters" />
                <Field label="Confirm Password" value={pwLinkConfirm} onChange={setPwLinkConfirm} type="password" placeholder="Repeat" />
                <div className="flex gap-2">
                  <Button onClick={() => setPwLinkSent(false)} className="flex-1 rounded-xl border font-bold py-2.5"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
                    Cancel
                  </Button>
                  <Button onClick={verifyPwLink} disabled={saving} className="flex-1 rounded-xl border font-bold py-2.5"
                    style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                    Set New Password
                  </Button>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Privacy */}
        {profileData && (
          <Section id="privacy" title="Privacy" icon={<Lock size={18} />}>
            <div className="pt-3">
              <Toggle label="Public Profile" desc="Anyone can see your profile"
                checked={profileData.is_profile_public ?? true} onChange={v => updateSetting('is_profile_public', v)} />
              <Toggle label="Show Age on Profile" desc="Display your age publicly"
                checked={profileData.show_age ?? true} onChange={v => updateSetting('show_age', v)} />
              <Toggle label="Public Followers List"
                checked={profileData.is_followers_public ?? true} onChange={v => updateSetting('is_followers_public', v)} />
              <Toggle label="Public Following List"
                checked={profileData.is_following_public ?? true} onChange={v => updateSetting('is_following_public', v)} />
              <Toggle label="Public Friends List"
                checked={profileData.is_friends_public ?? true} onChange={v => updateSetting('is_friends_public', v)} />
            </div>
          </Section>
        )}

        {/* Notifications */}
        <Section id="notifications" title="Notifications" icon={<Bell size={18} />}>
          <div className="pt-3">
            {profileData && (
              <Toggle label="Browser Push Notifications" desc="Get notified even when the tab is in background"
                checked={profileData.push_notifications_enabled ?? true}
                onChange={async (v) => {
                  if (v && 'Notification' in window) {
                    const p = await Notification.requestPermission();
                    if (p !== 'granted') { toast.error('Browser notifications blocked'); return; }
                  }
                  updateSetting('push_notifications_enabled', v);
                }} />
            )}
          </div>
        </Section>

        {/* Friends */}
        <Section id="friends" title="Friends & Social" icon={<UsersThree size={18} />}>
          <div className="pt-3">
            <Button onClick={() => navigate('/friends')} className="w-full rounded-xl border font-bold py-2.5"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              Manage Friends & Follow Requests
            </Button>
          </div>
        </Section>

        {/* Help */}
        <Section id="support" title="Help & Support" icon={<Info size={18} />}>
          <div className="pt-3">
            <TicketSystem user={user} />
          </div>
        </Section>

        {/* Account Info */}
        <Section id="info" title="Account Info" icon={<Info size={18} />}>
          <div className="pt-3 space-y-0">
            {[
              ['School ID', user?.id_number],
              ['Full Name', user?.full_name],
              ['Email', profileData?.email || user?.email],
              ['Role', user?.role || 'Student'],
              ['Grade', `${user?.current_class || '?'} - ${user?.section || '?'}`],
              ['Type', user?.is_ex_student ? 'EX Student' : 'Current Student'],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-2.5 border-b last:border-b-0 text-sm" style={{ borderColor: 'var(--border-c)' }}>
                <span style={{ color: 'var(--text-3)' }}>{label}</span>
                <span className="font-semibold text-right" style={{ color: 'var(--text-1)' }}>{val || '—'}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Sign out */}
        <div className="rounded-2xl border p-4 mb-6" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <Button onClick={onLogout} className="w-full rounded-xl border-2 font-bold py-3 flex items-center justify-center gap-2"
            style={{ background: 'transparent', color: '#ef4444', borderColor: '#ef4444' }}>
            <SignOut size={16} weight="bold" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
