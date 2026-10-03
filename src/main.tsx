import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

// ErrorBoundary ชั้นนอกสุด: กันจอดำเมื่อเกิด error นอก layout (เช่น ใน AuthProvider)
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
