import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Factory, Plus, RefreshCw, CheckCircle2, XCircle, Sliders, BookOpen, Layers } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

interface WarehouseItem { id: string; name: string; }
interface ProductItem { id: string; name: string; sku: string; unit: string; costPrice: number; productType: string; price: number; }

interface BOMItem {
  id: string;
  name: string;
  yieldQty: number;
  finishedProduct: { id: string; name: string; sku: string; unit: string; costPrice: number };
  items: Array<{
    id: string;
    rawProductId: string;
    qtyRequired: number;
    rawProduct: { id: string; name: string; unit: string; costPrice: number; productType: string };
  }>;
}

interface ProductionBatchItem {
  id: string;
  batchNumber: string;
  industryType: string;
  inputQty: number;
  outputQty: number;
  laborOverheadCost: number;
  totalMaterialCost: number;
  unitCost: number;
  qualityPassed: boolean;
  tdsLevel: number | null;
  phLevel: number | null;
  notes: string | null;
  createdAt: string;
  warehouse: { name: string };
  finishedProduct: { name: string; sku: string; unit: string };
  producedBy: { name: string };
}

export const ProductionTracker: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'batches' | 'boms'>('batches');
  const [batches, setBatches] = useState<ProductionBatchItem[]>([]);
  const [boms, setBoms] = useState<BOMItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBOMModal, setShowBOMModal] = useState(false);

  // Batch Form State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedBomId, setSelectedBomId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [outputQty, setOutputQty] = useState(480);
  const [laborOverheadCost, setLaborOverheadCost] = useState(2000);
  const [qualityPassed, setQualityPassed] = useState(true);
  const [tdsLevel, setTdsLevel] = useState(120);
  const [phLevel, setPhLevel] = useState(7.2);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // BOM Form State
  const [bomName, setBomName] = useState('');
  const [bomFinishedProductId, setBomFinishedProductId] = useState('');
  const [bomYieldQty, setBomYieldQty] = useState(1.0);
  const [bomIngredients, setBomIngredients] = useState<Array<{ rawProductId: string; qtyRequired: number }>>([
    { rawProductId: '', qtyRequired: 1.0 }
  ]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bRes, bomRes, wRes, pRes] = await Promise.all([
        apiRequest<ProductionBatchItem[]>('/production/batches'),
        apiRequest<BOMItem[]>('/production/boms'),
        apiRequest<WarehouseItem[]>('/warehouses'),
        apiRequest<ProductItem[]>('/products')
      ]);

      if (bRes.success && bRes.data) setBatches(bRes.data);
      if (bomRes.success && bomRes.data) setBoms(bomRes.data);
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
          bomId: selectedBomId || undefined,
          batchNumber: batchNumber.trim() || undefined,
          outputQty: Number(outputQty),
          laborOverheadCost: Number(laborOverheadCost),
          qualityPassed,
          tdsLevel: Number(tdsLevel),
          phLevel: Number(phLevel),
          notes: notes.trim() || undefined
        })
      });

      if (res.success) {
        setShowBatchModal(false);
        fetchData();
        alert('Production batch completed! Materials deducted, finished stock updated & financial costing logged.');
      } else {
        alert(`Error recording batch: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomFinishedProductId || !bomName || bomIngredients.some((i) => !i.rawProductId || i.qtyRequired <= 0)) {
      alert('Please complete all recipe fields');
      return;
    }

    try {
      const res = await apiRequest('/production/boms', {
        method: 'POST',
        body: JSON.stringify({
          finishedProductId: bomFinishedProductId,
          name: bomName,
          yieldQty: Number(bomYieldQty),
          items: bomIngredients
        })
      });

      if (res.success) {
        setShowBOMModal(false);
        setBomName('');
        setBomFinishedProductId('');
        setBomIngredients([{ rawProductId: '', qtyRequired: 1.0 }]);
        fetchData();
        alert('Recipe / Bill of Materials created successfully!');
      } else {
        alert(`Error: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Calculate live material & total cost estimation for batch
  const selectedBom = boms.find((b) => b.id === selectedBomId) || boms.find((b) => b.finishedProductId === selectedProductId);
  let estMaterialCost = 0;
  if (selectedBom) {
    for (const item of selectedBom.items) {
      const qty = (item.qtyRequired / selectedBom.yieldQty) * outputQty;
      estMaterialCost += qty * (item.rawProduct.costPrice || 0);
    }
  }
  const estTotalCost = estMaterialCost + Number(laborOverheadCost || 0);
  const estUnitCost = outputQty > 0 ? estTotalCost / outputQty : 0;

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Production & Recipe Costing Studio</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Define BOM recipes (Raw Milk + Packaging Pouches = 1L Packet), run batch production, and compute exact unit costing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBOMModal(true)}
          >
            <BookOpen size={16} /> + New Recipe (BOM)
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (warehouses.length > 0) setSelectedWarehouseId(warehouses[0].id);
              if (products.length > 0) setSelectedProductId(products[0].id);
              setShowBatchModal(true);
            }}
          >
            <Plus size={16} /> Run Production Batch
          </Button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-2 text-sm font-semibold border-b-2 ${activeTab === 'batches' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
        >
          Production Batches Log
        </button>
        <button
          onClick={() => setActiveTab('boms')}
          className={`pb-2 text-sm font-semibold border-b-2 ${activeTab === 'boms' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
        >
          Recipe Formulas (Bill of Materials)
        </button>
      </div>

      {/* BATCHES TAB */}
      {activeTab === 'batches' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BATCH #</TableHead>
              <TableHead>DATE & TIME</TableHead>
              <TableHead>DEPOT WAREHOUSE</TableHead>
              <TableHead>FINISHED PRODUCT</TableHead>
              <TableHead>UNITS PRODUCED</TableHead>
              <TableHead>UNIT COST</TableHead>
              <TableHead>TOTAL COST</TableHead>
              <TableHead>QC STATUS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                  No production runs recorded yet. Click "Run Production Batch" to start.
                </TableCell>
              </TableRow>
            ) : (
              batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-bold text-brand-600 font-mono">{b.batchNumber}</TableCell>
                  <TableCell className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-medium text-slate-700">{b.warehouse.name}</TableCell>
                  <TableCell className="font-bold text-slate-900">{b.finishedProduct.name}</TableCell>
                  <TableCell className="font-extrabold text-emerald-600">+{b.outputQty} {b.finishedProduct.unit}</TableCell>
                  <TableCell className="font-semibold text-slate-700">Rs. {b.unitCost.toFixed(2)}</TableCell>
                  <TableCell className="font-bold text-slate-900">Rs. {(b.totalMaterialCost + b.laborOverheadCost).toLocaleString()}</TableCell>
                  <TableCell>
                    {b.qualityPassed ? (
                      <Badge variant="emerald">
                        <CheckCircle2 size={12} /> QC PASSED
                      </Badge>
                    ) : (
                      <Badge variant="rose">
                        <XCircle size={12} /> QC FAILED
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* BOMS TAB */}
      {activeTab === 'boms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {boms.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-400">
              No Recipe Formulas (BOM) created yet. Click "+ New Recipe (BOM)" to set one up.
            </div>
          ) : (
            boms.map((bom) => (
              <Card key={bom.id} className="border-slate-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{bom.name}</h3>
                      <div className="text-xs text-brand-600 font-medium">Finished Good: {bom.finishedProduct.name}</div>
                    </div>
                    <Badge variant="emerald">Yield: {bom.yieldQty} {bom.finishedProduct.unit}</Badge>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-md text-xs space-y-1">
                    <div className="font-bold text-slate-700 mb-1">Raw Ingredients / Packaging List:</div>
                    {bom.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-slate-600">
                        <span>• {item.rawProduct.name} ({item.rawProduct.productType}):</span>
                        <span className="font-semibold">{item.qtyRequired} {item.rawProduct.unit} @ Rs. {item.rawProduct.costPrice}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* MODAL: RUN PRODUCTION BATCH */}
      <Dialog
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="Execute Manufacturing & Batch Run"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordBatch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Target Warehouse Depot *</label>
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
              <label className="text-xs font-semibold text-slate-700">Finished Product to Produce *</label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  const b = boms.find(x => x.finishedProductId === e.target.value);
                  if (b) setSelectedBomId(b.id);
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 mt-1"
              >
                <option value="">-- Select Finished Product --</option>
                {products.filter(p => p.productType === 'finished_good' || !p.productType).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Output Units to Produce *" type="number" required value={outputQty} onChange={(e) => setOutputQty(Number(e.target.value))} />
            <Input label="Labor & Overhead Expenses (Rs.)" type="number" value={laborOverheadCost} onChange={(e) => setLaborOverheadCost(Number(e.target.value))} />
          </div>

          {/* LIVE COST ESTIMATION BOX */}
          <div className="p-3 bg-brand-50 border border-brand-200 rounded-md text-xs space-y-1 text-slate-800">
            <div className="font-bold text-brand-900">📊 Live Batch Costing Preview:</div>
            <div className="flex justify-between">
              <span>Estimated Raw Materials + Packaging Cost:</span>
              <span className="font-semibold">Rs. {estMaterialCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Labor / Daily Production Overhead:</span>
              <span className="font-semibold">Rs. {laborOverheadCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-brand-200 pt-1 font-bold text-sm text-brand-900">
              <span>Estimated Unit Production Cost:</span>
              <span>Rs. {estUnitCost.toFixed(2)} / unit</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-3">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sliders size={14} className="text-brand-600" /> Quality Control Checks
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Water TDS Level (ppm)" type="number" value={tdsLevel} onChange={(e) => setTdsLevel(Number(e.target.value))} />
              <Input label="Ph Balance" type="number" step="0.1" value={phLevel} onChange={(e) => setPhLevel(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowBatchModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Run Batch & Credit Stock
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: CREATE BOM RECIPE */}
      <Dialog
        isOpen={showBOMModal}
        onClose={() => setShowBOMModal(false)}
        title="Create Recipe / Bill of Materials (BOM)"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateBOM} className="space-y-4">
          <Input label="Recipe Name *" required placeholder="e.g. 1L Milk Packet Recipe" value={bomName} onChange={(e) => setBomName(e.target.value)} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Finished Product *</label>
              <select
                required
                value={bomFinishedProductId}
                onChange={(e) => setBomFinishedProductId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 mt-1"
              >
                <option value="">-- Choose Target Finished Product --</option>
                {products
                  .filter((p) => p.productType === 'finished_good' || !p.productType)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} [FINISHED GOOD]
                    </option>
                  ))}
              </select>
            </div>
            <Input label="Yield Output Qty" type="number" value={bomYieldQty} onChange={(e) => setBomYieldQty(Number(e.target.value))} />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 mb-1 block">Raw Material & Packaging Ingredients</label>
            {bomIngredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select
                  required
                  value={ing.rawProductId}
                  onChange={(e) => {
                    const next = [...bomIngredients];
                    next[idx].rawProductId = e.target.value;
                    setBomIngredients(next);
                  }}
                  className="flex-2 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                >
                  <option value="">-- Select Raw Material / Packaging --</option>
                  {products
                    .filter((p) => p.productType !== 'finished_good')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} [{p.productType ? p.productType.toUpperCase().replace('_', ' ') : 'RAW MATERIAL'}]
                      </option>
                    ))}
                </select>

                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Qty Required"
                  value={ing.qtyRequired}
                  onChange={(e) => {
                    const next = [...bomIngredients];
                    next[idx].qtyRequired = Number(e.target.value);
                    setBomIngredients(next);
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                />

                {bomIngredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBomIngredients(bomIngredients.filter((_, i) => i !== idx))}
                    className="text-rose-500 text-lg font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setBomIngredients([...bomIngredients, { rawProductId: '', qtyRequired: 1.0 }])}
              className="text-xs font-bold text-brand-600 hover:underline mt-1"
            >
              + Add Ingredient
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowBOMModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Recipe</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
