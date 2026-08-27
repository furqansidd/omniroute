import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import {
  ShieldCheck, Users, CreditCard, DollarSign, Building2,
  TrendingUp, Layers, CheckCircle2, AlertTriangle, XCircle,
  Plus, Search, Filter, RefreshCw, ChevronRight, FileText,
  Calendar, Check, Zap, Eye, Power, AlertOctagon, UserCheck, UserX, Clock
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

interface SuperAdminStats {
  totalTenants: number;
  activeTenants: number;
  pendingApprovalTenants?: number;
  suspendedTenants: number;
  cancelledTenants: number;
  totalRevenue: number;
  totalMRR: number;
  tierBreakdown: Array<{ tier: string; count: number }>;
  industryBreakdown: Array<{ industry: string; count: number }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    planTier: string;
    paymentDate: string;
    paymentMethod: string;
    referenceNumber: string;
    tenant: { companyName: string; subscriptionTier: string };
  }>;
}

interface BusinessOwner {
  id: string;
  companyName: string;
  industryType: string;
  subscriptionTier: string;
  city: string;
  status: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  totalCustomers: number;
  totalOrders: number;
  totalStaff: number;
  totalPaidRevenue: number;
}

interface SubscriptionPayment {
  id: string;
  tenantId: string;
  amount: number;
  planTier: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  notes?: string;
  tenant: {
    companyName: string;
    industryType: string;
    subscriptionTier: string;
  };
}

export const SuperAdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [owners, setOwners] = useState<BusinessOwner[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'owners' | 'payments' | 'tiers'>('overview');

  // Filters for Business Owners
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<BusinessOwner | null>(null);

  // Form inputs
  const [paymentForm, setPaymentForm] = useState({
    tenantId: '',
    amount: '149',
    planTier: 'professional',
    paymentMethod: 'bank_transfer',
    referenceNumber: '',
    notes: ''
  });

  const [newStatus, setNewStatus] = useState('active');
  const [newTier, setNewTier] = useState('professional');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, ownersRes, paymentsRes] = await Promise.all([
        apiRequest<SuperAdminStats>('/superadmin/stats'),
        apiRequest<BusinessOwner[]>(`/superadmin/owners?search=${encodeURIComponent(searchQuery)}&industry=${industryFilter}&tier=${tierFilter}&status=${statusFilter}`),
        apiRequest<SubscriptionPayment[]>('/superadmin/payments')
      ]);

      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (ownersRes.success && ownersRes.data) setOwners(ownersRes.data);
      if (paymentsRes.success && paymentsRes.data) setPayments(paymentsRes.data);
    } catch (err) {
      console.error('Failed to load Super Admin dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [searchQuery, industryFilter, tierFilter, statusFilter]);

  const pendingOwners = owners.filter(o => o.status === 'pending_approval');

  const openApprovalModalForOwner = (owner: BusinessOwner) => {
    const prices: Record<string, string> = { starter: '49', professional: '149', enterprise: '399' };
    const tierKey = (owner.subscriptionTier || 'professional').toLowerCase();
    setPaymentForm({
      tenantId: owner.id,
      amount: prices[tierKey] || '149',
      planTier: tierKey,
      paymentMethod: 'bank_transfer',
      referenceNumber: `SUB-PAY-${Date.now().toString().slice(-6)}`,
      notes: `Subscription payment for ${owner.companyName} (${tierKey.toUpperCase()} Plan)`
    });
    setIsRecordPaymentModalOpen(true);
  };

  const handleRejectOwner = async (owner: BusinessOwner) => {
    if (!confirm(`Are you sure you want to decline onboarding request for ${owner.companyName}?`)) return;
    try {
      const res = await apiRequest(`/superadmin/owners/${owner.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Registration declined by Super Admin' })
      });
      if (res.success) {
        fetchDashboardData();
      } else {
        alert(`Failed to reject request: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.tenantId || !paymentForm.amount) {
      alert('Please select a business owner and specify the payment amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/superadmin/payments', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: paymentForm.tenantId,
          amount: parseFloat(paymentForm.amount),
          planTier: paymentForm.planTier,
          paymentMethod: paymentForm.paymentMethod,
          referenceNumber: paymentForm.referenceNumber,
          notes: paymentForm.notes
        })
      });

      if (res.success) {
        setIsRecordPaymentModalOpen(false);
        setPaymentForm({
          tenantId: '',
          amount: '149',
          planTier: 'professional',
          paymentMethod: 'bank_transfer',
          referenceNumber: '',
          notes: ''
        });
        fetchDashboardData();
      } else {
        alert(`Failed to record payment: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error recording payment: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOwner) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/superadmin/owners/${selectedOwner.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });

      if (res.success) {
        setIsStatusModalOpen(false);
        setSelectedOwner(null);
        fetchDashboardData();
      } else {
        alert(`Failed to update status: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTier = async () => {
    if (!selectedOwner) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/superadmin/owners/${selectedOwner.id}/plan`, {
        method: 'PUT',
        body: JSON.stringify({ planTier: newTier })
      });

      if (res.success) {
        setIsTierModalOpen(false);
        setSelectedOwner(null);
        fetchDashboardData();
      } else {
        alert(`Failed to update plan: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* SUPER ADMIN BANNER HEADER */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="bg-brand-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              SUPER ADMIN PORTAL
            </span>
            <span className="text-xs text-slate-400 font-mono">Isolated Control Panel</span>
          </div>
          <h1 className="text-2xl font-black mt-2 tracking-tight text-white flex items-center gap-2">
            <ShieldCheck size={28} className="text-brand-400" /> Tarsil Platform Control Center
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Complete high-level oversight of all subscribing Business Owners, onboarding request queue, payment verification, and SaaS plan capacity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            isLoading={isLoading}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRecordPaymentModalOpen(true)}
            className="bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold"
          >
            <Plus size={16} className="mr-1" /> Log Subscription Payment
          </Button>
        </div>
      </div>

      {/* PENDING APPROVAL ALERT BANNER */}
      {pendingOwners.length > 0 && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-600 rounded-lg">
              <Clock size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <span>{pendingOwners.length} Pending Business Owner Application{pendingOwners.length > 1 ? 's' : ''}</span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                  Action Required
                </span>
              </h3>
              <p className="text-xs text-slate-600">
                New tenant onboarding registrations are waiting for plan payment verification & activation.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setActiveTab('pending')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0"
          >
            Review Requests ({pendingOwners.length}) <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {/* TOP PLATFORM METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Business Owners */}
        <Card className="border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Active Owners</span>
              <Building2 size={18} className="text-brand-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black text-slate-900">{stats?.activeTenants || 0}</div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {pendingOwners.length > 0 && (
                  <span className="text-amber-600 font-bold flex items-center">
                    ● {pendingOwners.length} Pending
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Total Subscription Revenue */}
        <Card className="border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Total Revenue Collected</span>
              <DollarSign size={18} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              ${stats?.totalRevenue.toLocaleString() || '0'}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Verified SaaS Subscription Payments
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Monthly Recurring Revenue (MRR) */}
        <Card className="border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Monthly Recurring Revenue</span>
              <TrendingUp size={18} className="text-blue-600" />
            </div>
            <div className="text-2xl font-black text-brand-700">
              ${stats?.totalMRR.toLocaleString() || '0'} <span className="text-xs font-normal text-slate-500">/ mo</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Active Tier Subscriptions Run-rate
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Vertical Distribution */}
        <Card className="border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Industry Verticals</span>
              <Layers size={18} className="text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {stats?.industryBreakdown.length || 0} Verticals
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              Water, Milk, LPG & Oil Supply
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SUPER ADMIN NAVIGATION TABS */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-brand-600 text-brand-600 font-bold bg-brand-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Platform Overview & Analytics
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'pending'
              ? 'border-amber-600 text-amber-700 font-bold bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Pending Onboarding Requests</span>
          {pendingOwners.length > 0 && (
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
              {pendingOwners.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('owners')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'owners'
              ? 'border-brand-600 text-brand-600 font-bold bg-brand-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Business Owners Directory ({owners.filter(o => o.status !== 'pending_approval').length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'payments'
              ? 'border-brand-600 text-brand-600 font-bold bg-brand-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Subscription Payments Ledger ({payments.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subscription Tier Breakdown */}
            <Card className="border-slate-200">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>Subscription Tier Distribution</span>
                  <Zap size={16} className="text-brand-600" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {['starter', 'professional', 'enterprise'].map((tierKey) => {
                  const item = stats?.tierBreakdown.find((t) => t.tier.toLowerCase() === tierKey);
                  const count = item ? item.count : 0;
                  const price = tierKey === 'starter' ? '$49/mo' : tierKey === 'professional' ? '$149/mo' : '$399/mo';
                  return (
                    <div key={tierKey} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <div className="font-bold text-xs text-slate-900 uppercase">{tierKey} PLAN</div>
                        <div className="text-[11px] text-slate-500 font-medium">{price} base subscription</div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900">{count} Owners</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Industry Verticals Breakdown */}
            <Card className="border-slate-200">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>Industry Vertical Active Workspaces</span>
                  <Layers size={16} className="text-blue-600" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {['water', 'milk', 'lpg', 'oil', 'multi'].map((indKey) => {
                  const item = stats?.industryBreakdown.find((i) => i.industry.toLowerCase() === indKey);
                  const count = item ? item.count : 0;
                  const labels: Record<string, string> = {
                    water: 'Water Bottling & Container Sweep',
                    milk: 'Fresh Milk Crates Distribution',
                    lpg: 'LPG Gas Cylinder Distribution',
                    oil: 'Lubricant & Industrial Oil Drums',
                    multi: 'Multi-Industry Delivery Operations'
                  };
                  return (
                    <div key={indKey} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <div className="font-bold text-xs text-slate-900 uppercase">{indKey} SUPPLIERS</div>
                        <div className="text-[11px] text-slate-500 font-medium">{labels[indKey]}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900">{count} Active</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING REQUESTS QUEUE */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pending Business Owner Onboarding Requests</h2>
              <p className="text-xs text-slate-500">Review new owner registrations, verify plan fees, and activate tenant accounts</p>
            </div>
          </div>

          {pendingOwners.length === 0 ? (
            <Card className="border-slate-200 text-center py-12">
              <CardContent className="space-y-3">
                <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                <h3 className="font-bold text-slate-900">No Pending Requests</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  All business owner onboarding requests have been reviewed, verified, and activated.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingOwners.map((owner) => {
                const tierKey = (owner.subscriptionTier || 'professional').toLowerCase();
                const prices: Record<string, string> = { starter: '$49/mo', professional: '$149/mo', enterprise: '$399/mo' };
                return (
                  <Card key={owner.id} className="border-amber-200 bg-amber-50/20 shadow-xs">
                    <CardContent className="p-5 flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-slate-900">{owner.companyName}</h3>
                          <Badge variant="amber">PENDING APPROVAL</Badge>
                          <span className="text-[11px] font-black uppercase text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            {tierKey} Plan ({prices[tierKey] || '$149/mo'})
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
                          <span>Owner: <strong className="text-slate-900">{owner.ownerName}</strong></span>
                          <span>Email: <strong className="text-slate-900">{owner.ownerEmail}</strong></span>
                          <span>Phone: <strong className="text-slate-900">{owner.ownerPhone}</strong></span>
                          <span>City: <strong className="text-slate-900">{owner.city || 'Metropolis'}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Registered On: {new Date(owner.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectOwner(owner)}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <UserX size={14} className="mr-1" /> Reject Request
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openApprovalModalForOwner(owner)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                        >
                          <UserCheck size={14} className="mr-1" /> Accept & Record Payment
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BUSINESS OWNERS DIRECTORY */}
      {activeTab === 'owners' && (
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search company, owner name, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={industryFilter}
                  onChange={(e) => setIndustryFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg text-xs p-1.5 bg-white font-medium"
                >
                  <option value="all">All Verticals</option>
                  <option value="water">Water</option>
                  <option value="milk">Milk</option>
                  <option value="lpg">LPG Gas</option>
                  <option value="oil">Oil</option>
                </select>

                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg text-xs p-1.5 bg-white font-medium"
                >
                  <option value="all">All Tiers</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-bold">Company / Business</TableHead>
                    <TableHead className="text-xs font-bold">Owner Admin</TableHead>
                    <TableHead className="text-xs font-bold">Plan Tier</TableHead>
                    <TableHead className="text-xs font-bold">Status</TableHead>
                    <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {owners.filter(o => o.status !== 'pending_approval').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-xs text-slate-500">
                        No active business owner accounts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    owners.filter(o => o.status !== 'pending_approval').map((owner) => (
                      <TableRow key={owner.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="font-bold text-slate-900 text-xs">{owner.companyName}</div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {owner.city || 'Metropolis'} • {owner.industryType.toUpperCase()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-800 text-xs">{owner.ownerName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{owner.ownerEmail}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="blue">{owner.subscriptionTier.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={owner.status === 'active' ? 'emerald' : 'rose'}>
                            {owner.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOwner(owner);
                              setNewStatus(owner.status);
                              setIsStatusModalOpen(true);
                            }}
                            className="text-xs py-1 px-2"
                          >
                            Status
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOwner(owner);
                              setNewTier(owner.subscriptionTier);
                              setIsTierModalOpen(true);
                            }}
                            className="text-xs py-1 px-2"
                          >
                            Plan Tier
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: PAYMENTS LEDGER */}
      {activeTab === 'payments' && (
        <Card className="border-slate-200">
          <CardHeader className="p-4 border-b border-slate-100 flex justify-between items-center">
            <CardTitle className="text-sm font-bold text-slate-900">Recorded Subscription Payments</CardTitle>
            <Button size="sm" onClick={() => setIsRecordPaymentModalOpen(true)}>
              <Plus size={14} className="mr-1" /> Log Payment
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-bold">Company / Owner</TableHead>
                  <TableHead className="text-xs font-bold">Plan Tier</TableHead>
                  <TableHead className="text-xs font-bold">Amount</TableHead>
                  <TableHead className="text-xs font-bold">Payment Method</TableHead>
                  <TableHead className="text-xs font-bold">Reference #</TableHead>
                  <TableHead className="text-xs font-bold">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                      No subscription payments logged yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50">
                      <TableCell className="font-bold text-slate-900 text-xs">
                        {p.tenant?.companyName || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="blue">{(p.planTier || 'STARTER').toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="font-black text-emerald-600 text-xs">
                        ${p.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 capitalize font-medium">
                        {p.paymentMethod.replace('_', ' ')}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">
                        {p.referenceNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: LOG & VERIFY SUBSCRIPTION PAYMENT */}
      <Dialog
        isOpen={isRecordPaymentModalOpen}
        onClose={() => setIsRecordPaymentModalOpen(false)}
        title="Record Subscription Payment & Activate Tenant"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Business Owner / Tenant</label>
            <select
              value={paymentForm.tenantId}
              onChange={(e) => {
                const ownerId = e.target.value;
                const found = owners.find(o => o.id === ownerId);
                const prices: Record<string, string> = { starter: '49', professional: '149', enterprise: '399' };
                setPaymentForm({
                  ...paymentForm,
                  tenantId: ownerId,
                  planTier: found ? found.subscriptionTier : paymentForm.planTier,
                  amount: found ? (prices[found.subscriptionTier.toLowerCase()] || '149') : paymentForm.amount
                });
              }}
              required
              className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-900 outline-none"
            >
              <option value="">-- Select Business Owner --</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.companyName} ({o.ownerName} - {o.subscriptionTier.toUpperCase()} Plan - Status: {o.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount Paid ($)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                required
                className="w-full border border-slate-300 rounded-md p-2 text-slate-900 outline-none font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Subscription Plan Tier</label>
              <select
                value={paymentForm.planTier}
                onChange={(e) => setPaymentForm({ ...paymentForm, planTier: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-900 outline-none"
              >
                <option value="starter">Starter ($49/mo)</option>
                <option value="professional">Professional ($149/mo)</option>
                <option value="enterprise">Enterprise ($399/mo)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-900 outline-none"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card / Online</option>
                <option value="cash">Cash Collection</option>
                <option value="easypaisa_jazzcash">EasyPaisa / JazzCash</option>
                <option value="check">Bank Check</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Reference / Txn #</label>
              <input
                type="text"
                placeholder="e.g. TXN-998822"
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 text-slate-900 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes / Description</label>
            <input
              type="text"
              placeholder="e.g. Initial plan payment & onboarding activation"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              className="w-full border border-slate-300 rounded-md p-2 text-slate-900 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsRecordPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              Confirm Payment & Activate Tenant
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 2: CHANGE STATUS */}
      <Dialog
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`Update Status: ${selectedOwner?.companyName}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Changing the business owner status affects their operational access to the Tarsil SaaS platform.
          </p>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Access Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-900 outline-none"
            >
              <option value="active">Active (Full Access Enabled)</option>
              <option value="pending_approval">Pending Approval (Restricted Access)</option>
              <option value="suspended">Suspended (Access Restricted)</option>
              <option value="cancelled">Cancelled (Account Terminated)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdateStatus} isLoading={isSubmitting}>
              Save Status Update
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: CHANGE PLAN TIER */}
      <Dialog
        isOpen={isTierModalOpen}
        onClose={() => setIsTierModalOpen(false)}
        title={`Change Subscription Plan: ${selectedOwner?.companyName}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Select the subscription plan tier for this business owner. Quota capacities will adjust automatically.
          </p>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Subscription Plan Tier</label>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-900 outline-none"
            >
              <option value="starter">Starter Plan ($49/mo)</option>
              <option value="professional">Professional Plan ($149/mo)</option>
              <option value="enterprise">Enterprise Plan ($399/mo)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsTierModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdateTier} isLoading={isSubmitting}>
              Apply Plan Upgrade
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
