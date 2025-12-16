import React, { useCallback, useState, useEffect } from 'react';
import { i18n } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Theme } from '@/types/Theme';
import { Loader2 } from 'lucide-react';

interface ThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme?: Theme | null; // If null, we are adding a new theme. If set, we are editing.
  onSave: (theme: Partial<Theme>) => Promise<void>;
  loading?: boolean;
}

const ThemeDialog: React.FC<ThemeDialogProps> = ({ open, onOpenChange, theme, onSave, loading = false }) => {
  const { t } = i18n;
  
  // Default empty state for new theme
  const defaultTheme: Partial<Theme> = {
      name: '',
      description: '',
      color: '#6366f1' // Default indigo
  };

  const [formData, setFormData] = useState<Partial<Theme>>(defaultTheme);
  
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    description?: string;
    color?: string;
  }>({});

  // Reset or Populate form when opening
  useEffect(() => {
      if (open) {
          if (theme) {
              setFormData({ ...theme });
          } else {
              setFormData(defaultTheme);
          }
          setValidationErrors({});
      }
  }, [open, theme]);


  const validateForm = useCallback(() => {
    const errors: typeof validationErrors = {};

    if (!formData.name?.trim()) {
      errors.name = t('themes.validation.nameRequired');
    } else if (formData.name.length > 100) {
      errors.name = t('themes.validation.nameTooLong');
    }

    if (!formData.description?.trim()) {
      errors.description = t('themes.validation.descriptionRequired');
    } else if (formData.description.length > 500) {
      errors.description = t('themes.validation.descriptionTooLong');
    }

    if (!formData.color || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(formData.color)) {
      errors.color = t('themes.validation.colorRequired');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    await onSave(formData);
    // don't close here, parent handles it on success usually, or we can close if parent returns promise
  };

  const handleChange = (field: keyof Theme, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (validationErrors[field as keyof typeof validationErrors]) {
          setValidationErrors(prev => ({ ...prev, [field]: undefined }));
      }
  };

  const isEditing = !!theme;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('themes.editTheme') : t('themes.addNewTheme')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('themes.editThemeDescription') : t('themes.addThemeDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="theme-name">
              {t('themes.newTheme')} {validationErrors.name && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="theme-name"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className={validationErrors.name ? 'border-red-500' : ''}
              placeholder={t('themes.namePlaceholder')}
              disabled={loading}
              maxLength={100}
            />
            {validationErrors.name && <p className="text-xs text-red-500">{validationErrors.name}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="theme-description">
              {t('themes.descriptionPlaceholder')} {validationErrors.description && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="theme-description"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className={validationErrors.description ? 'border-red-500' : ''}
              placeholder={t('themes.descriptionPlaceholder')}
              disabled={loading}
              maxLength={500}
            />
             {validationErrors.description && <p className="text-xs text-red-500">{validationErrors.description}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="theme-color">
              {t('themes.colorPlaceholder')} {validationErrors.color && <span className="text-red-500">*</span>}
            </Label>
            <div className="flex gap-3 items-center">
              <Input
                id="theme-color"
                type="color"
                value={formData.color || '#000000'}
                onChange={(e) => handleChange('color', e.target.value)}
                className="w-20 h-10 p-1 cursor-pointer"
                disabled={loading}
              />
              <Input 
                   value={formData.color || ''}
                   onChange={(e) => handleChange('color', e.target.value)}
                   className="font-mono uppercase flex-1"
                   maxLength={7}
                   disabled={loading}
              />
            </div>
             {validationErrors.color && <p className="text-xs text-red-500">{validationErrors.color}</p>}
          </div>

          <DialogFooter className="mt-4">
             <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="bg-story-purple hover:bg-story-purple-600">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? t('themes.saveTheme') : t('common.create')}
              </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ThemeDialog;
