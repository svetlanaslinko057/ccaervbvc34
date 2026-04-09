import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  ArrowLeft,
  Play,
  Clock,
  AlertCircle,
  CheckCircle2,
  Send,
  Plus,
  Link as LinkIcon,
  Loader2,
  FileText,
  Folder
} from 'lucide-react';

const DeveloperWorkPage = () => {
  const { unitId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workUnit, setWorkUnit] = useState(null);
  const [workLogs, setWorkLogs] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [logHours, setLogHours] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [submitSummary, setSubmitSummary] = useState('');
  const [submitLinks, setSubmitLinks] = useState(['']);

  useEffect(() => {
    fetchData();
  }, [unitId]);

  const fetchData = async () => {
    try {
      const [unitsRes, logsRes, subsRes] = await Promise.all([
        axios.get(`${API}/developer/work-units`, { withCredentials: true }),
        axios.get(`${API}/work-units/${unitId}/logs`, { withCredentials: true }),
        axios.get(`${API}/work-units/${unitId}/submissions`, { withCredentials: true })
      ]);
      
      const unit = unitsRes.data.find(u => u.unit_id === unitId);
      setWorkUnit(unit);
      setWorkLogs(logsRes.data);
      setSubmissions(subsRes.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/developer/work-units/${unitId}/start`, {}, { withCredentials: true });
      await fetchData();
    } catch (error) {
      alert('Failed to start work');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogWork = async (e) => {
    e.preventDefault();
    if (!logHours || !logDescription.trim()) return;
    
    setActionLoading(true);
    try {
      await axios.post(`${API}/work-units/${unitId}/log`, {
        hours: parseFloat(logHours),
        description: logDescription
      }, { withCredentials: true });
      
      setLogHours('');
      setLogDescription('');
      await fetchData();
    } catch (error) {
      alert('Failed to log work');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submitSummary.trim()) return;
    
    // Check if has logged hours
    if (workLogs.length === 0) {
      alert('You must log at least some work before submitting');
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.post(`${API}/work-units/${unitId}/submit`, {
        summary: submitSummary,
        links: submitLinks.filter(l => l.trim())
      }, { withCredentials: true });
      
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to submit work');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!workUnit) {
    return (
      <div className="p-6">
        <p className="text-zinc-500">Work unit not found</p>
      </div>
    );
  }

  const status = workUnit.status;
  const canStart = status === 'assigned';
  const canLog = ['in_progress', 'revision'].includes(status);
  const canSubmit = ['in_progress', 'revision'].includes(status);
  const isSubmitted = ['submitted', 'validation'].includes(status);
  const isRevision = status === 'revision';
  const isCompleted = status === 'completed';

  const totalHours = workLogs.reduce((sum, log) => sum + log.hours, 0);
  const latestSubmission = submissions[submissions.length - 1];

  return (
    <div className="p-6" data-testid="developer-work-page">
      {/* Back Button */}
      <button
        onClick={() => navigate('/developer/assignments')}
        className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Assignments
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* LEFT COLUMN - Main Work */}
        <div className="col-span-2 space-y-4">
          {/* Header */}
          <div>
            <h1 className="text-xl font-semibold">{workUnit.title}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
              <span className="capitalize">{workUnit.unit_type || 'Task'}</span>
              <span>·</span>
              <span>{workUnit.estimated_hours}h estimated</span>
            </div>
          </div>

          {/* Revision Alert */}
          {isRevision && latestSubmission && (
            <Card title="Revision Required" variant="error">
              <p className="text-zinc-400 text-sm mb-2">Fix the following issues:</p>
              <div className="text-red-400 text-sm">
                {latestSubmission.feedback || 'Review feedback and make necessary changes'}
              </div>
            </Card>
          )}

          {/* Start Work Button */}
          {canStart && (
            <button
              onClick={handleStartWork}
              disabled={actionLoading}
              className="w-full bg-white text-black rounded-xl p-4 font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 transition-all"
              data-testid="start-work-btn"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play className="w-5 h-5" /> Start Work</>}
            </button>
          )}

          {/* Task Description */}
          <Card title="Task">
            <p className="text-zinc-300">{workUnit.description || 'No description provided'}</p>
          </Card>

          {/* Requirements */}
          {workUnit.requirements && (
            <Card title="Requirements">
              <p className="text-zinc-300 whitespace-pre-wrap">{workUnit.requirements}</p>
            </Card>
          )}

          {/* Log Work */}
          {canLog && (
            <Card title="Log Work">
              <form onSubmit={handleLogWork} className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={logHours}
                      onChange={(e) => setLogHours(e.target.value)}
                      placeholder="Hours"
                      className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-zinc-600 outline-none"
                      data-testid="log-hours-input"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={logDescription}
                      onChange={(e) => setLogDescription(e.target.value)}
                      placeholder="What did you do?"
                      className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-zinc-600 outline-none"
                      data-testid="log-description-input"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={actionLoading || !logHours || !logDescription.trim()}
                  className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-all flex items-center gap-2"
                  data-testid="log-work-btn"
                >
                  <Plus className="w-4 h-4" />
                  Log
                </button>
              </form>
            </Card>
          )}

          {/* Work Logs */}
          {workLogs.length > 0 && (
            <Card title={`Work Log (${totalHours}h total)`}>
              <div className="space-y-2">
                {workLogs.map((log, i) => (
                  <div key={log.log_id || i} className="flex items-start gap-3 text-sm">
                    <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-xs font-bold">
                      {log.hours}h
                    </div>
                    <div className="flex-1">
                      <p className="text-zinc-300">{log.description}</p>
                      <p className="text-zinc-600 text-xs mt-0.5">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Submit Work */}
          {canSubmit && (
            <Card title="Submit Work" variant="submit">
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={submitSummary}
                  onChange={(e) => setSubmitSummary(e.target.value)}
                  placeholder="Summary of completed work..."
                  className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm h-24 resize-none focus:border-zinc-600 outline-none"
                  data-testid="submit-summary-input"
                />
                
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Links (optional)</label>
                  {submitLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <LinkIcon className="w-4 h-4 text-zinc-600" />
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...submitLinks];
                          newLinks[i] = e.target.value;
                          setSubmitLinks(newLinks);
                        }}
                        placeholder="https://..."
                        className="flex-1 bg-black border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-zinc-600 outline-none"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSubmitLinks([...submitLinks, ''])}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    + Add link
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading || !submitSummary.trim()}
                  className="w-full bg-white text-black rounded-lg p-3 font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 transition-all"
                  data-testid="submit-work-btn"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Submit Work</>}
                </button>
              </form>
            </Card>
          )}

          {/* Submitted State */}
          {isSubmitted && (
            <Card title="Status" variant="info">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-400" />
                <div>
                  <div className="font-medium">Waiting for review</div>
                  <p className="text-zinc-500 text-sm">Your work has been submitted and is being reviewed</p>
                </div>
              </div>
            </Card>
          )}

          {/* Completed State */}
          {isCompleted && (
            <Card title="Status" variant="success">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-medium text-emerald-400">Completed</div>
                  <p className="text-zinc-500 text-sm">This task has been completed and validated</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN - Status Panel */}
        <div className="space-y-4">
          <Card title="Status">
            <StatusBadge status={status} />
          </Card>

          <Card title="Time">
            <div className="text-2xl font-bold">{totalHours}h</div>
            <div className="text-xs text-zinc-500">of {workUnit.estimated_hours}h estimated</div>
          </Card>

          <Card title="Project">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-zinc-500" />
              <span>{workUnit.project_name || 'Project'}</span>
            </div>
          </Card>

          {workUnit.scope_item_name && (
            <Card title="Feature">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-500" />
                <span>{workUnit.scope_item_name}</span>
              </div>
            </Card>
          )}

          {/* Submissions History */}
          {submissions.length > 0 && (
            <Card title="Submissions">
              <div className="space-y-2">
                {submissions.map((sub, i) => (
                  <div key={sub.submission_id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        sub.status === 'approved' ? 'bg-emerald-400' :
                        sub.status === 'revision_needed' ? 'bg-red-400' :
                        'bg-yellow-400'
                      }`} />
                      <span className="text-zinc-400">#{i + 1} - {sub.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, children, variant }) => {
  const borderClass = {
    error: 'border-red-500/30',
    success: 'border-emerald-500/30',
    submit: 'border-blue-500/30',
    info: 'border-yellow-500/30',
  }[variant] || 'border-zinc-800';

  const bgClass = {
    error: 'bg-red-500/5',
    success: 'bg-emerald-500/5',
    submit: 'bg-blue-500/5',
    info: 'bg-yellow-500/5',
  }[variant] || 'bg-[#111]';

  return (
    <div className={`border rounded-xl p-4 ${borderClass} ${bgClass}`}>
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">{title}</div>
      {children}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const config = {
    assigned: { label: 'New', bg: 'bg-zinc-700', text: 'text-white' },
    in_progress: { label: 'In Progress', bg: 'bg-blue-500', text: 'text-white' },
    submitted: { label: 'Submitted', bg: 'bg-yellow-500', text: 'text-black' },
    validation: { label: 'Validating', bg: 'bg-purple-500', text: 'text-white' },
    revision: { label: 'Fix Required', bg: 'bg-red-500', text: 'text-white' },
    completed: { label: 'Completed', bg: 'bg-emerald-500', text: 'text-white' },
  }[status] || { label: status, bg: 'bg-zinc-700', text: 'text-white' };

  return (
    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

export default DeveloperWorkPage;
