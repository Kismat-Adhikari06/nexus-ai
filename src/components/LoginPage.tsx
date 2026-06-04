import { useState } from 'react';
import { Bot, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { register, login } from '../services/apiClient';

interface LoginPageProps {
  onAuth: (user: { id: string; username: string }) => void;
}

export default function LoginPage({ onAuth }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = isRegister ? await register(username, password) : await login(username, password);
      onAuth(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-nexu-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-nexu-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-nexu-primary-dim/30 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-nexu-primary to-nexu-primary-hover flex items-center justify-center mx-auto mb-5 shadow-lg shadow-nexu-primary/20">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-nexu-text mb-1">Nexu</h1>
          <p className="text-sm text-nexu-text-dim">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-nexu-surface-2 border border-nexu-border rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-nexu-text-muted mb-1.5">Username</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-nexu-bg border border-nexu-border rounded-xl pl-3 pr-3 py-2.5 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 focus:ring-1 focus:ring-nexu-primary/30 transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-nexu-text-muted mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-nexu-bg border border-nexu-border rounded-xl pl-3 pr-11 py-2.5 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 focus:ring-1 focus:ring-nexu-primary/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-nexu-text-dim hover:text-nexu-text hover:bg-nexu-bg transition-colors cursor-pointer"
                  title={showPassword ? 'Hide' : 'Show'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-nexu-accent-red bg-nexu-accent-red/5 border border-nexu-accent-red/20 rounded-xl px-3 py-2.5">
                <span className="text-nexu-accent-red shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-nexu-primary to-nexu-primary-hover hover:brightness-110 disabled:from-nexu-border disabled:to-nexu-border disabled:text-nexu-text-muted text-white text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : isRegister ? (
                <><UserPlus size={16} /> Create Account</>
              ) : (
                <><LogIn size={16} /> Sign In</>
              )}
            </button>
          </form>
        </div>

        {/* Toggle */}
        <p className="text-center text-sm text-nexu-text-dim mt-6">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-nexu-primary-hover hover:text-nexu-primary font-medium transition-colors cursor-pointer"
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
