// File: tailwind.config.cjs

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Static colors (never change)
				lime: '#E1FF00',
				gray1: '#2F2F2F',
				gray2: '#BDBDBB',
				gray3: '#060505',
				navbar: '#333333',
				confirmed: '#86EFAC',
				tentatif: '#FCD34D', 
				proposed: '#FDBA74',
				problem: '#FCA5A5',
				info: '#c4b5fd', 
				question: '#93c5fd', 
				black: '#000000',
				white: '#F7F7F7',
				
				// Semantic theme colors (dynamic via CSS variables)
				primary: 'var(--color-primary)',
				'bg-primary': 'var(--color-bg-primary)',
				'bg-secondary': 'var(--color-bg-secondary)',
				'bg-tertiary': 'var(--color-bg-tertiary)',
				'text-primary': 'var(--color-text-primary)',
				'text-secondary': 'var(--color-text-secondary)',
				'text-muted': 'var(--color-text-muted)',
				border: 'var(--color-border)',
				accent: 'var(--color-accent)',
				hover: 'var(--color-hover)'
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