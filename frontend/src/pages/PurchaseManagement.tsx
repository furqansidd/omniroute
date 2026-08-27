import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export interface Vendor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms: string;
  balancePayable: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  costPrice: number;
  productType: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  expectedDeliveryDate?: string;
  notes?: string;
  createdAt: string;
  vendor: { id: string; name: string; phone?: string };
  items: Array<{
    id: string;
    productId: string;
    expectedQty: number;
    unitPrice: number;
    totalPrice: number;
    product: { id: string; name: string; sku: string; unit: string };
  }>;
}

export interface POFormItem {
  productId: string;
  customName: string;
  expectedQty: number;
  unitPrice: number;
}

export const PurchaseManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'vendors'>('orders');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form states
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', email: '', address: '', paymentTerms: 'net_30' });
  const [poForm, setPoForm] = useState<{
    vendorId: string;
    notes: string;
    expectedDeliveryDate: string;
    items: POFormItem[];
  }>({
    vendorId: '',
    notes: '',
    expectedDeliveryDate: '',
    items: [{ productId: '', customName: 'Raw Milk (Liters)', expectedQty: 100, unitPrice: 150 }]
  });
  const [grnItems, setGrnItems] = useState<Array<{ productId: string; expectedQty: number; receivedQty: number; unitCost: number }>>([]);
  const [grnNotes, setGrnNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vRes, poRes, pRes] = await Promise.all([
        apiRequest<Vendor[]>('/purchase/vendors'),
        apiRequest<PurchaseOrder[]>('/purchase/orders'),
        apiRequest<any[]>('/products')
      ]);

      if (vRes.success && vRes.data) setVendors(vRes.data);
      if (poRes.success && poRes.data) setOrders(poRes.data);
      if (pRes.success && pRes.data) setProducts(pRes.data);
    } catch (err) {
      console.error('Failed to load purchase data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/purchase/vendors', {
        method: 'POST',
        body: JSON.stringify(vendorForm)
      });
      if (res.success) {
        setShowVendorModal(false);
        setVendorForm({ name: '', phone: '', email: '', address: '', paymentTerms: 'net_30' });
        await fetchData();
        alert('Vendor added successfully!');
      } else {
        alert(res.error || res.message || 'Failed to add vendor');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.vendorId) {
      alert('Please select a supplier/vendor');
      return;
    }

    if (poForm.items.some((i) => (!i.productId && !i.customName.trim()) || i.expectedQty <= 0)) {
      alert('Please fill out all item names, quantity/pieces, and unit prices correctly');
      return;
    }

    try {
      // Resolve custom typed item names by auto-creating missing products
      const resolvedItems = [];
      for (const item of poForm.items) {
        let pId = item.productId;
        if (!pId && item.customName.trim()) {
          // Find if product with same name exists
          const existing = products.find(p => p.name.toLowerCase() === item.customName.trim().toLowerCase());
          if (existing) {
            pId = existing.id;
          } else {
            const createRes = await apiRequest<Product>('/products', {
              method: 'POST',
              body: JSON.stringify({
                name: item.customName.trim(),
                sku: `RAW-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`,
                category: 'raw_material',
                unit: 'unit',
                price: item.unitPrice,
                costPrice: item.unitPrice,
                productType: 'raw_material'
              })
            });
            if (createRes.success && createRes.data) {
              pId = createRes.data.id;
            }
          }
        }

        if (!pId) {
          alert(`Failed to prepare product for ${item.customName}`);
          return;
        }

        resolvedItems.push({
          productId: pId,
          expectedQty: item.expectedQty,
          unitPrice: item.unitPrice
        });
      }

      const res = await apiRequest('/purchase/orders', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: poForm.vendorId,
          expectedDeliveryDate: poForm.expectedDeliveryDate,
          notes: poForm.notes,
          items: resolvedItems
        })
      });

      if (res.success) {
        setShowPOModal(false);
        setPoForm({ vendorId: '', notes: '', expectedDeliveryDate: '', items: [{ productId: '', customName: 'Raw Milk (Liters)', expectedQty: 100, unitPrice: 150 }] });
        fetchData();
        alert('Purchase order issued successfully!');
      } else {
        alert(res.error || 'Failed to create Purchase Order');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openGRNModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setGrnItems(
      po.items.map((item) => ({
        productId: item.productId,
        expectedQty: item.expectedQty,
        receivedQty: item.expectedQty,
        unitCost: item.unitPrice
      }))
    );
    setGrnNotes('');
    setShowGRNModal(true);
  };

  const handleProcessGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    try {
      const res = await apiRequest('/purchase/grn', {
        method: 'POST',
        body: JSON.stringify({
          poId: selectedPO.id,
          notes: grnNotes,
          items: grnItems
        })
      });

      if (res.success) {
        alert('Goods received! Stock increased and vendor payable balance updated.');
        setShowGRNModal(false);
        fetchData();
      } else {
        alert(res.error || 'Failed to receive goods');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const addItemToPO = () => {
    setPoForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', customName: 'Packaging Pouches / Packets', expectedQty: 100, unitPrice: 3 }]
    }));
  };

  const removeItemFromPO = (index: number) => {
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const totalVendorPayables = vendors.reduce((sum, v) => sum + v.balancePayable, 0);
  const grandPOTotal = poForm.items.reduce((sum, i) => sum + (i.expectedQty * i.unitPrice), 0);

  return (
    <div style={{ padding: '24px', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Procurement & Purchase Orders
          </h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage suppliers, issue purchase orders, receive shipments, and auto-sync inventory & financial payables.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowVendorModal(true)}
            style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#38bdf8', padding: '10px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            + Add Supplier / Vendor
          </button>
          <button
            onClick={() => setShowPOModal(true)}
            style={{ backgroundColor: '#0284c7', border: 'none', color: '#ffffff', padding: '10px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
          >
            + Create Purchase Order
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>Active Vendors</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '6px', color: '#f8fafc' }}>{vendors.length}</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>Total Vendor Payables ($ Udhaar)</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '6px', color: '#f43f5e' }}>Rs. {totalVendorPayables.toLocaleString()}</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>Issued Purchase Orders</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '6px', color: '#38bdf8' }}>{orders.filter((o) => o.status === 'issued').length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #334155', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('orders')}
          style={{ padding: '10px 16px', border: 'none', background: 'none', color: activeTab === 'orders' ? '#38bdf8' : '#94a3b8', borderBottom: activeTab === 'orders' ? '2px solid #38bdf8' : 'none', fontWeight: '600', cursor: 'pointer' }}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          style={{ padding: '10px 16px', border: 'none', background: 'none', color: activeTab === 'vendors' ? '#38bdf8' : '#94a3b8', borderBottom: activeTab === 'vendors' ? '2px solid #38bdf8' : 'none', fontWeight: '600', cursor: 'pointer' }}
        >
          Vendor Directory & Payables
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 16px' }}>PO Number</th>
                <th style={{ padding: '14px 16px' }}>Vendor</th>
                <th style={{ padding: '14px 16px' }}>Items & Quantities</th>
                <th style={{ padding: '14px 16px' }}>Total Amount</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 16px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No purchase orders found. Create your first PO to begin procurement.
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#38bdf8' }}>{po.poNumber}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '500' }}>{po.vendor?.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{po.vendor?.phone}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {po.items.map((item) => (
                        <div key={item.id} style={{ fontSize: '13px' }}>
                          • {item.product.name}: {item.expectedQty} {item.product.unit} @ Rs. {item.unitPrice}
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#10b981' }}>Rs. {po.totalAmount.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: po.status === 'received_full' ? '#065f46' : po.status === 'received_partial' ? '#854d0e' : '#1e3a8a',
                          color: po.status === 'received_full' ? '#34d399' : po.status === 'received_partial' ? '#fde047' : '#93c5fd'
                        }}
                      >
                        {po.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {po.status !== 'received_full' && (
                        <button
                          onClick={() => openGRNModal(po)}
                          style={{ backgroundColor: '#10b981', border: 'none', color: '#ffffff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Receive Goods (GRN)
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 16px' }}>Vendor Name</th>
                <th style={{ padding: '14px 16px' }}>Contact</th>
                <th style={{ padding: '14px 16px' }}>Payment Terms</th>
                <th style={{ padding: '14px 16px' }}>Outstanding Payable</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No vendors added yet. Click "+ Add Supplier / Vendor" to add one.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '600' }}>{vendor.name}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#cbd5e1' }}>
                      <div>Phone: {vendor.phone || 'N/A'}</div>
                      <div>Address: {vendor.address || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textTransform: 'uppercase', fontSize: '12px', color: '#38bdf8', fontWeight: '600' }}>{vendor.paymentTerms.replace('_', ' ')}</td>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: vendor.balancePayable > 0 ? '#f43f5e' : '#10b981' }}>
                      Rs. {vendor.balancePayable.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add Vendor */}
      {showVendorModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#1e293b', width: '480px', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '20px', margin: '0 0 16px 0', color: '#38bdf8' }}>Add New Supplier / Vendor</h2>
            <form onSubmit={handleCreateVendor} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Vendor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmed Dairy Farm"
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Phone</label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Payment Terms</label>
                  <select
                    value={vendorForm.paymentTerms}
                    onChange={(e) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff' }}
                  >
                    <option value="cash_on_delivery">Cash on Delivery</option>
                    <option value="net_15">Net 15 Days</option>
                    <option value="net_30">Net 30 Days</option>
                    <option value="net_60">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Address</label>
                <input
                  type="text"
                  placeholder="Dairy Farm Road, Multan"
                  value={vendorForm.address}
                  onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowVendorModal(false)} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}>
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create PO */}
      {showPOModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#1e293b', width: '720px', borderRadius: '16px', padding: '24px', border: '1px solid #334155', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', margin: 0, fontWeight: '700', color: '#38bdf8' }}>Issue New Purchase Order</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>Add item details, quantities (pieces/liters), and prices per unit</p>
              </div>
              <button onClick={() => setShowPOModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreatePO} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>Select Supplier / Vendor *</label>
                <select
                  required
                  value={poForm.vendorId}
                  onChange={(e) => setPoForm({ ...poForm, vendorId: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '14px', fontWeight: '500' }}
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (Payable Balance: Rs. {v.balancePayable.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Line Items Section */}
              <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', padding: '16px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Order Line Items ({poForm.items.length})
                  </label>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Type custom name or select catalog item</span>
                </div>

                {/* Table Header Labels */}
                <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1.2fr 40px', gap: '8px', marginBottom: '8px', paddingHorizontal: '4px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  <div>Item Description / Product *</div>
                  <div>Pieces / Qty *</div>
                  <div>Unit Price (Rs.) *</div>
                  <div>Total Line (Rs.)</div>
                  <div></div>
                </div>

                {/* Item Rows */}
                {poForm.items.map((item, idx) => {
                  const lineTotal = (item.expectedQty || 0) * (item.unitPrice || 0);
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1.2fr 40px', gap: '8px', marginBottom: '10px', alignItems: 'center', backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
                      {/* Item Name Input or Quick Select */}
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Raw Milk 1L / Pouches"
                          value={item.customName}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].customName = e.target.value;
                            newItems[idx].productId = '';
                            setPoForm({ ...poForm, items: newItems });
                          }}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '13px', fontWeight: '600' }}
                        />
                        {products.length > 0 && (
                          <select
                            value={item.productId}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const prod = products.find((p) => p.id === selectedId);
                              const newItems = [...poForm.items];
                              newItems[idx].productId = selectedId;
                              if (prod) {
                                newItems[idx].customName = prod.name;
                                if (prod.costPrice) newItems[idx].unitPrice = prod.costPrice;
                              }
                              setPoForm({ ...poForm, items: newItems });
                            }}
                            style={{ width: '100%', marginTop: '4px', padding: '4px 8px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#94a3b8', fontSize: '11px' }}
                          >
                            <option value="">-- Quick fill from Catalog --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} (Rs. {p.costPrice})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Quantity / Pieces Input */}
                      <div>
                        <input
                          type="number"
                          required
                          min={1}
                          placeholder="e.g. 100"
                          value={item.expectedQty || ''}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].expectedQty = Number(e.target.value);
                            setPoForm({ ...poForm, items: newItems });
                          }}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '13px', fontWeight: '700' }}
                        />
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', textAlign: 'center' }}>Pieces/Units</div>
                      </div>

                      {/* Unit Price Input */}
                      <div>
                        <input
                          type="number"
                          required
                          min={0}
                          placeholder="e.g. 150"
                          value={item.unitPrice || ''}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].unitPrice = Number(e.target.value);
                            setPoForm({ ...poForm, items: newItems });
                          }}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#38bdf8', fontSize: '13px', fontWeight: '700' }}
                        />
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', textAlign: 'center' }}>Rs. / Piece</div>
                      </div>

                      {/* Line Total Calculation */}
                      <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '6px', border: '1px solid #334155', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#10b981' }}>Rs. {lineTotal.toLocaleString()}</div>
                      </div>

                      {/* Remove Row Button */}
                      <div style={{ textAlign: 'center' }}>
                        {poForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemFromPO(idx)}
                            style={{ color: '#f43f5e', backgroundColor: '#334155', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}
                            title="Remove Line Item"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addItemToPO}
                  style={{ backgroundColor: '#1e293b', border: '1px dashed #38bdf8', color: '#38bdf8', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}
                >
                  + Add Another Item Line
                </button>

                {/* PO Total Summary */}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px border #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Grand Total PO Value:</span>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>Rs. {grandPOTotal.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Expected Delivery Date</label>
                <input
                  type="date"
                  value={poForm.expectedDeliveryDate}
                  onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowPOModal(false)} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)' }}>
                  Issue Purchase Order (Rs. {grandPOTotal.toLocaleString()})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Process GRN */}
      {showGRNModal && selectedPO && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#1e293b', width: '560px', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#10b981' }}>Receive Goods Note ({selectedPO.poNumber})</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
              Confirm actual received quantities. Any shortage will automatically be logged as Receiving Wastage and vendor payable calculated.
            </p>

            <form onSubmit={handleProcessGRN} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {grnItems.map((item, idx) => {
                const prod = selectedPO.items.find((i) => i.productId === item.productId)?.product;
                const shortage = Math.max(0, item.expectedQty - item.receivedQty);
                return (
                  <div key={idx} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ fontWeight: '600', color: '#38bdf8', marginBottom: '8px' }}>{prod?.name || 'Item'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b' }}>Ordered Qty</label>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>{item.expectedQty} {prod?.unit}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#94a3b8' }}>Received Qty</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={item.receivedQty}
                          onChange={(e) => {
                            const newItems = [...grnItems];
                            newItems[idx].receivedQty = Number(e.target.value);
                            setGrnItems(newItems);
                          }}
                          style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #38bdf8', backgroundColor: '#1e293b', color: '#ffffff', fontWeight: '600' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748b' }}>Unit Cost</label>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>Rs. {item.unitCost}</div>
                      </div>
                    </div>
                    {shortage > 0 && (
                      <div style={{ fontSize: '12px', color: '#f43f5e', marginTop: '6px', fontWeight: '500' }}>
                        ⚠️ Shortage of {shortage} {prod?.unit} will be recorded as Supplier Wastage.
                      </div>
                    )}
                  </div>
                );
              })}

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>GRN Receiving Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Shipment delivered in good condition"
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowGRNModal(false)} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}>
                  Confirm & Sync Stock + Finance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
