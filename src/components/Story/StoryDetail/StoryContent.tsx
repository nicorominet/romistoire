import { i18n } from '@/lib/i18n';
import useDarkMode from '@/hooks/useDarkMode';

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

interface StoryContentProps {
  story: any;
}

const StoryContent = ({ story }: StoryContentProps) => {
  const { t } = i18n;
  const darkMode = useDarkMode();

  const illustrations = story.illustrations || [];
  const hasIllustrations = illustrations.length > 0;

  const getSafePath = (illustration: any) => {
    const imagePath = illustration ? (illustration.image_path || illustration.imagePath || illustration.path) : null;
    return imagePath ? imagePath.replace(/\\/g, '/') : '';
  };

  return (
    <div className="space-y-8">
      {hasIllustrations && (
        <div className="mb-6 md:float-left md:w-1/2 lg:w-5/12 md:mr-8 rounded-xl overflow-hidden shadow-lg border border-border clear-left group relative">
          {illustrations.length === 1 ? (
             <img 
               src={`/${getSafePath(illustrations[0])}`} 
               alt={story.title}
               className="w-full h-auto object-cover"
               onError={(e) => {
                   const target = e.target as HTMLImageElement;
                   if (!target.src.includes('placeholder')) {
                       target.src = '/placeholder.svg';
                   }
               }}
             />
          ) : (
            <Carousel className="w-full">
              <CarouselContent>
                {illustrations.map((img: any, index: number) => (
                  <CarouselItem key={img.id || index}>
                    <div className="aspect-[4/3] w-full relative">
                        <img 
                          src={`/${getSafePath(img)}`} 
                          alt={`${story.title} - ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.src.includes('placeholder')) {
                                  target.src = '/placeholder.svg';
                              }
                          }}
                        />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CarouselNext className="right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Carousel>
          )}
        </div>
      )}

      <div className={`prose dark:prose-invert max-w-none mx-auto text-lg leading-relaxed text-left`}>
        {story.content.split('\n')
            .map((paragraph: string, index: number) => {
                const trimmed = paragraph.trim();
                const isIllustrationPrompt = 
                    trimmed.startsWith('[Illustration:') ||
                    trimmed.startsWith('> **Illustration') ||
                    trimmed.startsWith('**Illustration') ||
                    trimmed.startsWith('Illustration suggérée');

                // If image exists, hide the prompt
                if (hasIllustrations && isIllustrationPrompt) {
                    return null;
                }

                // If no image, show the prompt but styled
                if (!hasIllustrations && isIllustrationPrompt) {
                    return (
                        <div key={index} className="my-8 p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground flex gap-3 items-start">
                             <div className="shrink-0 mt-0.5">🎨</div>
                             <div className="italic">{paragraph.replace(/^> \*\*Illustration.*:\*\*\s*/, '').replace(/^\[Illustration:\s*/, '').replace(/\]$/, '')}</div>
                        </div>
                    );
                }

                if (!trimmed) return <p key={index} className="mb-6">&nbsp;</p>;

                return (
                  <p key={index} className="mb-6 text-gray-800 dark:text-gray-200">
                    {paragraph}
                  </p>
                );
            })}
      </div>
    </div>
  );
};

export default StoryContent;
