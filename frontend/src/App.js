import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import axios from "axios";
import { createContext, useContext } from "react";

// Toast & Realtime
import { ToastProvider } from "@/components/Toast";
import { ExecutorRealtimeBridge, TesterRealtimeBridge, ClientRealtimeBridge, AdminRealtimeBridge } from "@/components/RealtimeBridge";

// Pages
import LandingPage from "@/pages/LandingPage";
import ClientAuthPage from "@/pages/ClientAuthPage";
import BuilderAuthPage from "@/pages/BuilderAuthPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import ClientDashboard from "@/pages/ClientDashboard";
import DeveloperDashboard from "@/pages/DeveloperDashboard";
import TesterDashboard from "@/pages/TesterDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import NewRequest from "@/pages/NewRequest";
import ProjectDetails from "@/pages/ProjectDetails";
import ScopeBuilder from "@/pages/ScopeBuilder";
import WorkUnitDetail from "@/pages/WorkUnitDetail";
import DeliverableBuilder from "@/pages/DeliverableBuilder";
import DeveloperWorkUnit from "@/pages/DeveloperWorkUnit";
import TesterValidation from "@/pages/TesterValidation";
import ClientDeliverable from "@/pages/ClientDeliverable";
import AdminDeliverableBuilder from "@/pages/AdminDeliverableBuilder";
import ClientDeliverablePage from "@/pages/ClientDeliverablePage";
import ClientVersionsPage from "@/pages/ClientVersionsPage";

// New Developer Workspace
import DeveloperLayout from "@/layouts/DeveloperLayout";
import DeveloperHub from "@/pages/DeveloperHub";
import DeveloperAssignments from "@/pages/DeveloperAssignments";
import DeveloperWorkPage from "@/pages/DeveloperWorkPage";
import DeveloperPerformance from "@/pages/DeveloperPerformance";
import ExecutorBoard from "@/pages/ExecutorBoard";

// New Tester Workspace
import TesterLayout from "@/layouts/TesterLayout";
import TesterHub from "@/pages/TesterHub";
import TesterValidationList from "@/pages/TesterValidationList";
import TesterValidationPage from "@/pages/TesterValidationPage";
import TesterIssues from "@/pages/TesterIssues";
import TesterPerformance from "@/pages/TesterPerformance";

// Admin Control Center
import AdminControlCenter from "@/pages/AdminControlCenter";

// Client Layout and Pages
import ClientLayout from "@/layouts/ClientLayout";
import ClientHub from "@/pages/ClientHub";
import ClientProjects from "@/pages/ClientProjects";
import ClientSupport from "@/pages/ClientSupport";
import ClientProjectPage from "@/pages/ClientProjectPage";

// Provider Marketplace
import ProviderInbox from "@/pages/ProviderInbox";
import ProviderAuth from "@/pages/ProviderAuth";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, 
      { email, password },
      { withCredentials: true }
    );
    setUser(response.data);
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Redirect to appropriate auth page based on path
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    } else if (location.pathname.startsWith('/developer') || location.pathname.startsWith('/tester')) {
      return <Navigate to="/builder/auth" state={{ from: location }} replace />;
    } else {
      return <Navigate to="/client/auth" state={{ from: location }} replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const dashboardRoutes = {
      client: '/client/dashboard',
      developer: '/developer/dashboard',
      tester: '/tester/dashboard',
      admin: '/admin/dashboard'
    };
    return <Navigate to={dashboardRoutes[user.role] || '/client/dashboard'} replace />;
  }

  return children;
};

function AppRouter() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Auth Routes - New Structure */}
      <Route path="/client/auth" element={<ClientAuthPage />} />
      <Route path="/builder/auth" element={<BuilderAuthPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      
      {/* Client Routes - New Layout */}
      <Route 
        path="/client" 
        element={
          <ProtectedRoute allowedRoles={['client', 'admin']}>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<ClientHub />} />
        <Route path="projects" element={<ClientProjects />} />
        <Route path="projects/:projectId" element={<ProjectDetails />} />
        <Route path="project/:projectId" element={<ClientProjectPage />} />
        <Route path="deliverables" element={<ClientHub />} />
        <Route path="deliverable/:deliverableId" element={<ClientDeliverablePage />} />
        <Route path="support" element={<ClientSupport />} />
        <Route path="request/new" element={<NewRequest />} />
        <Route path="project/:projectId/versions" element={<ClientVersionsPage />} />
        <Route index element={<Navigate to="/client/dashboard" replace />} />
      </Route>
      
      {/* Developer Routes - New Layout */}
      <Route 
        path="/developer" 
        element={
          <ProtectedRoute allowedRoles={['developer', 'admin']}>
            <DeveloperLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DeveloperHub />} />
        <Route path="board" element={<ExecutorBoard />} />
        <Route path="assignments" element={<DeveloperAssignments />} />
        <Route path="work/:unitId" element={<DeveloperWorkPage />} />
        <Route path="performance" element={<DeveloperPerformance />} />
        <Route index element={<Navigate to="/developer/dashboard" replace />} />
      </Route>
      
      {/* Tester Routes - New Layout */}
      <Route 
        path="/tester" 
        element={
          <ProtectedRoute allowedRoles={['tester', 'admin']}>
            <TesterLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<TesterHub />} />
        <Route path="validation" element={<TesterValidationList />} />
        <Route path="validation/:validationId" element={<TesterValidationPage />} />
        <Route path="issues" element={<TesterIssues />} />
        <Route path="performance" element={<TesterPerformance />} />
        <Route index element={<Navigate to="/tester/dashboard" replace />} />
      </Route>
      
      {/* Admin Routes */}
      <Route 
        path="/admin/control-center" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminControlCenter />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/scope-builder/:requestId" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ScopeBuilder />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/work-unit/:unitId" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <WorkUnitDetail />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/deliverable/:projectId" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DeliverableBuilder />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/deliverable-builder/:projectId" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDeliverableBuilder />
          </ProtectedRoute>
        } 
      />
      
      {/* Provider Marketplace Routes */}
      <Route 
        path="/provider/auth" 
        element={<ProviderAuth />} 
      />
      <Route 
        path="/provider/inbox" 
        element={<ProviderInbox />} 
      />
      <Route 
        path="/provider/job/:bookingId" 
        element={<ProviderInbox />} 
      />
      
      {/* Legacy redirects */}
      <Route path="/dashboard" element={<Navigate to="/client/dashboard" replace />} />
      <Route path="/developer/hub" element={<Navigate to="/developer/dashboard" replace />} />
      <Route path="/tester/hub" element={<Navigate to="/tester/dashboard" replace />} />
      <Route path="/admin/work-board" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/request/new" element={<Navigate to="/client/request/new" replace />} />
      <Route path="/auth/client" element={<Navigate to="/client/auth" replace />} />
      <Route path="/auth/builder" element={<Navigate to="/builder/auth" replace />} />
      <Route path="/projects/:projectId" element={<Navigate to="/client/projects/:projectId" replace />} />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
