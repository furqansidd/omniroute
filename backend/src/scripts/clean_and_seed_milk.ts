import { prisma } from '../utils/prisma.js';
import { PurchaseService } from '../modules/purchase/purchase.service.js';
import { ProductionService } from '../modules/production/production.service.js';
import { ProductService } from '../modules/product/product.service.js';

async function cleanAndSeedMilk() {
  console.log('🧹 Cleaning database and setting up exact Milk Business scenario...');

  // 1. Wipe old transactional data across all tenants
  await prisma.goodsReceiptItem.deleteMany({});
  await prisma.goodsReceipt.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.bOMItem.deleteMany({});
  await prisma.productionBatch.deleteMany({});
  await prisma.billOfMaterials.deleteMany({});
  await prisma.ledger.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.paymentVoucher.deleteMany({});
  await prisma.breakageWastageLog.deleteMany({});
  await prisma.stockLedger.deleteMany({});
  await prisma.delivery.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.customerProductRate.deleteMany({});
  await prisma.customerSecurityLedger.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.vendor.deleteMany({});

  // 2. Find primary active tenant or create clean Milk tenant
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        companyName: 'AquaPure Fresh Milk & Dairy',
        industryType: 'milk',
        subscriptionTier: 'enterprise'
      }
    });
  } else {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { companyName: 'AquaPure Fresh Milk & Dairy', industryType: 'milk' }
    });
  }

  const tenantId = tenant.id;

  // Find or create admin user and warehouse
  let user = await prisma.user.findFirst({ where: { tenantId } });
  if (!user) {
    let role = await prisma.role.findFirst({ where: { tenantId } });
    if (!role) {
      role = await prisma.role.create({
        data: { tenantId, name: 'Tenant Owner' }
      });
    }
    user = await prisma.user.create({
      data: {
        tenantId,
        roleId: role.id,
        name: 'Milk Business Manager',
        email: 'owner@hahmilk.com',
        passwordHash: 'hashedpassword'
      }
    });
  }

  let warehouse = await prisma.warehouse.findFirst({ where: { tenantId } });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: { tenantId, name: 'Central Milk Processing Plant' }
    });
  }

  console.log('✅ Wiped old data. Setting up vendors for tenant:', tenant.companyName);

  // 3. Add Vendors
  const milkFarmVendor = await PurchaseService.createVendor(tenantId, {
    name: 'Hah Milk Farm',
    phone: '0300-1122334',
    address: 'Farmer Supply Colony, Multan',
    paymentTerms: 'net_15'
  });

  const packagingVendor = await PurchaseService.createVendor(tenantId, {
    name: 'Hah Packaging House',
    phone: '0321-9988776',
    address: 'Industrial Packaging Zone, Lahore',
    paymentTerms: 'net_30'
  });

  console.log('✅ Created Vendors: Hah Milk Farm & Hah Packaging House');

  // 4. Add Raw Material & Packaging Items
  const rawMilk = await ProductService.createProduct(tenantId, {
    name: 'Raw Unprocessed Milk (Liter)',
    sku: 'RM-MILK-1L',
    category: 'milk',
    productType: 'raw_material',
    unit: 'liter',
    price: 150,
    costPrice: 150,
    reorderLevel: 20
  });

  const pouch = await ProductService.createProduct(tenantId, {
    name: '1L Milk Packaging Pouch',
    sku: 'PK-POUCH-1L',
    category: 'milk',
    productType: 'packaging',
    unit: 'pouch',
    price: 3,
    costPrice: 3,
    reorderLevel: 50
  });

  const finishedMilk = await ProductService.createProduct(tenantId, {
    name: 'Pure Fresh Milk 1L Pack',
    sku: 'FG-MILK-1L',
    category: 'milk',
    productType: 'finished_good',
    unit: 'packet',
    price: 183, // 150 (Milk) + 3 (Pouch) + 10 (Labor) + 20 (Commission) = 183
    costPrice: 183,
    reorderLevel: 20
  });

  console.log('✅ Created Catalog: Raw Milk (150/L), Pouch (3/unit), Finished Milk (183/packet)');

  // 5. Execute Purchase Order 1: 100L Milk from Hah Milk Farm @ Rs. 150
  const poMilk = await PurchaseService.createPurchaseOrder(tenantId, {
    vendorId: milkFarmVendor.id,
    notes: 'Subah ka 100 Liters Raw Milk shipment',
    items: [{ productId: rawMilk.id, expectedQty: 100, unitPrice: 150 }]
  });

  await PurchaseService.createGoodsReceipt(tenantId, user.id, {
    poId: poMilk.id,
    warehouseId: warehouse.id,
    notes: 'Received 100 Liters Raw Milk in good condition',
    items: [{ productId: rawMilk.id, expectedQty: 100, receivedQty: 100, unitCost: 150 }]
  });

  // Execute Purchase Order 2: 100 Pouches from Hah Packaging House @ Rs. 3
  const poPouch = await PurchaseService.createPurchaseOrder(tenantId, {
    vendorId: packagingVendor.id,
    notes: '100 Packaging Pouches for Milk 1L',
    items: [{ productId: pouch.id, expectedQty: 100, unitPrice: 3 }]
  });

  await PurchaseService.createGoodsReceipt(tenantId, user.id, {
    poId: poPouch.id,
    warehouseId: warehouse.id,
    notes: 'Received 100 Pouches',
    items: [{ productId: pouch.id, expectedQty: 100, receivedQty: 100, unitCost: 3 }]
  });

  console.log('✅ Executed PO & GRN: Raw Milk (+100L) & Pouches (+100) received in stock!');

  // 6. Define Recipe (BOM): 1 Packet = 1L Raw Milk + 1 Pouch
  const bom = await ProductionService.createBOM(tenantId, {
    finishedProductId: finishedMilk.id,
    name: '1L Milk Pack Recipe (1L Milk + 1 Pouch)',
    yieldQty: 1.0,
    items: [
      { rawProductId: rawMilk.id, qtyRequired: 1.0 },
      { rawProductId: pouch.id, qtyRequired: 1.0 }
    ]
  });

  console.log('✅ Created Recipe BOM for Pure Fresh Milk 1L Pack');

  // 7. Execute Production Run: Produce 100 Packets, Labor Charge = Rs. 10/packet (1000) + Commission = Rs. 20/packet (2000) => Rs. 3,000 Overhead
  const batch = await ProductionService.recordProductionBatch(tenantId, user.id, {
    warehouseId: warehouse.id,
    finishedProductId: finishedMilk.id,
    bomId: bom.id,
    outputQty: 100,
    laborOverheadCost: 3000, // 10 (Labor) * 100 + 20 (Commission) * 100 = 3,000
    qualityPassed: true,
    notes: 'Production run for 100 Milk Packets'
  });

  console.log('🎉 Production Complete! Batch Number:', batch.batchNumber);
  console.log('   - Material Cost (Milk 150*100 + Pouch 3*100): Rs. 15,300');
  console.log('   - Labor & Commission (10+20 = 30 * 100): Rs. 3,000');
  console.log('   - Total Batch Cost: Rs. 18,300');
  console.log('   - Finished Product Cost Per Packet: Rs.', batch.unitCost);

  console.log('✨ Clean database & Milk scenario setup finished successfully!');
}

cleanAndSeedMilk()
  .catch((e) => {
    console.error('Error seeding scenario:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
