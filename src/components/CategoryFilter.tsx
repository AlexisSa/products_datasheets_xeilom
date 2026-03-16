import { Select } from '@/components/ui/select';

interface CategoryFilterProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
}

export function CategoryFilter({
  categories,
  value,
  onChange,
}: CategoryFilterProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-[200px]"
    >
      <option value="">Toutes les catégories</option>
      {categories.map((cat) => (
        <option key={cat} value={cat}>
          {cat}
        </option>
      ))}
    </Select>
  );
}
