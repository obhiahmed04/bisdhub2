import React, { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import { Flag, Info } from '@phosphor-icons/react';
import api from '../utils/api';

const ReportDialog = ({ postId, postSerial, onReported }) => {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultSerial, setResultSerial] = useState(null);

  const handleSubmit = async () => {
    if (!category || !reason.trim()) {
      toast.error('Please select a category and provide a reason');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post(`/mod/posts/${postId}/report`, { category, reason });
      setResultSerial(response.data.serial_number);
      toast.success(`Report submitted! Reference #${response.data.serial_number}`);
      if (onReported) onReported();
    } catch (error) {
      toast.error('Failed to report post');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCategory('');
    setReason('');
    setResultSerial(null);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} data-testid={`report-post-${postId}`}
        className="flex items-center gap-1.5 text-[#4B4B4B] hover:text-[#FF6B6B] font-medium text-sm transition-colors">
        <Flag size={18} weight="bold" />
        <span className="hidden md:inline">Report</span>
      </button>

      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="bg-white border-2 border-[#111111] shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Flag size={22} weight="fill" className="text-[#FF6B6B]" />
              Report Post
            </DialogTitle>
          </DialogHeader>

          {resultSerial ? (
            <div className="py-4 space-y-4">
              <div className="bg-[#A7F3D0] border-2 border-[#111111] rounded-xl p-4 text-center">
                <p className="text-sm font-bold mb-1">Report Submitted Successfully</p>
                <p className="text-3xl font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>#{resultSerial}</p>
                <p className="text-xs text-[#4B4B4B] mt-1">Save this number to reference with moderators</p>
              </div>
              {postSerial && (
                <div className="bg-[#F5F5F5] border-2 border-[#111111] rounded-xl p-3 text-center">
                  <p className="text-xs text-[#4B4B4B]">Post Reference: <span className="font-bold">#{postSerial}</span></p>
                </div>
              )}
              <Button onClick={handleClose}
                className="w-full bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 rounded-xl">
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {postSerial && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F5F5F5] border border-[#D1D1D1]">
                    <Info size={14} weight="bold" className="text-[#4B4B4B]" />
                    <p className="text-xs text-[#4B4B4B]">Post ID: <span className="font-bold">#{postSerial}</span></p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Report Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="border-2 border-[#111111] rounded-xl shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
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
                  <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Reason</label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Please explain why you're reporting this post..."
                    className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] resize-none" rows={3} />
                </div>
                <div className="bg-[#FFF4E5] border-2 border-[#111111] rounded-xl p-3">
                  <p className="text-xs text-[#4B4B4B]">
                    <span className="font-bold">Note:</span> Your report will be reviewed by moderators. False reports may result in account restrictions.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleClose}
                  className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-6 py-2 rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={loading || !category || !reason.trim()}
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

export default ReportDialog;
