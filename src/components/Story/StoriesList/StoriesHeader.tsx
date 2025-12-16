import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { PenLine } from 'lucide-react';

interface StoriesHeaderProps {
  totalStories: number;
  handleCreateStory: () => void;
}

const StoriesHeader = ({ totalStories, handleCreateStory }: StoriesHeaderProps) => {
    const { t } = i18n;
    return (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-story-purple-800">
            {t('stories.title')}
          </h1>
          <p className="text-gray-600">
            {totalStories} {totalStories === 1 ? t('story.title') : t('stories.title')} available
          </p>
        </div>
        <Button
          onClick={handleCreateStory}
          className="bg-story-purple hover:bg-story-purple-600"
          aria-label="Create Story"
        >
          <PenLine className="mr-2 h-4 w-4" />
          {t('stories.create')}
        </Button>
      </div>
    );
};

export default StoriesHeader;
