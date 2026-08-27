import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Printer, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';

interface PrinterSettings {
  receiptHeader: string | null;
  receiptFooter: string | null;
  supportPhone: string | null;
}

interface RenderReceiptResult {
  formattedText: string;
  escposBytesHex: string;
  byteCount: number;
}

export const ReceiptPrinterStudio: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [templateType, setTemplateType] = useState('delivery_receipt');
  const [receiptData, setReceiptData] = useState<RenderReceiptResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReceiptPreview = async () => {
    setIsLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([
        apiRequest<PrinterSettings>('/printer/settings'),
        apiRequest<RenderReceiptResult>('/printer/generate', {
          method: 'POST',
          body: JSON.stringify({ receiptType: templateType })
        })
      ]);

      if (sRes.success && sRes.data) setSettings(sRes.data);
      if (rRes.success && rRes.data) setReceiptData(rRes.data);
    } catch (err) {
      console.error('Failed to render receipt preview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceiptPreview();
  }, [templateType]);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bluetooth Thermal Receipt Studio (58mm ESC/POS)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            58mm thermal paper roll layout (32-column text formatting) & ESC/POS binary command stream generator.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReceiptPreview} isLoading={isLoading}>
          <RefreshCw size={14} /> Refresh Thermal Preview
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Template Selector & Thermal Paper Roll Simulator */}
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Select Thermal Paper Template</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500"
              >
                <option value="delivery_receipt">Delivery Completion Ticket (With Signature)</option>
                <option value="payment_voucher">Cash / Bank Payment Voucher</option>
                <option value="empties_receipt">Container Security Deposit Ticket</option>
              </select>
            </CardContent>
          </Card>

          {/* 58mm Thermal Paper Simulator Canvas */}
          <Card className="border-slate-300 bg-slate-100">
            <CardHeader className="bg-slate-200 border-b border-slate-300">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-700">58mm Thermal Paper Roll Canvas (32 Columns)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mx-auto max-w-[280px] bg-white p-4 font-mono text-[11px] leading-tight text-slate-900 shadow-md border border-slate-200 space-y-1">
                {receiptData?.formattedText.split('\n').map((line, i) => (
                  <div key={i} className="whitespace-pre">{line}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: ESC/POS Binary Byte Stream Inspector */}
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal size={18} className="text-brand-600" /> ESC/POS Command Byte Inspector
              </CardTitle>
              <CardDescription>Hexadecimal byte stream transmitted to Bluetooth SPP socket ({receiptData?.byteCount || 0} bytes)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-md max-h-64 overflow-y-auto leading-relaxed border border-slate-800 break-all">
                {receiptData?.escposBytesHex || '1b401b61011b4501...'}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
