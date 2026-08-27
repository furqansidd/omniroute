import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../utils/prisma.js';
import { PurchaseService } from './purchase/purchase.service.js';
import { ProductionService } from './production/production.service.js';
import { ProductService } from './product/product.service.js';
import { FinanceService } from './finance/finance.service.js';

describe('Connected Modules Integration Test (Inventory, Purchase, Production, Finance)', () => {
  let testTenantId: string;
  let testUserId: string;
  let testWarehouseId: string;
  let rawMilkId: string;
  let pouchId: string;
  let finishedMilkId: string;
  let vendorId: string;

  before(async () => {
    // 1. Setup Test Tenant, User & Warehouse
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Test Milk Dairy Corp',
        industryType: 'milk',
        subscriptionTier: 'enterprise'
      }
    });
    testTenantId = tenant.id;

    const role = await prisma.role.create({
      data: { tenantId: testTenantId, name: 'Admin Role' }
    });

    const user = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        roleId: role.id,
        name: 'Test Manager',
        email: `test-${Date.now()}@dairy.com`,
        passwordHash: 'hashedpass'
      }
    });
    testUserId = user.id;

    const warehouse = await prisma.warehouse.create({
      data: { tenantId: testTenantId, name: 'Central Dairy Plant' }
    });
    testWarehouseId = warehouse.id;
  });

  after(async () => {
    // Cleanup Test Data
    if (testTenantId) {
      await prisma.tenant.delete({ where: { id: testTenantId } });
    }
  });

  it('Step 1: Create Vendor & Product Catalog (Raw Materials, Packaging, Finished Good)', async () => {
    // Vendor
    const vendor = await PurchaseService.createVendor(testTenantId, {
      name: 'Ahmed Dairy Farm',
      phone: '0300-1234567',
      address: 'Multan Dairy Road'
    });
    vendorId = vendor.id;
    assert.equal(vendor.name, 'Ahmed Dairy Farm');
    assert.equal(vendor.balancePayable, 0);

    // Products
    const rawMilk = await ProductService.createProduct(testTenantId, {
      name: 'Raw Unprocessed Milk',
      sku: `RM-MILK-${Date.now()}`,
      category: 'milk',
      productType: 'raw_material',
      unit: 'liter',
      price: 160,
      costPrice: 150
    });
    rawMilkId = rawMilk.id;

    const pouch = await ProductService.createProduct(testTenantId, {
      name: '1L Packaging Pouch',
      sku: `PK-POUCH-${Date.now()}`,
      category: 'milk',
      productType: 'packaging',
      unit: 'unit',
      price: 5,
      costPrice: 3
    });
    pouchId = pouch.id;

    const finishedMilk = await ProductService.createProduct(testTenantId, {
      name: 'Pure Milk 1L Packet',
      sku: `FG-MILK-${Date.now()}`,
      category: 'milk',
      productType: 'finished_good',
      unit: 'packet',
      price: 180,
      costPrice: 0
    });
    finishedMilkId = finishedMilk.id;

    assert.equal(rawMilk.productType, 'raw_material');
    assert.equal(finishedMilk.productType, 'finished_good');
  });

  it('Step 2: Create Purchase Order & Receive GRN (Stock Increase + Shortage Log + Vendor Payable)', async () => {
    // Create PO
    const po = await PurchaseService.createPurchaseOrder(testTenantId, {
      vendorId,
      items: [
        { productId: rawMilkId, expectedQty: 500, unitPrice: 150 },
        { productId: pouchId, expectedQty: 500, unitPrice: 3 }
      ]
    });
    assert.equal(po.status, 'issued');
    assert.equal(po.totalAmount, 76500);

    // Receive GRN: 490L Milk received (10L shortage!), 500 Pouches received
    const grnResult = await PurchaseService.createGoodsReceipt(testTenantId, testUserId, {
      poId: po.id,
      warehouseId: testWarehouseId,
      items: [
        { productId: rawMilkId, expectedQty: 500, receivedQty: 490, unitCost: 150 },
        { productId: pouchId, expectedQty: 500, receivedQty: 500, unitCost: 3 }
      ]
    });

    assert.equal(grnResult.totalReceivedCost, 490 * 150 + 500 * 3); // 73,500 + 1,500 = 75,000

    // Check Vendor Payable
    const updatedVendor = await PurchaseService.getVendorById(testTenantId, vendorId);
    assert.equal(updatedVendor?.balancePayable, 75000);

    // Check Raw Milk Stock
    const products = await ProductService.listProducts(testTenantId, { search: 'Raw' });
    const milkProd = products.find(p => p.id === rawMilkId);
    assert.equal(milkProd?.currentStock, 490);

    // Check Shortage log
    const shortageLogs = await prisma.breakageWastageLog.findMany({ where: { tenantId: testTenantId } });
    assert.equal(shortageLogs.length, 1);
    assert.equal(shortageLogs[0].qty, 10);
  });

  it('Step 3: Define Recipe (BOM) & Execute Batch Production (Stock Consumption & Unit Costing)', async () => {
    // Define Recipe: 1 Packet needs 1L Raw Milk + 1 Pouch
    const bom = await ProductionService.createBOM(testTenantId, {
      finishedProductId: finishedMilkId,
      name: 'Standard 1L Milk Packet Formula',
      yieldQty: 1.0,
      items: [
        { rawProductId: rawMilkId, qtyRequired: 1.0 },
        { rawProductId: pouchId, qtyRequired: 1.0 }
      ]
    });
    assert.equal(bom.items.length, 2);

    // Run Production Batch: 480 Packets produced, Rs. 2,000 labor overhead
    const batch = await ProductionService.recordProductionBatch(testTenantId, testUserId, {
      warehouseId: testWarehouseId,
      finishedProductId: finishedMilkId,
      bomId: bom.id,
      outputQty: 480,
      laborOverheadCost: 2000,
      qualityPassed: true
    });

    // Material Cost: 480 * 150 + 480 * 3 = 73,440. Overhead: 2,000. Total = 75,440.
    // Unit Cost: 75,440 / 480 = 157.1666...
    assert.equal(batch.outputQty, 480);
    assert.equal(batch.totalMaterialCost, 73440);
    assert.equal(batch.laborOverheadCost, 2000);
    assert.ok(batch.unitCost > 157 && batch.unitCost < 158);

    // Check Stocks after Production:
    // Raw Milk: 490 - 480 = 10L remaining
    const products = await ProductService.listProducts(testTenantId, {});
    const milkRaw = products.find(p => p.id === rawMilkId);
    const milkFinished = products.find(p => p.id === finishedMilkId);

    assert.equal(milkRaw?.currentStock, 10);
    assert.equal(milkFinished?.currentStock, 480);
  });

  it('Step 4: Verify Financial Overview & Double-Entry Ledger Statements', async () => {
    const financeService = new FinanceService();
    const overview = await financeService.getFinancialOverview(testTenantId);
    assert.equal(overview.totalVendorPayables, 75000);

    const journalEntries = await prisma.journalEntry.findMany({
      where: { tenantId: testTenantId },
      include: { ledgers: true }
    });

    // Should have 2 Journal Entries: 1 for GRN, 1 for Production
    assert.ok(journalEntries.length >= 2);
  });
});
