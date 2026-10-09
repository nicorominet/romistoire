import { describe, it, expect } from "vitest";
import { zipSync } from "fflate";
import { extractImages, matchImportFiles, imageTypeOf } from "./illustrationImport";

const image = (name: string, lastModified: number, type = "image/png") => new File(["x"], name, { type, lastModified });
const stories = [
  { id: "a", code: "IMG-aaaaaaaa" },
  { id: "b", code: "IMG-bbbbbbbb" },
  { id: "c", code: "IMG-cccccccc" },
];

describe("matchImportFiles", () => {
  it("should attach a file to the story of the code in its name", () => {
    const files = [image("IMG-cccccccc.png", 1), image("mon IMG-AAAAAAAA (1).jpg", 2)];
    expect(matchImportFiles(files, stories).map(match => [match.storyId, match.by])).toEqual([["c", "code"], ["a", "code"]]);
  });

  it("should give the other files to the remaining stories in download order", () => {
    const files = [image("Gemini_Generated_Image_2.png", 20), image("IMG-bbbbbbbb.png", 5), image("Gemini_Generated_Image_1.png", 10)];
    expect(matchImportFiles(files, stories).map(match => [match.file.name, match.storyId, match.by])).toEqual([
      ["Gemini_Generated_Image_2.png", "c", "order"],
      ["IMG-bbbbbbbb.png", "b", "code"],
      ["Gemini_Generated_Image_1.png", "a", "order"],
    ]);
  });

  it("should leave the extra files unattached, and treat an unknown code like a file without code", () => {
    const files = [image("IMG-99999999.png", 1), image("2.png", 2), image("3.png", 3), image("4.png", 4)];
    expect(matchImportFiles(files, stories).map(match => match.storyId)).toEqual(["a", "b", "c", null]);
  });

  it("should only give files by order to the given stories", () => {
    const files = [image("IMG-aaaaaaaa.png", 1), image("photo.png", 2)];
    expect(matchImportFiles(files, stories, [stories[2]]).map(match => match.storyId)).toEqual(["a", "c"]);
  });

  it("should not attach two files to the same story by code", () => {
    const files = [image("IMG-aaaaaaaa.png", 1), image("IMG-aaaaaaaa (2).png", 2)];
    expect(matchImportFiles(files, stories).map(match => [match.storyId, match.by])).toEqual([["a", "code"], ["b", "order"]]);
  });
});

describe("extractImages", () => {
  it("should open a ZIP and keep only its images, in archive order", async () => {
    const zip = zipSync({
      "IMG-bbbbbbbb.png": new Uint8Array([1]),
      "notes.txt": new Uint8Array([2]),
      "__MACOSX/._IMG-bbbbbbbb.png": new Uint8Array([3]),
      "dossier/IMG-aaaaaaaa.jpg": new Uint8Array([4]),
    });
    const archive = new File([zip], "images.zip", { type: "application/zip", lastModified: 1000 });

    const images = await extractImages([archive, image("photo.webp", 5, "")]);

    expect(images.map(file => [file.name, file.type])).toEqual([
      ["IMG-bbbbbbbb.png", "image/png"],
      ["IMG-aaaaaaaa.jpg", "image/jpeg"],
      ["photo.webp", "image/webp"],
    ]);
    expect(images[0].lastModified).toBeLessThan(images[1].lastModified);
  });

  it("should recognise images by type or extension", () => {
    expect(imageTypeOf("a.JPEG")).toBe("image/jpeg");
    expect(imageTypeOf("a.bin", "image/png")).toBe("image/png");
    expect(imageTypeOf("a.html", "text/html")).toBeNull();
  });
});
