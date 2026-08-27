import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { BarChart3, Download, RefreshCw, DollarSign, Truck, Users, Droplets } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

interface ExecutiveStats {
  monthlyRevenue: number;
  totalDeliveries: number;
  deliverySuccessRate: number;
  activeSubscribers: number;
  containerDepositLiability: number;
  breakageLossCost: number;
}

export const ReportsAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ExecutiveStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<ExecutiveStats>('/reports/executive');
      if (res.success && res.data) setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Metric,Value\n" +
      `Monthly Revenue,${stats?.monthlyRevenue || 0}\n` +
      `Total Deliveries,${stats?.totalDeliveries || 0}\n` +
      `Success Rate,${stats?.deliverySuccessRate || 100}%\n` +
      `Active Customers,${stats?.activeSubscribers || 0}\n` +
      `Deposit Liabilities,${stats?.containerDepositLiability || 0}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Tarsil_Executive_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Executive BI & Analytics Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Executive revenue analytics, inventory movement summaries, and rider performance leaderboards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh Data
          </Button>
          <Button size="sm" onClick={exportCSV}>
            <Download size={14} /> Export CSV Report
          </Button>
        </div>
      </div>

      {/* EXECUTIVE BI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">MONTHLY INVOICED REVENUE</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">${stats?.monthlyRevenue ? stats.monthlyRevenue.toLocaleString() : '0'}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">TOTAL DELIVERIES</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">{stats?.totalDeliveries || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">ACTIVE SUBSCRIBERS</div>
            <div className="text-2xl font-extrabold text-brand-600 mt-1">{stats?.activeSubscribers || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">DEPOSIT LIABILITIES</div>
            <div className="text-2xl font-extrabold text-purple-600 mt-1">${stats?.containerDepositLiability ? stats.containerDepositLiability.toLocaleString() : '0'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
