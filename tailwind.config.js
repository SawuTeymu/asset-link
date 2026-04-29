import { Config } from "tailwindcss";

const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#006194",
        "primary-fixed-dim": "#cce5ff",
        "secondary-fixed": "#cce8e0",
        error: "#ba1a1a",
        // 您可以隨時在此處擴充全站共用的顏色
      },
    },
  },
  // 🚀 啟用 forms 與 container-queries 插件 (對應原本 CDN 上的 ?plugins=forms)
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
};
export default config;