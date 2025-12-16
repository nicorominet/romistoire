import PageLayout from "@/components/Layout/PageLayout";
import HeroSection from "@/components/Home/HeroSection";
import FeatureSection from "@/components/Home/FeatureSection";
import AgeGroupSection from "@/components/Home/AgeGroupSection";

const Index = () => {
  return (
    <PageLayout>
      <div className="flex flex-col min-h-screen">
        <HeroSection />
        <FeatureSection />
        <AgeGroupSection />
      </div>
    </PageLayout>
  );
};

export default Index;
