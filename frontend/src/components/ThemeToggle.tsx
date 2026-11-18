import React, { useRef, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/theme';
import './ThemeToggle.css';

const TRACK_WIDTH = 70;
const KNOB_SIZE = 28;
const PADDING = 4;
const MAX_TRAVEL = TRACK_WIDTH - KNOB_SIZE - (PADDING * 2); // 70 - 28 - 8 = 34px

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const startXRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);
  const movedRef = useRef<boolean>(false);

  // Current progress between 0 (light) and 1 (dark)
  const currentProgress = dragProgress !== null ? dragProgress : (isDark ? 1 : 0);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only respond to left clicks or touches
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    startProgressRef.current = isDark ? 1 : 0;
    movedRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startXRef.current;
    if (Math.abs(deltaX) > 3) {
      movedRef.current = true;
    }
    const deltaProgress = deltaX / MAX_TRAVEL;
    const newProgress = Math.min(1, Math.max(0, startProgressRef.current + deltaProgress));
    setDragProgress(newProgress);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);

    if (!movedRef.current) {
      // Just a normal click/tap: toggle theme directly
      toggleTheme();
    } else if (dragProgress !== null) {
      // Dragged: decide based on 50% threshold
      const shouldBeDark = dragProgress > 0.5;
      if (shouldBeDark !== isDark) {
        toggleTheme();
      }
    }
    setDragProgress(null);
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setDragProgress(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleTheme();
    }
  };

  // Knob translation in pixels
  const knobX = currentProgress * MAX_TRAVEL;

  // Rotation and scale for sun and moon
  const sunOpacity = Math.max(0, 1 - currentProgress * 2.2);
  const sunRotate = currentProgress * 90;
  const sunScale = Math.max(0.2, 1 - currentProgress * 0.7);

  const moonOpacity = Math.max(0, (currentProgress - 0.4) * 2.2);
  const moonRotate = (1 - currentProgress) * -90;
  const moonScale = Math.max(0.2, currentProgress);

  const label = isDark ? 'Beralih ke Mode Siang' : 'Beralih ke Mode Malam';

  return (
    <div className="gp-theme-switch-wrap">
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={label}
        title={label}
        className={`gp-theme-switch ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        <div
          className="gp-theme-switch-knob"
          style={{
            transform: `translateX(${knobX}px)`,
            transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 300ms ease, box-shadow 300ms ease',
          }}
        >
          <span
            className="gp-theme-switch-icon gp-theme-switch-sun"
            style={{
              opacity: sunOpacity,
              transform: `rotate(${sunRotate}deg) scale(${sunScale})`,
              transition: isDragging ? 'none' : 'opacity 220ms ease, transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            aria-hidden="true"
          >
            <Sun size={15} strokeWidth={2.4} />
          </span>
          <span
            className="gp-theme-switch-icon gp-theme-switch-moon"
            style={{
              opacity: moonOpacity,
              transform: `rotate(${moonRotate}deg) scale(${moonScale})`,
              transition: isDragging ? 'none' : 'opacity 220ms ease, transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            aria-hidden="true"
          >
            <Moon size={15} strokeWidth={2.4} />
          </span>
        </div>
      </button>
    </div>
  );
}

export default ThemeToggle;
