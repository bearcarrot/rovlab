import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// PSI "Render blocking requests": CSS หลัก (~9 KiB) เป็น <link rel="stylesheet"> ที่บล็อกการแสดงผลและใช้เวลาไป 1 RTT
// ตอน build จึงดึงไฟล์ CSS ที่ Vite สร้างมา inline เป็น <style> ใน index.html แทน (เหลือ 1 request น้อยลง และไม่บล็อก paint)
// ใช้เฉพาะ <link> ที่ชี้ไปไฟล์ .css ใน bundle เท่านั้น — ลิงก์ Google Fonts ไม่ถูกแตะ
function inlineEntryCss(): Plugin {
  return {
    name: "inline-entry-css",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        return html.replace(/<link rel="stylesheet"[^>]*? href="([^"]+\.css)"[^>]*>/g, (tag, href: string) => {
          const asset = bundle[href.replace(/^\//, "")];
          if (!asset || asset.type !== "asset") return tag;
          const css = typeof asset.source === "string" ? asset.source : new TextDecoder().decode(asset.source);
          return `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`;
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineEntryCss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
