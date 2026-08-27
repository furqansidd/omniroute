import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Droplets, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

interface EmptiesSummary {
  totalContainerLiability: number;
  totalDepositAmountHeld: number;
  containerReturnRate: number;
}

export const EmptiesDepositTracker: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<EmptiesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<EmptiesSummary>('/empties/summary');
      if (res.success && res.data) setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch empties summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Container Empties & Security Deposit Tracking</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor returnable bottle liabilities (19L bottles, LPG cylinders, milk crates) and security deposit balances.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSummary} isLoading={isLoading}>
          <RefreshCw size={14} /> Refresh Summary
        </Button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">CONTAINER LIABILITY (HELD BY CUSTOMERS)</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {summary?.totalContainerLiability || 0} Containers
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">DEPOSIT CASH HELD</div>
            <div className="text-2xl font-extrabold text-brand-600 mt-1">
              ${summary?.totalDepositAmountHeld ? summary.totalDepositAmountHeld.toLocaleString() : '0'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">CONTAINER RETURN RATE</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {summary?.containerReturnRate || 95}%
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
