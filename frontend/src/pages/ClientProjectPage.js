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
  X,
  FileText,
  Download
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

  useEffect(() => {
    fetchProject();
    
    // Simulate AI processing for new projects
    if (isNew) {
      simulateAiProcessing();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      // First try to get as project, then as request
      let res;
      try {
        res = await axios.get(`${API}/projects/${projectId}`, { withCredentials: true });
      } catch {
        res = await axios.get(`${API}/requests/${projectId}`, { withCredentials: true });
      }
      setProject(res.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulateAiProcessing = () => {
    // Start progress animation
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
    
    // Call real AI endpoint
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
        cost: res.data.cost || { min: 5000, max: 10000, currency: 'USD' }
      });
      
      setTimeout(() => setAiProcessing(false), 500);
    } catch (error) {
      console.error('AI analysis error:', error);
      // Fallback to mock data if AI fails
      setAiProgress(100);
      setGeneratedData({
        features: [
          { name: 'Core Feature 1', description: 'Main functionality based on your idea', hours: 16 },
          { name: 'User Interface', description: 'Frontend implementation', hours: 20 },
          { name: 'Backend API', description: 'Server-side logic and database', hours: 24 },
          { name: 'Authentication', description: 'User login and security', hours: 8 },
        ],
        timeline: { design: '1 week', development: '3-4 weeks', testing: '1 week', total: '5-6 weeks' },
        cost: { min: 5000, max: 8000, currency: 'USD' }
      });
      setTimeout(() => setAiProcessing(false), 500);
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

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto" data-testid="client-project-page">
      {/* Back Button */}
      <button
        onClick={() => navigate('/client/dashboard')}
        className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* AI Processing State */}
      {aiProcessing && (
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
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/50">Processing</span>
              <span className="text-violet-400 font-mono">{aiProgress}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${aiProgress}%` }}
              />
            </div>
          </div>
          
          {/* Processing Steps */}
          <div className="grid grid-cols-4 gap-4">
            <ProcessingStep 
              icon={<Layers className="w-4 h-4" />} 
              label="Breaking into features" 
              active={aiProgress >= 20} 
              done={aiProgress >= 45}
            />
            <ProcessingStep 
              icon={<Calendar className="w-4 h-4" />} 
              label="Defining timeline" 
              active={aiProgress >= 45} 
              done={aiProgress >= 70}
            />
            <ProcessingStep 
              icon={<DollarSign className="w-4 h-4" />} 
              label="Estimating cost" 
              active={aiProgress >= 70} 
              done={aiProgress >= 90}
            />
            <ProcessingStep 
              icon={<Zap className="w-4 h-4" />} 
              label="Finalizing" 
              active={aiProgress >= 90} 
              done={aiProgress >= 100}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {!aiProcessing && generatedData && (
        <>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">AI Analysis Complete</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {project?.title || 'Your Project'}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Features */}
              <Card title="Features" icon={<Layers className="w-4 h-4 text-blue-400" />} badge={`${generatedData.features.length} items`}>
                <p className="text-white/50 text-sm mb-4">We've identified these core features for your product:</p>
                <div className="space-y-3">
                  {generatedData.features.map((feature, i) => (
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
                <div className="grid grid-cols-3 gap-4">
                  <TimelineBlock label="Design" value={generatedData.timeline.design} />
                  <TimelineBlock label="Development" value={generatedData.timeline.development} />
                  <TimelineBlock label="Testing" value={generatedData.timeline.testing} />
                </div>
                <div className="mt-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Total estimated time</span>
                    <span className="text-xl font-semibold text-cyan-400">{generatedData.timeline.total}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Cost Estimate */}
              <Card title="Cost Estimate" icon={<DollarSign className="w-4 h-4 text-emerald-400" />}>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-white mb-1">
                    ${generatedData.cost.min.toLocaleString()} - ${generatedData.cost.max.toLocaleString()}
                  </div>
                  <p className="text-white/40 text-sm">USD</p>
                </div>
                <div className="border-t border-white/10 pt-4 mt-4">
                  <p className="text-sm text-white/50 text-center">
                    Based on {generatedData.features.reduce((sum, f) => sum + f.hours, 0)} estimated development hours
                  </p>
                </div>
              </Card>

              {/* Next Steps */}
              <Card title="Next Steps" icon={<Zap className="w-4 h-4 text-violet-400" />}>
                <div className="space-y-3">
                  <NextStep number={1} text="Review the features and timeline" done />
                  <NextStep number={2} text="Approve or request changes" active />
                  <NextStep number={3} text="We start building" />
                </div>
                <button 
                  className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25"
                  data-testid="approve-btn"
                >
                  Approve & Start Building
                </button>
              </Card>

              {/* Chat */}
              <Card title="Questions?" icon={<MessageCircle className="w-4 h-4 text-blue-400" />}>
                <div className="h-48 flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                    {chatHistory.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-white/40">Ask anything about your project</p>
                      </div>
                    ) : (
                      chatHistory.map(msg => (
                        <div key={msg.id} className="p-3 rounded-xl bg-blue-500/20 ml-auto max-w-[85%]">
                          <p className="text-sm">{msg.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!chatMessage.trim()}
                      className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Existing Project (not new) */}
      {!aiProcessing && !generatedData && project && (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">{project.title || project.name}</h2>
          <p className="text-white/50 mb-6">{project.description || project.business_idea}</p>
          <p className="text-white/40">Status: {project.status || project.current_stage}</p>
        </div>
      )}
    </div>
  );
};

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
      active ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' :
      'bg-white/5 text-white/30 border border-white/10'
    }`}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : number}
    </div>
    <span className={done ? 'text-emerald-400' : active ? 'text-white' : 'text-white/40'}>{text}</span>
  </div>
);

export default ClientProjectPage;
