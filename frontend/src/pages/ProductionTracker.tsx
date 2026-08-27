import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Factory, Plus, RefreshCw, CheckCircle2, XCircle, Sliders } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

interface WarehouseItem { id: string; name: string; }
interface ProductItem { id: string; name: string; sku: string; }

interface ProductionBatchItem {
  id: string;
  batchNumber: string;
  industryType: string;
  inputQty: number;
  outputQty: number;
  qualityPassed: boolean;
  tdsLevel: number | null;
  phLevel: number | null;
  viscosityGrade: string | null;
  notes: string | null;
  createdAt: string;
  warehouse: { name: string };
  finishedProduct: { name: string; sku: string };
  producedBy: { name: string };
}

export const ProductionTracker: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<ProductionBatchItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [industryType, setIndustryType] = useState('water');
  const [inputQty, setInputQty] = useState(500);
  const [outputQty, setOutputQty] = useState(100);
  const [qualityPassed, setQualityPassed] = useState(true);
  const [tdsLevel, setTdsLevel] = useState(120);
  const [phLevel, setPhLevel] = useState(7.2);
  const [viscosityGrade, setViscosityGrade] = useState('20W-50');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bRes, wRes, pRes] = await Promise.all([
        apiRequest<ProductionBatchItem[]>('/production/batches'),
        apiRequest<WarehouseItem[]>('/warehouses'),
        apiRequest<ProductItem[]>('/products')
      ]);

      if (bRes.success && bRes.data) setBatches(bRes.data);
      if (wRes.success && wRes.data) setWarehouses(Array.isArray(wRes.data) ? wRes.data : []);
      if (pRes.success && pRes.data) setProducts(pRes.data || []);
    } catch (err) {
      console.error('Failed to fetch production data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId || !selectedProductId || !outputQty) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/production/batches', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: selectedWarehouseId,
          finishedProductId: selectedProductId,
          batchNumber: batchNumber.trim() || undefined,
          industryType,
          inputQty: Number(inputQty),
          outputQty: Number(outputQty),
          qualityPassed,
          tdsLevel: industryType === 'water' ? Number(tdsLevel) : undefined,
          phLevel: industryType === 'water' ? Number(phLevel) : undefined,
          viscosityGrade: industryType === 'oil' ? viscosityGrade : undefined,
          notes: notes.trim() || undefined
        })
      });

      if (res.success) {
        setShowModal(false);
        fetchData();
      } else {
        alert(`Error recording batch: ${res.error}`);
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
          <h1 className="text-xl font-bold text-slate-900">Water & Oil Production Batch Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log manufacturing runs, record QC parameters (TDS ppm, Ph, Viscosity), and credit finished inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh Log
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (warehouses.length > 0) setSelectedWarehouseId(warehouses[0].id);
              if (products.length > 0) setSelectedProductId(products[0].id);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Log Production Batch
          </Button>
        </div>
      </div>

      {/* PRODUCTION BATCHES TABLE */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>BATCH #</TableHead>
            <TableHead>DATE & TIME</TableHead>
            <TableHead>DEPOT WAREHOUSE</TableHead>
            <TableHead>FINISHED PRODUCT</TableHead>
            <TableHead>RAW INPUT</TableHead>
            <TableHead>OUTPUT PRODUCED</TableHead>
            <TableHead>QC PARAMETERS & STATUS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-bold text-brand-600 font-mono">{b.batchNumber}</TableCell>
              <TableCell className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString()}</TableCell>
              <TableCell className="text-xs font-medium text-slate-700">{b.warehouse.name}</TableCell>
              <TableCell className="font-bold text-slate-900">{b.finishedProduct.name}</TableCell>
              <TableCell className="text-xs text-slate-500">{b.inputQty} Liters</TableCell>
              <TableCell className="font-extrabold text-emerald-600">+{b.outputQty} Units</TableCell>
              <TableCell>
                {b.qualityPassed ? (
                  <Badge variant="emerald">
                    <CheckCircle2 size={12} /> QC PASSED {b.tdsLevel ? `(${b.tdsLevel} ppm TDS)` : ''}
                  </Badge>
                ) : (
                  <Badge variant="rose">
                    <XCircle size={12} /> QC FAILED
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* LOG PRODUCTION BATCH MODAL */}
      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Log Production & Quality Control Run"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordBatch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Target Depot Warehouse *</label>
              <select
                required
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 mt-1"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Finished Product SKU *</label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 mt-1"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Raw Input (Liters)" type="number" value={inputQty} onChange={(e) => setInputQty(Number(e.target.value))} />
            <Input label="Finished Output Units (+Qty) *" type="number" required value={outputQty} onChange={(e) => setOutputQty(Number(e.target.value))} />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-3">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sliders size={14} className="text-brand-600" /> QC Laboratory Parameters
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Water TDS Level (ppm)" type="number" value={tdsLevel} onChange={(e) => setTdsLevel(Number(e.target.value))} />
              <Input label="Water Ph Balance" type="number" step="0.1" value={phLevel} onChange={(e) => setPhLevel(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-semibold text-slate-700">QC Status:</span>
              <Button
                type="button"
                size="sm"
                variant={qualityPassed ? 'primary' : 'danger'}
                onClick={() => setQualityPassed(!qualityPassed)}
              >
                {qualityPassed ? '✓ QC PASSED (Auto-Credit Stock)' : '✕ QC FAILED (Defect Logged)'}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Submit Production Run
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
