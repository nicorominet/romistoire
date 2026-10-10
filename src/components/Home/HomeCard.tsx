import React from "react";
import { RefreshCw } from "lucide-react";
import { i18n } from "@/lib/i18n";

interface HomeCardProps {
  title: string;
  /** Right side of the title row (links, controls) */
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Block of the home page: titled card. */
export const HomeCard = ({ title, actions, className = "", children }: HomeCardProps) => (
  <section aria-label={title} className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/55 sm:p-5 ${className}`}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">{title}</h2>
      {actions}
    </div>
    {children}
  </section>
);

/** Load error of a block, with a retry. */
export const HomeError = ({ message, onRetry }: { message: string; onRetry: () => void }) => {
  const { t } = i18n;
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-1 font-semibold hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:hover:bg-rose-400/10"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        {t("home.retry")}
      </button>
    </div>
  );
};
