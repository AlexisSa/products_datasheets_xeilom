import { Select } from '@/components/ui/select';

export type SortOption = 'name-asc' | 'name-desc' | 'sku-asc' | 'sku-desc' | 'category';

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="w-[180px]"
    >
      <option value="name-asc">Nom A-Z</option>
      <option value="name-desc">Nom Z-A</option>
      <option value="sku-asc">Référence A-Z</option>
      <option value="sku-desc">Référence Z-A</option>
      <option value="category">Catégorie</option>
    </Select>
  );
}
