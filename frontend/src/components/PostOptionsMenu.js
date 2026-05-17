import React, { useState } from 'react';
import { DotsThree, Flag, Trash, Copy, Heart } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Flag as FlagIcon, Info } from '@phosphor-icons/react';
import api from '../utils/api';

const PostOptionsMenu = ({ post, canDelete, onDelete, onViewLikers }) => {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultSerial, setResultSerial] = useState(null);

  const handleReport = async () => {
    if (!category || !reason.trim()) { toast.error('Select a category and provide a reason'); return; }
    setLoading(true);
    try {
      const res = await api.post(`/mod/posts/${post.post_id}/report`, { category, reason });
      setResultSerial(res.data.serial_number);
      toast.success(`Report submitted! Ref #${res.data.serial_number}`);
    } catch { toast.error('Failed to submit report'); }
    finally { setLoading(false); }
  };

  const closeReport = () => { setReportOpen(false); setCategory(''); setReason(''); setResultSerial(null); };

  return (
    <>
      <div className="relative">
        <Button onClick={() => setOpen(v => !v)}
          className="bg-transparent shadow-none border-0 px-2 py-1 hover:bg-black/5"
          style={{ color: 'var(--text-3)' }}>
          <DotsThree size={20} weight="bold" />
        </Button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-9 z-20 min-w-[190px] rounded-xl border-2 border-[#111111] p-1.5 shadow-[4px_4px_0px_0px_rgba(17,17,17,1)]"
              style={{ background: 'var(--bg-card)' }}>

              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-black/5 text-left"
                style={{ color: 'var(--text-1)' }}
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/post/${post.post_id}`); toast.success('Link copied!'); setOpen(false); }}>
                <Copy size={15} weight="bold" /> Copy link
              </button>

              {onViewLikers && (
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-left"
                  style={{ color: '#FF6B6B' }}
                  onClick={() => { onViewLikers(); setOpen(false); }}>
                  <Heart size={15} weight="bold" /> See who liked ({post.likes?.length || 0})
                </button>
              )}

              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-left"
                style={{ color: '#FF6B6B' }}
                onClick={() => { setOpen(false); setReportOpen(true); }}>
                <Flag size={15} weight="bold" /> Report
              </button>

              {canDelete && (
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-left"
                  style={{ color: '#ef4444' }}
                  onClick={() => { onDelete(); setOpen(false); }}>
                  <Trash size={15} weight="bold" /> Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Report Dialog — same UI as post report */}
      <Dialog open={reportOpen} onOpenChange={o => !o && closeReport()}>
        <DialogContent className="border-2 border-[#111111] shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] rounded-xl max-w-md"
          style={{ background: 'var(--bg-card)' }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-1)' }}>
              <Flag size={22} weight="fill" className="text-[#FF6B6B]" /> Report Post
            </DialogTitle>
          </DialogHeader>

          {resultSerial ? (
            <div className="py-4 space-y-4">
              <div className="bg-[#A7F3D0] border-2 border-[#111111] rounded-xl p-4 text-center">
                <p className="text-sm font-bold mb-1">Report Submitted!</p>
                <p className="text-3xl font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>#{resultSerial}</p>
                <p className="text-xs text-[#4B4B4B] mt-1">Save this reference number</p>
              </div>
              {post.serial_number && (
                <div className="bg-[#F5F5F5] border-2 border-[#111111] rounded-xl p-3 text-center">
                  <p className="text-xs text-[#4B4B4B]">Post: <span className="font-bold">#{post.serial_number}</span></p>
                </div>
              )}
              <Button onClick={closeReport} className="w-full bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 rounded-xl">
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {post.serial_number && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F5F5F5] border border-[#D1D1D1]">
                    <Info size={14} weight="bold" className="text-[#4B4B4B]" />
                    <p className="text-xs text-[#4B4B4B]">Post ID: <span className="font-bold">#{post.serial_number}</span></p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-2)' }}>Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="border-2 border-[#111111] rounded-xl shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]"
                      style={{ background: 'var(--bg-input)', color: 'var(--text-1)' }}>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spam">Spam</SelectItem>
                      <SelectItem value="harassment">Harassment or Bullying</SelectItem>
                      <SelectItem value="inappropriate">Inappropriate Content</SelectItem>
                      <SelectItem value="misinformation">False Information</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-2)' }}>Reason</label>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Explain why you're reporting this post..."
                    className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] resize-none"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-1)' }} rows={3} />
                </div>
                <div className="bg-[#FFF4E5] border-2 border-[#111111] rounded-xl p-3">
                  <p className="text-xs text-[#4B4B4B]"><span className="font-bold">Note:</span> Reports are reviewed by moderators. False reports may result in account restrictions.</p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={closeReport} className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-6 py-2 rounded-xl">Cancel</Button>
                <Button onClick={handleReport} disabled={loading || !category || !reason.trim()}
                  className="bg-[#FF6B6B] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-6 py-2 rounded-xl">
                  {loading ? 'Reporting...' : 'Submit Report'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostOptionsMenu;
