/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        accent: '#7C3AED',
        surface: '#F8FAFC',
        ink: '#0F172A'
      },
      borderRadius: {
        xl: '1rem'
      },
      boxShadow: {
        soft: '0 18px 45px -20px rgba(15, 23, 42, 0.28)',
        glow: '0 30px 80px -35px rgba(37, 99, 235, 0.45)'
      },
      backgroundImage: {
        hero: 'radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 35%), radial-gradient(circle at top right, rgba(124, 58, 237, 0.18), transparent 32%), linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
        'hero-dark': 'radial-gradient(circle at top left, rgba(37, 99, 235, 0.32), transparent 28%), radial-gradient(circle at 80% 10%, rgba(124, 58, 237, 0.28), transparent 24%), linear-gradient(180deg, #081224 0%, #0F172A 52%, #111827 100%)'
      }
    }
  },
  plugins: []
};
