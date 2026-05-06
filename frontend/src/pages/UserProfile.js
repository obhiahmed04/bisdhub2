import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Heart, ChatCircle, UserPlus, UserMinus } from '@phosphor-icons/react';
import api, { getPublicName, getSecondaryIdentity, resolveAssetUrl } from '../utils/api';
import EditProfileDialog from '../components/EditProfileDialog';
import CommentSection from '../components/CommentSection';
import ReportDialog from '../components/ReportDialog';

const UserProfile = ({ currentUser, onLogout, updateUser }) => {
  const { idNumber } = useParams();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [friendRequestReceived, setFriendRequestReceived] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [profileTab, setProfileTab] = useState('posts');
  const navigate = useNavigate();
  const isOwnProfile = currentUser?.id_number === idNumber;

  useEffect(() => {
    loadProfile();
    loadPosts();
    loadFollowers();
    loadFollowing();
  }, [idNumber]);

  const loadProfile = async () => {
    try {
      const response = await api.get(`/users/${idNumber}`);
      setProfileUser(response.data);
      setIsFollowing(response.data.followers?.includes(currentUser?.user_id));
      setIsFriend(response.data.friends?.includes(currentUser?.user_id));
      setFriendRequestSent(response.data.friend_requests_received?.includes(currentUser?.user_id));
      
      // Check if we received a friend request from this user
      const meRes = await api.get('/users/me');
      setFriendRequestReceived(meRes.data.friend_requests_received?.includes(response.data.user_id));
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || 'Failed to load profile');
    }
  };

  const loadPosts = async () => {
    try {
      const response = await api.get(`/posts/user/${idNumber}`);
      setPosts(response.data);
    } catch (error) {
      console.error('Failed to load posts');
    }
  };

  const loadFollowers = async () => {
    try {
      const response = await api.get(`/users/${idNumber}/followers`);
      setFollowers(response.data);
    } catch (error) {
      setFollowers([]);
    }
  };

  const loadFollowing = async () => {
    try {
      const response = await api.get(`/users/${idNumber}/following`);
      setFollowing(response.data);
    } catch (error) {
      setFollowing([]);
    }
  };

  const handleProfileUpdate = (updatedUser) => {
    setProfileUser(updatedUser);
    if (isOwnProfile && updateUser) updateUser(updatedUser);
  };

  const toggleFollow = async () => {
    try {
      if (isFollowing) {
        await api.delete(`/users/${idNumber}/follow`);
        toast.success('Unfollowed');
      } else {
        await api.post(`/users/${idNumber}/follow`);
        toast.success('Followed');
      }
      setIsFollowing(!isFollowing);
      loadProfile();
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  const sendFriendRequest = async () => {
    try {
      await api.post(`/friends/request/${idNumber}`);
      toast.success('Friend request sent!');
      setFriendRequestSent(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send friend request');
    }
  };

  const acceptFriendRequest = async () => {
    try {
      await api.post(`/friends/accept/${profileUser.user_id}`);
      toast.success('Friend request accepted!');
      setIsFriend(true);
      setFriendRequestReceived(false);
    } catch (error) {
      toast.error('Failed to accept friend request');
    }
  };

  const removeFriend = async () => {
    try {
      await api.delete(`/friends/${profileUser.user_id}`);
      toast.success('Friend removed');
      setIsFriend(false);
    } catch (error) {
      toast.error('Failed to remove friend');
    }
  };

  const likePost = async (postId, isLiked) => {
    try {
      if (isLiked) await api.delete(`/posts/${postId}/like`);
      else await api.post(`/posts/${postId}/like`);
      loadPosts();
    } catch (error) {
      toast.error('Failed to update like');
    }
  };

  const startDM = () => {
    navigate('/', { state: { startDM: profileUser } });
  };

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <p className="text-lg font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="max-w-3xl mx-auto">
        <div className="p-4">
          <Button data-testid="profile-back-button" onClick={() => navigate('/')}
            className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
            <ArrowLeft size={16} weight="bold" /> Back
          </Button>
        </div>

        {/* Profile Header */}
        <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] mx-4 mb-4">
          <div className="h-36 md:h-44 rounded-t-xl border-b-2 border-[#111111] bg-gradient-to-r from-blue-400 to-purple-500"
            style={profileUser.banner_image ? {
              backgroundImage: `url(${profileUser.banner_image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : {}} />

          <div className="p-4">
            <div className="flex flex-col md:flex-row md:items-start gap-3 mb-4">
              <Avatar className="w-20 h-20 border-4 border-[#111111] -mt-14 bg-white" data-testid="profile-avatar">
                <AvatarImage src={resolveAssetUrl(profileUser.profile_picture)} />
                <AvatarFallback className="text-2xl font-black">{getPublicName(profileUser)?.[1] || 'U'}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl md:text-2xl font-black break-words" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="profile-name">
                    {getPublicName(profileUser)}
                  </h1>
                  {profileUser.badges?.filter(b => b !== "Superior").map((badge, i) => (
                    <span key={i} data-testid={`profile-badge-${i}`}
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#111111] bg-[#FF6B6B] text-white">
                      {badge}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-[#4B4B4B]" data-testid="profile-id">{getSecondaryIdentity(profileUser) || `@${profileUser.id_number}`}</p>
                <p className="text-sm font-medium text-[#111111] mt-0.5">{profileUser.full_name}</p>
                <p className="text-xs text-[#4B4B4B] mt-0.5" data-testid="profile-class">
                  {profileUser.current_class} - {profileUser.section} {profileUser.is_ex_student && '(EX Student)'}
                </p>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {isOwnProfile ? (
                    <EditProfileDialog user={profileUser} onProfileUpdated={handleProfileUpdate} />
                  ) : (
                    <>
                      <Button data-testid="profile-follow-button" onClick={toggleFollow}
                        className={`border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm ${
                          isFollowing ? 'bg-white text-[#111111]' : 'bg-[#2563EB] text-white'
                        }`}>
                        {isFollowing ? 'Unfollow' : 'Follow'}
                      </Button>
                      
                      {isFriend ? (
                        <Button onClick={removeFriend} data-testid="remove-friend-button"
                          className="bg-[#FF6B6B] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
                          <UserMinus size={14} weight="bold" /> Unfriend
                        </Button>
                      ) : friendRequestReceived ? (
                        <Button onClick={acceptFriendRequest} data-testid="accept-friend-button"
                          className="bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
                          <UserPlus size={14} weight="bold" /> Accept Request
                        </Button>
                      ) : friendRequestSent ? (
                        <Button disabled className="bg-gray-100 text-[#4B4B4B] border-2 border-[#D1D1D1] font-bold px-4 py-2 rounded-xl text-sm">
                          Request Sent
                        </Button>
                      ) : (
                        <Button onClick={sendFriendRequest} data-testid="send-friend-request-button"
                          className="bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
                          <UserPlus size={14} weight="bold" /> Add Friend
                        </Button>
                      )}
                      
                      <Button onClick={startDM} data-testid="profile-dm-button"
                        className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
                        <PaperPlaneTilt size={14} weight="bold" /> Message
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {profileUser.bio && (
              <p className="text-sm mb-4 break-words" data-testid="profile-bio">{profileUser.bio}</p>
            )}

            <div className="flex gap-4">
              <button onClick={() => setShowFollowers(true)} className="hover:underline">
                <span className="font-black text-sm" data-testid="profile-followers-count">{profileUser.followers?.length || 0}</span>
                <span className="text-[#4B4B4B] ml-1 text-sm">Followers</span>
              </button>
              <button onClick={() => setShowFollowing(true)} className="hover:underline">
                <span className="font-black text-sm" data-testid="profile-following-count">{profileUser.following?.length || 0}</span>
                <span className="text-[#4B4B4B] ml-1 text-sm">Following</span>
              </button>
              <div>
                <span className="font-black text-sm">{profileUser.friends?.length || 0}</span>
                <span className="text-[#4B4B4B] ml-1 text-sm">Friends</span>
              </div>
            </div>
          </div>
        </div>

        {/* Followers Dialog */}
        <Dialog open={showFollowers} onOpenChange={setShowFollowers}>
          <DialogContent className="bg-white border-2 border-[#111111] shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] rounded-xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>Followers ({followers.length})</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-80">
              <div className="space-y-2 p-2">
                {followers.map((f) => (
                  <div key={f.user_id} onClick={() => { navigate(`/profile/${f.id_number}`); setShowFollowers(false); }}
                    className="flex items-center gap-3 p-2 rounded-xl border border-[#111111] hover:bg-[#A7F3D0] cursor-pointer">
                    <Avatar className="w-8 h-8 border border-[#111111]">
                      <AvatarImage src={resolveAssetUrl(f.profile_picture)} />
                      <AvatarFallback className="text-xs">{getPublicName(f)?.[1] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm">{getPublicName(f)}</p>
                      <p className="text-xs text-[#4B4B4B]">@{f.id_number}</p>
                    </div>
                  </div>
                ))}
                {followers.length === 0 && <p className="text-sm text-[#4B4B4B] text-center py-4">No followers yet</p>}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Following Dialog */}
        <Dialog open={showFollowing} onOpenChange={setShowFollowing}>
          <DialogContent className="bg-white border-2 border-[#111111] shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] rounded-xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>Following ({following.length})</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-80">
              <div className="space-y-2 p-2">
                {following.map((f) => (
                  <div key={f.user_id} onClick={() => { navigate(`/profile/${f.id_number}`); setShowFollowing(false); }}
                    className="flex items-center gap-3 p-2 rounded-xl border border-[#111111] hover:bg-[#A7F3D0] cursor-pointer">
                    <Avatar className="w-8 h-8 border border-[#111111]">
                      <AvatarImage src={resolveAssetUrl(f.profile_picture)} />
                      <AvatarFallback className="text-xs">{getPublicName(f)?.[1] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm">{getPublicName(f)}</p>
                      <p className="text-xs text-[#4B4B4B]">@{f.id_number}</p>
                    </div>
                  </div>
                ))}
                {following.length === 0 && <p className="text-sm text-[#4B4B4B] text-center py-4">Not following anyone yet</p>}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Posts */}
        <div className="px-4 pb-6">
          <div className="flex gap-2 mb-3">
            <Button onClick={() => setProfileTab('posts')} className={`border-2 border-[#111111] rounded-xl px-4 py-2 font-bold ${profileTab === 'posts' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#111111]'}`}>Posts</Button>
            <Button onClick={() => setProfileTab('reposts')} className={`border-2 border-[#111111] rounded-xl px-4 py-2 font-bold ${profileTab === 'reposts' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#111111]'}`}>Reposts</Button>
          </div>
          {profileUser.profile_locked && !isOwnProfile && (
            <div className="mb-4 rounded-xl border-2 border-[#111111] bg-white p-4">
              <p className="font-bold">This profile is private.</p>
              <p className="text-sm text-[#4B4B4B] mt-1">Follow this user to view posts and more details.</p>
            </div>
          )}
          <div className="space-y-4">
            {posts.filter(post => profileTab === 'reposts' ? !!post.repost_of : !post.repost_of).map((post) => (
              <div key={post.post_id} data-testid={`profile-post-${post.post_id}`}
                className="bg-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] rounded-xl p-4">
                {post.serial_number && <p className="text-[10px] text-[#4B4B4B] mb-1">#{post.serial_number}</p>}
                <p className="text-sm mb-3 whitespace-pre-wrap">{post.content}</p>
                {post.images?.length > 0 && (
                  <div className={`grid gap-2 mb-3 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {post.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-full rounded-lg border-2 border-[#111111] object-cover max-h-64" />
                    ))}
                  </div>
                )}
                <div className="flex gap-4 text-sm">
                  <button onClick={() => likePost(post.post_id, post.likes?.includes(currentUser?.user_id))}
                    className={`flex items-center gap-1.5 font-medium ${post.likes?.includes(currentUser?.user_id) ? 'text-[#FF6B6B]' : 'text-[#4B4B4B] hover:text-[#FF6B6B]'}`}>
                    <Heart size={18} weight={post.likes?.includes(currentUser?.user_id) ? 'fill' : 'bold'} />
                    {post.likes?.length || 0}
                  </button>
                  <button onClick={() => setExpandedComments({...expandedComments, [post.post_id]: !expandedComments[post.post_id]})}
                    className="flex items-center gap-1.5 text-[#4B4B4B] hover:text-[#2563EB] font-medium">
                    <ChatCircle size={18} weight="bold" />
                    {post.comments?.length || 0}
                  </button>
                  {post.user_id !== currentUser?.user_id && (
                    <ReportDialog postId={post.post_id} onReported={loadPosts} />
                  )}
                </div>
                {expandedComments[post.post_id] && (
                  <CommentSection post={post} user={currentUser} />
                )}
              </div>
            ))}
            {posts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#4B4B4B]">No posts yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
