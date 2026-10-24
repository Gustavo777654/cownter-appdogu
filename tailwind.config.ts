import type { Config } from "tailwindcss";

// Identidade visual herdada do projeto Cownter original (paleta verde "brand",
// tons de terra "earth", fundo "cream" e texto "dark").
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#145231",
          950: "#0d3818",
        },
        earth: {
          50: "#fdf8f3",
          100: "#f8f0e8",
          200: "#f2dcc5",
          300: "#edc8a1",
          400: "#e5a873",
          500: "#d9865d",
          600: "#bf6e47",
          700: "#a45a3a",
          800: "#8a4a32",
          900: "#774130",
        },
        dark: "#1f2937",
        cream: "#faf7f2",
      },
      fontFamily: {
        body: ['"DM Sans Variable"', "system-ui", "sans-serif"],
        display: ['"Playfair Display Variable"', "Georgia", "serif"],
      },
      keyframes: {
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "sheet-up": "sheet-up 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
