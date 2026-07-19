/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F6F3EC",
        surface: "#FFFFFF",
        "surface-muted": "#ECE8DF",
        forest: "#243C34",
        "forest-soft": "#36594C",
        terracotta: "#B86448",
        gold: "#C49A54",
        ink: "#1F2523",
        muted: "#6F7773",
        success: "#347A57",
        warning: "#C28632",
        danger: "#B64B4B",
        border: "#DDD8CD",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
