import { PenLine, Star, Share2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import useDarkMode from "@/hooks/useDarkMode";

const FeatureSection = () => {
    const { t } = i18n;
    const darkMode = useDarkMode();

    const features = [
        {
            icon: <PenLine className="h-8 w-8 text-story-green-700" />,
            title: t("features.create.title"),
            description: t("features.create.description"),
            bgColor: darkMode ? 'bg-gray-800' : 'bg-story-green-50',
            textColor: darkMode ? 'text-gray-100' : 'text-story-green-700',
            descColor: darkMode ? 'text-gray-300' : 'text-story-green-600',
            iconBg: "bg-white"
        },
        {
            icon: <Star className="h-8 w-8 text-story-yellow-700" />,
            title: t("features.illustrate.title"),
            description: t("features.illustrate.description"),
            bgColor: darkMode ? 'bg-gray-800' : 'bg-story-yellow-50',
            textColor: darkMode ? 'text-gray-100' : 'text-story-yellow-700',
            descColor: darkMode ? 'text-gray-300' : 'text-story-yellow-600',
            iconBg: "bg-white"
        },
        {
            icon: <Share2 className="h-8 w-8 text-story-blue-700" />,
            title: t("features.share.title"),
            description: t("features.share.description"),
            bgColor: darkMode ? 'bg-gray-800' : 'bg-story-blue-50',
            textColor: darkMode ? 'text-gray-100' : 'text-story-blue-700',
            descColor: darkMode ? 'text-gray-300' : 'text-story-blue-600',
            iconBg: "bg-white"
        }
    ];

    return (
        <section className="py-12 relative">
            <div className="container mx-auto px-4">
                <div className="text-center mb-10">
                     <h2 className={`text-2xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400`}>{t("features.title")}</h2>
                     <p className={`text-lg max-w-2xl mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t("features.subtitle")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature, idx) => (
                        <div key={idx} className={`
                            group relative rounded-2xl p-6 text-center transition-all duration-500
                            bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/20 dark:border-white/10
                            hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-2
                            hover:bg-white/60 dark:hover:bg-slate-800/60
                        `}>
                            <div className={`${feature.iconBg} rounded-xl w-14 h-14 mx-auto mb-4 flex items-center justify-center shadow-lg rotate-3 group-hover:rotate-12 transition-transform duration-500`}>
                                <div className="scale-75">
                                    {feature.icon}
                                </div>
                            </div>
                            <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{feature.title}</h3>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeatureSection;
