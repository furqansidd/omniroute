import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import {
  DollarSign, Truck, Users, Droplets, ArrowUpRight,
  RefreshCw, CheckCircle2, Clock, MapPin, Activity, AlertTriangle, ShieldCheck, Zap, CreditCard
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

interface ExecutiveStats {
  monthlyRevenue: number;
  totalDeliveries: number;
  deliverySuccessRate: number;
  activeSubscribers: number;
  containerDepositLiability: number;
  breakageLossCost: number;
}

interface LiveRider {
  rider: { id: string; name: string; phone: string };
  isOnline: boolean;
  status: string;
  pendingDeliveriesCount: number;
  latestPing: { geoLat: number; geoLng: number; speed: number; batteryLevel: number; timestamp: string } | null;
}

interface EventLogItem {
  id: string;
  channel: string;
  recipientPhone: string;
  body: string;
  status: string;
  sentAt: string;
}

interface SaaSMetering {
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
  usage: {
    customers: { current: number; limit: number; pct: number };
    orders: { current: number; limit: number; pct: number };
    riders: { current: number; limit: number; pct: number };
  };
  quotaWarning: string | null;
}

export const DashboardHome: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ExecutiveStats | null>(null);
  const [liveRiders, setLiveRiders] = useState<LiveRider[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLogItem[]>([]);
  const [metering, setMetering] = useState<SaaSMetering | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, ridersRes, logsRes, saasRes] = await Promise.all([
        apiRequest<ExecutiveStats>('/reports/executive'),
        apiRequest<LiveRider[]>('/trackboard/live'),
        apiRequest<EventLogItem[]>('/notifications/logs'),
        apiRequest<SaaSMetering>('/saas/metering')
      ]);

      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (ridersRes.success && ridersRes.data) setLiveRiders(ridersRes.data);
      if (logsRes.success && Array.isArray(logsRes.data)) setEventLogs(logsRes.data.slice(0, 5));
      if (saasRes.success && saasRes.data) setMetering(saasRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Executive Operations Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-tenant delivery metrics, live rider fleet status, and container deposit liabilities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboardData} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh Metrics
          </Button>
          {onNavigate && (
            <Button size="sm" onClick={() => onNavigate('orders')}>
              + Book New Order
            </Button>
          )}
        </div>
      </div>

      {/* SAAS SUBSCRIPTION & PAYMENT OVERVIEW CARD */}
      <Card className="border-brand-200 bg-gradient-to-r from-brand-50/70 via-white to-slate-50 shadow-xs">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="blue" className="font-bold tracking-wide uppercase px-2.5 py-0.5">
                  <Zap size={12} className="mr-1 inline" />
                  {metering?.subscriptionTier ? `${metering.subscriptionTier.toUpperCase()} PLAN` : 'STARTER PLAN'}
                </Badge>

                {metering?.financials?.paymentStatus === 'PAID' ? (
                  <Badge variant="emerald" className="font-bold">
                    <CheckCircle2 size={12} className="mr-1 inline" /> PAID IN FULL
                  </Badge>
                ) : metering?.financials?.paymentStatus === 'PARTIAL' ? (
                  <Badge variant="amber" className="font-bold">
                    <AlertTriangle size={12} className="mr-1 inline" /> PARTIAL PAYMENT
                  </Badge>
                ) : (
                  <Badge variant="rose" className="font-bold">
                    <AlertTriangle size={12} className="mr-1 inline" /> PAYMENT PENDING
                  </Badge>
                )}
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard size={18} className="text-brand-600" />
                  SaaS Business Plan & Subscription Payment Status
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Active plan for <span className="font-semibold text-slate-700">{user?.tenant?.companyName || 'Your Business'}</span> • ${metering?.priceMonthly || 49}/month
                </p>
              </div>
            </div>

            {/* Middle Payment Breakdown */}
            <div className="flex items-center gap-6 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <div className="text-center px-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Monthly Cost</div>
                <div className="text-sm font-extrabold text-slate-900">${metering?.priceMonthly || 49}</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center px-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Paid</div>
                <div className="text-sm font-extrabold text-emerald-600">${metering?.financials?.totalPaid || 0}</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center px-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Remaining Due</div>
                <div className="text-sm font-extrabold text-amber-600">
                  ${metering?.financials?.remainingBalance ?? metering?.priceMonthly ?? 49}
                </div>
              </div>
            </div>

            {/* Right Action */}
            {onNavigate && (
              <Button
                variant="primary"
                size="sm"
                className="shrink-0"
                onClick={() => onNavigate('saas')}
              >
                Manage Plan & Receipts →
              </Button>
            )}
          </div>

          {/* Quota Progress Bar Row */}
          <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Customers Quota</span>
                <span>{metering?.usage.customers.current || 0} / {metering?.usage.customers.limit === 999999 ? '∞' : metering?.usage.customers.limit}</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-brand-600 h-full" style={{ width: `${metering?.usage.customers.pct || 0}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Monthly Orders</span>
                <span>{metering?.usage.orders.current || 0} / {metering?.usage.orders.limit === 999999 ? '∞' : metering?.usage.orders.limit}</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full" style={{ width: `${metering?.usage.orders.pct || 0}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Riders Fleet</span>
                <span>{metering?.usage.riders.current || 0} / {metering?.usage.riders.limit === 999999 ? '∞' : metering?.usage.riders.limit}</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: `${metering?.usage.riders.pct || 0}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI METRICS TOP FOCUS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Invoiced Revenue</span>
              <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900">
                ${stats?.monthlyRevenue ? stats.monthlyRevenue.toLocaleString() : '0'}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                <span className="font-semibold text-emerald-600 flex items-center">
                  <ArrowUpRight size={14} /> +12.4%
                </span>
                <span>vs last month</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Deliveries */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Deliveries</span>
              <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Truck size={18} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900">
                {stats?.totalDeliveries || 0}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                <Badge variant="emerald">{stats?.deliverySuccessRate || 100}% Completion</Badge>
                <span>Today's Runs</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Active Subscribers */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Customers</span>
              <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900">
                {stats?.activeSubscribers || 0}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Recurring Accounts</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Deposit Liabilities */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Container Deposits</span>
              <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
                <Droplets size={18} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900">
                ${stats?.containerDepositLiability ? stats.containerDepositLiability.toLocaleString() : '0'}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                <span>Security Deposit Cash Balance</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TWO COLUMN GRID: LIVE FLEET & RECENT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Rider Fleet Status */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  <Activity size={18} className="text-brand-600" />
                  Live Rider Fleet Status
                </CardTitle>
                <CardDescription>Active delivery riders on assigned route runs</CardDescription>
              </div>
              {onNavigate && (
                <Button variant="outline" size="sm" onClick={() => onNavigate('trackboard')}>
                  View Full Trackboard →
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {liveRiders.map((r) => (
                  <div key={r.rider.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${r.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                      <div>
                        <div className="text-sm font-bold text-slate-900">{r.rider.name}</div>
                        <div className="text-xs text-slate-500">{r.rider.phone}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-700">
                          {r.pendingDeliveriesCount} Pending Stops
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {r.latestPing ? `Speed: ${r.latestPing.speed} km/h • Bat: ${r.latestPing.batteryLevel}%` : 'No GPS Ping'}
                        </div>
                      </div>
                      <Badge variant={r.isOnline ? 'emerald' : 'slate'}>
                        {r.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </Badge>
                    </div>
                  </div>
                ))}

                {liveRiders.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No active rider pings recorded today.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Recent Operations Log */}
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>
                <Clock size={18} className="text-slate-600" />
                Operational Event Log
              </CardTitle>
              <CardDescription>Real-time delivery & dispatch events</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 space-y-4 text-xs">
                {eventLogs.length > 0 ? (
                  eventLogs.map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">Message Dispatched ({log.recipientPhone})</div>
                        <div className="text-slate-500 line-clamp-2">{log.body}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.channel.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs font-medium">
                    No operational event logs recorded yet. Real events will appear here automatically.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
