import type { MealSlotKind } from '../../domain/types';

export const DINNER_PLAN_OPTIONS: {
  value: Exclude<MealSlotKind, 'recipe'>;
  label: string;
  description: string;
}[] = [
  {
    value: 'leftovers',
    label: 'Leftovers',
    description: 'Use what is already cooked · no ingredients added',
  },
  {
    value: 'eat-out',
    label: 'Eat out / takeaway',
    description: 'Dinner is covered elsewhere · no ingredients added',
  },
  {
    value: 'skip',
    label: 'Skip dinner',
    description: 'No evening meal planned',
  },
];
