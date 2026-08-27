import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MODULES = [
  'tenants', 'users', 'roles', 'customers', 'products',
  'zones', 'routes', 'orders', 'stock', 'empties',
  'finance', 'notifications', 'reports', 'breakage', 'settings'
];

const ACTIONS = [
  'create', 'read', 'update', 'delete', 'approve',
  'export', 'issue_credit_note', 'override_price', 'view_pnl'
];

async function main() {
  console.log('🌱 Starting comprehensive database seed for Module 2...');

  // 1. Seed Permissions Matrix
  const createdPermissions: Record<string, string> = {};
  for (const module of MODULES) {
    for (const action of ACTIONS) {
      const perm = await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action, description: `Can ${action} ${module}` }
      });
      createdPermissions[`${module}:${action}`] = perm.id;
    }
  }

  const getPermIds = (spec: string[]) => {
    const ids: string[] = [];
    for (const item of spec) {
      if (item.includes(':*')) {
        const mod = item.split(':')[0];
        for (const act of ACTIONS) {
          if (createdPermissions[`${mod}:${act}`]) ids.push(createdPermissions[`${mod}:${act}`]);
        }
      } else if (createdPermissions[item]) {
        ids.push(createdPermissions[item]);
      }
    }
    return Array.from(new Set(ids));
  };

  // 2. Define System Roles & Mapping
  const systemRoles = [
    { name: 'Super Admin', description: 'Platform operator', isSystemRole: true, perms: MODULES.map(m => `${m}:*`) },
    { name: 'Tenant Owner/Admin', description: 'Business owner with full rights', isSystemRole: true, perms: MODULES.map(m => `${m}:*`) },
    { name: 'Manager', description: 'Operations oversight', isSystemRole: true, perms: ['users:read', 'customers:*', 'products:*', 'zones:*', 'routes:*', 'orders:*', 'stock:*', 'empties:*', 'breakage:*', 'reports:read'] },
    { name: 'Dispatcher/Zone Supervisor', description: 'Routes and rider dispatch', isSystemRole: true, perms: ['customers:read', 'products:read', 'zones:*', 'routes:*', 'orders:*', 'stock:read', 'empties:read'] },
    { name: 'Accountant/Finance Officer', description: 'Financial ledgers, invoices & P&L', isSystemRole: true, perms: ['customers:read', 'orders:read', 'finance:*', 'reports:*'] },
    { name: 'Rider/Driver', description: 'Field delivery staff', isSystemRole: true, perms: ['customers:read', 'routes:read', 'orders:read', 'orders:update', 'stock:read', 'stock:update', 'empties:create', 'empties:read'] },
    { name: 'Order Taker/Sales Agent', description: 'Sales and order booking', isSystemRole: true, perms: ['customers:*', 'products:read', 'orders:create', 'orders:read'] },
    { name: 'Recovery Agent', description: 'Field payment collections', isSystemRole: true, perms: ['customers:read', 'finance:create', 'finance:read'] },
    { name: 'Warehouse/Stock Keeper', description: 'Depot stock management', isSystemRole: true, perms: ['products:read', 'stock:*', 'empties:*', 'breakage:*'] }
  ];

  const seededRoles: Record<string, string> = {};
  for (const roleDef of systemRoles) {
    const existing = await prisma.role.findFirst({ where: { name: roleDef.name, tenantId: null } });
    let roleId = existing?.id;
    if (!existing) {
      const created = await prisma.role.create({
        data: { name: roleDef.name, description: roleDef.description, isSystemRole: roleDef.isSystemRole, tenantId: null }
      });
      roleId = created.id;
    }
    seededRoles[roleDef.name] = roleId!;

    const permIds = getPermIds(roleDef.perms);
    for (const permId of permIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleId!, permissionId: permId } },
        update: {},
        create: { roleId: roleId!, permissionId: permId }
      });
    }
  }

  // 2.5 Super Admin Platform Tenant
  const superAdminTenant = await prisma.tenant.upsert({
    where: { id: 'platform-superadmin-tenant' },
    update: {},
    create: {
      id: 'platform-superadmin-tenant',
      companyName: 'Tarsil Platform Operator Center',
      industryType: 'multi',
      subscriptionTier: 'enterprise',
      city: 'Headquarters',
      status: 'active',
      settings: {
        create: { currency: 'USD', timezone: 'UTC', defaultLanguage: 'en', invoicePrefix: 'SYS-', taxRate: 0.0 }
      }
    }
  });

  // 3. Demo Tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant-aquaflow' },
    update: {},
    create: {
      id: 'demo-tenant-aquaflow',
      companyName: 'AquaFlow Pure Water Supply',
      industryType: 'water',
      subscriptionTier: 'professional',
      city: 'Metropolis',
      status: 'active',
      settings: {
        create: { currency: 'USD', timezone: 'America/New_York', defaultLanguage: 'en', invoicePrefix: 'AQF-', taxRate: 5.0 }
      }
    }
  });

  // 4. Users
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const superAdminPasswordHash = await bcrypt.hash('SuperAdmin@123456', 10);
  const riderPasswordHash = await bcrypt.hash('Rider@123456', 10);

  const superAdminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: superAdminTenant.id, email: 'superadmin@tarsil.com' } },
    update: {},
    create: {
      tenantId: superAdminTenant.id,
      roleId: seededRoles['Super Admin'],
      name: 'System Super Admin',
      email: 'superadmin@tarsil.com',
      phone: '+18005550000',
      passwordHash: superAdminPasswordHash,
      status: 'active'
    }
  });

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'owner@aquaflow.com' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      roleId: seededRoles['Tenant Owner/Admin'],
      name: 'Alexander Vance (Owner)',
      email: 'owner@aquaflow.com',
      phone: '+15550192831',
      passwordHash,
      status: 'active'
    }
  });

  const manager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'manager@aquaflow.com' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      roleId: seededRoles['Manager'],
      name: 'Sarah Connor (Ops Manager)',
      email: 'manager@aquaflow.com',
      phone: '+15550192832',
      passwordHash,
      status: 'active'
    }
  });

  const rider = await prisma.user.upsert({
    where: { tenantId_phone: { tenantId: demoTenant.id, phone: '+15550192839' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      roleId: seededRoles['Rider/Driver'],
      name: 'John Driver (Route Rider)',
      email: 'rider1@aquaflow.com',
      phone: '+15550192839',
      passwordHash: riderPasswordHash,
      status: 'active'
    }
  });

  // 5. Products & Inventory Setup (Water Vertical)
  const product19L = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: demoTenant.id, sku: 'AQF-19L-BOTTLE' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: '19L Mineral Water Bottle',
      sku: 'AQF-19L-BOTTLE',
      category: 'water_bottle',
      unit: 'bottle',
      price: 5.0,
      isReturnableContainer: true,
      serialTrackingRequired: false
    }
  });

  const product5L = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: demoTenant.id, sku: 'AQF-5L-DISPENSER' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: '5L Disposable Water Jug',
      sku: 'AQF-5L-DISPENSER',
      category: 'water_bottle',
      unit: 'jug',
      price: 2.5,
      isReturnableContainer: false,
      serialTrackingRequired: false
    }
  });

  // 6. Warehouse / Depot
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 'wh-main-depot' },
    update: {},
    create: {
      id: 'wh-main-depot',
      tenantId: demoTenant.id,
      name: 'Central Metropolis Bottling Depot',
      location: '100 Industrial Parkway, Metropolis'
    }
  });

  // Stock Ledger initial load
  await prisma.stockLedger.create({
    data: {
      tenantId: demoTenant.id,
      productId: product19L.id,
      warehouseId: warehouse.id,
      qty: 1500,
      transactionType: 'load',
      referenceId: 'INITIAL-STOCK-LOAD'
    }
  });

  // 7. Zones & Routes
  const zoneA = await prisma.zone.create({
    data: {
      tenantId: demoTenant.id,
      name: 'Zone A - Downtown Commercial',
      description: 'Business district commercial towers and cafes',
      assignedSupervisorId: manager.id
    }
  });

  const routeA1 = await prisma.route.create({
    data: {
      tenantId: demoTenant.id,
      zoneId: zoneA.id,
      name: 'Route A1 - Main Street Corporate',
      sequenceOrder: 1
    }
  });

  await prisma.visitPlan.create({
    data: {
      tenantId: demoTenant.id,
      routeId: routeA1.id,
      riderId: rider.id,
      dayOfWeek: 1, // Monday
      scheduleType: 'daily'
    }
  });

  // 8. Customers
  const customer1 = await prisma.customer.create({
    data: {
      tenantId: demoTenant.id,
      zoneId: zoneA.id,
      name: 'Apex Tech Headquarters',
      phone: '+15559876543',
      email: 'facility@apextech.com',
      address: '500 Corporate Boulevard, Suite 400',
      geoLat: 40.7128,
      geoLng: -74.006,
      customerType: 'corporate',
      status: 'active'
    }
  });

  // Custom Product Rate & Deposit Ledger
  await prisma.customerProductRate.create({
    data: {
      tenantId: demoTenant.id,
      customerId: customer1.id,
      productId: product19L.id,
      customPrice: 4.50 // Special corporate rate
    }
  });

  await prisma.customerSecurityLedger.create({
    data: {
      tenantId: demoTenant.id,
      customerId: customer1.id,
      productId: product19L.id,
      qtyHeld: 20,
      depositAmount: 200.0 // $10 per bottle deposit
    }
  });

  // 9. Orders & Deliveries
  const existingOrder = await prisma.order.findUnique({
    where: { tenantId_orderNumber: { tenantId: demoTenant.id, orderNumber: 'ORD-20260820-001' } }
  });

  if (!existingOrder) {
    const order1 = await prisma.order.create({
      data: {
        tenantId: demoTenant.id,
        customerId: customer1.id,
        orderNumber: 'ORD-20260820-001',
        orderType: 'scheduled',
        status: 'delivered',
        totalAmount: 45.0,
        items: {
          create: [
            { productId: product19L.id, qty: 10, unitPrice: 4.50, totalPrice: 45.0 }
          ]
        }
      }
    });

    await prisma.delivery.create({
      data: {
        tenantId: demoTenant.id,
        orderId: order1.id,
        riderId: rider.id,
        scheduledDate: new Date(),
        status: 'delivered',
        deliveredQty: 10,
        emptiesCollectedQty: 10,
        cashCollected: 45.0,
        geoLat: 40.7129,
        geoLng: -74.0061,
        eSignatureUrl: 'https://storage.omniroute.io/signatures/sig-ord-001.png',
        deliveredAt: new Date()
      }
    });
  }

  console.log(`✅ Seeded Core Domain Data: 2 Products, 1 Warehouse, 1 Zone, 1 Route, 1 Customer (Apex Tech), 1 Completed Order & Delivery with 10 Empties collected`);
  console.log('🎉 Comprehensive Module 2 Seed finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
