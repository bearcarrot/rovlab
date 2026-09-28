import { AlertTriangle } from "lucide-react";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-loss/30 bg-loss/5 py-14 text-center">
      <AlertTriangle className="h-8 w-8 text-loss" strokeWidth={1.5} />
      <p className="font-display text-sm font-medium text-text">โหลดข้อมูลไม่สำเร็จ</p>
      <p className="max-w-xs text-sm text-text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded-lg bg-bg-raised px-3 py-1.5 text-sm text-text hover:bg-border">
          ลองอีกครั้ง
        </button>
      )}
    </div>
  );
}
