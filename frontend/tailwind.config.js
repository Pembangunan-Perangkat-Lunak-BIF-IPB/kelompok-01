/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- PENTING: Mengaktifkan mode gelap berbasis class .dark
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--gp-bg)', surface: 'var(--gp-surface)',
        ink: 'var(--gp-text)', muted: 'var(--gp-muted)',
        brand: 'var(--gp-brand)', line: 'var(--gp-border)',
      },
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Instrument Sans', 'sans-serif'],
      },
      borderRadius: { control: 'var(--gp-radius-control)', panel: 'var(--gp-radius)' },
    },
  },
  plugins: [],
}