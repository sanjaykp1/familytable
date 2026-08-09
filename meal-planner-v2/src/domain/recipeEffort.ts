import type { CookAttention, MakeAhead } from './types';

export const COOK_ATTENTION_LABELS: Record<CookAttention, string> = {
  'mostly-hands-off': 'Mostly hands-off',
  'check-occasionally': 'Check occasionally',
  'hands-on': 'Hands-on cooking',
};

export const MAKE_AHEAD_LABELS: Record<MakeAhead, string> = {
  none: 'Cook on the day',
  'prep-ahead': 'Prep ahead',
  'fully-ahead': 'Make fully ahead',
};

export function isLowAttention(attention: CookAttention): boolean {
  return attention === 'mostly-hands-off';
}

export function canMakeAhead(makeAhead: MakeAhead): boolean {
  return makeAhead !== 'none';
}
