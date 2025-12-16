import { useState, useEffect } from 'react';
import { i18n } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { themeApi } from '@/api/themes.api';

import { Theme } from '@/types/Theme';

// Removed local Theme interface

interface ThemePickerProps {
  value: string;
  onChange: (themeId: string) => void;
  availableThemes: Theme[];
  setAvailableThemes: (themes: Theme[]) => void;
}

const ThemePicker: React.FC<ThemePickerProps> = ({ value, onChange, availableThemes, setAvailableThemes }) => {
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [customTheme, setCustomTheme] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Removed duplicate fetchThemes. Data is provided via availableThemes prop.
  useEffect(() => {
    setThemes(availableThemes.sort((a, b) => a.name.localeCompare(b.name)));

    if (value === '' && !isCreating) {
      setCustomTheme('');
      setIsCreating(true);
    }
  }, [value, availableThemes, isCreating]);

  const handleSelectTheme = (theme: Theme) => {
    onChange(theme.id);
    setOpen(false);
    setIsCreating(false);
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
    setIsCreating(e.target.value === '');
  };

  const handleCustomThemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomTheme(e.target.value);
  };

  const handleCreateTheme = () => {
    if (customTheme.trim() !== '') {
      const newTheme = customTheme.trim();
      // You would also want to make a POST request to your API to create the new theme.
      // In real application, theme is not created from the picker
      // availableThemes([...availableThemes, newTheme]);
      // setAvailableThemes([...availableThemes, newTheme]);

      setCustomTheme('');
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="theme">{t('story.theme')}</Label>
      <div className="flex space-x-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="justify-between w-full bg-white"
            >
              {themes.find(t => t.id === value)?.name || t('create.selectTheme')}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-full" align="start">
            <Command>
              <CommandInput placeholder={t('create.selectTheme')} />
              <CommandList>
                <CommandEmpty>
                  <div className="p-2 text-sm">
                    {t('create.selectTheme')} {value}
                  </div>
                </CommandEmpty>
                <CommandGroup>
                {themes.map((theme) => (
                    <CommandItem
                      key={theme.id}
                      onSelect={() => handleSelectTheme(theme)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === theme.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {theme.name}
                    </CommandItem>
                  ))}
                  <CommandItem onSelect={() => setIsCreating(true)}>
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    {isCreating ? t('create.theme.creating') : t('create.theme.new')}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {isCreating && (
          <Button
            variant="outline"
            onClick={() => {
              setIsCreating(false);
              onChange('');
            }}
            className="shrink-0 bg-white"
          >
            {t('common.reset')}
          </Button>
        )}
      </div>

      {isCreating && (
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder={t('create.theme.enterNew')}
            value={customTheme}
            onChange={handleCustomThemeChange}
            className="bg-white"
          />
          <Button onClick={handleCreateTheme} disabled={customTheme.trim() === ''}>
            {t('common.create')}
          </Button>
        </div>
      )}
  </div>
  );
};

interface MultiThemePickerProps {
  themes: Theme[];
  selected: string[];
  setSelected: (ids: string[]) => void;
}

export const MultiThemePicker: React.FC<MultiThemePickerProps> = ({ themes, selected, setSelected }) => {
  const { t } = i18n;
  const toggleTheme = (id: string) => {
    setSelected(selected.includes(id) ? selected.filter((tid) => tid !== id) : [...selected, id]);
  };
  return (
    <div className="space-y-2">
      <div className="font-semibold">{t('story.themes')}</div>
      <div className="flex flex-wrap gap-2">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`px-3 py-1 rounded border ${selected.includes(theme.id) ? 'bg-story-purple-500 text-white' : 'bg-gray-100'}`}
            onClick={() => toggleTheme(theme.id)}
          >
            {theme.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ThemePicker;