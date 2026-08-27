import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Package, Plus, Warehouse, ArrowDownUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  productType: string;
  price?: number;
  costPrice?: number;
  depositPrice?: number;
  reorderLevel?: number;
  currentStock?: number;
  isLowStock?: boolean;
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
  const [activeTab, setActiveTab] = useState<string>('all');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add Product Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [prodForm, setProdForm] = useState({
    name: '',
    sku: '',
    category: 'milk',
    productType: 'finished_good',
    unit: 'liter',
    price: 180,
    costPrice: 150,
    depositPrice: 0,
    reorderLevel: 20,
    isReturnableContainer: false
  });

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

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name || !prodForm.sku) return;

    try {
      const res = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(prodForm)
      });
      if (res.success) {
        setShowProductModal(false);
        setProdForm({ name: '', sku: '', category: 'milk', productType: 'finished_good', unit: 'liter', price: 180, costPrice: 150, depositPrice: 0, reorderLevel: 20, isReturnableContainer: false });
        fetchData();
      } else {
        alert(res.error || 'Failed to add product');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  const filteredProducts = products.filter((p) => {
    if (activeTab === 'all') return true;
    return p.productType === activeTab;
  });

  const lowStockCount = products.filter((p) => (p.currentStock || 0) <= (p.reorderLevel || 10)).length;

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory & Product Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Raw Materials, Packaging, Finished Goods, Returnable Bottles/Cylinders & Depot Stock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh Catalog
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowProductModal(true)}>
            <Plus size={16} /> Add Product / Item
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

      {/* LOW STOCK ALERT BANNER */}
      {lowStockCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} className="text-amber-600" />
            <span>Low Stock Alert: {lowStockCount} item(s) are below reorder threshold!</span>
          </div>
          <span className="font-bold text-amber-700">Reorder required soon</span>
        </div>
      )}

      {/* TYPE FILTER TABS */}
      <div className="flex gap-4 border-b border-slate-200">
        {[
          { key: 'all', label: 'All Items' },
          { key: 'raw_material', label: 'Raw Materials' },
          { key: 'packaging', label: 'Packaging' },
          { key: 'finished_good', label: 'Finished Goods' },
          { key: 'returnable_container', label: 'Returnable Containers' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 text-sm font-semibold border-b-2 ${activeTab === tab.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PRODUCTS TABLE */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PRODUCT NAME & SKU</TableHead>
            <TableHead>TYPE</TableHead>
            <TableHead>COST PRICE</TableHead>
            <TableHead>SELLING PRICE</TableHead>
            <TableHead>CONTAINER DEPOSIT</TableHead>
            <TableHead>CURRENT STOCK</TableHead>
            <TableHead>STOCK STATUS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.map((p) => {
            const stock = p.currentStock || 0;
            const isLow = stock <= (p.reorderLevel || 10);
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{p.sku}</div>
                </TableCell>
                <TableCell className="text-xs font-semibold text-slate-700 uppercase">{p.productType?.replace('_', ' ')}</TableCell>
                <TableCell className="font-semibold text-slate-700">Rs. {Number(p.costPrice || 0).toFixed(2)}</TableCell>
                <TableCell className="font-extrabold text-slate-900">Rs. {Number(p.price || 0).toFixed(2)}</TableCell>
                <TableCell className="text-xs font-bold text-brand-600">Rs. {Number(p.depositPrice || 0).toFixed(2)}</TableCell>
                <TableCell className="font-bold text-base text-slate-900">{stock}</TableCell>
                <TableCell>
                  {isLow ? (
                    <Badge variant="rose">LOW STOCK ({stock})</Badge>
                  ) : (
                    <Badge variant="emerald">IN STOCK ({stock})</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* ADD PRODUCT MODAL */}
      <Dialog isOpen={showProductModal} onClose={() => setShowProductModal(false)} title="Add Product / Item to Catalog" maxWidth="md">
        <form onSubmit={handleCreateProduct} className="space-y-3">
          <Input label="Item Name *" required placeholder="e.g. Raw Milk (Liter) or 1L Milk Packet" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="SKU Code *" required placeholder="SKU-MILK-RAW" value={prodForm.sku} onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })} />
            <div>
              <label className="text-xs font-semibold text-slate-700">Item Classification *</label>
              <select
                value={prodForm.productType}
                onChange={(e) => setProdForm({ ...prodForm, productType: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
              >
                <option value="raw_material">Raw Material (e.g. Raw Milk)</option>
                <option value="packaging">Packaging (e.g. Pouches, Caps)</option>
                <option value="finished_good">Finished Good (e.g. Milk 1L Pack)</option>
                <option value="returnable_container">Returnable Container (Bottle/Cylinder)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Purchase / Cost Price" type="number" value={prodForm.costPrice} onChange={(e) => setProdForm({ ...prodForm, costPrice: Number(e.target.value) })} />
            <Input label="Selling Price" type="number" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: Number(e.target.value) })} />
            <Input label="Reorder Threshold Alert" type="number" value={prodForm.reorderLevel} onChange={(e) => setProdForm({ ...prodForm, reorderLevel: Number(e.target.value) })} />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowProductModal(false)}>Cancel</Button>
            <Button type="submit">Save Product</Button>
          </div>
        </form>
      </Dialog>

      {/* STOCK MOVEMENT MODAL */}
      <Dialog isOpen={showMovementModal} onClose={() => setShowMovementModal(false)} title="Log Inventory Stock Movement" maxWidth="md">
        <form onSubmit={handleStockMovement} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Target Product *</label>
            <select required value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md">
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Depot / Warehouse Location *</label>
            <select required value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md">
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Quantity (+/- Units)" type="number" required value={movementQty} onChange={(e) => setMovementQty(Number(e.target.value))} />
            <div>
              <label className="text-xs font-semibold text-slate-700">Transaction Type *</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md">
                <option value="load">Load (+Stock)</option>
                <option value="transfer">Transfer</option>
                <option value="breakage">Breakage (-Stock)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowMovementModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Log Stock Movement</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
