import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { DollarSign, BookOpen, PieChart, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';

interface PnLData {
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  spoilageLoss: number;
  netIncome: number;
}

interface BalanceSheetData {
  assets: { cash: number; accountsReceivable: number; totalAssets: number };
  liabilities: { containerDepositLiability: number; totalLiabilities: number };
  equity: { retainedEarnings: number; totalEquity: number };
}

export const FinanceLedgers: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pnl');
  const [pnl, setPnl] = useState<PnLData | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFinancials = async () => {
    setIsLoading(true);
    try {
      const [pRes, bRes] = await Promise.all([
        apiRequest<PnLData>('/finance/pnl'),
        apiRequest<BalanceSheetData>('/finance/balance-sheet')
      ]);
      if (pRes.success && pRes.data) setPnl(pRes.data);
      if (bRes.success && bRes.data) setBalanceSheet(bRes.data);
    } catch (err) {
      console.error('Failed to fetch financial reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Finance & Double-Entry Accounting Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable double-entry journal entries, real-time Profit & Loss statement, and Balance Sheet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFinancials} isLoading={isLoading}>
          <RefreshCw size={14} /> Refresh Statements
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pnl">Profit & Loss Statement</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
        </TabsList>

        {/* P&L STATEMENT */}
        <TabsContent value="pnl" className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-slate-500 uppercase">TOTAL OPERATING REVENUE</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  ${pnl?.totalRevenue ? pnl.totalRevenue.toLocaleString() : '0'}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-slate-500 uppercase">GROSS PROFIT</div>
                <div className="text-2xl font-extrabold text-brand-600 mt-1">
                  ${pnl?.grossProfit ? pnl.grossProfit.toLocaleString() : '0'}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-slate-500 uppercase">NET INCOME</div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                  ${pnl?.netIncome ? pnl.netIncome.toLocaleString() : '0'}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* BALANCE SHEET */}
        <TabsContent value="balance-sheet" className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>ASSETS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-700">
                  <span>Cash & Bank Balance</span>
                  <span className="font-bold">${(balanceSheet?.assets?.cash ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Accounts Receivable</span>
                  <span className="font-bold">${(balanceSheet?.assets?.accountsReceivable ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold pt-2 border-t border-slate-200">
                  <span>TOTAL ASSETS</span>
                  <span>${(balanceSheet?.assets?.totalAssets ?? 0).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>LIABILITIES & EQUITY</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-700">
                  <span>Container Deposit Liability</span>
                  <span className="font-bold">${(balanceSheet?.liabilities?.containerDepositLiability ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Retained Earnings</span>
                  <span className="font-bold">${(balanceSheet?.equity?.retainedEarnings ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold pt-2 border-t border-slate-200">
                  <span>TOTAL LIABILITIES & EQUITY</span>
                  <span>${((balanceSheet?.liabilities?.totalLiabilities ?? 0) + (balanceSheet?.equity?.totalEquity ?? 0)).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
