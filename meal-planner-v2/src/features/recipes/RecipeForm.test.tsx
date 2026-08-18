import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_RECIPES } from '../../domain/seed';
import { CUISINE_IDS, CUISINE_LABELS, type CuisineId, type Recipe } from '../../domain/types';
import { RecipeForm } from './RecipeForm';

let mounted: { container: HTMLDivElement; root: Root } | null = null;

async function renderForm(recipe?: Recipe) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onSave = vi.fn();
  mounted = { container, root };
  await act(async () => {
    root.render(<RecipeForm recipe={recipe} onSave={onSave} onCancel={vi.fn()} />);
  });
  return { container, onSave };
}

function field<T extends HTMLInputElement | HTMLSelectElement>(
  container: Element,
  label: string,
): T {
  const matchingLabel = Array.from(container.querySelectorAll('label')).find((candidate) =>
    Array.from(candidate.children).some(
      (child) => child.tagName === 'SPAN' && child.textContent?.trim() === label,
    ),
  );
  const control = matchingLabel?.querySelector('input, select');
  if (!control) throw new Error(`Could not find field labelled ${label}.`);
  return control as T;
}

async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  await act(async () => {
    setter?.call(control, value);
    control.dispatchEvent(
      new Event(control instanceof HTMLSelectElement ? 'change' : 'input', {
        bubbles: true,
      }),
    );
  });
}

async function submit(container: Element) {
  const form = container.querySelector('form');
  if (!form) throw new Error('Could not find recipe form.');
  await act(async () =>
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

async function completeMinimumRecipe(container: Element) {
  await change(field(container, 'Recipe name'), 'Family noodles');
  await change(field(container, 'Ingredient 1'), 'Noodles');
}

afterEach(async () => {
  if (!mounted) return;
  await act(async () => mounted?.root.unmount());
  mounted.container.remove();
  mounted = null;
});

describe('RecipeForm cuisine selection', () => {
  it('requires an explicit controlled cuisine for a new recipe without preselecting one', async () => {
    const { container, onSave } = await renderForm();
    const cuisine = field<HTMLSelectElement>(container, 'Cuisine');
    const newRecipeCuisines = CUISINE_IDS.filter((id) => id !== 'uncategorised');

    expect(cuisine.value).toBe('');
    expect(Array.from(cuisine.options).map((option) => option.value)).toEqual([
      '',
      ...newRecipeCuisines,
    ]);
    expect(Array.from(cuisine.options).map((option) => option.textContent)).toEqual([
      'Choose a cuisine',
      ...newRecipeCuisines.map((id) => CUISINE_LABELS[id]),
    ]);

    await completeMinimumRecipe(container);
    await submit(container);

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Choose a cuisine.');
  });

  it('accepts an explicit Other selection', async () => {
    const { container, onSave } = await renderForm();
    await completeMinimumRecipe(container);
    await change(field(container, 'Cuisine'), 'other');

    await submit(container);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ cuisine: 'other' }));
  });

  it('does not offer Uncategorised as a shortcut for a new recipe', async () => {
    const { container } = await renderForm();

    expect(
      Array.from(field<HTMLSelectElement>(container, 'Cuisine').options).map(
        (option) => option.value,
      ),
    ).not.toContain('uncategorised');
  });

  it.each([
    ['a categorised recipe', 'italian'],
    ['a migrated recipe', 'uncategorised'],
  ] as const)('preserves cuisine when editing %s', async (_label, cuisine) => {
    const recipe = { ...SEED_RECIPES[0], cuisine };
    const { container, onSave } = await renderForm(recipe);

    await change(field(container, 'Recipe name'), 'Edited family recipe');
    await submit(container);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: recipe.id,
        name: 'Edited family recipe',
        cuisine,
      }),
    );
  });

  it('changes an existing cuisine only when deliberately selected', async () => {
    const recipe = { ...SEED_RECIPES[0], cuisine: 'nordic' as CuisineId };
    const { container, onSave } = await renderForm(recipe);

    await change(field(container, 'Cuisine'), 'thai');
    await submit(container);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ cuisine: 'thai' }));
  });
});
