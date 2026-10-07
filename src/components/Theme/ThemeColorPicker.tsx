import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { THEME_PALETTE, readableTextColor, safeThemeColor } from "@/utils/themeColors";

interface ThemeColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  id?: string;
}

/** Palette of readable colors, plus a custom color. */
export const ThemeColorPicker = ({ value, onChange, id }: ThemeColorPickerProps) => {
  const { t } = i18n;
  const current = safeThemeColor(value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("themes.color")}>
        {THEME_PALETTE.map(color => {
          const selected = current === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              onClick={() => onChange(color)}
              className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-foreground" : "border-transparent")}
              style={{ backgroundColor: color }}
            >
              {selected && <Check className="h-4 w-4" style={{ color: readableTextColor(color) }} />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
          aria-label={t("themes.customColor")}
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="w-28 font-mono"
          aria-label={t("themes.colorCode")}
        />
      </div>
    </div>
  );
};

export default ThemeColorPicker;
