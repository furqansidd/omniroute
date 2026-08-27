import React, { useState } from 'react';
import { apiRequest } from '../api/client';
import { Building2, CheckCircle2, ArrowRight, ArrowLeft, Droplets, Milk, Flame, Fuel, ShieldCheck, Zap, Star, Crown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';

interface Props {
  onComplete: () => void;
}

export const TenantOnboarding: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [industryType, setIndustryType] = useState('water');
  const [subscriptionTier, setSubscriptionTier] = useState<'starter' | 'professional' | 'enterprise'>('professional');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('Admin@123456');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const verticals = [
    { id: 'water', name: 'Water Bottling Supplier', desc: '19L reverse osmosis bottles & container deposits', icon: Droplets, color: 'text-blue-600' },
    { id: 'milk', name: 'Fresh Milk Supplier', desc: 'Daily/alternate fresh milk crates & churn sweeps', icon: Milk, color: 'text-emerald-600' },
    { id: 'lpg', name: 'LPG Gas Distributor', desc: 'Commercial & residential gas cylinders', icon: Flame, color: 'text-amber-600' },
    { id: 'oil', name: 'Lubricant & Oil Supplier', desc: 'Industrial oil drums & packaged lubricants', icon: Fuel, color: 'text-rose-600' },
  ];

  const plans = [
    {
      id: 'starter',
      name: 'Starter Plan',
      price: '$49',
      period: '/month',
      icon: Zap,
      color: 'text-blue-600',
      badge: 'Small Business',
      features: ['1 Central Depot Warehouse', 'Up to 5 Delivery Riders', '500 Orders / Month', 'Standard Receipt Printing', 'Email Support']
    },
    {
      id: 'professional',
      name: 'Professional Plan',
      price: '$149',
      period: '/month',
      icon: Star,
      color: 'text-brand-600',
      popular: true,
      badge: 'Most Popular',
      features: ['3 Regional Depots', 'Up to 25 Delivery Riders', '5,000 Orders / Month', 'Double-Entry Ledgers & PnL', 'Thermal Receipt Studio', 'Priority Email & Chat']
    },
    {
      id: 'enterprise',
      name: 'Enterprise Plan',
      price: '$399',
      period: '/month',
      icon: Crown,
      color: 'text-amber-600',
      badge: 'Scale Unlimited',
      features: ['Unlimited Warehouses', 'Unlimited Riders & Orders', 'BI Executive Analytics', 'Geofenced GPS Radar', 'Dedicated SLA Account Manager']
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await apiRequest('/tenants/onboard', {
        method: 'POST',
        body: JSON.stringify({
          companyName,
          industryType,
          subscriptionTier,
          city,
          ownerName,
          ownerEmail,
          ownerPhone,
          ownerPassword
        })
      });

      if (res.success) {
        setStep(5);
      } else {
        setError(res.error || 'Onboarding failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Server error during onboarding.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Tenant Onboarding Wizard</h1>
          <p className="text-xs text-slate-500">Setup your physical delivery business & select your subscription plan tier</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between px-4 sm:px-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? 'bg-brand-600 text-white shadow-xs' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s}
              </div>
              <span className={`text-xs font-semibold hidden sm:inline ${step >= s ? 'text-slate-900' : 'text-slate-400'}`}>
                {s === 1 ? 'Industry' : s === 2 ? 'Select Plan' : s === 3 ? 'Company' : 'Owner Admin'}
              </span>
            </div>
          ))}
        </div>

        <Card className="border-slate-200 shadow-md">
          <CardContent className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            {/* Step 1: Industry Vertical */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">Select Your Business Industry Vertical</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {verticals.map((v) => {
                    const Icon = v.icon;
                    const isSelected = industryType === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setIndustryType(v.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mb-2 ${v.color}`} />
                        <div className="font-bold text-sm text-slate-900">{v.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{v.desc}</div>
                      </div>
                    );
                  })}
                </div>
                <Button onClick={() => setStep(2)} className="w-full mt-4">
                  Continue to Subscription Plan <ArrowRight size={16} />
                </Button>
              </div>
            )}

            {/* Step 2: Subscription Plan Tier Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Choose Your SaaS Subscription Plan</h2>
                  <p className="text-xs text-slate-500">Select the plan tier that matches your business capacity</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {plans.map((p) => {
                    const Icon = p.icon;
                    const isSelected = subscriptionTier === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSubscriptionTier(p.id as any)}
                        className={`relative p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/40 shadow-sm ring-2 ring-brand-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        {p.popular && (
                          <span className="absolute -top-2.5 right-3 bg-brand-600 text-white text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                            {p.badge}
                          </span>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Icon className={`w-6 h-6 ${p.color}`} />
                            {!p.popular && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {p.badge}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-slate-900">{p.name}</h3>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-900">{p.price}</span>
                            <span className="text-xs text-slate-500">{p.period}</span>
                          </div>
                          <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                            {p.features.map((feat, idx) => (
                              <li key={idx} className="text-xs text-slate-600 flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="w-1/2">
                    <ArrowLeft size={16} /> Back
                  </Button>
                  <Button onClick={() => setStep(3)} className="w-1/2">
                    Next: Company Info <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Company Details */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">Company & Regional Details</h2>
                <Input
                  label="Company / Business Name"
                  required
                  placeholder="e.g. Aquaflow Pure Water Co."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
                <Input
                  label="Primary Operating City"
                  required
                  placeholder="e.g. Metropolis"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Selected Plan Tier:</span>
                  <span className="font-extrabold uppercase tracking-wide text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                    {subscriptionTier} Plan
                  </span>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="w-1/2">
                    <ArrowLeft size={16} /> Back
                  </Button>
                  <Button onClick={() => setStep(4)} className="w-1/2">
                    Next: Owner Account <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Owner Admin Profile */}
            {step === 4 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">Tenant Owner Administrator Profile</h2>
                <Input
                  label="Owner Full Name"
                  required
                  placeholder="e.g. John Doe"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
                <Input
                  label="Owner Email Address"
                  type="email"
                  required
                  placeholder="john@aquaflow.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
                <Input
                  label="Owner Phone Number"
                  required
                  placeholder="+15550199"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                />
                <Input
                  label="Password"
                  type="password"
                  required
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(3)} className="w-1/2">
                    <ArrowLeft size={16} /> Back
                  </Button>
                  <Button type="submit" isLoading={isLoading} className="w-1/2">
                    Submit Registration <CheckCircle2 size={16} />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 5: Onboarded Confirmation Screen */}
            {step === 5 && (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Registration Submitted Successfully!</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Your tenant workspace for <span className="font-semibold text-slate-900">{companyName}</span> with the <span className="font-semibold uppercase text-brand-600">{subscriptionTier} plan</span> has been registered.
                </p>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 text-left max-w-md mx-auto space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <ShieldCheck size={14} className="text-blue-600" /> Super Admin Subscription Queue:
                  </div>
                  <div>Your onboarding request & plan selection is logged on the Super Admin Dashboard for instant payment recording & verification.</div>
                </div>
                <Button onClick={onComplete} className="w-full">
                  Proceed to Sign In <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
