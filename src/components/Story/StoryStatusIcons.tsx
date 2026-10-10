import { Eye, Headphones, ImageIcon } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Story } from "@/types/Story";

interface StoryStatusIconsProps {
  story: Pick<Story, "audio_path" | "review_status" | "illustrations">;
  /** Also show "illustrated" (useless on a card, where the picture shows it) */
  withImage?: boolean;
  /** "overlay": on top of a picture; "inline": in a row of text */
  variant?: "overlay" | "inline";
}

const VARIANT_CLASS = {
  overlay: "bg-white/90 shadow-sm backdrop-blur-sm dark:bg-slate-900/85",
  inline: "bg-slate-100 dark:bg-slate-800",
};

/**
 * StoryStatusIcons Component
 *
 * What a story already has or still needs: audio, illustration, review. Nothing when there is nothing to say.
 */
const StoryStatusIcons = ({ story, withImage = false, variant = "inline" }: StoryStatusIconsProps) => {
  const { t } = i18n;
  const icons = [
    story.audio_path && { key: "audio", icon: Headphones, label: t("story.hasAudio"), tone: "text-blue-600 dark:text-blue-400" },
    withImage && story.illustrations?.length > 0 && { key: "image", icon: ImageIcon, label: t("stories.withImage"), tone: "text-fuchsia-600 dark:text-fuchsia-400" },
    story.review_status === "to_review" && { key: "review", icon: Eye, label: t("review.toReview"), tone: "text-amber-600 dark:text-amber-400" },
  ].filter(Boolean) as { key: string; icon: typeof Eye; label: string; tone: string }[];

  if (icons.length === 0) return null;
  return (
    <span className="flex gap-1">
      {icons.map(({ key, icon: Icon, label, tone }) => (
        <span key={key} role="img" aria-label={label} title={label} className={`flex h-7 w-7 items-center justify-center rounded-full ${VARIANT_CLASS[variant]} ${tone}`}>
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      ))}
    </span>
  );
};

export default StoryStatusIcons;
