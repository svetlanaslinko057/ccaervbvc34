import { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, API } from '@/App';
import { ClientRealtimeBridge } from '@/components/RealtimeBridge';
import axios from 'axios';
import {
  LayoutDashboard,
  FolderKanban,
  Package,
  LifeBuoy,
  LogOut,
  Plus,
  User,
  ChevronRight
} from 'lucide-react';

const ClientLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [projectIds, setProjectIds] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${API}/projects/mine`, { withCredentials: true });
        setProjectIds(res.data.map(p => p.project_id));
      } catch (e) {}
    };
    fetchProjects();
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/client/dashboard' },
    { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/client/projects' },
    { id: 'deliverables', label: 'Deliverables', icon: Package, path: '/client/deliverables' },
    { id: 'support', label: 'Support', icon: LifeBuoy, path: '/client/support' },
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-[#05050A] text-white flex" data-testid="client-layout">
      {/* Realtime Bridge */}
      {user?.user_id && (
        <ClientRealtimeBridge 
          userId={user.user_id} 
          projectIds={projectIds}
          onRefresh={handleRefresh} 
        />
      )}
      
      {/* Sidebar */}
      <aside className="w-[260px] border-r border-white/[0.06] flex flex-col sticky top-0 h-screen bg-[#08080D]">
        {/* Logo */}
        <div className="h-16 border-b border-white/[0.06] px-5 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <div>
            <span className="font-semibold text-white tracking-tight">Dev OS</span>
            <span className="text-white/30 text-xs block">Client Portal</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.path) 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                <span>{item.label}</span>
                {isActive(item.path) && (
                  <ChevronRight className="w-4 h-4 ml-auto text-blue-400/50" />
                )}
              </button>
            ))}
          </div>

          {/* New Request Button */}
          <div className="mt-6">
            <button
              onClick={() => navigate('/client/request/new')}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
              data-testid="new-request-btn"
            >
              <Plus className="w-4 h-4" />
              New Request
            </button>
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center border border-blue-500/20">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{user?.name || 'Client'}</p>
              <p className="text-xs text-white/30 truncate">{user?.user_id?.slice(0, 12)}...</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto bg-[#05050A]">
        <Outlet />
      </main>
    </div>
  );
};

export default ClientLayout;
