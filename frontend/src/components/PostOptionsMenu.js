
import React, { useState } from 'react';
import { DotsThree, Flag, Trash, Copy } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import ReportDialog from './ReportDialog';

const PostOptionsMenu = ({ post, canDelete, onDelete }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button onClick={() => setOpen(v => !v)} className="bg-transparent shadow-none border-0 px-2 py-1 text-[#4B4B4B] hover:bg-black/5">
        <DotsThree size={18} weight="bold" />
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-xl border-2 border-[#111111] bg-white p-2 shadow-[4px_4px_0px_0px_rgba(17,17,17,1)]">
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[#f5f5f5]" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); setOpen(false); }}>
            <Copy size={16} weight="bold" /> Copy link
          </button>
          <div className="px-1 py-1"><ReportDialog postId={post.post_id} postSerial={post.serial_number} onReported={() => setOpen(false)} triggerLabel="Report" triggerIcon={<Flag size={16} weight="bold" />} /></div>
          {canDelete && <button className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-[#FF6B6B] hover:bg-[#fff1f1]" onClick={() => { onDelete(); setOpen(false); }}><Trash size={16} weight="bold" /> Delete</button>}
        </div>
      )}
    </div>
  );
};

export default PostOptionsMenu;
