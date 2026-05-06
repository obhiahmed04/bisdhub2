import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { SignOut, Crown } from '@phosphor-icons/react';
import api from '../utils/api';

const roles = [
  'Project Owner',
  'Management',
  'Community Manager',
  'Chief of Staff',
  'Chief Administrator',
  'Head Administrator',
  'Administrator',
  'Chief Moderator',
  'Head Moderator',
  'Moderator',
  'user'
];

const ManagementPanel = ({ user, onLogout }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [actionLogs, setActionLogs] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [newBadges, setNewBadges] = useState('');
  const [searchLogs, setSearchLogs] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadAllUsers();
    loadActionLogs();
  }, []);

  const loadAllUsers = async () => {
    try {
      const response = await api.get('/management/all-users-with-passwords');
      setAllUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  const loadActionLogs = async () => {
    try {
      const response = await api.get('/management/action-logs', {
        params: { search: searchLogs || undefined }
      });
      setActionLogs(response.data);
    } catch (error) {
      toast.error('Failed to load action logs');
    }
  };

  const assignRole = async () => {
    if (!selectedUser || !newRole) return;

    try {
      await api.post('/management/assign-role', {
        user_id: selectedUser.user_id,
        role: newRole,
        badges: newBadges.split(',').map(b => b.trim()).filter(Boolean)
      });
      toast.success('Role assigned successfully');
      setSelectedUser(null);
      setNewRole('');
      setNewBadges('');
      loadAllUsers();
      loadActionLogs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign role');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="management-title">
              <Crown size={32} weight="fill" className="text-[#FF6B6B]" />
              Management Panel
            </h1>
            <p className="text-base font-medium text-[#4B4B4B]">Superior Access - Full System Control</p>
          </div>
          <div className="flex gap-2 md:gap-4 mt-4 md:mt-0">
            <Button
              onClick={() => navigate('/')}
              className="bg-[#A7F3D0] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] font-bold px-4 md:px-6 py-2 md:py-3 rounded-xl text-sm md:text-base"
            >
              Back to App
            </Button>
            <Button
              onClick={onLogout}
              className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] font-bold px-4 md:px-6 py-2 md:py-3 rounded-xl flex items-center gap-2 text-sm md:text-base"
            >
              <SignOut size={20} weight="bold" />
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="bg-white border-2 border-[#111111] rounded-xl p-1 mb-6">
            <TabsTrigger value="users">All Users ({allUsers.length})</TabsTrigger>
            <TabsTrigger value="logs">Action Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 md:p-6 mb-6">
              <h3 className="text-xl font-black mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Assign Role</h3>
              
              {selectedUser && (
                <div className="space-y-4">
                  <p className="text-sm font-medium">Selected: <span className="font-bold">{selectedUser.display_name}</span> (@{selectedUser.id_number})</p>
                  
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Role</label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger className="border-2 border-[#111111] rounded-xl shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider mb-2 block">Badges (comma separated)</label>
                    <Input
                      value={newBadges}
                      onChange={(e) => setNewBadges(e.target.value)}
                      placeholder="e.g., Administrator, Early Supporter"
                      className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={assignRole}
                      className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] font-bold py-2 px-6 rounded-xl"
                    >
                      Assign Role
                    </Button>
                    <Button
                      onClick={() => setSelectedUser(null)}
                      className="bg-white text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] font-bold py-2 px-6 rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 md:p-6">
              <div className="mb-4">
                <Input data-testid="management-user-search" value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by ID, name..."
                  className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] max-w-md" />
              </div>
              <ScrollArea className="h-[500px] md:h-[600px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm md:text-base">
                    <thead>
                      <tr className="border-b-2 border-[#111111]">
                        <th className="text-left py-3 px-2 md:px-4 font-bold">ID</th>
                        <th className="text-left py-3 px-2 md:px-4 font-bold">Name</th>
                        <th className="text-left py-3 px-2 md:px-4 font-bold">Email</th>
                        <th className="text-left py-3 px-2 md:px-4 font-bold">Password Hash</th>
                        <th className="text-left py-3 px-2 md:px-4 font-bold">Role</th>
                        <th className="text-left py-3 px-2 md:px-4 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.filter(u => {
                        if (!userSearch.trim()) return true;
                        const q = userSearch.toLowerCase();
                        return u.id_number?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                      }).map((u) => (
                        <tr key={u.user_id} className="border-b border-[#D1D1D1] hover:bg-[#A7F3D0]">
                          <td className="py-3 px-2 md:px-4 font-medium">{u.id_number}</td>
                          <td className="py-3 px-2 md:px-4">{u.display_name}</td>
                          <td className="py-3 px-2 md:px-4">{u.email}</td>
                          <td className="py-3 px-2 md:px-4 font-mono text-xs truncate max-w-[100px] md:max-w-[150px]">{u.password_hash}</td>
                          <td className="py-3 px-2 md:px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border-2 border-[#111111] bg-[#E8E6F4]">
                              {u.role || 'user'}
                            </span>
                          </td>
                          <td className="py-3 px-2 md:px-4">
                            <Button
                              onClick={() => setSelectedUser(u)}
                              className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[1px] hover:translate-x-[1px] font-bold px-3 py-1 rounded-lg text-xs"
                            >
                              Assign Role
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <div className="bg-white border-2 border-[#111111] rounded-xl shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] p-4 md:p-6">
              <div className="mb-4">
                <div className="flex gap-2">
                  <Input
                    value={searchLogs}
                    onChange={(e) => setSearchLogs(e.target.value)}
                    placeholder="Search logs by admin, user, action, or details..."
                    className="border-2 border-[#111111] rounded-xl px-4 py-2 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]"
                  />
                  <Button
                    onClick={loadActionLogs}
                    className="bg-[#2563EB] text-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] font-bold px-6 rounded-xl"
                  >
                    Search
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[500px] md:h-[600px]">
                <div className="space-y-4">
                  {actionLogs.map((log, index) => (
                    <div key={log.log_id} className="border-2 border-[#111111] rounded-xl p-4 bg-white">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
                        <div className="flex items-center gap-2 mb-2 md:mb-0">
                          <span className="text-[10px] font-bold text-[#4B4B4B]">#{log.serial_number || (actionLogs.length - index)}</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border-2 border-[#111111] ${
                            log.action_type === 'approve' ? 'bg-[#A7F3D0] text-[#111111]' :
                            log.action_type === 'reject' ? 'bg-[#FF6B6B] text-white' :
                            log.action_type === 'assign_role' ? 'bg-[#2563EB] text-white' :
                            log.action_type === 'ban' ? 'bg-[#111111] text-white' :
                            log.action_type === 'mute' ? 'bg-[#FFF4E5] text-[#111111]' :
                            'bg-[#FF6B6B] text-white'
                          }`}>
                            {log.action_type}
                          </span>
                        </div>
                        <span className="text-xs text-[#4B4B4B]">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm mb-1"><span className="font-bold">Admin:</span> {log.admin_name}</p>
                      {log.target_user_name && <p className="text-sm mb-1"><span className="font-bold">Target:</span> {log.target_user_name}</p>}
                      <p className="text-sm text-[#4B4B4B]">{log.details}</p>
                    </div>
                  ))}

                  {actionLogs.length === 0 && (
                    <p className="text-center text-[#4B4B4B] py-12">No action logs found</p>
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

export default ManagementPanel;