import type { CuisineId } from '../../domain/types';
import { CUISINE_LABELS } from '../../domain/types';

export type CuisineChipValue = 'all' | CuisineId;

export function CuisineChips({
  value,
  cuisines,
  onChange,
  label = 'Filter by cuisine',
  allLabel = 'All cuisines',
}: {
  value: CuisineChipValue;
  cuisines: readonly CuisineId[];
  onChange: (value: CuisineChipValue) => void;
  label?: string;
  allLabel?: string;
}) {
  const options: { value: CuisineChipValue; label: string }[] = [
    { value: 'all', label: allLabel },
    ...cuisines.map((cuisine) => ({ value: cuisine, label: CUISINE_LABELS[cuisine] })),
  ];

  return (
    <div className="cuisine-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : ''}
          aria-pressed={value === option.value}
          onClick={() => {
            if (value !== option.value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
