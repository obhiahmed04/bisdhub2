import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Moon, Sun, Bell, Lock, Eye, UserCircle } from '@phosphor-icons/react';
import api from '../utils/api';
import { useTheme } from '../App';

const SettingsPage = ({ user, onLogout, updateUser }) => {
  const { darkMode, toggleDarkMode } = useTheme();
  const [profileData, setProfileData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try { const r = await api.get('/users/me'); setProfileData(r.data); } catch (e) {}
  };

  const updateSetting = async (field, value) => {
    try {
      await api.put('/users/me', { [field]: value });
      setProfileData(prev => ({ ...prev, [field]: value }));
      if (updateUser) updateUser({ ...user, [field]: value });
      toast.success('Updated');
    } catch (e) { toast.error('Failed'); }
  };

  const togglePushNotifications = async () => {
    const enabled = !(profileData?.push_notifications_enabled ?? true);
    if (enabled && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast.error('Browser notifications blocked. Enable them in browser settings.'); return; }
    }
    updateSetting('push_notifications_enabled', enabled);
  };

  const Section = ({ title, icon, children }) => (
    <div className="card p-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h2 className="heading text-xs font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
        {icon} {title}
      </h2>
      {children}
    </div>
  );

  const Toggle = ({ label, desc, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
      <div><p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{label}</p>
        {desc && <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{desc}</p>}</div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={() => navigate('/')} data-testid="settings-back-button" className="btn btn-ghost px-3 py-2">
            <ArrowLeft size={16} weight="bold" />
          </Button>
          <h1 className="heading text-xl font-black" style={{ color: 'var(--text-1)' }} data-testid="settings-title">Settings</h1>
        </div>

        {/* Appearance */}
        <Section title="APPEARANCE" icon={darkMode ? <Moon size={14} weight="bold" /> : <Sun size={14} weight="bold" />}>
          <Toggle label="Dark Mode" desc="Switch between light and dark themes" checked={darkMode} onChange={toggleDarkMode} />
        </Section>

        {/* Notifications */}
        <Section title="NOTIFICATIONS" icon={<Bell size={14} weight="bold" />}>
          <Toggle label="Push Notifications" desc="Receive browser notifications for likes, comments, DMs"
            checked={profileData?.push_notifications_enabled ?? true} onChange={togglePushNotifications} />
        </Section>

        {/* Privacy */}
        {profileData && (
          <Section title="PRIVACY" icon={<Lock size={14} weight="bold" />}>
            <Toggle label="Public Profile" desc="Anyone can view your profile" checked={profileData.is_profile_public ?? true} onChange={(v) => updateSetting('is_profile_public', v)} />
            <Toggle label="Public Followers" desc="Anyone can see your followers" checked={profileData.is_followers_public ?? true} onChange={(v) => updateSetting('is_followers_public', v)} />
            <Toggle label="Public Following" desc="Anyone can see who you follow" checked={profileData.is_following_public ?? true} onChange={(v) => updateSetting('is_following_public', v)} />
            <Toggle label="Public Friends List" desc="Anyone can see your friends" checked={profileData.is_friends_public ?? true} onChange={(v) => updateSetting('is_friends_public', v)} />
          </Section>
        )}

        {/* Friends shortcut */}
        <Section title="FRIENDS" icon={<UserCircle size={14} weight="bold" />}>
          <Button onClick={() => navigate('/friends')} data-testid="go-to-friends-page" className="btn btn-primary w-full py-2.5 text-sm">
            Manage Friends & Requests
          </Button>
        </Section>

        {/* Account Info */}
        <Section title="ACCOUNT" icon={<Eye size={14} weight="bold" />}>
          <div className="space-y-2 text-sm">
            {[
              ['ID', user.id_number], ['Name', user.full_name], ['Email', user.email],
              ['Role', user.role], ['Class', `${user.current_class} - ${user.section}`]
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between">
                <span style={{ color: 'var(--text-3)' }}>{label}:</span>
                <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{val}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Help */}
        <Section title="HELP & SUPPORT" icon="?">
          <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>Need help? Contact admin.</p>
          <Button onClick={() => navigate('/pending-registration')} className="btn btn-ghost text-xs">Open Help Chat</Button>
        </Section>

        <Button onClick={onLogout} data-testid="settings-logout-button" className="w-full btn btn-danger py-3 mb-8">Logout</Button>
      </div>
    </div>
  );
};

export default SettingsPage;
