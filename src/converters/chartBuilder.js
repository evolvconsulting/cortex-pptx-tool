/**
 * Chart Builder - Add charts to PowerPoint slides using PptxGenJS
 * Matches the functionality of the local html2pptx skill
 */

/**
 * Add a chart to a slide at the specified placeholder position
 * @param {object} slide - PptxGenJS slide instance
 * @param {object} pres - PptxGenJS presentation instance
 * @param {object} chartConfig - Chart configuration
 * @param {object} placeholder - Placeholder position {x, y, w, h}
 */
function addChartToSlide(slide, pres, chartConfig, placeholder) {
  const chartType = pres.charts[chartConfig.type];
  
  if (!chartType) {
    console.warn(`[ChartBuilder] Unknown chart type: ${chartConfig.type}`);
    return;
  }

  const chartOptions = {
    x: placeholder.x,
    y: placeholder.y,
    w: placeholder.w,
    h: placeholder.h,
    ...chartConfig.options
  };

  // Ensure colors don't have # prefix (PptxGenJS requirement)
  if (chartOptions.chartColors) {
    chartOptions.chartColors = chartOptions.chartColors.map(c => 
      c.startsWith('#') ? c.slice(1) : c
    );
  }

  slide.addChart(chartType, chartConfig.data, chartOptions);
  console.log(`[ChartBuilder] Added ${chartConfig.type} chart at (${placeholder.x.toFixed(2)}, ${placeholder.y.toFixed(2)})`);
}

/**
 * Process all charts for a slide
 * @param {object} slide - PptxGenJS slide instance
 * @param {object} pres - PptxGenJS presentation instance
 * @param {Array} charts - Array of chart configurations
 * @param {Array} placeholders - Array of placeholder positions from HTML
 */
function processCharts(slide, pres, charts, placeholders) {
  if (!charts || !Array.isArray(charts) || charts.length === 0) {
    return;
  }

  for (const chartConfig of charts) {
    const placeholder = placeholders.find(p => p.id === chartConfig.placeholderId);
    
    if (!placeholder) {
      console.warn(`[ChartBuilder] Placeholder not found: ${chartConfig.placeholderId}`);
      console.warn(`[ChartBuilder] Available placeholders: ${placeholders.map(p => p.id).join(', ')}`);
      continue;
    }

    addChartToSlide(slide, pres, chartConfig, placeholder);
  }
}

/**
 * Supported chart types reference:
 * - BAR: Vertical bar chart (barDir: 'col') or horizontal (barDir: 'bar')
 * - LINE: Line chart (lineSmooth: true for smooth curves)
 * - PIE: Pie chart (showPercent: true to show percentages)
 * - DOUGHNUT: Doughnut chart
 * - SCATTER: Scatter plot
 * - AREA: Area chart
 * 
 * Chart data format:
 * [{
 *   name: "Series Name",
 *   labels: ["Q1", "Q2", "Q3", "Q4"],
 *   values: [100, 200, 300, 400]
 * }]
 * 
 * Common options:
 * - showTitle: boolean
 * - title: string
 * - showLegend: boolean
 * - legendPos: 'r' | 'l' | 't' | 'b'
 * - chartColors: ["D15635", "2E3952", "D68B60"] (NO # prefix!)
 * - showCatAxisTitle: boolean
 * - catAxisTitle: string
 * - showValAxisTitle: boolean
 * - valAxisTitle: string
 * - valAxisMinVal: number
 * - valAxisMaxVal: number
 */

module.exports = {
  addChartToSlide,
  processCharts
};
