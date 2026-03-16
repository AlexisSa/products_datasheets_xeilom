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
}

export interface ProductsData {
  products: Product[];
  categories: string[];
  brands: string[];
}
