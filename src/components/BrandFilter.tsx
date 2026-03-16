import { Select } from '@/components/ui/select';

interface BrandFilterProps {
  brands: string[];
  value: string;
  onChange: (value: string) => void;
}

export function BrandFilter({
  brands,
  value,
  onChange,
}: BrandFilterProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-[180px]"
    >
      <option value="">Toutes les marques</option>
      {brands.map((brand) => (
        <option key={brand} value={brand}>
          {brand}
        </option>
      ))}
    </Select>
  );
}
