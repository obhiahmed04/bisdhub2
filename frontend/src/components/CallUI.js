import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneDisconnect, VideoCamera, Microphone, MicrophoneSlash, VideoCameraSlash } from '@phosphor-icons/react';

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

const CallUI = ({ ws, user, targetUser, callType: initialCallType, isIncoming, incomingOffer, onEnd }) => {
  const [status, setStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const timerRef = useRef(null);
  const callType = useRef(initialCallType || 'audio');

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    localStreamRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'call_end', target_id: targetUser.user_id }));
    }
    cleanup();
    onEnd();
  }, [ws, targetUser, cleanup, onEnd]);

  const rejectCall = useCallback(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'call_reject', target_id: targetUser.user_id }));
    }
    cleanup();
    onEnd();
  }, [ws, targetUser, cleanup, onEnd]);

  const setupPeerConnection = useCallback(async () => {
    const isVideo = callType.current === 'video';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ice_candidate', target_id: targetUser.user_id, candidate: e.candidate }));
      }
    };
    pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        setStatus('connected');
        timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      }
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') endCall();
    };
    return pc;
  }, [ws, targetUser, endCall]);

  // Initiate outgoing call
  useEffect(() => {
    if (isIncoming) return;
    (async () => {
      try {
        const pc = await setupPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({
          type: 'call_offer', target_id: targetUser.user_id, call_type: callType.current,
          caller_name: user.display_name, caller_picture: user.profile_picture, sdp: offer
        }));
      } catch (err) { console.error('Failed to start call', err); endCall(); }
    })();
    return cleanup;
  }, []);

  // Listen for WS messages
  useEffect(() => {
    if (!ws) return;
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'call_answer' && pcRef.current) {
          pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
        if (data.type === 'ice_candidate' && pcRef.current) {
          pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
        if (data.type === 'call_end' || data.type === 'call_reject') { cleanup(); onEnd(); }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws, cleanup, onEnd]);

  // Answer incoming call
  const acceptCall = async () => {
    try {
      setStatus('connecting');
      const pc = await setupPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'call_answer', target_id: targetUser.user_id, sdp: answer }));
    } catch (err) { console.error('Failed to answer', err); endCall(); }
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
      <div className="bg-[#111111] rounded-2xl border-2 border-white/10 shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Video area */}
        {isVideo && status === 'connected' && (
          <div className="relative aspect-video bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted
              className="absolute bottom-2 right-2 w-24 h-18 rounded-lg border-2 border-white/30 object-cover" />
          </div>
        )}

        {/* Info */}
        <div className="p-6 text-center text-white">
          {!(isVideo && status === 'connected') && (
            <div className="mb-4">
              {targetUser.profile_picture ? (
                <img src={targetUser.profile_picture} alt="" className="w-20 h-20 rounded-full mx-auto border-2 border-white/20 object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full mx-auto bg-white/10 flex items-center justify-center text-2xl font-bold border-2 border-white/20">
                  {targetUser.display_name?.[0]}
                </div>
              )}
            </div>
          )}
          <p className="text-lg font-bold">{targetUser.display_name}</p>
          <p className="text-sm text-white/50 mt-1">
            {status === 'ringing' && 'Incoming call...'}
            {status === 'calling' && 'Calling...'}
            {status === 'connecting' && 'Connecting...'}
            {status === 'connected' && formatTime(callDuration)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 p-6 pt-0">
          {status === 'ringing' ? (
            <>
              <button onClick={acceptCall} data-testid="accept-call"
                className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600">
                <Phone size={24} weight="fill" />
              </button>
              <button onClick={rejectCall} data-testid="reject-call"
                className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600">
                <PhoneDisconnect size={24} weight="fill" />
              </button>
            </>
          ) : (
            <>
              <button onClick={toggleMute} data-testid="toggle-mute"
                className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}>
                {muted ? <MicrophoneSlash size={20} weight="fill" /> : <Microphone size={20} weight="fill" />}
              </button>
              {isVideo && (
                <button onClick={toggleVideo} data-testid="toggle-video"
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${videoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}>
                  {videoOff ? <VideoCameraSlash size={20} weight="fill" /> : <VideoCamera size={20} weight="fill" />}
                </button>
              )}
              <button onClick={endCall} data-testid="end-call"
                className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600">
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
