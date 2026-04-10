import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Layers,
  Calendar,
  DollarSign,
  Zap,
  MessageCircle,
  Send,
  FileText,
  Download,
  AlertCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';

const ClientProjectPage = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isNew = location.state?.isNew;
  const originalIdea = location.state?.idea;
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiProcessing, setAiProcessing] = useState(isNew);
  const [aiProgress, setAiProgress] = useState(0);
  const [generatedData, setGeneratedData] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchProject();
    if (isNew) {
      simulateAiProcessing();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      let res;
      try {
        res = await axios.get(`${API}/projects/${projectId}`, { withCredentials: true });
      } catch {
        res = await axios.get(`${API}/requests/${projectId}`, { withCredentials: true });
      }
      setProject(res.data);
      
      // Load saved AI data if exists
      if (res.data.ai_analysis) {
        setGeneratedData(res.data.ai_analysis);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulateAiProcessing = () => {
    const progressSteps = [
      { progress: 15, delay: 500 },
      { progress: 30, delay: 1000 },
      { progress: 50, delay: 1500 },
      { progress: 70, delay: 2000 },
      { progress: 85, delay: 2500 },
    ];
    
    let totalDelay = 0;
    progressSteps.forEach(step => {
      totalDelay += step.delay;
      setTimeout(() => setAiProgress(step.progress), totalDelay);
    });
    
    callAiAnalysis();
  };
  
  const callAiAnalysis = async () => {
    try {
      const res = await axios.post(`${API}/ai/analyze-project`, {
        idea: originalIdea || project?.business_idea || project?.description || '',
        request_id: projectId
      }, { withCredentials: true });
      
      setAiProgress(100);
      setGeneratedData({
        features: res.data.features || [],
        timeline: res.data.timeline || { design: '1 week', development: '4 weeks', testing: '1 week', total: '6 weeks' },
        cost: res.data.cost || { total_hours: 100, market_average: { min: 4000, max: 5000 }, premium_quality: { min: 2250, max: 2750 }, optimized: { min: 1350, max: 1650 } },
        complexity: res.data.complexity,
        team_size: res.data.team_size
      });
      
      // Save to backend
      try {
        await axios.patch(`${API}/requests/${projectId}`, {
          ai_analysis: res.data,
          status: 'proposal_ready'
        }, { withCredentials: true });
      } catch (e) {}
      
      setTimeout(() => setAiProcessing(false), 500);
    } catch (error) {
      console.error('AI analysis error:', error);
      setAiProgress(100);
      setGeneratedData({
        features: [
          { name: 'Core Feature', description: 'Main functionality', hours: 40 },
          { name: 'User Interface', description: 'Frontend implementation', hours: 30 },
          { name: 'Backend API', description: 'Server-side logic', hours: 35 },
          { name: 'Authentication', description: 'User security', hours: 15 },
        ],
        timeline: { design: '1 week', development: '3-4 weeks', testing: '1 week', total: '5-6 weeks' },
        cost: { total_hours: 120, market_average: { min: 4752, max: 5808 }, premium_quality: { min: 2700, max: 3300 }, optimized: { min: 1620, max: 1980 } }
      });
      setTimeout(() => setAiProcessing(false), 500);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await axios.patch(`${API}/requests/${projectId}`, {
        status: 'awaiting_approval'
      }, { withCredentials: true });
      
      // Refresh
      await fetchProject();
    } catch (error) {
      alert('Failed to submit approval');
    } finally {
      setApproving(false);
    }
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    setChatHistory([...chatHistory, { 
      id: Date.now(), 
      text: chatMessage, 
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setChatMessage('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const status = project?.status || 'idea_submitted';
  const isProposalReady = status === 'proposal_ready' || generatedData;
  const isAwaitingApproval = status === 'awaiting_approval';
  const isActive = ['active', 'development', 'design', 'qa'].includes(status);
  const isDelivery = status === 'delivery';
  const isCompleted = status === 'completed';

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto" data-testid="client-project-page">
      {/* Back Button */}
      <button
        onClick={() => navigate('/client/projects')}
        className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </button>

      {/* AI Processing State */}
      {aiProcessing && (
        <AIProcessingBlock progress={aiProgress} />
      )}

      {/* Proposal Ready - THE MONEY MOMENT */}
      {!aiProcessing && isProposalReady && !isAwaitingApproval && !isActive && !isCompleted && generatedData && (
        <ProposalReadyView 
          project={project}
          data={generatedData}
          onApprove={handleApprove}
          approving={approving}
        />
      )}

      {/* Awaiting Approval */}
      {isAwaitingApproval && (
        <AwaitingApprovalView project={project} />
      )}

      {/* Active Project */}
      {isActive && (
        <ActiveProjectView 
          project={project} 
          chatMessage={chatMessage}
          setChatMessage={setChatMessage}
          chatHistory={chatHistory}
          onSendMessage={handleSendMessage}
        />
      )}

      {/* Delivery */}
      {isDelivery && (
        <DeliveryView project={project} />
      )}

      {/* Completed */}
      {isCompleted && (
        <CompletedView project={project} />
      )}

      {/* Initial Submitted State (no AI yet) */}
      {!aiProcessing && !generatedData && !isActive && !isCompleted && (
        <IdeaSubmittedView project={project} />
      )}
    </div>
  );
};

// ============ SUB COMPONENTS ============

const AIProcessingBlock = ({ progress }) => (
  <div className="rounded-3xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 border border-violet-500/30 p-8 mb-8">
    <div className="flex items-center gap-4 mb-6">
      <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center">
        <Sparkles className="w-7 h-7 text-violet-400 animate-pulse" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold">AI is analyzing your idea...</h2>
        <p className="text-white/50">Breaking down into features, timeline and cost</p>
      </div>
    </div>
    
    <div className="mb-6">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-white/50">Processing</span>
        <span className="text-violet-400 font-mono">{progress}%</span>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
    
    <div className="grid grid-cols-4 gap-4">
      <ProcessingStep icon={<Layers className="w-4 h-4" />} label="Features" active={progress >= 20} done={progress >= 45} />
      <ProcessingStep icon={<Calendar className="w-4 h-4" />} label="Timeline" active={progress >= 45} done={progress >= 70} />
      <ProcessingStep icon={<DollarSign className="w-4 h-4" />} label="Cost" active={progress >= 70} done={progress >= 90} />
      <ProcessingStep icon={<Zap className="w-4 h-4" />} label="Finalizing" active={progress >= 90} done={progress >= 100} />
    </div>
  </div>
);

const ProposalReadyView = ({ project, data, onApprove, approving }) => (
  <>
    {/* Header */}
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <span className="text-sm text-emerald-400 font-medium">Your Project Plan is Ready</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{project?.title || 'Your Project'}</h1>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Features */}
        <Card title="What We'll Build" icon={<Layers className="w-4 h-4 text-blue-400" />} badge={`${data.features?.length || 0} features`}>
          <div className="space-y-3">
            {data.features?.map((feature, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{feature.name}</h4>
                  <p className="text-sm text-white/50 mt-1">{feature.description}</p>
                </div>
                <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-lg">{feature.hours}h</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Timeline */}
        <Card title="Timeline" icon={<Calendar className="w-4 h-4 text-cyan-400" />}>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <TimelineBlock label="Design" value={data.timeline?.design} />
            <TimelineBlock label="Development" value={data.timeline?.development} />
            <TimelineBlock label="Testing" value={data.timeline?.testing} />
          </div>
          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Total estimated time</span>
              <span className="text-xl font-semibold text-cyan-400">{data.timeline?.total}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Cost Options */}
        <Card title="Investment Options" icon={<DollarSign className="w-4 h-4 text-emerald-400" />}>
          <div className="space-y-4">
            {/* Market Average */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white/50">Market Average</span>
              </div>
              <div className="text-xl font-semibold text-white/40 line-through">
                ${data.cost?.market_average?.min?.toLocaleString()} - ${data.cost?.market_average?.max?.toLocaleString()}
              </div>
            </div>
            
            {/* Premium Quality - Highlighted */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 relative">
              <div className="absolute -top-2 right-3 px-2 py-0.5 bg-emerald-500 text-[10px] font-bold text-white rounded-full uppercase">
                Best Value
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-emerald-400 font-medium">Premium Quality</span>
              </div>
              <div className="text-2xl font-bold text-white">
                ${data.cost?.premium_quality?.min?.toLocaleString()} - ${data.cost?.premium_quality?.max?.toLocaleString()}
              </div>
            </div>
            
            {/* Optimized */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white/50">Optimized</span>
                <span className="text-xs text-amber-400/60">With trade-offs</span>
              </div>
              <div className="text-xl font-semibold text-white">
                ${data.cost?.optimized?.min?.toLocaleString()} - ${data.cost?.optimized?.max?.toLocaleString()}
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-4 mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/50">Estimated scope</span>
              <span className="font-medium">{data.cost?.total_hours}h</span>
            </div>
          </div>
        </Card>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 border border-blue-500/30 p-6">
          <h3 className="font-semibold mb-2">Ready to Start?</h3>
          <p className="text-sm text-white/50 mb-4">
            Approve the plan and our team will begin development immediately.
          </p>
          <button
            onClick={onApprove}
            disabled={approving}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {approving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Start Building
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </>
);

const AwaitingApprovalView = ({ project }) => (
  <div className="max-w-2xl mx-auto text-center py-16">
    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 mx-auto mb-6 flex items-center justify-center">
      <Clock className="w-10 h-10 text-blue-400" />
    </div>
    <h1 className="text-3xl font-semibold mb-4">Waiting for Team Confirmation</h1>
    <p className="text-lg text-white/50 mb-8">
      Thank you for approving the project plan! Our team is reviewing your request and will begin work shortly.
    </p>
    
    <div className="rounded-2xl bg-[#151922] border border-white/10 p-6 text-left mb-8">
      <h3 className="font-semibold mb-4">What happens next:</h3>
      <div className="space-y-3">
        <NextStep number={1} text="Team reviews your approval" done />
        <NextStep number={2} text="Project assigned to developers" active />
        <NextStep number={3} text="Development begins" />
        <NextStep number={4} text="You receive first deliverables" />
      </div>
    </div>
    
    <p className="text-white/40 text-sm">
      Expected response time: within 24 hours
    </p>
  </div>
);

const ActiveProjectView = ({ project, chatMessage, setChatMessage, chatHistory, onSendMessage }) => {
  const stages = ['idea', 'scope', 'design', 'development', 'review', 'delivery'];
  const currentStage = project?.current_stage || 'development';
  const currentIndex = stages.indexOf(currentStage);
  const progress = Math.round(((currentIndex + 1) / stages.length) * 100);

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg">
              Active
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{project?.title || project?.name}</h1>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{progress}%</div>
          <p className="text-sm text-white/50">completed</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Stage */}
          <Card title="Current Stage" icon={<Zap className="w-4 h-4 text-emerald-400" />}>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-semibold capitalize">{currentStage} in Progress</h4>
                <p className="text-sm text-white/50">Our team is actively working on your project</p>
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card title="Project Timeline" icon={<Clock className="w-4 h-4 text-blue-400" />}>
            <div className="space-y-4">
              {stages.map((stage, i) => {
                const isCompleted = i < currentIndex;
                const isCurrent = i === currentIndex;
                return (
                  <div key={stage} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-emerald-500/20 text-emerald-400' :
                      isCurrent ? 'bg-blue-500/20 text-blue-400 ring-4 ring-blue-500/20' :
                      'bg-white/5 text-white/30'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </div>
                    <span className={`capitalize ${
                      isCompleted ? 'text-emerald-400' :
                      isCurrent ? 'text-white font-medium' :
                      'text-white/40'
                    }`}>{stage}</span>
                    {isCurrent && <span className="text-xs text-blue-400 ml-2">In Progress</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column - Chat */}
        <div>
          <Card title="Messages" icon={<MessageCircle className="w-4 h-4 text-blue-400" />}>
            <div className="h-80 flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-white/40">Chat with your team</p>
                  </div>
                ) : (
                  chatHistory.map(msg => (
                    <div key={msg.id} className="p-3 rounded-xl bg-blue-500/20 ml-auto max-w-[85%]">
                      <p className="text-sm">{msg.text}</p>
                      <p className="text-[10px] text-white/30 mt-1">{msg.time}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={onSendMessage}
                  disabled={!chatMessage.trim()}
                  className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

const DeliveryView = ({ project }) => (
  <div className="max-w-2xl mx-auto text-center py-16">
    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 mx-auto mb-6 flex items-center justify-center">
      <Download className="w-10 h-10 text-purple-400" />
    </div>
    <h1 className="text-3xl font-semibold mb-4">Deliverables Ready!</h1>
    <p className="text-lg text-white/50 mb-8">
      Your project is complete. Please review the deliverables and let us know if you need any changes.
    </p>
  </div>
);

const CompletedView = ({ project }) => (
  <div className="max-w-2xl mx-auto text-center py-16">
    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 mx-auto mb-6 flex items-center justify-center">
      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
    </div>
    <h1 className="text-3xl font-semibold mb-4">Project Completed!</h1>
    <p className="text-lg text-white/50 mb-8">
      Thank you for working with us. You can request updates or start a new project anytime.
    </p>
  </div>
);

const IdeaSubmittedView = ({ project }) => (
  <div className="max-w-2xl mx-auto text-center py-16">
    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 mx-auto mb-6 flex items-center justify-center">
      <Clock className="w-10 h-10 text-amber-400" />
    </div>
    <h1 className="text-3xl font-semibold mb-4">Your Idea is Being Reviewed</h1>
    <p className="text-lg text-white/50 mb-8">
      Our team is analyzing your request. You'll receive a detailed project plan within 24 hours.
    </p>
    
    <div className="rounded-2xl bg-[#151922] border border-white/10 p-6 text-left">
      <h3 className="font-semibold mb-4">We're preparing:</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-white/60">
          <Layers className="w-5 h-5 text-blue-400" />
          <span>Feature breakdown</span>
        </div>
        <div className="flex items-center gap-3 text-white/60">
          <Calendar className="w-5 h-5 text-cyan-400" />
          <span>Timeline estimate</span>
        </div>
        <div className="flex items-center gap-3 text-white/60">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <span>Cost options</span>
        </div>
      </div>
    </div>
  </div>
);

// ============ SHARED COMPONENTS ============

const Card = ({ title, icon, badge, children }) => (
  <div className="rounded-2xl bg-[#151922] border border-white/10 overflow-hidden">
    {title && (
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {badge && <span className="text-xs text-white/40">{badge}</span>}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

const ProcessingStep = ({ icon, label, active, done }) => (
  <div className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
    done ? 'bg-emerald-500/10 border-emerald-500/30' :
    active ? 'bg-violet-500/10 border-violet-500/30' :
    'bg-white/5 border-white/5'
  }`}>
    <span className={done ? 'text-emerald-400' : active ? 'text-violet-400' : 'text-white/30'}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : icon}
    </span>
    <span className={`text-xs ${done ? 'text-emerald-400' : active ? 'text-violet-400' : 'text-white/40'}`}>
      {label}
    </span>
  </div>
);

const TimelineBlock = ({ label, value }) => (
  <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
    <p className="text-xs text-white/40 mb-1">{label}</p>
    <p className="font-semibold">{value}</p>
  </div>
);

const NextStep = ({ number, text, done, active }) => (
  <div className="flex items-center gap-3">
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
      done ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
      active ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
      'bg-white/5 text-white/30 border border-white/10'
    }`}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : number}
    </div>
    <span className={done ? 'text-emerald-400' : active ? 'text-white' : 'text-white/40'}>{text}</span>
  </div>
);

export default ClientProjectPage;
