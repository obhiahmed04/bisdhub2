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
  Phone, VideoCamera, Image
} from '@phosphor-icons/react';
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
  const [newDMMessage, setNewDMMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [wsReady, setWsReady] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
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
    if (activeChatRoom && wsRef.current?.readyState === WebSocket.OPEN) {
      loadChatMessages();
      wsRef.current.send(JSON.stringify({ type: 'join_room', room: activeChatRoom }));
    }
  }, [activeChatRoom]);

  useEffect(() => {
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

  const connectWebSocket = () => {
    const wsUrl = `${WS_BASE}/${user.user_id}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsReady(true);
      socket.send(JSON.stringify({ type: 'join_room', room: activeChatRoom }));
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
        setDmMessages(prev => {
          if (prev.some(m => m.dm_id === data.dm_id)) return prev;
          return [...prev, data];
        });
        loadDMConversations();
      }
      if (data.type === 'reaction_update') {
        setChatMessages(prev => prev.map(m => m.message_id === data.message_id ? { ...m, reactions: data.reactions } : m));
      }
      // Incoming call handling
      if (data.type === 'call_offer') {
        setIncomingCall({ caller_id: data.caller_id, caller_name: data.caller_name, caller_picture: data.caller_picture, call_type: data.call_type, sdp: data.sdp });
      }
      if (data.type === 'call_unavailable') {
        toast.error('User is not online');
        setActiveCall(null);
      }
    };

    socket.onerror = () => setWsReady(false);
    socket.onclose = () => {
      setWsReady(false);
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };

    setWs(socket);
    return () => { socket.close(); };
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

  const sendChatMessage = () => {
    if (!newChatMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (!wsReady) toast.error('Chat connection not ready');
      return;
    }
    const payload = {
      type: 'chat_message',
      chat_room: activeChatRoom,
      content: newChatMessage
    };
    if (replyingTo) {
      payload.reply_to = replyingTo.message_id;
    }
    wsRef.current.send(JSON.stringify(payload));
    setNewChatMessage('');
    setReplyingTo(null);
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

  const sendDMMessage = async () => {
    if ((!newDMMessage.trim() && dmAttachImages.length === 0) || !activeDM) return;
    try {
      await api.post(`/dm/${activeDM}/send`, { content: newDMMessage || '📎', images: dmAttachImages });
      setNewDMMessage('');
      setDmAttachImages([]);
      loadDMMessages();
      loadDMConversations();
    } catch (error) {
      toast.error('Failed to send message');
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
            setDmAttachImages(prev => [...prev, `${backendUrl}${res.data.url}`]);
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
      toast.success('Post reposted!');
      loadFeed();
    } catch (error) {
      toast.error('Failed to repost');
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

  const sendVoiceDM = (voiceUrl) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeDM) return;
    wsRef.current.send(JSON.stringify({ type: 'dm', receiver_id: activeDM, content: '🎤 Voice message', voice_url: voiceUrl }));
  };

  const startCall = (callType) => {
    if (!activeDM || !activeDMUser) return;
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
          ].map(item => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] text-sm transition-all ${
                activeTab === item.id ? 'bg-[#2563EB] text-white' : 'bg-white text-[#111111]'
              } shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px]`}
            >
              <item.icon size={18} weight="bold" />
              {item.label}
            </button>
          ))}

          <button
            data-testid="nav-friends"
            onClick={() => navigate('/friends')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold border-2 border-[#111111] bg-white text-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] text-sm"
          >
            <UsersThree size={18} weight="bold" /> Friends
          </button>

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
            <item.icon size={24} weight={activeTab === item.id ? 'fill' : 'bold'} />
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
                <TabsList className="bg-white border-2 border-[#111111] rounded-xl p-1">
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
                    <div key={post.post_id} data-testid={`post-${post.post_id}`} className="bg-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] rounded-xl p-4">
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
                              {getPublicName(post.user)}
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
                          <p className="text-xs cursor-pointer hover:underline" style={{ color: 'var(--text-3)' }}
                            onClick={() => navigate(`/profile/${post.user?.id_number}`)}>
                            {getSecondaryIdentity(post.user) || `@${post.user?.id_number}`} &middot; {formatTime(post.created_at)}
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
                          className={`flex items-center gap-1.5 font-medium ${post.likes?.includes(user.user_id) ? 'text-[#FF6B6B]' : 'text-[#4B4B4B] hover:text-[#FF6B6B]'}`}>
                          <Heart size={18} weight={post.likes?.includes(user.user_id) ? 'fill' : 'bold'} />
                          {post.likes?.length || 0}
                        </button>
                        <button onClick={() => setExpandedComments({...expandedComments, [post.post_id]: !expandedComments[post.post_id]})}
                          className="flex items-center gap-1.5 text-[#4B4B4B] hover:text-[#2563EB] font-medium">
                          <ChatCircle size={18} weight="bold" />
                          {post.comments?.length || 0}
                        </button>
                        <button onClick={() => repostPost(post.post_id)}
                          className="flex items-center gap-1.5 text-[#4B4B4B] hover:text-[#16a34a] font-medium" data-testid={`repost-${post.post_id}`}>
                          <ArrowsClockwise size={18} weight="bold" />
                          {post.share_count || 0}
                        </button>
                        <button onClick={() => sharePost(post.post_id)}
                          className="flex items-center gap-1.5 text-[#4B4B4B] hover:text-[#2563EB] font-medium" data-testid={`share-${post.post_id}`}>
                          <Copy size={18} weight="bold" />
                          <span className="hidden sm:inline">Share</span>
                        </button>
                        <PostOptionsMenu post={post} canDelete={post.user_id === user.user_id || user.is_admin || user.is_moderator} onDelete={() => deletePost(post.post_id)} />
                            className="flex items-center gap-1.5 font-medium text-[#4B4B4B] hover:text-[var(--red)]" data-testid={`delete-post-${post.post_id}`}>
                            <span className="text-xs">Delete</span>
                          </button>
                        )}
                      </div>
                      
                      {/* Repost indicator */}
                      {post.repost_of && (
                        <p className="text-[10px] text-[#4B4B4B] mt-1 flex items-center gap-1">
                          <ArrowsClockwise size={10} weight="bold" /> Reposted
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${wsReady ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {wsReady ? 'Connected' : 'Reconnecting...'}
                  </span>
                </div>
                <ScrollArea className="flex-1 mb-3">
                  <div className="space-y-3">
                    {chatMessages.map((msg) => (
                      <div key={msg.message_id} data-testid={`chat-msg-${msg.message_id}`} className={`flex ${msg.user_id === user.user_id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] group relative ${
                          msg.user_id === user.user_id
                            ? 'bg-[#2563EB] text-white rounded-2xl rounded-br-sm px-3 py-2'
                            : 'bg-[#F5F5F5] rounded-2xl rounded-bl-sm px-3 py-2'
                        }`}>
                          {/* Reply preview */}
                          {msg.reply_data && (
                            <div className={`text-[10px] mb-1 px-2 py-1 rounded-lg ${msg.user_id === user.user_id ? 'bg-blue-700/40' : 'bg-gray-200'}`}>
                              <span className="font-bold">{msg.reply_data.user?.display_name}:</span> {msg.reply_data.content?.slice(0, 50)}{msg.reply_data.content?.length > 50 ? '...' : ''}
                            </div>
                          )}
                          {msg.user_id !== user.user_id && (
                            <p className="text-[10px] font-bold opacity-70 mb-0.5">{getPublicName(msg.user)}</p>
                          )}
                          <p className="text-sm">{msg.content}</p>
                          {msg.voice_url && <VoicePlayer src={`${API_BASE}${msg.voice_url}`} />}
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
            <div className="w-72 bg-white border-r-2 border-[#111111] p-3 flex-shrink-0">
              <h2 className="text-sm font-black mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Direct Messages</h2>
              <Input data-testid="dm-search-input" value={dmSearchQuery} onChange={(e) => setDmSearchQuery(e.target.value)}
                placeholder="Search conversations..." className="border-2 border-[#111111] rounded-xl px-3 py-2 mb-3 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] text-xs" />
              <ScrollArea className="h-full">
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
              <div className="flex-1 flex flex-col p-4">
                <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] flex-1 flex flex-col p-4 overflow-hidden">
                  {/* DM Header with Call Buttons */}
                  <div className="flex items-center gap-3 pb-3 mb-3 border-b border-[#D1D1D1]">
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
                    <div className="space-y-3">
                      {dmMessages.map((msg) => (
                        <div key={msg.dm_id} className={`flex ${msg.sender_id === user.user_id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] ${
                            msg.sender_id === user.user_id
                              ? 'bg-[#2563EB] text-white rounded-2xl rounded-br-sm px-3 py-2'
                              : 'bg-[#F5F5F5] rounded-2xl rounded-bl-sm px-3 py-2'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            {msg.images?.length > 0 && (
                              <div className="mt-1.5">
                                {msg.images.map((img, i) => (
                                  <img key={i} src={resolveAssetUrl(img)} alt="" className="rounded-lg max-h-32 object-cover mt-1 border border-white/20" />
                                ))}
                              </div>
                            )}
                            {msg.voice_url && <VoicePlayer src={`${API_BASE}${msg.voice_url}`} />}
                            <p className={`text-[10px] mt-0.5 ${msg.sender_id === user.user_id ? 'text-white/60' : ''}`} style={{ color: msg.sender_id !== user.user_id ? 'var(--text-3)' : undefined }}>
                              {formatChatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>

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
                      onChange={(e) => setNewDMMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendDMMessage()}
                      placeholder="Type a message..."
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
      {activeCall && (
        <CallUI
          ws={wsRef.current}
          user={user}
          targetUser={activeCall.targetUser}
          callType={activeCall.callType}
          isIncoming={false}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* Incoming Call Overlay */}
      {incomingCall && !activeCall && (
        <CallUI
          ws={wsRef.current}
          user={user}
          targetUser={{ user_id: incomingCall.caller_id, display_name: incomingCall.caller_name, profile_picture: incomingCall.caller_picture }}
          callType={incomingCall.call_type}
          isIncoming={true}
          incomingOffer={incomingCall.sdp}
          onEnd={() => setIncomingCall(null)}
        />
      )}
    </div>
  );
};

export default MainApp;
