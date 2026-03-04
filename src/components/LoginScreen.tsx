import React, { useState } from 'react';
import { Shield, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();

  const loginErrorMessage = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'invalid_credentials' || msg === 'login_failed') return 'שם משתמש או סיסמה שגויים';
    if (msg === 'too_many_login_attempts') return 'יותר מדי ניסיונות התחברות. נא לנסות שוב בעוד 15 דקות.';
    if (msg === 'server_error') return 'שגיאת שרת. נא לנסות שוב מאוחר יותר.';
    if (msg === 'invalid_body') return 'נא למלא שם משתמש וסיסמה.';
    if (msg) return msg;
    return 'שגיאה בהתחברות';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      console.error(err);
      setError(loginErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-pearl flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white p-8 rounded-card shadow-card-xl w-full max-w-md border border-pearl">
        <div className="text-center mb-8">
          <div className="bg-navy w-16 h-16 rounded-lg mx-auto flex items-center justify-center mb-4 text-gold shadow-card-xl">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-navy serif">LexMedical</h1>
          <p className="text-slate mt-2">מרכז ידע משרדי - Lp-Law</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
             <label className="block text-sm font-bold text-slate mb-1">שם משתמש / ID</label>
             <div className="relative">
               <User className="w-5 h-5 absolute top-2.5 right-3 text-slate-light" />
               <input type="text" className="w-full p-2 pr-10 border border-pearl rounded focus:ring-2 focus:ring-gold outline-none" placeholder="הזן שם משתמש..." value={username} onChange={(e) => setUsername(e.target.value)} />
             </div>
          </div>
          <div>
             <label className="block text-sm font-bold text-slate mb-1">סיסמה</label>
             <div className="relative">
               <Lock className="w-5 h-5 absolute top-2.5 right-3 text-slate-light" />
               <input type="password" className="w-full p-2 pr-10 border border-pearl rounded focus:ring-2 focus:ring-gold outline-none" placeholder="הזן סיסמה..." value={password} onChange={(e) => setPassword(e.target.value)} />
             </div>
          </div>
          {error && (
            <div id="login-error" className="text-danger text-sm text-center font-bold" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn-primary w-full justify-center py-3 font-bold shadow-card-xl disabled:opacity-50"
            disabled={loading}
            aria-describedby={error ? 'login-error' : undefined}
          >
            {loading ? 'מתחבר...' : 'כניסה למערכת'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;