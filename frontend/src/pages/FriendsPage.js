import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { ArrowLeft, UserCircle, MagnifyingGlass, Check, X, UserMinus } from '@phosphor-icons/react';
import api from '../utils/api';

const FriendsPage = ({ user }) => {
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadFriendRequests();
    loadFriends();
  }, []);

  const loadFriendRequests = async () => {
    try { const r = await api.get('/friends/requests'); setFriendRequests(r.data); } catch (e) { console.error('Failed to load requests'); }
  };

  const loadFriends = async () => {
    try { const r = await api.get('/friends/list'); setFriends(r.data); } catch (e) { console.error('Failed to load friends'); }
  };

  const acceptFriend = async (userId) => {
    try { await api.post(`/friends/accept/${userId}`); toast.success('Friend request accepted!'); loadFriendRequests(); loadFriends(); } catch (e) { toast.error('Failed to accept'); }
  };

  const rejectFriend = async (userId) => {
    try { await api.post(`/friends/reject/${userId}`); toast.info('Request declined'); loadFriendRequests(); } catch (e) { toast.error('Failed to decline'); }
  };

  const removeFriend = async (userId) => {
    if (!window.confirm('Remove this friend?')) return;
    try { await api.delete(`/friends/${userId}`); toast.info('Friend removed'); loadFriends(); } catch (e) { toast.error('Failed to remove'); }
  };

  const filteredFriends = friends.filter(f => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return f.display_name?.toLowerCase().includes(q) || f.id_number?.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={() => navigate('/')} data-testid="friends-back-button" className="btn btn-ghost px-3 py-2">
            <ArrowLeft size={16} weight="bold" />
          </Button>
          <div className="flex items-center gap-2">
            <UserCircle size={20} weight="bold" style={{ color: 'var(--text-1)' }} />
            <h1 className="heading text-xl font-black" style={{ color: 'var(--text-1)' }} data-testid="friends-title">Friends</h1>
          </div>
        </div>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="w-full mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <TabsTrigger value="friends" data-testid="friends-tab-list" className="flex-1">
              Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="friends-tab-requests" className="flex-1">
              Requests ({friendRequests.length})
            </TabsTrigger>
          </TabsList>

          {/* Friends List Tab */}
          <TabsContent value="friends">
            <div className="card p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {/* Search */}
              <div className="relative mb-4">
                <Input
                  data-testid="friends-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search friends..."
                  className="input-styled pl-9"
                />
                <MagnifyingGlass size={14} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
              </div>

              {filteredFriends.length === 0 ? (
                <div className="text-center py-12">
                  <UserCircle size={48} weight="thin" className="mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                    {searchQuery ? 'No friends match your search' : 'No friends yet. Follow users and send friend requests from their profiles!'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2">
                    {filteredFriends.map((f) => (
                      <div key={f.user_id} data-testid={`friend-item-${f.user_id}`}
                        className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[var(--bg-surface)]"
                        style={{ border: '1px solid var(--border)' }}>
                        <Avatar className="w-10 h-10 cursor-pointer" style={{ border: '1px solid var(--border)' }}
                          onClick={() => navigate(`/profile/${f.id_number}`)}>
                          <AvatarImage src={f.profile_picture} />
                          <AvatarFallback className="text-sm font-bold">{f.display_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/profile/${f.id_number}`)}>
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>{f.display_name}</p>
                          <p className="text-[10px] badge-mono" style={{ color: 'var(--text-3)' }}>@{f.id_number}</p>
                        </div>
                        <Button
                          data-testid={`remove-friend-${f.user_id}`}
                          onClick={() => removeFriend(f.user_id)}
                          className="btn btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 hover:text-[var(--red)]"
                          style={{ color: 'var(--text-3)' }}>
                          <UserMinus size={14} weight="bold" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          {/* Friend Requests Tab */}
          <TabsContent value="requests">
            <div className="card p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {friendRequests.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>No pending friend requests</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2">
                    {friendRequests.map((req) => (
                      <div key={req.user_id} data-testid={`friend-request-${req.user_id}`}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ border: '1px solid var(--border)' }}>
                        <Avatar className="w-10 h-10 cursor-pointer" style={{ border: '1px solid var(--border)' }}
                          onClick={() => navigate(`/profile/${req.id_number}`)}>
                          <AvatarImage src={req.profile_picture} />
                          <AvatarFallback className="text-sm font-bold">{req.display_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>{req.display_name}</p>
                          <p className="text-[10px] badge-mono" style={{ color: 'var(--text-3)' }}>@{req.id_number}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            data-testid={`accept-request-${req.user_id}`}
                            onClick={() => acceptFriend(req.user_id)}
                            className="btn text-xs px-3 py-1.5 flex items-center gap-1"
                            style={{ background: 'var(--green)', color: 'white', borderColor: 'var(--green)' }}>
                            <Check size={14} weight="bold" />
                            Accept
                          </Button>
                          <Button
                            data-testid={`decline-request-${req.user_id}`}
                            onClick={() => rejectFriend(req.user_id)}
                            className="btn text-xs px-3 py-1.5 flex items-center gap-1"
                            style={{ background: 'var(--red)', color: 'white', borderColor: 'var(--red)' }}>
                            <X size={14} weight="bold" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FriendsPage;
