/**
 * Table Builder - Add tables to PowerPoint slides using PptxGenJS
 * Matches the functionality of the local html2pptx skill
 */

/**
 * Add a table to a slide at the specified placeholder position
 * @param {object} slide - PptxGenJS slide instance
 * @param {object} tableConfig - Table configuration
 * @param {object} placeholder - Placeholder position {x, y, w, h}
 */
function addTableToSlide(slide, tableConfig, placeholder) {
  const tableOptions = {
    x: placeholder.x,
    y: placeholder.y,
    w: placeholder.w,
    ...tableConfig.options
  };

  // Process colors - remove # prefix if present
  if (tableOptions.border && tableOptions.border.color) {
    tableOptions.border.color = tableOptions.border.color.replace('#', '');
  }
  if (tableOptions.fill && tableOptions.fill.color) {
    tableOptions.fill.color = tableOptions.fill.color.replace('#', '');
  }

  // Process row data - handle cell-level formatting
  const processedRows = tableConfig.rows.map(row => {
    return row.map(cell => {
      if (typeof cell === 'object' && cell.options) {
        const cellOptions = { ...cell.options };
        if (cellOptions.fill && cellOptions.fill.color) {
          cellOptions.fill.color = cellOptions.fill.color.replace('#', '');
        }
        if (cellOptions.color) {
          cellOptions.color = cellOptions.color.replace('#', '');
        }
        return { text: cell.text, options: cellOptions };
      }
      return cell;
    });
  });

  slide.addTable(processedRows, tableOptions);
  console.log(`[TableBuilder] Added table with ${tableConfig.rows.length} rows at (${placeholder.x.toFixed(2)}, ${placeholder.y.toFixed(2)})`);
}

/**
 * Process all tables for a slide
 * @param {object} slide - PptxGenJS slide instance
 * @param {Array} tables - Array of table configurations
 * @param {Array} placeholders - Array of placeholder positions from HTML
 */
function processTables(slide, tables, placeholders) {
  if (!tables || !Array.isArray(tables) || tables.length === 0) {
    return;
  }

  for (const tableConfig of tables) {
    const placeholder = placeholders.find(p => p.id === tableConfig.placeholderId);
    
    if (!placeholder) {
      console.warn(`[TableBuilder] Placeholder not found: ${tableConfig.placeholderId}`);
      console.warn(`[TableBuilder] Available placeholders: ${placeholders.map(p => p.id).join(', ')}`);
      continue;
    }

    addTableToSlide(slide, tableConfig, placeholder);
  }
}

/**
 * Table data format:
 * {
 *   placeholderId: "data-table",
 *   rows: [
 *     // Simple row (strings only)
 *     ["Header 1", "Header 2", "Header 3"],
 *     
 *     // Row with cell formatting
 *     [
 *       { text: "Bold Cell", options: { bold: true } },
 *       { text: "Colored", options: { fill: { color: "2E3952" }, color: "FFFFFF" } },
 *       "Plain text"
 *     ]
 *   ],
 *   options: {
 *     border: { pt: 1, color: "999999" },
 *     fill: { color: "F5F5F5" },
 *     align: "center",
 *     valign: "middle",
 *     fontSize: 12,
 *     colW: [2, 3, 2],  // Column widths in inches
 *     rowH: [0.5, 0.4, 0.4]  // Row heights in inches
 *   }
 * }
 * 
 * Cell options:
 * - bold: boolean
 * - italic: boolean
 * - color: hex color (no # prefix)
 * - fill: { color: hex }
 * - align: 'left' | 'center' | 'right'
 * - colspan: number (merge cells horizontally)
 * - rowspan: number (merge cells vertically)
 */

module.exports = {
  addTableToSlide,
  processTables
};
