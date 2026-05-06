import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { SignOut, ShieldCheck, Warning, Trash, MagnifyingGlass, ChatCircle } from '@phosphor-icons/react';
import api from '../utils/api';

const ModerationPanel = ({ user, onLogout }) => {
  const [reports, setReports] = useState([]);
  const [chatReports, setChatReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [moderationAction, setModerationAction] = useState('');
  const [reason, setReason] = useState('');
  const [muteDuration, setMuteDuration] = useState(24);
  const [actionLogs, setActionLogs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadReports();
    loadChatReports();
    loadUsers();
    loadActionLogs();
  }, []);

  const loadReports = async () => {
    try { const r = await api.get('/mod/reports', { params: { status: 'pending' } }); setReports(r.data); } catch (e) { toast.error('Failed to load reports'); }
  };

  const loadChatReports = async () => {
    try { const r = await api.get('/mod/chat-reports', { params: { status: 'pending' } }); setChatReports(r.data); } catch (e) { console.error('Failed to load chat reports'); }
  };

  const loadUsers = async () => {
    try { const r = await api.get('/admin/users'); setUsers(r.data); } catch (e) { console.error('Failed to load users'); }
  };

  const loadActionLogs = async (search = '') => {
    try {
      const params = { limit: 50 };
      if (search) params.search = search;
      const r = await api.get('/management/action-logs', { params });
      setActionLogs(r.data);
    } catch (e) { console.error('Failed to load logs'); }
  };

  const handleModeration = async () => {
    if (!selectedUser || !moderationAction) return;
    try {
      await api.post('/mod/users/action', {
        target_user_id: selectedUser.user_id,
        action: moderationAction,
        reason: reason,
        mute_duration_hours: moderationAction === 'mute' ? muteDuration : undefined
      });
      toast.success(`User ${moderationAction}ed successfully`);
      setSelectedUser(null); setModerationAction(''); setReason('');
      loadUsers(); loadActionLogs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Moderation action failed');
    }
  };

  const deletePost = async (postId, reportId) => {
    try {
      await api.delete(`/mod/posts/${postId}`, { data: { reason: 'Violated community guidelines' } });
      await api.put(`/mod/reports/${reportId}/resolve`, null, { params: { status: 'resolved' } });
      toast.success('Post deleted and report resolved');
      loadReports(); loadActionLogs();
    } catch (error) { toast.error('Failed to delete post'); }
  };

  const resolveReport = async (reportId, status) => {
    try {
      await api.put(`/mod/reports/${reportId}/resolve`, null, { params: { status } });
      toast.success('Report resolved'); loadReports();
    } catch (error) { toast.error('Failed to resolve report'); }
  };

  const resolveChatReport = async (reportId, status) => {
    try {
      await api.put(`/mod/chat-reports/${reportId}/resolve`, null, { params: { status } });
      toast.success('Chat report resolved'); loadChatReports();
    } catch (error) { toast.error('Failed to resolve chat report'); }
  };

  const totalReports = reports.length + chatReports.length;

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/bisdhub-logo.png" alt="BISD HUB" className="w-28 h-auto object-contain" />
            <div>
              <h1 className="text-3xl md:text-4xl font-black flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="moderation-title">
                <ShieldCheck size={32} weight="fill" className="text-[#2563EB]" /> Moderation
              </h1>
              <p className="text-sm font-medium text-[#4B4B4B]">Content Moderation & User Management</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button onClick={() => navigate('/')} data-testid="mod-back-to-app"
              className="bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
              Back to App
            </Button>
            <Button onClick={onLogout}
              className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
              <SignOut size={20} weight="bold" /> Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="bg-white border-2 border-[#111111] rounded-xl p-1 mb-6 flex flex-wrap">
            <TabsTrigger value="reports" data-testid="mod-tab-reports">Post Reports ({reports.length})</TabsTrigger>
            <TabsTrigger value="chat-reports" data-testid="mod-tab-chat-reports">Chat Reports ({chatReports.length})</TabsTrigger>
            <TabsTrigger value="actions" data-testid="mod-tab-actions">User Actions</TabsTrigger>
            <TabsTrigger value="logs" data-testid="mod-tab-logs">Action Logs</TabsTrigger>
          </TabsList>

          {/* Post Reports */}
          <TabsContent value="reports">
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.report_id} data-testid={`report-${report.report_id}`}
                  className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 md:p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Warning size={22} weight="fill" className="text-[#FF6B6B] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-base font-black">Post Report</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-[#111111] bg-[#FF6B6B] text-white">#{report.serial_number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#111111] bg-[#FFF4E5]">{report.category?.toUpperCase()}</span>
                      </div>

                      {/* Violator info */}
                      {report.violator && (
                        <div className="bg-[#FFF4E5] border-2 border-[#111111] rounded-lg p-3 mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider mb-1 text-[#4B4B4B]">Violator</p>
                          <p className="text-sm font-bold">{report.violator.display_name} <span className="font-normal text-[#4B4B4B]">(@{report.violator.id_number})</span></p>
                          {report.violator.current_class && <p className="text-xs text-[#4B4B4B]">Class {report.violator.current_class} - {report.violator.section}</p>}
                        </div>
                      )}

                      {/* Reporter */}
                      <p className="text-xs text-[#4B4B4B] mb-2">
                        <span className="font-bold">Reported by:</span> {report.reporter?.display_name} (@{report.reporter?.id_number})
                      </p>

                      {/* Reason */}
                      <p className="text-sm mb-3"><span className="font-bold">Reason:</span> {report.reason}</p>

                      {/* Reported Post Content */}
                      {report.post && (
                        <div className="bg-[#FDFBF7] border-2 border-[#111111] rounded-xl p-3 mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#4B4B4B] mb-1">Reported Post Content</p>
                          <p className="text-sm break-words whitespace-pre-wrap">{report.post.content}</p>
                          {report.post.images?.length > 0 && (
                            <div className="mt-2">
                              {report.post.images.map((img, i) => (
                                <img key={i} src={img} alt="" className="rounded-lg border border-[#111111] max-h-32 object-cover" />
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-[#4B4B4B] mt-2">Posted: {new Date(report.post.created_at).toLocaleString()}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button data-testid={`delete-post-${report.report_id}`} onClick={() => deletePost(report.post_id, report.report_id)}
                          className="bg-[#FF6B6B] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
                          <Trash size={16} weight="bold" /> Delete Post
                        </Button>
                        <Button onClick={() => resolveReport(report.report_id, 'reviewed')}
                          className="bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
                          Dismiss
                        </Button>
                        {report.violator && (
                          <Button onClick={() => { setSelectedUser(report.violator); navigate('#'); }}
                            className="bg-[#111111] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
                            Moderate User
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-12 text-center">
                  <p className="text-lg font-medium text-[#4B4B4B]">No pending post reports</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Chat Reports */}
          <TabsContent value="chat-reports">
            <div className="space-y-4">
              {chatReports.map((report) => (
                <div key={report.report_id} data-testid={`chat-report-${report.report_id}`}
                  className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 md:p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <ChatCircle size={22} weight="fill" className="text-[#FF6B6B] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-base font-black">Chat Message Report</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-[#111111] bg-[#FF6B6B] text-white">#{report.serial_number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#111111] bg-blue-100 text-blue-700">{report.chat_room}</span>
                      </div>

                      {/* Violator */}
                      {report.violator && (
                        <div className="bg-[#FFF4E5] border-2 border-[#111111] rounded-lg p-3 mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider mb-1 text-[#4B4B4B]">Message Author (Violator)</p>
                          <p className="text-sm font-bold">{report.violator.display_name} <span className="font-normal text-[#4B4B4B]">(@{report.violator.id_number})</span></p>
                          {report.violator.current_class && <p className="text-xs text-[#4B4B4B]">Class {report.violator.current_class} - {report.violator.section}</p>}
                        </div>
                      )}

                      {/* Reporter */}
                      <p className="text-xs text-[#4B4B4B] mb-2">
                        <span className="font-bold">Reported by:</span> {report.reporter?.display_name} (@{report.reporter?.id_number})
                      </p>
                      <p className="text-sm mb-3"><span className="font-bold">Reason:</span> {report.reason}</p>

                      {/* Reported Message */}
                      {report.message && (
                        <div className="bg-[#FDFBF7] border-2 border-[#111111] rounded-xl p-3 mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#4B4B4B] mb-1">Reported Message</p>
                          <p className="text-sm break-words">{report.message.content}</p>
                          <p className="text-[10px] text-[#4B4B4B] mt-2">Room: {report.chat_room} | Sent: {new Date(report.message.created_at).toLocaleString()}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => resolveChatReport(report.report_id, 'resolved')}
                          className="bg-[#FF6B6B] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
                          Resolve
                        </Button>
                        <Button onClick={() => resolveChatReport(report.report_id, 'reviewed')}
                          className="bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold px-4 py-2 rounded-xl text-sm">
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {chatReports.length === 0 && (
                <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-12 text-center">
                  <p className="text-lg font-medium text-[#4B4B4B]">No pending chat reports</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* User Actions */}
          <TabsContent value="actions">
            <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 md:p-6 mb-6">
              <h3 className="text-xl font-black mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Moderate User</h3>
              {selectedUser ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium">Selected: <span className="font-bold">{selectedUser.display_name}</span> (@{selectedUser.id_number})</p>
                  {selectedUser.is_banned && (
                    <div className="bg-[#FF6B6B] border-2 border-[#111111] rounded-xl p-3 text-white">
                      <p className="font-bold text-sm">User is currently BANNED</p>
                      <p className="text-xs">Reason: {selectedUser.ban_reason}</p>
                    </div>
                  )}
                  {selectedUser.is_muted && (
                    <div className="bg-[#FFC107] border-2 border-[#111111] rounded-xl p-3">
                      <p className="font-bold text-sm">User is currently MUTED</p>
                      <p className="text-xs">Until: {new Date(selectedUser.mute_until).toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Action</label>
                    <Select value={moderationAction} onValueChange={setModerationAction}>
                      <SelectTrigger className="border-2 border-[#111111] rounded-xl shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ban">Ban User</SelectItem>
                        <SelectItem value="unban">Unban User</SelectItem>
                        <SelectItem value="mute">Mute User</SelectItem>
                        <SelectItem value="unmute">Unmute User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(moderationAction === 'ban' || moderationAction === 'mute') && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Reason</label>
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason"
                        className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" rows={3} />
                    </div>
                  )}
                  {moderationAction === 'mute' && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Mute Duration (hours)</label>
                      <Input type="number" value={muteDuration} onChange={(e) => setMuteDuration(parseInt(e.target.value))}
                        className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button data-testid="execute-moderation" onClick={handleModeration}
                      className="bg-[#FF6B6B] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 px-6 rounded-xl">
                      Execute Action
                    </Button>
                    <Button onClick={() => { setSelectedUser(null); setModerationAction(''); setReason(''); }}
                      className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] font-bold py-2 px-6 rounded-xl">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#4B4B4B]">Select a user from the list below to moderate</p>
              )}
            </div>

            <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 md:p-6">
              <h3 className="text-lg font-black mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>All Users</h3>
              <div className="mb-3">
                <Input data-testid="mod-user-search" value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by ID, name..."
                  className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] max-w-md" />
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {users.filter(u => {
                    if (!userSearch.trim()) return true;
                    const q = userSearch.toLowerCase();
                    return u.id_number?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q);
                  }).map((u) => (
                    <div key={u.user_id} onClick={() => setSelectedUser(u)}
                      className={`p-3 rounded-xl border-2 border-[#111111] cursor-pointer hover:bg-[#A7F3D0] ${
                        selectedUser?.user_id === u.user_id ? 'bg-[#2563EB] text-white' : 'bg-white'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">{u.display_name}</p>
                          <p className={`text-xs ${selectedUser?.user_id === u.user_id ? 'text-white opacity-75' : 'text-[#4B4B4B]'}`}>@{u.id_number}</p>
                        </div>
                        <div className="flex gap-1">
                          {u.is_banned && <span className="text-xs px-2 py-1 bg-[#FF6B6B] text-white rounded border-2 border-[#111111] font-bold">BANNED</span>}
                          {u.is_muted && <span className="text-xs px-2 py-1 bg-[#FFC107] text-[#111111] rounded border-2 border-[#111111] font-bold">MUTED</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Action Logs */}
          <TabsContent value="logs">
            <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>Action Logs</h3>
                <div className="relative flex-1 max-w-md">
                  <Input data-testid="mod-log-search" placeholder="Search by serial #, name, action..."
                    className="border-2 border-[#111111] rounded-xl px-4 py-2 pl-9 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]"
                    onChange={(e) => loadActionLogs(e.target.value)} />
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
                            log.action_type === 'mute' ? 'bg-[#FFF4E5] text-[#111111]' :
                            log.action_type === 'delete_post' ? 'bg-[#FF6B6B] text-white' :
                            log.action_type === 'edit_user' ? 'bg-[#2563EB] text-white' :
                            'bg-gray-200 text-[#111111]'
                          }`}>{log.action_type?.toUpperCase().replace('_', ' ')}</span>
                        </div>
                        <span className="text-xs text-[#4B4B4B]">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm"><span className="font-bold">Staff:</span> {log.admin_name}</p>
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
        </Tabs>
      </div>
    </div>
  );
};

export default ModerationPanel;
