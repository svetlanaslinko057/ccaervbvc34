import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';

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
      navigate('/dashboard', { state: { requestCreated: true } });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create request');
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6"
      style={{ fontFamily: "'Cabinet Grotesk', 'Inter', sans-serif" }}
    >
      <div className="w-full max-w-2xl">
        {/* Back button */}
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <form onSubmit={handleSubmit}>
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              What do you want to build?
            </h1>
            <p className="text-white/50">
              Describe your idea in any format. We'll transform it into a structured product.
            </p>
          </div>

          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="I want to build a marketplace for vintage cars where sellers can list their vehicles with detailed history, and buyers can browse, filter, and make offers..."
              className="w-full h-48 bg-white/5 border border-white/10 p-5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none transition-colors"
              data-testid="idea-input"
              autoFocus
            />
            <div className="absolute bottom-4 right-4 text-white/30 text-sm">
              {input.length} characters
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Our team will structure your idea</span>
            </div>

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-white text-[#0A0A0A] px-8 py-4 font-medium flex items-center gap-2 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              data-testid="submit-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Start Project
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Example Ideas */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <h3 className="text-white/40 text-sm mb-4">EXAMPLE IDEAS</h3>
          <div className="grid gap-3">
            {[
              "A SaaS dashboard for tracking team productivity",
              "Mobile app for booking fitness classes",
              "E-commerce platform for handmade goods",
              "Internal tool for managing customer support tickets"
            ].map((example, i) => (
              <button
                key={i}
                onClick={() => setInput(example)}
                className="text-left p-4 border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all text-sm"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewRequest;
