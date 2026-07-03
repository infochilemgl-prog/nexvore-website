import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "#141210",
        cream: "#FBF8F0",
        green: "#2ED11E",
        "yellow-fluor": "#E8D400",
      },
      fontFamily: {
        heading: ["Fredoka", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      fontSize: {
        "hero": ["clamp(2.25rem, 5vw + 1rem, 3.5rem)", { lineHeight: "1.05" }],
        "section": ["clamp(1.75rem, 3vw + 1rem, 2.25rem)", { lineHeight: "1.1" }],
      },
      boxShadow: {
        card: "0 8px 24px rgba(20, 18, 16, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
