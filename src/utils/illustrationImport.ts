/**
 * Batch import of illustrations: which file goes to which story.
 * Files made by the Gemini Canvas tool (or renamed by hand) carry the story code ("IMG-7f3a2c91.png");
 * the others are matched in download order with the stories of the list.
 */
import { ACCEPTED_IMAGE_TYPES } from "@/constants";

export const CODE_PATTERN = /IMG-([0-9a-f]{8})/i;

/** Upload limit of the server is 5 Mo: bigger images are shrunk before sending. */
export const SHRINK_ABOVE = 4.5 * 1024 * 1024;
const SHRINK_MAX_SIDE = 1600;

const EXTENSION_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export interface ImportStory {
  id: string;
  code: string;
}

export interface ImportMatch {
  file: File;
  storyId: string | null;
  /** "code": name of the file; "order": download order; null: not attached. */
  by: "code" | "order" | null;
}

/** Image type of a file, from its type or its extension. */
export const imageTypeOf = (name: string, type = ""): string | null => {
  if (ACCEPTED_IMAGE_TYPES.includes(type)) return type;
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? null;
};

/** Bytes of a file (FileReader: also available where Blob.arrayBuffer is not, as in jsdom). */
const readBytes = (file: Blob) => new Promise<Uint8Array>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(file);
});

/**
 * Images of the picked files: images as they are, ZIP archives opened (other files ignored).
 * Images of an archive keep the archive order (used for the order matching).
 */
export const extractImages = async (files: File[]): Promise<File[]> => {
  const images: File[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
      const { unzipSync } = await import("fflate");
      const entries = unzipSync(await readBytes(file));
      Object.keys(entries)
        .filter(path => !path.endsWith("/") && !path.split("/").some(part => part.startsWith(".") || part === "__MACOSX"))
        .forEach((path, index) => {
          const name = path.split("/").pop() ?? path;
          const type = imageTypeOf(name);
          if (type) images.push(new File([entries[path]], name, { type, lastModified: file.lastModified + index }));
        });
    } else {
      const type = imageTypeOf(file.name, file.type);
      if (type) images.push(type === file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified }));
    }
  }
  return images;
};

/**
 * Story of each file:
 * 1. the code in the file name;
 * 2. otherwise, the remaining files sorted by date (download order) go to the remaining stories, in list order;
 * 3. extra files are not attached.
 * @param files - Images to attach.
 * @param stories - Stories of the list, in list order.
 * @param orderStories - Stories that may receive a file by order (default: all); e.g. only those still without image.
 */
export const matchImportFiles = (files: File[], stories: ImportStory[], orderStories: ImportStory[] = stories): ImportMatch[] => {
  const byCode = new Map(stories.map(story => [story.code.toLowerCase(), story.id]));
  const used = new Set<string>();
  const matches = new Map<File, ImportMatch>();

  for (const file of files) {
    const code = file.name.match(CODE_PATTERN)?.[0].toLowerCase();
    const storyId = code ? byCode.get(code) : undefined;
    if (storyId && !used.has(storyId)) {
      used.add(storyId);
      matches.set(file, { file, storyId, by: "code" });
    }
  }

  const remainingStories = orderStories.filter(story => !used.has(story.id));
  const remainingFiles = files
    .filter(file => !matches.has(file))
    .map((file, index) => ({ file, index }))
    .sort((a, b) => a.file.lastModified - b.file.lastModified || a.index - b.index)
    .map(({ file }) => file);
  remainingFiles.forEach((file, index) => {
    const story = remainingStories[index];
    matches.set(file, story ? { file, storyId: story.id, by: "order" } : { file, storyId: null, by: null });
  });

  return files.map(file => matches.get(file)!);
};

/**
 * Shrinks an image above the upload limit (largest side 1600 px, JPEG 90 %).
 * Smaller images are sent as they are.
 */
export const shrinkImage = async (file: File): Promise<File> => {
  if (file.size <= SHRINK_ABOVE) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SHRINK_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
};
