import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import { ArrowRight, Loader2, Eye, EyeOff, Shield, Sparkles } from 'lucide-react';

const AdminLoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post(`${API}/auth/login`, {
        email: email.trim(),
        password
      }, { withCredentials: true });
      
      if (res.data.role !== 'admin') {
        setError('Access denied. Admin credentials required.');
        return;
      }
      
      setUser(res.data);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post(`${API}/auth/demo`, { role: 'admin' }, { withCredentials: true });
      setUser(res.data);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Demo access failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-8" data-testid="admin-login-page">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-white mx-auto mb-4 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#0A0A0A]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Access</h1>
          <p className="text-white/50 text-sm mt-1">Development OS Control Center</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@devos.io"
              className="w-full bg-white/5 border border-white/10 p-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
              data-testid="email-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 p-3 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                data-testid="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-[#0A0A0A] p-3 font-medium flex items-center justify-center gap-2 hover:bg-white/90 disabled:opacity-50 transition-all"
            data-testid="submit-btn"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Access Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-sm text-white/40">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Demo Access */}
        <button
          onClick={handleDemoAccess}
          disabled={loading}
          className="w-full border border-white/20 p-3 font-medium flex items-center justify-center gap-2 hover:bg-white/5 disabled:opacity-50 transition-all"
          data-testid="demo-btn"
        >
          <Sparkles className="w-4 h-4" />
          Demo Admin Access
        </button>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link to="/" className="text-white/40 hover:text-white text-sm transition-colors">
            ← Back to website
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
