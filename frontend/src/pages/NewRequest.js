import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Lightbulb, Code, Palette, Database } from 'lucide-react';

const NewRequest = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post(`${API}/requests`, {
        title: input.slice(0, 100),
        description: input,
        business_idea: input,
      }, { withCredentials: true });
      
      // Redirect to dashboard with success state
      navigate('/client/dashboard', { state: { requestCreated: true } });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create request');
      setLoading(false);
    }
  };

  const examples = [
    { icon: Palette, text: "A SaaS dashboard for tracking team productivity" },
    { icon: Code, text: "Mobile app for booking fitness classes" },
    { icon: Database, text: "E-commerce platform for handmade goods" },
    { icon: Lightbulb, text: "Internal tool for managing customer support tickets" }
  ];

  return (
    <div className="min-h-screen bg-[#05050A] text-white p-8" data-testid="new-request-page">
      {/* Background */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="relative max-w-2xl mx-auto">
        {/* Back button */}
        <button 
          onClick={() => navigate('/client/dashboard')}
          className="flex items-center gap-2 text-white/50 hover:text-white mb-12 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-white/70 font-medium tracking-wide uppercase">New Project</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
              What do you want<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">to build?</span>
            </h1>
            <p className="text-lg text-white/50">
              Describe your idea in any format. We'll transform it into a structured product.
            </p>
          </div>

          {/* Input Area */}
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0F] overflow-hidden mb-6">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="I want to build a marketplace for vintage cars where sellers can list their vehicles with detailed history, and buyers can browse, filter, and make offers..."
              className="w-full min-h-[200px] bg-transparent p-6 text-white placeholder:text-white/30 focus:outline-none resize-none text-lg"
              data-testid="idea-input"
              autoFocus
            />
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2 text-white/30 text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Our team will structure your idea</span>
              </div>
              <span className="text-white/30 text-sm font-mono">{input.length}</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            data-testid="submit-btn"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Start Project
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Example Ideas */}
        <div className="mt-16">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-6">Example Ideas</h3>
          <div className="grid gap-3">
            {examples.map((example, i) => {
              const Icon = example.icon;
              return (
                <button
                  key={i}
                  onClick={() => setInput(example.text)}
                  className="w-full text-left p-5 rounded-2xl border border-white/[0.06] bg-[#0A0A0F] hover:border-blue-500/30 hover:bg-[#0D0D14] transition-all group flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-blue-500/10 transition-colors">
                    <Icon className="w-5 h-5 text-white/40 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <span className="text-white/60 group-hover:text-white transition-colors">{example.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* What Happens Next */}
        <div className="mt-16 rounded-2xl border border-white/[0.06] bg-[#0A0A0F] p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-blue-400" />
            What Happens Next
          </h3>
          <div className="space-y-4">
            <Step number="1" title="Review" description="Our team reviews your idea within 24 hours" />
            <Step number="2" title="Scope" description="We create a detailed project scope with timeline" />
            <Step number="3" title="Build" description="Development begins with regular deliverables" />
          </div>
        </div>
      </div>
    </div>
  );
};

const Step = ({ number, title, description }) => (
  <div className="flex items-start gap-4">
    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-bold text-blue-400">{number}</span>
    </div>
    <div>
      <h4 className="font-medium">{title}</h4>
      <p className="text-sm text-white/40">{description}</p>
    </div>
  </div>
);

export default NewRequest;
