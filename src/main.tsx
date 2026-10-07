import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "@/features/auth/AuthContext";
import { NotificationsProvider } from "@/features/notifications/NotificationsContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm";
import "./index.css";

// ErrorBoundary ชั้นนอกสุด: กันจอดำเมื่อเกิด error นอก layout (เช่น ใน AuthProvider)
// ToastProvider อยู่เหนือ AuthProvider/App เพื่อให้ toast ไม่หายตอนหน้าถูก remount (AppShell ใช้ key={rank})
// ConfirmProvider อยู่ตรงนี้ด้วยเหตุผลเดียวกัน: กล่องยืนยันไม่หายตอนหน้า remount
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <NotificationsProvider>
                <App />
              </NotificationsProvider>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
