import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneDisconnect, VideoCamera, Microphone, MicrophoneSlash, VideoCameraSlash } from '@phosphor-icons/react';

// ICE config with STUN + TURN relay (needed for users on different networks)
// TURN credential: open relay public server — replace with your own for production
const TURN_CREDENTIAL = 'openrelayproject';
const ICE_SERVERS = {
  iceServers: [
    // STUN (works on same network or simple NAT)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN relay (works across all networks including symmetric NAT)
    { urls: 'turn:openrelay.metered.ca:80',       username: TURN_CREDENTIAL, credential: TURN_CREDENTIAL },
    { urls: 'turn:openrelay.metered.ca:443',      username: TURN_CREDENTIAL, credential: TURN_CREDENTIAL },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: TURN_CREDENTIAL, credential: TURN_CREDENTIAL },
    { urls: 'turns:openrelay.metered.ca:443',     username: TURN_CREDENTIAL, credential: TURN_CREDENTIAL },
  ],
  iceTransportPolicy: 'all',   // try STUN first, fall back to TURN automatically
};

// Get current live WebSocket from the ref passed by MainApp
const getWs = (wsRef) => wsRef?.current;

const wsSend = (wsRef, payload) => {
  const ws = getWs(wsRef);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  console.warn('[BISD Call] wsSend failed — WS not open. readyState:', ws?.readyState);
  return false;
};

const CallUI = ({ wsRef, user, targetUser, callType: callTypeProp, isIncoming, incomingOffer, onEnd }) => {
  const [status, setStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');

  const callType = useRef(callTypeProp || 'audio');
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);  // always present for audio calls
  const timerRef = useRef(null);
  const endedRef = useRef(false);
  const callStartTime = useRef(null);
  // ICE candidates that arrive before setRemoteDescription — buffer them
  const iceBufRef = useRef([]);
  const remoteSetRef = useRef(false);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(window._bisdPing); // don't kill the main WS ping
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    wsSend(wsRef, { type: 'call_end', target_id: targetUser.user_id });
    const dur = Math.floor((Date.now() - (callStartTime.current || Date.now())) / 1000);
    cleanup();
    onEnd(dur);
  }, [wsRef, targetUser, cleanup, onEnd]);

  // Add buffered ICE candidates after remote description is set
  const flushIceBuf = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceBufRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceBufRef.current = [];
  }, []);

  const setupPeerConnection = useCallback(async () => {
    const isVideo = callType.current === 'video';
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: isVideo ? { width: 640, height: 480 } : false,
      });
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone/camera permission denied. Please allow access in browser settings and try again.'
        : err.name === 'NotFoundError'
        ? 'No microphone/camera found on this device.'
        : `Could not access media: ${err.message}`;
      setError(msg);
      throw err;
    }

    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    remoteSetRef.current = false;
    iceBufRef.current = [];

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) wsSend(wsRef, { type: 'ice_candidate', target_id: targetUser.user_id, candidate });
    };

    pc.ontrack = (e) => {
      if (!e.streams[0]) return;
      // For video calls, use video element; for audio calls, use the hidden audio element
      if (isVideo && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
      // ALWAYS pipe audio to the hidden audio element (works for both audio and video calls)
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[BISD Call] connectionState:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setStatus('connected');
        callStartTime.current = Date.now();
        timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      }
      if (pc.connectionState === 'failed') {
        setError('Connection failed. Both users must be on a network that allows WebRTC.');
        setTimeout(endCall, 3000);
      }
      if (pc.connectionState === 'disconnected') setStatus('reconnecting...');
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[BISD Call] iceConnectionState:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') pc.restartIce();
    };

    return pc;
  }, [wsRef, targetUser, endCall]);

  // ── Outgoing call ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isIncoming) return;
    let cancelled = false;

    (async () => {
      // Wait up to 6 seconds for WebSocket to be ready
      for (let i = 0; i < 30; i++) {
        if (getWs(wsRef)?.readyState === WebSocket.OPEN) break;
        await new Promise(r => setTimeout(r, 200));
        if (cancelled) return;
      }

      if (getWs(wsRef)?.readyState !== WebSocket.OPEN) {
        setError('Chat is not yet connected. Please wait a moment and try again.');
        setTimeout(onEnd, 4000);
        return;
      }

      try {
        const pc = await setupPeerConnection();
        if (cancelled) return;
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType.current === 'video',
        });
        await pc.setLocalDescription(offer);
        wsSend(wsRef, {
          type: 'call_offer',
          target_id: targetUser.user_id,
          call_type: callType.current,
          caller_name: user.display_name,
          caller_picture: user.profile_picture,
          sdp: offer,
        });
        console.log('[BISD Call] Offer sent to', targetUser.user_id);
      } catch (err) {
        if (!cancelled && !error) {
          setError('Failed to start call. Check microphone permissions.');
          setTimeout(endCall, 3000);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // ── Listen for call signaling from MainApp (via CustomEvent) ──────────────
  useEffect(() => {
    const handler = async (e) => {
      const data = e.detail;
      if (!data || !pcRef.current) return;

      if (data.type === 'call_answer') {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          remoteSetRef.current = true;
          await flushIceBuf(); // drain any candidates that arrived early
          console.log('[BISD Call] Remote description set (answer)');
        } catch (err) {
          console.error('[BISD Call] setRemoteDescription failed:', err);
        }
      }

      if (data.type === 'ice_candidate' && data.candidate) {
        if (remoteSetRef.current) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); }
          catch {}
        } else {
          // Buffer — will be added after answer is set
          iceBufRef.current.push(data.candidate);
        }
      }

      if (data.type === 'call_end') {
        const dur = Math.floor((Date.now() - (callStartTime.current || Date.now())) / 1000);
        cleanup();
        onEnd(dur);
      }
      if (data.type === 'call_reject') {
        cleanup();
        onEnd(0);
      }
    };

    window.addEventListener('ws_call_event', handler);
    return () => window.removeEventListener('ws_call_event', handler);
  }, [cleanup, onEnd, flushIceBuf]);

  // ── Accept incoming call ───────────────────────────────────────────────────
  const acceptCall = async () => {
    setStatus('connecting');
    try {
      const pc = await setupPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      remoteSetRef.current = true;
      await flushIceBuf();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend(wsRef, { type: 'call_answer', target_id: targetUser.user_id, sdp: answer });
      console.log('[BISD Call] Answer sent to', targetUser.user_id);
    } catch (err) {
      if (!error) setError('Could not accept call. Check microphone permissions.');
      setTimeout(endCall, 3000);
    }
  };

  const rejectCall = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    wsSend(wsRef, { type: 'call_reject', target_id: targetUser.user_id });
    cleanup();
    onEnd(0);  // 0 = rejected/missed
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };
  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(v => !v);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const isVideo = callType.current === 'video';

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" data-testid="call-overlay">
      <div className="bg-[#111] rounded-2xl border border-white/10 shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {isVideo && status === 'connected' && (
          <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted
              className="absolute bottom-2 right-2 w-24 rounded-lg border border-white/20 object-cover" />
          </div>
        )}
        <div className="p-6 text-center text-white">
          {!(isVideo && status === 'connected') && (
            <div className="mb-4">
              {targetUser.profile_picture
                ? <img src={targetUser.profile_picture} alt="" className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-white/20" />
                : <div className="w-20 h-20 rounded-full mx-auto bg-white/10 flex items-center justify-center text-3xl font-black border-2 border-white/20">
                    {(targetUser.display_name || '?')[0].toUpperCase()}
                  </div>}
            </div>
          )}
          <p className="text-lg font-bold">{targetUser.display_name}</p>
          <p className="text-sm text-white/50 mt-1">
            {status === 'ringing' && '📞 Incoming call...'}
            {status === 'calling' && '📲 Calling...'}
            {status === 'connecting' && '⏳ Connecting...'}
            {status === 'connected' && `🟢 ${fmt(callDuration)}`}
            {status === 'reconnecting...' && '🔄 Reconnecting...'}
          </p>
          {error && <div className="mt-3 px-3 py-2 bg-red-900/50 rounded-lg text-xs text-red-300 text-left">{error}</div>}
        </div>

        {/* Hidden audio element - plays remote audio for ALL call types */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div className="flex items-center justify-center gap-4 p-6 pt-0">
          {status === 'ringing' ? (
            <>
              <button onClick={acceptCall} data-testid="accept-call"
                className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors">
                <Phone size={24} weight="fill" />
              </button>
              <button onClick={rejectCall} data-testid="reject-call"
                className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors">
                <PhoneDisconnect size={24} weight="fill" />
              </button>
            </>
          ) : (
            <>
              <button onClick={toggleMute} data-testid="toggle-mute"
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors text-white ${muted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                {muted ? <MicrophoneSlash size={20} weight="fill" /> : <Microphone size={20} weight="fill" />}
              </button>
              {isVideo && (
                <button onClick={toggleVideo} data-testid="toggle-video"
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors text-white ${videoOff ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                  {videoOff ? <VideoCameraSlash size={20} weight="fill" /> : <VideoCamera size={20} weight="fill" />}
                </button>
              )}
              <button onClick={endCall} data-testid="end-call"
                className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors">
                <PhoneDisconnect size={24} weight="fill" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallUI;
