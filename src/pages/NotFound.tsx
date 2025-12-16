import PageLayout from "@/components/Layout/PageLayout";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

import { i18n } from "@/lib/i18n";

const NotFound = () => {
  const location = useLocation();
  const { t } = i18n;

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <PageLayout className="flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">{t("notFound.title")}</h1>
        <p className="text-xl text-gray-600 mb-4">{t("notFound.message")}</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          {t("notFound.returnHome")}
        </a>
      </div>
    </PageLayout>
  );
};

export default NotFound;
