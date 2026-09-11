/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0f19',
        darkCard: '#111827',
        darkBorder: '#1f2937',
        brandPrimary: '#6366f1',
        brandHover: '#4f46e5'
      }
    },
  },
  plugins: [],
}
