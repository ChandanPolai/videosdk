import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, PhoneCall } from 'lucide-react';
import Button from '../components/ui/Button';
import { isLoggedIn, login } from '../utils/auth';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = login(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-brand-50" />
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="absolute -bottom-28 -left-20 w-96 h-96 rounded-full bg-brand-600/10 blur-3xl" />

      <div className="relative w-full max-w-[420px]">
        <div className="bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-2xl shadow-[0_20px_50px_-20px_rgba(37,99,235,0.25)] p-7 sm:p-9">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/35 mb-4">
              <PhoneCall className="w-7 h-7" strokeWidth={2.2} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1.5">Sign in to continue to AI Calling</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
              <div className="flex items-center gap-0 rounded-[10px] border-[1.5px] border-slate-300 bg-white focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] transition-all overflow-hidden">
                <span className="pl-3.5 pr-2 text-slate-400 shrink-0 flex items-center">
                  <Mail className="w-[18px] h-[18px]" strokeWidth={2} />
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 pr-4 text-[15px] text-slate-800 bg-transparent outline-none border-0 placeholder:text-slate-400"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
              <div className="flex items-center gap-0 rounded-[10px] border-[1.5px] border-slate-300 bg-white focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] transition-all overflow-hidden">
                <span className="pl-3.5 pr-2 text-slate-400 shrink-0 flex items-center">
                  <Lock className="w-[18px] h-[18px]" strokeWidth={2} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 h-12 pr-2 text-[15px] text-slate-800 bg-transparent outline-none border-0 placeholder:text-slate-400"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="pr-3.5 pl-2 text-slate-400 hover:text-slate-600 shrink-0"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth disabled={loading} className="mt-2 h-12 text-[15px]">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
