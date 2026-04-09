import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Code2, Layers, Rocket, CheckCircle2, Users, Zap, Shield, GitBranch, Terminal } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#05050A] text-white overflow-x-hidden" data-testid="landing-page">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#05050A]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">Dev OS</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#workflow" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="nav-workflow">
              How it works
            </a>
            <a href="#builders" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="nav-builders">
              For Builders
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/builder/auth')}
              className="hidden sm:flex text-sm text-white/50 hover:text-white transition-colors px-4 py-2 hover:bg-white/5 rounded-xl"
              data-testid="nav-login"
            >
              Log in
            </button>
            <button 
              onClick={() => navigate('/client/auth')}
              className="bg-white hover:bg-white/90 text-black text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
              data-testid="nav-start"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[150px]" />
          <img 
            src="https://static.prod-images.emergentagent.com/jobs/70120df5-824e-4d4e-b8dc-1a4556713200/images/64ffe797a50f1868e997b417f8fd0bb29f49c2f437047e9a73ea04a767c23a3a.png"
            alt=""
            className="absolute right-0 top-20 w-1/2 h-auto opacity-20 object-contain"
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 sm:px-12 py-24 grid md:grid-cols-2 gap-16 items-center">
          {/* Left - Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs text-white/70 font-medium tracking-wide">EXECUTION PLATFORM</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tighter leading-[1.1]">
              Ship products,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">not tickets</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-white/50 leading-relaxed max-w-xl">
              From idea to production. Real developers, structured workflow, verified delivery.
            </p>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
              <button 
                onClick={() => navigate('/client/auth')}
                className="group bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-4 rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 flex items-center gap-3"
                data-testid="hero-start-button"
              >
                Start Your Project
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => navigate('/builder/auth')}
                className="text-white/70 hover:text-white font-medium px-6 py-4 transition-colors flex items-center gap-2"
                data-testid="hero-join-button"
              >
                <Code2 className="w-5 h-5" />
                Join as Builder
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 pt-8 border-t border-white/10">
              <div>
                <div className="text-2xl font-semibold">98%</div>
                <div className="text-sm text-white/40">Delivery rate</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">4 weeks</div>
                <div className="text-sm text-white/40">Avg. MVP time</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">200+</div>
                <div className="text-sm text-white/40">Active builders</div>
              </div>
            </div>
          </div>

          {/* Right - Animated Terminal */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-xl" />
            <AnimatedTerminal />
          </div>
        </div>
      </section>

      {/* Workflow Section - Bento Grid */}
      <section id="workflow" className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">How it works</h2>
            <p className="text-white/50 max-w-xl mx-auto">From your idea to a working product in three structured phases</p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Submit Card - Span 4 */}
            <div className="md:col-span-4 relative group">
              <div className="h-full p-8 rounded-2xl bg-[#111116] border border-white/10 hover:border-blue-500/30 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-colors" />
                <div className="relative">
                  <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center mb-6">
                    <Layers className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="text-xs text-blue-500 font-mono mb-2">01</div>
                  <h3 className="text-xl font-semibold mb-3">Submit</h3>
                  <p className="text-white/50 text-sm leading-relaxed mb-6">
                    Describe your product idea. We analyze requirements and create a detailed scope with timeline.
                  </p>
                  {/* Mini form mockup */}
                  <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="h-3 w-3/4 bg-white/10 rounded" />
                    <div className="h-3 w-1/2 bg-white/10 rounded" />
                    <div className="h-8 w-full bg-blue-600/20 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>

            {/* Execute Card - Span 8 */}
            <div className="md:col-span-8 relative group">
              <div className="h-full p-8 rounded-2xl bg-[#111116] border border-white/10 hover:border-blue-500/30 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl group-hover:bg-purple-600/20 transition-colors" />
                <div className="relative grid md:grid-cols-2 gap-8 h-full">
                  <div>
                    <div className="w-12 h-12 bg-purple-600/10 rounded-xl flex items-center justify-center mb-6">
                      <Terminal className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="text-xs text-purple-500 font-mono mb-2">02</div>
                    <h3 className="text-xl font-semibold mb-3">Execute</h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                      Real developers build your product. Every task is tracked, reviewed, and validated through our QA process.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 text-xs bg-white/5 rounded-full text-white/60">Kanban Board</span>
                      <span className="px-3 py-1 text-xs bg-white/5 rounded-full text-white/60">Code Review</span>
                      <span className="px-3 py-1 text-xs bg-white/5 rounded-full text-white/60">QA Testing</span>
                    </div>
                  </div>
                  <div className="relative">
                    <img 
                      src="https://static.prod-images.emergentagent.com/jobs/70120df5-824e-4d4e-b8dc-1a4556713200/images/65440009f9ca3a8ef4f630206bfb926b7e323e1669690729dd31687e7de48f36.png"
                      alt="Code terminal"
                      className="w-full h-full object-cover rounded-xl opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111116] via-transparent to-transparent rounded-xl" />
                  </div>
                </div>
              </div>
            </div>

            {/* Ship Card - Span 6 */}
            <div className="md:col-span-6 relative group">
              <div className="h-full p-8 rounded-2xl bg-[#111116] border border-white/10 hover:border-blue-500/30 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl group-hover:bg-emerald-600/20 transition-colors" />
                <div className="relative">
                  <div className="w-12 h-12 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-6">
                    <Rocket className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="text-xs text-emerald-500 font-mono mb-2">03</div>
                  <h3 className="text-xl font-semibold mb-3">Ship</h3>
                  <p className="text-white/50 text-sm leading-relaxed mb-6">
                    Review deliverables with full transparency. Approve and launch your product with confidence.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600/30 border-2 border-[#111116]" />
                      <div className="w-8 h-8 rounded-full bg-purple-600/30 border-2 border-[#111116]" />
                      <div className="w-8 h-8 rounded-full bg-emerald-600/30 border-2 border-[#111116]" />
                    </div>
                    <span className="text-sm text-white/50">Team delivered</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Card - Span 6 */}
            <div className="md:col-span-6 relative group">
              <div className="h-full p-8 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 hover:border-blue-500/30 transition-all duration-300 overflow-hidden">
                <div className="grid grid-cols-2 gap-6 h-full">
                  <MetricCard icon={<CheckCircle2 className="w-5 h-5" />} value="500+" label="Projects delivered" />
                  <MetricCard icon={<Users className="w-5 h-5" />} value="200+" label="Active builders" />
                  <MetricCard icon={<Zap className="w-5 h-5" />} value="4 weeks" label="Average MVP time" />
                  <MetricCard icon={<Shield className="w-5 h-5" />} value="98%" label="Satisfaction rate" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Builders Section */}
      <section id="builders" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left - Image */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-2xl" />
              <div className="relative rounded-2xl overflow-hidden border border-white/10">
                <img 
                  src="https://images.unsplash.com/photo-1719400471588-575b23e27bd7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwzfHxzb2Z0d2FyZSUyMGRldmVsb3BlciUyMGNvZGluZyUyMGRhcmt8ZW58MHx8fHwxNzc1NzQwMjUxfDA&ixlib=rb-4.1.0&q=85"
                  alt="Developer coding"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05050A] via-transparent to-transparent" />
                
                {/* Tech stack overlay */}
                <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
                  <div className="text-xs text-white/50 mb-2">Tech Stack</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-white/10 rounded text-white/80 font-mono">React</span>
                    <span className="px-2 py-1 text-xs bg-white/10 rounded text-white/80 font-mono">Node.js</span>
                    <span className="px-2 py-1 text-xs bg-white/10 rounded text-white/80 font-mono">Python</span>
                    <span className="px-2 py-1 text-xs bg-white/10 rounded text-white/80 font-mono">TypeScript</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Content */}
            <div className="space-y-8">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Join as <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Builder</span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed">
                Work on real projects. Get paid for quality. Build your portfolio with production experience.
              </p>
              
              <div className="space-y-4">
                <BulletPoint text="Structured tasks with clear requirements" />
                <BulletPoint text="Fair compensation based on skill level" />
                <BulletPoint text="Flexible remote work on your schedule" />
                <BulletPoint text="Build portfolio with real shipped products" />
              </div>

              <button 
                onClick={() => navigate('/builder/auth')}
                className="group bg-white/10 hover:bg-white/15 text-white font-medium px-8 py-4 rounded-xl transition-all border border-white/10 hover:border-white/20 flex items-center gap-3"
                data-testid="builder-apply-button"
              >
                <GitBranch className="w-5 h-5" />
                Apply to Build
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Background grid */}
            <div className="absolute inset-0 bg-[#111116]">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
            
            <div className="relative text-center py-20 px-8">
              <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6">
                Ready to ship?
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto mb-10">
                Get a structured scope and timeline within 24 hours. No commitment required.
              </p>
              <button 
                onClick={() => navigate('/client/auth')}
                className="group bg-blue-600 hover:bg-blue-500 text-white font-medium px-10 py-5 rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 text-lg flex items-center gap-3 mx-auto"
                data-testid="cta-start-button"
              >
                Start Your Project
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-white/5 bg-[#020205]">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">D</span>
                </div>
                <span className="font-semibold text-xl">Development OS</span>
              </div>
              <p className="text-white/40 max-w-md">
                The execution platform for product teams. Ship software, not tickets.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <div className="space-y-3">
                <a href="#workflow" className="block text-white/50 hover:text-white transition-colors text-sm" data-testid="footer-how-it-works">How it works</a>
                <a href="#builders" className="block text-white/50 hover:text-white transition-colors text-sm" data-testid="footer-for-builders">For Builders</a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Access</h4>
              <div className="space-y-3">
                <button onClick={() => navigate('/client/auth')} className="block text-white/50 hover:text-white transition-colors text-sm" data-testid="footer-client-portal">Client Portal</button>
                <button onClick={() => navigate('/builder/auth')} className="block text-white/50 hover:text-white transition-colors text-sm" data-testid="footer-builder-portal">Builder Portal</button>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/30">2026 Development OS. All rights reserved.</p>
            <p className="text-xs text-white/20 font-mono">v2.0.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Animated Terminal Component
const AnimatedTerminal = () => {
  const [lines, setLines] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const allLines = [
    { type: 'command', text: '$ devos init marketplace-app', delay: 0 },
    { type: 'output', text: 'Creating project scope...', delay: 100 },
    { type: 'success', text: 'Scope defined: 4 features, 120h estimate', delay: 200 },
    { type: 'command', text: '$ devos assign --auto', delay: 300 },
    { type: 'output', text: 'Matching developers to tasks...', delay: 100 },
    { type: 'success', text: 'dev_alex assigned to auth_module', delay: 150 },
    { type: 'success', text: 'dev_maria assigned to product_api', delay: 150 },
    { type: 'command', text: '$ devos status', delay: 300 },
    { type: 'progress', text: 'Progress: [=========-] 85%', delay: 200 },
    { type: 'output', text: 'In Review: 2 submissions', delay: 100 },
    { type: 'command', text: '$ devos deliver --version 1.0', delay: 300 },
    { type: 'output', text: 'Building deliverable package...', delay: 200 },
    { type: 'success', text: 'Deliverable ready for client approval', delay: 200 },
  ];

  useEffect(() => {
    if (currentIndex >= allLines.length) {
      const timeout = setTimeout(() => {
        setLines([]);
        setCurrentIndex(0);
      }, 3000);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      setLines(prev => [...prev, allLines[currentIndex]]);
      setCurrentIndex(prev => prev + 1);
    }, allLines[currentIndex]?.delay + 400 || 400);

    return () => clearTimeout(timeout);
  }, [currentIndex]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0D0D12] shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <span className="text-xs text-white/40 font-mono ml-2">devos-cli ~/projects</span>
      </div>

      {/* Terminal content */}
      <div className="p-6 min-h-[360px] font-mono text-sm space-y-1">
        {lines.map((line, i) => (
          <div 
            key={i}
            className={`animate-fade-in ${
              line.type === 'command' ? 'text-white' :
              line.type === 'success' ? 'text-emerald-400' :
              line.type === 'progress' ? 'text-blue-400' :
              'text-white/50'
            }`}
          >
            {line.type === 'success' && <span className="text-emerald-400 mr-2">✓</span>}
            {line.text}
          </div>
        ))}
        <span className="inline-block w-2 h-5 bg-blue-500 animate-pulse" />
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ icon, value, label }) => (
  <div className="text-center p-4">
    <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center text-white/60">
      {icon}
    </div>
    <div className="text-2xl font-semibold mb-1">{value}</div>
    <div className="text-xs text-white/40">{label}</div>
  </div>
);

// Bullet Point Component
const BulletPoint = ({ text }) => (
  <div className="flex items-start gap-3">
    <div className="w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
      <CheckCircle2 className="w-3 h-3 text-blue-500" />
    </div>
    <span className="text-white/70">{text}</span>
  </div>
);

export default LandingPage;
