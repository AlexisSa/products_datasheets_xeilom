import { Search, Package, ChevronDown, Layers, Tag, SortAsc, CheckSquare, Square } from 'lucide-react';
import { CartTrigger } from '@/components/DownloadCart';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { SortOption } from '@/components/SortSelect';
import type { SheetStatusFilterValue } from '@/components/SheetStatusFilter';

interface HeaderProps {
  search: string;
  onSearchChange: (v: string) => void;
  cartCount: number;
  onCartOpen: () => void;
}

const sortLabels: Record<SortOption, string> = {
  'name-asc': 'Nom A-Z',
  'name-desc': 'Nom Z-A',
  'sku-asc': 'Réf. A-Z',
  'sku-desc': 'Réf. Z-A',
  category: 'Catégorie',
};

function FilterSelect({
  icon,
  value,
  onChange,
  children,
  className,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative group', className)}>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors pointer-events-none z-10">
        {icon}
      </span>
      <Select
        value={value}
        onChange={onChange}
        className="pl-8 pr-7 h-8 min-w-[100px] max-w-[140px] text-[11px] font-bold border-border bg-card hover:border-blue-400/50 dark:hover:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 rounded-lg cursor-pointer appearance-none"
      >
        {children}
      </Select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
    </div>
  );
}

export function Header({
  search,
  onSearchChange,
  cartCount,
  onCartOpen,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 backdrop-blur-md bg-background/90 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between gap-4 sm:gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Package className="text-white w-3.5 h-3.5" />
          </div>
          <h1 className="font-black tracking-tighter text-blue-600 dark:text-blue-400 text-[13px]">
            PRODUCT HUB
          </h1>
        </div>

        {/* Recherche */}
        <div className="flex-1 max-w-xl min-w-0">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
            <input
              type="search"
              placeholder="Référence, nom, SKU..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-muted/30 focus:bg-background focus:border-blue-500/50 dark:focus:border-blue-400/50 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-400/10 outline-none text-[11px] transition-all"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        {/* Actions droite */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle variant="compact" />
          <div className="h-4 w-px bg-border mx-1" />
          <CartTrigger count={cartCount} onClick={onCartOpen} variant="compact" />
        </div>
      </div>
    </header>
  );
}

interface FilterBarProps {
  category: string;
  onCategoryChange: (v: string) => void;
  brand: string;
  onBrandChange: (v: string) => void;
  sheetFilter: SheetStatusFilterValue;
  onSheetFilterChange: (v: SheetStatusFilterValue) => void;
  sort: SortOption;
  onSortChange: (v: SortOption) => void;
  categories: string[];
  brands: string[];
  sheetCounts: { available: number; unavailable: number; none: number };
  onResetFilters: () => void;
}

export function FilterBar({
  category,
  onCategoryChange,
  brand,
  onBrandChange,
  sheetFilter,
  onSheetFilterChange,
  sort,
  onSortChange,
  categories,
  brands,
  sheetCounts,
  onResetFilters,
}: FilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex flex-wrap items-center gap-2 flex-1">
        <FilterSelect
          icon={<Layers size={14} />}
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">Toutes</option>
          {categories.map((c: string) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          icon={<Tag size={14} />}
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
        >
          <option value="">Toutes</option>
          {brands.map((b: string) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          icon={<Package size={14} />}
          value={sheetFilter}
          onChange={(e) => onSheetFilterChange(e.target.value as SheetStatusFilterValue)}
        >
          <option value="">Tous</option>
          <option value="available">Avec PDF ({sheetCounts.available})</option>
          <option value="unavailable">Indisponible ({sheetCounts.unavailable})</option>
          <option value="none">Sans PDF ({sheetCounts.none})</option>
        </FilterSelect>
        <FilterSelect
          icon={<SortAsc size={14} />}
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
        >
          {Object.entries(sortLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </FilterSelect>
        <div className="h-4 w-px bg-border mx-1" />
        <button
          type="button"
          onClick={onResetFilters}
          className="text-[10px] font-bold text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 px-1 uppercase tracking-tight transition-colors"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

export function SelectionBar({
  selectedCount,
  totalSelectable,
  totalProducts,
  onSelectAll,
  onDeselectAll,
}: {
  selectedCount: number;
  totalSelectable: number;
  totalProducts: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const progressPercent = totalProducts > 0 ? (selectedCount / totalProducts) * 100 : 0;

  return (
    <section className="px-4 py-2.5 rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-bold text-[11px]">
                {selectedCount} fiche{selectedCount !== 1 ? 's' : ''} sélectionnée{selectedCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="w-40 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {totalSelectable > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSelectAll}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-md shadow-blue-500/20 text-[11px]"
            >
              <CheckSquare size={13} />
              Tout sélectionner ({totalSelectable})
            </button>
            <button
              type="button"
              onClick={onDeselectAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold border border-border bg-background hover:bg-muted text-[11px] transition-colors"
            >
              <Square size={13} />
              Désélectionner
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
