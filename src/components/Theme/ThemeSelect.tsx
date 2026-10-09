import { ReactNode, useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Star, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { safeThemeColor } from "@/utils/themeColors";
import { findSimilarThemes, matchesThemeSearch } from "@/utils/themeName";
import { Theme } from "@/types/Theme";
import { ThemeBadge } from "./ThemeBadge";

/** A theme linked to the edited story. */
export interface SelectedTheme {
  id: string;
  isPrimary: boolean;
}

interface ThemeOptionListProps {
  themes: Theme[];
  isSelected: (id: string) => boolean;
  onPick: (theme: Theme) => void;
  /** Creates a theme from the search text; no "Create" entry when absent */
  onCreate?: (name: string) => Promise<Theme | void>;
  /** Extra entry on top (e.g. "All themes" in a filter) */
  header?: ReactNode;
  showCounts?: boolean;
}

/**
 * Searchable theme list (accents ignored), with color, icon, story count and "Create" entry.
 * Shared by the single and the multiple pickers.
 */
const ThemeOptionList = ({ themes, isSelected, onPick, onCreate, header, showCounts = true }: ThemeOptionListProps) => {
  const { t } = i18n;
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => themes.filter(theme => matchesThemeSearch(theme.name, search)), [themes, search]);

  const trimmed = search.trim();
  const similar = trimmed ? findSimilarThemes(trimmed, themes) : [];
  const exactExists = similar.some(theme => theme.name.toLowerCase() === trimmed.toLowerCase());

  const handleCreate = async () => {
    if (!onCreate || !trimmed) return;
    setCreating(true);
    try {
      await onCreate(trimmed);
      setSearch("");
    } finally {
      setCreating(false);
    }
  };

  const renderItem = (theme: Theme) => (
    <CommandItem key={theme.id} value={theme.id} onSelect={() => onPick(theme)} className="gap-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: safeThemeColor(theme.color) }} aria-hidden="true" />
      {theme.icon && <span aria-hidden="true">{theme.icon}</span>}
      <span className="flex-1 truncate">{theme.name}</span>
      {showCounts && <span className="text-xs tabular-nums text-muted-foreground">{theme.storyCount ?? 0}</span>}
      <Check className={cn("h-4 w-4", isSelected(theme.id) ? "opacity-100" : "opacity-0")} />
    </CommandItem>
  );

  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder={t("themes.searchThemes")} value={search} onValueChange={setSearch} />
      <CommandList className="max-h-72">
        {header}
        <CommandGroup>
          {filtered.map(theme => renderItem(theme))}
        </CommandGroup>
        {filtered.length === 0 && !onCreate && <CommandEmpty>{t("themes.noResults")}</CommandEmpty>}
        {onCreate && trimmed && !exactExists && (
          <CommandGroup>
            {similar.length > 0 && (
              <p className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {t("themes.similarExists", { names: similar.map(theme => theme.name).join(", ") })}
              </p>
            )}
            <CommandItem value={`create-${trimmed}`} onSelect={handleCreate} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("themes.createNamed", { name: trimmed })}
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
};

interface ThemeSelectProps {
  themes: Theme[];
  /** Selected theme id, or null for "none / all" */
  value: string | null;
  onChange: (themeId: string | null) => void;
  placeholder: string;
  /** Label of the entry that clears the selection (filters: "All themes") */
  clearLabel?: string;
  onCreate?: (name: string) => Promise<Theme | void>;
  showCounts?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Single theme picker (library filter, PDF filter, replacement theme).
 */
export const ThemeSelect = ({ themes, value, onChange, placeholder, clearLabel, onCreate, showCounts, disabled, id, className }: ThemeSelectProps) => {
  const [open, setOpen] = useState(false);
  const selected = themes.find(theme => theme.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}>
          {selected ? <ThemeBadge theme={selected} /> : <span className="truncate text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <ThemeOptionList
          themes={themes}
          isSelected={themeId => themeId === value}
          onPick={theme => { onChange(theme.id === value ? null : theme.id); setOpen(false); }}
          onCreate={onCreate && (async (name) => {
            const created = await onCreate(name);
            if (created) onChange(created.id);
            setOpen(false);
            return created;
          })}
          showCounts={showCounts}
          header={clearLabel ? (
            <CommandGroup>
              <CommandItem value="__clear" onSelect={() => { onChange(null); setOpen(false); }}>
                <span className="flex-1">{clearLabel}</span>
                <Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
              </CommandItem>
            </CommandGroup>
          ) : undefined}
        />
      </PopoverContent>
    </Popover>
  );
};

interface ThemeMultiSelectProps {
  themes: Theme[];
  value: SelectedTheme[];
  onChange: (value: SelectedTheme[]) => void;
  onCreate?: (name: string) => Promise<Theme | void>;
  disabled?: boolean;
  id?: string;
}

/** Adds or removes a theme, keeping exactly one primary theme. */
export const toggleSelectedTheme = (value: SelectedTheme[], themeId: string): SelectedTheme[] => {
  const exists = value.some(theme => theme.id === themeId);
  const next = exists ? value.filter(theme => theme.id !== themeId) : [...value, { id: themeId, isPrimary: false }];
  return withOnePrimary(next);
};

/** Marks `themeId` as the only primary theme. */
export const setPrimaryTheme = (value: SelectedTheme[], themeId: string): SelectedTheme[] =>
  value.map(theme => ({ ...theme, isPrimary: theme.id === themeId }));

/** First theme becomes primary when none is. */
export const withOnePrimary = (value: SelectedTheme[]): SelectedTheme[] => {
  if (value.length === 0 || value.some(theme => theme.isPrimary)) return value;
  return value.map((theme, index) => ({ ...theme, isPrimary: index === 0 }));
};

/**
 * Story themes editor: chips (star = primary theme, × = remove) and a searchable picker with creation.
 */
export const ThemeMultiSelect = ({ themes, value, onChange, onCreate, disabled, id }: ThemeMultiSelectProps) => {
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const selected = value
    .map(item => ({ ...item, theme: themes.find(theme => theme.id === item.id) }))
    .filter((item): item is SelectedTheme & { theme: Theme } => Boolean(item.theme));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("story.themes")}>
          {selected.map(({ theme, isPrimary }) => (
            <li key={theme.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onChange(setPrimaryTheme(value, theme.id))}
                disabled={disabled}
                className={cn("rounded-full p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isPrimary ? "text-amber-500" : "text-muted-foreground")}
                aria-pressed={isPrimary}
                title={isPrimary ? t("themes.primary") : t("themes.makePrimary")}
                aria-label={isPrimary ? t("themes.primary") : t("themes.makePrimary")}
              >
                <Star className={cn("h-3.5 w-3.5", isPrimary && "fill-current")} />
              </button>
              <ThemeBadge theme={theme} onRemove={disabled ? undefined : () => onChange(toggleSelectedTheme(value, theme.id))} />
            </li>
          ))}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" size="sm" disabled={disabled} className="w-full justify-start font-normal text-muted-foreground">
            <Plus className="mr-2 h-4 w-4" />
            {t("themes.addToStory")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
          <ThemeOptionList
            themes={themes}
            isSelected={themeId => value.some(theme => theme.id === themeId)}
            onPick={theme => onChange(toggleSelectedTheme(value, theme.id))}
            onCreate={onCreate && (async (name) => {
              const created = await onCreate(name);
              if (created && !value.some(theme => theme.id === created.id)) onChange(toggleSelectedTheme(value, created.id));
              return created;
            })}
          />
        </PopoverContent>
      </Popover>
      {selected.length > 1 && <p className="text-xs text-muted-foreground">{t("themes.primaryHint")}</p>}
    </div>
  );
};
