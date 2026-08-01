import type { AddCatalogItemAndLineInput } from '../../hooks/useGroceriesVault';
import { validateAddCatalogItemAndLineInput } from '../groceryValidation';

describe('validateAddCatalogItemAndLineInput', () => {
  const valid: AddCatalogItemAndLineInput = {
    name: ' Milk ',
    category: 'dairy',
  };

  it.each([
    ['blank name', { name: '   ' }],
    ['overlong name', { name: 'x'.repeat(201) }],
    ['invalid category', { category: 'invalid' }],
    ['negative price', { price: -1 }],
    ['NaN price', { price: Number.NaN }],
    ['out-of-range price', { price: 100_000 }],
    ['invalid image URL', { imageUrl: 'not-a-url' }],
    [
      'too many links',
      { links: Array.from({ length: 11 }, () => 'https://example.com') },
    ],
    ['negative quantity', { amount: '-1kg' }],
    ['malformed quantity', { amount: '1kg!' }],
  ])('rejects %s', (_label, override) => {
    expect(() =>
      validateAddCatalogItemAndLineInput({
        ...valid,
        ...override,
      } as AddCatalogItemAndLineInput),
    ).toThrow();
  });

  it('accepts blank and supported unit quantities and normalizes name/amount', () => {
    expect(
      validateAddCatalogItemAndLineInput({ ...valid, amount: '  500g  ' }),
    ).toMatchObject({ name: 'Milk', amount: '500g' });
    expect(
      validateAddCatalogItemAndLineInput({ ...valid, amount: '   ' }),
    ).toMatchObject({ name: 'Milk', amount: undefined });
    expect(
      validateAddCatalogItemAndLineInput({ ...valid, amount: '1 dozen' }),
    ).toMatchObject({ name: 'Milk', amount: '1 dozen' });
  });
});
