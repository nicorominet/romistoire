import PageLayout from "@/components/Layout/PageLayout";
import HomeHeader from "@/components/Home/HomeHeader";
import TodayStories from "@/components/Home/TodayStories";
import HomeTasks from "@/components/Home/HomeTasks";
import WeekPlanner from "@/components/Home/WeekPlanner";
import LibraryStats from "@/components/Home/LibraryStats";

/**
 * Home page: today's stories to read, what is left to do, the week's planning.
 */
const Index = () => {
  return (
    <PageLayout compact>
      <div className="flex flex-col gap-4 pb-4 2xl:gap-5">
        <HomeHeader />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] 2xl:gap-5">
          <TodayStories />
          <HomeTasks />
        </div>
        <WeekPlanner />
        <LibraryStats />
      </div>
    </PageLayout>
  );
};

export default Index;
