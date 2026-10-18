import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source=readFileSync(resolve(import.meta.dirname,'../client/src/pages/Admin.tsx'),'utf8');
const products=source.slice(source.indexOf('function AdminProducts('),source.indexOf('function AdminInventory('));
describe('reversible product removal controls',()=>{
 it('offers list and editor removal buttons with a product-specific confirmation',()=>{
  expect(products).toContain('Премахни артикула');
  expect(products).toContain('aria-label={`Премахни ${product.name}`}');
  expect(products).toContain('<AlertDialog open={Boolean(archiveTarget)}');
  expect(products).toContain('archiveTarget?.sku');
  expect(products).toContain('event.preventDefault()');
 });
 it('retains the dialog and a readable error if removal fails',()=>{
  expect(products).toContain('onError: error => setArchiveError');
  expect(products).toContain('archiveError && <p role="alert"');
 });
 it('supports an explicit removed-items view and restore without automatic publication',()=>{
  expect(products).toContain('showArchived ? { includeArchived: true } : undefined');
  expect(products).toContain('Покажи премахнатите');
  expect(products).toContain('requestArchive(product, false)');
  expect(products).toContain('Артикулът е възстановен като непубликуван');
 });
 it('refreshes public and admin queries after successful removal',()=>{
  expect(products).toContain('utils.catalogue.page.invalidate()');
  expect(products).toContain('utils.catalogue.product.invalidate()');
  expect(products).toContain('utils.admin.products.invalidate()');
  expect(products).toContain('if (form.id === input.id) startNewProduct()');
 });
});
