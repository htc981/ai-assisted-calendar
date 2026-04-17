import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';
import Login from './pages/Login';
import Calendar from './pages/Calendar';
import toast from 'react-hot-toast';

function App() {
  const { isAuthenticated, isInitialized, logout } = useAuthStore();
  const navigate = useNavigate();

  // Listen for auth expiration events
  useEffect(() => {
    const handleAuthExpired = () => {
      toast.error('Session expired. Please login again.');
      logout();
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [logout, navigate]);

  // Update page title when expired
  useEffect(() => {
    if (!isAuthenticated) {
      document.title = 'Login - AI-Assisted Calendar';
    } else {
      document.title = 'Calendar - AI-Assisted Calendar';
    }
  }, [isAuthenticated]);

  // Don't render until auth state is determined
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" /> : <Login />}
      />
      <Route
        path="/"
        element={isAuthenticated ? <Calendar /> : <Navigate to="/login" />}
      />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
