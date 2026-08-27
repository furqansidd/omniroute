import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { AlertOctagon, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

interface BreakageLogItem {
  id: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  liabilityType?: string;
  liabilitySplit?: string;
  notes: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  reportedBy: { name: string };
  responsibleRider: { name: string } | null;
}

export const BreakageWastageTracker: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<BreakageLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<BreakageLogItem[]>('/breakage/logs');
      if (res.success && res.data) setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch breakage logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Breakage & Spoilage Cost Tracker</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log damaged bottles, transit leaks, or spoiled crates. Automatically deducts inventory stock.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} isLoading={isLoading}>
          <RefreshCw size={14} /> Refresh Logs
        </Button>
      </div>

      {/* BREAKAGE LOGS TABLE */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PRODUCT</TableHead>
            <TableHead>DAMAGED QTY</TableHead>
            <TableHead>UNIT COST</TableHead>
            <TableHead>TOTAL LOSS COST</TableHead>
            <TableHead>REASON / REASON CODE</TableHead>
            <TableHead>LIABILITY SPLIT</TableHead>
            <TableHead>REPORTED BY</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-bold text-slate-900">{l.product.name}</TableCell>
              <TableCell className="font-mono font-bold text-red-600">-{l.qty} Units</TableCell>
              <TableCell className="text-xs text-slate-600">${l.unitCost.toFixed(2)}</TableCell>
              <TableCell className="font-extrabold text-red-600">${l.totalCost.toFixed(2)}</TableCell>
              <TableCell className="text-xs font-semibold text-slate-700 capitalize">{l.reason.replace(/_/g, ' ')}</TableCell>
              <TableCell>
                <Badge variant={(l.liabilityType || l.liabilitySplit) === 'rider' ? 'amber' : 'slate'}>
                  {((l.liabilityType || l.liabilitySplit) || 'company').toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-slate-600">{l.reportedBy.name}</TableCell>
            </TableRow>
          ))}

          {logs.length === 0 && !isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-10 text-xs text-slate-400">
                No breakage or spoilage losses logged.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
