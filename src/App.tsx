import { useState, useEffect, useMemo } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { SearchBar } from '@/components/SearchBar';
import { CategoryFilter } from '@/components/CategoryFilter';
import { BrandFilter } from '@/components/BrandFilter';
import { SortSelect, type SortOption } from '@/components/SortSelect';
import { DownloadCart } from '@/components/DownloadCart';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cartStore';
import type { ProductsData, Product } from '@/types/product';

const ITEMS_PER_PAGE = 48;

function App() {
  const [data, setData] = useState<ProductsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState<SortOption>('name-asc');
  const [page, setPage] = useState(1);
  const { addMany, clear } = useCartStore();

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

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    let list: Product[] = data.products;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
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
    // Sort
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
  }, [data, search, category, brand, sort]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, page]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const selectableCount = useMemo(
    () => filteredProducts.filter((p) => p.hasSheet).length,
    [filteredProducts]
  );

  const handleSelectAll = () => {
    const toAdd = filteredProducts
      .filter((p) => p.hasSheet)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        sheetUrl: p.sheetUrl,
      }));
    addMany(toAdd);
  };

  useEffect(() => {
    setPage(1);
  }, [search, category, brand, sort]);

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
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

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
                <SortSelect value={sort} onChange={setSort} />
                <ThemeToggle />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {filteredProducts.length} produit{filteredProducts.length !== 1 ? 's' : ''} affiché
                {filteredProducts.length !== 1 ? 's' : ''}
              </span>
              {selectableCount > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    Tout sélectionner
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clear}
                  >
                    Tout désélectionner
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
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
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Précédent
                </Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Suivant
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <DownloadCart />
      <Toast />
    </div>
  );
}

export default App;
