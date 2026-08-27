import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Route as RouteIcon, Plus, Layers, Trash2,
  Users, Truck, UserCheck
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ZONE_COLORS = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ZoneItem { id: string; name: string; description: string | null; geoBoundary: string | null; assignedSupervisorId: string | null; }
interface RouteItem { id: string; zoneId: string; name: string; sequenceOrder: number; zone?: { name: string }; }
interface CustomerMapItem { id: string; name: string; phone: string; address: string; geoLat: number | null; geoLng: number | null; stopNumber: number | null; zoneId: string | null; zone?: { id: string; name: string }; }
interface UserItem { id: string; name: string; phone: string | null; email: string | null; role: { id: string; name: string }; }
interface VisitPlanItem { id: string; routeId: string; riderId: string; dayOfWeek: number; scheduleType: string; route: { id: string; name: string; zone?: { id: string; name: string } }; rider: { id: string; name: string; phone: string | null }; }

export const ZoneRouteManagement: React.FC = () => {
  const { user } = useAuth();
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [riders, setRiders] = useState<UserItem[]>([]);
  const [visitPlans, setVisitPlans] = useState<VisitPlanItem[]>([]);
  const [customers, setCustomers] = useState<CustomerMapItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneDesc, setZoneDesc] = useState('');
  const [isSubmittingZone, setIsSubmittingZone] = useState(false);

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeZoneId, setRouteZoneId] = useState('');
  const [routeSequence, setRouteSequence] = useState<number>(1);
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  const mainMapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const customerMarkersRef = useRef<L.Marker[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [zRes, rRes, uRes, vpRes, cRes] = await Promise.all([
        apiRequest<ZoneItem[]>('/zones'),
        apiRequest<RouteItem[]>('/routes'),
        apiRequest<UserItem[]>('/rbac/users'),
        apiRequest<VisitPlanItem[]>('/visit-plans'),
        apiRequest<any>('/customers?limit=500')
      ]);
      if (zRes.success && zRes.data) setZones(zRes.data);
      if (rRes.success && rRes.data) setRoutes(rRes.data);
      if (vpRes.success && vpRes.data) setVisitPlans(vpRes.data);
      if (cRes.success && cRes.data) {
        const arr = Array.isArray(cRes.data) ? cRes.data : (cRes.data.customers || []);
        setCustomers(arr);
      }
      if (uRes.success && Array.isArray(uRes.data)) {
        const onlyRiders = uRes.data.filter(u => 
          u.role?.name?.toLowerCase().includes('rider') || 
          u.role?.name?.toLowerCase().includes('driver') ||
          u.role?.name?.toLowerCase().includes('delivery')
        );
        setRiders(onlyRiders);
      }
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!mainMapContainerRef.current || mapRef.current) return;
    const map = L.map(mainMapContainerRef.current).setView([31.4504, 73.1350], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    customerMarkersRef.current.forEach(m => m.remove());
    customerMarkersRef.current = [];
    const zoneColorMap = new Map<string, string>();
    zones.forEach((z, idx) => zoneColorMap.set(z.id, ZONE_COLORS[idx % ZONE_COLORS.length]));
    const bounds: L.LatLngExpression[] = [];
    customers.forEach((c) => {
      if (!c.geoLat || !c.geoLng) return;
      const color = c.zoneId ? (zoneColorMap.get(c.zoneId) || '#64748b') : '#64748b';
      const marker = L.circleMarker([c.geoLat, c.geoLng], { radius: 8, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9 }).addTo(mapRef.current!);
      const stopBadge = c.stopNumber != null ? `<b>Stop #${c.stopNumber}</b> &bull; ` : '';
      marker.bindPopup(`<div style="min-width:150px"><div style="font-weight:800;font-size:13px">${c.name}</div><div style="font-size:11px;color:#475569">${stopBadge}${c.zone?.name || 'Unassigned'}</div><div style="font-size:11px;color:#64748b">${c.phone}</div><div style="font-size:10px;color:#94a3b8">${c.address}</div></div>`);
      customerMarkersRef.current.push(marker as any);
      bounds.push([c.geoLat, c.geoLng]);
    });
    if (bounds.length > 0 && mapRef.current) mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
  }, [customers, zones]);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName) return;
    setIsSubmittingZone(true);
    try {
      const res = await apiRequest('/zones', { method: 'POST', body: JSON.stringify({ name: zoneName.trim(), description: zoneDesc.trim() || undefined }) });
      if (res.success) { setShowZoneModal(false); setZoneName(''); setZoneDesc(''); fetchData(); }
      else alert(`Error: ${res.error}`);
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmittingZone(false); }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeZoneId || !routeName) { alert('Select a Zone and enter a Route name.'); return; }
    setIsSubmittingRoute(true);
    try {
      const res = await apiRequest('/routes', { method: 'POST', body: JSON.stringify({ zoneId: routeZoneId, name: routeName.trim(), sequenceOrder: routeSequence }) });
      if (res.success) { setShowRouteModal(false); setRouteName(''); setRouteZoneId(''); setRouteSequence(1); fetchData(); }
      else alert(`Error: ${res.error}`);
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmittingRoute(false); }
  };

  const handleAssignRiderToRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRiderId || !selectedRouteId) { alert('Select both a Rider and a Route'); return; }
    if (selectedDays.length === 0) { alert('Select at least one delivery day'); return; }
    setIsSubmittingAssignment(true);
    try {
      const results = await Promise.all(
        selectedDays.map(day => apiRequest('/visit-plans', { method: 'POST', body: JSON.stringify({ routeId: selectedRouteId, riderId: selectedRiderId, dayOfWeek: day, scheduleType: 'daily' }) }))
      );
      const failed = results.find(r => !r.success);
      if (failed) alert(`Error: ${failed.error}`);
      else { setShowAssignModal(false); setSelectedRiderId(''); setSelectedRouteId(''); setSelectedDays([1,2,3,4,5,6]); fetchData(); }
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmittingAssignment(false); }
  };

  const toggleDay = (day: number) => setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const handleDeleteRoute = async (id: string, name: string) => {
    if (!window.confirm(`Delete route "${name}"?`)) return;
    const res = await apiRequest(`/routes/${id}`, { method: 'DELETE' });
    if (res.success) fetchData(); else alert(`Failed: ${res.error}`);
  };

  const handleDeleteZone = async (id: string, name: string) => {
    if (!window.confirm(`Delete zone "${name}"? Customers will be unassigned.`)) return;
    const res = await apiRequest(`/zones/${id}`, { method: 'DELETE' });
    if (res.success) fetchData(); else alert(`Failed: ${res.error}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Zones, Routes & Rider Assignments</h1>
          <p className="text-xs text-slate-500 mt-0.5">Create zones &rarr; add routes &rarr; assign riders &rarr; set customer stop numbers in Customer Management.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowAssignModal(true)}><UserCheck size={16} /> Assign Rider to Route</Button>
          <Button variant="outline" size="sm" onClick={() => setShowRouteModal(true)}><RouteIcon size={16} /> Add Route</Button>
          <Button size="sm" onClick={() => setShowZoneModal(true)}><Plus size={16} /> Create Zone</Button>
        </div>
      </div>

      {/* RIDERS TABLE */}
      <Card className="border-brand-200 bg-brand-50/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle><Truck size={18} className="text-brand-600" /> Active Riders & Route Assignments ({riders.length})</CardTitle>
            <CardDescription>Registered riders with their assigned delivery routes and days</CardDescription>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAssignModal(true)}>+ Assign Rider</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RIDER</TableHead>
                <TableHead>CONTACT</TableHead>
                <TableHead>ROLE</TableHead>
                <TableHead>ASSIGNED ROUTE & ZONE</TableHead>
                <TableHead>DELIVERY DAYS</TableHead>
                <TableHead>ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riders.map((r) => {
                const riderPlans = visitPlans.filter(vp => vp.riderId === r.id);
                const firstPlan = riderPlans[0];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">{r.name.substring(0, 2).toUpperCase()}</div>
                        {r.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 font-medium">{r.phone || r.email || 'N/A'}</TableCell>
                    <TableCell><Badge variant="blue">{r.role?.name || 'Staff'}</Badge></TableCell>
                    <TableCell>
                      {firstPlan ? (
                        <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                          <MapPin size={14} className="text-emerald-600" />
                          {firstPlan.route?.name} &mdash; {firstPlan.route?.zone?.name || 'Zone'}
                        </div>
                      ) : <Badge variant="amber">Unassigned</Badge>}
                    </TableCell>
                    <TableCell>
                      {riderPlans.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {riderPlans.map(vp => (
                            <span key={vp.id} className="text-[10px] bg-brand-100 text-brand-800 font-bold px-1.5 py-0.5 rounded">
                              {DAY_NAMES[vp.dayOfWeek]?.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => { setSelectedRiderId(r.id); setShowAssignModal(true); }}>
                        {firstPlan ? 'Re-assign' : 'Assign Route'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {riders.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-slate-400">No staff registered yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MAP */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle><Layers size={18} className="text-brand-600" /> Customer Delivery Pins by Zone</CardTitle>
          <CardDescription>Colored pins = customers. Click any pin to see name, stop #, zone, and address.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {zones.length > 0 && (
            <div className="flex flex-wrap gap-3 px-4 py-2 border-b border-slate-100">
              {zones.map((z, idx) => (
                <div key={z.id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <div className="w-3 h-3 rounded-full border border-white shadow" style={{ background: ZONE_COLORS[idx % ZONE_COLORS.length] }} />{z.name}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-3 h-3 rounded-full bg-slate-400 border border-white shadow" />Unassigned
              </div>
            </div>
          )}
          <div ref={mainMapContainerRef} className="w-full h-96 rounded-b-lg overflow-hidden z-0" />
        </CardContent>
      </Card>

      {/* ZONES + ROUTES TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><MapPin size={16} className="text-brand-600" /> Delivery Zones ({zones.length})</h2>
            <Button size="sm" variant="outline" onClick={() => setShowZoneModal(true)}><Plus size={14} /> New Zone</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ZONE NAME</TableHead>
                <TableHead>DESCRIPTION</TableHead>
                <TableHead>CUSTOMERS</TableHead>
                <TableHead className="text-right">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z, idx) => {
                const count = customers.filter(c => c.zoneId === z.id).length;
                return (
                  <TableRow key={z.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: ZONE_COLORS[idx % ZONE_COLORS.length] }} />
                        <span className="font-bold text-slate-900">{z.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{z.description || '—'}</TableCell>
                    <TableCell><Badge variant="blue">{count}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteZone(z.id, z.name)}>
                        <Trash2 size={13} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {zones.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-xs text-slate-400">No zones yet. Click "Create Zone".</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><RouteIcon size={16} className="text-emerald-600" /> Routes ({routes.length})</h2>
            <Button size="sm" variant="outline" onClick={() => setShowRouteModal(true)}><Plus size={14} /> New Route</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ROUTE NAME</TableHead>
                <TableHead>ZONE</TableHead>
                <TableHead>SEQ</TableHead>
                <TableHead>RIDER</TableHead>
                <TableHead className="text-right">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => {
                const plan = visitPlans.find(vp => vp.routeId === r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold text-slate-900">{r.name}</TableCell>
                    <TableCell className="text-xs text-slate-600">{r.zone?.name || '—'}</TableCell>
                    <TableCell className="text-xs font-mono font-bold text-brand-600">#{r.sequenceOrder}</TableCell>
                    <TableCell>{plan ? <span className="text-xs font-semibold text-emerald-700">{plan.rider?.name}</span> : <Badge variant="amber">No rider</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteRoute(r.id, r.name)}>
                        <Trash2 size={13} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {routes.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-xs text-slate-400">No routes yet. Click "Add Route".</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* CREATE ZONE MODAL */}
      <Dialog isOpen={showZoneModal} onClose={() => setShowZoneModal(false)} title="Create Delivery Zone" maxWidth="md">
        <form onSubmit={handleCreateZone} className="space-y-4">
          <Input label="Zone Name *" required value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="e.g. Gulberg Sector A" />
          <Input label="Description (Optional)" value={zoneDesc} onChange={(e) => setZoneDesc(e.target.value)} placeholder="e.g. Morning deliveries, west side" />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowZoneModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmittingZone}>Save Zone</Button>
          </div>
        </form>
      </Dialog>

      {/* CREATE ROUTE MODAL */}
      <Dialog isOpen={showRouteModal} onClose={() => setShowRouteModal(false)} title="Add Route to a Zone" maxWidth="md">
        <form onSubmit={handleCreateRoute} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Select Zone *</label>
            <select className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800" value={routeZoneId} onChange={(e) => setRouteZoneId(e.target.value)} required>
              <option value="">-- Pick a Zone --</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            {zones.length === 0 && <p className="text-[11px] text-amber-600 mt-1">Create a Zone first.</p>}
          </div>
          <Input label="Route Name *" required value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g. Morning Run" />
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Sequence Order</label>
            <input type="number" min="1" value={routeSequence} onChange={(e) => setRouteSequence(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800" />
            <p className="text-[11px] text-slate-400 mt-1">Order this route runs within the zone (1 = first)</p>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowRouteModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmittingRoute}>Save Route</Button>
          </div>
        </form>
      </Dialog>

      {/* ASSIGN RIDER MODAL */}
      <Dialog isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Rider to Route" maxWidth="md">
        <form onSubmit={handleAssignRiderToRoute} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Select Rider *</label>
            <select className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800" value={selectedRiderId} onChange={(e) => setSelectedRiderId(e.target.value)} required>
              <option value="">-- Choose Rider --</option>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.phone || r.email || 'No contact'}) — {r.role?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Select Route *</label>
            <select className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800" value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)} required>
              <option value="">-- Choose Route --</option>
              {routes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name} — Zone: {rt.zone?.name || 'Unassigned'}</option>)}
            </select>
            {routes.length === 0 && <p className="text-[11px] text-amber-600 mt-1">No routes yet. Add a Route first.</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">Delivery Days *</label>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((day, idx) => (
                <button key={idx} type="button" onClick={() => toggleDay(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${selectedDays.includes(idx) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300 hover:border-brand-400'}`}>
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Rider sees this route on the selected days in the mobile app.</p>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmittingAssignment}>Assign Rider to Route</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
