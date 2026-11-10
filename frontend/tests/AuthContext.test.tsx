import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../src/context/AuthContext';
import { useAuth } from '../src/context/auth';
import { getCurrentProfile, loginUser } from '../src/services/api';

vi.mock('../src/services/api', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/api')>(), loginUser: vi.fn(), getCurrentProfile: vi.fn(),
}));
const profile = {id_user: 7, username: 'tester', nama: 'Nama Lengkap Persisten'};
beforeEach(() => {
  vi.mocked(loginUser).mockReset().mockResolvedValue({access_token:'test-token',token_type:'bearer'});
  vi.mocked(getCurrentProfile).mockReset().mockResolvedValue(profile);
});
function Probe() {
  const auth=useAuth();
  return <><p>{auth.isAuthenticated ? auth.user?.nama : 'Anonim'}</p>
    <button onClick={()=>void auth.login({username:'tester',password:'test-password'}).catch(()=>{})}>Masuk uji</button>
    <button onClick={auth.logout}>Keluar uji</button></>;
}
it('loads the persistent full name after login and again after logout/login',async()=>{
  render(<AuthProvider><Probe /></AuthProvider>);
  const user=userEvent.setup();
  await user.click(screen.getByText('Masuk uji'));await screen.findByText(profile.nama);
  await user.click(screen.getByText('Keluar uji'));expect(screen.getByText('Anonim')).toBeTruthy();
  await user.click(screen.getByText('Masuk uji'));await screen.findByText(profile.nama);
  expect(getCurrentProfile).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem('user_info')).toBeNull();
});
it('rehydrates from the backend after refresh even with missing or stale client profile',async()=>{
  localStorage.setItem('access_token','test-token');
  localStorage.setItem('user_info',JSON.stringify({username:'wrong',nama:'Wrong User'}));
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(screen.queryByText('Wrong User')).toBeNull();
  await screen.findByText(profile.nama);
  expect(getCurrentProfile).toHaveBeenCalledWith('test-token',expect.any(AbortSignal));
});
it('rejects invalid session without rendering a cached name',async()=>{
  localStorage.setItem('access_token','invalid');
  localStorage.setItem('user_info',JSON.stringify(profile));
  vi.mocked(getCurrentProfile).mockRejectedValue(new Error('Unauthorized'));
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(()=>expect(localStorage.getItem('access_token')).toBeNull());
  expect(screen.queryByText(profile.nama)).toBeNull();
});
it('cannot restore an old profile after logout while a request is pending',async()=>{
  localStorage.setItem('access_token','test-token');
  let finish!:(value:typeof profile)=>void;
  vi.mocked(getCurrentProfile).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  render(<AuthProvider><Probe /></AuthProvider>);
  await userEvent.click(screen.getByText('Keluar uji'));
  await act(async()=>finish(profile));
  expect(screen.queryByText(profile.nama)).toBeNull();
});
it('switches accounts without retaining the previous display name',async()=>{
  render(<AuthProvider><Probe /></AuthProvider>);
  await userEvent.click(screen.getByText('Masuk uji'));await screen.findByText(profile.nama);
  await userEvent.click(screen.getByText('Keluar uji'));
  vi.mocked(getCurrentProfile).mockResolvedValue({id_user:8,username:'other',nama:'Pengguna Kedua'});
  await userEvent.click(screen.getByText('Masuk uji'));await screen.findByText('Pengguna Kedua');
  expect(screen.queryByText(profile.nama)).toBeNull();
});
