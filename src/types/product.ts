export type SheetStatus = 'available' | 'unavailable' | 'none';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  categoryFull: string;
  brand: string;
  description: string;
  image: string;
  imageSmall: string;
  productUrl: string;
  sheetUrl: string;
  hasSheet: boolean;
  sheetStatus: SheetStatus;
}

export interface ProductsData {
  products: Product[];
  categories: string[];
  brands: string[];
}
