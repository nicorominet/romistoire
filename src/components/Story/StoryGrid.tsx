import { i18n } from "@/lib/i18n";
import { Story, AgeGroup } from "@/types/Story";
import StoryCard from "./StoryCard";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import useDarkMode from '@/hooks/useDarkMode';

interface StoryGridProps {
  stories: Story[];
  locale: string;
  themeColors?: { [themeId: string]: string };
}

const StoryGrid = ({
  stories,
  locale,
  themeColors = {},
}: StoryGridProps) => {
  const { t } = i18n;
  const darkMode = useDarkMode();

  if (stories.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl text-gray-500 mb-4">{t("stories.empty")}</h3>
        <Link to="/create">
          <Button className="bg-story-purple hover:bg-story-purple-600">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("stories.create")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} themeColors={themeColors} />
      ))}
    </div>
  );
};

export default StoryGrid;