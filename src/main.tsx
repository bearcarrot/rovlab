import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "@/features/auth/AuthContext";
import { NotificationsProvider } from "@/features/notifications/NotificationsContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/ui/toast";
import "./index.css";
import { prefetchFirstPageData } from "@/lib/prefetch";

// kick off the first Supabase requests before React renders (see lib/prefetch.ts)
prefetchFirstPageData();

// ErrorBoundary ชั้นนอกสุด: กันจอดำเมื่อเกิด error นอก layout (เช่น ใน AuthProvider)
// ToastProvider อยู่เหนือ AuthProvider/App เพื่อให้ toast ไม่หายตอนหน้าถูก remount (AppShell ใช้ key={rank})
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <NotificationsProvider>
              <App />
            </NotificationsProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
