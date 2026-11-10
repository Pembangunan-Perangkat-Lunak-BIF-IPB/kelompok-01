import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../src/context/AuthContext';
import { useAuth } from '../src/context/auth';
import { loginUser } from '../src/services/api';

vi.mock('../src/services/api', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/api')>(), loginUser: vi.fn(),
}));
beforeEach(() => vi.mocked(loginUser).mockResolvedValue({ access_token: 'test-token', token_type: 'bearer' }));
function Probe() {
  const auth = useAuth();
  return <><p>{auth.isAuthenticated ? auth.user?.username : 'Anonim'}</p>
    <button onClick={() => void auth.login({ username: 'tester', password: 'test-password' })}>Masuk uji</button>
    <button onClick={auth.logout}>Keluar uji</button></>;
}
it('authenticates from the token-only login DTO without fabricating a server role', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await userEvent.click(screen.getByText('Masuk uji'));
  await screen.findByText('tester');
  expect(JSON.parse(localStorage.getItem('user_info')!)).toMatchObject({ username: 'tester' });
  expect(JSON.parse(localStorage.getItem('user_info')!).role).toBeUndefined();
  act(() => { window.dispatchEvent(new Event('genopath:unauthorized')); });
  expect(screen.getByText('Anonim')).toBeTruthy();
});
it('handles a damaged saved profile without rendering authenticated routes', () => {
  localStorage.setItem('access_token', 'test-token'); localStorage.setItem('user_info', '{invalid');
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(screen.getByText('Anonim')).toBeTruthy();
});
