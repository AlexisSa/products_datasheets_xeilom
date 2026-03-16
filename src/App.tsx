import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { SearchBar } from '@/components/SearchBar';
import { CategoryFilter } from '@/components/CategoryFilter';
import { BrandFilter } from '@/components/BrandFilter';
import { SortSelect, type SortOption } from '@/components/SortSelect';
import { SheetStatusFilter, type SheetStatusFilterValue } from '@/components/SheetStatusFilter';
import { DownloadCart } from '@/components/DownloadCart';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toast } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cartStore';
import type { ProductsData, Product } from '@/types/product';

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
  const { addMany, removeMany } = useCartStore();
  const gridRef = useRef<HTMLDivElement>(null);

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

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    let list: Product[] = data.products;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    if (category) {
      list = list.filter((p) => p.category === category);
    }
    if (brand) {
      list = list.filter((p) => p.brand === brand);
    }
    if (sheetFilter) {
      list = list.filter((p) => p.sheetStatus === sheetFilter);
    }
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'sku-asc':
          return a.sku.localeCompare(b.sku);
        case 'sku-desc':
          return b.sku.localeCompare(a.sku);
        case 'category':
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    return sorted;
  }, [data, debouncedSearch, category, brand, sheetFilter, sort]);

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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Chargement du catalogue...</p>
        </div>
      </div>
    );
  }

  const startItem = (page - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, filteredProducts.length);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <h1 className="text-xl font-semibold">Product Hub</h1>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <SearchBar value={search} onChange={setSearch} />
                <CategoryFilter
                  categories={data.categories}
                  value={category}
                  onChange={setCategory}
                />
                <BrandFilter
                  brands={data.brands}
                  value={brand}
                  onChange={setBrand}
                />
                <SheetStatusFilter
                  value={sheetFilter}
                  onChange={setSheetFilter}
                  counts={sheetStatusCounts}
                />
                <SortSelect value={sort} onChange={setSort} />
                <ThemeToggle />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {filteredProducts.length} produit{filteredProducts.length !== 1 ? 's' : ''} affiché
                {filteredProducts.length !== 1 ? 's' : ''}
              </span>
              {selectableProducts.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    Tout sélectionner ({selectableProducts.length})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                  >
                    Tout désélectionner
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6" ref={gridRef}>
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
                  <div className="flex items-center gap-1">
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

      <DownloadCart />
      <Toast />
    </div>
  );
}

export default App;
