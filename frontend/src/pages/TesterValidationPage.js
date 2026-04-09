import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Code,
  Plus,
  Loader2,
  User,
  FileText,
  Trash2
} from 'lucide-react';

const TesterValidationPage = () => {
  const { validationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [validation, setValidation] = useState(null);
  const [workUnit, setWorkUnit] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // New issue form
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueSeverity, setIssueSeverity] = useState('medium');

  useEffect(() => {
    fetchData();
  }, [validationId]);

  const fetchData = async () => {
    try {
      const [validationsRes, issuesRes] = await Promise.all([
        axios.get(`${API}/tester/validation-tasks`, { withCredentials: true }),
        axios.get(`${API}/validation/${validationId}/issues`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      
      const val = validationsRes.data.find(v => v.validation_id === validationId);
      setValidation(val);
      setIssues(issuesRes.data);
      
      if (val?.unit_id) {
        // Get work unit and submission details
        const [unitRes, subRes] = await Promise.all([
          axios.get(`${API}/admin/work-units`, { withCredentials: true }).catch(() => ({ data: [] })),
          axios.get(`${API}/work-units/${val.unit_id}/submissions`, { withCredentials: true }).catch(() => ({ data: [] }))
        ]);
        
        const unit = unitRes.data.find(u => u.unit_id === val.unit_id);
        setWorkUnit(unit);
        
        // Get latest approved submission
        const approvedSub = subRes.data.find(s => s.status === 'approved') || subRes.data[subRes.data.length - 1];
        setSubmission(approvedSub);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIssue = async (e) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;
    
    setActionLoading(true);
    try {
      await axios.post(`${API}/validation/${validationId}/issue`, {
        title: issueTitle,
        description: issueDescription,
        severity: issueSeverity
      }, { withCredentials: true });
      
      setIssueTitle('');
      setIssueDescription('');
      setIssueSeverity('medium');
      await fetchData();
    } catch (error) {
      alert('Failed to add issue');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePass = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/validation/${validationId}/pass`, {}, { withCredentials: true });
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to pass validation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFail = async () => {
    if (issues.length === 0) {
      alert('You must add at least one issue before failing validation');
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.post(`${API}/validation/${validationId}/fail`, {}, { withCredentials: true });
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to fail validation');
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

  if (!validation) {
    return (
      <div className="p-6">
        <p className="text-zinc-500">Validation not found</p>
      </div>
    );
  }

  const status = validation.status;
  const canValidate = ['pending', 'in_progress'].includes(status);
  const isPassed = status === 'passed';
  const isFailed = status === 'failed';

  return (
    <div className="p-6" data-testid="tester-validation-page">
      {/* Back Button */}
      <button
        onClick={() => navigate('/tester/validation')}
        className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Queue
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* LEFT COLUMN - Validation Content */}
        <div className="col-span-2 space-y-4">
          {/* Header */}
          <div>
            <h1 className="text-xl font-semibold">
              {workUnit?.title || `Validation #${validationId?.slice(-6)}`}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
              <span className="capitalize">{workUnit?.unit_type || 'Task'}</span>
              <span>·</span>
              <span>{workUnit?.estimated_hours || 0}h</span>
            </div>
          </div>

          {/* Resources */}
          {submission && (submission.links?.length > 0 || submission.preview_url) && (
            <Card title="Resources">
              <div className="flex flex-wrap gap-2">
                {submission.links?.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Link {i + 1}
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* What to validate */}
          <Card title="What to Validate">
            <p className="text-zinc-300">{workUnit?.description || 'Review the submitted work for quality and completeness'}</p>
            {submission?.summary && (
              <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                <div className="text-xs text-zinc-500 mb-1">Developer Summary</div>
                <p className="text-sm text-zinc-300">{submission.summary}</p>
              </div>
            )}
          </Card>

          {/* Issues Section */}
          <Card title={`Issues (${issues.length})`} variant={isFailed ? 'error' : undefined}>
            {/* Existing Issues */}
            {issues.length > 0 && (
              <div className="space-y-2 mb-4">
                {issues.map((issue) => (
                  <div 
                    key={issue.issue_id}
                    className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg"
                  >
                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                      issue.severity === 'high' ? 'text-red-400' :
                      issue.severity === 'medium' ? 'text-amber-400' :
                      'text-zinc-400'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{issue.title}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          issue.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                          issue.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>
                      {issue.description && (
                        <p className="text-sm text-zinc-400 mt-1">{issue.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Issue Form */}
            {canValidate && (
              <form onSubmit={handleAddIssue} className="space-y-3 pt-3 border-t border-zinc-800">
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    placeholder="Issue title"
                    className="col-span-2 bg-black border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-zinc-600 outline-none"
                    data-testid="issue-title-input"
                  />
                  <select
                    value={issueSeverity}
                    onChange={(e) => setIssueSeverity(e.target.value)}
                    className="bg-black border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-zinc-600 outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-white text-sm h-20 resize-none focus:border-zinc-600 outline-none"
                  data-testid="issue-description-input"
                />
                <button
                  type="submit"
                  disabled={actionLoading || !issueTitle.trim()}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-all flex items-center gap-2"
                  data-testid="add-issue-btn"
                >
                  <Plus className="w-4 h-4" />
                  Add Issue
                </button>
              </form>
            )}
          </Card>

          {/* Completed States */}
          {isPassed && (
            <Card title="Result" variant="success">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="font-medium text-emerald-400">Validation Passed</div>
                  <p className="text-zinc-500 text-sm">Work unit has been approved and completed</p>
                </div>
              </div>
            </Card>
          )}

          {isFailed && (
            <Card title="Result" variant="error">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-red-400" />
                <div>
                  <div className="font-medium text-red-400">Validation Failed</div>
                  <p className="text-zinc-500 text-sm">Work unit returned to developer for revision</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN - Status & Actions */}
        <div className="space-y-4">
          <Card title="Status">
            <StatusBadge status={status} />
          </Card>

          {workUnit?.project_name && (
            <Card title="Project">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-500" />
                <span>{workUnit.project_name}</span>
              </div>
            </Card>
          )}

          {workUnit?.assigned_to && (
            <Card title="Developer">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-500" />
                <span>{workUnit.developer_name || workUnit.assigned_to?.slice(-8)}</span>
              </div>
            </Card>
          )}

          {/* Actions */}
          {canValidate && (
            <div className="space-y-2">
              <button
                onClick={handlePass}
                disabled={actionLoading}
                className="w-full bg-emerald-600 text-white rounded-xl p-3 font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                data-testid="pass-btn"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <><CheckCircle2 className="w-5 h-5" /> PASS</>
                )}
              </button>
              <button
                onClick={handleFail}
                disabled={actionLoading || issues.length === 0}
                className="w-full bg-red-600 text-white rounded-xl p-3 font-medium flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-50 transition-all"
                data-testid="fail-btn"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <><XCircle className="w-5 h-5" /> FAIL</>
                )}
              </button>
              {issues.length === 0 && (
                <p className="text-xs text-zinc-500 text-center">Add at least one issue to fail</p>
              )}
            </div>
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
  }[variant] || 'border-zinc-800';

  const bgClass = {
    error: 'bg-red-500/5',
    success: 'bg-emerald-500/5',
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
    pending: { label: 'Pending', bg: 'bg-amber-500', text: 'text-black' },
    in_progress: { label: 'In Progress', bg: 'bg-blue-500', text: 'text-white' },
    passed: { label: 'Passed', bg: 'bg-emerald-500', text: 'text-white' },
    failed: { label: 'Failed', bg: 'bg-red-500', text: 'text-white' },
  }[status] || { label: status, bg: 'bg-zinc-700', text: 'text-white' };

  return (
    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

export default TesterValidationPage;
