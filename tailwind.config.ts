import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0A0B0E",
          surface: "#14161B",
          raised: "#1C1F26",
        },
        border: {
          DEFAULT: "#262A33",
        },
        text: {
          DEFAULT: "#F2F3F5",
          muted: "#8B909B",
          faint: "#5C616D",
        },
        accent: {
          DEFAULT: "#E8A33D", // ember gold — rank/tier accent
          fg: "#0A0B0E",
        },
        rift: {
          DEFAULT: "#4C8DFF", // cool blue — utility/CC data
        },
        win: "#3DD68C",
        loss: "#E5484D",
        // สีป้าย Tier: S+ แดง (เด่น/อันตรายสุด) → S ส้ม → A เหลือง → B เขียว → C ฟ้า
        tier: {
          sp: "#EF4444",
          s: "#F97316",
          a: "#EAB308",
          b: "#22C55E",
          c: "#3B82F6",
        },
      },
      fontFamily: {
        display: ["Kanit", "IBM Plex Sans Thai", "sans-serif"],
        body: ["IBM Plex Sans Thai", "Inter", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
