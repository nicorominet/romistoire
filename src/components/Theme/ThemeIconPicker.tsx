import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";

/** Suggestions covering the usual themes of educational stories. */
export const THEME_ICON_SUGGESTIONS = [
  "🌿", "🌳", "🌸", "🍂", "❄️", "☀️", "🌧️", "🌊", "🐾", "🦋", "🐦", "🐟",
  "🚀", "🌙", "⭐", "🔬", "🧪", "🦕", "🏰", "🎨", "🎵", "📚", "🤝", "❤️",
] as const;

interface ThemeIconPickerProps {
  value: string | null | undefined;
  onChange: (icon: string | null) => void;
  id?: string;
}

/** Emoji suggestions plus free input (any emoji). */
export const ThemeIconPicker = ({ value, onChange, id }: ThemeIconPickerProps) => {
  const { t } = i18n;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("themes.icon")}>
        {THEME_ICON_SUGGESTIONS.map(icon => (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={value === icon}
            onClick={() => onChange(value === icon ? null : icon)}
            className={cn("flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === icon && "bg-muted ring-2 ring-primary")}
          >
            {icon}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() ? [...e.target.value.trim()].slice(0, 4).join("") : null)}
          placeholder={t("themes.iconPlaceholder")}
          className="w-28 text-center text-lg"
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-sm text-muted-foreground hover:underline">
            <X className="mr-1 inline h-3 w-3" />{t("themes.noIcon")}
          </button>
        )}
      </div>
    </div>
  );
};
