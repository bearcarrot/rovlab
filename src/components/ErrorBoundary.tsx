import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

// หลัง deploy ใหม่ ไฟล์ chunk เดิม (ชื่อมี hash) หายไป แท็บเก่าที่ยังถือ index เดิมเลยโหลดหน้าแบบ lazy ไม่ได้
const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;
const RELOAD_KEY = "rovlab:chunk-reload";
const RELOAD_COOLDOWN_MS = 30_000;

// โหลดหน้าใหม่ให้เองหนึ่งครั้งเพื่อดึง index/chunk ชุดล่าสุด; ถ้าเพิ่งรีโหลดไปแล้ว (หรือ storage ใช้ไม่ได้) ไม่รีโหลดซ้ำ กันวนลูป
function reloadOnceForStaleChunk(error: Error): boolean {
  if (!CHUNK_ERROR.test(error.message)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// กันจอดำ: ถ้า component ข้างในพังตอน render จะแสดงข้อความ error แทนที่จะดับทั้งหน้า
// resetKey เปลี่ยน (เช่น เปลี่ยนหน้า) = ล้าง error และลอง render ใหม่
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    reloadOnceForStaleChunk(error);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  // ค่าที่จำไว้ใน sessionStorage (แท็บ/ตัวกรอง) อาจเป็นต้นเหตุ เลยมีปุ่มล้างให้
  private clearAndReload = () => {
    try {
      sessionStorage.clear();
    } catch {
      // storage ใช้ไม่ได้ ข้ามไป
    }
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const btn =
      "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg-raised px-4 text-sm font-medium text-text hover:border-text-faint";
    return (
      <div role="alert" className="mx-auto mt-6 max-w-md space-y-3 rounded-card border border-loss/40 bg-bg-surface p-5 text-center">
        <h2 className="font-display text-lg font-semibold">หน้านี้แสดงผลไม่สำเร็จ</h2>
        <p className="break-words text-sm text-text-muted">{error.message}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" className={btn} onClick={() => window.location.reload()}>
            โหลดหน้าใหม่
          </button>
          <button type="button" className={btn} onClick={this.clearAndReload}>
            ล้างค่าที่จำไว้แล้วโหลดใหม่
          </button>
        </div>
      </div>
    );
  }
}
