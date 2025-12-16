import { i18n } from "@/lib/i18n";
import { Illustration } from "@/types/Story";
import IllustrationCanvas from "@/components/Story/EditStory/IllustrationCanvas";
import IllustrationUpload from "@/components/Story/EditStory/IllustrationUpload";
import IllustrationList from "@/components/Story/EditStory/IllustrationList";

interface StoryIllustrationsProps {
  illustrations: Illustration[];
  addIllustrationToBackend: (
    file: File,
    filename?: string,
    fileType?: string
  ) => Promise<void>;
  deleteIllustration: (illustrationId: string) => Promise<void>;
}

const StoryIllustrations = ({
  illustrations,
  addIllustrationToBackend,
  deleteIllustration,
}: StoryIllustrationsProps) => {
  const { t } = i18n;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Image is too large. Maximum size is 5MB");
      return;
    }
    await addIllustrationToBackend(file, file.name, file.type);
    e.target.value = "";
  };

  const handleDeleteIllustration = async (index: number) => {
    const illustrationToDelete = illustrations[index];
    
    // Check if illustration has an ID (backend) or just local match (frontend create mode usually)
    // Actually for frontend 'create' mode, we might just pass 'index' if no IDs yet?
    // But Illustration interface likely requires ID.
    // If 'create' mode generates temp IDs, we use them.
    
    if (illustrationToDelete?.id) {
         try {
            await deleteIllustration(illustrationToDelete.id);
         } catch (error) {
            console.error("Error deleting illustration:", error);
         }
    } else {
         // Fallback or error if no ID
         // If we support index-based deletion for local only, the parent 'deleteIllustration' should handle it via logic mapping
         // Ideally all illustrations have IDs (even temp)
         console.warn("Illustration has no ID, cannot delete properly via ID-based callback");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
         {/* Canvas and Upload components - Reusing existing ones from EditStory for now as they are generic enough 
             OR should I move them too? 
             Refactoring plan said "Move StoryIllustrations.tsx here". 
             It implies dependent components too? 
             For now, I import them from their current location. 
             Ideally I should move them to StoryEditor too.
             I will update imports if I move them later.
         */}
         <IllustrationCanvas
            onSave={async (dataURL: string) => {
            try {
                const res = await fetch(dataURL);
                const blob = await res.blob();
                const filename = `drawing_${Date.now()}.png`;
                const file = new File([blob], filename, { type: "image/png" });

                await addIllustrationToBackend(file, filename, "image/png");
            } catch (error) {
                console.error("Error saving illustration from canvas:", error);
            }
            }}
        />
        <IllustrationUpload onImageChange={handleImageUpload} />
      </div>

      <IllustrationList
        illustrations={illustrations}
        onDelete={handleDeleteIllustration}
      />
    </div>
  );
};

export default StoryIllustrations;
