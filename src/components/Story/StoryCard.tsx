import { Link } from "react-router-dom";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { i18n } from "@/lib/i18n";
import { Story } from "@/types/Story";
import { BookOpen, Clock, Calendar, ListOrdered, FileText } from "lucide-react";
import { getAgeGroupColor, formatDate, truncateText } from "@/lib/utils";
import SafeImage from "@/components/ui/SafeImage";

interface ThemeColorsMap {
  [themeId: string]: string;
}

interface StoryCardProps {
  story: Story;
  themeColors?: ThemeColorsMap;
}


const StoryCard = ({ story, themeColors = {} }: StoryCardProps) => {
  const { t } = i18n;

  // Format date utilitaire
  // The original formatDate function is removed as per the instruction.
  // The new useMemo block is added.
  // Assuming 'dateString' refers to story.modified_at for this specific memoization.
  const formattedModifiedDate = useMemo(() => {
    return formatDate(story.modified_at, i18n.getCurrentLocale());
  }, [story.modified_at, i18n]);

  const formattedCreatedDate = useMemo(() => {
    return formatDate(story.created_at, i18n.getCurrentLocale());
  }, [story.created_at, i18n]);


  // Raccourci pour l'aperçu du contenu
  const contentPreview = truncateText(story.content, 100);

  // Illustration principale
  const imageUrl = story.illustrations?.[0]?.image_path
    ? `/${story.illustrations[0].image_path}`
    : "";

  // Jour de la semaine (localisé)
  const getDayOfWeek = (dayOrder: number): string => {
    const days = [
      t("days.monday"),
      t("days.tuesday"),
      t("days.wednesday"),
      t("days.thursday"),
      t("days.friday"),
      t("days.saturday"),
      t("days.sunday"),
    ];
    return days[dayOrder - 1] || days[0];
  };

  // Gestion de la couleur du badge thème
  const getThemeBadgeStyle = (themeId: string, fallback?: string) => {
    const color = themeColors[themeId] || fallback || "#ccc";
    return {
      backgroundColor: color,
      color: "#fff",
      border: "none",
    };
  };

  return (
    <Link to={`/stories/${story.id}`}>
      <Card className="story-card hover-scale h-full transition-all duration-300 bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-white/10 hover:bg-white/90 dark:hover:bg-slate-800/80 hover:shadow-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-story-purple-800 dark:text-story-purple-200">
            {story.title}
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            {/* Badges multi-thèmes colorés */}
            {Array.isArray(story.themes) &&
              story.themes.map(
                (themeObj: {
                  id: string;
                  name?: string;
                  color?: string;
                }) => (
                  <Badge
                    key={themeObj.id}
                    variant="outline"
                    style={getThemeBadgeStyle(themeObj.id, themeObj.color)}
                  >
                    {themeObj.name || themeObj.id}
                  </Badge>
                )
              )}
            <Badge className={getAgeGroupColor(story.age_group)}>
              {t(`ages.${story.age_group}`)}
            </Badge>
            {story.series_name && (
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-800">
                {story.series_name}
              </Badge>
            )}
          </div>
        </CardHeader>
        {imageUrl && (
          <SafeImage
            src={imageUrl}
            alt={`Illustration for ${story.title}`}
            className="w-full h-48 object-cover rounded-md mb-2"
          />
        )}
        <CardContent>
          <p className="text-gray-600 dark:text-gray-300 line-clamp-3">
            {contentPreview}
          </p>
        </CardContent>
        <CardFooter className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
          <div className="flex justify-between w-full mb-1">
            <div className="flex items-center">
              <BookOpen className="h-3 w-3 mr-1" />
              {t("story.version")} {story.version}
            </div>
            <div className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {formattedModifiedDate}
            </div>
          </div>
          <div className="flex justify-between w-full mb-1">
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              {t("story.week")} {story.week_number}
            </div>
            <div className="flex items-center">
              <FileText className="h-3 w-3 mr-1" />
              {formattedCreatedDate}
            </div>
          </div>
          <div className="flex justify-between w-full">
            <div className="flex items-center">
              <ListOrdered className="h-3 w-3 mr-1" />
              {t("story.day")} {getDayOfWeek(story.day_order)}
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default StoryCard;
