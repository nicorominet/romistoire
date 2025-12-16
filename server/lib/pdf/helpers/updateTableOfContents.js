/**
 * Updates the table of contents with story titles and page numbers.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance
 * @param {Array<{title: string, page: number}>} storyPages - Array of story titles and their page numbers
 * @param {number} tocPage - The page number of the table of contents
 */
export function updateTableOfContents(doc, storyPages, tocPage) {
  doc.setPage(tocPage);
  
  const margin = 30;
  let yOffset = 40;
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);

  storyPages.forEach(({ title, page }) => {
    // Add story title and page number
    doc.text(title, margin, yOffset);
    doc.text(page.toString(), doc.internal.pageSize.width - margin, yOffset);

    // Add dotted line between title and page number
    const titleWidth = doc.getTextWidth(title);
    const pageWidth = doc.getTextWidth(page.toString());
    const dotsStart = margin + titleWidth + 5;
    const dotsEnd = doc.internal.pageSize.width - margin - pageWidth - 5;
    
    for (let x = dotsStart; x < dotsEnd; x += 3) {
      doc.text('.', x, yOffset);
    }

    yOffset += 10;

    // Add a new page if we reach the bottom margin
    if (yOffset > doc.internal.pageSize.height - margin) {
      doc.addPage();
      yOffset = margin + 10;
    }
  });
}
