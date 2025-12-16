import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { PenLine } from 'lucide-react';

interface StoriesEmptyStateProps {
    handleCreateStory: () => void;
}

const StoriesEmptyState = ({ handleCreateStory }: StoriesEmptyStateProps) => {
  const { t } = i18n;
  return (
    <div className="text-center py-12">
      <p className="text-gray-500 mb-4">{t('stories.empty')}</p>
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

export default StoriesEmptyState;
