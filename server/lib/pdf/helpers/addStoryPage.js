import { i18n } from '../../i18n.js';
import fs from 'fs';
import path from 'path';

/**
 * Adds a story page to the PDF document.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance
 * @param {Object} story - The story object containing title, content, illustrations etc.
 * @param {Object} options - The export options
 */
export function addStoryPage(doc, story, options) {
  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPosition = margin;

  // --- TITLE PAGE (Page 1 of the story) ---

  // Check if table of contents is included and this is the first story. Add a new page if needed.
  // Logic: If TOC is present, we are likely on the TOC page or just after.
  // If no TOC, we might be on page 1 (cover) or page 2.
  // Safest: Always add a page for a new story unless it's the very first page and empty?
  // Current logic in generatePDF handles page addition for subsequent stories.
  // We assume doc is ready for drawing the Title Page.

  // 1. Title
  doc.setFontSize(24); // Larger title
  doc.setTextColor(70, 50, 140);
  doc.setFont("helvetica", "bold");
  
  const titleLines = doc.splitTextToSize(story.title, pageWidth - (2 * margin));
  doc.text(titleLines, pageWidth / 2, yPosition, { align: "center" });
  yPosition += (titleLines.length * 10) + 10;

  // 2. Metadata (Centered, lighter)
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");

  const metadata = [];
  if (Array.isArray(story.themes) && story.themes.length > 0) {
    const themeLabels = story.themes.map(theme => theme.name).join(', ');
    metadata.push(`${i18n.t("story.themes")}: ${themeLabels}`);
  }
  if (story.age_group) {
    metadata.push(`${i18n.t("story.ageGroup")}: ${story.age_group}`);
  }

  metadata.forEach(line => {
      doc.text(line, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 6;
  });
  yPosition += 10;

  // 3. Primary Illustration (First one)
  if (options.includeIllustrations && story.illustrations && story.illustrations.length > 0) {
      const primaryImage = story.illustrations[0];
      try {
          let fileType = primaryImage.file_type || primaryImage.fileType || 'JPEG';
          if (!primaryImage.image_path) throw new Error('No image_path');
          
          const absPath = path.join(process.cwd(), primaryImage.image_path);
          if (fs.existsSync(absPath)) {
              const fileBuffer = fs.readFileSync(absPath);
              const ext = path.extname(absPath).toLowerCase();
              if (ext === '.png') fileType = 'PNG';
              else if (ext === '.jpg' || ext === '.jpeg') fileType = 'JPEG';
              
              const imageData = `data:image/${fileType.toLowerCase()};base64,${fileBuffer.toString('base64')}`;

              // Calculate dimensions to fit remaining space on Title Page
              const availableHeight = pageHeight - yPosition - margin;
              const availableWidth = pageWidth - (2 * margin);
              
              // Get Image Props (aspect ratio)
              const imgProps = doc.getImageProperties(imageData);
              const imgRatio = imgProps.width / imgProps.height;

              // Calculate intended dims
              let drawWidth = availableWidth;
              let drawHeight = drawWidth / imgRatio;

              if (drawHeight > availableHeight) {
                  drawHeight = availableHeight;
                  drawWidth = drawHeight * imgRatio;
              }

              // Center horizontally
              const xPos = (pageWidth - drawWidth) / 2;

              doc.addImage(imageData, fileType, xPos, yPosition, drawWidth, drawHeight);
          }
      } catch (err) {
          console.error("Error adding primary illustration to title page:", err);
      }
  }

  // --- CONTENT PAGES (Page 2+) ---
  doc.addPage(); // Start text on fresh page
  yPosition = margin;

  // Content Styling for "Children's Book"
  doc.setFontSize(14); // Larger readable text
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  const cleanContent = story.content.replace(/\[Illustration:.*?\]/g, '');
  const maxWidth = pageWidth - (2 * margin);
  // Increase line spacing factor (1.5 approx)
  const lines = doc.splitTextToSize(cleanContent, maxWidth);
  const lineHeight = 10; // Generous spacing

  lines.forEach(line => {
    if (yPosition > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
    doc.text(line, margin, yPosition);
    yPosition += lineHeight;
  });
}
