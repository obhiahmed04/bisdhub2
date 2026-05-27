import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  House, ChatCircleDots, PaperPlaneTilt, User, MagnifyingGlass, 
  SignOut, Heart, ChatCircle, PaperPlaneRight, Flag, ShieldCheck, Crown,
  Moon, Sun, GearSix, ShareNetwork, ArrowsClockwise, UserPlus, Copy,
  UsersThree, ArrowBendUpLeft, Smiley, WarningCircle, Trash,
  Phone, VideoCamera, Image, CaretLeft } from '@phosphor-icons/react';
import api, { API_BASE, WS_BASE, getPublicName, getSecondaryIdentity, resolveAssetUrl } from '../utils/api';
import NotificationBell from '../components/NotificationBell';
import CreatePostDialog from '../components/CreatePostDialog';
import CommentSection from '../components/CommentSection';
import { VoiceRecorder, VoicePlayer } from '../components/VoiceRecorder';
import CallUI from '../components/CallUI';
import PostOptionsMenu from '../components/PostOptionsMenu';
import { useTheme } from '../App';

const MainApp = ({ user, onLogout, updateUser }) => {
  const { darkMode, toggleDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('home');
  const [feedType, setFeedType] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], posts: [] });
  const [showSearch, setShowSearch] = useState(false);
  const [activeChatRoom, setActiveChatRoom] = useState('general');
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [dmConversations, setDmConversations] = useState([]);
  const [activeDM, setActiveDM] = useState(null);
  const [activeDMUser, setActiveDMUser] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const activeDMRef = useRef(null);
  const [typingUser, setTypingUser] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editingDM, setEditingDM] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showHistory, setShowHistory] = useState(null);
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const typingSentAtRef = useRef(0);
  const [newDMMessage, setNewDMMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [wsReady, setWsReady] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [viewLikersPost, setViewLikersPost] = useState(null);
  const [likers, setLikers] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    loadFeed();
    loadDMConversations();
    loadChatRooms();
    requestNotificationPermission();
    const cleanup = connectWebSocket();
    return cleanup;
  }, []);

  // Handle incoming DM navigation from profile page
  useEffect(() => {
    if (location.state?.startDM) {
      setActiveTab('dm');
      setActiveDM(location.state.startDM.user_id);
      setActiveDMUser(location.state.startDM);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => { loadFeed(); }, [feedType]);

  useEffect(() => {
    if (activeChatRoom) {
      loadChatMessages();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'join_room', room: activeChatRoom }));
      }
    }
  }, [activeChatRoom]);

  useEffect(() => {
    activeDMRef.current = activeDM;
    setReplyTo(null);
    setEditingDM(null);
    setTypingUser(null);
    if (activeDM) loadDMMessages();
  }, [activeDM]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, dmMessages]);

  // Real-time search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => searchContent(), 300);
    } else {
      setSearchResults({ users: [], posts: [] });
    }
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (!viewLikersPost) return;
    api.get(`/posts/${viewLikersPost.post_id}/likes`).then(r => setLikers(r.data)).catch(() => setLikers([]));
  }, [viewLikersPost]);

  const connectWebSocket = () => {
    const wsUrl = `${WS_BASE}/${user.user_id}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('[BISD] WebSocket connected:', wsUrl);
      setWsReady(true);
      socket.send(JSON.stringify({ type: 'join_room', room: activeChatRoom }));
      loadChatMessages();
      // Keepalive ping every 25s — stops Render from killing idle sockets
      if (window._bisdPing) clearInterval(window._bisdPing);
      window._bisdPing = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setChatMessages(prev => {
          if (prev.some(m => m.message_id === data.message_id)) return prev;
          return [...prev, data];
        });
      }
      if (data.type === 'dm') {
        // CRITICAL: only add to the open conversation
        // (otherwise messages from User C leak into User B's chat window)
        const otherPartyId = data.sender_id === user.user_id ? data.receiver_id : data.sender_id;
        if (activeDMRef.current && otherPartyId === activeDMRef.current) {
          setDmMessages(prev => {
            // Match by dm_id, OR replace optimistic temp by sender+content+timestamp proximity
            const idx = prev.findIndex(m =>
              m.dm_id === data.dm_id ||
              (m._pending && m.sender_id === data.sender_id &&
               m.content === data.content &&
               Math.abs(new Date(m.created_at) - new Date(data.created_at)) < 30000)
            );
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...data, _status: 'sent' };
              return copy;
            }
            return [...prev, { ...data, _status: 'sent' }];
          });
          // Auto-mark as read if I'm viewing this conversation
          if (data.sender_id !== user.user_id) {
            api.post(`/dm/${data.sender_id}/mark-read`).catch(() => {});
          }
        }
        loadDMConversations();
      }
      
      // Real-time DM updates: edit, delete, react, read, typing
      if (data.type === 'dm_edit') {
        const otherPartyId = data.sender_id === user.user_id ? data.receiver_id : data.sender_id;
        if (activeDMRef.current === otherPartyId) {
          setDmMessages(prev => prev.map(m => m.dm_id === data.dm_id ? { ...m, ...data, _status: m._status } : m));
        }
      }
      if (data.type === 'dm_delete') {
        const otherPartyId = data.sender_id === user.user_id ? data.receiver_id : data.sender_id;
        if (activeDMRef.current === otherPartyId) {
          setDmMessages(prev => prev.map(m => m.dm_id === data.dm_id ? { ...m, deleted: true, content: '', images: [], voice_url: null } : m));
        }
      }
      if (data.type === 'dm_react') {
        const otherPartyId = data.sender_id === user.user_id ? data.receiver_id : data.sender_id;
        if (activeDMRef.current === otherPartyId) {
          setDmMessages(prev => prev.map(m => m.dm_id === data.dm_id ? { ...m, reactions: data.reactions } : m));
        }
      }
      if (data.type === 'dm_read') {
        // Other user read messages I sent them
        if (activeDMRef.current === data.reader_id) {
          setDmMessages(prev => prev.map(m =>
            m.sender_id === user.user_id ? { ...m, read: true, _status: 'read' } : m
          ));
        }
      }
      if (data.type === 'dm_typing') {
        if (activeDMRef.current === data.sender_id) {
          setTypingUser(data.typing ? data.sender_id : null);
          if (data.typing) {
            clearTimeout(window._typingClearTimeout);
            window._typingClearTimeout = setTimeout(() => setTypingUser(null), 4000);
          }
        }
      }
      if (data.type === 'reaction_update') {
        setChatMessages(prev => prev.map(m => m.message_id === data.message_id ? { ...m, reactions: data.reactions } : m));
      }
      // Incoming call handling
      if (data.type === 'call_offer') {
        setIncomingCall({ caller_id: data.caller_id, caller_name: data.caller_name, caller_picture: data.caller_picture, call_type: data.call_type, sdp: data.sdp });
      }
      if (data.type === 'call_unavailable') {
        toast.error('User is not available for calls right now');
        setActiveCall(null);
      }
      // Forward WebRTC signaling events to CallUI
      if (['call_answer','ice_candidate','call_end','call_reject'].includes(data.type)) {
        window.dispatchEvent(new CustomEvent('ws_call_event', { detail: data }));
      }
    };

    socket.onerror = (e) => { console.warn('[BISD] WebSocket error:', e); setWsReady(false); };
    socket.onclose = (e) => {
      console.log('[BISD] WebSocket closed. Code:', e.code, 'Reason:', e.reason);
      clearInterval(window._bisdPing);
      setWsReady(false);
      // Auto-reconnect after 3 seconds, but only if not already scheduled
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };

    setWs(socket);
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      socket.close();
    };
  };

  const loadFeed = async () => {
    try {
      const response = await api.get(`/posts/feed/${feedType}`);
      setPosts(response.data);
    } catch (error) {
      console.error('Failed to load feed');
    }
  };

  const likePost = async (postId, isLiked) => {
    try {
      if (isLiked) await api.delete(`/posts/${postId}/like`);
      else await api.post(`/posts/${postId}/like`);
      loadFeed();
    } catch (error) {
      toast.error('Failed to update like');
    }
  };

  const searchContent = async () => {
    if (!searchQuery.trim()) return;
    try {
      const [usersRes, postsRes] = await Promise.all([
        api.get(`/users/search?query=${encodeURIComponent(searchQuery)}`),
        api.get(`/posts/search?query=${encodeURIComponent(searchQuery)}`)
      ]);
      setSearchResults({ users: usersRes.data, posts: postsRes.data });
    } catch (error) {
      console.error('Search failed');
    }
  };

  const loadChatMessages = async () => {
    try {
      const response = await api.get(`/chat/${activeChatRoom}/messages`);
      setChatMessages(response.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('You do not have access to this room');
        setActiveChatRoom('general');
      }
    }
  };

  const sendChatMessage = async () => {
    const content = newChatMessage.trim();
    if (!content) return;
    setNewChatMessage('');
    const replyTo = replyingTo?.message_id;
    setReplyingTo(null);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const payload = { type: 'chat_message', chat_room: activeChatRoom, content };
      if (replyTo) payload.reply_to = replyTo;
      wsRef.current.send(JSON.stringify(payload));
    } else {
      // WS not ready — use REST fallback (server broadcasts to all WS-connected members)
      try {
        const res = await api.post(`/chat/${activeChatRoom}/send`, { content, reply_to: replyTo });
        setChatMessages(prev => {
          if (prev.some(m => m.message_id === res.data.message_id)) return prev;
          return [...prev, res.data];
        });
      } catch {
        toast.error('Message failed to send');
        setNewChatMessage(content);
      }
    }
  };

  const loadDMConversations = async () => {
    try {
      const response = await api.get('/dm/conversations');
      setDmConversations(response.data);
    } catch (error) {
      console.error('Failed to load DM conversations');
    }
  };

  const loadDMMessages = async () => {
    try {
      const response = await api.get(`/dm/${activeDM}/messages`);
      setDmMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages');
    }
  };

  // ── DM Edit / Delete / React / Typing helpers ──
  const startEditDM = (msg) => { setEditingDM(msg.dm_id); setEditContent(msg.content); };
  const cancelEditDM = () => { setEditingDM(null); setEditContent(''); };
  const submitEditDM = async () => {
    const newContent = editContent.trim();
    if (!newContent || !editingDM) return cancelEditDM();
    try {
      await api.put(`/dm/${editingDM}`, { content: newContent });
      // optimistic local update (WS will confirm)
      setDmMessages(prev => prev.map(m =>
        m.dm_id === editingDM ? { ...m, content: newContent, edited: true } : m
      ));
    } catch { toast.error('Failed to edit message'); }
    cancelEditDM();
  };
  const unsendDM = async (dm_id) => {
    if (!window.confirm('Unsend this message? Recipients will see "message was deleted".')) return;
    try {
      await api.delete(`/dm/${dm_id}`);
      setDmMessages(prev => prev.map(m =>
        m.dm_id === dm_id ? { ...m, deleted: true, content: '', images: [], voice_url: null } : m
      ));
    } catch { toast.error('Failed to unsend'); }
  };
  const reactDM = async (dm_id, emoji) => {
    setReactionPickerFor(null);
    try {
      const res = await api.post(`/dm/${dm_id}/react`, { emoji });
      setDmMessages(prev => prev.map(m =>
        m.dm_id === dm_id ? { ...m, reactions: res.data.reactions } : m
      ));
    } catch { toast.error('Failed to react'); }
  };

  // Send "typing" event over WS (rate-limited to once every 2.5s)
  const sendTypingSignal = () => {
    if (!activeDM || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - typingSentAtRef.current < 2500) return;
    typingSentAtRef.current = now;
    wsRef.current.send(JSON.stringify({ type: 'dm_typing', receiver_id: activeDM, typing: true }));
  };

  const sendDMMessage = async () => {
    if ((!newDMMessage.trim() && dmAttachImages.length === 0) || !activeDM) return;
    const content = newDMMessage.trim() || '📎';
    const images = [...dmAttachImages];
    const replyToId = replyTo?.dm_id || null;
    setNewDMMessage('');
    setDmAttachImages([]);
    setReplyTo(null);

    // Optimistic message — _status: 'sending'
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMsg = {
      dm_id: tempId,
      sender_id: user.user_id,
      receiver_id: activeDM,
      content,
      images,
      reply_to: replyToId,
      reply_context: replyTo ? {
        dm_id: replyTo.dm_id, sender_id: replyTo.sender_id,
        content: (replyTo.content || '').slice(0, 120), deleted: replyTo.deleted
      } : null,
      created_at: new Date().toISOString(),
      _pending: true,
      _status: 'sending'
    };
    setDmMessages(prev => [...prev, optimisticMsg]);

    // Try WebSocket first (real-time + cheap)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'dm', receiver_id: activeDM, content, images, reply_to: replyToId
      }));
      // The WS echo will replace the optimistic message (matched by content+sender within 30s)
      return;
    }

    // REST fallback when WS down
    try {
      const res = await api.post(`/dm/${activeDM}/send`, { content, images, reply_to: replyToId });
      setDmMessages(prev => prev.map(m => m.dm_id === tempId ? { ...res.data, _status: 'sent' } : m));
      loadDMConversations();
    } catch {
      toast.error('Failed to send message');
      setDmMessages(prev => prev.map(m => m.dm_id === tempId ? { ...m, _status: 'failed' } : m));
    }
  };

  const [dmAttachImages, setDmAttachImages] = useState([]);
  const dmFileRef = useRef(null);

  const handleDMImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setDmAttachImages(prev => [...prev, resolveAssetUrl(res.data.url)]);
    } catch (err) { toast.error('Upload failed'); }
    e.target.value = '';
  };

  const startDMWithUser = (targetUser) => {
    setActiveTab('dm');
    setActiveDM(targetUser.user_id);
    setActiveDMUser(targetUser);
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const loadChatRooms = async () => {
    try {
      const response = await api.get('/chat/rooms');
      setChatRooms(response.data);
    } catch (error) {
      // Fallback
      setChatRooms([{ id: 'general', name: 'General', color: '#3b82f6' }]);
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      toast.success('Post deleted');
      loadFeed();
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  const repostPost = async (postId) => {
    try {
      await api.post(`/posts/${postId}/repost`);
      toast.success('Reposted! View in your profile → Reposts tab.');
      loadFeed();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to repost';
      toast.error(msg);
    }
  };

  const unrepostPost = async (postId) => {
    try {
      await api.delete(`/posts/${postId}/repost`);
      toast.success('Repost removed');
      loadFeed();
    } catch (error) {
      toast.error('Failed to remove repost');
    }
  };

  const sharePost = (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Post link copied to clipboard!');
    }).catch(() => {
      toast.info('Share link: ' + url);
    });
  };

  const sendReaction = (messageId, emoji) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'reaction', message_id: messageId, emoji }));
    setShowEmojiPicker(null);
  };

  const reportChatMessage = async (messageId) => {
    const reason = window.prompt('Why are you reporting this message?');
    if (!reason) return;
    try {
      const res = await api.post('/chat/report', { message_id: messageId, chat_room: activeChatRoom, reason, category: 'other' });
      toast.success(`Message reported! Reference #${res.data.serial_number}. Share this number with moderators.`);
    } catch (e) { toast.error('Failed to report'); }
  };

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  const sendVoiceChat = (voiceUrl) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'chat_message', chat_room: activeChatRoom, content: '🎤 Voice message', voice_url: voiceUrl }));
  };

  const sendVoiceDM = async (voiceUrl) => {
    if (!activeDM) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'dm', receiver_id: activeDM,
        content: '🎤 Voice message',
        voice_url: voiceUrl,
        message_type: 'text'
      }));
    } else {
      try {
        await api.post(`/dm/${activeDM}/send`, {
          content: '🎤 Voice message',
          voice_url: voiceUrl,
          message_type: 'text'
        });
        loadDMMessages();
      } catch { toast.error('Failed to send voice message'); }
    }
  };

  const sendCallLog = async (action, duration = 0) => {
    if (!activeDM) return;
    // Store action and duration cleanly — message_type field controls rendering
    const content = action === 'started' ? 'call_started'
                  : action === 'ended'   ? `call_ended:${duration}`
                  : 'call_missed';
    try {
      await api.post(`/dm/${activeDM}/send`, {
        content,
        message_type: 'call_log'
      });
      loadDMMessages();
    } catch {}
  };

  const startCall = (callType) => {
    if (!activeDM || !activeDMUser) return;
    sendCallLog('started');
    setActiveCall({ targetUser: activeDMUser, callType, isIncoming: false });
  };

  const filteredDMConversations = dmConversations.filter(conv => {
    if (!dmSearchQuery.trim()) return true;
    const q = dmSearchQuery.toLowerCase();
    return (getPublicName(conv.user) || '').toLowerCase().includes(q) || conv.user?.id_number?.toLowerCase().includes(q);
  });

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatChatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDayDivider = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000); // days
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#FDFBF7]" data-testid="main-app">
      {/* Left Sidebar */}
      <div className="hidden md:flex md:w-60 bg-white border-r-2 border-[#111111] p-4 flex-col">
        <div className="flex items-center justify-between mb-6">
          <img src="/bisdhub-logo.png" alt="BISD HUB" className="w-28 h-auto object-contain" data-testid="app-logo" />
          <div className="flex gap-1">
            <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" data-testid="dark-mode-toggle">
              {darkMode ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
            </button>
            <NotificationBell user={user} ws={ws} />
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {[
            { id: 'home', icon: House, label: 'Home' },
            { id: 'chat', icon: ChatCircleDots, label: 'Global Chat' },
            { id: 'dm', icon: PaperPlaneTilt, label: 'Messages' },
          ].map(item => {
            const dmUnread = item.id === 'dm' ? dmConversations.reduce((a,c) => a+(c.unread_count||0), 0) : 0;
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] text-sm transition-all ${
                  activeTab === item.id ? 'bg-[#2563EB] text-white' : 'bg-white text-[#111111]'
                } shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px]`}
              >
                <item.icon size={18} weight="bold" />
                {item.label}
                {dmUnread > 0 && (
                  <span className="absolute top-1 right-2 text-[9px] font-black text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1"
                    style={{ background: '#FF6B6B' }}>{dmUnread > 9 ? '9+' : dmUnread}</span>
                )}
              </button>
            );
          })}

          <button
            data-testid="nav-friends"
            onClick={() => navigate('/friends')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm"
          >
            <UsersThree size={18} weight="bold" /> Friends
          </button>
          {(user?.is_admin || user?.is_moderator) && (
            <button onClick={() => navigate('/chat-archive')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm">
              📁 Chat Archive
            </button>
          )}

          <button
            data-testid="nav-profile"
            onClick={() => navigate(`/profile/${user.id_number}`)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm"
          >
            <User size={18} weight="bold" /> Profile
          </button>

          <button
            data-testid="nav-settings"
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm"
          >
            <GearSix size={18} weight="bold" /> Settings
          </button>

          {(user.role === 'Project Owner' || user.role === 'Management') && (
            <button data-testid="nav-management" onClick={() => navigate('/management')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-[#FF6B6B] text-white shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm">
              <Crown size={18} weight="bold" /> Management
            </button>
          )}

          {user.is_admin && (
            <button data-testid="nav-admin" onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-[#A7F3D0] text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm">
              Admin Panel
            </button>
          )}

          {user.is_moderator && (
            <button data-testid="nav-moderation" onClick={() => navigate('/moderation')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-[#2563EB] text-white shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm">
              <ShieldCheck size={18} weight="bold" /> Moderation
            </button>
          )}
        </nav>

        <button data-testid="logout-button" onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm">
          <SignOut size={18} weight="bold" /> Logout
        </button>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#111111] flex justify-around py-2 z-50">
        {[
          { id: 'home', icon: House },
          { id: 'chat', icon: ChatCircleDots },
          { id: 'dm', icon: PaperPlaneTilt },
        ].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`p-2 rounded-lg ${activeTab === item.id ? 'text-[#2563EB]' : 'text-[#4B4B4B]'}`}>
            <div className="relative">
              <item.icon size={24} weight={activeTab === item.id ? 'fill' : 'bold'} />
              {item.id === 'dm' && dmConversations.reduce((a,c)=>a+(c.unread_count||0),0) > 0 && (
                <span className="absolute -top-1 -right-1 text-[8px] font-black text-white rounded-full w-3.5 h-3.5 flex items-center justify-center" style={{background:'#FF6B6B'}}>
                  {dmConversations.reduce((a,c)=>a+(c.unread_count||0),0)}
                </span>
              )}
            </div>
          </button>
        ))}
        <button onClick={() => navigate('/friends')} className="p-2 text-[#4B4B4B]">
          <UsersThree size={24} weight="bold" />
        </button>
        <button onClick={() => navigate(`/profile/${user.id_number}`)} className="p-2 text-[#4B4B4B]">
          <User size={24} weight="bold" />
        </button>
        <button onClick={() => navigate('/settings')} className="p-2 text-[#4B4B4B]">
          <GearSix size={24} weight="bold" />
        </button>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b-2 border-[#111111] p-3 flex items-center justify-between">
        <img src="/bisdhub-logo.png" alt="BISD HUB" className="w-20 h-auto object-contain" />
        <div className="flex gap-2 items-center">
          <button onClick={toggleDarkMode} className="p-1.5" data-testid="mobile-dark-toggle">
            {darkMode ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
          </button>
          <NotificationBell user={user} ws={ws} />
          <button onClick={onLogout} className="p-1.5 border-2 border-[#111111] rounded-lg">
            <SignOut size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        {activeTab === 'home' && (
          <div className="flex-1 overflow-hidden flex">
            <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4">
              {/* Create Post */}
              <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 mb-4">
                <CreatePostDialog user={user} onPostCreated={loadFeed} />
              </div>

              {/* Feed Tabs */}
              <Tabs value={feedType} onValueChange={setFeedType} className="mb-3">
                <TabsList className="rounded-xl p-1 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
                  <TabsTrigger value="official" data-testid="feed-official">Official</TabsTrigger>
                  <TabsTrigger value="feed" data-testid="feed-public">Public</TabsTrigger>
                  <TabsTrigger value="following" data-testid="feed-following">Following</TabsTrigger>
                  <TabsTrigger value="friends" data-testid="feed-friends">Friends</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Posts */}
              <ScrollArea className="flex-1">
                <div className="space-y-4">
                  {posts.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-[#4B4B4B]">No posts yet. Be the first to post!</p>
                    </div>
                  )}
                  {posts.map((post) => (
                    <div key={post.post_id} data-testid={`post-${post.post_id}`} className="rounded-xl p-4 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar className="border-2 border-[#111111] cursor-pointer hover:opacity-80 w-10 h-10"
                          onClick={() => navigate(`/profile/${post.user?.id_number}`)}>
                          <AvatarImage src={resolveAssetUrl(post.user?.profile_picture)} />
                          <AvatarFallback>{getPublicName(post.user)?.[1] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-sm cursor-pointer hover:underline"
                              onClick={() => navigate(`/profile/${post.user?.id_number}`)}>
                              {post.user?.username ? `@${post.user.username}` : post.user?.display_name || post.user?.id_number || 'User'}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                              {post.user?.username && (post.user?.display_name || post.user?.full_name)
                                ? post.user.display_name || post.user.full_name
                                : ''}
                            </span>
                            {post.user?.badges?.filter(b => b !== "Superior").map((badge, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-[#111111] bg-[#FF6B6B] text-white">
                                {badge}
                              </span>
                            ))}
                            {post.visibility === 'official' && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-[#111111] bg-[#2563EB] text-white">Official</span>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                            {formatTime(post.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      <p className="text-sm mb-3 break-words whitespace-pre-wrap">{post.content}</p>
                      
                      {/* Voice Note */}
                      {post.voice_url && (
                        <div className="mb-3 bg-[#F5F5F5] border-2 border-[#111111] rounded-xl px-3 py-2">
                          <VoicePlayer src={resolveAssetUrl(post.voice_url)} />
                        </div>
                      )}
                      
                      {/* Post Images */}
                      {post.images?.length > 0 && (
                        <div className={`grid gap-2 mb-3 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {post.images.map((img, i) => (
                            <img key={i} src={resolveAssetUrl(img)} alt="" className="w-full rounded-lg border-2 border-[#111111] object-cover max-h-64" />
                          ))}
                        </div>
                      )}
                      
                      {/* Actions */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <button data-testid={`like-post-${post.post_id}`}
                          onClick={() => likePost(post.post_id, post.likes?.includes(user.user_id))}
                          className={`flex items-center gap-1.5 font-medium ${post.likes?.includes(user.user_id) ? '' : ''}`}
                          style={{ color: post.likes?.includes(user.user_id) ? '#FF6B6B' : 'var(--text-3)' }}>
                          <Heart size={18} weight={post.likes?.includes(user.user_id) ? 'fill' : 'bold'} />
                          {post.likes?.length || 0}
                        </button>

                        <button onClick={() => setExpandedComments({...expandedComments, [post.post_id]: !expandedComments[post.post_id]})}
                          className="flex items-center gap-1.5 text-[#4B4B4B] hover:text-[#2563EB] font-medium">
                          <ChatCircle size={18} weight="bold" />
                          {post.comments?.length || 0}
                        </button>
                        <button onClick={() => post.is_reposted_by_me ? unrepostPost(post.post_id) : repostPost(post.post_id)}
                          className="flex items-center gap-1.5 font-medium transition-colors" data-testid={`repost-${post.post_id}`}
                          style={{ color: post.is_reposted_by_me ? '#16a34a' : 'var(--text-3)' }}
                          title={post.is_reposted_by_me ? 'Click to remove repost' : 'Repost'}>
                          <ArrowsClockwise size={18} weight={post.is_reposted_by_me ? 'fill' : 'bold'} />
                          {post.share_count || 0}
                        </button>
                        <button onClick={() => sharePost(post.post_id)}
                          className="flex items-center gap-1.5 text-[#4B4B4B] hover:text-[#2563EB] font-medium" data-testid={`share-${post.post_id}`}>
                          <Copy size={18} weight="bold" />
                          <span className="hidden sm:inline">Share</span>
                        </button>
                        <PostOptionsMenu
                          post={post}
                          currentUser={user}
                          canDelete={post.user_id === user.user_id || user.is_admin || user.is_moderator}
                          onDelete={() => deletePost(post.post_id)}
                          onViewLikers={post.user_id === user.user_id ? () => setViewLikersPost(post) : null}
                        />
                      </div>
                      
                      {/* Repost indicator */}
                      {post.repost_of && (
                        <p className="text-[10px] mt-1 flex items-center gap-1 font-semibold"
                          style={{ color: 'var(--text-3)' }}>
                          <ArrowsClockwise size={10} weight="bold" />
                          {post.repost_original_username
                            ? <span>Reposted from <span style={{ color: 'var(--blue)' }}>@{post.repost_original_username}</span></span>
                            : 'Reposted'}
                        </p>
                      )}
                      
                      {expandedComments[post.post_id] && (
                        <CommentSection post={post} user={user} />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Right Sidebar - Search */}
            <div className="hidden lg:block w-72 bg-white border-l-2 border-[#111111] p-4">
              <div className="mb-4">
                <form onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery)}`); }}>
                  <div className="relative">
                    <Input
                      data-testid="search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users, posts..."
                      className="border-2 border-[#111111] rounded-xl px-4 py-2 pr-10 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] w-full"
                    />
                    <button type="submit" data-testid="search-button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#2563EB] text-white hover:translate-y-[1px]">
                      <MagnifyingGlass size={14} weight="bold" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Real-time dropdown results */}
              {searchQuery.trim().length >= 2 && (searchResults.users.length > 0 || searchResults.posts.length > 0) && (
                <div className="space-y-4">
                  {searchResults.users.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2 text-[#4B4B4B]">People</h3>
                      <div className="space-y-1.5">
                        {searchResults.users.slice(0, 5).map((u) => (
                          <div key={u.user_id} data-testid={`quick-search-user-${u.user_id}`} onClick={() => { navigate(`/profile/${u.id_number}`); setSearchQuery(''); }}
                            className="flex items-center gap-2 p-2 rounded-lg border border-[#111111] hover:bg-[#A7F3D0] cursor-pointer transition-colors">
                            <Avatar className="w-8 h-8 border border-[#111111]">
                              <AvatarImage src={resolveAssetUrl(u.profile_picture)} />
                              <AvatarFallback className="text-xs">{getPublicName(u)?.[1] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate">{getPublicName(u)}</p>
                              <p className="text-[10px] text-[#4B4B4B]">{getSecondaryIdentity(u) || `@${u.id_number}`}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.posts.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2 text-[#4B4B4B]">Posts</h3>
                      <div className="space-y-1.5">
                        {searchResults.posts.slice(0, 3).map((p) => (
                          <div key={p.post_id} className="p-2 rounded-lg border border-[#111111]">
                            <p className="font-bold text-xs">{getPublicName(p.user)}</p>
                            <p className="text-xs truncate text-[#4B4B4B]">{p.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => { navigate(`/search?q=${encodeURIComponent(searchQuery)}`); setSearchQuery(''); }}
                    data-testid="view-all-results"
                    className="w-full text-center text-xs font-bold py-2 rounded-lg border-2 border-[#111111] bg-[#2563EB] text-white shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px]">
                    View all results
                  </button>
                </div>
              )}

              {searchQuery.trim().length >= 2 && searchResults.users.length === 0 && searchResults.posts.length === 0 && (
                <p className="text-xs text-center py-4 text-[#4B4B4B]">No results found</p>
              )}
            </div>
          </div>
        )}

        {/* GLOBAL CHAT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-48 md:w-56 bg-white border-r-2 border-[#111111] p-3 flex-shrink-0">
              <h2 className="text-sm font-black mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Chat Rooms</h2>
              <div className="space-y-1.5">
                {chatRooms.map((room) => (
                  <button key={room.id} data-testid={`chat-room-${room.id}`}
                    onClick={() => { setActiveChatRoom(room.id); setReplyingTo(null); }}
                    className="w-full text-left px-3 py-2 rounded-lg font-bold text-xs transition-all"
                    style={{
                      backgroundColor: activeChatRoom === room.id ? room.color : 'var(--bg-surface)',
                      color: activeChatRoom === room.id ? 'white' : 'var(--text-1)',
                      border: '1px solid var(--border)'
                    }}>
                    {room.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col p-4">
              <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] flex-1 flex flex-col p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{chatRooms.find(r => r.id === activeChatRoom)?.name || 'Chat'}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${wsReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {wsReady ? '● Live' : '● Polling (WS reconnecting)'}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 hidden sm:inline">
                    🔄 Resets 1 AM & 1 PM ({(() => { const n=new Date(); const utc3=new Date(n.getTime()+3*3600000); const h=utc3.getUTCHours(); const next1=h<1?1:h<13?13:25; const diffH=next1-h; return diffH<=0?'<1h':`~${diffH}h`; })()})
                  </span>
                </div>
                <ScrollArea className="flex-1 mb-3">
                  <div className="space-y-3">
                    {chatMessages.map((msg) => (
                      <div key={msg.message_id} data-testid={`chat-msg-${msg.message_id}`} className={`flex ${msg.user_id === user.user_id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] group relative ${
                          msg.user_id === user.user_id
                            ? 'bg-[#2563EB] text-white rounded-2xl rounded-br-sm px-3 py-2'
                            : 'rounded-2xl rounded-bl-sm px-3 py-2' } style={msg.sender_id !== user.user_id ? { background: 'var(--bg-surface)' } : {}
                        }`}>
                          {/* Reply preview */}
                          {msg.reply_data && (
                            <div className={`text-[10px] mb-1 px-2 py-1 rounded-lg ${msg.user_id === user.user_id ? 'bg-blue-700/40' : 'bg-gray-200'}`}>
                              <span className="font-bold">{msg.reply_data.user?.display_name}:</span> {msg.reply_data.content?.slice(0, 50)}{msg.reply_data.content?.length > 50 ? '...' : ''}
                            </div>
                          )}
                          {msg.user_id !== user.user_id && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <img
                                src={resolveAssetUrl(msg.user?.profile_picture) || ''}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover flex-shrink-0 border"
                                style={{ borderColor: 'var(--border-c)' }}
                                onError={e => { e.target.style.display='none'; }}
                              />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black" style={{ color: 'var(--text-1)', lineHeight: 1.2 }}>
                                  {msg.user?.full_name || msg.user?.display_name || 'User'}
                                </span>
                                <span className="text-[9px]" style={{ color: 'var(--blue)', lineHeight: 1.2 }}>
                                  {msg.user?.username ? `@${msg.user.username}` : ''}{msg.user?.id_number ? ` · ${msg.user.id_number}` : ''}
                                </span>
                              </div>
                            </div>
                          )}
                          <p className="text-sm">{msg.content}</p>
                          {msg.voice_url && <VoicePlayer src={msg.voice_url} dark={msg.sender_id === user.user_id} />}
                          <p className={`text-[10px] mt-0.5 ${msg.user_id === user.user_id ? 'text-white/60' : ''}`} style={{ color: msg.user_id !== user.user_id ? 'var(--text-3)' : undefined }}>
                            {formatChatTime(msg.created_at)}
                          </p>

                          {/* Reactions display */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <button key={emoji} onClick={() => sendReaction(msg.message_id, emoji)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${users.includes(user.user_id) ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                                  {emoji} {users.length}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Hover actions */}
                          <div className="hidden group-hover:flex absolute -top-3 right-0 gap-0.5 bg-white border border-gray-200 rounded-lg shadow-md p-0.5">
                            <button onClick={() => setReplyingTo(msg)} data-testid={`reply-msg-${msg.message_id}`}
                              className="p-1 hover:bg-gray-100 rounded" title="Reply">
                              <ArrowBendUpLeft size={12} weight="bold" className="text-gray-600" />
                            </button>
                            <button onClick={() => setShowEmojiPicker(showEmojiPicker === msg.message_id ? null : msg.message_id)}
                              className="p-1 hover:bg-gray-100 rounded" title="React">
                              <Smiley size={12} weight="bold" className="text-gray-600" />
                            </button>
                            {msg.user_id !== user.user_id && (
                              <button onClick={() => reportChatMessage(msg.message_id)} data-testid={`report-msg-${msg.message_id}`}
                                className="p-1 hover:bg-red-50 rounded" title="Report">
                                <WarningCircle size={12} weight="bold" className="text-red-400" />
                              </button>
                            )}
                          </div>

                          {/* Emoji picker */}
                          {showEmojiPicker === msg.message_id && (
                            <div className="absolute -top-10 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-1 flex gap-0.5 z-10">
                              {QUICK_EMOJIS.map(e => (
                                <button key={e} onClick={() => sendReaction(msg.message_id, e)} className="p-1 hover:bg-gray-100 rounded text-base">{e}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Reply bar */}
                {replyingTo && (
                  <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <ArrowBendUpLeft size={12} weight="bold" style={{ color: 'var(--blue)' }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--text-2)' }}>
                      Replying to <span className="font-bold">{getPublicName(replyingTo.user)}</span>: {replyingTo.content?.slice(0, 40)}
                    </span>
                    <button onClick={() => setReplyingTo(null)} className="font-bold" style={{ color: 'var(--text-3)' }}>✕</button>
                  </div>
                )}

                <div className="flex gap-2">
                  <VoiceRecorder onSend={sendVoiceChat} compact />
                  <Input data-testid="chat-message-input"
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder={replyingTo ? 'Type your reply...' : 'Type a message...'}
                    className="border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
                  <Button data-testid="send-chat-message" onClick={sendChatMessage}
                    className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 rounded-xl">
                    <PaperPlaneRight size={18} weight="bold" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DMs */}
        {activeTab === 'dm' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Conversation list — full width on mobile when no DM active, sidebar on desktop */}
            <div className={`${activeDM ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 md:flex-shrink-0 border-r-0 md:border-r-2 border-[#111111] p-3`}
              style={{ background: 'var(--bg-card)' }}>
              <h2 className="text-sm font-black mb-3" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-1)' }}>Direct Messages</h2>
              <Input data-testid="dm-search-input" value={dmSearchQuery} onChange={(e) => setDmSearchQuery(e.target.value)}
                placeholder="Search conversations..." className="border-2 border-[#111111] rounded-xl px-3 py-2 mb-3 text-xs"
                style={{ background: 'var(--bg-input)', color: 'var(--text-1)' }} />
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-1.5">
                  {filteredDMConversations.map((conv) => (
                    <button key={conv.user?.user_id} data-testid={`dm-conversation-${conv.user?.user_id}`}
                      onClick={() => { setActiveDM(conv.user?.user_id); setActiveDMUser(conv.user); }}
                      className={`w-full text-left p-2.5 rounded-xl border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] ${
                        activeDM === conv.user?.user_id ? 'bg-[#2563EB] text-white' : 'bg-white'
                      }`}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-9 h-9 border-2 border-[#111111]">
                          <AvatarImage src={resolveAssetUrl(conv.user?.profile_picture)} />
                          <AvatarFallback className="text-xs">{getPublicName(conv.user)?.[1] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{getPublicName(conv.user)}</p>
                          <p className="text-xs opacity-60 truncate">{conv.last_message?.content}</p>
                        </div>
                        {conv.unread_count > 0 && (
                          <span className="bg-[#FF6B6B] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[#111111]">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {filteredDMConversations.length === 0 && (
                    <p className="text-xs text-[#4B4B4B] text-center py-8">
                      {dmSearchQuery ? 'No conversations match' : 'No conversations yet'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {activeDM ? (
              <div className="flex-1 flex flex-col p-0 md:p-3 min-w-0 overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden rounded-none md:rounded-xl"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-c)' }}>
                  {/* DM Header with Call Buttons */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-c)' }}>
                    {/* Mobile back button */}
                    <button className="md:hidden p-1.5 -ml-1 rounded-lg" onClick={() => { setActiveDM(null); setActiveDMUser(null); }}
                      style={{ color: 'var(--text-1)', background: 'var(--bg-surface)' }}>
                      <span className="text-sm font-bold">←</span>
                    </button>
                    <Avatar className="w-8 h-8 border border-[#111111] cursor-pointer"
                      onClick={() => activeDMUser?.id_number && navigate(`/profile/${activeDMUser.id_number}`)}>
                      <AvatarImage src={resolveAssetUrl(activeDMUser?.profile_picture)} />
                      <AvatarFallback className="text-xs">{getPublicName(activeDMUser)?.[1] || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-sm cursor-pointer hover:underline flex-1"
                      onClick={() => activeDMUser?.id_number && navigate(`/profile/${activeDMUser.id_number}`)}>
                      {getPublicName(activeDMUser)}
                    </span>
                    <div className="flex gap-1.5">
                      <button data-testid="dm-audio-call" onClick={() => startCall('audio')}
                        className="p-2 rounded-lg border-2 border-[#111111] bg-[#A7F3D0] text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px]" title="Voice Call">
                        <Phone size={16} weight="bold" />
                      </button>
                      <button data-testid="dm-video-call" onClick={() => startCall('video')}
                        className="p-2 rounded-lg border-2 border-[#111111] bg-[#2563EB] text-white shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px]" title="Video Call">
                        <VideoCamera size={16} weight="bold" />
                      </button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 mb-3">
                    <div className="space-y-1.5 px-1">
                      {dmMessages.map((msg, idx) => {
                        // Date divider — shown when day changes
                        const prevMsg = idx > 0 ? dmMessages[idx - 1] : null;
                        const showDate = !prevMsg || (
                          new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
                        );
                        const isOwn = msg.sender_id === user.user_id;
                        const isCallLog = msg.message_type === 'call_log';

                        return (
                          <React.Fragment key={msg.dm_id}>
                            {showDate && (
                              <div className="flex justify-center my-3">
                                <span className="text-[10px] font-bold px-3 py-1 rounded-full border"
                                  style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', borderColor: 'var(--border-c)' }}>
                                  {formatDayDivider(msg.created_at)}
                                </span>
                              </div>
                            )}

                            {isCallLog ? (
                              (() => {
                                const c = msg.content || '';
                                let icon, label, color, bg;
                                if (c === 'call_started') { icon='📞'; label='Audio call started'; color='#16a34a'; bg='rgba(22,163,74,0.08)'; }
                                else if (c.startsWith('call_ended:')) {
                                  const secs = parseInt(c.split(':')[1]) || 0;
                                  const dur = secs > 0 ? ` · ${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}` : '';
                                  icon='📞'; label=`Call ended${dur}`; color='#2563EB'; bg='rgba(37,99,235,0.08)';
                                } else { icon='📵'; label='Missed call'; color='#FF6B6B'; bg='rgba(255,107,107,0.08)'; }
                                return (
                                  <div className="flex justify-center w-full my-1">
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border"
                                      style={{ background: bg, borderColor: color + '30', color }}>
                                      <span>{icon}</span><span>{label}</span>
                                      <span className="opacity-50 font-normal text-[10px]">{formatChatTime(msg.created_at)}</span>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : msg.deleted ? (
                              /* Deleted message tombstone */
                              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className="max-w-[75%] px-3 py-2 rounded-2xl text-xs italic flex items-center gap-1.5"
                                  style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px dashed var(--border-c)' }}>
                                  <span>🚫</span>
                                  <span>This message was deleted</span>
                                  <span className="text-[9px] opacity-60 ml-1">{formatChatTime(msg.created_at)}</span>
                                </div>
                              </div>
                            ) : (
                              /* Regular message bubble */
                              <div className={`group flex ${isOwn ? 'justify-end' : 'justify-start'} relative`}>
                                <div className="flex flex-col" style={{ maxWidth: '78%' }}>
                                  {/* Reply context preview */}
                                  {msg.reply_context && (
                                    <div className={`text-[10px] px-2 py-1 mb-0.5 rounded-lg border-l-2 ${isOwn ? 'self-end' : 'self-start'}`}
                                      style={{ background: 'var(--bg-surface)', borderLeftColor: 'var(--blue)', color: 'var(--text-2)' }}>
                                      <span className="font-bold" style={{ color: 'var(--blue)' }}>
                                        {msg.reply_context.sender_id === user.user_id ? 'You' : (activeDMUser?.display_name || 'User')}:
                                      </span>{' '}
                                      <span className="italic">{msg.reply_context.deleted ? '(deleted message)' : msg.reply_context.content}</span>
                                    </div>
                                  )}

                                  <div className={`relative ${
                                    isOwn ? 'bg-[#2563EB] text-white rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
                                  } px-3 py-2 break-words`}
                                    style={!isOwn ? { background: 'var(--bg-surface)', color: 'var(--text-1)' } : {}}>

                                    {/* Edit mode */}
                                    {editingDM === msg.dm_id ? (
                                      <div className="flex flex-col gap-1 min-w-[200px]">
                                        <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                                          className="text-sm bg-white/10 rounded px-2 py-1 text-current border border-white/20 focus:outline-none focus:ring-1 focus:ring-white/40 resize-none"
                                          rows={2} autoFocus
                                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEditDM(); } if (e.key === 'Escape') cancelEditDM(); }} />
                                        <div className="flex gap-1 justify-end">
                                          <button onClick={cancelEditDM} className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20">Cancel</button>
                                          <button onClick={submitEditDM} className="text-[10px] px-2 py-0.5 rounded bg-white text-[#2563EB] font-bold">Save</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        {msg.images?.length > 0 && (
                                          <div className="mt-1.5 flex flex-col gap-1">
                                            {msg.images.map((img, i) => (
                                              <img key={i} src={resolveAssetUrl(img)} alt="" className="rounded-lg max-h-48 object-cover border border-white/20" />
                                            ))}
                                          </div>
                                        )}
                                        {msg.voice_url && <VoicePlayer src={msg.voice_url} dark={isOwn} />}
                                      </>
                                    )}

                                    {/* Time + status + edited */}
                                    {editingDM !== msg.dm_id && (
                                      <div className="flex items-center justify-end gap-1 mt-0.5">
                                        {msg.edited && (
                                          <button onClick={() => setShowHistory(msg)} className={`text-[9px] ${isOwn ? 'text-white/60' : ''} italic hover:underline`}
                                            style={!isOwn ? { color: 'var(--text-3)' } : {}} title="View edit history">
                                            edited
                                          </button>
                                        )}
                                        <span className={`text-[10px] ${isOwn ? 'text-white/60' : ''}`} style={!isOwn ? { color: 'var(--text-3)' } : {}}>
                                          {formatChatTime(msg.created_at)}
                                        </span>
                                        {isOwn && (
                                          <span className="text-[10px] text-white/80 ml-0.5">
                                            {msg._status === 'sending' && '🕒'}
                                            {msg._status === 'failed' && '⚠️'}
                                            {(!msg._status || msg._status === 'sent') && (msg.read ? '✓✓' : '✓')}
                                            {msg._status === 'read' && '✓✓'}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Reactions row */}
                                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                    <div className={`flex gap-1 mt-1 flex-wrap ${isOwn ? 'self-end' : 'self-start'}`}>
                                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                                        <button key={emoji} onClick={() => reactDM(msg.dm_id, emoji)}
                                          className="px-1.5 py-0.5 rounded-full text-xs border flex items-center gap-1"
                                          style={{
                                            background: users.includes(user.user_id) ? 'rgba(37,99,235,0.15)' : 'var(--bg-surface)',
                                            borderColor: users.includes(user.user_id) ? 'var(--blue)' : 'var(--border-c)',
                                            color: 'var(--text-1)'
                                          }}>
                                          <span>{emoji}</span>
                                          <span className="text-[10px] font-bold">{users.length}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Hover actions (right side for own msgs, left for others) */}
                                {editingDM !== msg.dm_id && (
                                  <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ${isOwn ? 'order-first mr-1' : 'ml-1'}`}>
                                    <button onClick={() => setReplyTo(msg)} title="Reply"
                                      className="p-1 rounded-full hover:bg-black/10" style={{ color: 'var(--text-3)' }}>
                                      <ArrowBendUpLeft size={12} weight="bold" />
                                    </button>
                                    <div className="relative">
                                      <button onClick={() => setReactionPickerFor(reactionPickerFor === msg.dm_id ? null : msg.dm_id)} title="React"
                                        className="p-1 rounded-full hover:bg-black/10 text-xs" style={{ color: 'var(--text-3)' }}>😊</button>
                                      {reactionPickerFor === msg.dm_id && (
                                        <div className="absolute z-10 top-full mt-1 right-0 flex gap-1 rounded-full border px-2 py-1 shadow-lg"
                                          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
                                          {['❤️','😂','😮','😢','👍','🔥'].map(e => (
                                            <button key={e} onClick={() => reactDM(msg.dm_id, e)} className="text-base hover:scale-125 transition-transform">{e}</button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {isOwn && !msg.voice_url && !msg.images?.length && (
                                      <button onClick={() => startEditDM(msg)} title="Edit"
                                        className="p-1 rounded-full hover:bg-black/10 text-[10px]" style={{ color: 'var(--text-3)' }}>✏️</button>
                                    )}
                                    {isOwn && (
                                      <button onClick={() => unsendDM(msg.dm_id)} title="Unsend"
                                        className="p-1 rounded-full hover:bg-red-100 text-[10px]" style={{ color: '#FF6B6B' }}>🗑️</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Typing indicator */}
                      {typingUser && (
                        <div className="flex justify-start mt-1">
                          <div className="px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1.5"
                            style={{ background: 'var(--bg-surface)' }}>
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{activeDMUser?.display_name || 'User'} is typing</span>
                            <span className="flex gap-0.5">
                              <span className="w-1 h-1 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-1 h-1 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-1 h-1 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </span>
                          </div>
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Reply preview above input */}
                  {replyTo && (
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg border-l-2"
                      style={{ background: 'var(--bg-surface)', borderLeftColor: 'var(--blue)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold" style={{ color: 'var(--blue)' }}>
                          Replying to {replyTo.sender_id === user.user_id ? 'yourself' : (activeDMUser?.display_name || 'User')}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{replyTo.content || (replyTo.voice_url ? '🎤 Voice message' : (replyTo.images?.length ? '📷 Image' : 'message'))}</p>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="text-lg" style={{ color: 'var(--text-3)' }}>✕</button>
                    </div>
                  )}

                  {/* DM Image Previews */}
                  {dmAttachImages.length > 0 && (
                    <div className="flex gap-2 mb-2">
                      {dmAttachImages.map((img, i) => (
                        <div key={i} className="relative">
                          <img src={img} alt="" className="w-12 h-12 object-cover rounded-lg border-2 border-[#111111]" />
                          <button onClick={() => setDmAttachImages(prev => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1 -right-1 bg-[#FF6B6B] text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] border border-[#111111]">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <VoiceRecorder onSend={sendVoiceDM} compact />
                    <button onClick={() => dmFileRef.current?.click()} data-testid="dm-attach-image"
                      className="p-2 rounded-lg border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px]">
                      <Image size={14} weight="bold" />
                    </button>
                    <input ref={dmFileRef} type="file" accept="image/*,video/mp4" className="hidden" onChange={handleDMImageUpload} />
                    <Input data-testid="dm-message-input"
                      value={newDMMessage}
                      onChange={(e) => { setNewDMMessage(e.target.value); sendTypingSignal(); }}
                      onKeyDown={(e) => e.key === 'Enter' && sendDMMessage()}
                      placeholder={replyTo ? "Reply..." : "Type a message..."}
                      className="border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
                    <Button data-testid="send-dm-message" onClick={sendDMMessage}
                      className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 rounded-xl">
                      <PaperPlaneRight size={18} weight="bold" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[#4B4B4B]">Select a conversation or start a new one from a user's profile</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Call Overlay */}
            {/* Edit History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowHistory(null)}>
          <div className="rounded-2xl border max-w-md w-full p-5" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
            <h3 className="font-black text-lg mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              ✏️ Edit History
            </h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {(showHistory.edit_history || []).map((h, i) => (
                <div key={i} className="p-2 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                  <p className="text-[10px] mb-1" style={{ color: 'var(--text-3)' }}>
                    {new Date(h.edited_at).toLocaleString()}
                  </p>
                  <p className="text-sm line-through" style={{ color: 'var(--text-3)' }}>{h.old_content}</p>
                </div>
              ))}
              <div className="p-2 rounded-lg border-l-2" style={{ background: 'var(--bg-surface)', borderLeftColor: '#16a34a' }}>
                <p className="text-[10px] mb-1 font-bold" style={{ color: '#16a34a' }}>Current</p>
                <p className="text-sm" style={{ color: 'var(--text-1)' }}>{showHistory.content}</p>
              </div>
            </div>
            <button onClick={() => setShowHistory(null)} className="mt-3 w-full py-2 rounded-lg font-bold"
              style={{ background: 'var(--blue)', color: '#fff' }}>Close</button>
          </div>
        </div>
      )}

      {activeCall && (
        <CallUI
          wsRef={wsRef}
          user={user}
          targetUser={activeCall.targetUser}
          callType={activeCall.callType}
          isIncoming={false}
          onEnd={(duration) => { sendCallLog(duration > 0 ? 'ended' : 'missed', duration); setActiveCall(null); }}
        />
      )}

      {/* Incoming Call Overlay */}
      {incomingCall && !activeCall && (
        <CallUI
          wsRef={wsRef}
          user={user}
          targetUser={{ user_id: incomingCall.caller_id, display_name: incomingCall.caller_name, profile_picture: incomingCall.caller_picture }}
          callType={incomingCall.call_type}
          isIncoming={true}
          incomingOffer={incomingCall.sdp}
          onEnd={(duration) => { sendCallLog(duration > 0 ? 'ended' : 'missed', duration); setIncomingCall(null); }}
        />
      )}
    </div>
  );
};

export default MainApp;
