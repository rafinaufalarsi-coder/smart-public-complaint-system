import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        spcs: {
          primary: "#00417b",
          "primary-container": "#0d59a1",
          "secondary-container": "#feae2c",
          "tertiary-container": "#b1121b",
          background: "#f9f9ff",
          surface: "#ffffff",
          "surface-low": "#f0f3ff",
          outline: "#727782",
          "outline-variant": "#c2c6d2",
          text: "#111c2c",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

