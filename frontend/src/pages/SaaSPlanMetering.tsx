import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Zap, CreditCard, Users, ShoppingCart, Truck, CheckCircle2, AlertTriangle, Building2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';

interface SubscriptionPaymentItem {
  id: string;
  tenantId: string;
  amount: number;
  planTier: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  notes: string | null;
}

interface MeteringData {
  tenantId: string;
  companyName: string;
  subscriptionTier: string;
  tierName: string;
  priceMonthly: number;
  financials?: {
    totalBilled: number;
    totalPaid: number;
    remainingBalance: number;
    paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  };
  paymentHistory?: SubscriptionPaymentItem[];
  usage: {
    customers: { current: number; limit: number; pct: number };
    orders: { current: number; limit: number; pct: number };
    riders: { current: number; limit: number; pct: number };
  };
  quotaWarning: string | null;
}

interface PlatformOverviewData {
  totalSubscribers: number;
  totalMRR: number;
  tenantMeterings: MeteringData[];
}

export const SaaSPlanMetering: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.name === 'Super Admin' || user?.email === 'superadmin@tarsil.com';
  const [metering, setMetering] = useState<MeteringData | null>(null);
  const [platformOverview, setPlatformOverview] = useState<PlatformOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingTier, setIsUpdatingTier] = useState(false);

  const fetchMeteringData = async () => {
    setIsLoading(true);
    try {
      const mRes = await apiRequest<MeteringData>('/saas/metering');
      if (mRes.success && mRes.data) setMetering(mRes.data);

      if (isSuperAdmin) {
        const pRes = await apiRequest<PlatformOverviewData>('/saas/platform-overview');
        if (pRes.success && pRes.data) setPlatformOverview(pRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch SaaS metering data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeteringData();
  }, []);

  const handleSwitchTier = async (newTier: string) => {
    if (metering?.subscriptionTier === newTier) return;
    if (!confirm(`Are you sure you want to switch subscription tier to ${newTier.toUpperCase()}?`)) return;

    setIsUpdatingTier(true);
    try {
      const res = await apiRequest<MeteringData>('/saas/tier', {
        method: 'PUT',
        body: JSON.stringify({ tier: newTier })
      });

      if (res.success && res.data) {
        setMetering(res.data);
        fetchMeteringData();
      } else {
        alert(`Failed to switch tier: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error updating tier: ${err.message}`);
    } finally {
      setIsUpdatingTier(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">SaaS Subscription & Resource Quota Metering</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor active plan pricing, payment status, remaining balances, and resource quota usage.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMeteringData} isLoading={isLoading}>
          <RefreshCw size={14} /> Refresh Metering
        </Button>
      </div>

      {/* SUBSCRIPTION FINANCIAL SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Plan & Billed Amount */}
        <Card className="border-brand-200 bg-brand-50/40 shadow-sm">
          <CardContent className="p-4 flex flex-col justify-between h-full space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="blue">{metering?.subscriptionTier.toUpperCase() || 'STARTER'} PLAN</Badge>
              <CreditCard size={18} className="text-brand-600" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Monthly Plan Cost</div>
              <div className="text-2xl font-extrabold text-slate-900">
                ${metering?.priceMonthly || 49} <span className="text-xs font-normal text-slate-500">/ mo</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Auto-renewing monthly subscription</div>
          </CardContent>
        </Card>

        {/* Total Paid Amount */}
        <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Total Paid</span>
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700">
              ${metering?.financials?.totalPaid || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Verified subscription payments
            </div>
          </CardContent>
        </Card>

        {/* Remaining Pending Amount */}
        <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Remaining Due</span>
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-amber-700">
              ${metering?.financials?.remainingBalance ?? metering?.priceMonthly ?? 49}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Pending payment balance
            </div>
          </CardContent>
        </Card>

        {/* Payment Status Badge */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2 flex flex-col justify-between h-full">
            <div className="text-xs font-bold text-slate-500 uppercase">Payment Status</div>
            <div>
              {metering?.financials?.paymentStatus === 'PAID' ? (
                <Badge variant="emerald" className="text-sm px-3 py-1 font-bold">PAID IN FULL</Badge>
              ) : metering?.financials?.paymentStatus === 'PARTIAL' ? (
                <Badge variant="amber" className="text-sm px-3 py-1 font-bold">PARTIAL PAYMENT</Badge>
              ) : (
                <Badge variant="rose" className="text-sm px-3 py-1 font-bold">PAYMENT PENDING</Badge>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {metering?.financials?.paymentStatus === 'PAID' ? 'No balance due' : 'Pay to keep tier active'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RESOURCE USAGE METERS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Customer Usage Meter */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Active Customers</span>
              <Users size={16} className="text-blue-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {metering?.usage.customers.current || 0} / {metering?.usage.customers.limit === 999999 ? '∞' : metering?.usage.customers.limit}
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-brand-600 h-full transition-all" style={{ width: `${metering?.usage.customers.pct || 0}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Orders Usage Meter */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Monthly Orders</span>
              <ShoppingCart size={16} className="text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {metering?.usage.orders.current || 0} / {metering?.usage.orders.limit === 999999 ? '∞' : metering?.usage.orders.limit}
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full transition-all" style={{ width: `${metering?.usage.orders.pct || 0}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Riders Usage Meter */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Rider Accounts</span>
              <Truck size={16} className="text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {metering?.usage.riders.current || 0} / {metering?.usage.riders.limit === 999999 ? '∞' : metering?.usage.riders.limit}
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full transition-all" style={{ width: `${metering?.usage.riders.pct || 0}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PAYMENT RECEIPTS & TRANSACTIONS HISTORY TABLE */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <CreditCard size={16} className="text-brand-600" /> Subscription Payment Receipts & Ledger History
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DATE</TableHead>
              <TableHead>PLAN TIER</TableHead>
              <TableHead>PAYMENT METHOD</TableHead>
              <TableHead>REF / TRANSACTION #</TableHead>
              <TableHead>AMOUNT PAID</TableHead>
              <TableHead>STATUS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!metering?.paymentHistory || metering.paymentHistory.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                  No subscription payment receipts recorded yet. Contact Super Admin to log payments.
                </TableCell>
              </TableRow>
            ) : (
              metering.paymentHistory.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-semibold text-slate-900">
                    {new Date(p.paymentDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell><Badge variant="blue">{p.planTier.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-xs text-slate-600 uppercase font-medium">{p.paymentMethod.replace('_', ' ')}</TableCell>
                  <TableCell className="text-xs text-slate-500 font-mono">{p.referenceNumber || 'N/A'}</TableCell>
                  <TableCell className="font-bold text-emerald-600">${p.amount}</TableCell>
                  <TableCell><Badge variant="emerald">{p.status.toUpperCase()}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* SUBSCRIPTION PLAN TIERS COMPARISON GRID */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Available Subscription Plan Tiers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Starter Card */}
          <Card className={`border ${metering?.subscriptionTier === 'starter' ? 'border-brand-600 ring-2 ring-brand-500/20' : 'border-slate-200'}`}>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="font-bold text-base text-slate-900">Starter Plan</div>
                <div className="text-xs text-slate-500">Perfect for small local suppliers</div>
                <div className="text-2xl font-extrabold text-brand-600 mt-2">$49 <span className="text-xs font-normal text-slate-500">/mo</span></div>
              </div>
              <Button
                disabled={metering?.subscriptionTier === 'starter' || isUpdatingTier}
                variant={metering?.subscriptionTier === 'starter' ? 'secondary' : 'primary'}
                className="w-full"
                onClick={() => handleSwitchTier('starter')}
              >
                {metering?.subscriptionTier === 'starter' ? 'Active Tier' : 'Switch to Starter'}
              </Button>
            </CardContent>
          </Card>

          {/* Professional Card */}
          <Card className={`border ${metering?.subscriptionTier === 'professional' ? 'border-brand-600 ring-2 ring-brand-500/20 bg-brand-50/10' : 'border-slate-200'}`}>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-base text-slate-900">Professional Plan</div>
                  <Badge variant="emerald">POPULAR</Badge>
                </div>
                <div className="text-xs text-slate-500">For growing multi-depot fleet operations</div>
                <div className="text-2xl font-extrabold text-brand-600 mt-2">$149 <span className="text-xs font-normal text-slate-500">/mo</span></div>
              </div>
              <Button
                disabled={metering?.subscriptionTier === 'professional' || isUpdatingTier}
                variant={metering?.subscriptionTier === 'professional' ? 'secondary' : 'primary'}
                className="w-full"
                onClick={() => handleSwitchTier('professional')}
              >
                {metering?.subscriptionTier === 'professional' ? 'Active Tier' : 'Upgrade to Professional'}
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Card */}
          <Card className={`border ${metering?.subscriptionTier === 'enterprise' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200'}`}>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="font-bold text-base text-slate-900">Enterprise Plan</div>
                <div className="text-xs text-slate-500">Unlimited power for enterprise distributors</div>
                <div className="text-2xl font-extrabold text-amber-600 mt-2">$399 <span className="text-xs font-normal text-slate-500">/mo</span></div>
              </div>
              <Button
                disabled={metering?.subscriptionTier === 'enterprise' || isUpdatingTier}
                variant={metering?.subscriptionTier === 'enterprise' ? 'secondary' : 'primary'}
                className="w-full"
                onClick={() => handleSwitchTier('enterprise')}
              >
                {metering?.subscriptionTier === 'enterprise' ? 'Active Tier' : 'Upgrade to Enterprise'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PLATFORM OPERATOR OVERVIEW TABLE (SUPER ADMIN ONLY) */}
      {isSuperAdmin && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 size={16} className="text-brand-600" /> Platform Operator Subscribing Tenants ({platformOverview?.totalSubscribers || 0})
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SUBSCRIBING TENANT</TableHead>
                <TableHead>TIER</TableHead>
                <TableHead>ACTIVE CUSTOMERS</TableHead>
                <TableHead>MONTHLY ORDERS</TableHead>
                <TableHead>RIDER ACCOUNTS</TableHead>
                <TableHead>MONTHLY REVENUE (MRR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platformOverview?.tenantMeterings.map((t) => (
                <TableRow key={t.tenantId}>
                  <TableCell className="font-bold text-slate-900">{t.companyName}</TableCell>
                  <TableCell><Badge variant="blue">{t.subscriptionTier.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-xs text-slate-600">{t.usage.customers.current} / {t.usage.customers.limit === 999999 ? '∞' : t.usage.customers.limit}</TableCell>
                  <TableCell className="text-xs text-slate-600">{t.usage.orders.current} / {t.usage.orders.limit === 999999 ? '∞' : t.usage.orders.limit}</TableCell>
                  <TableCell className="text-xs text-slate-600">{t.usage.riders.current} / {t.usage.riders.limit === 999999 ? '∞' : t.usage.riders.limit}</TableCell>
                  <TableCell className="font-bold text-emerald-600">${t.priceMonthly} / mo</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
