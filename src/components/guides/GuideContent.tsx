import type { ReactNode } from "react";

// แสดงเนื้อหาคู่มือ (markdown แบบย่อ) โดยไม่ใช้ dangerouslySetInnerHTML และไม่พึ่ง library
// รองรับ:
//   # หัวข้อใหญ่ · ## หัวข้อรอง · ### หัวข้อย่อย
//   - หรือ * รายการ · 1. รายการเลข · > อ้างอิง
//   **ตัวหนา** · *ตัวเอียง* · `โค้ด`
//   [ข้อความ](https://...) และ URL เปล่า ๆ (https://...) กดได้ เปิดแท็บใหม่
// ลิงก์รับเฉพาะ http/https เท่านั้น (กัน javascript: ฯลฯ)

type ListBlock = { t: "list"; ordered: boolean; items: string[] };
type Block =
  | { t: "h"; level: 2 | 3 | 4; text: string }
  | { t: "p"; text: string }
  | { t: "quote"; text: string }
  | ListBlock;

// ลำดับสำคัญ: ตัวหนา → ตัวเอียง → โค้ด → ลิงก์ [ข้อความ](url) → URL เปล่า (ASCII เท่านั้น จะไม่กินตัวอักษรไทยที่ติดท้าย)
const INLINE_SRC =
  "(\\*\\*[^*\\n]+\\*\\*|\\*[^*\\s][^*\\n]*\\*|`[^`\\n]+`|\\[[^\\]\\n]+\\]\\(https?:\\/\\/[^\\s)]+\\)|https?:\\/\\/[A-Za-z0-9\\-._~:/?#[\\]@!$&'()*+,;=%]+)";

const LINK_CLS = "text-accent underline underline-offset-2 hover:brightness-110 [overflow-wrap:anywhere]";

const HEADING_CLS: Record<2 | 3 | 4, string> = {
  2: "pt-2 font-display text-lg font-semibold leading-snug text-text",
  3: "pt-1 font-display text-base font-semibold leading-snug text-text",
  4: "font-display text-sm font-semibold text-text",
};

function parseBlocks(src: string): Block[] {
  const out: Block[] = [];
  const st: { para: string[]; quote: string[]; list: ListBlock | null } = { para: [], quote: [], list: null };
  const flush = () => {
    if (st.para.length > 0) out.push({ t: "p", text: st.para.join("\n") });
    if (st.quote.length > 0) out.push({ t: "quote", text: st.quote.join("\n") });
    if (st.list) out.push(st.list);
    st.para = [];
    st.quote = [];
    st.list = null;
  };

  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      flush();
      out.push({ t: "h", level: (h[1].length + 1) as 2 | 3 | 4, text: h[2].trim() });
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      if (st.quote.length === 0) flush();
      st.quote.push(q[1]);
      continue;
    }
    const ul = /^[-*•]\s+(.+)$/.exec(line);
    const ol = /^\d+[.)]\s+(.+)$/.exec(line);
    if (ul || ol) {
      const ordered = !!ol;
      if (!st.list || st.list.ordered !== ordered) {
        flush();
        st.list = { t: "list", ordered, items: [] };
      }
      st.list.items.push((ul ?? ol)![1]);
      continue;
    }
    if (st.list || st.quote.length > 0) flush();
    st.para.push(line);
  }
  flush();
  return out;
}

function renderInline(text: string): ReactNode[] {
  const re = new RegExp(INLINE_SRC, "g");
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let tok = m[0];
    const start = m.index;
    // URL เปล่า: ตัดเครื่องหมายท้ายประโยคออก (เช่น "ดูที่ https://x.com/a.") ส่วนที่ตัดจะกลับไปเป็นข้อความธรรมดา
    if (tok.startsWith("http")) tok = tok.replace(/[.,;:!?'")\]]+$/, "");
    if (start > last) nodes.push(text.slice(last, start));
    const k = key++;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={k} className="font-semibold text-text">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={k}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={k} className="rounded bg-bg-raised px-1 py-0.5 text-[0.85em] text-text">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("[")) {
      const lm = /^\[([^\]]+)\]\((.+)\)$/.exec(tok);
      if (lm) {
        nodes.push(
          <a key={k} href={lm[2]} target="_blank" rel="noopener noreferrer" className={LINK_CLS}>
            {lm[1]}
          </a>
        );
      } else {
        nodes.push(tok);
      }
    } else {
      nodes.push(
        <a key={k} href={tok} target="_blank" rel="noopener noreferrer" className={LINK_CLS}>
          {tok}
        </a>
      );
    }
    last = start + tok.length;
    re.lastIndex = last;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function GuideContent({ blocks }: { blocks: string[] }) {
  const parsed = parseBlocks(blocks.join("\n\n"));
  return (
    <div className="space-y-3 text-sm leading-relaxed text-text-muted">
      {parsed.map((b, i) => {
        if (b.t === "h") {
          const Tag = `h${b.level}` as "h2" | "h3" | "h4";
          return (
            <Tag key={i} className={HEADING_CLS[b.level]}>
              {renderInline(b.text)}
            </Tag>
          );
        }
        if (b.t === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={`space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"}`}>
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </Tag>
          );
        }
        if (b.t === "quote") {
          return (
            <blockquote key={i} className="whitespace-pre-line border-l-2 border-border pl-3">
              {renderInline(b.text)}
            </blockquote>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}
