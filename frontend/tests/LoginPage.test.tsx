import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../src/pages/LoginPage';
const auth=vi.hoisted(()=>({login:vi.fn(),register:vi.fn()}));
vi.mock('../src/context/auth',()=>({useAuth:()=>auth}));
vi.mock('../src/context/theme',()=>({useTheme:()=>({theme:'light',toggleTheme:vi.fn()})}));
beforeEach(()=>{auth.login.mockReset().mockResolvedValue(undefined);auth.register.mockReset();});
function mount(){render(<MemoryRouter initialEntries={[{pathname:'/login',state:{from:'/riwayat'}}]}><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/riwayat" element={<h1>Riwayat tujuan</h1>}/></Routes></MemoryRouter>);}
it('keeps username/password login and resumes the new protected history route',async()=>{
 mount();const user=userEvent.setup();await user.type(screen.getByLabelText('Nama pengguna'),'tester');await user.type(screen.getByLabelText('Kata sandi'),'test-password');await user.click(screen.getByRole('button',{name:'Masuk Akun'}));await screen.findByRole('heading',{name:'Riwayat tujuan'});expect(auth.login).toHaveBeenCalledWith({username:'tester',password:'test-password'});
});
it('supports keyboard account tabs and labels the password toggle',async()=>{
 mount();const user=userEvent.setup();screen.getByRole('tab',{name:'Masuk Akun'}).focus();await user.keyboard('{ArrowRight}');expect(screen.getByLabelText('Nama lengkap')).toBeTruthy();expect(screen.getByRole('tab',{name:'Buat Akun'}).getAttribute('aria-selected')).toBe('true');await user.keyboard('{Home}');expect(screen.queryByLabelText('Nama lengkap')).toBeNull();await user.click(screen.getByRole('button',{name:'Tampilkan kata sandi'}));expect(screen.getByLabelText('Kata sandi').getAttribute('type')).toBe('text');
});
it('announces authentication errors without navigating or claiming success',async()=>{
 auth.login.mockRejectedValue(new Error('network'));mount();const user=userEvent.setup();await user.type(screen.getByLabelText('Nama pengguna'),'tester');await user.type(screen.getByLabelText('Kata sandi'),'test-password');await user.click(screen.getByRole('button',{name:'Masuk Akun'}));await screen.findByRole('alert');expect(screen.queryByRole('heading',{name:'Riwayat tujuan'})).toBeNull();
});
