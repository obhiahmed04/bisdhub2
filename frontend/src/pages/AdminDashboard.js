import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { SignOut, CheckCircle, XCircle, ChatCircle, PaperPlaneRight, PencilSimple, MagnifyingGlass } from '@phosphor-icons/react';
import api from '../utils/api';
import { TicketSystem } from '../components/TicketSystem';

const AdminDashboard = ({ user, onLogout }) => {
  const [pendingRegs, setPendingRegs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedReg, setSelectedReg] = useState(null);
  const [password, setPassword] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [helpChats, setHelpChats] = useState([]);
  const [activeHelpChat, setActiveHelpChat] = useState(null);
  const [helpMessages, setHelpMessages] = useState([]);
  const [newHelpMessage, setNewHelpMessage] = useState('');
  const [actionLogs, setActionLogs] = useState([]);
  const [logSearch, setLogSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const chatEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPendingRegistrations();
    loadAllUsers();
    loadHelpChats();
    loadActionLogs();
  }, []);

  useEffect(() => { if (activeHelpChat) loadHelpMessages(); }, [activeHelpChat]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [helpMessages]);

  const loadPendingRegistrations = async () => {
    try { const r = await api.get('/admin/registrations/pending'); setPendingRegs(r.data); } catch (e) { toast.error('Failed to load pending registrations'); }
  };

  const loadAllUsers = async () => {
    try { const r = await api.get('/admin/users'); setAllUsers(r.data); } catch (e) { toast.error('Failed to load users'); }
  };

  const loadHelpChats = async () => {
    try { const r = await api.get('/admin/help-chats'); setHelpChats(r.data); } catch (e) { console.error('Failed to load help chats'); }
  };

  const loadHelpMessages = async () => {
    try { const r = await api.get(`/help-chat/${activeHelpChat}/messages`); setHelpMessages(r.data); } catch (e) { toast.error('Failed to load messages'); }
  };

  const loadActionLogs = async (search = '') => {
    try {
      const params = { limit: 100 };
      if (search) params.search = search;
      const r = await api.get('/management/action-logs', { params });
      setActionLogs(r.data);
    } catch (e) { console.error('Failed to load logs'); }
  };

  const sendHelpMessage = async () => {
    if (!newHelpMessage.trim()) return;
    try {
      await api.post(`/help-chat/${activeHelpChat}/message`, { sender_id: user.user_id, content: newHelpMessage }, { params: { user_type: 'admin' } });
      setNewHelpMessage('');
      loadHelpMessages();
    } catch (e) { toast.error('Failed to send message'); }
  };

  const approveRegistration = async (regId) => {
    if (!password) { toast.error('Please set a temporary password'); return; }
    try {
      await api.post('/admin/registrations/action', { reg_id: regId, action: 'approve', password });
      toast.success('User approved successfully!');
      setPassword(''); setSelectedReg(null);
      loadPendingRegistrations(); loadAllUsers();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to approve'); }
  };

  const rejectRegistration = async (regId) => {
    if (!rejectionReason) { toast.error('Please provide a rejection reason'); return; }
    try {
      await api.post('/admin/registrations/action', { reg_id: regId, action: 'reject', rejection_reason: rejectionReason });
      toast.success('Registration rejected');
      setRejectionReason(''); setSelectedReg(null);
      loadPendingRegistrations();
    } catch (e) { toast.error('Failed to reject'); }
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setEditForm({
      display_name: u.display_name || '',
      full_name: u.full_name || '',
      email: u.email || '',
      current_class: u.current_class || '',
      section: u.section || '',
      bio: u.bio || ''
    });
  };

  const saveEditUser = async () => {
    try {
      await api.put(`/admin/users/${editingUser.user_id}/edit`, { user_id: editingUser.user_id, ...editForm });
      toast.success('User updated');
      setEditingUser(null);
      loadAllUsers();
      loadActionLogs();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update user'); }
  };

  const handleLogSearch = (val) => {
    setLogSearch(val);
    if (val.trim()) {
      loadActionLogs(val);
    } else {
      loadActionLogs();
    }
  };

  const classes = ['1','2','3','4','5','6','7','8','9','10','11','12'];
  const sections = ['B1','B2','B3','G1','G2','G3'];

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/bisdhub-logo.png" alt="BISD HUB" className="w-28 h-auto object-contain" />
            <div>
              <h1 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="admin-title">Admin Panel</h1>
              <p className="text-sm font-medium text-[#4B4B4B]">Administration</p>
            </div>
          </div>
          <div className="flex gap-2 md:gap-4 mt-4 md:mt-0">
            <Button data-testid="admin-back-to-app" onClick={() => navigate('/')}
              className="bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
              Back to App
            </Button>
            <Button data-testid="admin-logout" onClick={onLogout}
              className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
              <SignOut size={20} weight="bold" /> Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="bg-white border-2 border-[#111111] rounded-xl p-1 mb-6 flex flex-wrap">
            <TabsTrigger value="pending" data-testid="admin-tab-pending">Pending ({pendingRegs.length})</TabsTrigger>
            <TabsTrigger value="users" data-testid="admin-tab-users">Users ({allUsers.length})</TabsTrigger>
            <TabsTrigger value="logs" data-testid="admin-tab-logs">Action Logs</TabsTrigger>
            <TabsTrigger value="help" data-testid="admin-tab-help">Help Chat ({helpChats.length})</TabsTrigger>
            <TabsTrigger value="tickets" data-testid="admin-tab-tickets">🎫 Tickets</TabsTrigger>
          </TabsList>

          {/* Pending Registrations */}
          <TabsContent value="pending">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingRegs.map((reg) => (
                <div key={reg.reg_id} data-testid={`pending-reg-${reg.reg_id}`}
                  className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-6">
                  <h3 className="text-xl font-black mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>{reg.full_name}</h3>
                  <div className="space-y-2 mb-4 text-sm">
                    <p><span className="font-bold">ID:</span> {reg.id_number}</p>
                    <p><span className="font-bold">Email:</span> {reg.email}</p>
                    <p><span className="font-bold">DOB:</span> {reg.date_of_birth}</p>
                    <p><span className="font-bold">Class:</span> {reg.current_class} | <span className="font-bold">Section:</span> {reg.section}</p>
                    <p><span className="font-bold">Type:</span> {reg.is_ex_student ? 'EX Student' : 'Current Student'}</p>
                    {reg.phone_number && <p><span className="font-bold">Phone:</span> {reg.phone_number}</p>}
                  </div>
                  {selectedReg === reg.reg_id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Temporary Password</label>
                        <Input data-testid={`password-input-${reg.reg_id}`} type="password" value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="Set temporary password"
                          className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
                      </div>
                      <div className="flex gap-2">
                        <Button data-testid={`approve-button-${reg.reg_id}`} onClick={() => approveRegistration(reg.reg_id)}
                          className="flex-1 bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 rounded-xl flex items-center justify-center gap-2">
                          <CheckCircle size={20} weight="bold" /> Approve
                        </Button>
                        <Button onClick={() => setSelectedReg(null)}
                          className="flex-1 bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 rounded-xl">
                          Cancel
                        </Button>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Or Reject</label>
                        <Textarea data-testid={`rejection-reason-${reg.reg_id}`} value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)} placeholder="Reason for rejection"
                          className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] mb-2" rows={2} />
                        <Button data-testid={`reject-button-${reg.reg_id}`} onClick={() => rejectRegistration(reg.reg_id)}
                          className="w-full bg-[#FF6B6B] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 rounded-xl flex items-center justify-center gap-2">
                          <XCircle size={20} weight="bold" /> Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button data-testid={`review-button-${reg.reg_id}`} onClick={() => setSelectedReg(reg.reg_id)}
                      className="w-full bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-3 rounded-xl">
                      Review Application
                    </Button>
                  )}
                </div>
              ))}
              {pendingRegs.length === 0 && (
                <div className="col-span-2 text-center py-12">
                  <p className="text-lg font-medium text-[#4B4B4B]">No pending registrations</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Users Tab with Edit */}
          <TabsContent value="users">
            <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-6">
              <div className="mb-4">
                <Input data-testid="admin-user-search" value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by ID, name, email..."
                  className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] max-w-md" />
              </div>
              <ScrollArea className="h-[600px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#111111]">
                      <th className="text-left py-3 px-4 font-bold text-sm">ID</th>
                      <th className="text-left py-3 px-4 font-bold text-sm">Name</th>
                      <th className="text-left py-3 px-4 font-bold text-sm hidden md:table-cell">Email</th>
                      <th className="text-left py-3 px-4 font-bold text-sm">Class</th>
                      <th className="text-left py-3 px-4 font-bold text-sm hidden md:table-cell">Role</th>
                      <th className="text-left py-3 px-4 font-bold text-sm">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.filter(u => {
                      if (!userSearch.trim()) return true;
                      const q = userSearch.toLowerCase();
                      return u.id_number?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q);
                    }).map((u) => (
                      <tr key={u.user_id} className="border-b border-[#D1D1D1] hover:bg-[#A7F3D0]">
                        <td className="py-3 px-4 font-medium text-sm">{u.id_number}</td>
                        <td className="py-3 px-4 text-sm">{u.display_name}</td>
                        <td className="py-3 px-4 text-sm hidden md:table-cell">{u.email}</td>
                        <td className="py-3 px-4 text-sm">{u.current_class}-{u.section}</td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          {u.is_admin && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold border-2 border-[#111111] bg-[#FF6B6B] text-white mr-1">Admin</span>}
                          {u.is_moderator && !u.is_admin && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold border-2 border-[#111111] bg-[#2563EB] text-white">Mod</span>}
                        </td>
                        <td className="py-3 px-4">
                          <Button data-testid={`edit-user-${u.user_id}`} onClick={() => openEditUser(u)}
                            className="bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] font-bold px-2 py-1 rounded-lg">
                            <PencilSimple size={14} weight="bold" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Action Logs Tab */}
          <TabsContent value="logs">
            <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>Action Logs</h3>
                <div className="relative flex-1 max-w-md">
                  <Input data-testid="admin-log-search" value={logSearch}
                    onChange={(e) => handleLogSearch(e.target.value)}
                    placeholder="Search by serial #, admin name, action..."
                    className="border-2 border-[#111111] rounded-xl px-4 py-2 pl-9 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
                  <MagnifyingGlass size={14} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B4B4B]" />
                </div>
              </div>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {actionLogs.map((log) => (
                    <div key={log.log_id} data-testid={`log-${log.log_id}`} className="border-2 border-[#111111] rounded-xl p-4 bg-white">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
                        <div className="flex items-center gap-2 mb-1 md:mb-0">
                          <span className="text-[10px] font-bold text-[#4B4B4B]">#{log.serial_number}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border-2 border-[#111111] ${
                            log.action_type === 'ban' ? 'bg-[#111111] text-white' :
                            log.action_type === 'unban' ? 'bg-[#A7F3D0] text-[#111111]' :
                            log.action_type === 'approve' ? 'bg-[#A7F3D0] text-[#111111]' :
                            log.action_type === 'reject' ? 'bg-[#FF6B6B] text-white' :
                            log.action_type === 'mute' ? 'bg-[#FFF4E5] text-[#111111]' :
                            log.action_type === 'edit_user' ? 'bg-[#2563EB] text-white' :
                            log.action_type === 'delete_post' ? 'bg-[#FF6B6B] text-white' :
                            'bg-gray-200 text-[#111111]'
                          }`}>
                            {log.action_type.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-xs text-[#4B4B4B]">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm"><span className="font-bold">Admin:</span> {log.admin_name}</p>
                      {log.target_user_name && <p className="text-sm"><span className="font-bold">Target:</span> {log.target_user_name}</p>}
                      <p className="text-sm text-[#4B4B4B] mt-1">{log.details}</p>
                    </div>
                  ))}
                  {actionLogs.length === 0 && (
                    <div className="text-center py-12"><p className="text-[#4B4B4B]">No action logs found</p></div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Help Chat */}
          <TabsContent value="help">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <ChatCircle size={24} weight="bold" /> Rejected Users
                </h3>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {helpChats.map((chat) => (
                      <div key={chat.registration.reg_id} onClick={() => setActiveHelpChat(chat.registration.reg_id)}
                        className={`p-3 rounded-xl border-2 border-[#111111] cursor-pointer hover:bg-[#A7F3D0] ${activeHelpChat === chat.registration.reg_id ? 'bg-[#2563EB] text-white' : 'bg-white'}`}>
                        <p className="font-bold text-sm">{chat.registration.full_name}</p>
                        <p className={`text-xs ${activeHelpChat === chat.registration.reg_id ? 'text-white opacity-75' : 'text-[#4B4B4B]'}`}>@{chat.registration.id_number}</p>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold border-2 border-[#111111] bg-[#FF6B6B] text-white mt-1">{chat.message_count} msgs</span>
                      </div>
                    ))}
                    {helpChats.length === 0 && <p className="text-sm text-[#4B4B4B] text-center py-8">No help requests</p>}
                  </div>
                </ScrollArea>
              </div>
              <div className="md:col-span-2">
                {activeHelpChat ? (
                  <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-6 flex flex-col h-[600px]">
                    <h3 className="text-lg font-black mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Help Chat</h3>
                    <ScrollArea className="flex-1 mb-4">
                      <div className="space-y-4">
                        {helpMessages.map((msg) => (
                          <div key={msg.message_id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] ${msg.sender_type === 'admin' ? 'bg-[#E6F4EA] border-2 border-[#111111] rounded-2xl rounded-tr-none px-4 py-3' : 'bg-white border-2 border-[#111111] rounded-2xl rounded-tl-none px-4 py-3'}`}>
                              <p className="text-xs font-bold text-[#4B4B4B] mb-1">{msg.sender_type === 'admin' ? 'You (Admin)' : 'User'}</p>
                              <p className="text-base">{msg.content}</p>
                              <p className="text-xs text-[#4B4B4B] mt-1">{new Date(msg.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    </ScrollArea>
                    <div className="flex gap-2">
                      <Input value={newHelpMessage} onChange={(e) => setNewHelpMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendHelpMessage()} placeholder="Type a message..."
                        className="border-2 border-[#111111] rounded-xl px-4 py-3 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
                      <Button onClick={sendHelpMessage}
                        className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-6 rounded-xl">
                        <PaperPlaneRight size={20} weight="bold" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-12 text-center h-[600px] flex items-center justify-center">
                    <p className="text-lg font-medium text-[#4B4B4B]">Select a user to view help chat</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tickets">
            <AdminTicketPanel api={require('../utils/api').default} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md bg-white border-2 border-[#111111] rounded-xl shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Edit User: {editingUser?.id_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1 block">Display Name</label>
              <Input data-testid="edit-display-name" value={editForm.display_name || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                className="border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1 block">Full Name</label>
              <Input data-testid="edit-full-name" value={editForm.full_name || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                className="border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1 block">Email</label>
              <Input data-testid="edit-email" value={editForm.email || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                className="border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1 block">Class</label>
                <Select value={editForm.current_class} onValueChange={(v) => setEditForm(prev => ({ ...prev, current_class: v }))}>
                  <SelectTrigger className="border-2 border-[#111111] rounded-xl shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1 block">Section</label>
                <Select value={editForm.section} onValueChange={(v) => setEditForm(prev => ({ ...prev, section: v }))}>
                  <SelectTrigger className="border-2 border-[#111111] rounded-xl shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1 block">Bio</label>
              <Textarea data-testid="edit-bio" value={editForm.bio || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                className="border-2 border-[#111111] rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button data-testid="save-edit-user" onClick={saveEditUser}
                className="flex-1 bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 rounded-xl">
                Save Changes
              </Button>
              <Button onClick={() => setEditingUser(null)}
                className="flex-1 bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


// ============= ADMIN TICKET PANEL =============
const AdminTicketPanel = ({ api }) => {
  const [tickets, setTickets] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [replyText, setReplyText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const { toast } = require('sonner');

  React.useEffect(() => { loadTickets(); }, [statusFilter]);

  const loadTickets = async () => {
    try {
      const url = statusFilter ? `/admin/tickets?status=${statusFilter}` : '/admin/tickets';
      const r = await api.get(url);
      setTickets(r.data);
    } catch {}
  };

  const loadTicket = async (id) => {
    try { const r = await api.get(`/tickets/${id}`); setSelected(r.data); } catch {}
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      await api.post(`/tickets/${selected.ticket_id}/reply`, { message: replyText });
      setReplyText('');
      await loadTicket(selected.ticket_id);
      toast.success('Reply sent');
    } catch { toast.error('Failed'); }
  };

  const updateStatus = async (status) => {
    try {
      await api.put(`/tickets/${selected.ticket_id}/status?status=${status}`);
      const updated = { ...selected, status };
      setSelected(updated);
      loadTickets();
      toast.success('Status updated');
    } catch { toast.error('Failed'); }
  };

  const STATUS = {
    open: { color: '#3b82f6', label: 'Open' },
    in_progress: { color: '#f59e0b', label: 'In Progress' },
    resolved: { color: '#22c55e', label: 'Resolved' },
    closed: { color: '#6b7280', label: 'Closed' },
  };

  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  if (selected) return (
    <div style={{ color: 'var(--text-1)' }}>
      <button onClick={() => setSelected(null)} style={{ color: 'var(--blue)' }} className="text-sm font-bold mb-4 flex items-center gap-1">
        ← Back to all tickets
      </button>
      <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)' }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-black text-base">#{selected.serial_number} {selected.subject}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              From: {selected.created_by_name} ({selected.created_by_id_number}) · {selected.category}
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full font-bold"
            style={{ background: `${(STATUS[selected.status] || STATUS.open).color}20`, color: (STATUS[selected.status] || STATUS.open).color }}>
            {(STATUS[selected.status] || STATUS.open).label}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS).map(([s, cfg]) => (
            <button key={s} onClick={() => updateStatus(s)}
              className="text-xs px-3 py-1.5 rounded-lg font-bold border"
              style={{ background: selected.status === s ? cfg.color : 'transparent', color: selected.status === s ? '#fff' : cfg.color, borderColor: cfg.color }}>
              {cfg.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 mb-4 max-h-72 overflow-y-auto p-1">
        {selected.messages?.map(msg => (
          <div key={msg.message_id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%] px-3 py-2 rounded-xl text-sm"
              style={{ background: msg.sender_type === 'admin' ? 'var(--blue)' : 'var(--bg-surface)', color: msg.sender_type === 'admin' ? '#fff' : 'var(--text-1)' }}>
              <p className="text-[10px] font-bold opacity-60 mb-0.5">
                {msg.sender_type === 'admin' ? '👮 Admin' : `👤 ${msg.sender_name}`} · {fmt(msg.created_at)}
              </p>
              <p>{msg.message}</p>
            </div>
          </div>
        ))}
      </div>
      {['open', 'in_progress'].includes(selected.status) && (
        <div className="flex gap-2">
          <input value={replyText} onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendReply()}
            placeholder="Reply to user..."
            className="flex-1 rounded-xl border px-3 py-2 text-sm"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-c)', color: 'var(--text-1)' }} />
          <button onClick={sendReply} className="px-4 rounded-xl font-bold text-sm text-white" style={{ background: 'var(--blue)' }}>
            Send
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ color: 'var(--text-1)' }}>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['', 'All'], ...Object.entries(STATUS).map(([s, c]) => [s, c.label])].map(([s, label]) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="text-xs px-3 py-1.5 rounded-lg font-bold border"
            style={{ background: statusFilter === s ? 'var(--blue)' : 'transparent', color: statusFilter === s ? '#fff' : 'var(--text-2)', borderColor: 'var(--border-c)' }}>
            {label}
          </button>
        ))}
      </div>
      {tickets.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: 'var(--text-3)' }}>No tickets found</p>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const sc = STATUS[t.status] || STATUS.open;
            return (
              <button key={t.ticket_id} onClick={() => loadTicket(t.ticket_id)}
                className="w-full text-left p-3 rounded-xl border transition-colors"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-c)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">#{t.serial_number} {t.subject}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {t.created_by_name} · {t.category} · {fmt(t.updated_at || t.created_at)}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                    style={{ background: sc.color + '20', color: sc.color }}>{sc.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
