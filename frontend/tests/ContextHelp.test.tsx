import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextHelp } from '../src/components/ContextHelp';

it('supports keyboard focus, Escape, tap toggling and outside dismissal in a portal', async () => {
  const user = userEvent.setup();
  render(<div style={{ overflow: 'hidden' }}><ContextHelp label="QUAL">Penjelasan kualitas.</ContextHelp><button>Di luar</button></div>);
  const trigger = screen.getByRole('button', { name: 'Bantuan QUAL' });
  await user.tab();
  expect(document.activeElement).toBe(trigger);
  expect(screen.getByRole('tooltip').parentElement).toBe(document.body);
  expect(trigger.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).toBeNull();
  await user.click(trigger);
  expect(screen.getByRole('tooltip')).toBeTruthy();
  await user.click(trigger);
  expect(screen.queryByRole('tooltip')).toBeNull();
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Di luar' }));
  expect(screen.queryByRole('tooltip')).toBeNull();
});
