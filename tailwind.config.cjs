// File: tailwind.config.cjs

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				lime: '#E1FF00',
				gray1: '#2F2F2F',
				gray2: '#BDBDBB',
				gray3: '#E4E4E4',
				navbar: '#212121',
				confirmed: '#86EFAC',
				tentatif: '#FCD34D', 
				proposed: '#FDBA74',
				problem: '#FCA5A5',
				info: '#c4b5fd', 
				question: '#93c5fd', 
				black: '#000000',
				white: '#F7F7F7'
			},
			fontFamily: {
				helvetica: ['Helvetica Neue', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
				consolas: ['Consolas', 'Courier New', 'monospace'],
				calibri: ['Calibri', 'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif']
			}
		}
	},
	plugins: [require('@tailwindcss/line-clamp')]
};