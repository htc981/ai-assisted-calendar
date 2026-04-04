import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authAPI, usersAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();
  const { login, setUser } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: authAPI.login,
    onSuccess: async (data) => {
      // Clear old user data first
      localStorage.removeItem('user');
      login(data.access_token);

      // Fetch new user data
      try {
        const user = await usersAPI.getCurrentUser();
        setUser(user);
      } catch (e) {
        // User will be fetched by Calendar component
      }

      toast.success('Welcome back!');
      navigate('/');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message;
      if (error.response?.status === 401 || message?.includes('not found') || message?.includes('register')) {
        toast.error('Account not found. Please register first.');
      } else if (message) {
        toast.error(message);
      } else {
        toast.error('Login failed. Please check your credentials and try again.');
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: authAPI.register,
    onSuccess: async (user) => {
      toast.success('Account created successfully! Please login.');
      setIsRegistering(false);
      // Don't auto-login, let them login with credentials
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail;
      if (error.response?.status === 409 || message?.includes('already')) {
        toast.error('This email is already registered. Please login instead.');
      } else if (message) {
        toast.error(message);
      } else {
        toast.error('Registration failed. Please try again.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRegistering) {
      if (!name.trim()) {
        toast.error('Please enter your name');
        return;
      }
      registerMutation.mutate({ name, email });
    } else {
      loginMutation.mutate({ email, name: name || undefined });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            AI-Assisted Calendar
          </h1>
          <p className="text-gray-600 mt-2">
            {isRegistering ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name {isRegistering && <span className="text-red-500">*</span>}
            </label>
            <input
              id="name"
              type="text"
              required={isRegistering}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Your name"
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending || registerMutation.isPending}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loginMutation.isPending || registerMutation.isPending
              ? 'Loading...'
              : isRegistering
              ? 'Create Account'
              : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            {isRegistering
              ? 'Already have an account? Sign in'
              : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
