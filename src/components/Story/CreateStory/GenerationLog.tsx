import React from "react";
import { CheckCircle2 } from "lucide-react";
import { i18n } from "@/lib/i18n";

interface GenerationLogProps {
    logs: string[];
}

export const GenerationLog = ({ logs }: GenerationLogProps) => {
    const { t } = i18n;

    if (logs.length === 0) return null;

    return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
            <h4 className="font-semibold text-gray-700 mb-2">{t("version.history")} :</h4>
            <ul className="space-y-1">
                {logs.map((log, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                        {log.includes('✅') ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0" />
                        ) : (
                            <span className="w-4 mr-2 shrink-0"></span>
                        )}
                        <span>{log}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
