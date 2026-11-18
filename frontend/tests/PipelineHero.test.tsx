import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineHero } from '../src/components/PipelineHero';
afterEach(()=>vi.unstubAllGlobals());
function finishAnimation(element: Element, name: string) {
 const event = new Event('animationend', { bubbles: true });
 Object.defineProperty(event, 'animationName', { value: name });
 fireEvent(element, event);
}
it('explains four real product stages without claiming a live job or biological numbers',()=>{
 render(<PipelineHero/>);const list=screen.getByRole('list',{name:'Tahap pipeline GenoPath'});expect(list.querySelectorAll('li').length).toBe(4);
 for(const title of ['FASTQ','Konfigurasi','Pipeline','Hasil varian'])expect(screen.getByText(title)).toBeTruthy();
 expect(screen.getByText('Ilustrasi alur analisis')).toBeTruthy();expect(screen.queryByRole('progressbar')).toBeNull();
});
it('lets keyboard users pause and resume the illustration without submitting anything',async()=>{
 render(<PipelineHero/>);const pause=screen.getByRole('button',{name:'Jeda animasi alur'});await userEvent.tab();expect(document.activeElement).toBe(pause);
 await userEvent.keyboard('{Enter}');expect(screen.getByRole('button',{name:'Putar animasi alur'}).getAttribute('aria-pressed')).toBe('true');
 await userEvent.keyboard('{Enter}');expect(screen.getByRole('button',{name:'Jeda animasi alur'}).getAttribute('aria-pressed')).toBe('false');
});
it('changes to a slow idle loop only after the sample completes its first traversal',()=>{
 const {container}=render(<PipelineHero/>);const figure=container.querySelector('figure')!;
 finishAnimation(container.querySelector('.gp-hook-draw')!,'gp-hook-line');expect(figure.classList.contains('is-idle')).toBe(false);
 finishAnimation(container.querySelector('.gp-flow-sample')!,'gp-sample-first');expect(figure.classList.contains('is-idle')).toBe(true);
});
it('provides a static diagram and disabled motion control for reduced-motion',()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 const {container}=render(<PipelineHero/>);expect(container.querySelector('figure')?.getAttribute('data-motion')).toBe('static');
 expect((screen.getByRole('button',{name:'Animasi alur nonaktif sesuai preferensi perangkat'}) as HTMLButtonElement).disabled).toBe(true);
});
it('pauses a nonessential loop when the hero leaves the viewport',()=>{
 let callback:IntersectionObserverCallback=()=>{};
 vi.stubGlobal('IntersectionObserver',class {constructor(cb:IntersectionObserverCallback){callback=cb;}observe(){}disconnect(){}});
 const {container}=render(<PipelineHero/>);
 act(()=>callback([{isIntersecting:false} as IntersectionObserverEntry],{} as IntersectionObserver));
 expect(container.querySelector('figure')?.getAttribute('data-motion')).toBe('paused');
});

it('pauses and resumes when document visibility changes',()=>{
 const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(false);
 const {container}=render(<PipelineHero/>);
 hidden.mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));
 expect(container.querySelector('figure')?.getAttribute('data-motion')).toBe('paused');
 hidden.mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));
 expect(container.querySelector('figure')?.getAttribute('data-motion')).toBe('entrance');
 hidden.mockRestore();
});
