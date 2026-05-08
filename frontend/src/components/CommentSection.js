import React, { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { PaperPlaneRight, Heart, ArrowBendUpLeft, Trash, PushPin, DotsThree } from '@phosphor-icons/react';
import api, { resolveAssetUrl } from '../utils/api';

const CommentSection = ({ post, user }) => {
  const [comments, setComments] = useState(post?.comments || []);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { comment_id, display_name }
  const [likedComments, setLikedComments] = useState({});
  const [pinnedComment, setPinnedComment] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});
  const inputRef = useRef(null);

  if (!post) return null;
  const isPostOwner = post.user_id === user?.user_id;

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const payload = { content: replyingTo ? `@${replyingTo.display_name} ${text.trim()}` : text.trim() };
      if (replyingTo) payload.reply_to = replyingTo.comment_id;
      const res = await api.post(`/posts/${post.post_id}/comment`, payload);
      const newComment = res.data?.comment || { ...payload, comment_id: Date.now().toString(), display_name: user?.display_name, created_at: new Date().toISOString(), likes: [], replies: [] };
      setComments(prev => [...prev, newComment]);
      setText('');
      setReplyingTo(null);
    } catch { toast.error('Failed to post comment'); }
    finally { setLoading(false); }
  };

  const deleteComment = async (commentId) => {
    try {
      await api.delete(`/posts/${post.post_id}/comment/${commentId}`);
      setComments(prev => prev.filter(c => c.comment_id !== commentId));
      toast.success('Comment deleted');
    } catch { toast.error('Failed to delete comment'); }
  };

  const likeComment = (commentId) => {
    setLikedComments(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const pinComment = (commentId) => {
    setPinnedComment(prev => prev === commentId ? null : commentId);
    toast.success(pinnedComment === commentId ? 'Comment unpinned' : 'Comment pinned');
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
      return `${Math.floor(diff / 86400)}d`;
    } catch { return ''; }
  };

  const startReply = (comment) => {
    setReplyingTo({ comment_id: comment.comment_id, display_name: comment.display_name || comment.user?.display_name || 'User' });
    setText('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sortedComments = [
    ...comments.filter(c => c.comment_id === pinnedComment),
    ...comments.filter(c => c.comment_id !== pinnedComment)
  ];

  const CommentItem = ({ comment, isReply = false }) => {
    const [showActions, setShowActions] = useState(false);
    const liked = likedComments[comment.comment_id];
    const isPinned = comment.comment_id === pinnedComment;
    const canDelete = isPostOwner || comment.user_id === user?.user_id;
    const displayName = comment.display_name || comment.user?.display_name || 'User';
    const username = comment.username || comment.user?.username;
    const pfp = comment.profile_picture || comment.user?.profile_picture;

    return (
      <div className={`flex items-start gap-2.5 group ${isReply ? 'ml-10 mt-2' : ''}`}>
        <Avatar className="w-8 h-8 shrink-0 border" style={{ borderColor: 'var(--border-c)' }}>
          <AvatarImage src={resolveAssetUrl(pfp)} />
          <AvatarFallback className="text-[11px] font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>
            {displayName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl px-3 py-2.5 inline-block max-w-full" style={{ background: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-black" style={{ color: 'var(--text-1)' }}>
                {username ? `@${username}` : displayName}
              </span>
              {isPinned && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5"
                  style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--blue)' }}>
                  <PushPin size={8} weight="fill" /> Pinned
                </span>
              )}
            </div>
            <p className="text-sm break-words" style={{ color: 'var(--text-1)' }}>{comment.content}</p>
          </div>
          {/* Actions row */}
          <div className="flex items-center gap-4 mt-1 px-1">
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{formatTime(comment.created_at)}</span>
            <button onClick={() => likeComment(comment.comment_id)}
              className="flex items-center gap-1 text-[11px] font-semibold transition-colors"
              style={{ color: liked ? '#FF6B6B' : 'var(--text-3)' }}>
              <Heart size={12} weight={liked ? 'fill' : 'regular'} />
              {liked ? (comment.likes?.length || 0) + 1 : (comment.likes?.length || 0) || ''}
            </button>
            {!isReply && (
              <button onClick={() => startReply(comment)}
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: 'var(--text-3)' }}>
                <ArrowBendUpLeft size={12} /> Reply
              </button>
            )}
            {canDelete && (
              <button className="relative" onClick={() => setShowActions(!showActions)}>
                <DotsThree size={16} style={{ color: 'var(--text-3)' }} />
                {showActions && (
                  <div className="absolute bottom-full left-0 mb-1 rounded-xl border shadow-lg z-20 min-w-[120px] overflow-hidden"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-c)' }}>
                    {isPostOwner && !isReply && (
                      <button onClick={() => { pinComment(comment.comment_id); setShowActions(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 hover:bg-blue-50"
                        style={{ color: 'var(--text-1)' }}>
                        <PushPin size={12} /> {isPinned ? 'Unpin' : 'Pin comment'}
                      </button>
                    )}
                    <button onClick={() => { deleteComment(comment.comment_id); setShowActions(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 hover:bg-red-50"
                      style={{ color: '#ef4444' }}>
                      <Trash size={12} /> Delete
                    </button>
                  </div>
                )}
              </button>
            )}
          </div>
          {/* Replies */}
          {comment.replies?.length > 0 && !isReply && (
            <div>
              {!expandedReplies[comment.comment_id] ? (
                <button onClick={() => setExpandedReplies(p => ({ ...p, [comment.comment_id]: true }))}
                  className="text-[11px] font-bold mt-1 ml-1" style={{ color: 'var(--blue)' }}>
                  ↳ {comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'}
                </button>
              ) : (
                <div className="mt-1">
                  {comment.replies.map(reply => (
                    <CommentItem key={reply.comment_id || Math.random()} comment={reply} isReply />
                  ))}
                  <button onClick={() => setExpandedReplies(p => ({ ...p, [comment.comment_id]: false }))}
                    className="text-[11px] font-bold ml-10 mt-1" style={{ color: 'var(--text-3)' }}>
                    Hide replies
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-c)' }}>
      {/* Comments */}
      {sortedComments.length > 0 && (
        <div className="space-y-3 mb-3">
          {sortedComments.map(c => <CommentItem key={c.comment_id || Math.random()} comment={c} />)}
        </div>
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl mb-2 text-xs"
          style={{ background: 'rgba(37,99,235,0.08)', borderLeft: '3px solid var(--blue)' }}>
          <ArrowBendUpLeft size={12} style={{ color: 'var(--blue)' }} />
          <span style={{ color: 'var(--text-2)' }}>Replying to <strong>@{replyingTo.display_name}</strong></span>
          <button onClick={() => setReplyingTo(null)} className="ml-auto text-xs font-bold" style={{ color: 'var(--text-3)' }}>✕</button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-center">
        <Avatar className="w-8 h-8 shrink-0 border" style={{ borderColor: 'var(--border-c)' }}>
          <AvatarImage src={resolveAssetUrl(user?.profile_picture)} />
          <AvatarFallback className="text-[10px] font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>
            {(user?.display_name || 'U')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-1.5">
          <Input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
            placeholder={replyingTo ? `Reply to @${replyingTo.display_name}...` : 'Add a comment...'}
            className="rounded-2xl border text-sm flex-1"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }}
          />
          <Button onClick={submit} disabled={loading || !text.trim()} size="sm"
            className="rounded-2xl px-3 border"
            style={{ background: text.trim() ? 'var(--blue)' : 'var(--bg-surface)', color: text.trim() ? '#fff' : 'var(--text-3)', borderColor: 'transparent' }}>
            <PaperPlaneRight size={14} weight="bold" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CommentSection;
