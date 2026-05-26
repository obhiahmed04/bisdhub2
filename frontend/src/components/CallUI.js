import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneDisconnect, VideoCamera, Microphone, MicrophoneSlash, VideoCameraSlash, ArrowClockwise } from '@phosphor-icons/react';
import api from '../utils/api';

// Get current live WebSocket from the ref passed by MainApp
const getWs = (wsRef) => wsRef?.current;

const wsSend = (wsRef, payload) => {
  const ws = getWs(wsRef);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  console.warn('[BISD Call] Cannot send — WS readyState:', ws?.readyState);
  return false;
};

const STATUS_TEXT = {
  ringing:       '📞 Incoming call...',
  calling:       '📲 Calling...',
  retrying:      '🔄 Retrying connection...',
  gathering:     '🔍 Finding route...',
  connecting:    '⏳ Connecting...',
  connected:     null,   // shows timer
  failed:        null,   // shows error
  'reconnecting...': '🔄 Reconnecting...',
};

const CallUI = ({ wsRef, user, targetUser, callType: callTypeProp, isIncoming, incomingOffer, onEnd }) => {
  const [status, setStatus]           = useState(isIncoming ? 'ringing' : 'calling');
  const [muted, setMuted]             = useState(false);
  const [videoOff, setVideoOff]       = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError]             = useState('');
  const [debugInfo, setDebugInfo]     = useState('');
  const [iceState, setIceState]       = useState('');
  const [retryCount, setRetryCount]   = useState(0);
  const [iceServers, setIceServers]   = useState(null);

  const callType       = useRef(callTypeProp || 'audio');
  const pcRef          = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const timerRef       = useRef(null);
  const endedRef       = useRef(false);
  const callStartTime  = useRef(null);
  const iceBufRef      = useRef([]);
  const remoteSetRef   = useRef(false);
  const retryRef       = useRef(0);
  const relayRetryRef  = useRef(false);
  const offerRef       = useRef(null);  // stored offer for retry

  // ── Fetch ICE servers from backend ────────────────────────────────────────
  const fetchIceServers = async () => {
    try {
      const r = await api.get('/call/ice-config');
      setIceServers(r.data.ice_servers);
      console.log('[BISD Call] ICE servers loaded:', r.data.ice_servers.length, 'servers. Has Metered:', r.data.has_metered);
      return r.data.ice_servers;
    } catch (e) {
      console.warn('[BISD Call] Could not fetch ICE config, using defaults');
      // Fallback inline config
      return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'turn:freestun.net:3478',  username: 'free', credential: 'free' },
        { urls: 'turns:freestun.net:5349', username: 'free', credential: 'free' },
        { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
      ];
    }
  };

  const debug = (msg) => {
    console.log('[BISD Call]', msg);
    setDebugInfo(msg);
  };

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    wsSend(wsRef, { type: 'call_end', target_id: targetUser.user_id });
    const dur = callStartTime.current ? Math.floor((Date.now() - callStartTime.current) / 1000) : 0;
    cleanup();
    onEnd(dur);
  }, [wsRef, targetUser, cleanup, onEnd]);

  const flushIceBuf = useCallback(async () => {
    if (!pcRef.current) return;
    debug(`Flushing ${iceBufRef.current.length} buffered ICE candidates`);
    for (const c of iceBufRef.current) {
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceBufRef.current = [];
  }, []);

  // ── Create RTCPeerConnection with dynamic ICE config ─────────────────────
  const setupPeerConnection = useCallback(async (servers) => {
    const isVideo = callType.current === 'video';

    debug('Requesting microphone/camera access...');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
      });
    } catch (err) {
      let msg;
      if (err.name === 'NotAllowedError')      msg = '🎤 Microphone permission denied. Please allow mic access in your browser settings and try again.';
      else if (err.name === 'NotFoundError')   msg = '🎤 No microphone found. Please connect a microphone and try again.';
      else if (err.name === 'NotReadableError') msg = '🎤 Microphone is in use by another app. Close other apps and try again.';
      else msg = `Media error: ${err.name} — ${err.message}`;
      setError(msg);
      throw err;
    }

    debug(`Got local media stream (${stream.getTracks().length} tracks)`);
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const iceConfig = { iceServers: servers, iceTransportPolicy: 'all' };
    debug(`Creating RTCPeerConnection with ${servers.length} ICE servers...`);
    const pc = new RTCPeerConnection(iceConfig);
    pcRef.current = pc;
    remoteSetRef.current = false;
    iceBufRef.current = [];

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    let candTypeCount = { host: 0, srflx: 0, relay: 0, prflx: 0 };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        candTypeCount[candidate.type] = (candTypeCount[candidate.type] || 0) + 1;
        debug(`ICE candidate (${candidate.type}): host=${candTypeCount.host} srflx=${candTypeCount.srflx} relay=${candTypeCount.relay}`);
        wsSend(wsRef, { type: 'ice_candidate', target_id: targetUser.user_id, candidate });
      } else {
        debug(`ICE gathering done: ${candTypeCount.host} host, ${candTypeCount.srflx} stun, ${candTypeCount.relay} turn`);
        if (candTypeCount.relay === 0) {
          console.warn('[BISD Call] NO TURN/RELAY CANDIDATES — TURN server may be unreachable. Cross-NAT calls will fail.');
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      debug(`ICE gathering: ${pc.iceGatheringState}`);
      if (pc.iceGatheringState === 'gathering') setStatus('gathering');
    };

    pc.ontrack = (e) => {
      if (!e.streams[0]) return;
      debug(`Remote track received: ${e.track.kind}`);
      if (isVideo && remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      debug(`connectionState: ${state}`);
      if (state === 'connected') {
        setStatus('connected');
        callStartTime.current = Date.now();
        setError('');
        timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      }
      if (state === 'connecting') setStatus('connecting');
      if (state === 'failed') {
        // Auto-retry once with relay-only mode (forces TURN, helps cross-NAT)
        if (!relayRetryRef.current && retryRef.current < 2) {
          relayRetryRef.current = true;
          debug('Connection failed — retrying with TURN relay only...');
          setStatus('retrying');
          setError('Retrying with relay-only mode...');
          // Restart ICE with relay-only policy
          try { pc.close(); } catch {}
          // Reconnect using relay-only mode
          (async () => {
            try {
              const servers = iceServers || await fetchIceServers();
              const relayConfig = { iceServers: servers, iceTransportPolicy: 'relay' };
              const newPc = new RTCPeerConnection(relayConfig);
              pcRef.current = newPc;
              remoteSetRef.current = false;
              iceBufRef.current = [];
              localStreamRef.current.getTracks().forEach(t => newPc.addTrack(t, localStreamRef.current));
              newPc.onicecandidate = ({ candidate }) => {
                if (candidate) wsSend(wsRef, { type: 'ice_candidate', target_id: targetUser.user_id, candidate });
              };
              newPc.ontrack = (e) => {
                if (!e.streams[0]) return;
                if (isVideo && remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
                if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
              };
              newPc.onconnectionstatechange = pc.onconnectionstatechange;
              newPc.oniceconnectionstatechange = pc.oniceconnectionstatechange;
              if (!isIncoming) {
                const offer = await newPc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType.current === 'video', iceRestart: true });
                await newPc.setLocalDescription(offer);
                wsSend(wsRef, { type: 'call_offer', target_id: targetUser.user_id, call_type: callType.current,
                  caller_name: user.display_name, caller_picture: user.profile_picture, sdp: offer });
              }
            } catch (err) {
              setError(
                '❌ Connection failed. This can happen when:\n' +
                '• Both users are on strict corporate/school firewalls\n' +
                '• TURN relay servers are blocked\n' +
                '• Mobile carrier is restricting WebRTC traffic\n\n' +
                'Try: switching to Wi-Fi, asking the other person to rejoin, or contact your network admin.'
              );
              setTimeout(endCall, 6000);
            }
          })();
          return;
        }
        setError(
          '❌ Connection failed after retrying.\n\n' +
          'Common causes:\n' +
          '• Mobile carrier blocking WebRTC media\n' +
          '• Strict firewall on one side\n' +
          '• Both sides on the same restrictive network\n\n' +
          'Try switching to Wi-Fi and calling again.'
        );
        setTimeout(endCall, 6000);
      }
      if (state === 'disconnected') setStatus('reconnecting...');
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      setIceState(state);
      debug(`iceConnectionState: ${state}`);
      if (state === 'checking') setStatus('connecting');
      if (state === 'failed') {
        debug('ICE failed — attempting ICE restart...');
        pc.restartIce();
      }
    };

    return pc;
  }, [wsRef, targetUser, endCall]);

  // ── Send call offer (shared between initial + retry) ─────────────────────
  const sendOffer = useCallback(async (servers) => {
    if (!pcRef.current) return;
    try {
      const offer = await pcRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType.current === 'video',
      });
      await pcRef.current.setLocalDescription(offer);
      offerRef.current = offer;
      const sent = wsSend(wsRef, {
        type: 'call_offer',
        target_id: targetUser.user_id,
        call_type: callType.current,
        caller_name: user.display_name,
        caller_picture: user.profile_picture,
        sdp: offer,
      });
      debug(`Offer ${sent ? 'sent' : 'FAILED (WS closed)'} to ${targetUser.display_name}`);
      return sent;
    } catch (err) {
      debug(`createOffer error: ${err.message}`);
      throw err;
    }
  }, [wsRef, targetUser, user]);

  // ── Outgoing call flow ────────────────────────────────────────────────────
  useEffect(() => {
    if (isIncoming) return;
    let cancelled = false;

    (async () => {
      // Wait up to 8s for WebSocket
      debug('Waiting for WebSocket...');
      for (let i = 0; i < 40; i++) {
        if (getWs(wsRef)?.readyState === WebSocket.OPEN) break;
        await new Promise(r => setTimeout(r, 200));
        if (cancelled) return;
      }
      if (getWs(wsRef)?.readyState !== WebSocket.OPEN) {
        setError('⚠️ Chat is not yet connected. Please wait for the connection to establish and try again.\n\nTip: Check the "● Polling" indicator — if it\'s not "● Live", wait a moment.');
        setTimeout(() => { if (!cancelled) onEnd(0); }, 5000);
        return;
      }

      try {
        debug('Fetching ICE server configuration...');
        const servers = await fetchIceServers();
        if (cancelled) return;
        const pc = await setupPeerConnection(servers);
        if (cancelled) return;
        await sendOffer(servers);
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to start call: ${err.message || 'Unknown error'}`);
          setTimeout(() => { if (!cancelled) onEnd(0); }, 4000);
        }
      }
    })();

    return () => { cancelled = true; cleanup(); };
  }, []); // eslint-disable-line

  // ── Listen for call signaling events (dispatched by MainApp) ─────────────
  useEffect(() => {
    const handler = async (e) => {
      const data = e.detail;
      if (!data) return;

      if (data.type === 'call_unavailable') {
        const reason = data.reason || 'not_connected';
        const attempt = retryRef.current + 1;

        if (reason === 'offline') {
          setError(`${targetUser.display_name} is offline and can't receive calls right now.`);
          setTimeout(endCall, 3000);
          return;
        }

        // Not connected = may be reconnecting — retry up to 3 times
        if (attempt <= 3) {
          retryRef.current = attempt;
          setRetryCount(attempt);
          setStatus('retrying');
          debug(`User not connected — retry ${attempt}/3 in 3 seconds...`);
          await new Promise(r => setTimeout(r, 3000));
          if (endedRef.current) return;
          // Resend offer if peer connection exists
          if (pcRef.current) {
            wsSend(wsRef, {
              type: 'call_offer',
              target_id: targetUser.user_id,
              call_type: callType.current,
              caller_name: user.display_name,
              caller_picture: user.profile_picture,
              sdp: offerRef.current,
            });
            setStatus('calling');
          }
        } else {
          setError(
            `${targetUser.display_name} appears to be unavailable.\n\n` +
            `This usually means:\n` +
            `• Their app is closed or not connected\n` +
            `• They declined the call\n` +
            `• Try sending a DM first to check if they're active`
          );
          setTimeout(endCall, 4000);
        }
        return;
      }

      if (!pcRef.current) return;

      if (data.type === 'call_answer') {
        try {
          debug('Received answer — setting remote description...');
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          remoteSetRef.current = true;
          await flushIceBuf();
          setStatus('connecting');
        } catch (err) {
          debug(`setRemoteDescription error: ${err.message}`);
          setError(`Signaling error: ${err.message}`);
        }
      }

      if (data.type === 'ice_candidate' && data.candidate) {
        if (remoteSetRef.current) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); }
          catch (e) { debug(`addIceCandidate failed: ${e.message}`); }
        } else {
          iceBufRef.current.push(data.candidate);
        }
      }

      if (data.type === 'call_end') {
        const dur = callStartTime.current ? Math.floor((Date.now() - callStartTime.current) / 1000) : 0;
        cleanup();
        onEnd(dur);
      }
      if (data.type === 'call_reject') {
        debug('Call rejected by remote');
        cleanup();
        onEnd(0);
      }
    };

    window.addEventListener('ws_call_event', handler);
    return () => window.removeEventListener('ws_call_event', handler);
  }, [cleanup, onEnd, flushIceBuf, endCall, sendOffer, wsRef, targetUser, user]);

  // ── Accept incoming call ──────────────────────────────────────────────────
  const acceptCall = async () => {
    setStatus('connecting');
    try {
      const servers = await fetchIceServers();
      const pc = await setupPeerConnection(servers);
      debug('Setting remote description from offer...');
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      remoteSetRef.current = true;
      await flushIceBuf();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend(wsRef, { type: 'call_answer', target_id: targetUser.user_id, sdp: answer });
      debug('Answer sent');
    } catch (err) {
      if (!error) setError(`Could not accept call: ${err.name === 'NotAllowedError' ? 'Microphone permission denied' : err.message}`);
      setTimeout(endCall, 3000);
    }
  };

  const rejectCall = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    wsSend(wsRef, { type: 'call_reject', target_id: targetUser.user_id });
    cleanup();
    onEnd(0);
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

  const statusText = status === 'retrying'
    ? `🔄 Retry ${retryCount}/3 — trying to reach ${targetUser.display_name}...`
    : status === 'connected'
    ? `🟢 ${fmt(callDuration)}`
    : STATUS_TEXT[status] || status;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" data-testid="call-overlay">
      <div className="bg-[#111] rounded-2xl border border-white/10 shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Video area (video calls only) */}
        {isVideo && status === 'connected' && (
          <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-2 right-2 w-24 rounded-lg border border-white/20 object-cover" />
          </div>
        )}

        {/* Avatar + info */}
        <div className="px-6 pt-6 pb-3 text-center text-white">
          {!(isVideo && status === 'connected') && (
            <div className="mb-3">
              {targetUser.profile_picture
                ? <img src={targetUser.profile_picture} alt="" className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-white/20" />
                : <div className="w-20 h-20 rounded-full mx-auto bg-white/10 flex items-center justify-center text-3xl font-black border-2 border-white/20">
                    {(targetUser.display_name || '?')[0].toUpperCase()}
                  </div>}
            </div>
          )}
          <p className="text-lg font-bold">{targetUser.display_name}</p>
          <p className="text-sm text-white/60 mt-1 min-h-[20px]">{statusText}</p>

          {/* ICE state debug badge */}
          {iceState && status !== 'connected' && (
            <p className="text-[10px] text-white/30 mt-1">ICE: {iceState}</p>
          )}

          {/* Debug info */}
          {debugInfo && status !== 'connected' && (
            <p className="text-[10px] text-white/25 mt-0.5 px-4 truncate">{debugInfo}</p>
          )}

          {/* Error box */}
          {error && (
            <div className="mt-3 px-3 py-2 bg-red-900/60 rounded-xl text-xs text-red-200 text-left whitespace-pre-line leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Hidden audio — always present, plays remote audio stream */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 px-6 py-5">
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
