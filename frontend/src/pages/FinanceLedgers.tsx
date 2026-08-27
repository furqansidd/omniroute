import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { DollarSign, BookOpen, RefreshCw, Plus, ArrowUpRight, ArrowDownLeft, Wallet, UserCheck, Building2, CreditCard, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Dialog } from '../components/ui/Dialog';

interface OverviewData {
  totalReceivables: number;
  totalVendorPayables: number;
  totalRiderCashHeld: number;
  adminCashBalance: number;
  netProfit: number;
}

interface RiderHolding {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  deliveryCount: number;
  totalCollected: number;
  totalHandedOver: number;
  netCashHeld: number;
}

interface VendorItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  balancePayable: number;
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
  rider?: { name: string };
}

export const FinanceLedgers: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('riders');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [riderHoldings, setRiderHoldings] = useState<RiderHolding[]>([]);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [pnl, setPnl] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // General Voucher modal state
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherType, setVoucherType] = useState<'receipt' | 'payment'>('receipt');
  const [amount, setAmount] = useState(5000);
  const [category, setCategory] = useState('customer_collection');
  const [notes, setNotes] = useState('');
  const [selectedRiderIdForVoucher, setSelectedRiderIdForVoucher] = useState('');
  const [selectedVendorIdForVoucher, setSelectedVendorIdForVoucher] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rider Handover modal state
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [selectedRider, setSelectedRider] = useState<RiderHolding | null>(null);
  const [handoverAmount, setHandoverAmount] = useState(0);
  const [handoverNotes, setHandoverNotes] = useState('');

  // Vendor Payment modal state
  const [showPayVendorModal, setShowPayVendorModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [payVendorAmount, setPayVendorAmount] = useState(0);
  const [payVendorMethod, setPayVendorMethod] = useState('cash');
  const [payVendorNotes, setPayVendorNotes] = useState('');

  // Party Statement Ledger modal state
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerTitle, setLedgerTitle] = useState('');
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchFinancials = async () => {
    setIsLoading(true);
    try {
      const [oRes, vRes, rRes, pRes, vendRes] = await Promise.all([
        apiRequest<OverviewData>('/finance/overview'),
        apiRequest<any>('/finance/vouchers'),
        apiRequest<any>('/finance/rider-holdings'),
        apiRequest<any>('/finance/pnl'),
        apiRequest<VendorItem[]>('/purchase/vendors')
      ]);

      if (oRes.success && oRes.data) setOverview(oRes.data);
      if (vRes.success && vRes.data) setVouchers(Array.isArray(vRes.data) ? vRes.data : []);
      if (rRes.success && rRes.data) setRiderHoldings(rRes.data.riders || []);
      if (pRes.success && pRes.data) setPnl(pRes.data);
      if (vendRes.success && vendRes.data) setVendors(Array.isArray(vendRes.data) ? vendRes.data : []);
    } catch (err) {
      console.error('Failed to fetch financial reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const openRiderLedger = async (rider: RiderHolding) => {
    setLedgerTitle(`Rider Statement Ledger: ${rider.name}`);
    setLedgerData(null);
    setShowLedgerModal(true);
    setLoadingLedger(true);
    try {
      const res = await apiRequest<any>(`/finance/rider-ledger/${rider.id}`);
      if (res.success && res.data) {
        setLedgerData(res.data);
      } else {
        alert(res.error || 'Failed to load rider statement');
      }
    } catch (e: any) {
      alert(`Error loading rider statement: ${e.message}`);
    } finally {
      setLoadingLedger(false);
    }
  };

  const openVendorLedger = async (vendor: VendorItem) => {
    setLedgerTitle(`Vendor Statement Ledger ($ Udhaar): ${vendor.name}`);
    setLedgerData(null);
    setShowLedgerModal(true);
    setLoadingLedger(true);
    try {
      const res = await apiRequest<any>(`/finance/vendor-ledger/${vendor.id}`);
      if (res.success && res.data) {
        setLedgerData(res.data);
      } else {
        alert(res.error || 'Failed to load vendor statement');
      }
    } catch (e: any) {
      alert(`Error loading vendor statement: ${e.message}`);
    } finally {
      setLoadingLedger(false);
    }
  };

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
          riderId: category === 'rider_collection_handover' ? selectedRiderIdForVoucher : undefined,
          vendorId: category === 'supplier_payment' ? selectedVendorIdForVoucher : undefined,
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

  const handleOpenHandover = (rider: RiderHolding) => {
    setSelectedRider(rider);
    setHandoverAmount(rider.netCashHeld);
    setHandoverNotes(`Evening collection handover from ${rider.name}`);
    setShowHandoverModal(true);
  };

  const handleSettleHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRider || !handoverAmount || handoverAmount <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/finance/rider-handover', {
        method: 'POST',
        body: JSON.stringify({
          riderId: selectedRider.id,
          amount: Number(handoverAmount),
          paymentMethod: 'cash',
          notes: handoverNotes
        })
      });

      if (res.success) {
        setShowHandoverModal(false);
        setSelectedRider(null);
        fetchFinancials();
        alert(`Successfully received Rs. ${handoverAmount.toLocaleString()} cash handover from rider ${selectedRider.name}!`);
      } else {
        alert(res.error || 'Failed to record rider handover');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPayVendor = (vendor: VendorItem) => {
    setSelectedVendor(vendor);
    setPayVendorAmount(vendor.balancePayable);
    setPayVendorNotes(`Payment to supplier ${vendor.name}`);
    setShowPayVendorModal(true);
  };

  const handleSettlePayVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !payVendorAmount || payVendorAmount <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/finance/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          voucherType: 'payment',
          category: 'supplier_payment',
          vendorId: selectedVendor.id,
          amount: Number(payVendorAmount),
          paymentMethod: payVendorMethod,
          notes: payVendorNotes
        })
      });

      if (res.success) {
        setShowPayVendorModal(false);
        setSelectedVendor(null);
        fetchFinancials();
        alert(`Successfully paid Rs. ${payVendorAmount.toLocaleString()} to ${selectedVendor.name}! Balance updated.`);
      } else {
        alert(res.error || 'Failed to process vendor payment');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Finance & General Ledger Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rider Cash Wallets, Admin Handover Settlements, Supplier Payables ($ Udhaar), and Profit & Loss.
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
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <Card className="border-slate-200 bg-emerald-50/40">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-bold text-emerald-800 uppercase">ADMIN CASH & BANK</div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">
              Rs. {(overview?.adminCashBalance ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-bold text-amber-800 uppercase">RIDERS CASH WALLETS</div>
            <div className="text-xl font-extrabold text-amber-700 mt-1">
              Rs. {(overview?.totalRiderCashHeld ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase">CUSTOMER RECEIVABLES</div>
            <div className="text-xl font-extrabold text-brand-600 mt-1">
              Rs. {(overview?.totalReceivables ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/30">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-bold text-rose-800 uppercase">VENDOR PAYABLES ($ UDHAAR)</div>
            <div className="text-xl font-extrabold text-rose-600 mt-1">
              Rs. {(overview?.totalVendorPayables ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase">NET PROFIT / INCOME</div>
            <div className={`text-xl font-extrabold mt-1 ${(overview?.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Rs. {(overview?.netProfit ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="riders">
            <Wallet size={14} className="mr-1.5" /> Rider Cash Wallets
          </TabsTrigger>
          <TabsTrigger value="vendors">
            <Building2 size={14} className="mr-1.5" /> Vendor Payables ($ Udhaar)
          </TabsTrigger>
          <TabsTrigger value="overview">Payment & Receipt Vouchers</TabsTrigger>
          <TabsTrigger value="pnl">Profit & Loss Statement</TabsTrigger>
        </TabsList>

        {/* RIDER CASH WALLETS TAB */}
        <TabsContent value="riders" className="pt-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <UserCheck size={16} className="text-amber-600" />
                Rider Cash Collections & Admin Handover Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RIDER NAME</TableHead>
                    <TableHead>CONTACT PHONE</TableHead>
                    <TableHead>DELIVERIES DONE</TableHead>
                    <TableHead>TOTAL CASH COLLECTED</TableHead>
                    <TableHead>HANDED OVER TO ADMIN</TableHead>
                    <TableHead>NET CASH HELD (WALLET)</TableHead>
                    <TableHead className="text-right">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riderHoldings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                        No active riders or cash collections found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    riderHoldings.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold text-slate-900">{r.name}</TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">{r.phone || 'N/A'}</TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700">{r.deliveryCount} Deliveries</TableCell>
                        <TableCell className="font-bold text-slate-800">Rs. {r.totalCollected.toLocaleString()}</TableCell>
                        <TableCell className="font-bold text-emerald-600">Rs. {r.totalHandedOver.toLocaleString()}</TableCell>
                        <TableCell className="font-extrabold text-amber-700 text-sm">
                          Rs. {r.netCashHeld.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs py-1 font-semibold"
                            onClick={() => openRiderLedger(r)}
                          >
                            <FileText size={14} className="mr-1" /> View Statement
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 font-semibold"
                            onClick={() => handleOpenHandover(r)}
                          >
                            <DollarSign size={14} className="mr-1" /> Collect Cash
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENDOR PAYABLES TAB */}
        <TabsContent value="vendors" className="pt-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Building2 size={16} className="text-rose-600" />
                Vendor & Supplier Payables Directory ($ Udhaar Ledger)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>VENDOR / SUPPLIER NAME</TableHead>
                    <TableHead>CONTACT PHONE</TableHead>
                    <TableHead>ADDRESS</TableHead>
                    <TableHead>OUTSTANDING BALANCE ($ UDHAAR)</TableHead>
                    <TableHead className="text-right">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                        No vendors found in directory.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendors.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-bold text-slate-900">{v.name}</TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">{v.phone || 'N/A'}</TableCell>
                        <TableCell className="text-xs text-slate-500">{v.address || 'N/A'}</TableCell>
                        <TableCell className="font-extrabold text-rose-600 text-sm">
                          Rs. {v.balancePayable.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs py-1 font-semibold"
                            onClick={() => openVendorLedger(v)}
                          >
                            <FileText size={14} className="mr-1" /> View Statement
                          </Button>
                          <Button
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs py-1 font-semibold"
                            onClick={() => handleOpenPayVendor(v)}
                          >
                            <CreditCard size={14} className="mr-1" /> Pay Vendor / Settle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VOUCHERS TAB */}
        <TabsContent value="overview" className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VOUCHER #</TableHead>
                <TableHead>TYPE & CATEGORY</TableHead>
                <TableHead>PARTY (CUSTOMER / VENDOR / RIDER)</TableHead>
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
                      {v.customer?.name || v.vendor?.name || v.rider?.name || 'General Account'}
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

      {/* PARTY STATEMENT LEDGER MODAL */}
      <Dialog isOpen={showLedgerModal} onClose={() => setShowLedgerModal(false)} title={ledgerTitle} maxWidth="lg">
        {loadingLedger ? (
          <div className="text-center py-8 text-slate-500">Loading statement transactions...</div>
        ) : !ledgerData ? (
          <div className="text-center py-8 text-slate-500">No ledger statement data found.</div>
        ) : (
          <div className="space-y-4">
            {/* Header summary info */}
            <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <div>
                <div className="font-bold text-sm text-brand-400">
                  {ledgerData.rider?.name || ledgerData.vendor?.name}
                </div>
                <div className="text-slate-400 font-mono mt-0.5">
                  Phone: {ledgerData.rider?.phone || ledgerData.vendor?.phone || 'N/A'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Net Running Balance</div>
                <div className="text-lg font-black text-emerald-400">
                  Rs. {(ledgerData.netCashHeld ?? ledgerData.balancePayable ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Statement Transactions Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-bold">DATE</TableHead>
                    <TableHead className="text-xs font-bold">TYPE</TableHead>
                    <TableHead className="text-xs font-bold">REF #</TableHead>
                    <TableHead className="text-xs font-bold">DESCRIPTION</TableHead>
                    <TableHead className="text-xs font-bold text-right">DEBIT (+)</TableHead>
                    <TableHead className="text-xs font-bold text-right">CREDIT (-)</TableHead>
                    <TableHead className="text-xs font-bold text-right">BALANCE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!ledgerData.transactions || ledgerData.transactions.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-xs text-slate-400">
                        No financial statement transactions recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerData.transactions.map((tx: any, idx: number) => (
                      <TableRow key={idx} className="hover:bg-slate-50 text-xs">
                        <TableCell className="text-slate-500 font-mono">
                          {new Date(tx.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {tx.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-brand-600 font-bold">
                          {tx.reference}
                        </TableCell>
                        <TableCell className="text-slate-700">{tx.description}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          {tx.debit > 0 ? `Rs. ${tx.debit.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-rose-600">
                          {tx.credit > 0 ? `Rs. ${tx.credit.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-black text-slate-900">
                          Rs. {tx.balance.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowLedgerModal(false)}>
                Close Statement
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* RIDER CASH HANDOVER MODAL */}
      <Dialog isOpen={showHandoverModal} onClose={() => setShowHandoverModal(false)} title={`Receive Cash Handover from ${selectedRider?.name || 'Rider'}`} maxWidth="md">
        <form onSubmit={handleSettleHandover} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900 space-y-1">
            <div className="font-bold text-amber-950">Rider Wallet Summary:</div>
            <div>Total Cash Collected from Route: <strong>Rs. {selectedRider?.totalCollected.toLocaleString()}</strong></div>
            <div>Already Handed Over to Admin: <strong>Rs. {selectedRider?.totalHandedOver.toLocaleString()}</strong></div>
            <div className="text-sm font-extrabold text-amber-700 pt-1">Current Cash Held in Rider Pocket: Rs. {selectedRider?.netCashHeld.toLocaleString()}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Cash Amount Handed Over (Rs.) *</label>
            <input
              type="number"
              required
              min={1}
              max={selectedRider?.netCashHeld || 999999}
              value={handoverAmount}
              onChange={(e) => setHandoverAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1 font-extrabold text-slate-900"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Notes & Reference</label>
            <input
              type="text"
              placeholder="e.g. Evening delivery collection handover"
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowHandoverModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Confirm Cash Received
            </Button>
          </div>
        </form>
      </Dialog>

      {/* PAY VENDOR MODAL */}
      <Dialog isOpen={showPayVendorModal} onClose={() => setShowPayVendorModal(false)} title={`Pay Supplier / Vendor: ${selectedVendor?.name || 'Vendor'}`} maxWidth="md">
        <form onSubmit={handleSettlePayVendor} className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-900 space-y-1">
            <div className="font-bold text-rose-950">Supplier Account Summary:</div>
            <div>Vendor Name: <strong>{selectedVendor?.name}</strong></div>
            <div className="text-sm font-extrabold text-rose-700 pt-1">Current Outstanding Balance ($ Udhaar): Rs. {selectedVendor?.balancePayable.toLocaleString()}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Payment Amount (Rs.) *</label>
            <input
              type="number"
              required
              min={1}
              max={selectedVendor?.balancePayable || 999999}
              value={payVendorAmount}
              onChange={(e) => setPayVendorAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1 font-extrabold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Payment Method *</label>
              <select
                value={payVendorMethod}
                onChange={(e) => setPayVendorMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Cheque</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Notes & Reference</label>
              <input
                type="text"
                placeholder="e.g. Cheque #44091 or Bank Ref"
                value={payVendorNotes}
                onChange={(e) => setPayVendorNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowPayVendorModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-rose-600 hover:bg-rose-700 text-white">
              Confirm Payment to Vendor
            </Button>
          </div>
        </form>
      </Dialog>

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
                <option value="rider_collection_handover">Rider Collection Handover</option>
                <option value="fuel_expense">Fuel / Transport Expense</option>
                <option value="rider_payout">Rider Payout / Salary</option>
                <option value="other">Other Operating Expense</option>
              </select>
            </div>
          </div>

          {category === 'rider_collection_handover' && (
            <div>
              <label className="text-xs font-semibold text-slate-700">Select Rider *</label>
              <select
                required
                value={selectedRiderIdForVoucher}
                onChange={(e) => setSelectedRiderIdForVoucher(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1 font-semibold text-slate-900"
              >
                <option value="">-- Choose Rider --</option>
                {riderHoldings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Wallet Cash Held: Rs. {r.netCashHeld.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'supplier_payment' && (
            <div>
              <label className="text-xs font-semibold text-slate-700">Select Vendor / Supplier *</label>
              <select
                required
                value={selectedVendorIdForVoucher}
                onChange={(e) => setSelectedVendorIdForVoucher(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md mt-1 font-semibold text-slate-900"
              >
                <option value="">-- Choose Supplier --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (Udhaar Balance: Rs. {v.balancePayable.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              placeholder="e.g. Paid Hah Packaging House via Bank Transfer"
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
