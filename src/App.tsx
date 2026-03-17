import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { Header, FilterBar, SelectionBar } from '@/components/Header';
import { DownloadCart } from '@/components/DownloadCart';
import { Toast } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cartStore';
import type { ProductsData } from '@/types/product';
import type { SortOption } from '@/components/SortSelect';
import type { SheetStatusFilterValue } from '@/components/SheetStatusFilter';

const ITEMS_PER_PAGE = 48;
const SEARCH_DEBOUNCE_MS = 300;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function App() {
  const [data, setData] = useState<ProductsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState<SortOption>('name-asc');
  const [sheetFilter, setSheetFilter] = useState<SheetStatusFilterValue>('');
  const [page, setPage] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const { addMany, removeMany, items } = useCartStore();
  const gridRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setError(null);
    fetch('/data/products.json')
      .then((res) => {
        if (!res.ok) throw new Error('Erreur de chargement');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err?.message || 'Impossible de charger les produits'));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          setSearch('');
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const sheetStatusCounts = useMemo(() => {
    if (!data) return { available: 0, unavailable: 0, none: 0 };
    const counts = { available: 0, unavailable: 0, none: 0 };
    for (const p of data.products) {
      if (p.sheetStatus === 'available') counts.available++;
      else if (p.sheetStatus === 'unavailable') counts.unavailable++;
      else counts.none++;
    }
    return counts;
  }, [data]);

  const indexedProducts = useMemo(() => {
    if (!data) return [];
    return data.products.map((p) => {
      const sku = p.sku.toLowerCase();
      const name = p.name.toLowerCase();
      const brand = p.brand.toLowerCase();
      const category = p.category.toLowerCase();
      const categoryFull = p.categoryFull.toLowerCase();
      const haystack = `${sku} ${name} ${brand} ${category} ${categoryFull}`.trim();
      return { p, sku, name, haystack };
    });
  }, [data]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const qRaw = debouncedSearch.toLowerCase().trim();
    const tokens = qRaw ? qRaw.split(/\s+/).filter(Boolean) : [];

    let list = indexedProducts;
    if (tokens.length > 0) {
      list = list.filter((x) => tokens.every((t) => x.haystack.includes(t)));
    }
    if (category) list = list.filter((x) => x.p.category === category);
    if (brand) list = list.filter((x) => x.p.brand === brand);
    if (sheetFilter) list = list.filter((x) => x.p.sheetStatus === sheetFilter);

    const score = (x: (typeof indexedProducts)[number]) => {
      if (!qRaw) return 0;
      if (x.sku === qRaw) return 1000;
      if (x.sku.startsWith(qRaw)) return 800;
      if (x.sku.includes(qRaw)) return 650;
      if (x.name.includes(qRaw)) return 500;
      return 0;
    };

    const sorted = [...list].sort((a, b) => {
      if (qRaw) {
        const d = score(b) - score(a);
        if (d !== 0) return d;
      }
      switch (sort) {
        case 'name-asc':
          return a.p.name.localeCompare(b.p.name);
        case 'name-desc':
          return b.p.name.localeCompare(a.p.name);
        case 'sku-asc':
          return a.p.sku.localeCompare(b.p.sku);
        case 'sku-desc':
          return b.p.sku.localeCompare(a.p.sku);
        case 'category':
          return (
            a.p.category.localeCompare(b.p.category) ||
            a.p.name.localeCompare(b.p.name)
          );
        default:
          return 0;
      }
    });
    return sorted.map((x) => x.p);
  }, [data, indexedProducts, debouncedSearch, category, brand, sheetFilter, sort]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, page]);

  const totalPages = useMemo(
    () => Math.ceil(filteredProducts.length / ITEMS_PER_PAGE),
    [filteredProducts.length]
  );

  const selectableProducts = useMemo(
    () => filteredProducts.filter((p) => p.sheetStatus === 'available'),
    [filteredProducts]
  );

  const handleSelectAll = useCallback(() => {
    const toAdd = selectableProducts.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      sheetUrl: p.sheetUrl,
      image: p.image,
      imageSmall: p.imageSmall,
    }));
    addMany(toAdd);
  }, [selectableProducts, addMany]);

  const handleDeselectAll = useCallback(() => {
    const ids = selectableProducts.map((p) => p.id);
    removeMany(ids);
  }, [selectableProducts, removeMany]);

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setCategory('');
    setBrand('');
    setSheetFilter('');
    setSort('name-asc');
    setPage(1);
  }, []);

  const goToPage = useCallback((target: number) => {
    setPage(target);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, brand, sheetFilter, sort]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-destructive font-medium">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-muted-foreground">Chargement du catalogue...</p>
        </div>
      </div>
    );
  }

  const startItem = (page - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, filteredProducts.length);

  return (
    <div className="min-h-screen text-xs">
      <Header
        search={search}
        onSearchChange={setSearch}
        searchInputRef={searchInputRef}
        cartCount={items.length}
        onCartOpen={() => setCartOpen(true)}
      />

      <main className="max-w-[1600px] mx-auto p-4 space-y-4" ref={gridRef}>
        <FilterBar
          category={category}
          onCategoryChange={setCategory}
          brand={brand}
          onBrandChange={setBrand}
          sheetFilter={sheetFilter}
          onSheetFilterChange={setSheetFilter}
          sort={sort}
          onSortChange={setSort}
          categories={data.categories}
          brands={data.brands}
          sheetCounts={sheetStatusCounts}
          onResetFilters={handleResetFilters}
        />

        <SelectionBar
          selectedCount={items.length}
          totalSelectable={selectableProducts.length}
          totalProducts={data.products.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />

        <ErrorBoundary>
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground text-lg">
                Aucun produit trouvé
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Essayez de modifier votre recherche ou vos filtres
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {paginatedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-2 mt-8">
                  <p className="text-sm text-muted-foreground">
                    Produits {startItem}–{endItem} sur {filteredProducts.length}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(1)}
                      disabled={page <= 1}
                    >
                      ««
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(page - 1)}
                      disabled={page <= 1}
                    >
                      Précédent
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                      .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === 'ellipsis' ? (
                          <span key={`e-${idx}`} className="px-2 text-muted-foreground">…</span>
                        ) : (
                          <Button
                            key={item}
                            variant={item === page ? 'default' : 'outline'}
                            size="sm"
                            className="min-w-[2.25rem]"
                            onClick={() => goToPage(item)}
                          >
                            {item}
                          </Button>
                        )
                      )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Suivant
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(totalPages)}
                      disabled={page >= totalPages}
                    >
                      »»
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </ErrorBoundary>
      </main>

      <DownloadCart isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <Toast />
    </div>
  );
}

export default App;
