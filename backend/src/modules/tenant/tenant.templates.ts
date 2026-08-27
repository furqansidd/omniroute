export interface ProductTemplateItem {
  name: string;
  sku: string;
  category: string;
  unit: string;
  price: number;
  isReturnableContainer: boolean;
  serialTrackingRequired: boolean;
}

export const INDUSTRY_PRODUCT_TEMPLATES: Record<string, ProductTemplateItem[]> = {
  water: [
    {
      name: '19L Returnable Water Bottle',
      sku: 'WTR-19L',
      category: 'water_bottle',
      unit: 'bottle',
      price: 5.0,
      isReturnableContainer: true,
      serialTrackingRequired: false
    },
    {
      name: '5L Disposable Water Jug',
      sku: 'WTR-5L',
      category: 'water_bottle',
      unit: 'jug',
      price: 2.5,
      isReturnableContainer: false,
      serialTrackingRequired: false
    },
    {
      name: 'Water Cooler Dispenser Unit',
      sku: 'WTR-DISPENSER',
      category: 'equipment',
      unit: 'unit',
      price: 120.0,
      isReturnableContainer: false,
      serialTrackingRequired: true
    }
  ],
  milk: [
    {
      name: 'Fresh Whole Milk (1 Liter)',
      sku: 'MLK-1L-FRESH',
      category: 'milk',
      unit: 'liter',
      price: 1.8,
      isReturnableContainer: false,
      serialTrackingRequired: false
    },
    {
      name: 'Pasteurized Milk Pouch (500ml)',
      sku: 'MLK-500ML-POUCH',
      category: 'milk',
      unit: 'pouch',
      price: 1.0,
      isReturnableContainer: false,
      serialTrackingRequired: false
    },
    {
      name: 'Organic Yogurt Pot (500g)',
      sku: 'MLK-YOGURT-500G',
      category: 'dairy',
      unit: 'pot',
      price: 3.2,
      isReturnableContainer: false,
      serialTrackingRequired: false
    },
    {
      name: 'Milk Transport Crate (20L Capacity)',
      sku: 'MLK-CRATE-20L',
      category: 'crate',
      unit: 'crate',
      price: 15.0,
      isReturnableContainer: true,
      serialTrackingRequired: false
    }
  ],
  lpg: [
    {
      name: '11kg Household LPG Cylinder',
      sku: 'LPG-11KG',
      category: 'lpg_cylinder',
      unit: 'cylinder',
      price: 28.0,
      isReturnableContainer: true,
      serialTrackingRequired: true
    },
    {
      name: '15kg Commercial LPG Cylinder',
      sku: 'LPG-15KG',
      category: 'lpg_cylinder',
      unit: 'cylinder',
      price: 38.0,
      isReturnableContainer: true,
      serialTrackingRequired: true
    },
    {
      name: '45kg Industrial LPG Cylinder',
      sku: 'LPG-45KG',
      category: 'lpg_cylinder',
      unit: 'cylinder',
      price: 110.0,
      isReturnableContainer: true,
      serialTrackingRequired: true
    }
  ],
  oil: [
    {
      name: 'Engine Lubricant Oil Can (4L)',
      sku: 'OIL-4L-CAN',
      category: 'oil_can',
      unit: 'can',
      price: 32.0,
      isReturnableContainer: false,
      serialTrackingRequired: false
    },
    {
      name: 'Synthetic Motor Oil Bottle (1L)',
      sku: 'OIL-1L-BOTTLE',
      category: 'oil_can',
      unit: 'bottle',
      price: 9.5,
      isReturnableContainer: false,
      serialTrackingRequired: false
    },
    {
      name: 'Industrial Bulk Drum Oil (208L)',
      sku: 'OIL-208L-DRUM',
      category: 'oil_drum',
      unit: 'drum',
      price: 450.0,
      isReturnableContainer: true,
      serialTrackingRequired: true
    }
  ]
};
