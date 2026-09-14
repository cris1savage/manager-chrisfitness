/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:         'var(--color-bg)',
        surface:    'var(--color-surface)',
        surfaceAlt: 'var(--color-surfaceAlt)',
        border:     'var(--color-border)',
        cyan:       'var(--color-cyan)',
        cyanDim:    'var(--color-cyanDim)',
        muted:      'var(--color-muted)',
        ink:        'var(--color-ink)',
        green:      'var(--color-green)',
        amber:      'var(--color-amber)',
        red:        'var(--color-red)',
        violet:     'var(--color-violet)',
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
