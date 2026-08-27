import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';

interface Props {
  onStartOnboarding: () => void;
}

export const Login: React.FC<Props> = ({ onStartOnboarding }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('owner@aquaflow.com');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (email: string, pass: string = 'Admin@123456') => {
    setIdentifier(email);
    setPassword(pass);
    setIsLoading(true);
    try {
      await login(email, pass);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 text-white font-bold text-xl shadow-md">
            TR
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tarsil Operations SaaS</h1>
          <p className="text-sm text-slate-500">Multi-tenant recurring physical delivery management</p>
        </div>

        <Card className="border-slate-200 shadow-md">
          <CardHeader className="space-y-1">
            <CardTitle>Sign in to your workspace</CardTitle>
            <CardDescription>Enter your credentials for Business Owner or Super Admin Portal</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email or Phone Identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="superadmin@tarsil.com or owner@aquaflow.com"
              />

              <Input
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />

              <Button type="submit" isLoading={isLoading} className="w-full">
                Sign In <ArrowRight size={16} />
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
              <div className="text-xs text-slate-500 font-semibold text-center uppercase tracking-wider">
                Isolated Demo Accounts:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                  onClick={() => handleQuickLogin('superadmin@tarsil.com', 'SuperAdmin@123456')}
                >
                  <ShieldCheck size={14} className="mr-1 text-brand-400" /> Super Admin Portal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold"
                  onClick={() => handleQuickLogin('owner@aquaflow.com', 'Admin@123456')}
                >
                  <Building2 size={14} className="mr-1 text-brand-600" /> Business Owner View
                </Button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onStartOnboarding}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
                >
                  Need a new business owner tenant? Start Onboarding Wizard →
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-slate-400" />
          <span>Enterprise Multi-Tenant Security & Immutable Accounting</span>
        </div>
      </div>
    </div>
  );
};
