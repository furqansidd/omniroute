import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Users, Plus, Search, MapPin, Phone, Mail, Edit3, Trash2, DollarSign,
  Droplets, CheckCircle2, ShieldCheck, X, Compass, AlertCircle, Link2, Layers
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

// Fix default Leaflet icon paths in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface CustomerItem {
  id: string;
  name: string;
  businessName: string | null;
  phone: string;
  email: string | null;
  address: string;
  zoneId?: string;
  geoLat: number | null;
  geoLng: number | null;
  stopNumber: number | null;
  status: string;
  createdAt: string;
  zone?: { id: string; name: string };
  route?: { name: string };
}

interface ZoneItem {
  id: string;
  name: string;
  description: string | null;
}

// Utility function to extract latitude & longitude from Google Maps URLs or raw coordinate strings
const parseGoogleMapsUrlOrCoords = (input: string): { lat: number; lng: number } | null => {
  if (!input) return null;

  // 1. Matches Google Maps URLs containing @lat,lng e.g. @31.5204,74.3587
  const atMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // 2. Matches q=lat,lng or ll=lat,lng or query=lat,lng
  const queryMatch = input.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
  }

  // 3. Matches direct lat, lng string like "31.5204, 74.3587" or "31.5204 74.3587"
  const directMatch = input.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (directMatch) {
    return { lat: parseFloat(directMatch[1]), lng: parseFloat(directMatch[2]) };
  }

  return null;
};

export const CustomerManagement: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [stopNumber, setStopNumber] = useState<number | ''>('');
  const [geoLat, setGeoLat] = useState<number>(31.5204);
  const [geoLng, setGeoLng] = useState<number>(74.3587);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Free OpenStreetMap Nominatim Geocoding Autocomplete
  const [geocodingSuggestions, setGeocodingSuggestions] = useState<any[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let query = '/customers?';
      if (searchTerm) query += `search=${encodeURIComponent(searchTerm)}&`;
      if (selectedZoneFilter) query += `zoneId=${encodeURIComponent(selectedZoneFilter)}&`;

      const [cRes, zRes] = await Promise.all([
        apiRequest<CustomerItem[]>(query),
        apiRequest<ZoneItem[]>('/zones')
      ]);

      if (cRes.success && cRes.data) setCustomers(cRes.data);
      if (zRes.success && zRes.data) setZones(zRes.data);
    } catch (err) {
      console.error('Failed to fetch customers and zones:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchTerm, selectedZoneFilter]);

  // Center OpenStreetMap and update marker when Lat/Lng changes
  const updateMapLocation = async (lat: number, lng: number, fetchReverseAddress = true) => {
    const validLat = Math.round(lat * 1000000) / 1000000;
    const validLng = Math.round(lng * 1000000) / 1000000;
    setGeoLat(validLat);
    setGeoLng(validLng);

    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([validLat, validLng], 16);
      markerRef.current.setLatLng([validLat, validLng]);
    }

    if (fetchReverseAddress) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${validLat}&lon=${validLng}`);
        const data = await res.json();
        if (data && data.display_name) {
          setAddress(data.display_name);
        }
      } catch (e) {
        console.error('Reverse geocode failed:', e);
      }
    }
  };

  // Initialize Free OpenStreetMap Leaflet map inside modal when modal opens
  useEffect(() => {
    if (!showModal || !mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const currentLat = geoLat || 31.5204;
    const currentLng = geoLng || 74.3587;

    const map = L.map(mapContainerRef.current).setView([currentLat, currentLng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([currentLat, currentLng], { draggable: true }).addTo(map);

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      updateMapLocation(position.lat, position.lng, true);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      updateMapLocation(e.latlng.lat, e.latlng.lng, true);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [showModal]);

  // Handle Google Maps URL or Coordinates paste input
  const handleGoogleMapsPaste = (val: string) => {
    setGoogleMapsUrl(val);
    const parsed = parseGoogleMapsUrlOrCoords(val);
    if (parsed) {
      updateMapLocation(parsed.lat, parsed.lng, true);
    }
  };

  // Free OpenStreetMap Nominatim Geocoding Autocomplete
  const handleAddressSearch = async (query: string) => {
    setAddress(query);
    if (!query || query.length < 3) {
      setGeocodingSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setGeocodingSuggestions(data);
      }
    } catch (err) {
      console.error('Nominatim Geocoding failed:', err);
    }
  };

  const selectSuggestion = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setAddress(item.display_name);
    updateMapLocation(lat, lng, false);
    setGeocodingSuggestions([]);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !address) {
      alert('Please fill in Name, Phone, and Address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = editingId ? `/customers/${editingId}` : '/customers';
      const method = editingId ? 'PUT' : 'POST';

      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify({
          name: name.trim(),
          businessName: businessName.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim(),
          zoneId: zoneId || undefined,
          stopNumber: stopNumber !== '' ? Number(stopNumber) : undefined,
          geoLat,
          geoLng
        })
      });

      if (res.success) {
        setShowModal(false);
        resetForm();
        fetchData();
      } else {
        alert(`Error saving customer: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, customerName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${customerName}"? This will remove all associated orders and records.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/customers/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchData();
      } else {
        alert(`Failed to delete: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error deleting customer: ${err.message}`);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setBusinessName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setZoneId('');
    setStopNumber('');
    setGoogleMapsUrl('');
    setGeoLat(31.5204);
    setGeoLng(74.3587);
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage subscriber delivery profiles, custom product rates, zone territory assignments, and map pins.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus size={16} /> Add New Customer
        </Button>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <Card className="border-slate-200">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, phone, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Zone Filter Dropdown */}
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-md py-1.5 px-3 text-xs font-semibold text-slate-700"
            >
              <option value="">All Delivery Zones ({zones.length})</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total Customers: <span className="font-bold text-slate-900">{customers.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* CUSTOMERS TABLE */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CUSTOMER / BUSINESS</TableHead>
            <TableHead>CONTACT INFORMATION</TableHead>
            <TableHead>DELIVERY ADDRESS & MAP PIN</TableHead>
            <TableHead>ZONE / STOP #</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead className="text-right">ACTIONS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <div className="font-bold text-slate-900">{c.name}</div>
                {c.businessName && <div className="text-xs text-slate-500">{c.businessName}</div>}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-xs text-slate-700 font-semibold">
                  <Phone size={12} className="text-slate-400" /> {c.phone}
                </div>
                {c.email && <div className="text-[11px] text-slate-500">{c.email}</div>}
              </TableCell>
              <TableCell>
                <div className="text-xs text-slate-800 font-medium max-w-xs truncate">{c.address}</div>
                {c.geoLat && c.geoLng ? (
                  <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                    <MapPin size={10} /> Pin Dropped ({c.geoLat.toFixed(4)}, {c.geoLng.toFixed(4)})
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400">No GIS Pin</div>
                )}
              </TableCell>
              <TableCell>
                {c.zone ? (
                  <div className="space-y-1">
                    <Badge variant="blue" className="font-bold">
                      <Layers size={12} className="mr-1 inline" /> {c.zone.name}
                    </Badge>
                    {c.stopNumber != null && (
                      <div className="text-[11px] font-bold text-brand-700">Stop #{c.stopNumber}</div>
                    )}
                  </div>
                ) : (
                  <Badge variant="amber">Unassigned Zone</Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={c.status === 'active' ? 'emerald' : c.status === 'sleeping' ? 'amber' : 'slate'}>
                  {c.status.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(c.id);
                      setName(c.name);
                      setBusinessName(c.businessName || '');
                      setPhone(c.phone);
                      setEmail(c.email || '');
                      setAddress(c.address);
                      setZoneId(c.zoneId || c.zone?.id || '');
                      setStopNumber(c.stopNumber ?? '');
                      setGoogleMapsUrl('');
                      const targetLat = c.geoLat || 31.5204;
                      const targetLng = c.geoLng || 74.3587;
                      setGeoLat(targetLat);
                      setGeoLng(targetLng);
                      setShowModal(true);
                    }}
                  >
                    <Edit3 size={14} /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                    onClick={() => handleDeleteCustomer(c.id, c.name)}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </TableCell>

            </TableRow>
          ))}

          {customers.length === 0 && !isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400">
                No customer accounts found. Click "Add New Customer" to record a delivery profile.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* ADD / EDIT CUSTOMER MODAL WITH EMBEDDED OPENSTREETMAP MAP & GOOGLE MAPS LINK PARSER */}
      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Customer Profile' : 'Add New Delivery Customer'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Customer Full Name *"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
            />
            <Input
              label="Business / Company Name (Optional)"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Metro Cafe"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number *"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 300 1234567"
            />
            <Input
              label="Email Address (Optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@example.com"
            />
          </div>

          {/* ZONE SELECTION + STOP NUMBER */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Select Delivery Zone *
              </label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Choose Delivery Zone --</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} {z.description ? `(${z.description})` : ''}
                  </option>
                ))}
              </select>
              {zones.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  ⚠️ No delivery zones created yet. Create zones in "Zones & Routes" first.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Stop # in Zone
              </label>
              <input
                type="number"
                min="1"
                value={stopNumber}
                onChange={(e) => setStopNumber(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 3"
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Rider delivery order (Stop 1 first)</p>
            </div>
          </div>

          {/* GOOGLE MAPS LINK / COORDINATE QUICK-PASTE INPUT */}
          <div className="bg-brand-50/50 p-3 rounded-lg border border-brand-200 space-y-2">
            <label className="text-xs font-bold text-brand-900 flex items-center gap-1.5">
              <Link2 size={14} className="text-brand-600" />
              Paste Google Maps Link or Coordinates (Auto-locate OpenStreetMap)
            </label>
            <input
              type="text"
              value={googleMapsUrl}
              onChange={(e) => handleGoogleMapsPaste(e.target.value)}
              placeholder="Paste Google Maps URL (e.g. https://maps.app.goo.gl/... or 31.5204, 74.3587)"
              className="w-full bg-white border border-brand-300 rounded-md p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
            <p className="text-[11px] text-slate-500">
              💡 Pasting a Google Maps link or coordinates automatically centers OpenStreetMap, places the pin, and auto-fills the delivery address!
            </p>
          </div>

          {/* LATITUDE & LONGITUDE MANUAL INPUTS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Latitude (geoLat)</label>
              <input
                type="number"
                step="any"
                value={geoLat}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateMapLocation(val, geoLng, true);
                }}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Longitude (geoLng)</label>
              <input
                type="number"
                step="any"
                value={geoLng}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateMapLocation(geoLat, val, true);
                }}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          {/* FREE OPENSTREETMAP ADDRESS SEARCH & AUTOCOMPLETE */}
          <div className="relative">
            <Input
              label="Delivery Address *"
              required
              value={address}
              onChange={(e) => handleAddressSearch(e.target.value)}
              placeholder="Type street address or area to center map..."
            />
            {geocodingSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-30 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {geocodingSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectSuggestion(item)}
                    className="p-2.5 hover:bg-slate-50 text-xs text-slate-800 cursor-pointer flex items-center gap-2"
                  >
                    <MapPin size={14} className="text-brand-600 shrink-0" />
                    <span>{item.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EMBEDDED FREE OPENSTREETMAP CANVAS FOR DRAGGABLE PIN DROP */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Compass size={14} className="text-brand-600" /> Fine-Tune Pin Drop (Drag red marker or click map)
              </span>
              <span className="text-slate-500 font-mono">
                Location: ({Number(geoLat || 0).toFixed(6)}, {Number(geoLng || 0).toFixed(6)})
              </span>
            </div>

            <div ref={mapContainerRef} className="w-full h-56 rounded-md border border-slate-300 overflow-hidden z-0" />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId ? 'Save Customer Changes' : 'Create Customer Account'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
