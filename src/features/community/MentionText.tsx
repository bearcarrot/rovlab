import { Link } from "react-router-dom";

const SPLIT = /(@[A-Za-z0-9_]{3,20})/g;
const IS_MENTION = /^@[A-Za-z0-9_]{3,20}$/;

// Renders comment text with @handle turned into profile links. Plain text only (no HTML injection).
export function MentionText({ text }: { text: string }) {
  return (
    <>
      {text.split(SPLIT).map((part, i) =>
        IS_MENTION.test(part) ? (
          <Link key={i} to={`/u/${part.slice(1)}`} className="text-accent hover:underline">
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
