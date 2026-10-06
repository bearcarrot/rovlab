import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/layout/EmptyState";

export function NotFound() {
  return (
    <div className="space-y-4">
      <EmptyState icon={SearchX} title="ไม่พบหน้านี้" description="ลิงก์อาจพิมพ์ผิดหรือหน้านี้ถูกย้ายแล้ว" />
      <Link to="/" className="block text-center text-sm text-accent">กลับหน้าแรก →</Link>
    </div>
  );
}
