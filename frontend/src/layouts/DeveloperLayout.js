import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { Home, Kanban, List, BarChart3, LogOut } from 'lucide-react';

const DeveloperLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white flex" data-testid="developer-layout">
      {/* Sidebar */}
      <aside className="w-[240px] border-r border-white/10 flex flex-col sticky top-0 h-screen bg-[#0f1318]">
        {/* Logo */}
        <div className="h-16 border-b border-white/10 px-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-lg shadow-lg shadow-emerald-500/20">
            D
          </div>
          <div>
            <h1 className="font-semibold text-sm">Dev OS</h1>
            <p className="text-[11px] text-white/40">Builder Portal</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <NavItem to="/developer/dashboard" icon={<Home className="w-[18px] h-[18px]" />} label="Home" />
          <NavItem to="/developer/board" icon={<Kanban className="w-[18px] h-[18px]" />} label="Work Board" />
          <NavItem to="/developer/assignments" icon={<List className="w-[18px] h-[18px]" />} label="Assignments" />
          <NavItem to="/developer/performance" icon={<BarChart3 className="w-[18px] h-[18px]" />} label="Performance" />
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center font-semibold text-sm border border-white/10">
              {user?.name?.[0]?.toUpperCase() || 'D'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Developer'}</p>
              <p className="text-[11px] text-white/40 capitalize">{user?.level || 'Developer'}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto bg-[#0B0F14]">
        <Outlet />
      </main>
    </div>
  );
};

const NavItem = ({ to, icon, label, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        isActive 
          ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-white border border-emerald-500/20' 
          : 'text-white/50 hover:text-white hover:bg-white/5'
      }`
    }
  >
    {icon}
    <span className="flex-1">{label}</span>
    {badge && (
      <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">{badge}</span>
    )}
  </NavLink>
);

export default DeveloperLayout;
