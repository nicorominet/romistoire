
import { i18n } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AgeGroup } from "@/types/Story";

interface AgeGroupPickerProps {
  value: AgeGroup;
  onChange: (value: AgeGroup) => void;
}

const ageGroups: { value: AgeGroup; color: string }[] = [
  { value: "2-3", color: "bg-story-green-100" },
  { value: "4-6", color: "bg-story-blue-100" },
  { value: "7-9", color: "bg-story-yellow-100" },
  { value: "10-12", color: "bg-story-pink-100" }
];

const AgeGroupPicker = ({ value, onChange }: AgeGroupPickerProps) => {
  const { t } = i18n;

  return (
    <div className="space-y-2">
      <Label>{t("story.ageGroup")}</Label>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as AgeGroup)}
        className="flex flex-wrap gap-2"
      >
        {ageGroups.map((age) => (
          <div
            key={age.value}
            className={`relative border rounded-md p-2 flex items-center space-x-2 cursor-pointer hover:bg-accent ${
              value === age.value
                ? "border-story-purple ring-1 ring-story-purple"
                : "border-gray-200"
            }`}
            onClick={() => onChange(age.value)}
          >
            <RadioGroupItem
              value={age.value}
              id={`age-${age.value}`}
              className="sr-only"
            />
            <div
              className={`w-3 h-3 rounded-full ${age.color}`}
              aria-hidden="true"
            ></div>
            <Label
              htmlFor={`age-${age.value}`}
              className="cursor-pointer font-normal"
            >
              {t(`ages.${age.value}`)}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default AgeGroupPicker;
