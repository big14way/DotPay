/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dotpay: {
          primary: "#E6007A",
          secondary: "#6D3AEE",
          dark: "#1A1A2E",
          darker: "#0F0F1A",
          accent: "#00D4AA",
          warning: "#F5A623",
          error: "#FF4757",
          success: "#2ED573",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "dotpay-gradient": "linear-gradient(135deg, #E6007A 0%, #6D3AEE 100%)",
      },
    },
  },
  plugins: [],
};
