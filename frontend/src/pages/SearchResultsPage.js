import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, MagnifyingGlass, Heart, ChatCircle } from '@phosphor-icons/react';
import api, { getPublicName, getSecondaryIdentity, resolveAssetUrl } from '../utils/api';

const SearchResultsPage = ({ user }) => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      doSearch(initialQuery);
    }
  }, [initialQuery]);

  const doSearch = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const [usersRes, postsRes] = await Promise.all([
        api.get(`/users/search?query=${encodeURIComponent(q)}`),
        api.get(`/posts/search?query=${encodeURIComponent(q)}`)
      ]);
      setUsers(usersRes.data);
      setPosts(postsRes.data);
    } catch (e) {
      console.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`, { replace: true });
      doSearch(query);
    }
  };

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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base, #FDFBF7)' }}>
      <div className="max-w-3xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={() => navigate('/')} data-testid="search-back-button"
            className="bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] font-bold px-3 py-2 rounded-xl">
            <ArrowLeft size={16} weight="bold" />
          </Button>
          <h1 className="text-xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-1, #111)' }} data-testid="search-title">Search</h1>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="relative">
            <Input data-testid="search-results-input" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users, posts..."
              className="border-2 border-[#111111] rounded-xl px-4 py-3 pr-12 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] w-full text-sm" />
            <button type="submit" data-testid="search-submit-button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#2563EB] text-white border-2 border-[#111111] hover:translate-y-[1px]">
              <MagnifyingGlass size={16} weight="bold" />
            </button>
          </div>
        </form>

        {loading && <p className="text-center text-sm" style={{ color: 'var(--text-3)' }}>Searching...</p>}

        {!loading && (users.length > 0 || posts.length > 0) && (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="bg-white border-2 border-[#111111] rounded-xl p-1 mb-4">
              <TabsTrigger value="all" data-testid="search-tab-all">All ({users.length + posts.length})</TabsTrigger>
              <TabsTrigger value="users" data-testid="search-tab-users">Users ({users.length})</TabsTrigger>
              <TabsTrigger value="posts" data-testid="search-tab-posts">Posts ({posts.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <div className="space-y-4">
                {users.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3, #999)' }}>People</h3>
                    <div className="space-y-2">
                      {users.slice(0, 5).map(u => <UserCard key={u.user_id} u={u} navigate={navigate} />)}
                    </div>
                  </div>
                )}
                {posts.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3 mt-6" style={{ color: 'var(--text-3, #999)' }}>Posts</h3>
                    <div className="space-y-3">
                      {posts.slice(0, 10).map(p => <PostCard key={p.post_id} p={p} navigate={navigate} formatTime={formatTime} />)}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="users">
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-2">
                  {users.map(u => <UserCard key={u.user_id} u={u} navigate={navigate} />)}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="posts">
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-3">
                  {posts.map(p => <PostCard key={p.post_id} p={p} navigate={navigate} formatTime={formatTime} />)}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {!loading && !users.length && !posts.length && initialQuery && (
          <div className="text-center py-16">
            <MagnifyingGlass size={48} weight="thin" className="mx-auto mb-3 opacity-30" />
            <p className="font-bold" style={{ color: 'var(--text-2, #666)' }}>No results found for "{initialQuery}"</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3, #999)' }}>Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
};

const UserCard = ({ u, navigate }) => (
  <div data-testid={`search-user-${u.user_id}`} onClick={() => navigate(`/profile/${u.id_number}`)}
    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer bg-white border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] transition-all">
    <Avatar className="w-11 h-11 border-2 border-[#111111]">
      <AvatarImage src={resolveAssetUrl(u.profile_picture)} />
      <AvatarFallback className="text-sm font-bold">{getPublicName(u)?.[1] || 'U'}</AvatarFallback>
    </Avatar>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-bold text-sm truncate">{getPublicName(u)}</p>
        {u.badges?.filter(b => b !== 'Superior').map((b, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-[#111111] bg-[#FF6B6B] text-white">{b}</span>
        ))}
      </div>
      <p className="text-xs text-[#4B4B4B]">{getSecondaryIdentity(u) || `@${u.id_number}`}</p>
      {u.bio && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3, #999)' }}>{u.bio}</p>}
    </div>
    <div className="text-right text-xs text-[#4B4B4B] flex-shrink-0">
      {u.current_class && <p>Class {u.current_class}</p>}
      {u.section && <p>{u.section}</p>}
    </div>
  </div>
);

const PostCard = ({ p, navigate, formatTime }) => (
  <div data-testid={`search-post-${p.post_id}`}
    className="p-4 rounded-xl bg-white border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
    <div className="flex items-center gap-2 mb-2">
      <Avatar className="w-8 h-8 border border-[#111111] cursor-pointer" onClick={() => navigate(`/profile/${p.user?.id_number}`)}>
        <AvatarImage src={resolveAssetUrl(p.user?.profile_picture)} />
        <AvatarFallback className="text-xs">{getPublicName(p.user)?.[1] || 'U'}</AvatarFallback>
      </Avatar>
      <div>
        <span className="font-bold text-sm cursor-pointer hover:underline" onClick={() => navigate(`/profile/${p.user?.id_number}`)}>
          {getPublicName(p.user)}
        </span>
        <span className="text-xs text-[#4B4B4B] ml-2">{getSecondaryIdentity(p.user) || `@${p.user?.id_number}`} &middot; {formatTime(p.created_at)}</span>
      </div>
    </div>
    <p className="text-sm break-words whitespace-pre-wrap mb-2">{p.content}</p>
    {p.images?.length > 0 && (
      <div className="mb-2">
        <img src={p.images[0]} alt="" className="rounded-lg border border-[#111111] max-h-48 object-cover" />
      </div>
    )}
    <div className="flex gap-4 text-xs text-[#4B4B4B]">
      <span className="flex items-center gap-1"><Heart size={14} weight="bold" /> {p.likes?.length || 0}</span>
      <span className="flex items-center gap-1"><ChatCircle size={14} weight="bold" /> {p.comments?.length || 0}</span>
    </div>
  </div>
);

export default SearchResultsPage;
