import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  FolderKanban,
  Plus,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Search,
  ChevronRight,
  Layers
} from 'lucide-react';

const ClientProjects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, requestsRes] = await Promise.all([
          axios.get(`${API}/projects/mine`, { withCredentials: true }),
          axios.get(`${API}/requests`, { withCredentials: true })
        ]);
        setProjects(projectsRes.data);
        setRequests(requestsRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStageProgress = (stage) => {
    const stages = ['discovery', 'scope', 'design', 'development', 'qa', 'delivery', 'support'];
    const index = stages.indexOf(stage);
    return Math.round(((index + 1) / stages.length) * 100);
  };

  const filteredProjects = projects
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div className="min-h-screen p-8" data-testid="client-projects">
      {/* Background */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />
      
      {/* Header */}
      <div className="relative flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-white/40 mt-2">Manage and track your active projects</p>
        </div>
        <button
          onClick={() => navigate('/client/request/new')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20"
          data-testid="new-project-btn"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard 
          label="Active" 
          value={projects.filter(p => p.status === 'active').length}
          color="blue"
        />
        <StatCard 
          label="Completed" 
          value={projects.filter(p => p.status === 'completed').length}
          color="emerald"
        />
        <StatCard 
          label="Pending" 
          value={pendingRequests.length}
          color="amber"
        />
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
          />
        </div>
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-lg text-sm capitalize transition-all ${
                filter === f
                  ? 'bg-blue-600 text-white font-medium shadow-lg shadow-blue-600/20'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filteredProjects.length === 0 && pendingRequests.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0F] p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 mx-auto mb-6 flex items-center justify-center">
            <FolderKanban className="w-10 h-10 text-white/20" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
          <p className="text-white/40 mb-8 max-w-md mx-auto">Start by creating your first project request. We'll help you scope and build it.</p>
          <button
            onClick={() => navigate('/client/request/new')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending Requests */}
          {filter === 'all' && pendingRequests.map((request) => (
            <div
              key={request.request_id}
              className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="font-semibold text-lg">{request.title}</h3>
                    <span className="px-3 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20">
                      Processing
                    </span>
                  </div>
                  <p className="text-white/50 text-sm line-clamp-2">{request.business_idea}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-amber-400/70 text-sm">
                <Clock className="w-4 h-4" />
                <span>Our team is reviewing your request</span>
              </div>
            </div>
          ))}

          {/* Projects Grid */}
          <div className="grid gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard 
                key={project.project_id}
                project={project}
                progress={getStageProgress(project.current_stage)}
                onClick={() => navigate(`/client/projects/${project.project_id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Stat Card
const StatCard = ({ label, value, color }) => {
  const colors = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400'
  };
  
  return (
    <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#0A0A0F]">
      <div className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-3xl font-semibold ${colors[color]}`}>{value}</div>
    </div>
  );
};

// Project Card
const ProjectCard = ({ project, progress, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left p-6 rounded-2xl border border-white/[0.06] bg-[#0A0A0F] hover:border-blue-500/30 hover:bg-[#0D0D14] transition-all group"
    data-testid={`project-card-${project.project_id}`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
          <Layers className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold group-hover:text-blue-400 transition-colors">
            {project.name}
          </h3>
          <p className="text-white/40 text-sm capitalize">Stage: {project.current_stage}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1.5 text-xs rounded-lg border ${
          project.status === 'active' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : project.status === 'completed'
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            : 'bg-white/5 text-white/50 border-white/10'
        }`}>
          {project.status}
        </span>
        <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-blue-400 transition-colors" />
      </div>
    </div>
    
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className="text-sm text-white/50 font-medium">{progress}%</span>
    </div>
  </button>
);

export default ClientProjects;
