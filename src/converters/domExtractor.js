/**
 * DOM Extractor - Extract slide data from HTML using Playwright
 * Ported from html2pptx skill with full feature support
 */

/**
 * Extract slide data from a Playwright page
 * @param {Page} page - Playwright page instance
 * @returns {Promise<{background, elements, placeholders, errors}>}
 */
async function extractSlideData(page) {
  return await page.evaluate(() => {
    const PT_PER_PX = 0.75;
    const PX_PER_IN = 96;

    // Fonts that are single-weight and should not have bold applied
    const SINGLE_WEIGHT_FONTS = ['impact'];

    // Helper: Check if a font should skip bold formatting
    const shouldSkipBold = (fontFamily) => {
      if (!fontFamily) return false;
      const normalizedFont = fontFamily.toLowerCase().replace(/['"]/g, '').split(',')[0].trim();
      return SINGLE_WEIGHT_FONTS.includes(normalizedFont);
    };

    // Unit conversion helpers
    const pxToInch = (px) => px / PX_PER_IN;
    const pxToPoints = (pxStr) => parseFloat(pxStr) * PT_PER_PX;
    const rgbToHex = (rgbStr) => {
      if (rgbStr === 'rgba(0, 0, 0, 0)' || rgbStr === 'transparent') return 'FFFFFF';
      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return 'FFFFFF';
      return match.slice(1).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    };

    const extractAlpha = (rgbStr) => {
      const match = rgbStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (!match || !match[4]) return null;
      return Math.round((1 - parseFloat(match[4])) * 100);
    };

    const applyTextTransform = (text, textTransform) => {
      if (textTransform === 'uppercase') return text.toUpperCase();
      if (textTransform === 'lowercase') return text.toLowerCase();
      if (textTransform === 'capitalize') return text.replace(/\b\w/g, c => c.toUpperCase());
      return text;
    };

    // Extract rotation angle from CSS transform and writing-mode
    const getRotation = (transform, writingMode) => {
      let angle = 0;

      // Handle writing-mode first
      if (writingMode === 'vertical-rl') {
        angle = 90;
      } else if (writingMode === 'vertical-lr') {
        angle = 270;
      }

      // Then add any transform rotation
      if (transform && transform !== 'none') {
        const rotateMatch = transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
        if (rotateMatch) {
          angle += parseFloat(rotateMatch[1]);
        } else {
          const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
          if (matrixMatch) {
            const values = matrixMatch[1].split(',').map(parseFloat);
            const matrixAngle = Math.atan2(values[1], values[0]) * (180 / Math.PI);
            angle += Math.round(matrixAngle);
          }
        }
      }

      // Normalize to 0-359 range
      angle = angle % 360;
      if (angle < 0) angle += 360;

      return angle === 0 ? null : angle;
    };

    // Get position/dimensions accounting for rotation
    const getPositionAndSize = (el, rect, rotation) => {
      if (rotation === null) {
        return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
      }

      const isVertical = rotation === 90 || rotation === 270;

      if (isVertical) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        return {
          x: centerX - rect.height / 2,
          y: centerY - rect.width / 2,
          w: rect.height,
          h: rect.width
        };
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return {
        x: centerX - el.offsetWidth / 2,
        y: centerY - el.offsetHeight / 2,
        w: el.offsetWidth,
        h: el.offsetHeight
      };
    };

    // Parse CSS box-shadow into PptxGenJS shadow properties
    const parseBoxShadow = (boxShadow) => {
      if (!boxShadow || boxShadow === 'none') return null;

      const insetMatch = boxShadow.match(/inset/);
      if (insetMatch) return null; // PowerPoint doesn't support inset shadows

      const colorMatch = boxShadow.match(/rgba?\([^)]+\)/);
      const parts = boxShadow.match(/([-\d.]+)(px|pt)/g);

      if (!parts || parts.length < 2) return null;

      const offsetX = parseFloat(parts[0]);
      const offsetY = parseFloat(parts[1]);
      const blur = parts.length > 2 ? parseFloat(parts[2]) : 0;

      let angle = 0;
      if (offsetX !== 0 || offsetY !== 0) {
        angle = Math.atan2(offsetY, offsetX) * (180 / Math.PI);
        if (angle < 0) angle += 360;
      }

      const offset = Math.sqrt(offsetX * offsetX + offsetY * offsetY) * PT_PER_PX;

      let opacity = 0.5;
      if (colorMatch) {
        const opacityMatch = colorMatch[0].match(/[\d.]+\)$/);
        if (opacityMatch) {
          opacity = parseFloat(opacityMatch[0].replace(')', ''));
        }
      }

      return {
        type: 'outer',
        angle: Math.round(angle),
        blur: blur * 0.75,
        color: colorMatch ? rgbToHex(colorMatch[0]) : '000000',
        offset: offset,
        opacity
      };
    };

    // Collect validation errors
    const errors = [];

    // Parse inline formatting tags (<b>, <i>, <u>, <strong>, <em>, <span>) into text runs
    const parseInlineFormatting = (element, baseOptions = {}) => {
      const runs = [];
      element.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.replace(/\s+/g, ' ');
          runs.push({ text, options: { ...baseOptions } });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          let text = node.textContent.trim();
          if (text) {
            const options = { ...baseOptions };
            const computed = window.getComputedStyle(node);

            // Check for bold from tag or CSS
            if (node.tagName === 'B' || node.tagName === 'STRONG') {
              if (!shouldSkipBold(computed.fontFamily)) options.bold = true;
            }
            if (node.tagName === 'I' || node.tagName === 'EM') options.italic = true;
            if (node.tagName === 'U') options.underline = true;

            // Handle inline elements with computed styles
            if (['SPAN', 'B', 'STRONG', 'I', 'EM', 'U'].includes(node.tagName)) {
              const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
              if (isBold && !shouldSkipBold(computed.fontFamily)) options.bold = true;
              if (computed.fontStyle === 'italic') options.italic = true;
              if (computed.textDecoration && computed.textDecoration.includes('underline')) options.underline = true;
              if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
                options.color = rgbToHex(computed.color);
                const transparency = extractAlpha(computed.color);
                if (transparency !== null) options.transparency = transparency;
              }
              if (computed.fontSize) options.fontSize = pxToPoints(computed.fontSize);

              if (computed.textTransform && computed.textTransform !== 'none') {
                text = applyTextTransform(text, computed.textTransform);
              }

              // Validate: Check for margins on inline elements
              if (computed.marginLeft && parseFloat(computed.marginLeft) > 0) {
                errors.push(`Inline element <${node.tagName.toLowerCase()}> has margin-left which is not supported.`);
              }
            }

            runs.push({ text, options });
          }
        }
      });

      // Trim leading/trailing spaces
      if (runs.length > 0) {
        runs[0].text = runs[0].text.replace(/^\s+/, '');
        runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
      }

      return runs.filter(r => r.text.length > 0);
    };

    // Extract background from body
    const body = document.body;
    const bodyStyle = window.getComputedStyle(body);
    const bgImage = bodyStyle.backgroundImage;
    const bgColor = bodyStyle.backgroundColor;

    // Validate: Check for <br> tags
    const brTags = document.querySelectorAll('br');
    if (brTags.length > 0) {
      errors.push('<br> tags are not allowed. Use separate <p>, <h1>-<h6>, or <li> elements instead.');
    }

    // Check for CSS gradients
    if (bgImage && (bgImage.includes('linear-gradient') || bgImage.includes('radial-gradient'))) {
      errors.push('CSS gradients are not supported. Use solid colors or pre-rendered images.');
    }

    let background;
    if (bgImage && bgImage !== 'none' && !bgImage.includes('gradient')) {
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        background = { type: 'image', path: urlMatch[1] };
      } else {
        background = { type: 'color', value: rgbToHex(bgColor) };
      }
    } else {
      background = { type: 'color', value: rgbToHex(bgColor) };
    }

    const elements = [];
    const placeholders = [];
    const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI'];
    const processed = new Set();

    document.querySelectorAll('*').forEach((el) => {
      if (processed.has(el)) return;

      // Validate text elements don't have backgrounds, borders, or shadows
      if (textTags.includes(el.tagName)) {
        const computed = window.getComputedStyle(el);
        const hasBg = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
        const hasBorder = (computed.borderWidth && parseFloat(computed.borderWidth) > 0) ||
                          (computed.borderTopWidth && parseFloat(computed.borderTopWidth) > 0);
        const hasShadow = computed.boxShadow && computed.boxShadow !== 'none';

        if (hasBg || hasBorder || hasShadow) {
          errors.push(`Text element <${el.tagName.toLowerCase()}> has ${hasBg ? 'background' : hasBorder ? 'border' : 'shadow'}. Use <div> for shapes.`);
          return;
        }
      }

      // Extract placeholders
      if (el.className && el.className.includes && el.className.includes('placeholder')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          placeholders.push({
            id: el.id || `placeholder-${placeholders.length}`,
            x: pxToInch(rect.left),
            y: pxToInch(rect.top),
            w: pxToInch(rect.width),
            h: pxToInch(rect.height)
          });
        }
        processed.add(el);
        return;
      }

      // Extract images
      if (el.tagName === 'IMG') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          elements.push({
            type: 'image',
            src: el.src,
            position: {
              x: pxToInch(rect.left),
              y: pxToInch(rect.top),
              w: pxToInch(rect.width),
              h: pxToInch(rect.height)
            }
          });
          processed.add(el);
        }
        return;
      }

      // Extract DIVs - both as shapes (with bg/border) AND as text containers
      if (el.tagName === 'DIV') {
        const computed = window.getComputedStyle(el);
        const hasBg = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Check for background images on shapes
        const divBgImage = computed.backgroundImage;
        if (divBgImage && divBgImage !== 'none' && !divBgImage.includes('gradient')) {
          errors.push('Background images on DIV elements are not supported. Use solid colors or borders.');
          return;
        }

        // Check for borders - both uniform and partial
        const borderTop = computed.borderTopWidth;
        const borderRight = computed.borderRightWidth;
        const borderBottom = computed.borderBottomWidth;
        const borderLeft = computed.borderLeftWidth;
        const borders = [borderTop, borderRight, borderBottom, borderLeft].map(b => parseFloat(b) || 0);
        const hasBorder = borders.some(b => b > 0);
        const hasUniformBorder = hasBorder && borders.every(b => b === borders[0]);
        const borderLines = [];

        if (hasBorder && !hasUniformBorder) {
          const x = pxToInch(rect.left);
          const y = pxToInch(rect.top);
          const w = pxToInch(rect.width);
          const h = pxToInch(rect.height);

          // Collect lines for partial borders
          if (parseFloat(borderTop) > 0) {
            const widthPt = pxToPoints(borderTop);
            const inset = (widthPt / 72) / 2;
            borderLines.push({
              type: 'line',
              x1: x, y1: y + inset, x2: x + w, y2: y + inset,
              width: widthPt,
              color: rgbToHex(computed.borderTopColor)
            });
          }
          if (parseFloat(borderRight) > 0) {
            const widthPt = pxToPoints(borderRight);
            const inset = (widthPt / 72) / 2;
            borderLines.push({
              type: 'line',
              x1: x + w - inset, y1: y, x2: x + w - inset, y2: y + h,
              width: widthPt,
              color: rgbToHex(computed.borderRightColor)
            });
          }
          if (parseFloat(borderBottom) > 0) {
            const widthPt = pxToPoints(borderBottom);
            const inset = (widthPt / 72) / 2;
            borderLines.push({
              type: 'line',
              x1: x, y1: y + h - inset, x2: x + w, y2: y + h - inset,
              width: widthPt,
              color: rgbToHex(computed.borderBottomColor)
            });
          }
          if (parseFloat(borderLeft) > 0) {
            const widthPt = pxToPoints(borderLeft);
            const inset = (widthPt / 72) / 2;
            borderLines.push({
              type: 'line',
              x1: x + inset, y1: y, x2: x + inset, y2: y + h,
              width: widthPt,
              color: rgbToHex(computed.borderLeftColor)
            });
          }
        }

        // Extract text content from DIV (direct text nodes and child elements without their own extraction)
        const extractDivText = (element) => {
          let textContent = '';
          for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              textContent += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              // Include text from inline elements and divs that won't be separately processed
              const tag = node.tagName;
              if (['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'A'].includes(tag)) {
                textContent += node.textContent;
              }
            }
          }
          return textContent.trim();
        };

        const divText = extractDivText(el);
        const hasText = divText.length > 0;

        // Check if this DIV only contains other DIVs or text elements (container DIV)
        const hasOnlyContainerChildren = Array.from(el.children).every(child => 
          ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'IMG'].includes(child.tagName)
        );
        const isContainerDiv = !hasText && hasOnlyContainerChildren && el.children.length > 0;

        // Skip container DIVs (they just hold other elements)
        if (isContainerDiv && !hasBg && !hasBorder) {
          return;
        }

        if (hasBg || hasBorder) {
          const shadow = parseBoxShadow(computed.boxShadow);

          // Only add shape if there's background or uniform border
          if (hasBg || hasUniformBorder) {
            const radiusValue = parseFloat(computed.borderRadius) || 0;
            elements.push({
              type: 'shape',
              text: '',
              position: {
                x: pxToInch(rect.left),
                y: pxToInch(rect.top),
                w: pxToInch(rect.width),
                h: pxToInch(rect.height)
              },
              shape: {
                fill: hasBg ? rgbToHex(computed.backgroundColor) : null,
                transparency: hasBg ? extractAlpha(computed.backgroundColor) : null,
                line: hasUniformBorder ? {
                  color: rgbToHex(computed.borderColor),
                  width: pxToPoints(computed.borderWidth)
                } : null,
                rectRadius: (() => {
                  if (radiusValue === 0) return 0;
                  const radius = computed.borderRadius;
                  if (radius.includes('%')) {
                    if (radiusValue >= 50) return 1;
                    const minDim = Math.min(rect.width, rect.height);
                    return (radiusValue / 100) * pxToInch(minDim);
                  }
                  if (radius.includes('pt')) return radiusValue / 72;
                  return radiusValue / PX_PER_IN;
                })(),
                shadow: shadow
              }
            });
          }

          // Add partial border lines
          elements.push(...borderLines);
        }

        // If DIV has direct text content, extract it as a text element
        if (hasText) {
          const rotation = getRotation(computed.transform, computed.writingMode);
          const { x, y, w, h } = getPositionAndSize(el, rect, rotation);

          const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
          const baseStyle = {
            fontSize: pxToPoints(computed.fontSize),
            fontFace: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
            color: rgbToHex(computed.color),
            bold: isBold && !shouldSkipBold(computed.fontFamily),
            italic: computed.fontStyle === 'italic',
            align: computed.textAlign === 'start' ? 'left' : computed.textAlign,
            valign: (() => {
              const justify = computed.justifyContent;
              const align = computed.alignItems;
              if (justify === 'center' || align === 'center') return 'middle';
              if (justify === 'flex-end' || align === 'flex-end') return 'bottom';
              return 'top';
            })(),
            lineSpacing: computed.lineHeight && computed.lineHeight !== 'normal' ? pxToPoints(computed.lineHeight) : null,
            margin: [
              pxToPoints(computed.paddingLeft),
              pxToPoints(computed.paddingRight),
              pxToPoints(computed.paddingBottom),
              pxToPoints(computed.paddingTop)
            ]
          };

          const transparency = extractAlpha(computed.color);
          if (transparency !== null) baseStyle.transparency = transparency;
          if (rotation !== null) baseStyle.rotate = rotation;

          // Check for inline formatting
          const hasFormatting = el.querySelector('b, i, u, strong, em, span');

          if (hasFormatting) {
            const runs = parseInlineFormatting(el, {});
            elements.push({
              type: 'text',
              runs: runs,
              position: { x: pxToInch(x), y: pxToInch(y), w: pxToInch(w), h: pxToInch(h) },
              style: baseStyle
            });
          } else {
            // Apply text transform
            const finalText = applyTextTransform(divText, computed.textTransform);
            elements.push({
              type: 'text',
              text: finalText,
              position: { x: pxToInch(x), y: pxToInch(y), w: pxToInch(w), h: pxToInch(h) },
              style: baseStyle
            });
          }
        }

        processed.add(el);
        return;
      }

      // Extract bullet lists
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const liElements = Array.from(el.querySelectorAll('li'));
        const items = [];
        const ulComputed = window.getComputedStyle(el);
        const ulPaddingLeftPt = pxToPoints(ulComputed.paddingLeft);

        const marginLeft = ulPaddingLeftPt * 0.5;
        const textIndent = ulPaddingLeftPt * 0.5;

        liElements.forEach((li, idx) => {
          const isLast = idx === liElements.length - 1;
          const hasFormatting = li.querySelector('b, i, u, strong, em, span');

          if (hasFormatting) {
            const runs = parseInlineFormatting(li, { breakLine: false });
            if (runs.length > 0) {
              runs[0].text = runs[0].text.replace(/^[•\-\*▪▸]\s*/, '');
              runs[0].options.bullet = { indent: textIndent };
            }
            if (runs.length > 0 && !isLast) {
              runs[runs.length - 1].options.breakLine = true;
            }
            items.push(...runs);
          } else {
            const liText = li.textContent.trim().replace(/^[•\-\*▪▸]\s*/, '');
            items.push({
              text: liText,
              options: { bullet: { indent: textIndent }, breakLine: !isLast }
            });
          }
        });

        const computed = window.getComputedStyle(liElements[0] || el);
        elements.push({
          type: 'list',
          items: items,
          position: {
            x: pxToInch(rect.left),
            y: pxToInch(rect.top),
            w: pxToInch(rect.width),
            h: pxToInch(rect.height)
          },
          style: {
            fontSize: pxToPoints(computed.fontSize),
            fontFace: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
            color: rgbToHex(computed.color),
            transparency: extractAlpha(computed.color),
            align: computed.textAlign === 'start' ? 'left' : computed.textAlign,
            lineSpacing: computed.lineHeight && computed.lineHeight !== 'normal' ? pxToPoints(computed.lineHeight) : null,
            paraSpaceBefore: 0,
            paraSpaceAfter: pxToPoints(computed.marginBottom),
            margin: [marginLeft, 0, 0, 0]
          }
        });

        liElements.forEach(li => processed.add(li));
        processed.add(el);
        return;
      }

      // Extract text elements (P, H1, H2, etc.)
      if (!textTags.includes(el.tagName)) return;

      const rect = el.getBoundingClientRect();
      const text = el.textContent.trim();
      if (rect.width === 0 || rect.height === 0 || !text) return;

      // Validate: Check for manual bullet symbols
      if (el.tagName !== 'LI' && /^[•\-\*▪▸○●◆◇■□]\s/.test(text.trimStart())) {
        errors.push(`Text element <${el.tagName.toLowerCase()}> starts with bullet symbol. Use <ul> or <ol> lists instead.`);
        return;
      }

      const computed = window.getComputedStyle(el);
      const rotation = getRotation(computed.transform, computed.writingMode);
      const { x, y, w, h } = getPositionAndSize(el, rect, rotation);

      const baseStyle = {
        fontSize: pxToPoints(computed.fontSize),
        fontFace: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
        color: rgbToHex(computed.color),
        align: computed.textAlign === 'start' ? 'left' : computed.textAlign,
        lineSpacing: pxToPoints(computed.lineHeight),
        paraSpaceBefore: pxToPoints(computed.marginTop),
        paraSpaceAfter: pxToPoints(computed.marginBottom),
        margin: [
          pxToPoints(computed.paddingLeft),
          pxToPoints(computed.paddingRight),
          pxToPoints(computed.paddingBottom),
          pxToPoints(computed.paddingTop)
        ]
      };

      const transparency = extractAlpha(computed.color);
      if (transparency !== null) baseStyle.transparency = transparency;

      if (rotation !== null) baseStyle.rotate = rotation;

      const hasFormatting = el.querySelector('b, i, u, strong, em, span');

      if (hasFormatting) {
        // Text with inline formatting
        const runs = parseInlineFormatting(el);

        // Adjust lineSpacing based on largest fontSize in runs
        const adjustedStyle = { ...baseStyle };
        if (adjustedStyle.lineSpacing) {
          const maxFontSize = Math.max(
            adjustedStyle.fontSize,
            ...runs.map(r => r.options?.fontSize || 0)
          );
          if (maxFontSize > adjustedStyle.fontSize) {
            const lineHeightMultiplier = adjustedStyle.lineSpacing / adjustedStyle.fontSize;
            adjustedStyle.lineSpacing = maxFontSize * lineHeightMultiplier;
          }
        }

        const textTransform = computed.textTransform;
        const transformedRuns = runs.map(run => ({
          ...run,
          text: applyTextTransform(run.text, textTransform)
        }));

        elements.push({
          type: el.tagName.toLowerCase(),
          text: transformedRuns,
          position: { x: pxToInch(x), y: pxToInch(y), w: pxToInch(w), h: pxToInch(h) },
          style: adjustedStyle
        });
      } else {
        // Plain text - inherit CSS formatting
        const textTransform = computed.textTransform;
        const transformedText = applyTextTransform(text, textTransform);

        const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;

        elements.push({
          type: el.tagName.toLowerCase(),
          text: transformedText,
          position: { x: pxToInch(x), y: pxToInch(y), w: pxToInch(w), h: pxToInch(h) },
          style: {
            ...baseStyle,
            bold: isBold && !shouldSkipBold(computed.fontFamily),
            italic: computed.fontStyle === 'italic',
            underline: computed.textDecoration.includes('underline')
          }
        });
      }

      processed.add(el);
    });

    return { background, elements, placeholders, errors };
  });
}

/**
 * Extract slide data with scaling for flexible conversion
 * @param {Page} page - Playwright page instance
 * @param {number} targetWidth - Target width in pixels
 * @param {number} targetHeight - Target height in pixels
 * @returns {Promise<{background, elements}>}
 */
async function extractSlideDataFlexible(page, targetWidth, targetHeight) {
  return await page.evaluate(({ targetW, targetH }) => {
    const PT_PER_PX = 0.75;
    const PX_PER_IN = 96;

    const pxToInch = (px) => px / PX_PER_IN;
    const pxToPoints = (pxStr) => parseFloat(pxStr) * PT_PER_PX;
    const rgbToHex = (rgbStr) => {
      if (rgbStr === 'rgba(0, 0, 0, 0)' || rgbStr === 'transparent') return 'FFFFFF';
      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return 'FFFFFF';
      return match.slice(1).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    };

    const applyTextTransform = (text, textTransform) => {
      if (textTransform === 'uppercase') return text.toUpperCase();
      if (textTransform === 'lowercase') return text.toLowerCase();
      if (textTransform === 'capitalize') return text.replace(/\b\w/g, c => c.toUpperCase());
      return text;
    };

    const body = document.body;
    const bodyStyle = window.getComputedStyle(body);
    const bgColor = bodyStyle.backgroundColor;
    const bgImage = bodyStyle.backgroundImage;
    
    // Calculate scale factors
    const bodyRect = body.getBoundingClientRect();
    const scaleX = targetW / bodyRect.width;
    const scaleY = targetH / bodyRect.height;

    let background;
    const hasGradient = bgImage && (bgImage.includes('linear-gradient') || bgImage.includes('radial-gradient'));
    
    if (hasGradient) {
      background = { type: 'gradient', needsCapture: true };
    } else if (bgImage && bgImage !== 'none') {
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        background = { type: 'image', path: urlMatch[1] };
      } else {
        background = { type: 'color', value: rgbToHex(bgColor) };
      }
    } else {
      background = { type: 'color', value: rgbToHex(bgColor) };
    }

    const elements = [];
    const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'SPAN', 'LI'];
    
    // Get all visible text elements
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
    const visited = new Set();
    
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (visited.has(el)) continue;
      
      const tagName = el.tagName;
      if (!textTags.includes(tagName)) continue;
      
      // Get direct text content (not from children)
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join(' ');
      
      if (!directText) continue;
      
      visited.add(el);
      
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      
      // Skip invisible elements
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (rect.width < 5 || rect.height < 5) continue;
      
      elements.push({
        type: 'text',
        text: applyTextTransform(directText, style.textTransform),
        position: {
          x: pxToInch(rect.left * scaleX),
          y: pxToInch(rect.top * scaleY),
          w: pxToInch(rect.width * scaleX),
          h: pxToInch(rect.height * scaleY)
        },
        style: {
          fontSize: pxToPoints(style.fontSize),
          fontFace: style.fontFamily.split(',')[0].replace(/["']/g, '').trim() || 'Arial',
          color: rgbToHex(style.color),
          bold: parseInt(style.fontWeight) >= 700,
          italic: style.fontStyle === 'italic',
          underline: style.textDecorationLine.includes('underline'),
          align: style.textAlign === 'start' ? 'left' : 
                 style.textAlign === 'end' ? 'right' :
                 style.textAlign === 'justify' ? 'left' : style.textAlign,
          lineSpacing: parseFloat(style.lineHeight) / parseFloat(style.fontSize) * 100 || 100
        }
      });
    }

    return { background, elements };
  }, { targetW: targetWidth, targetH: targetHeight });
}

/**
 * Scale elements to fit within slide boundaries
 * Prevents overflow by proportionally scaling all elements when content exceeds slide dimensions
 * 
 * @param {Array} elements - Array of extracted elements with position {x, y, w, h} in inches
 * @param {number} slideWidth - Slide width in inches (default: 10 for 16:9)
 * @param {number} slideHeight - Slide height in inches (default: 5.625 for 16:9)
 * @param {object} options - Optional configuration
 * @returns {Object} - { elements: scaled elements, scale: applied scale factor, wasScaled: boolean }
 */
function scaleElementsToFit(elements, slideWidth = 10, slideHeight = 5.625, options = {}) {
  const {
    margin = 0.2,           // Safety margin in inches
    minScale = 0.5,         // Don't scale below 50%
    scaleFonts = true,      // Also scale font sizes
    centerAfterScale = true // Center content after scaling
  } = options;

  if (!elements || elements.length === 0) {
    return { elements, scale: 1, wasScaled: false };
  }

  const maxX = slideWidth - margin;
  const maxY = slideHeight - margin;

  // Find the bounding box of all elements
  let totalMaxX = 0;
  let totalMaxY = 0;

  elements.forEach(el => {
    if (el.position) {
      const rightEdge = el.position.x + el.position.w;
      const bottomEdge = el.position.y + el.position.h;
      totalMaxX = Math.max(totalMaxX, rightEdge);
      totalMaxY = Math.max(totalMaxY, bottomEdge);
    }
    // Handle line elements
    if (el.type === 'line') {
      totalMaxX = Math.max(totalMaxX, el.x1 || 0, el.x2 || 0);
      totalMaxY = Math.max(totalMaxY, el.y1 || 0, el.y2 || 0);
    }
  });

  // Calculate scale factors
  const scaleX = totalMaxX > maxX ? maxX / totalMaxX : 1;
  const scaleY = totalMaxY > maxY ? maxY / totalMaxY : 1;
  let scale = Math.min(scaleX, scaleY);

  // Apply minimum scale threshold
  scale = Math.max(scale, minScale);

  // If no scaling needed, return original elements
  if (scale >= 0.99) {
    return { elements, scale: 1, wasScaled: false };
  }

  console.log(`[scaleElementsToFit] Content overflow detected. Bounding box: ${totalMaxX.toFixed(2)}" x ${totalMaxY.toFixed(2)}". Applying scale: ${(scale * 100).toFixed(0)}%`);

  // Scale all elements
  const scaledElements = elements.map(el => {
    const scaled = { ...el };

    // Scale position and dimensions
    if (scaled.position) {
      scaled.position = {
        x: el.position.x * scale,
        y: el.position.y * scale,
        w: el.position.w * scale,
        h: el.position.h * scale
      };
    }

    // Scale line coordinates
    if (scaled.type === 'line') {
      if (scaled.x1 !== undefined) scaled.x1 = el.x1 * scale;
      if (scaled.y1 !== undefined) scaled.y1 = el.y1 * scale;
      if (scaled.x2 !== undefined) scaled.x2 = el.x2 * scale;
      if (scaled.y2 !== undefined) scaled.y2 = el.y2 * scale;
    }

    // Scale font sizes
    if (scaleFonts && scaled.style) {
      scaled.style = { ...el.style };
      if (scaled.style.fontSize) {
        scaled.style.fontSize = el.style.fontSize * scale;
      }
      if (scaled.style.lineSpacing) {
        scaled.style.lineSpacing = el.style.lineSpacing * scale;
      }
    }

    // Scale text style for shapes
    if (scaleFonts && scaled.textStyle) {
      scaled.textStyle = { ...el.textStyle };
      if (scaled.textStyle.fontSize) {
        scaled.textStyle.fontSize = el.textStyle.fontSize * scale;
      }
    }

    // Scale items in lists (they have fontSize in each item)
    if (scaleFonts && scaled.items && Array.isArray(scaled.items)) {
      scaled.items = el.items.map(item => {
        if (item.options && item.options.fontSize) {
          return {
            ...item,
            options: {
              ...item.options,
              fontSize: item.options.fontSize * scale
            }
          };
        }
        return item;
      });
    }

    // Scale text runs (inline formatted text)
    if (scaleFonts && scaled.text && Array.isArray(scaled.text)) {
      scaled.text = el.text.map(run => {
        if (run.options && run.options.fontSize) {
          return {
            ...run,
            options: {
              ...run.options,
              fontSize: run.options.fontSize * scale
            }
          };
        }
        return run;
      });
    }

    return scaled;
  });

  // Center content after scaling if enabled
  if (centerAfterScale) {
    // Calculate new bounding box after scaling
    let scaledMinX = Infinity, scaledMinY = Infinity;
    let scaledMaxX = 0, scaledMaxY = 0;

    scaledElements.forEach(el => {
      if (el.position) {
        scaledMinX = Math.min(scaledMinX, el.position.x);
        scaledMinY = Math.min(scaledMinY, el.position.y);
        scaledMaxX = Math.max(scaledMaxX, el.position.x + el.position.w);
        scaledMaxY = Math.max(scaledMaxY, el.position.y + el.position.h);
      }
      if (el.type === 'line') {
        scaledMinX = Math.min(scaledMinX, el.x1 || 0, el.x2 || 0);
        scaledMinY = Math.min(scaledMinY, el.y1 || 0, el.y2 || 0);
        scaledMaxX = Math.max(scaledMaxX, el.x1 || 0, el.x2 || 0);
        scaledMaxY = Math.max(scaledMaxY, el.y1 || 0, el.y2 || 0);
      }
    });

    // Calculate content dimensions
    const contentWidth = scaledMaxX - scaledMinX;
    const contentHeight = scaledMaxY - scaledMinY;

    // Calculate offsets to center (considering margin)
    const availableWidth = slideWidth - (margin * 2);
    const availableHeight = slideHeight - (margin * 2);
    
    const offsetX = margin + (availableWidth - contentWidth) / 2 - scaledMinX;
    const offsetY = margin + (availableHeight - contentHeight) / 2 - scaledMinY;

    console.log(`[scaleElementsToFit] Centering content. Offset: (${offsetX.toFixed(2)}", ${offsetY.toFixed(2)}")`);

    // Apply offset to center elements
    scaledElements.forEach(el => {
      if (el.position) {
        el.position.x += offsetX;
        el.position.y += offsetY;
      }
      if (el.type === 'line') {
        if (el.x1 !== undefined) el.x1 += offsetX;
        if (el.y1 !== undefined) el.y1 += offsetY;
        if (el.x2 !== undefined) el.x2 += offsetX;
        if (el.y2 !== undefined) el.y2 += offsetY;
      }
    });
  }

  return { elements: scaledElements, scale, wasScaled: true };
}

module.exports = {
  extractSlideData,
  extractSlideDataFlexible,
  scaleElementsToFit
};
