import React, { useState, useCallback } from 'react';
import { i18n } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';

interface AddThemeSectionProps {
  onThemeAdded?: () => void;
}

const AddThemeSection: React.FC<AddThemeSectionProps> = React.memo(({ onThemeAdded }) => {
  const { t } = i18n;
  const { toast } = useToast();
  const { loading, newTheme, setNewTheme, addTheme, error } = useThemeContext();
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    description?: string;
    color?: string;
  }>({});
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const validateForm = useCallback(() => {
    const errors: typeof validationErrors = {};

    if (!newTheme.name.trim()) {
      errors.name = t('themes.validation.nameRequired');
    } else if (newTheme.name.length > 100) {
      errors.name = t('themes.validation.nameTooLong');
    }

    if (!newTheme.description.trim()) {
      errors.description = t('themes.validation.descriptionRequired');
    } else if (newTheme.description.length > 500) {
      errors.description = t('themes.validation.descriptionTooLong');
    }

    if (!newTheme.color || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newTheme.color)) {
      errors.color = t('themes.validation.colorRequired');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [newTheme, t]);

  const handleAddTheme = useCallback(async () => {
    if (!validateForm()) return;

    try {
      await addTheme(newTheme);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      toast({
        title: t('common.success'),
        description: t('themes.themeAddedSuccess'),
      });
      onThemeAdded?.();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : 'Failed to add theme',
        variant: 'destructive',
      });
    }
  }, [validateForm, addTheme, newTheme, toast, t, onThemeAdded]);

  const handleInputChange = useCallback(
    (field: 'name' | 'description' | 'color', value: string) => {
      setNewTheme({ ...newTheme, [field]: value });
      // Clear validation error for this field
      if (validationErrors[field]) {
        setValidationErrors({ ...validationErrors, [field]: undefined });
      }
    },
    [newTheme, validationErrors]
  );

  const isFormValid =
    newTheme.name.trim() &&
    newTheme.description.trim() &&
    /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newTheme.color) &&
    newTheme.name.length <= 100 &&
    newTheme.description.length <= 500;

  return (
    <Card className="w-full border-2 border-story-purple/30 dark:border-purple-600/30 bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-story-purple dark:text-purple-300">
          <div className="p-2 rounded-lg bg-story-purple/10 dark:bg-purple-900/30">
            <Plus className="w-5 h-5" />
          </div>
          {t('themes.addNewTheme')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {showSuccessMessage && (
          <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-pulse">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {t('themes.themeAddedSuccess')}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="newThemeName" className="text-gray-700 dark:text-gray-300 font-semibold">
              {t('themes.newTheme')} {validationErrors.name && <span className="text-red-500">*</span>}
            </Label>
            <span className={`text-xs ${newTheme.name.length > 90 ? 'text-red-500' : 'text-gray-500'}`}>
              {newTheme.name.length}/100
            </span>
          </div>
          <Input
            id="newThemeName"
            type="text"
            placeholder={t('themes.newThemePlaceholder')}
            value={newTheme.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 transition-all ${
              validationErrors.name ? 'border-red-500 ring-1 ring-red-500' : ''
            } ${newTheme.name.trim() ? 'border-green-300 dark:border-green-700' : ''}`}
            disabled={loading}
            maxLength={100}
          />
          {validationErrors.name && <p className="text-xs text-red-500 font-medium">{validationErrors.name}</p>}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="newThemeDescription" className="text-gray-700 dark:text-gray-300 font-semibold">
              {t('themes.descriptionPlaceholder')} {validationErrors.description && <span className="text-red-500">*</span>}
            </Label>
            <span className={`text-xs ${newTheme.description.length > 450 ? 'text-red-500' : 'text-gray-500'}`}>
              {newTheme.description.length}/500
            </span>
          </div>
          <Textarea
            id="newThemeDescription"
            placeholder={t('themes.descriptionPlaceholder')}
            value={newTheme.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className={`bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 min-h-[100px] transition-all ${
              validationErrors.description ? 'border-red-500 ring-1 ring-red-500' : ''
            } ${newTheme.description.trim() ? 'border-green-300 dark:border-green-700' : ''}`}
            disabled={loading}
            maxLength={500}
          />
          {validationErrors.description && (
            <p className="text-xs text-red-500 font-medium">{validationErrors.description}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="newThemeColor" className="text-gray-700 dark:text-gray-300 font-semibold">
            {t('themes.colorPlaceholder')} {validationErrors.color && <span className="text-red-500">*</span>}
          </Label>
          <div className="flex gap-3 items-start">
            <div className="relative">
              <Input
                id="newThemeColor"
                type="color"
                value={newTheme.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                className="w-16 h-12 p-1 cursor-pointer rounded-lg border-2 border-gray-300 dark:border-gray-600"
                disabled={loading}
              />
              <div className="absolute inset-0 rounded-lg pointer-events-none border-2 border-green-300 opacity-0" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 h-12 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600">
                <code className="text-sm font-mono text-gray-700 dark:text-gray-300">{newTheme.color}</code>
              </div>
            </div>
          </div>
          {validationErrors.color && <p className="text-xs text-red-500 font-medium">{validationErrors.color}</p>}
        </div>

        <Button
          onClick={handleAddTheme}
          className={`w-full font-semibold transition-all ${
            isFormValid
              ? 'bg-story-purple hover:bg-story-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700 text-white'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
          }`}
          disabled={loading || !isFormValid}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.adding')}
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              {t('themes.addTheme')}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
});

AddThemeSection.displayName = 'AddThemeSection';

export default AddThemeSection;
