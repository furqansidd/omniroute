import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Package, MapPin, ShoppingCart,
  Droplets, DollarSign, Navigation, BarChart3, ShieldCheck,
  Settings, LogOut, Bell, User, ChevronRight, Menu, X, UserX,
  AlertOctagon, Printer, Factory, Zap, Building2, ChevronDown
} from 'lucide-react';

interface Props {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const DashboardLayout: React.FC<Props> = ({ children, activeTab, setActiveTab }) => {
  const { user, logout, hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isSuperAdmin = user?.role?.name === 'Super Admin' || user?.email === 'superadmin@tarsil.com';

  const superAdminNavGroups = [
    {
      title: 'SYSTEM CONTROL PORTAL',
      items: [
        { id: 'superadmin', label: 'Super Admin Control Center', icon: ShieldCheck, perm: null }
      ]
    }
  ];

  const businessOwnerNavGroups = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Home Dashboard', icon: LayoutDashboard, perm: null },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, perm: { module: 'reports', action: 'read' } },
      ]
    },
    {
      title: 'OPERATIONS & LOGISTICS',
      items: [
        { id: 'customers', label: 'Customers', icon: Users, perm: { module: 'customers', action: 'read' } },
        { id: 'sleeping', label: 'Sleeping Radar', icon: UserX, perm: { module: 'customers', action: 'read' } },
        { id: 'orders', label: 'Orders & Schedules', icon: ShoppingCart, perm: { module: 'orders', action: 'read' } },
        { id: 'zones', label: 'Zones & Routes', icon: MapPin, perm: { module: 'zones', action: 'read' } },
        { id: 'trackboard', label: 'Live Trackboard', icon: Navigation, perm: { module: 'routes', action: 'read' } },
      ]
    },
    {
      title: 'INVENTORY & PRODUCTION',
      items: [
        { id: 'products', label: 'Products & Stock', icon: Package, perm: { module: 'products', action: 'read' } },
        { id: 'production', label: 'Production & QC', icon: Factory, perm: { module: 'products', action: 'read' } },
        { id: 'breakage', label: 'Breakage & Spoilage', icon: AlertOctagon, perm: { module: 'products', action: 'read' } },
        { id: 'empties', label: 'Empties & Deposits', icon: Droplets, perm: { module: 'empties', action: 'read' } },
      ]
    },
    {
      title: 'FINANCE & ADMIN',
      items: [
        { id: 'finance', label: 'Finance & Ledgers', icon: DollarSign, perm: { module: 'finance', action: 'read' } },
        { id: 'printer', label: 'Receipt Studio', icon: Printer, perm: null },
        { id: 'notifications', label: 'Notifications Hub', icon: Bell, perm: { module: 'notifications', action: 'read' } },
        { id: 'rbac', label: 'Roles & RBAC', icon: ShieldCheck, perm: { module: 'roles', action: 'read' } },
        { id: 'saas', label: 'SaaS Subscription', icon: Zap, perm: null },
        { id: 'settings', label: 'Settings', icon: Settings, perm: { module: 'settings', action: 'read' } }
      ]
    }
  ];

  const activeNavGroups = isSuperAdmin ? superAdminNavGroups : businessOwnerNavGroups;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* TOP BAR */}
      <header className="h-14 bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${isSuperAdmin ? 'bg-slate-900' : 'bg-brand-600'} flex items-center justify-center text-white font-bold text-sm shadow-xs`}>
              {isSuperAdmin ? 'SA' : 'TR'}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">
                {isSuperAdmin ? 'Tarsil Platform Control' : 'Tarsil Operations'}
              </div>
              <div className="text-[10px] font-medium text-slate-500">
                {isSuperAdmin ? 'System Super Admin Control Panel' : 'Multi-Tenant Delivery SaaS'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Tenant / Admin Indicator */}
          {isSuperAdmin ? (
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded-md border border-slate-800 text-xs font-bold shadow-xs">
              <ShieldCheck size={14} className="text-brand-400" />
              <span>SYSTEM SUPER ADMIN PORTAL</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-700">
              <Building2 size={14} className="text-brand-600" />
              <span>{user?.tenant?.companyName || 'AquaFlow Pure Water Supply'}</span>
            </div>
          )}

          {/* Notifications Bell */}
          <button
            onClick={() => setActiveTab('notifications')}
            className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-600 rounded-full"></span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className={`w-8 h-8 rounded-full ${isSuperAdmin ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'} flex items-center justify-center font-bold text-xs`}>
              {user?.name?.slice(0, 2).toUpperCase() || 'SA'}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-900 leading-tight">{user?.name || 'Super Admin'}</div>
              <div className="text-[10px] text-slate-500">{user?.role?.name || 'Platform Operator'}</div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex pt-14 flex-1">
        {/* FIXED LEFT SIDEBAR */}
        <aside
          className={`bg-white border-r border-slate-200 fixed top-14 bottom-0 left-0 z-20 w-64 flex flex-col transition-all duration-200 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {activeNavGroups.map((group, idx) => {
              const visibleItems = group.items.filter(item =>
                !item.perm || hasPermission(item.perm.module, item.perm.action)
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={idx} className="space-y-1">
                  <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {group.title}
                  </div>
                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-brand-50 text-brand-700 font-bold border-l-4 border-brand-600 shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon size={16} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Tarsil SaaS v1.0.0</span>
            <span className="font-semibold text-emerald-600">● Live Operational</span>
          </div>
        </aside>

        {/* CONTENT AREA */}
        <main
          className={`flex-1 transition-all duration-200 p-6 min-h-[calc(100vh-3.5rem)] ${
            sidebarOpen ? 'ml-64' : 'ml-0'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
