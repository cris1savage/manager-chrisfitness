/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#050708',
        surface: '#0E1214',
        surfaceAlt: '#151A1D',
        border: '#212729',
        cyan: '#5ECCFA',
        cyanDim: '#3A9CC4',
        muted: '#7C878B',
        ink: '#F2F6F7',
        green: '#4ADE80',
        amber: '#FBBF24',
        red: '#F87171',
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
