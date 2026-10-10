import { Story } from "@/types/Story";
import StoryCard from "./StoryCard";

interface StoryGridProps {
  stories: Story[];
}

/** Library cards, up to 4 per row on wide screens. */
const StoryGrid = ({ stories }: StoryGridProps) => (
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    {stories.map((story) => (
      <StoryCard key={story.id} story={story} />
    ))}
  </div>
);

export default StoryGrid;
