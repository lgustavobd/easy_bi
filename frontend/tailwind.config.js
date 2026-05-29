/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        easy: { orange: '#F97316', orangeDark: '#EA580C', ink: '#171717', graphite: '#27272A', cloud: '#F8FAFC', muted: '#64748B' }
      },
      boxShadow: {
        soft: '0 18px 60px rgba(15, 23, 42, 0.08)',
        glow: '0 0 0 1px rgba(249, 115, 22, 0.12), 0 20px 70px rgba(249, 115, 22, 0.16)'
      }
    }
  },
  plugins: []
}
