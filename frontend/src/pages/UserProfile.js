import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Heart, ChatCircle, UserPlus, UserMinus, Lock, UsersThree, PaperPlaneTilt, ChatTeardropDots, ArrowsClockwise, Copy } from '@phosphor-icons/react';
import api, { getPublicName, getSecondaryIdentity, resolveAssetUrl } from '../utils/api';
import EditProfileDialog from '../components/EditProfileDialog';
import CommentSection from '../components/CommentSection';
import PostOptionsMenu from '../components/PostOptionsMenu';
import { VoicePlayer } from '../components/VoiceRecorder';
import ReportDialog from '../components/ReportDialog';

const UserProfile = ({ currentUser, onLogout, updateUser }) => {
  const { idNumber } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [friendRequestReceived, setFriendRequestReceived] = useState(false);
  const [followRequestSentToPrivate, setFollowRequestSentToPrivate] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [friends, setFriends] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [likerPostId, setLikerPostId] = useState(null);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [followRequests, setFollowRequests] = useState([]);
  const [likers, setLikers] = useState([]);
  const [profileTab, setProfileTab] = useState('posts');
  const isOwnProfile = currentUser?.id_number === idNumber;

  useEffect(() => {
    if (!likerPostId) return;
    api.get(`/posts/${likerPostId}/likes`).then(r => setLikers(r.data)).catch(() => setLikers([]));
  }, [likerPostId]);

  useEffect(() => {
    if (!isOwnProfile || !showFollowRequests) return;
    api.get('/users/me/follow-requests').then(r => setFollowRequests(r.data)).catch(() => {});
  }, [showFollowRequests, isOwnProfile]);

  useEffect(() => {
    setLoading(true); setError(null); setProfileUser(null);
    setPosts([]); setFollowers([]); setFollowing([]); setFriends([]);
    loadAll();
  }, [idNumber]);

  const loadAll = async () => {
    try {
      const [profileRes, meRes] = await Promise.all([
        api.get(`/users/${idNumber}`),
        api.get('/users/me')
      ]);
      const profile = profileRes.data;
      setProfileUser(profile);
      setIsFollowing(profile.followers?.includes(currentUser?.user_id));
      setIsFriend(profile.friends?.includes(currentUser?.user_id));
      setFriendRequestSent(profile.friend_requests_received?.includes(currentUser?.user_id));
      setFriendRequestReceived(meRes.data.friend_requests_received?.includes(profile.user_id));

      // Load posts, followers, following in parallel (silently fail each)
      const [postsRes, followersRes, followingRes] = await Promise.allSettled([
        api.get(`/posts/user/${idNumber}`),
        api.get(`/users/${idNumber}/followers`),
        api.get(`/users/${idNumber}/following`),
      ]);
      if (postsRes.status === 'fulfilled') setPosts(postsRes.value.data);
      if (followersRes.status === 'fulfilled') setFollowers(followersRes.value.data);
      if (followingRes.status === 'fulfilled') setFollowing(followingRes.value.data);

      // Load friends list
      try {
        const canSeeFriends = profile.is_friends_public || profile.user_id === currentUser?.user_id;
        if (canSeeFriends && profile.friends?.length > 0) {
          const friendPromises = profile.friends.slice(0, 50).map(fId =>
            api.get(`/users/by-id/${fId}`).catch(() => null)
          );
          const friendResults = await Promise.all(friendPromises);
          setFriends(friendResults.filter(Boolean).map(r => r.data));
        }
      } catch { /* friends list silently fails */ }

    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updatedUser) => {
    setProfileUser(updatedUser);
    if (isOwnProfile && updateUser) updateUser(updatedUser);
  };

  const toggleFollow = async () => {
    if (followRequestSentToPrivate) { toast.info('Follow request already sent'); return; }
    try {
      if (isFollowing) {
        await api.delete(`/users/${idNumber}/follow`);
        setIsFollowing(false);
        toast.success('Unfollowed');
      } else {
        const res = await api.post(`/users/${idNumber}/follow`);
        if (res.data?.status === 'pending') {
          setFollowRequestSentToPrivate(true);
          toast.success('Follow request sent!');
        } else {
          setIsFollowing(true);
          toast.success('Followed');
        }
      }
      loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update follow status'); }
  };

  const sendFriendRequest = async () => {
    try {
      await api.post(`/friends/request/${idNumber}`);
      setFriendRequestSent(true);
      toast.success('Friend request sent!');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to send friend request'); }
  };

  const acceptFriendRequest = async () => {
    try {
      await api.post(`/friends/accept/${profileUser.user_id}`);
      setIsFriend(true); setFriendRequestReceived(false);
      toast.success('Friend request accepted!');
    } catch { toast.error('Failed to accept friend request'); }
  };

  const acceptFollowRequest = async (requesterIdNumber) => {
    try {
      await api.post(`/users/${requesterIdNumber}/follow-request/accept`);
      setFollowRequests(prev => prev.filter(r => r.id_number !== requesterIdNumber));
      toast.success('Follow request accepted');
      loadAll();
    } catch { toast.error('Failed'); }
  };

  const rejectFollowRequest = async (requesterIdNumber) => {
    try {
      await api.post(`/users/${requesterIdNumber}/follow-request/reject`);
      setFollowRequests(prev => prev.filter(r => r.id_number !== requesterIdNumber));
      toast.success('Request declined');
    } catch { toast.error('Failed'); }
  };

  const removeFriend = async () => {
    try {
      await api.delete(`/friends/${profileUser.user_id}`);
      setIsFriend(false);
      toast.success('Friend removed');
    } catch { toast.error('Failed to remove friend'); }
  };

  const likePost = async (postId, isLiked) => {
    try {
      if (isLiked) await api.delete(`/posts/${postId}/like`);
      else await api.post(`/posts/${postId}/like`);
      const res = await api.get(`/posts/user/${idNumber}`);
      setPosts(res.data);
    } catch { toast.error('Failed to update like'); }
  };

  const startDM = () => navigate('/', { state: { startDM: profileUser } });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p style={{ color: 'var(--text-2)' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text-1)' }}>Profile Not Found</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>{error}</p>
          <Button onClick={() => navigate('/')} className="rounded-xl border-2 font-bold px-6 py-2"
            style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
            <ArrowLeft size={16} className="mr-2" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!profileUser) return null;

  const canViewContent = profileUser.is_profile_public || isOwnProfile || isFollowing || isFriend;
  const canSeeFriends = profileUser.is_friends_public !== false || isOwnProfile;

  const UserListDialog = ({ open, onClose, title, users }) => (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
        <DialogHeader>
          <DialogTitle className="font-black text-lg" style={{ color: 'var(--text-1)' }}>{title} ({users.length})</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          <div className="space-y-2 p-1">
            {users.map(u => (
              <div key={u.user_id || u.id_number} onClick={() => { navigate(`/profile/${u.id_number}`); onClose(false); }}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                style={{ background: 'var(--bg-surface)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}>
                <Avatar className="w-9 h-9 border-2" style={{ borderColor: 'var(--border-c)' }}>
                  <AvatarImage src={resolveAssetUrl(u.profile_picture)} />
                  <AvatarFallback className="text-xs font-bold">{getPublicName(u)?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{getPublicName(u)}</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>ID: {u.id_number}</p>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>No users here yet</p>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Likers dialog */}
      <UserListDialog open={!!likerPostId} onClose={() => setLikerPostId(null)} title="Liked by" users={likers} />
      <div className="max-w-3xl mx-auto">
        {/* Top Bar */}
        <div className="p-4">
          <Button onClick={() => navigate(-1)} className="rounded-xl border-2 font-bold px-4 py-2 flex items-center gap-2 text-sm"
            style={{ background: 'var(--bg-card)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
            <ArrowLeft size={16} weight="bold" /> Back
          </Button>
        </div>

        {/* Profile Card */}
        <div className="mx-4 mb-4 rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
          {/* Banner */}
          <div className="h-36 md:h-44 relative"
            style={profileUser.banner_image
              ? { backgroundImage: `url(${resolveAssetUrl(profileUser.banner_image)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: 'linear-gradient(135deg, #2563EB 0%, #7c3aed 100%)' }}>
            {!canViewContent && (
              <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.3)' }}>
                <Lock size={32} weight="fill" className="text-white opacity-60" />
              </div>
            )}
          </div>

          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {/* Avatar */}
              <Avatar className="w-20 h-20 border-4 -mt-14 shrink-0"
                style={{ borderColor: 'var(--bg-card)', background: 'var(--bg-surface)' }}>
                <AvatarImage src={resolveAssetUrl(profileUser.profile_picture)} />
                <AvatarFallback className="text-2xl font-black" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>
                  {(profileUser.display_name || profileUser.full_name || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0 sm:mt-0 -mt-2">
                {/* Name + badges */}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-black break-words" style={{ color: 'var(--text-1)' }}>
                    {profileUser.full_name || profileUser.display_name || profileUser.id_number}
                  </h1>
                  {profileUser.badges?.filter(b => b !== 'Superior').map((badge, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: '#FF6B6B', color: '#fff', border: '1px solid var(--border-c)' }}>
                      {badge}
                    </span>
                  ))}
                  {!profileUser.is_profile_public && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border-c)' }}>
                      <Lock size={10} /> Private
                    </span>
                  )}
                </div>

                {profileUser.username && (
                  <p className="text-sm font-bold" style={{ color: 'var(--blue)' }}>@{profileUser.username}</p>
                )}
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Grade {profileUser.current_class} • {profileUser.section}
                  {profileUser.is_ex_student && ' • EX Student'}
                  {(profileUser.show_age !== false) && profileUser.date_of_birth && (() => {
                    try {
                      const [d, m, y] = profileUser.date_of_birth.split('/');
                      const dob = new Date(`${y}-${m}-${d}`);
                      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                      return !isNaN(age) && age > 0 ? ` • Age ${age}` : '';
                    } catch { return ''; }
                  })()}
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {isOwnProfile ? (
                    <>
                      <EditProfileDialog user={profileUser} onProfileUpdated={handleProfileUpdate} />
                      {profileUser.follow_requests_received?.length > 0 && (
                        <Button onClick={() => setShowFollowRequests(true)}
                          className="rounded-xl border-2 font-bold px-4 py-2 text-sm flex items-center gap-1.5"
                          style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--blue)', borderColor: 'var(--blue)' }}>
                          {profileUser.follow_requests_received.length} Follow Request{profileUser.follow_requests_received.length > 1 ? 's' : ''}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button onClick={toggleFollow} className="rounded-xl border-2 font-bold px-4 py-2 text-sm"
                        style={{
                          background: isFollowing ? 'var(--bg-surface)' : followRequestSentToPrivate ? 'var(--bg-surface)' : 'var(--blue)',
                          color: isFollowing ? 'var(--text-1)' : followRequestSentToPrivate ? 'var(--text-2)' : '#fff',
                          borderColor: isFollowing ? 'var(--border-c)' : 'var(--border-c)'
                        }}>
                        {isFollowing ? 'Unfollow' : followRequestSentToPrivate ? '⏳ Requested' : profileUser.is_profile_public === false ? '🔒 Request to Follow' : 'Follow'}
                      </Button>
                      {isFriend ? (
                        <Button onClick={removeFriend} className="rounded-xl border-2 font-bold px-4 py-2 text-sm flex items-center gap-1.5"
                          style={{ background: '#FF6B6B', color: '#fff', borderColor: '#ef4444' }}>
                          <UserMinus size={14} weight="bold" /> Unfriend
                        </Button>
                      ) : friendRequestReceived ? (
                        <Button onClick={acceptFriendRequest} className="rounded-xl border-2 font-bold px-4 py-2 text-sm flex items-center gap-1.5"
                          style={{ background: '#22c55e', color: '#fff', borderColor: '#16a34a' }}>
                          <UserPlus size={14} weight="bold" /> Accept Request
                        </Button>
                      ) : friendRequestSent ? (
                        <Button disabled className="rounded-xl border-2 font-bold px-4 py-2 text-sm"
                          style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', borderColor: 'var(--border-c)' }}>
                          Request Sent
                        </Button>
                      ) : isFollowing ? (
                        <Button onClick={sendFriendRequest} className="rounded-xl border-2 font-bold px-4 py-2 text-sm flex items-center gap-1.5"
                          style={{ background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
                          <UserPlus size={14} weight="bold" /> Add Friend
                        </Button>
                      ) : null}
                      <Button onClick={startDM} className="rounded-xl border-2 font-bold px-4 py-2 text-sm flex items-center gap-1.5"
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
                        <PaperPlaneTilt size={14} weight="bold" /> Message
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Bio */}
            {canViewContent && profileUser.bio && (
              <p className="text-sm mt-4 break-words" style={{ color: 'var(--text-2)' }}>{profileUser.bio}</p>
            )}

            {/* Stats */}
            <div className="flex gap-5 mt-4">
              <button onClick={() => setShowFollowers(true)} className="hover:underline text-left">
                <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>{profileUser.followers?.length || 0}</span>
                <span className="text-sm ml-1" style={{ color: 'var(--text-3)' }}>Followers</span>
              </button>
              <button onClick={() => setShowFollowing(true)} className="hover:underline text-left">
                <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>{profileUser.following?.length || 0}</span>
                <span className="text-sm ml-1" style={{ color: 'var(--text-3)' }}>Following</span>
              </button>
              {canSeeFriends ? (
                <button onClick={() => setShowFriends(true)} className="hover:underline text-left flex items-center gap-1">
                  <UsersThree size={14} style={{ color: 'var(--text-3)' }} />
                  <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>{profileUser.friends?.length || 0}</span>
                  <span className="text-sm ml-0.5" style={{ color: 'var(--text-3)' }}>Friends</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-3)' }}>
                  <Lock size={12} />
                  <span>{profileUser.friends?.length || 0} Friends</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Private profile notice */}
        {!canViewContent && !isOwnProfile && (
          <div className="mx-4 mb-4 rounded-2xl border p-6 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
            <Lock size={40} weight="fill" className="mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
            <h3 className="font-black text-lg mb-1" style={{ color: 'var(--text-1)' }}>Private Profile</h3>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Follow this user to view their posts and full profile.
            </p>
            {!isFollowing && (
              <Button onClick={toggleFollow} className="mt-4 rounded-xl border-2 font-bold px-6 py-2"
                style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                Follow to View Profile
              </Button>
            )}
          </div>
        )}

        {/* Posts */}
        {(canViewContent || isOwnProfile) && (
          <div className="px-4 pb-6">
            <div className="flex gap-2 mb-4">
              {['posts', 'reposts'].map(tab => (
                <Button key={tab} onClick={() => setProfileTab(tab)}
                  className="rounded-xl border-2 px-4 py-2 font-bold capitalize text-sm"
                  style={{
                    background: profileTab === tab ? 'var(--blue)' : 'var(--bg-card)',
                    color: profileTab === tab ? '#fff' : 'var(--text-2)',
                    borderColor: profileTab === tab ? 'var(--blue)' : 'var(--border-c)'
                  }}>
                  {tab}
                </Button>
              ))}
            </div>
            <div className="space-y-4">
              {posts.filter(post => profileTab === 'reposts' ? !!post.repost_of : !post.repost_of).map(post => (
                <div key={post.post_id} data-testid={`profile-post-${post.post_id}`}
                  className="rounded-xl p-4 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
                  {/* Header: avatar + name + meta */}
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="border-2 border-[#111111] w-10 h-10">
                      <AvatarImage src={resolveAssetUrl(profileUser?.profile_picture)} />
                      <AvatarFallback>{getPublicName(profileUser)?.[1] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm">
                          {profileUser?.username ? `@${profileUser.username}` : profileUser?.display_name || profileUser?.id_number || 'User'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {profileUser?.username ? (profileUser?.display_name || '') : ''}
                        </span>
                        {profileUser?.badges?.filter(b => b !== "Superior").map((badge, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-[#111111] bg-[#FF6B6B] text-white">
                            {badge}
                          </span>
                        ))}
                        {post.visibility === 'official' && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-[#111111] bg-[#2563EB] text-white">Official</span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {post.serial_number && <span className="font-mono mr-2">#{post.serial_number}</span>}
                        {new Date(post.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm mb-3 break-words whitespace-pre-wrap" style={{ color: 'var(--text-1)' }}>{post.content}</p>

                  {/* Voice note */}
                  {post.voice_url && (
                    <div className="mb-3 bg-[#F5F5F5] border-2 border-[#111111] rounded-xl px-3 py-2">
                      <VoicePlayer src={resolveAssetUrl(post.voice_url)} dark={false} />
                    </div>
                  )}

                  {/* Images */}
                  {post.images?.length > 0 && (
                    <div className={`grid gap-2 mb-3 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {post.images.map((img, i) => (
                        <img key={i} src={resolveAssetUrl(img)} alt="" className="w-full rounded-lg border-2 border-[#111111] object-cover max-h-64" />
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <button onClick={() => likePost(post.post_id, post.likes?.includes(currentUser?.user_id))}
                      className="flex items-center gap-1.5 font-medium"
                      style={{ color: post.likes?.includes(currentUser?.user_id) ? '#FF6B6B' : 'var(--text-3)' }}>
                      <Heart size={18} weight={post.likes?.includes(currentUser?.user_id) ? 'fill' : 'bold'} />
                      {post.likes?.length || 0}
                    </button>
                    <button onClick={() => setExpandedComments(p => ({ ...p, [post.post_id]: !p[post.post_id] }))}
                      className="flex items-center gap-1.5 font-medium"
                      style={{ color: 'var(--text-3)' }}>
                      <ChatCircle size={18} weight="bold" />
                      {post.comments?.length || 0}
                    </button>
                    {post.repost_of && (
                      <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: '#16a34a' }}>
                        <ArrowsClockwise size={12} weight="bold" />
                        Repost
                      </span>
                    )}
                    <PostOptionsMenu
                      post={post}
                      currentUser={currentUser}
                      canDelete={post.user_id === currentUser?.user_id || currentUser?.is_admin || currentUser?.is_moderator}
                      onDelete={() => { /* TODO: delete from profile */ loadAll(); }}
                      onViewLikers={isOwnProfile ? () => setLikerPostId(post.post_id) : null}
                    />
                  </div>

                  {/* Repost indicator */}
                  {post.repost_of && post.repost_original_username && (
                    <p className="text-[10px] mt-1 flex items-center gap-1 font-semibold" style={{ color: 'var(--text-3)' }}>
                      <ArrowsClockwise size={10} weight="bold" />
                      Reposted from <span style={{ color: 'var(--blue)' }}>@{post.repost_original_username}</span>
                    </p>
                  )}

                  {expandedComments[post.post_id] && <CommentSection post={post} user={currentUser} />}
                </div>
              ))}
              {posts.filter(post => profileTab === 'reposts' ? !!post.repost_of : !post.repost_of).length === 0 && (
                <div className="text-center py-12">
                  <ChatTeardropDots size={40} className="mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
                  <p style={{ color: 'var(--text-3)' }}>No {profileTab} yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <UserListDialog open={showFollowers} onClose={setShowFollowers} title="Followers" users={followers} />
      {/* Follow Requests Dialog */}
      {isOwnProfile && showFollowRequests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFollowRequests(false)}>
          <div className="rounded-2xl border p-5 w-80 max-h-96 overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-lg mb-3" style={{ color: 'var(--text-1)' }}>Follow Requests ({followRequests.length})</h3>
            {followRequests.length === 0 && <p className="text-sm" style={{ color: 'var(--text-3)' }}>No pending requests</p>}
            <div className="space-y-3">
              {followRequests.map(r => (
                <div key={r.user_id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={resolveAssetUrl(r.profile_picture)} />
                    <AvatarFallback className="text-xs font-bold" style={{ background: 'var(--blue)', color: '#fff' }}>
                      {(r.display_name || 'U')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>
                      {r.username ? `@${r.username}` : r.display_name}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => acceptFollowRequest(r.id_number)}
                      className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--blue)', color: '#fff' }}>✓</button>
                    <button onClick={() => rejectFollowRequest(r.id_number)}
                      className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border-c)' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowFollowRequests(false)} className="mt-4 w-full text-sm font-bold py-2 rounded-xl border"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', borderColor: 'var(--border-c)' }}>Close</button>
          </div>
        </div>
      )}
      <UserListDialog open={showFollowing} onClose={setShowFollowing} title="Following" users={following} />
      <UserListDialog open={showFriends} onClose={setShowFriends} title="Friends" users={friends} />
    </div>
  );
};

export default UserProfile;
