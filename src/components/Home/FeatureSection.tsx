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
        <section className="py-20 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                     <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t("features.title")}</h2>
                     <p className={`text-lg max-w-2xl mx-auto ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t("features.subtitle")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {features.map((feature, idx) => (
                        <div key={idx} className={`rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${feature.bgColor} border border-transparent dark:border-gray-700`}>
                            <div className={`${feature.iconBg} rounded-2xl w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-lg rotate-3 hover:rotate-6 transition-transform`}>
                                {feature.icon}
                            </div>
                            <h3 className={`text-2xl font-bold mb-4 ${feature.textColor}`}>{feature.title}</h3>
                            <p className={`${feature.descColor} leading-relaxed`}>
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
