import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartProduct {
  id: string;
  name: string;
  sku: string;
  sheetUrl: string;
  image?: string;
  imageSmall?: string;
}

interface CartStore {
  items: CartProduct[];
  add: (product: CartProduct) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  toggle: (product: CartProduct) => void;
  isInCart: (id: string) => boolean;
  clear: () => void;
  addMany: (products: CartProduct[]) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      add: (product) =>
        set((state) =>
          state.items.some((i) => i.id === product.id)
            ? state
            : { items: [...state.items, product] }
        ),
      remove: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      removeMany: (ids) =>
        set((state) => {
          const idsSet = new Set(ids);
          return { items: state.items.filter((i) => !idsSet.has(i.id)) };
        }),
      toggle: (product) => {
        const inCart = get().items.some((i) => i.id === product.id);
        if (inCart) get().remove(product.id);
        else get().add(product);
      },
      isInCart: (id) => get().items.some((i) => i.id === id),
      clear: () => set({ items: [] }),
      addMany: (products: CartProduct[]) =>
        set((state) => {
          const existingIds = new Set(state.items.map((i) => i.id));
          const newItems = products.filter((p) => !existingIds.has(p.id));
          return { items: [...state.items, ...newItems] };
        }),
    }),
    { name: 'product-hub-cart' }
  )
);
