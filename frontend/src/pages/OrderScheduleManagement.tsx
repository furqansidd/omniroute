import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { ShoppingCart, Calendar, Plus, RefreshCw, Trash2, Zap, Play, Pause } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Dialog } from '../components/ui/Dialog';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface OrderItem {
  id: string;
  orderNumber: string;
  orderDate?: string;
  createdAt?: string;
  totalAmount: number;
  status: string;
  customer: { name: string; phone: string };
  delivery?: { rider?: { name: string } };
}

interface ScheduleItem {
  id: string;
  frequency: string;
  quantity: number;
  nextRunDate: string;
  status: string;
  customer: { name: string; phone?: string; zone?: { name: string } };
  product: { name: string; price: number };
}

interface CustomerOption { id: string; name: string; phone: string; zone?: { name: string } }
interface ProductOption { id: string; name: string; sku: string; price: number }
interface RiderOption { id: string; name: string; phone: string | null; role: { name: string } }
interface OrderLineItem { productId: string; qty: number; productName: string; price: number }

export const OrderScheduleManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingRuns, setIsGeneratingRuns] = useState(false);

  // One-time Order modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [orderCustomerId, setOrderCustomerId] = useState('');
  const [orderRiderId, setOrderRiderId] = useState('');
  const [orderItems, setOrderItems] = useState<OrderLineItem[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState<number>(1);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Recurring Subscription modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedCustomerId, setSchedCustomerId] = useState('');
  const [schedProductId, setSchedProductId] = useState('');
  const [schedQty, setSchedQty] = useState<number>(2);
  const [schedFrequency, setSchedFrequency] = useState<'daily' | 'alternate_day' | 'custom_days' | 'weekly'>('daily');
  const [schedDays, setSchedDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri default
  const [schedStartDate, setSchedStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [oRes, sRes] = await Promise.all([
        apiRequest<any>('/orders'),
        apiRequest<ScheduleItem[]>('/schedules')
      ]);
      if (oRes.success && oRes.data) {
        const arr = Array.isArray(oRes.data) ? oRes.data : (oRes.data.orders || []);
        setOrders(arr);
      }
      if (sRes.success && sRes.data) setSchedules(sRes.data);
    } catch (err) {
      console.error('Failed to fetch orders and schedules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModalData = async () => {
    const [cRes, pRes, uRes] = await Promise.all([
      apiRequest<any>('/customers?limit=500'),
      apiRequest<ProductOption[]>('/products'),
      apiRequest<RiderOption[]>('/rbac/users')
    ]);
    if (cRes.success && cRes.data) {
      const arr = Array.isArray(cRes.data) ? cRes.data : (cRes.data.customers || []);
      setCustomers(arr);
    }
    if (pRes.success && pRes.data) setProducts(pRes.data);
    if (uRes.success && Array.isArray(uRes.data)) {
      const onlyRiders = uRes.data.filter(u =>
        u.role?.name?.toLowerCase().includes('rider') ||
        u.role?.name?.toLowerCase().includes('driver') ||
        u.role?.name?.toLowerCase().includes('delivery')
      );
      setRiders(onlyRiders);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openOrderModal = async () => {
    await fetchModalData();
    setOrderCustomerId('');
    setOrderRiderId('');
    setOrderItems([]);
    setAddProductId('');
    setAddQty(1);
    setShowOrderModal(true);
  };

  const openScheduleModal = async () => {
    await fetchModalData();
    setSchedCustomerId('');
    setSchedProductId('');
    setSchedQty(2);
    setSchedFrequency('daily');
    setSchedDays([1, 3, 5]);
    setSchedStartDate(new Date().toISOString().slice(0, 10));
    setShowScheduleModal(true);
  };

  const handleAddItem = () => {
    if (!addProductId) return;
    const product = products.find(p => p.id === addProductId);
    if (!product) return;
    const existing = orderItems.find(i => i.productId === addProductId);
    if (existing) {
      setOrderItems(prev => prev.map(i => i.productId === addProductId ? { ...i, qty: i.qty + addQty } : i));
    } else {
      setOrderItems(prev => [...prev, { productId: product.id, productName: product.name, price: product.price, qty: addQty }]);
    }
    setAddProductId('');
    setAddQty(1);
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems(prev => prev.filter(i => i.productId !== productId));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCustomerId) { alert('Please select a customer'); return; }
    if (orderItems.length === 0) { alert('Add at least one product to the order'); return; }
    setIsSubmittingOrder(true);
    try {
      const res = await apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: orderCustomerId,
          riderId: orderRiderId || undefined,
          orderType: 'on_demand',
          items: orderItems.map(i => ({ productId: i.productId, qty: i.qty }))
        })
      });
      if (res.success) {
        setShowOrderModal(false);
        fetchData();
      } else {
        alert(`Error creating order: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedCustomerId || !schedProductId) {
      alert('Please select both a Customer and a Product');
      return;
    }
    if (schedFrequency === 'custom_days' && schedDays.length === 0) {
      alert('Please select at least one day of the week');
      return;
    }

    setIsSubmittingSchedule(true);
    const frequencyVal = schedFrequency === 'custom_days' ? `days:${schedDays.join(',')}` : schedFrequency;

    try {
      const res = await apiRequest('/schedules', {
        method: 'POST',
        body: JSON.stringify({
          customerId: schedCustomerId,
          productId: schedProductId,
          qty: schedQty,
          frequency: frequencyVal,
          startDate: schedStartDate
        })
      });

      if (res.success) {
        setShowScheduleModal(false);
        fetchData();
        setActiveTab('schedules');
      } else {
        alert(`Error creating recurring schedule: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleGenerateDailyRuns = async () => {
    if (!window.confirm("Generate today's delivery orders for all active scheduled subscriptions?")) return;
    setIsGeneratingRuns(true);
    try {
      const res = await apiRequest('/orders/generate-daily-runs', { method: 'POST', body: JSON.stringify({}) });
      if (res.success) {
        alert(`Success! Processed ${res.data.schedulesProcessed} subscriptions and generated ${res.data.generatedOrdersCount} delivery orders for today!`);
        fetchData();
        setActiveTab('orders');
      } else {
        alert(`Failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsGeneratingRuns(false);
    }
  };

  const handleToggleScheduleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await apiRequest(`/schedules/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.success) fetchData();
      else alert(`Failed: ${res.error}`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const toggleSchedDay = (d: number) => {
    setSchedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const formatFrequency = (freq: string) => {
    if (freq === 'daily') return '🔄 Daily (Every Day)';
    if (freq === 'alternate_day') return '🔁 Alternate Days (Every 2 Days)';
    if (freq === 'weekly') return '📆 Weekly';
    if (freq === 'monthly') return '📅 Monthly';
    if (freq.startsWith('days:')) {
      const days = freq.replace('days:', '').split(',').map(Number).map(d => DAY_NAMES[d]).join(', ');
      return `📅 Custom: ${days}`;
    }
    return freq;
  };

  const totalOrderAmount = orderItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = { delivered: 'emerald', pending: 'amber', assigned: 'blue', failed: 'red', cancelled: 'slate' };
    return <Badge variant={variants[status] || 'slate'}>{status.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Orders & Recurring Subscriptions</h1>
          <p className="text-xs text-slate-500 mt-0.5">Book one-time orders, manage daily/alternate-day recurring subscriptions, and dispatch daily runs.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100 font-bold"
            onClick={handleGenerateDailyRuns}
            isLoading={isGeneratingRuns}
          >
            <Zap size={14} className="text-amber-600" /> ⚡ Generate Today's Runs
          </Button>
          <Button variant="outline" size="sm" onClick={openScheduleModal}>
            <Calendar size={14} /> + Add Subscription
          </Button>
          <Button size="sm" onClick={openOrderModal}>
            <Plus size={14} /> Create One-Time Order
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="schedules">Recurring Subscriptions ({schedules.length})</TabsTrigger>
          </TabsList>
          {activeTab === 'schedules' && (
            <Button size="sm" onClick={openScheduleModal}>
              <Plus size={14} /> Add Subscription
            </Button>
          )}
        </div>

        {/* ORDERS TAB */}
        <TabsContent value="orders" className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ORDER #</TableHead>
                <TableHead>CUSTOMER</TableHead>
                <TableHead>DATE</TableHead>
                <TableHead>TOTAL</TableHead>
                <TableHead>ASSIGNED RIDER</TableHead>
                <TableHead>STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-bold font-mono text-brand-600">{o.orderNumber}</TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900">{o.customer?.name}</div>
                    <div className="text-xs text-slate-500">{o.customer?.phone}</div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{new Date(o.orderDate || o.createdAt || '').toLocaleDateString()}</TableCell>
                  <TableCell className="font-extrabold text-slate-900">Rs. {Number(o.totalAmount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    {o.delivery?.rider ? (
                      <span className="text-xs font-semibold text-emerald-700">{o.delivery.rider.name}</span>
                    ) : (
                      <Badge variant="amber">Auto (Zone Rider)</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(o.status)}</TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400">
                    No orders yet. Click "Create Order" or "⚡ Generate Today's Runs" to dispatch deliveries.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* RECURRING SCHEDULES TAB */}
        <TabsContent value="schedules" className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SUBSCRIBER</TableHead>
                <TableHead>PRODUCT & QTY</TableHead>
                <TableHead>DELIVERY SCHEDULE</TableHead>
                <TableHead>NEXT RUN DATE</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead className="text-right">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-bold text-slate-900">{s.customer?.name}</div>
                    <div className="text-xs text-slate-500">{s.customer?.zone?.name || 'Unassigned Zone'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900">{s.quantity}x {s.product?.name}</div>
                    <div className="text-xs text-slate-500">Rs. {Number(s.product?.price || 0) * s.quantity} / delivery</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-1 rounded">
                      {formatFrequency(s.frequency)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 font-mono">
                    {new Date(s.nextRunDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'emerald' : 'slate'}>
                      {s.status?.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleToggleScheduleStatus(s.id, s.status)}
                    >
                      {s.status === 'active' ? (
                        <><Pause size={12} className="mr-1 inline text-amber-600" /> Pause</>
                      ) : (
                        <><Play size={12} className="mr-1 inline text-emerald-600" /> Resume</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {schedules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400">
                    No recurring subscriptions yet. Click "+ Add Subscription" to set up automatic daily/alternate-day runs.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* ── CREATE ONE-TIME ORDER MODAL ────────────────────────────────────── */}
      <Dialog isOpen={showOrderModal} onClose={() => setShowOrderModal(false)} title="Create One-Time Delivery Order" maxWidth="2xl">
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Select Customer *</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800"
              value={orderCustomerId}
              onChange={(e) => setOrderCustomerId(e.target.value)}
              required
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) {c.zone ? `— Zone: ${c.zone.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Assign Rider (Optional - Leave blank to auto-route)</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800"
              value={orderRiderId}
              onChange={(e) => setOrderRiderId(e.target.value)}
            >
              <option value="">-- Auto-route to assigned zone rider --</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.phone || 'No phone'})</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <label className="text-xs font-bold text-slate-700 block">Add Products *</label>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <select
                  className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800"
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — Rs.{p.price}</option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <input
                  type="number"
                  min="1"
                  value={addQty}
                  onChange={(e) => setAddQty(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800 text-center"
                />
              </div>
              <Button type="button" size="sm" onClick={handleAddItem} disabled={!addProductId}>
                <Plus size={14} /> Add
              </Button>
            </div>

            {orderItems.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-md overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-600">Product</th>
                      <th className="text-center px-3 py-1.5 font-semibold text-slate-600">Qty</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-slate-600">Price</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-slate-600">Total</th>
                      <th className="px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderItems.map((item) => (
                      <tr key={item.productId}>
                        <td className="px-3 py-1.5 font-semibold text-slate-800">{item.productName}</td>
                        <td className="px-3 py-1.5 text-center font-bold text-brand-700">{item.qty}</td>
                        <td className="px-3 py-1.5 text-right text-slate-600">Rs.{item.price}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-slate-900">Rs.{(item.price * item.qty).toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right">
                          <button type="button" onClick={() => handleRemoveItem(item.productId)} className="text-rose-500 hover:text-rose-700">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50">
                      <td colSpan={3} className="px-3 py-1.5 font-bold text-slate-700">Total Order Amount</td>
                      <td className="px-3 py-1.5 text-right font-extrabold text-slate-900">Rs.{totalOrderAmount.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowOrderModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmittingOrder} disabled={orderItems.length === 0}>
              <ShoppingCart size={14} /> Create One-Time Order
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── CREATE RECURRING SUBSCRIPTION MODAL ────────────────────────────── */}
      <Dialog isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="Create Recurring Delivery Subscription" maxWidth="lg">
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Subscriber Customer *</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800"
              value={schedCustomerId}
              onChange={(e) => setSchedCustomerId(e.target.value)}
              required
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) {c.zone ? `— Zone: ${c.zone.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Product *</label>
              <select
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800"
                value={schedProductId}
                onChange={(e) => setSchedProductId(e.target.value)}
                required
              >
                <option value="">-- Select Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (Rs.{p.price})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Quantity per Delivery *</label>
              <input
                type="number"
                min="1"
                value={schedQty}
                onChange={(e) => setSchedQty(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800"
                required
              />
            </div>
          </div>

          {/* Delivery Frequency Mode */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Delivery Frequency / Cycle *</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { id: 'daily', label: '🔄 Daily', desc: 'Every day' },
                { id: 'alternate_day', label: '🔁 Alternate Days', desc: 'Every 2 days' },
                { id: 'custom_days', label: '📅 Specific Days', desc: 'e.g. Mon, Wed, Fri' },
                { id: 'weekly', label: '📆 Weekly', desc: 'Once a week' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSchedFrequency(f.id as any)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    schedFrequency === f.id
                      ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">{f.label}</div>
                  <div className="text-[10px] text-slate-500">{f.desc}</div>
                </button>
              ))}
            </div>

            {/* Custom Days Selector (if custom_days selected) */}
            {schedFrequency === 'custom_days' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Select Delivery Days of the Week *</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((d, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleSchedDay(idx)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        schedDays.includes(idx)
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-brand-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">The customer will only receive deliveries on these days.</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">First Delivery Start Date *</label>
            <input
              type="date"
              value={schedStartDate}
              onChange={(e) => setSchedStartDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmittingSchedule}>
              <Calendar size={14} /> Save Recurring Subscription
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
