import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  ArrowLeft, Moon, Sun, Bell, Lock, Eye, UserCircle, Ticket,
  Key, Envelope, Phone, PencilSimple, Shield, UsersThree,
  SignOut, Info, Palette, Globe, User, CaretRight, CaretDown
} from '@phosphor-icons/react';
import api from '../utils/api';
import { useTheme } from '../App';
import { TicketSystem } from '../components/TicketSystem';

const SettingsPage = ({ user, onLogout, updateUser }) => {
  const { darkMode, toggleDarkMode } = useTheme();
  const [profileData, setProfileData] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  // Personal info edit state
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const r = await api.get('/users/me');
      setProfileData(r.data);
      setEditEmail(r.data.email || '');
      setEditPhone(r.data.phone_number || '');
    } catch {}
  };

  const updateSetting = async (field, value) => {
    try {
      await api.put('/users/me', { [field]: value });
      setProfileData(prev => ({ ...prev, [field]: value }));
      if (updateUser) updateUser({ ...user, [field]: value });
      toast.success('Setting updated');
    } catch { toast.error('Failed to update'); }
  };

  const savePersonalInfo = async () => {
    setSaving(true);
    try {
      const updates = {};
      if (editEmail !== profileData?.email) updates.email = editEmail;
      if (editPhone !== profileData?.phone_number) updates.phone_number = editPhone;
      if (Object.keys(updates).length > 0) {
        await api.put('/users/me', updates);
        setProfileData(prev => ({ ...prev, ...updates }));
        if (updateUser) updateUser({ ...user, ...updates });
        toast.success('Personal info updated');
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!oldPassword || !newPassword) { toast.error('Fill in all password fields'); return; }
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword });
      toast.success('Password changed successfully');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  const togglePushNotifications = async () => {
    const enabled = !(profileData?.push_notifications_enabled ?? true);
    if (enabled && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast.error('Browser notifications blocked'); return; }
    }
    updateSetting('push_notifications_enabled', enabled);
  };

  const Section = ({ id, title, icon, children }) => {
    const isOpen = activeSection === id;
    return (
      <div className="rounded-2xl border overflow-hidden mb-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
        <button className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setActiveSection(isOpen ? null : id)}>
          <div className="flex items-center gap-3">
            <span style={{ color: 'var(--blue)' }}>{icon}</span>
            <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>{title}</span>
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
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  const Field = ({ label, value, onChange, type = 'text', disabled }) => (
    <div className="py-2">
      <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-2)' }}>{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="rounded-xl border text-sm"
        style={{ background: disabled ? 'var(--bg-surface)' : 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto p-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={() => navigate('/')} className="rounded-xl border font-bold p-2"
            style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
            <ArrowLeft size={18} weight="bold" />
          </Button>
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>Settings</h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Manage your account and preferences</p>
          </div>
        </div>

        {/* Account Info Card */}
        <div className="rounded-2xl border p-4 mb-4 flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl"
            style={{ background: 'var(--blue)', color: '#fff' }}>
            {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-base truncate" style={{ color: 'var(--text-1)' }}>{user?.display_name || user?.full_name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>@{user?.username || user?.id_number} • Grade {user?.current_class}</p>
            {user?.role && user.role !== 'user' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--blue)' }}>{user.role}</span>
            )}
          </div>
          <Button onClick={() => navigate(`/profile/${user?.id_number}`)}
            className="rounded-xl border text-xs font-bold px-3 py-2"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', borderColor: 'var(--border-c)' }}>
            View Profile
          </Button>
        </div>

        {/* Appearance */}
        <Section id="appearance" title="Appearance" icon={<Palette size={18} />}>
          <div className="pt-3">
            <Toggle label="Dark Mode" desc="Switch between light and dark themes" checked={darkMode} onChange={toggleDarkMode} />
          </div>
        </Section>

        {/* Personal Information */}
        <Section id="personal" title="Personal Information" icon={<User size={18} />}>
          <div className="pt-3 space-y-1">
            <Field label="School ID (Cannot be changed)" value={user?.id_number || ''} onChange={() => {}} disabled />
            <Field label="Full Name (Contact admin to change)" value={user?.full_name || ''} onChange={() => {}} disabled />
            <Field label="Email Address" value={editEmail} onChange={setEditEmail} type="email" />
            <Field label="Phone Number" value={editPhone} onChange={setEditPhone} type="tel" />
            <div className="pt-2">
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>To change your full name or school ID, contact an admin.</p>
            </div>
            <Button onClick={savePersonalInfo} disabled={saving} className="w-full rounded-xl border font-bold py-2.5 mt-2"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Section>

        {/* Change Password */}
        <Section id="password" title="Change Password" icon={<Key size={18} />}>
          <div className="pt-3 space-y-1">
            <Field label="Current Password" value={oldPassword} onChange={setOldPassword} type="password" />
            <Field label="New Password" value={newPassword} onChange={setNewPassword} type="password" />
            <Field label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} type="password" />
            <Button onClick={changePassword} disabled={saving} className="w-full rounded-xl border font-bold py-2.5 mt-2"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              {saving ? 'Saving...' : 'Change Password'}
            </Button>
          </div>
        </Section>

        {/* Notifications */}
        <Section id="notifications" title="Notifications" icon={<Bell size={18} />}>
          <div className="pt-3">
            <Toggle label="Push Notifications" desc="Browser notifications for likes, comments, DMs"
              checked={profileData?.push_notifications_enabled ?? true} onChange={togglePushNotifications} />
          </div>
        </Section>

        {/* Privacy */}
        {profileData && (
          <Section id="privacy" title="Privacy" icon={<Lock size={18} />}>
            <div className="pt-3">
              <Toggle label="Public Profile" desc="Anyone can see your profile page"
                checked={profileData.is_profile_public ?? true} onChange={v => updateSetting('is_profile_public', v)} />
              <Toggle label="Show Age on Profile" desc="Display your age publicly on your profile"
                checked={profileData.show_age ?? true} onChange={v => updateSetting('show_age', v)} />
              <Toggle label="Public Followers" desc="Anyone can see who follows you"
                checked={profileData.is_followers_public ?? true} onChange={v => updateSetting('is_followers_public', v)} />
              <Toggle label="Public Following" desc="Anyone can see who you follow"
                checked={profileData.is_following_public ?? true} onChange={v => updateSetting('is_following_public', v)} />
              <Toggle label="Public Friends List" desc="Anyone can see your friends list"
                checked={profileData.is_friends_public ?? true} onChange={v => updateSetting('is_friends_public', v)} />
            </div>
          </Section>
        )}

        {/* Profile Customization */}
        <Section id="profile_edit" title="Edit Profile" icon={<PencilSimple size={18} />}>
          <div className="pt-3">
            <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>Update your profile picture, banner, bio, and username.</p>
            <Button onClick={() => navigate(`/profile/${user?.id_number}`)}
              className="w-full rounded-xl border font-bold py-2.5"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              Go to My Profile to Edit
            </Button>
          </div>
        </Section>

        {/* Friends */}
        <Section id="friends" title="Friends & Social" icon={<UsersThree size={18} />}>
          <div className="pt-3">
            <Button onClick={() => navigate('/friends')} className="w-full rounded-xl border font-bold py-2.5"
              style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
              Manage Friends & Requests
            </Button>
          </div>
        </Section>

        {/* Help & Support */}
        <Section id="support" title="Help & Support" icon={<Ticket size={18} />}>
          <div className="pt-3">
  <TicketSystem user={user} />
          </div>
        </Section>

        {/* Account Info */}
        <Section id="account_info" title="Account Info" icon={<Info size={18} />}>
          <div className="pt-3 space-y-2">
            {[
              ['School ID', user?.id_number],
              ['Full Name', user?.full_name],
              ['Email', user?.email],
              ['Role', user?.role || 'Student'],
              ['Grade', `${user?.current_class || '?'} - ${user?.section || '?'}`],
              ['Account Type', user?.is_ex_student ? 'EX Student' : 'Current Student'],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-1.5 border-b last:border-b-0 text-sm" style={{ borderColor: 'var(--border-c)' }}>
                <span style={{ color: 'var(--text-3)' }}>{label}</span>
                <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{val || '—'}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Danger Zone */}
        <div className="rounded-2xl border p-4 mb-6" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <h3 className="font-black text-sm mb-3 text-red-500">Danger Zone</h3>
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
