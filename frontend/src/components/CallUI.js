import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneDisconnect, VideoCamera, Microphone, MicrophoneSlash, VideoCameraSlash } from '@phosphor-icons/react';

// Multiple STUN servers for better connectivity
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * CallUI — WebRTC audio/video calls over WebSocket signaling.
 *
 * KEY FIX: Instead of using `ws` as a prop (which goes stale on reconnect),
 * we use `wsRef` (a ref that always points to the current socket) for SENDING,
 * and we listen for incoming signaling via a CustomEvent ('ws_call_event')
 * that MainApp dispatches from its onmessage handler.
 */
const CallUI = ({ wsRef, user, targetUser, callType: initialCallType, isIncoming, incomingOffer, onEnd }) => {
  const [status, setStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const timerRef = useRef(null);
  const callType = useRef(initialCallType || 'audio');
  const endedRef = useRef(false); // prevent double-end

  // Helper: get current WebSocket safely
  const getWs = () => wsRef?.current;

  const wsSend = useCallback((payload) => {
    const ws = getWs();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, [wsRef]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
  }, []);

  const endCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    wsSend({ type: 'call_end', target_id: targetUser.user_id });
    cleanup();
    onEnd();
  }, [wsSend, targetUser, cleanup, onEnd]);

  const rejectCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    wsSend({ type: 'call_reject', target_id: targetUser.user_id });
    cleanup();
    onEnd();
  }, [wsSend, targetUser, cleanup, onEnd]);

  const setupPeerConnection = useCallback(async () => {
    const isVideo = callType.current === 'video';

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: isVideo ? { width: 640, height: 480 } : false
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone/camera permission denied. Please allow access in your browser.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone/camera found.');
      } else {
        setError(`Media error: ${err.message}`);
      }
      throw err;
    }

    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsSend({ type: 'ice_candidate', target_id: targetUser.user_id, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('connected');
        timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus('failed');
        setTimeout(endCall, 2000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        // Try ICE restart
        pc.restartIce();
      }
    };

    return pc;
  }, [wsSend, targetUser, endCall]);

  // Initiate outgoing call
  useEffect(() => {
    if (isIncoming) return;
    let cancelled = false;

    (async () => {
      // Wait up to 5s for WS to be ready
      let waited = 0;
      while (waited < 5000) {
        const ws = getWs();
        if (ws && ws.readyState === WebSocket.OPEN) break;
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }
      const ws = getWs();
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError('Not connected to server. Please check your connection and try again.');
        setTimeout(onEnd, 3000);
        return;
      }
      if (cancelled) return;

      try {
        const pc = await setupPeerConnection();
        if (cancelled) return;
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType.current === 'video' });
        await pc.setLocalDescription(offer);
        wsSend({
          type: 'call_offer',
          target_id: targetUser.user_id,
          call_type: callType.current,
          caller_name: user.display_name,
          caller_picture: user.profile_picture,
          sdp: offer
        });
      } catch (err) {
        if (!cancelled) {
          if (!error) setError('Could not start call. Check microphone permissions.');
          setTimeout(endCall, 3000);
        }
      }
    })();

    return () => { cancelled = true; cleanup(); };
  }, []); // eslint-disable-line

  // Listen for incoming WS call signaling via CustomEvent (NOT ws prop)
  useEffect(() => {
    const handler = async (e) => {
      const data = e.detail;
      if (!data || !pcRef.current) return;

      if (data.type === 'call_answer') {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } catch {}
      }

      if (data.type === 'ice_candidate' && data.candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {}
      }

      if (data.type === 'call_end' || data.type === 'call_reject') {
        cleanup();
        onEnd();
      }
    };

    window.addEventListener('ws_call_event', handler);
    return () => window.removeEventListener('ws_call_event', handler);
  }, [cleanup, onEnd]);

  // Accept incoming call
  const acceptCall = async () => {
    setStatus('connecting');
    try {
      const pc = await setupPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend({ type: 'call_answer', target_id: targetUser.user_id, sdp: answer });
    } catch (err) {
      if (!error) setError('Could not answer call. Check microphone permissions.');
      setTimeout(endCall, 3000);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = muted; });
      setMuted(!muted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = videoOff; });
      setVideoOff(!videoOff);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const isVideo = callType.current === 'video';

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" data-testid="call-overlay">
      <div className="bg-[#111111] rounded-2xl border border-white/10 shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Video */}
        {isVideo && status === 'connected' && (
          <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted
              className="absolute bottom-2 right-2 w-24 rounded-lg border border-white/20 object-cover" />
          </div>
        )}

        {/* Avatar / Info */}
        <div className="p-6 text-center text-white">
          {!(isVideo && status === 'connected') && (
            <div className="mb-4">
              {targetUser.profile_picture ? (
                <img src={targetUser.profile_picture} alt="" className="w-20 h-20 rounded-full mx-auto border-2 border-white/20 object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full mx-auto bg-white/10 flex items-center justify-center text-3xl font-bold border-2 border-white/20">
                  {(targetUser.display_name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
          )}
          <p className="text-lg font-bold">{targetUser.display_name}</p>
          <p className="text-sm text-white/50 mt-1">
            {status === 'ringing' && '📞 Incoming call...'}
            {status === 'calling' && '📲 Calling...'}
            {status === 'connecting' && '⏳ Connecting...'}
            {status === 'connected' && `🟢 ${formatTime(callDuration)}`}
            {status === 'failed' && '❌ Call failed'}
          </p>
          {error && (
            <div className="mt-3 px-3 py-2 bg-red-900/50 rounded-lg text-xs text-red-300 text-left">
              {error}
            </div>
          )}
        </div>

        {/* Controls */}
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
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {muted ? <MicrophoneSlash size={20} weight="fill" /> : <Microphone size={20} weight="fill" />}
              </button>
              {isVideo && (
                <button onClick={toggleVideo} data-testid="toggle-video"
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${videoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
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
