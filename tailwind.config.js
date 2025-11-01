/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './index.html',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        'primary': 'var(--text-primary)',
        'secondary': 'var(--text-secondary)',
        'muted': 'var(--text-muted)',
        'on-primary-accent': 'var(--text-on-primary-accent)',
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-muted': 'var(--bg-muted)',
        'bg-hover': 'var(--bg-hover)',
        'bg-primary-accent': 'var(--bg-primary-accent)',
        'bg-accent-hover': 'var(--bg-accent-hover)',
        'border-primary': 'var(--border-primary)',
        'border-secondary': 'var(--border-secondary)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        sans: ['var(--font-main)', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
