import { query } from "../../config/database.js";
import { configureFonts } from './fonts.js';
import { addBlankTableOfContents } from './helpers/addBlankTableOfContents.js';
import { addStoryPage } from './helpers/addStoryPage.js';
import { addIllustrations } from './helpers/addIllustrations.js';
import { updateTableOfContents } from './helpers/updateTableOfContents.js';
import { i18n, init } from '../i18n.js';
import { jsPDF } from 'jspdf';
import { addCoverPage } from './helpers/addCoverPage.js';
import { storyService } from '../../services/story.service.js';

async function generatePDF(options) {
  // Initialize i18n if it's not already loaded
  if (!i18n.isLoaded()) {
    console.log("i18n not loaded yet, initializing...");
    try {
      await init();
      console.log("i18n initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize i18n:", error);
      throw new Error("Failed to initialize i18n for PDF generation.");
    }
  }

  if (!options?.stories?.length) {
    throw new Error("No stories provided for PDF generation");
  }

  const doc = new jsPDF({
    orientation: options.orientation || "portrait",
    unit: "mm",
    format: options.pageSize?.toLowerCase() || "a4",
  });

  try {
    // Use the storyService to fetch stories with full details
    const stories = await storyService.findByIds(options.stories);

    if (!stories?.length) {
      throw new Error("No stories found for the provided IDs");
    }

    configureFonts(doc, options);

    let currentPage = 1;
    const storyPages = [];

    if (options.coverPage) {
      addCoverPage(doc, stories, options);
      currentPage = doc.internal.getNumberOfPages();
    }

    if (options.tableOfContents) {
      // Assuming TOC is on the "next" page after cover
      doc.addPage(); 
      currentPage = doc.internal.getNumberOfPages();
      const tocPage = currentPage; // Page number of TOC
      
      addBlankTableOfContents(doc);
      // NOTE: addBlankTableOfContents might not add pages, it just draws headers.
      // But if we want proper TOC tracking, we just mark this page.

      for (const story of stories) {
        doc.addPage();
        currentPage = doc.internal.getNumberOfPages();
        storyPages.push({ title: story.title, page: currentPage });
        
        addStoryPage(doc, story, options);
        currentPage = doc.internal.getNumberOfPages(); // Sync after text pages

        await addIllustrations(
          doc,
          story,
          options,
          currentPage
        );
        currentPage = doc.internal.getNumberOfPages(); // Sync after illustrations
      }

      updateTableOfContents(doc, storyPages, tocPage);
    } else {
      for (const story of stories) {
        if (currentPage > 1) doc.addPage();
        // If it's the very first page of content (and no cover/toc), we might be on page 1.
        
        addStoryPage(doc, story, options);
        currentPage = doc.internal.getNumberOfPages();

        await addIllustrations(
          doc,
          story,
          options,
          currentPage
        );
        currentPage = doc.internal.getNumberOfPages();
      }
    }

    return doc;
  } catch (error) {
    console.error("Error during PDF generation:", error);
    throw new Error(
      `PDF generation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export { generatePDF };
