import { editItemSchema } from '../schemas/editItemSchema';

const VALID_BASE = {
  name: 'Test Item',
  checked: false,
  category: 'produce' as const,
  amount: '',
  price: '',
  notes: '',
  imageUrl: '',
  links: [],
};

describe('editItemSchema validation', () => {
  describe('name field', () => {
    it('passes with valid name', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, name: 'Milk' });
      expect(result.success).toBe(true);
    });

    it('trims whitespace and passes', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        name: '  Whole Milk  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Whole Milk');
      }
    });

    it('fails with empty string', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('required');
      }
    });

    it('fails with only whitespace', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, name: '   ' });
      expect(result.success).toBe(false);
    });

    it('passes with exactly 200 characters', () => {
      const longName = 'A'.repeat(200);
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        name: longName,
      });
      expect(result.success).toBe(true);
    });

    it('fails with 201 characters', () => {
      const longName = 'A'.repeat(201);
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        name: longName,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('200 characters');
      }
    });

    it('passes with unicode characters', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        name: 'Café au lait',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('checked field', () => {
    it('passes with true', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, checked: true });
      expect(result.success).toBe(true);
    });

    it('passes with false', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        checked: false,
      });
      expect(result.success).toBe(true);
    });

    it('fails with non-boolean (number 1 does not coerce)', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        checked: 1 as any,
      });
      expect(result.success).toBe(false);
    });

    it('fails with non-boolean (number 0 does not coerce)', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        checked: 0 as any,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('category field', () => {
    it('passes with each valid category', () => {
      const validCategories = [
        'produce',
        'dairy',
        'meat',
        'seafood',
        'bakery',
        'frozen',
        'beverages',
        'snacks',
        'condiments',
        'household',
        'personal-care',
        'other',
      ];

      for (const cat of validCategories) {
        const result = editItemSchema.safeParse({
          ...VALID_BASE,
          category: cat as any,
        });
        expect(result.success).toBe(true);
      }
    });

    it('fails with invalid category', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        category: 'invalid-category' as any,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('amount field', () => {
    it('passes with valid amount examples', () => {
      const amounts = ['2L', '1 dozen', '500g', '1 box'];
      for (const amount of amounts) {
        const result = editItemSchema.safeParse({ ...VALID_BASE, amount });
        expect(result.success).toBe(true);
      }
    });

    it('passes with empty string', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, amount: '' });
      expect(result.success).toBe(true);
    });

    it('passes with exactly 50 characters', () => {
      const amount = 'A'.repeat(50);
      const result = editItemSchema.safeParse({ ...VALID_BASE, amount });
      expect(result.success).toBe(true);
    });

    it('fails with 51 characters', () => {
      const amount = 'A'.repeat(51);
      const result = editItemSchema.safeParse({ ...VALID_BASE, amount });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('50 characters');
      }
    });
  });

  describe('price field', () => {
    it('passes with empty string', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, price: '' });
      expect(result.success).toBe(true);
    });

    it('passes with valid price string', () => {
      const prices = ['3.49', '0', '99999', '1.5', '100.99'];
      for (const price of prices) {
        const result = editItemSchema.safeParse({ ...VALID_BASE, price });
        expect(result.success).toBe(true);
      }
    });

    it('fails with non-numeric string', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, price: 'abc' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid number');
      }
    });

    it('fails with negative number', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, price: '-5' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'between 0 and 99,999',
        );
      }
    });

    it('fails with number >= 100000', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        price: '100000',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'between 0 and 99,999',
        );
      }
    });

    it('passes with boundary 0', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, price: '0' });
      expect(result.success).toBe(true);
    });

    it('passes with boundary 99999', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        price: '99999',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('notes field', () => {
    it('passes with valid notes', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        notes: 'Get organic if available',
      });
      expect(result.success).toBe(true);
    });

    it('passes with empty string', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, notes: '' });
      expect(result.success).toBe(true);
    });

    it('passes with exactly 1000 characters', () => {
      const notes = 'A'.repeat(1000);
      const result = editItemSchema.safeParse({ ...VALID_BASE, notes });
      expect(result.success).toBe(true);
    });

    it('fails with 1001 characters', () => {
      const notes = 'A'.repeat(1001);
      const result = editItemSchema.safeParse({ ...VALID_BASE, notes });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1000 characters');
      }
    });

    it('passes with unicode characters', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        notes: 'Préféré biologique',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('imageUrl field', () => {
    it('passes with valid HTTPS URL', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        imageUrl: 'https://example.com/image.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('passes with empty string', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, imageUrl: '' });
      expect(result.success).toBe(true);
    });

    it('passes with valid HTTP URL', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        imageUrl: 'https://store.com/product',
      });
      expect(result.success).toBe(true);
    });

    it('fails with invalid URL', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        imageUrl: 'not a url',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid URL');
      }
    });

    it('fails with malformed URL', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        imageUrl: 'http://',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('links field', () => {
    it('passes with empty array', () => {
      const result = editItemSchema.safeParse({ ...VALID_BASE, links: [] });
      expect(result.success).toBe(true);
    });

    it('passes with single valid URL', () => {
      const result = editItemSchema.safeParse({
        ...VALID_BASE,
        links: ['https://example.com'],
      });
      expect(result.success).toBe(true);
    });

    it('passes with exactly 10 valid URLs', () => {
      const links = Array(10).fill('https://example.com');
      const result = editItemSchema.safeParse({ ...VALID_BASE, links });
      expect(result.success).toBe(true);
    });

    it('fails with 11 URLs', () => {
      const links = Array(11).fill('https://example.com');
      const result = editItemSchema.safeParse({ ...VALID_BASE, links });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('10 links');
      }
    });

    it('fails when one URL is invalid', () => {
      const links = ['https://valid.com', 'not a url'];
      const result = editItemSchema.safeParse({ ...VALID_BASE, links });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid URL');
      }
    });

    it('passes with multiple valid URLs (5)', () => {
      const links = [
        'https://a.com',
        'https://b.com',
        'https://c.com',
        'https://d.com',
        'https://e.com',
      ];
      const result = editItemSchema.safeParse({ ...VALID_BASE, links });
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid object', () => {
    it('passes with all fields filled', () => {
      const data = {
        name: 'Premium Milk',
        checked: true,
        category: 'dairy' as const,
        amount: '1L',
        price: '3.49',
        notes: 'Organic, grass-fed',
        imageUrl: 'https://example.com/milk.jpg',
        links: ['https://store.com/milk', 'https://brand.com'],
      };
      const result = editItemSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('passes with minimal required fields', () => {
      const data = {
        name: 'Item',
        checked: false,
        category: 'other' as const,
        amount: '',
        price: '',
        notes: '',
        imageUrl: '',
        links: [],
      };
      const result = editItemSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
