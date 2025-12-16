
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
		"./lib/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Imagitales custom colors
				"story-purple": {
					DEFAULT: "#9b87f5",
					50: "#f5f3fe",
					100: "#ede8fd",
					200: "#dbd1fb",
					300: "#c0aef8",
					400: "#a183f3",
					500: "#9b87f5",
					600: "#7953e3",
					700: "#6c3dd1",
					800: "#5a33ab",
					900: "#4c2d8a",
					950: "#301a59"
				},
				"story-blue": {
					DEFAULT: "#D3E4FD",
					50: "#f0f6fe",
					100: "#deeafe",
					200: "#c5d8fc",
					300: "#9dbef8",
					400: "#6e9df2",
					500: "#4b7dec",
					600: "#3660df",
					700: "#2b4cca",
					800: "#2840a4",
					900: "#263a82",
					950: "#192451"
				},
				"story-green": {
					DEFAULT: "#F2FCE2",
					50: "#f7fee7",
					100: "#ecfccb",
					200: "#d9f99d",
					300: "#bef264",
					400: "#98e032",
					500: "#77c20a",
					600: "#5d9c07",
					700: "#477a0a",
					800: "#3b600e",
					900: "#335110",
					950: "#182c05"
				},
				"story-yellow": {
					DEFAULT: "#FEF7CD",
					50: "#fefce8",
					100: "#fef9c3",
					200: "#fef08a",
					300: "#fee04a",
					400: "#fecc15",
					500: "#eab308",
					600: "#ca8a04",
					700: "#a16207",
					800: "#854d0e",
					900: "#713f12",
					950: "#422006"
				},
				"story-pink": {
					DEFAULT: "#FFDEE2",
					50: "#fff1f3",
					100: "#ffe4e8",
					200: "#fecdd6",
					300: "#fea3b4",
					400: "#fd6f8e",
					500: "#f83b6c",
					600: "#e91e50",
					700: "#c90d3c",
					800: "#a70f35",
					900: "#8c1230",
					950: "#4e0515"
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0", opacity: "0" },
					to: { height: "var(--radix-accordion-content-height)", opacity: "1" }
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
					to: { height: "0", opacity: "0" }
				},
				"fade-in": {
					"0%": {
						opacity: "0",
						transform: "translateY(10px)"
					},
					"100%": {
						opacity: "1",
						transform: "translateY(0)"
					}
				},
				"float": {
					"0%, 100%": {
						transform: "translateY(0)"
					},
					"50%": {
						transform: "translateY(-10px)"
					}
				},
				"pulse-light": {
					"0%, 100%": {
						opacity: "1"
					},
					"50%": {
						opacity: "0.7"
					}
				}
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"fade-in": "fade-in 0.5s ease-out",
				"float": "float 3s ease-in-out infinite",
				"pulse-light": "pulse-light 4s ease-in-out infinite"
			},
			fontFamily: {
				"story": ["Comic Sans MS", "Comic Sans", "cursive"],
				"reading": ["Verdana", "Geneva", "Tahoma", "sans-serif"]
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
