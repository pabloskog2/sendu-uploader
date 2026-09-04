import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2a4f7c",
          dark: "#1f3f64",
          light: "#eef3fa",
        },
        income: "#1a9e6b",
        expense: "#c0392b",
        estimate: "#c98a1f",
      },
    },
  },
  plugins: [],
};

export default config;
