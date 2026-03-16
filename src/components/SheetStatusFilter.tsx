import { Select } from '@/components/ui/select';
import type { SheetStatus } from '@/types/product';

export type SheetStatusFilterValue = SheetStatus | '';

interface SheetStatusFilterProps {
  value: SheetStatusFilterValue;
  onChange: (value: SheetStatusFilterValue) => void;
  counts?: { available: number; unavailable: number; none: number };
}

export function SheetStatusFilter({
  value,
  onChange,
  counts,
}: SheetStatusFilterProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as SheetStatusFilterValue)}
      className="w-[210px]"
    >
      <option value="">Tous les produits</option>
      <option value="available">
        Avec PDF{counts ? ` (${counts.available})` : ''}
      </option>
      <option value="unavailable">
        PDF indisponible{counts ? ` (${counts.unavailable})` : ''}
      </option>
      <option value="none">
        Sans PDF{counts ? ` (${counts.none})` : ''}
      </option>
    </Select>
  );
}
