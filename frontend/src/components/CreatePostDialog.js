import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import { PaperPlaneRight, Image, X, Microphone, Stop, Play, Pause, Trash, Paperclip, FileDoc } from '@phosphor-icons/react';
import api, { buildAssetUrl } from '../utils/api';

const CreatePostDialog = ({ user, onPostCreated }) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  // Voice
  const [recording, setRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const fileInputRef = useRef(null);
  const attachInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const voiceAudioRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  const handleOpenChange = (isOpen) => {
    setOpen(isOpen);
    if (!isOpen) {
      setContent(''); setVisibility('public'); setShowConfirm(false);
      setImages([]); setAttachments([]);
      discardVoice();
    }
  };

  const uploadFile = async (file) => {
    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    try {
      const response = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      return buildAssetUrl(response.data.url);
    } catch (error) {
      toast.error('Failed to upload file');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) setImages(prev => [...prev, url]);
    }
    e.target.value = '';
  };

  const handleAttachSelect = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) setAttachments(prev => [...prev, { name: file.name, url }]);
    }
    e.target.value = '';
  };

  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i));
  const removeAttach = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
      setVoiceDuration(0);
      timerRef.current = setInterval(() => setVoiceDuration(d => d + 1), 1000);
    } catch (err) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const discardVoice = () => {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceBlob(null); setVoiceUrl(null); setVoiceDuration(0); setVoicePlaying(false);
    clearInterval(timerRef.current); setRecording(false);
  };

  const toggleVoicePlay = () => {
    if (!voiceAudioRef.current) return;
    if (voicePlaying) voiceAudioRef.current.pause();
    else voiceAudioRef.current.play();
    setVoicePlaying(!voicePlaying);
  };

  const formatDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleCreatePost = () => {
    if (!content.trim() && images.length === 0 && !voiceBlob) {
      toast.error('Please add content, an image, or a voice note');
      return;
    }
    if (visibility === 'official') setShowConfirm(true);
    else submitPost();
  };

  const submitPost = async () => {
    setLoading(true);
    try {
      let uploadedVoiceUrl = null;
      if (voiceBlob) {
        const form = new FormData();
        form.append('file', voiceBlob, 'voice.webm');
        const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploadedVoiceUrl = res.data.url;
      }

      const allImages = [...images, ...attachments.map(a => a.url)];

      await api.post('/posts', {
        content, images: allImages, visibility,
        voice_url: uploadedVoiceUrl
      });
      toast.success('Post created!');
      handleOpenChange(false);
      if (onPostCreated) onPostCreated();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button data-testid="open-create-post" onClick={() => setOpen(true)}
        className="w-full bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2.5 rounded-xl text-sm">
        Create Post
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-white border-2 border-[#111111] shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] rounded-xl max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>Create Post</DialogTitle>
            <DialogDescription className="text-[#4B4B4B] text-sm">Share with the BISD community</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Visibility */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block">Visibility</label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="border-2 border-[#111111] rounded-xl shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public Feed</SelectItem>
                  <SelectItem value="profile_only">Profile Only</SelectItem>
                  <SelectItem value="friends_only">Friends Only</SelectItem>
                  {(user.is_admin || user.is_moderator) && <SelectItem value="official">Official Channel</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Content */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block">Content</label>
              <Textarea data-testid="post-content-input" value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                className="bg-white border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] resize-none min-h-[80px]"
                rows={3} />
            </div>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img} alt="" className="w-full h-20 object-cover rounded-lg border-2 border-[#111111]" />
                    <button onClick={() => removeImage(i)}
                      className="absolute -top-1 -right-1 bg-[#FF6B6B] text-white rounded-full w-5 h-5 flex items-center justify-center border border-[#111111]">
                      <X size={10} weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attachment Previews */}
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-[#111111] bg-[#F5F5F5]">
                    <FileDoc size={16} weight="bold" className="text-[#2563EB]" />
                    <span className="text-xs font-medium flex-1 truncate">{att.name}</span>
                    <button onClick={() => removeAttach(i)} className="text-[#FF6B6B]"><X size={12} weight="bold" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Voice Recording */}
            {voiceUrl ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-[#111111] bg-[#F5F5F5]">
                <audio ref={voiceAudioRef} src={voiceUrl} onEnded={() => setVoicePlaying(false)} />
                <button onClick={toggleVoicePlay} className="p-1.5 rounded-full bg-[#2563EB] text-white" data-testid="post-voice-play">
                  {voicePlaying ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
                </button>
                <span className="text-xs font-bold tabular-nums text-[#4B4B4B]">{formatDur(voiceDuration)}</span>
                <div className="flex-1 h-1.5 bg-gray-300 rounded-full"><div className="h-full bg-[#2563EB] rounded-full w-full" /></div>
                <button onClick={discardVoice} className="text-[#FF6B6B]" data-testid="post-voice-discard"><Trash size={14} weight="bold" /></button>
              </div>
            ) : recording ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-[#FF6B6B] bg-[#FFF4E5]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-600 tabular-nums">{formatDur(voiceDuration)}</span>
                <span className="text-xs text-[#4B4B4B] flex-1">Recording...</span>
                <button onClick={stopRecording} data-testid="post-voice-stop" className="p-1.5 rounded-full bg-red-500 text-white">
                  <Stop size={12} weight="fill" />
                </button>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                <Image size={14} weight="bold" /> {uploading ? 'Uploading...' : 'Image'}
              </Button>
              <Button onClick={() => attachInputRef.current?.click()} disabled={uploading}
                className="bg-[#FFF4E5] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                <Paperclip size={14} weight="bold" /> Attach
              </Button>
              {!voiceUrl && !recording && (
                <Button onClick={startRecording}
                  className="bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                  <Microphone size={14} weight="bold" /> Voice
                </Button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,video/mp4" multiple className="hidden" onChange={handleImageSelect} />
              <input ref={attachInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" multiple className="hidden" onChange={handleAttachSelect} />
            </div>
          </div>

          {!showConfirm ? (
            <DialogFooter>
              <Button onClick={() => setOpen(false)}
                className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
                Cancel
              </Button>
              <Button data-testid="submit-post-button" onClick={handleCreatePost} disabled={loading}
                className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <PaperPlaneRight size={16} weight="bold" /> Post
              </Button>
            </DialogFooter>
          ) : (
            <div className="bg-[#FF6B6B] border-2 border-[#111111] rounded-xl p-4">
              <p className="text-white font-bold mb-2 text-sm">Confirm Official Post</p>
              <p className="text-white text-xs mb-3">This will be seen by all users and marked as official. Confirm?</p>
              <div className="flex gap-2">
                <Button onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-white text-[#111111] border-2 border-[#111111] font-bold py-2 rounded-xl text-xs">Cancel</Button>
                <Button onClick={submitPost} disabled={loading}
                  className="flex-1 bg-[#111111] text-white border-2 border-[#111111] font-bold py-2 rounded-xl text-xs">
                  {loading ? 'Posting...' : 'Confirm & Post'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreatePostDialog;
