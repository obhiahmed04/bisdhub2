import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { Warning, ChatCircle, PaperPlaneRight, SignOut } from '@phosphor-icons/react';
import api from '../utils/api';

const BannedPage = ({ user, onLogout }) => {
  const [helpMessages, setHelpMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (showChat) loadHelpMessages();
  }, [showChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [helpMessages]);

  const loadHelpMessages = async () => {
    try {
      const response = await api.get(`/help-chat/${user.user_id}/messages`);
      setHelpMessages(response.data);
    } catch (error) {
      console.error('Failed to load help messages');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await api.post(`/help-chat/${user.user_id}/message`, {
        sender_id: user.user_id,
        content: newMessage
      });
      setNewMessage('');
      loadHelpMessages();
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] p-6 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FF6B6B] border-4 border-[#111111] rounded-full mb-4">
            <Warning size={40} weight="bold" className="text-white" />
          </div>
          <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Account Banned</h1>
          <p className="text-[#4B4B4B] mb-2">Your account has been suspended from BISD HUB.</p>
          {user.ban_reason && (
            <div className="bg-[#FFF4E5] border-2 border-[#111111] rounded-xl p-3 mb-4 text-left">
              <p className="text-xs font-bold mb-1">Reason:</p>
              <p className="text-sm">{user.ban_reason}</p>
            </div>
          )}
          <p className="text-xs text-[#4B4B4B] mb-4">
            If you believe this is a mistake, please contact an admin using the help chat below.
          </p>

          <div className="flex gap-3 justify-center">
            <Button onClick={() => setShowChat(!showChat)} data-testid="banned-help-chat-button"
              className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <ChatCircle size={16} weight="bold" /> Contact Admin
            </Button>
            <Button onClick={onLogout} data-testid="banned-logout-button"
              className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <SignOut size={16} weight="bold" /> Logout
            </Button>
          </div>
        </div>

        {showChat && (
          <div className="mt-4 bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4">
            <h3 className="font-black text-sm mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Help Chat</h3>
            <ScrollArea className="h-48 mb-3">
              <div className="space-y-2">
                {helpMessages.map((msg) => (
                  <div key={msg.message_id} className={`flex ${msg.sender_type === 'user' || msg.sender_id === user.user_id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.sender_type === 'user' || msg.sender_id === user.user_id
                        ? 'bg-[#2563EB] text-white rounded-br-sm'
                        : 'bg-[#F5F5F5] rounded-bl-sm'
                    }`}>
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
              <Button onClick={sendMessage}
                className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 rounded-xl">
                <PaperPlaneRight size={16} weight="bold" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BannedPage;
