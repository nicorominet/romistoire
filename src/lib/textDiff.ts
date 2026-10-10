import { storyPlainText } from "./utils";

export type DiffPart = { type: "same" | "added" | "removed"; text: string };

/** Paragraph break inside the token lists (kept so the diff shows the paragraphs). */
export const PARAGRAPH = "\n";

/** Paragraphs of stored story content (editor HTML or plain text), as text: no markup is interpreted. */
export const storyParagraphs = (content: string | null | undefined) =>
  (content || "").split(/<\/(?:p|div|h[1-6]|li|blockquote)>|<br\s*\/?>|\n/i).map(storyPlainText).filter(Boolean);

/** Words of a story, with a PARAGRAPH token between paragraphs. */
export const storyTokens = (content: string | null | undefined) =>
  storyParagraphs(content).flatMap((paragraph, index) => [...(index > 0 ? [PARAGRAPH] : []), ...paragraph.split(" ").filter(Boolean)]);

const push = (parts: DiffPart[], type: DiffPart["type"], token: string) => {
  const last = parts[parts.length - 1];
  if (last?.type === type) last.text += token === PARAGRAPH || last.text.endsWith(PARAGRAPH) ? token : ` ${token}`;
  else parts.push({ type, text: token });
};

/**
 * Word diff from `before` to `after` (longest common subsequence): "removed" is only in `before`,
 * "added" only in `after`. Common start and end are skipped before the table, so small edits of a
 * long story stay cheap.
 */
export const diffWords = (before: string[], after: string[]): DiffPart[] => {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) { endBefore--; endAfter--; }

  const a = before.slice(start, endBefore);
  const b = after.slice(start, endAfter);
  const cols = b.length + 1;
  // lengths[i][j] = LCS of a[i..] and b[j..]
  const lengths = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * cols + j] = a[i] === b[j]
        ? lengths[(i + 1) * cols + j + 1] + 1
        : Math.max(lengths[(i + 1) * cols + j], lengths[i * cols + j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  before.slice(0, start).forEach((token) => push(parts, "same", token));
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push(parts, "same", a[i]); i++; j++; }
    else if (lengths[(i + 1) * cols + j] >= lengths[i * cols + j + 1]) { push(parts, "removed", a[i]); i++; }
    else { push(parts, "added", b[j]); j++; }
  }
  for (; i < a.length; i++) push(parts, "removed", a[i]);
  for (; j < b.length; j++) push(parts, "added", b[j]);
  before.slice(endBefore).forEach((token) => push(parts, "same", token));
  return parts;
};

/** Words added and removed by a diff (paragraph breaks not counted). */
export const diffStats = (parts: DiffPart[]) => {
  const count = (type: DiffPart["type"]) =>
    parts.filter((part) => part.type === type).reduce((total, part) => total + part.text.split(/\s+/).filter(Boolean).length, 0);
  return { added: count("added"), removed: count("removed") };
};
