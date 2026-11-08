/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- PENTING: Mengaktifkan mode gelap berbasis class .dark
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}