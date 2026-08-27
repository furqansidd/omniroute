import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { UserX, AlertTriangle, Send, RefreshCw, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';

interface ChurnRiskCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  lastOrderDate: string | null;
  daysInactive: number;
  churnRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface RadarResponse {
  thresholdDays: number;
  totalSleepingCount: number;
  sleepingCustomers: ChurnRiskCustomer[];
}

export const SleepingCustomerRadar: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<RadarResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingWinback, setIsSendingWinback] = useState(false);

  const fetchRadar = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<RadarResponse>('/sleeping/radar');
      if (res.success && res.data) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch sleeping customer radar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRadar();
  }, []);

  const handleTriggerWinback = async (customerId?: string) => {
    setIsSendingWinback(true);
    try {
      const res = await apiRequest('/sleeping/trigger-winback', {
        method: 'POST',
        body: JSON.stringify({ customerId })
      });
      if (res.success) {
        alert('Win-back notification campaign dispatched successfully!');
        fetchRadar();
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSendingWinback(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sleeping Customer Churn Radar</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated inactivity detection tailored by industry vertical (Milk 7d, Water 14d, LPG/Oil 30d).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchRadar} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh Radar
          </Button>
          <Button size="sm" onClick={() => handleTriggerWinback()} isLoading={isSendingWinback}>
            <Send size={14} /> Dispatch Bulk Win-Back Offer
          </Button>
        </div>
      </div>

      {/* CHURN RISK STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-red-600 uppercase">Critical Churn Risk (&gt;45 days)</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {data?.sleepingCustomers.filter(c => c.churnRisk === 'CRITICAL').length || 0}
              </div>
            </div>
            <ShieldAlert size={28} className="text-red-500" />
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-600 uppercase">High Risk (30-45 days)</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {data?.sleepingCustomers.filter(c => c.churnRisk === 'HIGH').length || 0}
              </div>
            </div>
            <AlertTriangle size={28} className="text-amber-500" />
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-blue-600 uppercase">Medium Risk (14-30 days)</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {data?.sleepingCustomers.filter(c => c.churnRisk === 'MEDIUM').length || 0}
              </div>
            </div>
            <Clock size={28} className="text-blue-500" />
          </CardContent>
        </Card>
      </div>

      {/* SLEEPING CUSTOMERS TABLE */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CUSTOMER NAME</TableHead>
            <TableHead>PHONE NUMBER</TableHead>
            <TableHead>LAST ORDER DATE</TableHead>
            <TableHead>DAYS INACTIVE</TableHead>
            <TableHead>CHURN RISK SCORE</TableHead>
            <TableHead className="text-right">WIN-BACK ACTION</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.sleepingCustomers.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-bold text-slate-900">{c.name}</TableCell>
              <TableCell className="text-xs text-slate-600 font-medium">{c.phone}</TableCell>
              <TableCell className="text-xs text-slate-500">
                {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : 'Never Ordered'}
              </TableCell>
              <TableCell className="text-xs font-bold text-slate-800">{c.daysInactive} days</TableCell>
              <TableCell>
                <Badge variant={c.churnRisk === 'CRITICAL' ? 'rose' : c.churnRisk === 'HIGH' ? 'amber' : 'blue'}>
                  {c.churnRisk}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => handleTriggerWinback(c.id)}>
                  <Send size={12} /> Send Offer
                </Button>
              </TableCell>
            </TableRow>
          ))}

          {data?.sleepingCustomers.length === 0 && !isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400">
                No inactive or sleeping customers detected. Customer retention is healthy!
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
