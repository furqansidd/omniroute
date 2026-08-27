import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Package, Plus, Warehouse, ArrowDownUp, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  price?: number;
  basePrice?: number;
  costPrice?: number;
  depositPrice?: number;
  isReturnableContainer: boolean;
}

interface WarehouseItem {
  id: string;
  name: string;
  location: string | null;
  isRiderMobileDepot: boolean;
}

export const ProductStockManagement: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stock Movement Modal
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [movementQty, setMovementQty] = useState(50);
  const [transactionType, setTransactionType] = useState('load');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pRes, wRes] = await Promise.all([
        apiRequest<ProductItem[]>('/products'),
        apiRequest<WarehouseItem[]>('/warehouses')
      ]);
      if (pRes.success && pRes.data) setProducts(pRes.data);
      if (wRes.success && wRes.data) setWarehouses(Array.isArray(wRes.data) ? wRes.data : []);
    } catch (err) {
      console.error('Failed to fetch products and warehouses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedWarehouseId || !movementQty) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/stock/movement', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductId,
          warehouseId: selectedWarehouseId,
          qty: Number(movementQty),
          transactionType
        })
      });

      if (res.success) {
        setShowMovementModal(false);
        fetchData();
      } else {
        alert(`Error logging stock movement: ${res.error}`);
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
          <h1 className="text-xl font-bold text-slate-900">Products & Inventory Depot Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure catalog SKUs, container deposit values, and central plant depots vs mobile vehicle inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh Catalog
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (products.length > 0) setSelectedProductId(products[0].id);
              if (warehouses.length > 0) setSelectedWarehouseId(warehouses[0].id);
              setShowMovementModal(true);
            }}
          >
            <ArrowDownUp size={16} /> Log Stock Movement
          </Button>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PRODUCT NAME & SKU</TableHead>
            <TableHead>CATEGORY</TableHead>
            <TableHead>BASE SELLING PRICE</TableHead>
            <TableHead>CONTAINER DEPOSIT</TableHead>
            <TableHead>RETURNABLE CONTAINER</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="font-bold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-400 font-mono">{p.sku}</div>
              </TableCell>
              <TableCell className="text-xs font-semibold text-slate-700 uppercase">{p.category}</TableCell>
              <TableCell className="font-extrabold text-slate-900">${Number(p.price ?? p.basePrice ?? 0).toFixed(2)}</TableCell>
              <TableCell className="text-xs font-bold text-brand-600">${Number(p.depositPrice ?? 0).toFixed(2)}</TableCell>
              <TableCell>
                {p.isReturnableContainer ? (
                  <Badge variant="emerald">Yes (Returnable)</Badge>
                ) : (
                  <Badge variant="slate">No (Consumable)</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* STOCK MOVEMENT MODAL */}
      <Dialog
        isOpen={showMovementModal}
        onClose={() => setShowMovementModal(false)}
        title="Log Inventory Stock Movement"
        maxWidth="md"
      >
        <form onSubmit={handleStockMovement} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Target Product *</label>
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

          <div>
            <label className="text-xs font-semibold text-slate-700">Depot / Warehouse Location *</label>
            <select
              required
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 mt-1"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} {w.isRiderMobileDepot ? '(Rider Mobile Vehicle)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity (+/- Units)"
              type="number"
              required
              value={movementQty}
              onChange={(e) => setMovementQty(Number(e.target.value))}
            />
            <div>
              <label className="text-xs font-semibold text-slate-700">Transaction Type *</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 mt-1"
              >
                <option value="load">Load (+Stock)</option>
                <option value="transfer">Transfer</option>
                <option value="breakage">Breakage (-Stock)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowMovementModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Log Stock Movement
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
