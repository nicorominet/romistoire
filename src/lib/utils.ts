import { twMerge } from 'tailwind-merge';
import clsx, { ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getAgeGroupColor(ageGroup: string): string {
  switch (ageGroup) {
    case "2-3":
      return "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800";
    case "4-6":
      return "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800";
    case "7-9":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 dark:hover:bg-yellow-800";
    case "10-12":
      return "bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-100 dark:hover:bg-pink-800";
    case "13-15":
      return "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100 dark:hover:bg-purple-800";
    case "16-18":
      return "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-100 dark:hover:bg-orange-800";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700";
  }
}

function stripHtmlTags(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  let text = tmp.textContent || tmp.innerText || "";
  return text.trim(); // Trim leading/trailing spaces
}



function formatDate(dateString: string | Date, locale: string = 'fr'): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

const HTML_ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'" };

/**
 * Plain text of stored story content, for previews: editor HTML (generated stories are saved as
 * <p>…</p>), markdown bold and [Illustration: …] tags removed, entities decoded, spaces collapsed.
 * Parsed with regular expressions, never through the DOM (no markup is ever interpreted).
 */
function storyPlainText(content: string | null | undefined): string {
  return (content || "")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, entity => HTML_ENTITIES[entity] ?? entity)
    .replace(/\[\s*(?:Illustration|Description)[^\]]*\]/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Short plain-text preview of a story, for cards. */
function storyPreview(content: string | null | undefined, maxLength: number): string {
  return truncateText(storyPlainText(content), maxLength);
}

export { cn, getAgeGroupColor, stripHtmlTags, formatDate, truncateText, storyPlainText, storyPreview };