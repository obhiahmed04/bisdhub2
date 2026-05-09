import React, { useState } from 'react';
import { DotsThree, Flag, Trash, Copy, PencilSimple, ClockCountdown } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import ReportDialog from './ReportDialog';
import api from '../utils/api';

const PostOptionsMenu = ({ post, canDelete, onDelete, onEdited }) => {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editHistory, setEditHistory] = useState([]);
  const [saving, setSaving] = useState(false);

  const isOwner = canDelete; // owner can edit too

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      await api.put(`/posts/${post.post_id}`, { content: editContent });
      toast.success('Post updated!');
      setEditOpen(false);
      if (onEdited) onEdited({ ...post, content: editContent, edited: true });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update post');
    } finally { setSaving(false); }
  };

  const loadHistory = async () => {
    try {
      const r = await api.get(`/posts/${post.post_id}/edit-history`);
      setEditHistory(r.data);
      setHistoryOpen(true);
    } catch { toast.error('Could not load edit history'); }
  };

  const formatTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <>
      <div className="relative">
        <Button
          onClick={() => setOpen(v => !v)}
          className="bg-transparent shadow-none border-0 px-2 py-1 hover:bg-black/5"
          style={{ color: 'var(--text-3)' }}
        >
          <DotsThree size={20} weight="bold" />
        </Button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-8 z-20 min-w-[190px] rounded-xl border-2 border-[#111111] p-1.5 shadow-[4px_4px_0px_0px_rgba(17,17,17,1)]"
              style={{ background: 'var(--bg-card)' }}>

              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-black/5"
                style={{ color: 'var(--text-1)' }}
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/post/${post.post_id}`); toast.success('Link copied!'); setOpen(false); }}>
                <Copy size={15} weight="bold" /> Copy link
              </button>

              {post.edited && (
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-black/5"
                  style={{ color: 'var(--text-3)' }}
                  onClick={() => { setOpen(false); loadHistory(); }}>
                  <ClockCountdown size={15} weight="bold" /> Edit history
                </button>
              )}

              {isOwner && (
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-blue-50"
                  style={{ color: '#2563EB' }}
                  onClick={() => { setEditContent(post.content || ''); setEditOpen(true); setOpen(false); }}>
                  <PencilSimple size={15} weight="bold" /> Edit post
                </button>
              )}

              <div className="px-1 py-0.5">
                <ReportDialog
                  postId={post.post_id}
                  postSerial={post.serial_number}
                  onReported={() => setOpen(false)}
                  triggerLabel="Report"
                  triggerIcon={<Flag size={15} weight="bold" />}
                />
              </div>

              {canDelete && (
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-red-50"
                  style={{ color: '#FF6B6B' }}
                  onClick={() => { onDelete(); setOpen(false); }}>
                  <Trash size={15} weight="bold" /> Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg rounded-2xl" style={{ background: 'var(--bg-card)', border: '2px solid #111' }}>
          <DialogHeader>
            <DialogTitle className="font-black text-lg" style={{ color: 'var(--text-1)' }}>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={5}
              className="rounded-xl resize-none text-sm"
              style={{ background: 'var(--bg-input)', border: '2px solid var(--border-c)', color: 'var(--text-1)' }}
              placeholder="What's on your mind?"
            />
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              ⓘ Everyone can see what was edited to what by clicking "Edit history" on your post.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setEditOpen(false)} className="flex-1 rounded-xl border-2 font-bold"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border-c)' }}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={saving || !editContent.trim()} className="flex-1 rounded-xl border-2 font-bold"
                style={{ background: '#2563EB', color: '#fff', borderColor: '#2563EB' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg rounded-2xl" style={{ background: 'var(--bg-card)', border: '2px solid #111' }}>
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <ClockCountdown size={20} /> Edit History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 max-h-80 overflow-y-auto">
            {editHistory.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>No edit history found</p>
            ) : (
              editHistory.map((edit, i) => (
                <div key={i} className="rounded-xl p-3 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-3)' }}>
                    Edited {formatTime(edit.edited_at)}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-0.5">Before:</p>
                      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{edit.old_content}</p>
                    </div>
                    <div className="border-t" style={{ borderColor: 'var(--border-c)' }}></div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-green-500 mb-0.5">After:</p>
                      <p className="text-sm" style={{ color: 'var(--text-1)' }}>{edit.new_content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostOptionsMenu;
