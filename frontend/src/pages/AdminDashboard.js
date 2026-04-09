import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ClipboardList,
  FileCheck,
  TestTube,
  Package,
  LogOut,
  Bell,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Settings,
  Activity
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('work-board');
  const [data, setData] = useState({
    users: [],
    requests: [],
    projects: [],
    workUnits: [],
    submissions: [],
    supportTickets: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, requestsRes, projectsRes, workUnitsRes, submissionsRes, ticketsRes] = await Promise.all([
          axios.get(`${API}/admin/users`, { withCredentials: true }),
          axios.get(`${API}/admin/requests`, { withCredentials: true }),
          axios.get(`${API}/admin/projects`, { withCredentials: true }),
          axios.get(`${API}/admin/work-units`, { withCredentials: true }),
          axios.get(`${API}/admin/submissions`, { withCredentials: true }),
          axios.get(`${API}/admin/support-tickets`, { withCredentials: true })
        ]);
        setData({
          users: usersRes.data,
          requests: requestsRes.data,
          projects: projectsRes.data,
          workUnits: workUnitsRes.data,
          submissions: submissionsRes.data,
          supportTickets: ticketsRes.data
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { id: 'control-center', label: 'Control Center', icon: Activity, route: '/admin/control-center' },
    { id: 'work-board', label: 'Work Board', icon: LayoutDashboard },
    { id: 'requests', label: 'Requests', icon: ClipboardList },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'review-queue', label: 'Review Queue', icon: FileCheck },
    { id: 'validation', label: 'Validation', icon: TestTube },
    { id: 'users', label: 'Users', icon: Users },
  ];

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
      in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      submitted: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };
    return styles[status] || 'bg-white/5 text-white/50 border-white/10';
  };

  const pendingRequests = data.requests.filter(r => r.status === 'pending');
  const pendingSubmissions = data.submissions.filter(s => s.status === 'pending');
  const activeProjects = data.projects.filter(p => p.status === 'active');

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex" data-testid="admin-dashboard">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white flex items-center justify-center">
              <span className="text-black font-bold text-sm">D</span>
            </div>
            <span className="font-bold tracking-tight">Dev OS Admin</span>
          </div>
        </div>

        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => item.route ? navigate(item.route) : setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all ${
                  activeTab === item.id 
                    ? 'bg-white text-black' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
                {item.label}
                {item.id === 'requests' && pendingRequests.length > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5">
                    {pendingRequests.length}
                  </span>
                )}
                {item.id === 'review-queue' && pendingSubmissions.length > 0 && (
                  <span className="ml-auto bg-amber-500 text-black text-xs px-1.5 py-0.5">
                    {pendingSubmissions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-sm">
              {user?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-white/40">Admin</div>
            </div>
            <button onClick={handleLogout} className="text-white/40 hover:text-white" data-testid="logout-btn">
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="border-b border-white/10 px-6 py-4 sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-sm z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">
              {navItems.find(n => n.id === activeTab)?.label}
            </h1>
            <button className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white">
              <Bell className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Work Board */}
              {activeTab === 'work-board' && (
                <div className="space-y-6">
                  {/* Overview Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="border border-white/10 rounded-2xl p-4">
                      <div className="text-white/50 text-sm mb-1">Pending Requests</div>
                      <div className="text-2xl font-bold">{pendingRequests.length}</div>
                    </div>
                    <div className="border border-white/10 rounded-2xl p-4">
                      <div className="text-white/50 text-sm mb-1">Active Projects</div>
                      <div className="text-2xl font-bold">{activeProjects.length}</div>
                    </div>
                    <div className="border border-white/10 rounded-2xl p-4">
                      <div className="text-white/50 text-sm mb-1">Work Units</div>
                      <div className="text-2xl font-bold">{data.workUnits.length}</div>
                    </div>
                    <div className="border border-white/10 rounded-2xl p-4">
                      <div className="text-white/50 text-sm mb-1">Pending Reviews</div>
                      <div className="text-2xl font-bold">{pendingSubmissions.length}</div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-3 gap-4">
                    {pendingRequests.length > 0 && (
                      <div className="border border-amber-500/30 bg-amber-500/5 p-4">
                        <div className="flex items-center gap-2 text-amber-400 mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">Action Required</span>
                        </div>
                        <p className="text-sm text-white/60">{pendingRequests.length} requests need processing</p>
                        <button 
                          onClick={() => setActiveTab('requests')}
                          className="mt-3 text-sm text-amber-400 flex items-center gap-1"
                        >
                          View Requests <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {pendingSubmissions.length > 0 && (
                      <div className="border border-purple-500/30 bg-purple-500/5 p-4">
                        <div className="flex items-center gap-2 text-purple-400 mb-2">
                          <FileCheck className="w-4 h-4" />
                          <span className="text-sm font-medium">Reviews Pending</span>
                        </div>
                        <p className="text-sm text-white/60">{pendingSubmissions.length} submissions to review</p>
                        <button 
                          onClick={() => setActiveTab('review-queue')}
                          className="mt-3 text-sm text-purple-400 flex items-center gap-1"
                        >
                          View Queue <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <h2 className="text-lg font-semibold mb-4">Active Projects</h2>
                    {activeProjects.length === 0 ? (
                      <div className="border border-white/10 rounded-2xl p-8 text-center text-white/40">
                        No active projects
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeProjects.slice(0, 5).map((project) => (
                          <div key={project.project_id} className="border border-white/10 rounded-xl p-4 flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{project.name}</h3>
                              <span className="text-white/40 text-sm capitalize">{project.current_stage}</span>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded-lg border ${getStatusBadge(project.status)}`}>
                              {project.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Requests */}
              {activeTab === 'requests' && (
                <div className="space-y-4">
                  {data.requests.length === 0 ? (
                    <div className="border border-white/10 rounded-2xl p-12 text-center text-white/40">
                      No requests yet
                    </div>
                  ) : (
                    data.requests.map((request) => (
                      <div key={request.request_id} className="border border-white/10 rounded-2xl p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-medium">{request.title}</h3>
                            <p className="text-white/40 text-sm mt-1">{request.business_idea}</p>
                          </div>
                          <span className={`px-2 py-0.5 text-xs rounded-lg border ${getStatusBadge(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        {request.status === 'pending' && (
                          <div className="flex items-center gap-2 mt-4">
                            <button 
                              onClick={() => navigate(`/admin/scope-builder/${request.request_id}`)}
                              className="px-4 py-2 bg-white text-black text-sm font-medium rounded-xl"
                            >
                              Open Scope Builder
                            </button>
                            <button className="px-4 py-2 border border-white/20 rounded-xl text-sm">
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Projects */}
              {activeTab === 'projects' && (
                <div className="space-y-4">
                  {data.projects.length === 0 ? (
                    <div className="border border-white/10 rounded-2xl p-12 text-center text-white/40">
                      No projects yet
                    </div>
                  ) : (
                    data.projects.map((project) => (
                      <div key={project.project_id} className="border border-white/10 rounded-2xl p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{project.name}</h3>
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`px-2 py-0.5 text-xs rounded-lg border ${getStatusBadge(project.status)}`}>
                                {project.status}
                              </span>
                              <span className="text-white/40 text-sm capitalize">{project.current_stage}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => navigate(`/admin/deliverable-builder/${project.project_id}`)}
                              className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl"
                            >
                              Create Deliverable
                            </button>
                            <button className="px-4 py-2 border border-white/20 rounded-xl text-sm">
                              Manage
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Review Queue */}
              {activeTab === 'review-queue' && (
                <div className="space-y-4">
                  {pendingSubmissions.length === 0 ? (
                    <div className="border border-white/10 rounded-2xl p-12 text-center text-white/40">
                      No pending submissions
                    </div>
                  ) : (
                    pendingSubmissions.map((submission) => (
                      <div key={submission.submission_id} className="border border-white/10 rounded-2xl p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-medium">Submission #{submission.submission_id.slice(-6)}</h3>
                            <p className="text-white/40 text-sm mt-1">{submission.summary}</p>
                          </div>
                          <span className={`px-2 py-0.5 text-xs rounded-lg border ${getStatusBadge(submission.status)}`}>
                            {submission.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <button className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl">
                            Approve
                          </button>
                          <button className="px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded-xl">
                            Request Revision
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Validation */}
              {activeTab === 'validation' && (
                <div className="border border-white/10 rounded-2xl p-12 text-center text-white/40">
                  <TestTube className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>No validation tasks pending</p>
                </div>
              )}

              {/* Users */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="border border-white/10 rounded-2xl p-4">
                      <div className="text-white/50 text-sm mb-1">Total Users</div>
                      <div className="text-2xl font-bold">{data.users.length}</div>
                    </div>
                    <div className="border border-white/10 rounded-2xl p-4">
                      <div className="text-white/50 text-sm mb-1">Clients</div>
                      <div className="text-2xl font-bold">{data.users.filter(u => u.role === 'client').length}</div>
                    </div>
                    <div className="border border-white/10 rounded-2xl p-4">
                      <div className="text-white/50 text-sm mb-1">Developers</div>
                      <div className="text-2xl font-bold">{data.users.filter(u => u.role === 'developer').length}</div>
                    </div>
                    <div className="border border-white/10 rounded-2xl p-4">
                      <div className="text-white/50 text-sm mb-1">Testers</div>
                      <div className="text-2xl font-bold">{data.users.filter(u => u.role === 'tester').length}</div>
                    </div>
                  </div>

                  {data.users.map((u) => (
                    <div key={u.user_id} className="border border-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                          {u.name?.[0] || u.email?.[0]}
                        </div>
                        <div>
                          <div className="font-medium">{u.name || u.email}</div>
                          <div className="text-white/40 text-sm">{u.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs rounded-lg border capitalize ${
                          u.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          u.role === 'developer' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          u.role === 'tester' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          'bg-white/5 text-white/50 border-white/10'
                        }`}>
                          {u.role}
                        </span>
                        <button className="text-white/40 hover:text-white">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
