import { expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { TeamSection } from '../src/components/TeamSection';

const members = [
  ['Roni Andripan','G0401241005','Software Tester','u1.png'],
  ['Fajar Dhuha Zafran','G0401241009','Back-End Developer','u2.png'],
  ['Rafif Alfarrel Nugroho','G0401241015','Project Manager','u3.png'],
  ['Azril Ilham Fajrian','G0401241020','Front-End Developer','u4.png'],
  ['Aldo Rafiz Aprilian','G0401241051','System Analyst','u5.png'],
];
it('preserves original image order and associates each confirmed NIM/name/role correctly', () => {
  render(<TeamSection />);
  expect(screen.getByRole('img', { name:'Tim GenoPath' }).getAttribute('src')).toContain('Uchiha.jpg');
  for (const [name,nim,role,file] of members) {
    const card=screen.getByRole('button', {name});
    expect(within(card).getByText(nim)).toBeTruthy();
    expect(within(card).getByText(role)).toBeTruthy();
    expect(screen.getByRole('img',{name}).getAttribute('src')).toContain(file);
  }
  expect(screen.queryByText(/G440/)).toBeNull();
});
it('restores hover cutout, blur/scale transitions and timed name animation, then resets', () => {
  vi.useFakeTimers();
  const view=render(<TeamSection />);
  const card=screen.getByRole('button',{name:members[0][0]});
  fireEvent.mouseEnter(card);
  expect(screen.getByRole('img',{name:members[0][0]}).className).toContain('opacity-100');
  expect(screen.getByRole('img',{name:'Tim GenoPath'}).className).toContain('blur-md');
  act(()=>vi.advanceTimersByTime(60));
  expect(card.querySelector('.scale-125')).toBeTruthy();
  fireEvent.mouseLeave(card);
  expect(screen.getByRole('img',{name:members[0][0]}).className).toContain('opacity-0');
  fireEvent.focus(card);
  expect(card.getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(card,{key:'Escape'});
  expect(card.getAttribute('aria-pressed')).toBe('false');
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
