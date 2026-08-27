import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { TenantOnboarding } from './pages/TenantOnboarding';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardHome } from './pages/DashboardHome';
import { RbacManagement } from './pages/RbacManagement';
import { CustomerManagement } from './pages/CustomerManagement';
import { ProductStockManagement } from './pages/ProductStockManagement';
import { ZoneRouteManagement } from './pages/ZoneRouteManagement';
import { OrderScheduleManagement } from './pages/OrderScheduleManagement';
import { EmptiesDepositTracker } from './pages/EmptiesDepositTracker';
import { LiveTrackboard } from './pages/LiveTrackboard';
import { BillingInvoices } from './pages/BillingInvoices';
import { FinanceLedgers } from './pages/FinanceLedgers';
import { NotificationCenter } from './pages/NotificationCenter';
import { SleepingCustomerRadar } from './pages/SleepingCustomerRadar';
import { BreakageWastageTracker } from './pages/BreakageWastageTracker';
import { ReportsAnalytics } from './pages/ReportsAnalytics';
import { ReceiptPrinterStudio } from './pages/ReceiptPrinterStudio';
import { ProductionTracker } from './pages/ProductionTracker';
import { PurchaseManagement } from './pages/PurchaseManagement';
import { SaaSPlanMetering } from './pages/SaaSPlanMetering';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import './styles/theme.css';

const MainApp: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isSuperAdmin = user?.role?.name === 'Super Admin' || user?.email === 'superadmin@tarsil.com';

  const [activeTab, setActiveTab] = useState(() => (isSuperAdmin ? 'superadmin' : 'dashboard'));
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Sync activeTab if user role changes after login
  React.useEffect(() => {
    if (!user) return;
    if (isSuperAdmin && activeTab !== 'superadmin') {
      setActiveTab('superadmin');
    } else if (!isSuperAdmin && activeTab === 'superadmin') {
      setActiveTab('dashboard');
    }
  }, [user, isSuperAdmin, activeTab]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'var(--text-secondary)' }}>
        Loading OmniRoute Cloud Workspace...
      </div>
    );
  }

  if (isOnboarding) {
    return <TenantOnboarding onComplete={() => setIsOnboarding(false)} />;
  }

  if (!isAuthenticated) {
    return <Login onStartOnboarding={() => setIsOnboarding(true)} />;
  }

  const renderTabContent = () => {
    if (activeTab === 'superadmin' && !isSuperAdmin) {
      return <DashboardHome onNavigate={setActiveTab} />;
    }

    switch (activeTab) {
      case 'superadmin':
        return isSuperAdmin ? <SuperAdminDashboard /> : <DashboardHome onNavigate={setActiveTab} />;
      case 'customers':
        return <CustomerManagement />;
      case 'sleeping':
        return <SleepingCustomerRadar />;
      case 'purchase':
        return <PurchaseManagement />;
      case 'products':
        return <ProductStockManagement />;
      case 'production':
        return <ProductionTracker />;
      case 'breakage':
        return <BreakageWastageTracker />;
      case 'zones':
        return <ZoneRouteManagement />;
      case 'orders':
        return <OrderScheduleManagement />;
      case 'empties':
        return <EmptiesDepositTracker />;
      case 'finance':
        return <FinanceLedgers />;
      case 'trackboard':
        return <LiveTrackboard />;
      case 'notifications':
        return <NotificationCenter />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'printer':
        return <ReceiptPrinterStudio />;
      case 'rbac':
        return <RbacManagement />;
      case 'saas':
        return <SaaSPlanMetering />;
      case 'dashboard':
      default:
        return <DashboardHome onNavigate={setActiveTab} />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderTabContent()}
    </DashboardLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};
