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
        <section className="py-12 pb-24">
            <div className="container mx-auto px-4">
                 <div className="text-center mb-10">
                     <h2 className={`text-2xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-orange-400`}>{t("ageGroups.title")}</h2>
                     <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t("ageGroups.subtitle")}</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 max-w-6xl mx-auto">
                    {ageGroups.map((group) => (
                        <Link key={group.id} to={`/stories?ageGroup=${group.id}`} className="group relative">
                            <div className={`
                                flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-300 h-full
                                bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/20 dark:border-white/10
                                hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-2 hover:bg-white/60 dark:hover:bg-slate-800/60
                            `}>
                                <div className={`
                                    w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6
                                    ${getAgeGroupColor(group.id)} shadow-md
                                `}>
                                    <div className="text-gray-800 scale-90">
                                        {group.icon}
                                    </div>
                                </div>
                                <span className={`text-sm font-bold text-center leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
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
