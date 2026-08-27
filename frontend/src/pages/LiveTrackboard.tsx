import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation, Battery, Gauge, RefreshCw, Radio, MapPin,
  Clock, Phone, Truck, ShieldCheck, AlertCircle, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

// Fix default Leaflet icon paths in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DeliveredStopItem {
  deliveryId: string;
  customerName: string;
  customerAddress: string;
  stopNumber?: number;
  geoLat: number;
  geoLng: number;
  deliveredQty: number;
  cashCollected: number;
  deliveredAt: string;
}

interface LiveRiderItem {
  rider: { id: string; name: string; phone: string; email: string };
  isOnline: boolean;
  status: string;
  pendingDeliveriesCount: number;
  deliveredStops?: DeliveredStopItem[];
  latestPing: {
    geoLat: number;
    geoLng: number;
    speed: number;
    batteryLevel: number;
    timestamp: string;
  } | null;
}

interface PingHistoryItem {
  id: string;
  geoLat: number;
  geoLng: number;
  speed: number;
  batteryLevel: number;
  timestamp: string;
}

export const LiveTrackboard: React.FC = () => {
  const { user } = useAuth();
  const [riders, setRiders] = useState<LiveRiderItem[]>([]);
  const [selectedRider, setSelectedRider] = useState<LiveRiderItem | null>(null);
  const [routeHistory, setRouteHistory] = useState<PingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  const fetchLiveRiders = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<LiveRiderItem[]>('/trackboard/live');
      if (res.success && res.data) setRiders(res.data);
    } catch (err) {
      console.error('Failed to fetch live riders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveRiders();
    const interval = setInterval(fetchLiveRiders, 15000); // 15s auto-refresh
    return () => clearInterval(interval);
  }, []);

  // Initialize OpenStreetMap Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([31.4504, 73.1350], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Rider Markers & Delivery Pins on Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const bounds: L.LatLngExpression[] = [];

    riders.forEach(r => {
      // 1. Live Rider Marker
      if (r.latestPing) {
        const lat = r.latestPing.geoLat;
        const lng = r.latestPing.geoLng;
        bounds.push([lat, lng]);

        const iconHtml = `
          <div style="background-color: ${r.isOnline ? '#0284c7' : '#64748b'}; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); font-size: 18px; cursor: pointer;">
            🚚
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-leaflet-rider-marker',
          html: iconHtml,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; padding: 6px; min-width: 190px;">
            <div style="font-weight: 800; font-size: 14px; color: #0f172a;">${r.rider.name}</div>
            <div style="font-size: 12px; color: #64748b;">${r.rider.phone}</div>
            <div style="margin-top: 6px; font-size: 12px;">
              <span style="font-weight: bold; color: ${r.isOnline ? '#10b981' : '#64748b'};">${r.isOnline ? '🟢 ONLINE (Pinging)' : '⚪ OFFLINE'}</span>
              <br/>📦 ${r.pendingDeliveriesCount} Pending Stops
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
              ⚡ Speed: ${r.latestPing.speed} km/h • 🔋 Battery: ${r.latestPing.batteryLevel}%<br/>
              🕒 Updated: ${new Date(r.latestPing.timestamp).toLocaleTimeString()}
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], { icon: customIcon })
          .bindPopup(popupContent)
          .addTo(mapRef.current!);

        marker.on('click', () => {
          setSelectedRider(r);
          loadRiderHistory(r.rider.id);
        });

        markersRef.current.push(marker);
      }

      // 2. Delivered Drop Locations for this Rider
      if (r.deliveredStops && r.deliveredStops.length > 0) {
        r.deliveredStops.forEach(drop => {
          if (!drop.geoLat || !drop.geoLng) return;
          bounds.push([drop.geoLat, drop.geoLng]);

          const dropIconHtml = `
            <div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.3); font-size: 14px;">
              ✅
            </div>
          `;

          const dropIcon = L.divIcon({
            className: 'custom-leaflet-drop-marker',
            html: dropIconHtml,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          const dropPopup = `
            <div style="font-family: system-ui, sans-serif; padding: 6px; min-width: 200px;">
              <div style="font-weight: 800; font-size: 13px; color: #065f46;">✅ DELIVERED STOP ${drop.stopNumber ? '#' + drop.stopNumber : ''}</div>
              <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-top: 2px;">${drop.customerName}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${drop.customerAddress}</div>
              <div style="margin-top: 6px; font-size: 11px; color: #334155; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                📦 Delivered: <b>${drop.deliveredQty} bottles</b><br/>
                💵 Cash Collected: <b>Rs. ${Number(drop.cashCollected || 0).toLocaleString()}</b><br/>
                🕒 Delivered At: <b>${new Date(drop.deliveredAt).toLocaleTimeString()}</b><br/>
                🚚 Rider: ${r.rider.name}
              </div>
            </div>
          `;

          const dropMarker = L.marker([drop.geoLat, drop.geoLng], { icon: dropIcon })
            .bindPopup(dropPopup)
            .addTo(mapRef.current!);

          markersRef.current.push(dropMarker);
        });
      }
    });

    if (bounds.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
    }
  }, [riders]);

  // Load and draw route history path line
  const loadRiderHistory = async (riderId: string) => {
    try {
      const res = await apiRequest<PingHistoryItem[]>(`/trackboard/history/${riderId}`);
      if (res.success && res.data && res.data.length > 0) {
        setRouteHistory(res.data);
        drawRoutePathOnMap(res.data);
      }
    } catch (err) {
      console.error('Failed to load rider route history:', err);
    }
  };

  const drawRoutePathOnMap = (pings: PingHistoryItem[]) => {
    if (!mapRef.current || pings.length === 0) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
    }

    const latLngs: L.LatLngExpression[] = pings.map(p => [p.geoLat, p.geoLng]);
    const polyline = L.polyline(latLngs, { color: '#0284c7', weight: 5, opacity: 0.85 }).addTo(mapRef.current);
    polylineRef.current = polyline;

    mapRef.current.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live Rider Trackboard & Fleet Telemetry</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time GPS tracking (20s intervals), battery/speed telemetry, and delivered stop verification pins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLiveRiders} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh GPS Telemetry
          </Button>
        </div>
      </div>

      {/* LIVE TELEMETRY MAP CANVAS */}
      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation size={18} className="text-brand-600" /> Live GPS Fleet Map & Delivery Drop Points
            </CardTitle>
            <CardDescription className="text-xs">
              🚚 Blue Markers = Live Rider Position • ✅ Green Markers = Verified Delivered Locations with Timestamps
            </CardDescription>
          </div>
          {selectedRider && (
            <Button variant="secondary" size="sm" onClick={() => setSelectedRider(null)}>
              <ArrowLeft size={14} /> Clear Selection
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 relative">
          <div ref={mapContainerRef} className="w-full h-96 z-0" />
        </CardContent>
      </Card>

      {/* FLEET RIDER STATUS CARDS GRID */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Active Delivery Fleet ({riders.length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {riders.map((r) => (
            <Card
              key={r.rider.id}
              onClick={() => {
                setSelectedRider(r);
                loadRiderHistory(r.rider.id);
              }}
              className={`border cursor-pointer transition-all ${
                selectedRider?.rider.id === r.rider.id ? 'border-brand-600 ring-2 ring-brand-500/20 bg-brand-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">{r.rider.name}</div>
                  <Badge variant={r.isOnline ? 'emerald' : 'slate'}>
                    {r.isOnline ? '🟢 ONLINE' : '⚪ OFFLINE'}
                  </Badge>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Phone size={12} className="text-slate-400" /> {r.rider.phone}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Truck size={12} className="text-slate-400" /> {r.pendingDeliveriesCount} Pending Stops Today
                  </div>
                  {r.deliveredStops && r.deliveredStops.length > 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <CheckCircle2 size={12} className="text-emerald-600" /> {r.deliveredStops.length} Deliveries Completed Today
                    </div>
                  )}
                </div>

                {r.latestPing ? (
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-slate-600">
                      <Gauge size={12} className="text-brand-500" /> {r.latestPing.speed} km/h
                    </div>
                    <div className="flex items-center gap-1 text-slate-600">
                      <Battery size={12} className="text-emerald-500" /> {r.latestPing.batteryLevel}% Battery
                    </div>
                    <div className="col-span-2 flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock size={10} /> Ping: {new Date(r.latestPing.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
                    <AlertCircle size={12} /> No GPS telemetry received yet
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
