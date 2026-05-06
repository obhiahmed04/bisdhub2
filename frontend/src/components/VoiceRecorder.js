import React, { useState, useRef } from 'react';
import { Microphone, Stop, Play, Pause, Trash, PaperPlaneRight } from '@phosphor-icons/react';
import api from '../utils/api';

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (err) {
      console.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setPlaying(false);
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice.webm');
      const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSend(res.data.url);
      discard();
    } catch (err) {
      console.error('Failed to upload voice');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (audioUrl) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'var(--bg-surface, #f5f5f5)', border: '1px solid var(--border, #ddd)' }}>
        <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
        <button onClick={togglePlayback} className="p-1.5 rounded-full bg-[#2563EB] text-white" data-testid="voice-play-toggle">
          {playing ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
        </button>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--text-2, #666)' }}>{formatDuration(duration)}</span>
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden mx-1">
          <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '100%' }} />
        </div>
        <button onClick={discard} className="p-1 text-red-400 hover:text-red-600" data-testid="voice-discard"><Trash size={12} weight="bold" /></button>
        <button onClick={handleSend} disabled={uploading} data-testid="voice-send"
          className="p-1.5 rounded-full bg-[#A7F3D0] text-[#111111] border border-[#111111] disabled:opacity-50">
          <PaperPlaneRight size={12} weight="bold" />
        </button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: '#FFF4E5', border: '1px solid #FF6B6B' }}>
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-bold text-red-600 tabular-nums">{formatDuration(duration)}</span>
        <span className="text-[10px] text-[#4B4B4B]">Recording...</span>
        <button onClick={stopRecording} data-testid="voice-stop" className="p-1.5 rounded-full bg-red-500 text-white ml-auto">
          <Stop size={12} weight="fill" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={startRecording} data-testid="voice-record-button" title="Record voice message"
      className={`${compact ? 'p-1.5' : 'p-2'} rounded-lg border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] transition-all`}>
      <Microphone size={compact ? 14 : 16} weight="bold" />
    </button>
  );
};

const VoicePlayer = ({ src }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 py-1">
      <audio ref={audioRef} src={src}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={() => { if (audioRef.current) setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100); }} />
      <button onClick={toggle} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30" data-testid="voice-msg-play">
        {playing ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
      </button>
      <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden min-w-[80px]">
        <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export { VoiceRecorder, VoicePlayer };
