import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { PaperPlaneRight, Trash } from '@phosphor-icons/react';
import api, { resolveAssetUrl } from '../utils/api';

const CommentSection = ({ post, user }) => {
  const [comments, setComments] = useState(post?.comments || []);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!post) return null;

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await api.post(`/posts/${post.post_id}/comment`, { content: text.trim() });
      setComments(prev => [...prev, res.data.comment]);
      setText('');
    } catch (e) {
      toast.error('Failed to post comment');
    } finally { setLoading(false); }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now - d) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
      return `${Math.floor(diff / 86400)}d`;
    } catch { return ''; }
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-c)' }}>
      {/* Comments list */}
      {comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {comments.map((c, i) => (
            <div key={c.comment_id || i} className="flex items-start gap-2">
              <Avatar className="w-6 h-6 shrink-0 border" style={{ borderColor: 'var(--border-c)' }}>
                <AvatarImage src={resolveAssetUrl(c.profile_picture)} />
                <AvatarFallback className="text-[9px] font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>
                  {(c.display_name || c.user?.display_name || 'U')[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 rounded-xl px-3 py-2" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-1)' }}>
                    {c.display_name || c.user?.display_name || 'User'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{formatTime(c.created_at)}</span>
                </div>
                <p className="text-xs mt-0.5 break-words" style={{ color: 'var(--text-2)' }}>{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-center">
        <Avatar className="w-7 h-7 shrink-0 border" style={{ borderColor: 'var(--border-c)' }}>
          <AvatarImage src={resolveAssetUrl(user?.profile_picture)} />
          <AvatarFallback className="text-[10px] font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>
            {(user?.display_name || 'U')[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-2">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
            placeholder="Write a comment..."
            className="rounded-xl border text-sm flex-1"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }}
          />
          <Button onClick={submit} disabled={loading || !text.trim()} size="sm"
            className="rounded-xl px-3 border"
            style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
            <PaperPlaneRight size={14} weight="bold" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CommentSection;
