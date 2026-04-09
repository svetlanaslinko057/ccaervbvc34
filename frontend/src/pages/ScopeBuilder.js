import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Loader2,
  Package,
  Layers,
  ClipboardList,
  Rocket,
  ChevronRight
} from 'lucide-react';

// Auto-generate work units based on scope item type
const AUTO_WORK_UNITS = {
  'auth': ['Login API', 'Register API', 'Auth UI', 'Session Management', 'Password Reset'],
  'dashboard': ['Dashboard Layout', 'Stats Components', 'Data Fetching', 'Charts/Graphs'],
  'checkout': ['Cart Logic', 'Payment Integration', 'Order Processing', 'Confirmation UI'],
  'user_profile': ['Profile View', 'Edit Profile', 'Avatar Upload', 'Settings Page'],
  'listings': ['List View', 'Detail View', 'Search/Filter', 'Create/Edit Form'],
  'notifications': ['Notification Service', 'Email Integration', 'UI Alerts', 'Push Setup'],
  'admin': ['Admin Layout', 'User Management', 'Content Management', 'Analytics View'],
  'api': ['API Design', 'Endpoints Implementation', 'Validation', 'Error Handling'],
  'default': ['UI Implementation', 'Backend Logic', 'Integration', 'Testing']
};

const ITEM_TYPES = [
  { id: 'feature', label: 'Feature', color: 'bg-blue-500' },
  { id: 'integration', label: 'Integration', color: 'bg-purple-500' },
  { id: 'design', label: 'Design', color: 'bg-pink-500' },
  { id: 'logic', label: 'Business Logic', color: 'bg-amber-500' },
  { id: 'qa', label: 'QA/Testing', color: 'bg-green-500' },
];

const ScopeBuilder = () => {
  const { requestId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [request, setRequest] = useState(null);
  const [productDefinition, setProductDefinition] = useState({
    product_type: 'web_app',
    goal: '',
    target_audience: '',
    key_features: [],
    constraints: [],
    estimated_timeline: '4-6 weeks'
  });
  const [scopeItems, setScopeItems] = useState([]);
  const [workUnits, setWorkUnits] = useState({});

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const res = await axios.get(`${API}/admin/requests`, { withCredentials: true });
        const found = res.data.find(r => r.request_id === requestId);
        if (found) {
          setRequest(found);
          // Pre-fill from request
          setProductDefinition(prev => ({
            ...prev,
            goal: found.business_idea || '',
            target_audience: found.target_audience || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching request:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [requestId]);

  const addScopeItem = () => {
    const newItem = {
      temp_id: `temp_${Date.now()}`,
      title: '',
      description: '',
      item_type: 'feature',
      priority: 'core',
      estimated_hours: 8
    };
    setScopeItems([...scopeItems, newItem]);
  };

  const updateScopeItem = (index, field, value) => {
    const updated = [...scopeItems];
    updated[index][field] = value;
    setScopeItems(updated);
    
    // Auto-generate work units when title changes
    if (field === 'title' && value.length > 2) {
      const key = value.toLowerCase().replace(/\s+/g, '_');
      const suggestions = AUTO_WORK_UNITS[key] || AUTO_WORK_UNITS['default'];
      setWorkUnits(prev => ({
        ...prev,
        [updated[index].temp_id]: suggestions.map(s => ({
          temp_id: `wu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          title: s,
          description: `${s} for ${value}`,
          unit_type: 'task',
          estimated_hours: 4
        }))
      }));
    }
  };

  const removeScopeItem = (index) => {
    const item = scopeItems[index];
    const updated = scopeItems.filter((_, i) => i !== index);
    setScopeItems(updated);
    
    // Remove associated work units
    const { [item.temp_id]: removed, ...rest } = workUnits;
    setWorkUnits(rest);
  };

  const addWorkUnit = (scopeItemId) => {
    setWorkUnits(prev => ({
      ...prev,
      [scopeItemId]: [
        ...(prev[scopeItemId] || []),
        {
          temp_id: `wu_${Date.now()}`,
          title: '',
          description: '',
          unit_type: 'task',
          estimated_hours: 4
        }
      ]
    }));
  };

  const updateWorkUnit = (scopeItemId, unitIndex, field, value) => {
    setWorkUnits(prev => {
      const updated = { ...prev };
      updated[scopeItemId][unitIndex][field] = value;
      return updated;
    });
  };

  const removeWorkUnit = (scopeItemId, unitIndex) => {
    setWorkUnits(prev => {
      const updated = { ...prev };
      updated[scopeItemId] = updated[scopeItemId].filter((_, i) => i !== unitIndex);
      return updated;
    });
  };

  const getTotalHours = () => {
    return Object.values(workUnits).flat().reduce((sum, u) => sum + (u.estimated_hours || 0), 0);
  };

  const getTotalWorkUnits = () => {
    return Object.values(workUnits).flat().length;
  };

  const handleLaunch = async () => {
    setSubmitting(true);
    try {
      // 1. Create Product Definition
      const pdRes = await axios.post(`${API}/admin/product-definition`, {
        request_id: requestId,
        ...productDefinition
      }, { withCredentials: true });
      const productId = pdRes.data.product_id;
      
      // 2. Create Scope
      const scopeRes = await axios.post(`${API}/admin/scope`, {
        product_id: productId,
        total_hours: getTotalHours()
      }, { withCredentials: true });
      const scopeId = scopeRes.data.scope_id;
      
      // 3. Create Scope Items and Work Units
      for (const item of scopeItems) {
        const itemRes = await axios.post(`${API}/admin/scope/${scopeId}/item`, {
          title: item.title,
          description: item.description,
          item_type: item.item_type,
          priority: item.priority,
          estimated_hours: item.estimated_hours
        }, { withCredentials: true });
        const scopeItemId = itemRes.data.item_id;
        
        // Create work units for this scope item
        const units = workUnits[item.temp_id] || [];
        for (const unit of units) {
          await axios.post(`${API}/admin/work-unit`, {
            scope_item_id: scopeItemId,
            title: unit.title,
            description: unit.description,
            unit_type: unit.unit_type,
            estimated_hours: unit.estimated_hours
          }, { withCredentials: true });
        }
      }
      
      // 4. Create Project
      await axios.post(`${API}/admin/project`, {
        scope_id: scopeId,
        client_id: request.user_id,
        name: request.title
      }, { withCredentials: true });
      
      // 5. Approve the request
      await axios.post(`${API}/admin/requests/${requestId}/approve`, {}, { withCredentials: true });
      
      // Navigate back to admin
      navigate('/admin/work-board');
    } catch (error) {
      console.error('Error launching project:', error);
      alert('Failed to launch project');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">Request not found</p>
          <button onClick={() => navigate('/admin/work-board')} className="text-white underline">
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" data-testid="scope-builder">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate('/admin/work-board')}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-lg font-bold tracking-tight">Scope Builder</span>
          <div className="w-20" />
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Product', icon: Package },
              { num: 2, label: 'Scope Items', icon: Layers },
              { num: 3, label: 'Work Units', icon: ClipboardList },
              { num: 4, label: 'Launch', icon: Rocket },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <button
                  onClick={() => setStep(s.num)}
                  className={`flex items-center gap-3 px-4 py-2 transition-all ${
                    step === s.num 
                      ? 'text-white' 
                      : step > s.num 
                        ? 'text-emerald-400' 
                        : 'text-white/30'
                  }`}
                >
                  <div className={`w-8 h-8 flex items-center justify-center border ${
                    step === s.num 
                      ? 'border-white bg-white text-black' 
                      : step > s.num 
                        ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400' 
                        : 'border-white/20'
                  }`}>
                    {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span className="hidden md:inline text-sm font-medium">{s.label}</span>
                </button>
                {i < 3 && <ChevronRight className="w-4 h-4 text-white/20 mx-2" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Step 1: Product Overview */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Product Overview</h2>
              <p className="text-white/50">Define the product based on client's request</p>
            </div>

            {/* Original Request */}
            <div className="border border-white/10 p-6 bg-white/[0.02]">
              <h3 className="text-sm text-white/50 mb-2">Original Request</h3>
              <p className="font-medium text-lg">{request.title}</p>
              <p className="text-white/60 mt-2">{request.business_idea}</p>
            </div>

            {/* Product Definition Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-white/50 mb-2">Product Type</label>
                <select
                  value={productDefinition.product_type}
                  onChange={(e) => setProductDefinition({...productDefinition, product_type: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 p-3 text-white"
                >
                  <option value="web_app">Web Application</option>
                  <option value="mobile_app">Mobile App</option>
                  <option value="dashboard">Dashboard</option>
                  <option value="marketplace">Marketplace</option>
                  <option value="saas">SaaS Platform</option>
                  <option value="telegram_app">Telegram Mini App</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-white/50 mb-2">Timeline</label>
                <select
                  value={productDefinition.estimated_timeline}
                  onChange={(e) => setProductDefinition({...productDefinition, estimated_timeline: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 p-3 text-white"
                >
                  <option value="1-2 weeks">1-2 weeks</option>
                  <option value="2-4 weeks">2-4 weeks</option>
                  <option value="4-6 weeks">4-6 weeks</option>
                  <option value="6-8 weeks">6-8 weeks</option>
                  <option value="8+ weeks">8+ weeks</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-white/50 mb-2">Goal</label>
                <textarea
                  value={productDefinition.goal}
                  onChange={(e) => setProductDefinition({...productDefinition, goal: e.target.value})}
                  placeholder="What is the main goal of this product?"
                  className="w-full bg-white/5 border border-white/10 p-3 text-white h-24 resize-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-white/50 mb-2">Target Audience</label>
                <input
                  value={productDefinition.target_audience}
                  onChange={(e) => setProductDefinition({...productDefinition, target_audience: e.target.value})}
                  placeholder="Who will use this product?"
                  className="w-full bg-white/5 border border-white/10 p-3 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="bg-white text-black px-6 py-3 font-medium flex items-center gap-2 hover:bg-white/90 transition-all"
              >
                Next: Scope Items
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Scope Items */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Scope Items</h2>
                <p className="text-white/50">Break down the product into features and components</p>
              </div>
              <button
                onClick={addScopeItem}
                className="bg-white text-black px-4 py-2 font-medium flex items-center gap-2 hover:bg-white/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {scopeItems.length === 0 ? (
              <div className="border border-white/10 border-dashed p-12 text-center">
                <Layers className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/50 mb-4">No scope items yet</p>
                <button
                  onClick={addScopeItem}
                  className="bg-white/10 text-white px-4 py-2 hover:bg-white/20 transition-all"
                >
                  Add First Item
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {scopeItems.map((item, index) => (
                  <div key={item.temp_id} className="border border-white/10 p-5 bg-white/[0.02]">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <input
                            value={item.title}
                            onChange={(e) => updateScopeItem(index, 'title', e.target.value)}
                            placeholder="Item title (e.g., Auth, Dashboard, Checkout)"
                            className="w-full bg-white/5 border border-white/10 p-3 text-white"
                          />
                        </div>
                        <div>
                          <select
                            value={item.item_type}
                            onChange={(e) => updateScopeItem(index, 'item_type', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 p-3 text-white"
                          >
                            {ITEM_TYPES.map(t => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={item.estimated_hours}
                            onChange={(e) => updateScopeItem(index, 'estimated_hours', parseInt(e.target.value) || 0)}
                            className="w-full bg-white/5 border border-white/10 p-3 text-white"
                          />
                          <span className="text-white/50 text-sm">hrs</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeScopeItem(index)}
                        className="text-white/30 hover:text-red-400 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={item.description}
                      onChange={(e) => updateScopeItem(index, 'description', e.target.value)}
                      placeholder="Description..."
                      className="w-full mt-3 bg-white/5 border border-white/10 p-3 text-white h-20 resize-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-white/20 hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={scopeItems.length === 0}
                className="bg-white text-black px-6 py-3 font-medium flex items-center gap-2 hover:bg-white/90 disabled:opacity-50 transition-all"
              >
                Next: Work Units
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Work Units */}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Work Units</h2>
              <p className="text-white/50">Break down each scope item into specific tasks</p>
            </div>

            {scopeItems.map((item) => (
              <div key={item.temp_id} className="border border-white/10 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{item.title || 'Untitled'}</h3>
                    <span className="text-white/40 text-sm">{item.item_type}</span>
                  </div>
                  <button
                    onClick={() => addWorkUnit(item.temp_id)}
                    className="text-white/50 hover:text-white flex items-center gap-1 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Unit
                  </button>
                </div>

                <div className="space-y-3">
                  {(workUnits[item.temp_id] || []).map((unit, unitIndex) => (
                    <div key={unit.temp_id} className="flex items-center gap-3 bg-white/[0.02] p-3">
                      <input
                        value={unit.title}
                        onChange={(e) => updateWorkUnit(item.temp_id, unitIndex, 'title', e.target.value)}
                        placeholder="Work unit title"
                        className="flex-1 bg-white/5 border border-white/10 p-2 text-white text-sm"
                      />
                      <input
                        type="number"
                        value={unit.estimated_hours}
                        onChange={(e) => updateWorkUnit(item.temp_id, unitIndex, 'estimated_hours', parseInt(e.target.value) || 0)}
                        className="w-16 bg-white/5 border border-white/10 p-2 text-white text-sm text-center"
                      />
                      <span className="text-white/40 text-xs">hrs</span>
                      <button
                        onClick={() => removeWorkUnit(item.temp_id, unitIndex)}
                        className="text-white/30 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-white/20 hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="bg-white text-black px-6 py-3 font-medium flex items-center gap-2 hover:bg-white/90 transition-all"
              >
                Next: Review
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Launch */}
        {step === 4 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Review & Launch</h2>
              <p className="text-white/50">Review the project scope before launching</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-white/10 p-6 text-center">
                <div className="text-4xl font-bold">{scopeItems.length}</div>
                <div className="text-white/50 text-sm mt-1">Scope Items</div>
              </div>
              <div className="border border-white/10 p-6 text-center">
                <div className="text-4xl font-bold">{getTotalWorkUnits()}</div>
                <div className="text-white/50 text-sm mt-1">Work Units</div>
              </div>
              <div className="border border-white/10 p-6 text-center">
                <div className="text-4xl font-bold">{getTotalHours()}h</div>
                <div className="text-white/50 text-sm mt-1">Estimated Hours</div>
              </div>
            </div>

            {/* Product Summary */}
            <div className="border border-white/10 p-6">
              <h3 className="font-semibold mb-4">Product: {request.title}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/50">Type:</span>
                  <span className="ml-2">{productDefinition.product_type.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-white/50">Timeline:</span>
                  <span className="ml-2">{productDefinition.estimated_timeline}</span>
                </div>
              </div>
              <p className="mt-4 text-white/70">{productDefinition.goal}</p>
            </div>

            {/* Scope Items Summary */}
            <div className="border border-white/10 p-6">
              <h3 className="font-semibold mb-4">Scope Breakdown</h3>
              <div className="space-y-3">
                {scopeItems.map((item) => {
                  const units = workUnits[item.temp_id] || [];
                  return (
                    <div key={item.temp_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <span className="font-medium">{item.title}</span>
                        <span className="text-white/40 text-sm ml-2">({units.length} units)</span>
                      </div>
                      <span className="text-white/50">{item.estimated_hours}h</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 border border-white/20 hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleLaunch}
                disabled={submitting || scopeItems.length === 0}
                className="bg-emerald-500 text-white px-8 py-3 font-medium flex items-center gap-2 hover:bg-emerald-600 disabled:opacity-50 transition-all"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Launch Project
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ScopeBuilder;
