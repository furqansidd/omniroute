import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { DollarSign, FileText, Plus, RefreshCw, CreditCard } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  customer: { name: string; phone: string };
}

export const BillingInvoices: React.FC = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<InvoiceItem[]>('/billing/invoices');
      if (res.success && res.data) setInvoices(res.data);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !paymentAmount) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/billing/invoices/${selectedInvoice.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'paid',
          paidAmount: Number(paymentAmount)
        })
      });

      if (res.success) {
        setShowPaymentModal(false);
        fetchInvoices();
      } else {
        alert(`Error recording payment: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Auto & Recurring Billing Invoices</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customer billing statements, track payment collections, and issue invoice receipts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInvoices} isLoading={isLoading}>
          <RefreshCw size={14} /> Refresh Invoices
        </Button>
      </div>

      {/* INVOICES TABLE */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>INVOICE #</TableHead>
            <TableHead>CUSTOMER</TableHead>
            <TableHead>ISSUE DATE</TableHead>
            <TableHead>DUE DATE</TableHead>
            <TableHead>TOTAL AMOUNT</TableHead>
            <TableHead>PAID AMOUNT</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead className="text-right">ACTION</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-bold font-mono text-brand-600">{inv.invoiceNumber}</TableCell>
              <TableCell>
                <div className="font-bold text-slate-900">{inv.customer.name}</div>
                <div className="text-xs text-slate-500">{inv.customer.phone}</div>
              </TableCell>
              <TableCell className="text-xs text-slate-500">{new Date(inv.issueDate).toLocaleDateString()}</TableCell>
              <TableCell className="text-xs text-slate-500">{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
              <TableCell className="font-extrabold text-slate-900">${Number(inv.totalAmount || 0).toFixed(2)}</TableCell>
              <TableCell className="font-bold text-emerald-600">${Number(inv.paidAmount || 0).toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant={inv.status === 'paid' ? 'emerald' : inv.status === 'partial' ? 'amber' : 'rose'}>
                  {inv.status.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {inv.status !== 'paid' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setPaymentAmount(inv.totalAmount - inv.paidAmount);
                      setShowPaymentModal(true);
                    }}
                  >
                    <CreditCard size={14} /> Record Payment
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* RECORD PAYMENT MODAL */}
      <Dialog
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Invoice Payment"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Input
            label="Invoice Number"
            disabled
            value={selectedInvoice?.invoiceNumber || ''}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Payment Amount ($)"
              type="number"
              required
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
            />
            <div>
              <label className="text-xs font-semibold text-slate-700">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 mt-1"
              >
                <option value="cash">Cash Collection</option>
                <option value="bank_transfer">Bank Wire Transfer</option>
                <option value="check">Check Deposit</option>
                <option value="card">Credit / Debit Card</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Confirm Payment Entry
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
