import { i18n } from '../../i18n.js';
import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../../../config/env.config.js';

export async function addIllustrations(doc, story, options, currentPage) {
  // If no illustrations or disabled, return
  if (!options.includeIllustrations || !story.illustrations?.length) {
    return currentPage;
  }

  // Skip the first illustration because it's already displayed on the Title Page (addStoryPage.js)
  const remainingIllustrations = story.illustrations.slice(1);

  if (remainingIllustrations.length === 0) {
      return currentPage;
  }

  for (const illustration of remainingIllustrations) {
    try {
      let fileType = illustration.file_type || illustration.fileType || 'JPEG';
      if (!illustration.image_path) throw new Error('No image_path for illustration');
      
      // image_path is relative to project root (e.g., 'uploads/...')
      const absPath = path.join(ENV_CONFIG.PROJECT_ROOT, illustration.image_path);
      if (!fs.existsSync(absPath)) throw new Error('Image file not found: ' + absPath);
      
      const fileBuffer = fs.readFileSync(absPath);
      const ext = path.extname(absPath).toLowerCase();
      if (ext === '.png') fileType = 'PNG';
      else if (ext === '.jpg' || ext === '.jpeg') fileType = 'JPEG';
      else if (ext === '.gif') fileType = 'GIF';
      
      const imageData = `data:image/${fileType.toLowerCase()};base64,${fileBuffer.toString('base64')}`;
      
      doc.addPage();
      currentPage++;
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20; // More generous margin
      const maxWidth = pageWidth - (2 * margin);
      // Leave space for caption
      const maxHeight = pageHeight - (2 * margin) - 20; 

      try {
        // 1. Get Image Properties for Aspect Ratio
        const imgProps = doc.getImageProperties(imageData);
        const imgRatio = imgProps.width / imgProps.height;

        // 2. Calculate Dimensions to FIT within maxWidth/maxHeight
        let drawWidth = maxWidth;
        let drawHeight = drawWidth / imgRatio;

        if (drawHeight > maxHeight) {
            drawHeight = maxHeight;
            drawWidth = drawHeight * imgRatio;
        }

        // 3. Center Horizontally & Vertically
        const xPos = margin + ((maxWidth - drawWidth) / 2);
        const yPos = margin + ((maxHeight - drawHeight) / 2);

        doc.addImage(
          imageData,
          fileType,
          xPos,
          yPos,
          drawWidth,
          drawHeight,
          undefined,
          'FAST'
        );

        // 4. Caption
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const caption = `${i18n.t('pdf.illustrationFor')} "${story.title}"`;
        const textWidth = doc.getTextWidth(caption);
        doc.text(caption, (pageWidth - textWidth) / 2, yPos + drawHeight + 10);
      } catch (imgError) {
        console.error(`Failed to add image for story ${story.title}:`, imgError);
        continue;
      }
    } catch (error) {
      console.error(`Error processing illustration for story ${story.title}:`, error);
      continue;
    }
  }
  return currentPage;
}
