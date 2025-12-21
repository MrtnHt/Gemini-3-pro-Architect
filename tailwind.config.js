import scrollbar from 'tailwind-scrollbar';

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [scrollbar({ nocompatible: true })],
};
