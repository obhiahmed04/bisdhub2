import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import { PencilSimple, Camera, Upload } from '@phosphor-icons/react';
import api from '../utils/api';
import { API_BASE } from '../utils/api';

const EditProfileDialog = ({ user, onProfileUpdated }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: user.username || user.id_number?.toLowerCase() || '',
    bio: user.bio || '',
    profile_picture: user.profile_picture || '',
    banner_image: user.banner_image || '',
    is_profile_public: user.is_profile_public ?? true,
    is_followers_public: user.is_followers_public ?? true,
    is_following_public: user.is_following_public ?? true
  });
  const [loading, setLoading] = useState(false);
  const [uploadingPfp, setUploadingPfp] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const pfpInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const handleOpenChange = (isOpen) => {
    setOpen(isOpen);
    if (isOpen) {
      setFormData({
        username: user.username || user.id_number?.toLowerCase() || '',
        bio: user.bio || '',
        profile_picture: user.profile_picture || '',
        banner_image: user.banner_image || '',
        is_profile_public: user.is_profile_public ?? true,
        is_followers_public: user.is_followers_public ?? true,
        is_following_public: user.is_following_public ?? true
      });
    }
  };

  const uploadImage = async (file, type) => {
    const form = new FormData();
    form.append('file', file);
    
    if (type === 'pfp') setUploadingPfp(true);
    else setUploadingBanner(true);
    
    try {
      const response = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const imageUrl = `${backendUrl}${response.data.url}`;
      
      if (type === 'pfp') {
        setFormData(prev => ({ ...prev, profile_picture: imageUrl }));
      } else {
        setFormData(prev => ({ ...prev, banner_image: imageUrl }));
      }
      toast.success(`${type === 'pfp' ? 'Profile picture' : 'Banner'} uploaded!`);
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      if (type === 'pfp') setUploadingPfp(false);
      else setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData = {};
      if (formData.username !== (user.username || user.id_number?.toLowerCase() || '')) updateData.username = formData.username;
      if (formData.bio !== user.bio) updateData.bio = formData.bio;
      if (formData.profile_picture !== user.profile_picture) updateData.profile_picture = formData.profile_picture;
      if (formData.banner_image !== user.banner_image) updateData.banner_image = formData.banner_image;
      if (formData.is_profile_public !== user.is_profile_public) updateData.is_profile_public = formData.is_profile_public;
      if (formData.is_followers_public !== user.is_followers_public) updateData.is_followers_public = formData.is_followers_public;
      if (formData.is_following_public !== user.is_following_public) updateData.is_following_public = formData.is_following_public;
      
      if (Object.keys(updateData).length === 0) {
        toast.info('No changes to save');
        setOpen(false);
        return;
      }

      const response = await api.put('/users/me', updateData);
      toast.success('Profile updated!');
      setOpen(false);
      if (onProfileUpdated) onProfileUpdated(response.data);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button data-testid="edit-profile-button" onClick={() => setOpen(true)}
        className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
        <PencilSimple size={16} weight="bold" /> Edit Profile
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-white border-2 border-[#111111] shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] rounded-xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Banner Upload */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Banner Image</label>
              <div className="relative h-28 rounded-xl border-2 border-[#111111] overflow-hidden bg-gray-100 cursor-pointer group"
                onClick={() => bannerInputRef.current?.click()}>
                {formData.banner_image && (
                  <img src={formData.banner_image} alt="Banner" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload size={24} weight="bold" className="text-white" />
                </div>
                {uploadingBanner && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white text-sm font-bold">Uploading...</span></div>}
              </div>
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0], 'banner')} />
            </div>

            {/* PFP Upload */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Profile Picture</label>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-full border-2 border-[#111111] overflow-hidden bg-gray-100 cursor-pointer group"
                  onClick={() => pfpInputRef.current?.click()}>
                  {formData.profile_picture ? (
                    <img src={formData.profile_picture} alt="PFP" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-black">{user.display_name?.[0]}</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    <Camera size={20} weight="bold" className="text-white" />
                  </div>
                  {uploadingPfp && <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full"><span className="text-white text-[10px] font-bold">...</span></div>}
                </div>
                <p className="text-xs text-[#4B4B4B]">Click to upload a new profile picture</p>
              </div>
              <input ref={pfpInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0], 'pfp')} />
            </div>

            {/* Display Name - Read Only */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Display Name</label>
              <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
                {user.display_name}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>Name can only be changed by an admin. Contact support.</p>
            </div>

            {/* Bio */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Bio</label>
              <Textarea value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] resize-none"
                placeholder="Tell us about yourself..." rows={3} />
            </div>

            {/* Privacy Settings */}
            <div className="space-y-3 border-2 border-[#111111] rounded-xl p-3">
              <h3 className="font-bold text-xs">Privacy Settings</h3>
              {[
                { key: 'is_profile_public', label: 'Public Profile', desc: 'Anyone can view your profile' },
                { key: 'is_followers_public', label: 'Public Followers List', desc: 'Anyone can see who follows you' },
                { key: 'is_following_public', label: 'Public Following List', desc: 'Anyone can see who you follow' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-[10px] text-[#4B4B4B]">{item.desc}</p>
                  </div>
                  <Switch checked={formData[item.key]}
                    onCheckedChange={(checked) => setFormData({ ...formData, [item.key]: checked })} />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)}
              className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}
              className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditProfileDialog;
