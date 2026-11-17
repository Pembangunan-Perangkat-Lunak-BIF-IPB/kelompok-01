import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Alert, FormField, Pagination, StatusBadge, TableFrame } from '../src/components/ui/Foundation';

it('blocks repeated actions while loading and exposes busy state',async()=>{
 const action=vi.fn();render(<Button loading onClick={action}>Unduh hasil</Button>);
 const button=screen.getByRole('button',{name:'Unduh hasil'});expect(button.getAttribute('aria-busy')).toBe('true');
 await userEvent.click(button);expect(action).not.toHaveBeenCalled();
});
it('keeps errors and success announced without relying on color',()=>{
 render(<><Alert>Server belum tersedia.</Alert><Alert tone="success">Selesai disimpan.</Alert><StatusBadge status="Failed"/></>);
 expect(screen.getByRole('alert').textContent).toContain('Server');expect(screen.getByRole('status').textContent).toContain('Selesai');expect(screen.getByText('Failed').getAttribute('title')).toBe('Gagal');
});
it('preserves native field labels and descriptive help',()=>{
 render(<FormField htmlFor="specimen" label="Nama analisis" hint="Opsional"><input id="specimen" aria-describedby="specimen-help"/></FormField>);
 expect(screen.getByLabelText('Nama analisis').getAttribute('aria-describedby')).toBe('specimen-help');expect(screen.getByText('Opsional').id).toBe('specimen-help');
});
it('keeps the scientific table scroll region keyboard reachable',async()=>{
 render(<TableFrame label="Varian"><table><caption>Varian asli</caption><tbody><tr><td>C,AT</td></tr></tbody></table></TableFrame>);
 await userEvent.tab();expect(document.activeElement).toBe(screen.getByRole('region',{name:'Varian'}));expect(screen.getByText('C,AT')).toBeTruthy();
});
it('honors server pagination availability without inventing a page',async()=>{
 const previous=vi.fn(),next=vi.fn();render(<Pagination from={11} to={12} total={12} previous={previous} next={next} canPrevious canNext={false}/>);
 await userEvent.click(screen.getByRole('button',{name:'Selanjutnya'}));expect(next).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Sebelumnya'}));expect(previous).toHaveBeenCalledTimes(1);
 expect(screen.getByText('Menampilkan 11-12 dari 12 record setelah filter.')).toBeTruthy();
});
