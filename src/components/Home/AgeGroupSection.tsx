import { Link } from "react-router-dom";
import { getAgeGroupColor } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import useDarkMode from "@/hooks/useDarkMode";
import { Baby, School, GraduationCap, Sparkles, BookOpen, Glasses } from "lucide-react";

const AgeGroupSection = () => {
    const { t } = i18n;
    const darkMode = useDarkMode();

    const ageGroups = [
        { id: "2-3", icon: <Baby className="w-6 h-6" />, label: t("ages.2-3") },
        { id: "4-6", icon: <Sparkles className="w-6 h-6" />, label: t("ages.4-6") },
        { id: "7-9", icon: <School className="w-6 h-6" />, label: t("ages.7-9") },
        { id: "10-12", icon: <GraduationCap className="w-6 h-6" />, label: t("ages.10-12") },
        { id: "13-15", icon: <BookOpen className="w-6 h-6" />, label: t("ages.13-15") },
        { id: "16-18", icon: <Glasses className="w-6 h-6" />, label: t("ages.16-18") },
    ];

    return (
        <section className="py-20">
            <div className="container mx-auto px-4">
                 <div className="text-center mb-12">
                     <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t("ageGroups.title")}</h2>
                     <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t("ageGroups.subtitle")}</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl mx-auto">
                    {ageGroups.map((group) => (
                        <Link key={group.id} to={`/stories?ageGroup=${group.id}`} className="group">
                            <div className={`
                                flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300
                                border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700
                                hover:shadow-lg hover:-translate-y-1 bg-white dark:bg-gray-800
                                group-hover:bg-purple-50 dark:group-hover:bg-purple-900/10
                            `}>
                                <div className={`
                                    w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110
                                    ${getAgeGroupColor(group.id)} text-gray-800 font-bold shadow-sm
                                `}>
                                    {group.icon}
                                </div>
                                <span className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {group.label}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default AgeGroupSection;
