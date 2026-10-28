/** @type {import('tailwindcss').Config} */
export default {
  // Penambahan: Mengizinkan switch tema manual menggunakan class="dark" di <html>
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
