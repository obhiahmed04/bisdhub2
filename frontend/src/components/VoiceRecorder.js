import React, { useState, useRef } from 'react';
import { Microphone, Stop, Play, Pause, Trash, PaperPlaneRight } from '@phosphor-icons/react';
import api, { resolveAssetUrl } from '../utils/api';

// Pick supported MIME type (iOS Safari doesn't support audio/webm)
const getSupportedMimeType = () => {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  return types.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';
};

const VoiceRecorder = ({ onSend, compact = false }) => {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeType = getSupportedMimeType();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const baseMime = (mimeType || 'audio/webm').split(';')[0]; // strip ;codecs=... params
      const blob = new Blob(chunksRef.current, { type: baseMime });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (err) {
      alert('Microphone access denied. Please allow microphone in your browser settings.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
    setPlaying(!playing);
  };

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null); setAudioUrl(null); setDuration(0); setPlaying(false);
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const ext = baseMime.includes('mp4') ? 'mp4' : baseMime.includes('ogg') ? 'ogg' : 'webm';
      const formData = new FormData();
      formData.append('file', audioBlob, `voice.${ext}`);
      const res = await api.post('/upload', formData);  // NO Content-Type header — let axios set it with boundary
      onSend(res.data.url);
      discard();
    } catch {
      alert('Failed to send voice message');
    } finally { setUploading(false); }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (audioUrl) return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-c)' }}>
      <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
      <button onClick={togglePlayback} className="p-1.5 rounded-full bg-[#2563EB] text-white" data-testid="voice-play-toggle">
        {playing ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
      </button>
      <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--text-2)' }}>{fmt(duration)}</span>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden mx-1">
        <div className="h-full bg-[#2563EB] rounded-full w-full" />
      </div>
      <button onClick={discard} className="p-1 text-red-400 hover:text-red-600" data-testid="voice-discard"><Trash size={12} weight="bold" /></button>
      <button onClick={handleSend} disabled={uploading} data-testid="voice-send"
        className="p-1.5 rounded-full bg-green-100 text-green-700 border border-green-300 disabled:opacity-50">
        {uploading ? '...' : <PaperPlaneRight size={12} weight="bold" />}
      </button>
    </div>
  );

  if (recording) return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: '#FFF4E5', border: '1px solid #FF6B6B' }}>
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-xs font-bold text-red-600 tabular-nums">{fmt(duration)}</span>
      <span className="text-[10px] text-red-400">Recording...</span>
      <button onClick={stopRecording} data-testid="voice-stop" className="p-1.5 rounded-full bg-red-500 text-white ml-auto">
        <Stop size={12} weight="fill" />
      </button>
    </div>
  );

  return (
    <button onClick={startRecording} data-testid="voice-record-button" title="Record voice message"
      className={`${compact ? 'p-1.5' : 'p-2'} rounded-lg border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] transition-all flex-shrink-0`}>
      <Microphone size={compact ? 14 : 16} weight="bold" />
    </button>
  );
};

// VoicePlayer — works in both dark (chat bubbles) and light contexts
const VoicePlayer = ({ src, dark = true }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Resolve URL correctly (avoids double /api/ prefix)
  const resolvedSrc = resolveAssetUrl(src);
  if (!resolvedSrc) return null;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
    setPlaying(!playing);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
  const trackColor = dark ? 'rgba(255,255,255,0.25)' : 'var(--bg-surface)';
  const fillColor = dark ? 'rgba(255,255,255,0.85)' : '#2563EB';
  const textColor = dark ? 'rgba(255,255,255,0.6)' : 'var(--text-3)';

  return (
    <div className="flex items-center gap-2 py-1 min-w-[140px]">
      <audio ref={audioRef} src={resolvedSrc}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); }}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const d = audioRef.current.duration || 1;
          setProgress((audioRef.current.currentTime / d) * 100);
          setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
      />
      <button onClick={toggle} className="p-1.5 rounded-full flex-shrink-0 transition-colors"
        style={{ background: trackColor }} data-testid="voice-msg-play">
        {playing ? <Pause size={14} weight="fill" style={{ color: dark ? '#fff' : '#111' }} />
                 : <Play size={14} weight="fill" style={{ color: dark ? '#fff' : '#111' }} />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5 min-w-[60px]">
        <div className="h-1.5 rounded-full overflow-hidden cursor-pointer" style={{ background: trackColor }}
          onClick={e => {
            if (!audioRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * (audioRef.current.duration || 0);
          }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: fillColor }} />
        </div>
        <p className="text-[10px] tabular-nums" style={{ color: textColor }}>
          {fmt(currentTime)}{duration > 0 ? ` / ${fmt(duration)}` : ''}
        </p>
      </div>
    </div>
  );
};

export { VoiceRecorder, VoicePlayer };
