# Design Document: Connected Inventory, Purchase, Production, and Finance Modules

**Date:** 2026-08-27  
**Status:** Approved  
**Target:** OmniRoute Multi-Tenant Delivery & Operations SaaS  

---

## 1. Executive Summary

This design document specifies the architecture and data flow for four tightly integrated modules in OmniRoute:
1. **Inventory (Stock & Asset Control)**: Real-time stock tracking for raw materials, packaging, finished goods, returnables, and wastage/spoilage.
2. **Purchase (Procurement & Supplier Management)**: Vendor management, Purchase Orders (PO), Goods Received Notes (GRN), transit loss handling, and vendor payables.
3. **Production (BOM & Manufacturing)**: Bill of Materials (BOM) / recipes, batch manufacturing, automated raw material deduction, finished goods stock addition, and per-unit cost calculation.
4. **Finance (Double-Entry General Ledger & P&L)**: Chart of Accounts, automated journal entries for GRN/Production/Sales, customer receivables, vendor payables, Payment/Receipt Vouchers, and real-time Profit & Loss (P&L) reporting.

---

## 2. System Data Flow Architecture

```
[ SUPPLIER / VENDOR ] 
        │
   (1) Purchase Order & GRN (Goods Receipt)
        │
        ├──► Stock Added (+ Raw Material / Packaging) ──► [ INVENTORY MODULE ]
        └──► Vendor Payable Created ($ Udhaar) ─────────► [ FINANCE MODULE ]
                                                                 │
[ INVENTORY MODULE ]                                             │
   (Raw Material / Packaging)                                    │
        │                                                        │
   (2) Production Batch Complete (Recipe / BOM)                  │
        │                                                        │
        ├──► Stock Deducted (- Raw Material, - Pouches)          │
        ├──► Stock Added (+ Finished Goods) ─────────────────────┤
        └──► Production Cost & Margin Calculated                 │
                                                                 │
   (Finished Goods)                                              │
        │                                                        │
        ├──► Sales & Delivery ───────────────────────────────────┤
        │                                                        │
                                                        [ FINANCIAL LEDGER ]
                                                      P&L, Balance Sheet, Ledgers
```

---

## 3. Database Schema Models (Prisma)

### New & Updated Models:
- **`Product`**: Added `productType` (`raw_material`, `packaging`, `finished_good`, `returnable_container`), `reorderLevel`, `costPrice`, `depositPrice`.
- **`Vendor`**: `id`, `tenantId`, `name`, `phone`, `email`, `address`, `taxId`, `paymentTerms`, `balancePayable`.
- **`PurchaseOrder` & `PurchaseOrderItem`**: PO creation, status tracking (`draft`, `issued`, `received_partial`, `received_full`, `cancelled`).
- **`GoodsReceipt` & `GoodsReceiptItem`**: GRN creation, actual received vs expected, shortage/wastage logging, automatic inventory & payable entry.
- **`BillOfMaterials` & `BOMItem`**: Recipe definitions for finished goods.
- **`ProductionBatch` & `ProductionItem`**: Batch production execution, material consumption, finished goods yield, cost allocation.
- **`VendorBill`**: Payable invoices for vendors linked to GRN.
- **`JournalEntry` & `Ledger`**: Enhanced double-entry ledger categories (`asset`, `liability`, `equity`, `revenue`, `expense`).

---

## 4. API Endpoints Specification

### Inventory:
- `GET /api/products`: List products with type filtering and stock balances.
- `POST /api/products`: Create/update raw materials, packaging, and finished goods.
- `GET /api/stock/summary`: Warehouse and mobile depot stock breakdown.
- `POST /api/breakage`: Log breakage/spoilage and auto-post wastage expense to finance.

### Purchase:
- `GET /api/purchase/vendors`: List vendors with outstanding payable balances.
- `POST /api/purchase/vendors`: Add vendor profile.
- `POST /api/purchase/orders`: Create PO.
- `POST /api/purchase/grn`: Create GRN, receive stock, log variance/wastage, and post vendor payable journal entry.

### Production:
- `GET /api/production/boms`: List BOM recipes.
- `POST /api/production/boms`: Create/update BOM recipe for finished goods.
- `POST /api/production/batches`: Create production batch.
- `POST /api/production/batches/:id/complete`: Complete batch, deduct raw material stock, add finished good stock, calculate unit cost, and record production journal entry.

### Finance:
- `GET /api/finance/overview`: Real-time financial summary (Receivables, Payables, Revenue, COGS, Net Profit).
- `GET /api/finance/pnl`: Profit & Loss statement for date range.
- `GET /api/finance/ledgers`: Account-wise general ledger filterable by account/vendor/customer.
- `POST /api/finance/vouchers`: Create payment voucher (vendor payout / expense) or receipt voucher (customer collection).

---

## 5. User Interface (Frontend Modules)

1. **Inventory & Stock Management (`/stock`)**:
   - Stock view categorized by Raw Material, Packaging, Finished Goods, and Returnables.
   - Low stock alert banners.
   - Stock history and movement logs.

2. **Purchase & Vendor Management (`/purchase`)**:
   - Vendor list with payable balances.
   - PO creation and GRN receiving interface.

3. **Production & Recipe Studio (`/production`)**:
   - Recipe / BOM Builder.
   - Batch runner with live cost breakdown (Raw Material + Packaging + Labor = Total Unit Cost).

4. **Connected Finance & P&L (`/finance`)**:
   - P&L Report card (Revenue - COGS - Wastage - Expenses = Net Profit).
   - Vendor Payables & Customer Receivables ledgers.
   - Payment/Receipt Voucher creation modal.

---

## 6. Verification & Test Suite
- Automated test scripts for GRN stock increase & payable creation.
- Automated test scripts for Production batch completion & material consumption.
- Verification of P&L calculations.
