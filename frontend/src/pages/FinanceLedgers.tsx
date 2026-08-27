import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { DollarSign, BookOpen, RefreshCw, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Dialog } from '../components/ui/Dialog';

interface OverviewData {
  totalReceivables: number;
  totalVendorPayables: number;
  cashBalance: number;
  netProfit: number;
}

interface VoucherItem {
  id: string;
  voucherNumber: string;
  voucherType: string;
  category: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
  customer?: { name: string };
  vendor?: { name: string };
}

export const FinanceLedgers: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [pnl, setPnl] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Voucher modal state
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherType, setVoucherType] = useState<'receipt' | 'payment'>('receipt');
  const [amount, setAmount] = useState(5000);
  const [category, setCategory] = useState('customer_collection');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFinancials = async () => {
    setIsLoading(true);
    try {
      const [oRes, vRes, pRes] = await Promise.all([
        apiRequest<OverviewData>('/finance/overview'),
        apiRequest<any>('/finance/vouchers'),
        apiRequest<any>('/finance/pnl')
      ]);
      if (oRes.success && oRes.data) setOverview(oRes.data);
      if (vRes.success && vRes.data) setVouchers(Array.isArray(vRes.data) ? vRes.data : []);
      if (pRes.success && pRes.data) setPnl(pRes.data);
    } catch (err) {
      console.error('Failed to fetch financial reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/finance/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          voucherType,
          category,
          amount: Number(amount),
          notes
        })
      });

      if (res.success) {
        setShowVoucherModal(false);
        setNotes('');
        fetchFinancials();
        alert('Voucher posted & double-entry journal entry recorded!');
      } else {
        alert(res.error || 'Failed to post voucher');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Finance & General Ledger Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Financial Overview, Profit & Loss Statement, Vendor Payables ($ Udhaar), and Payment/Receipt Vouchers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchFinancials} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh Statements
          </Button>
          <Button size="sm" onClick={() => setShowVoucherModal(true)}>
            <Plus size={16} /> Post Voucher
          </Button>
        </div>
      </div>

      {/* OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">NET CASH BALANCE</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              Rs. {(overview?.cashBalance ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">CUSTOMER RECEIVABLES</div>
            <div className="text-2xl font-extrabold text-brand-600 mt-1">
              Rs. {(overview?.totalReceivables ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">VENDOR PAYABLES ($ UDHAAR)</div>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">
              Rs. {(overview?.totalVendorPayables ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase">NET PROFIT / INCOME</div>
            <div className={`text-2xl font-extrabold mt-1 ${(overview?.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Rs. {(overview?.netProfit ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Payment & Receipt Vouchers</TabsTrigger>
          <TabsTrigger value="pnl">Profit & Loss Statement</TabsTrigger>
        </TabsList>

        {/* VOUCHERS TAB */}
        <TabsContent value="overview" className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VOUCHER #</TableHead>
                <TableHead>TYPE & CATEGORY</TableHead>
                <TableHead>PARTY (CUSTOMER / VENDOR)</TableHead>
                <TableHead>AMOUNT</TableHead>
                <TableHead>PAYMENT METHOD</TableHead>
                <TableHead>DATE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                    No payment/receipt vouchers posted yet.
                  </TableCell>
                </TableRow>
              ) : (
                vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-bold text-brand-600 font-mono">{v.voucherNumber}</TableCell>
                    <TableCell className="text-xs font-semibold uppercase text-slate-700">
                      {v.voucherType === 'receipt' ? (
                        <span className="text-emerald-600 flex items-center gap-1"><ArrowDownLeft size={14} /> Receipt ({v.category})</span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-1"><ArrowUpRight size={14} /> Payment ({v.category})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-900">
                      {v.customer?.name || v.vendor?.name || 'General Account'}
                    </TableCell>
                    <TableCell className={`font-extrabold ${v.voucherType === 'receipt' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      Rs. {v.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs uppercase font-semibold text-slate-600">{v.paymentMethod}</TableCell>
                    <TableCell className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* P&L TAB */}
        <TabsContent value="pnl" className="pt-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Real-Time Profit & Loss Statement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between font-bold text-slate-900 text-base">
                <span>Gross Sales Revenue</span>
                <span>Rs. {(pnl?.revenue?.grossSales ?? 0).toLocaleString()}</span>
              </div>

              <div className="border-t border-slate-200 pt-2 space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>Operating Expenses</span>
                  <span className="text-rose-600">- Rs. {(pnl?.operatingExpenses?.total ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wastage & Spoilage Cost</span>
                  <span className="text-rose-600">- Rs. {(pnl?.wastageCost ?? 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between font-extrabold text-lg text-slate-900 border-t-2 border-slate-300 pt-3">
                <span>NET OPERATING PROFIT</span>
                <span className={(pnl?.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  Rs. {(pnl?.netProfit ?? 0).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* POST VOUCHER MODAL */}
      <Dialog isOpen={showVoucherModal} onClose={() => setShowVoucherModal(false)} title="Post Financial Payment/Receipt Voucher" maxWidth="md">
        <form onSubmit={handleCreateVoucher} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Voucher Type *</label>
              <select
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1"
              >
                <option value="receipt">Receipt Voucher (Income / Collection)</option>
                <option value="payment">Payment Voucher (Payout / Expense)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1"
              >
                <option value="customer_collection">Customer Collection</option>
                <option value="supplier_payment">Supplier / Vendor Payment</option>
                <option value="fuel_expense">Fuel / Transport Expense</option>
                <option value="rider_payout">Rider Payout / Salary</option>
                <option value="other">Other Operating Expense</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Voucher Amount (Rs.) *</label>
            <input
              type="number"
              required
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1 font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Notes & Reference</label>
            <input
              type="text"
              placeholder="e.g. Paid Ahmed Dairy Farm via Bank Transfer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowVoucherModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Post Voucher</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
