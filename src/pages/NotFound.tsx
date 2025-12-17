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
      <div className="text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-white/20 p-12 shadow-lg">
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 py-2">{t("notFound.title")}</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">{t("notFound.message")}</p>
        <a href="/" className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all">
          {t("notFound.returnHome")}
        </a>
      </div>
    </PageLayout>
  );
};

export default NotFound;
