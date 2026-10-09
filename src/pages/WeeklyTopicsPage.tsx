import { useSearchParams } from "react-router-dom";
import PageLayout from "@/components/Layout/PageLayout";
import { i18n } from "@/lib/i18n";
import { WeeklyTopicCalendar } from "@/components/WeeklyTopics/WeeklyTopicCalendar";
import { currentIsoWeek } from "@/utils/weekUtils";

/**
 * Weekly program: the topic of each week (free text guiding story writing).
 * The calendar year lives in the URL (?year=).
 */
const WeeklyTopicsPage = () => {
  const { t } = i18n;
  const [searchParams, setSearchParams] = useSearchParams();
  const thisYear = currentIsoWeek().year;
  const year = Number(searchParams.get("year")) || thisYear;

  const handleYearChange = (value: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value === thisYear) next.delete("year");
      else next.set("year", String(value));
      return next;
    }, { replace: true });
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-story-purple-800 dark:text-story-purple-200">{t("weeklyTopics.title")}</h1>
          <p className="text-muted-foreground">{t("weeklyTopics.subtitle")}</p>
        </header>
        <WeeklyTopicCalendar year={year} onYearChange={handleYearChange} />
      </div>
    </PageLayout>
  );
};

export default WeeklyTopicsPage;
