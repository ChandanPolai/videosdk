/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          200: 'var(--color-brand-200)',
          500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)',
          700: 'var(--color-brand-700)',
          800: 'var(--color-brand-800)',
          900: 'var(--color-brand-900)'
        },
        surface: {
          light: 'var(--color-surface-light)',
          card: 'var(--color-surface-card)',
          border: 'var(--color-surface-border)'
        }
      },
      borderRadius: {
        input: 'var(--radius-input)',
        btn: 'var(--radius-button)',
        card: 'var(--radius-card)'
      }
    }
  },
  plugins: []
};
