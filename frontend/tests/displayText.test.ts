import { expect, it } from 'vitest';
import { displayReferenceName } from '../src/services/displayText';

it('normalizes only the displayed reference name without changing source metadata', () => {
  const reference={nama_genom:'Fixture sintetis 20 kbp \u2014 BUKAN Garlic.V2 \u2013 uji'};
  expect(displayReferenceName(reference.nama_genom)).toBe('Fixture sintetis 20 kbp - BUKAN Garlic.V2 - uji');
  expect(reference.nama_genom).toContain('\u2014');
  expect(displayReferenceName('Garlic.V2 - SE')).toBe('Garlic.V2 - SE');
});
