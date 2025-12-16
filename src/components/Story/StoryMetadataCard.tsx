import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Image, ListOrdered, Hash, Calendar, Globe, Clock, Book } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Story, Theme } from "@/types/Story";

interface StoryMetadataCardProps {
  story: Story;
  themes?: Theme[];
  editable?: boolean;
  onChange?: (field: string, value: any) => void;
}

const ageGroups = ["2-3", "4-6", "7-9", "10-12", "13-15", "16-18"];

const StoryMetadataCard: React.FC<StoryMetadataCardProps> = ({
  story,
  themes = [],
  editable = false,
  onChange,
}) => {
  const { t } = i18n;

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-gray-100">
          {t("story.metadata")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Series (New) */}
        {story.series_name && (
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-300">
                {t("story.series")}
              </h3>
              <p className="font-semibold text-story-purple-600 dark:text-story-purple-400">
                {story.series_name}
              </p>
            </div>
          </div>
        )}

        {/* Thèmes */}
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4" />
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {t("story.theme")}
            </h3>
            {editable ? (
              <div className="flex flex-wrap gap-1">
                {themes.map((theme) => {
                  const selected = story.themes.some((t) => t.id === theme.id);
                  return (
                    <Badge
                      key={theme.id}
                      style={{ backgroundColor: theme.color, opacity: selected ? 1 : 0.4, cursor: 'pointer' }}
                      onClick={() => {
                        let newThemes;
                        if (selected) {
                          newThemes = story.themes.filter((t) => t.id !== theme.id);
                        } else {
                          newThemes = [...story.themes, theme];
                        }
                        onChange && onChange("themes", newThemes);
                      }}
                    >
                      {theme.name}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {story.themes.map((theme) => (
                  <Badge key={theme.id} style={{ backgroundColor: theme.color }}>{theme.name}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Groupe d'âge */}
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4" />
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {t("story.ageGroup")}
            </h3>
            {editable ? (
              <Select
                value={story.age_group}
                onValueChange={(val) => onChange && onChange("age_group", val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("story.ageGroupPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {ageGroups.map((ag) => (
                    <SelectItem key={ag} value={ag}>{t(`ages.${ag}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p>{t(`ages.${story.age_group}`)}</p>
            )}
          </div>
        </div>
        {/* Version */}
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4" />
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {t("story.version")}
            </h3>
            <p>v{story.version ?? '-'}</p>
          </div>
        </div>
        {/* Semaine */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {t("story.week")}
            </h3>
            {editable ? (
              <Input
                type="number"
                value={story.week_number ?? ''}
                onChange={(e) => onChange && onChange("week_number", Number(e.target.value))}
                className="w-20"
              />
            ) : (
              <p>{t("story.weekNumber", { number: story.week_number ?? '-' })}</p>
            )}
          </div>
        </div>
        {/* Jour */}
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4" />
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {t("story.day")}
            </h3>
            {editable ? (
              <Input
                type="number"
                value={story.day_order ?? ''}
                onChange={(e) => onChange && onChange("day_order", Number(e.target.value))}
                className="w-20"
              />
            ) : (
              <p>{t("story.dayOrder", { number: story.day_order ?? '-' })}</p>
            )}
          </div>
        </div>
        {/* Langue */}
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {t("story.language")}
            </h3>
            {editable ? (
              <Input
                value={story.locale ?? ''}
                onChange={(e) => onChange && onChange("locale", e.target.value)}
                className="w-24"
              />
            ) : (
              <p>{story.locale ?? '-'}</p>
            )}
          </div>
        </div>
        {/* Dates */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {t("story.lastModified")}
            </h3>
            <p>{story.modified_at ? new Date(story.modified_at).toLocaleString() : '-'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {t("story.creationDate")}
            </h3>
            <p>{story.created_at ? new Date(story.created_at).toLocaleString() : '-'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StoryMetadataCard;
