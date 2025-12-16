import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { i18n } from '@/lib/i18n';

interface StoryNavigationProps {
  prevId?: string;
  nextId?: string;
  prevTitle?: string;
  nextTitle?: string;
}

const StoryNavigation = ({ prevId, nextId, prevTitle, nextTitle }: StoryNavigationProps) => {
  const navigate = useNavigate();
  const { t } = i18n;

  return (
    <div className="flex justify-between items-center pt-8 border-t">
      <div className="flex-1">
        {prevId && (
          <Button
            variant="ghost"
            className="flex flex-col items-start h-auto py-4 px-6 gap-2 hover:bg-white/50 dark:hover:bg-gray-800/50"
            onClick={() => navigate(`/stories/${prevId}`)}
          >
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <ChevronLeft className="h-4 w-4" />
              {t('story.previous')}
            </div>
            <div className="font-semibold text-left line-clamp-1">
              {prevTitle}
            </div>
          </Button>
        )}
      </div>

      <div className="flex-1 flex justify-end">
        {nextId && (
          <Button
            variant="ghost"
            className="flex flex-col items-end h-auto py-4 px-6 gap-2 hover:bg-white/50 dark:hover:bg-gray-800/50"
            onClick={() => navigate(`/stories/${nextId}`)}
          >
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              {t('story.next')}
              <ChevronRight className="h-4 w-4" />
            </div>
            <div className="font-semibold text-right line-clamp-1">
              {nextTitle}
            </div>
          </Button>
        )}
      </div>
    </div>
  );
};

export default StoryNavigation;
