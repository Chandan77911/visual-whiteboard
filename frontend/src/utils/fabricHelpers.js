/**
 * Utility helpers for Fabric.js canvas operations.
 */

/**
 * Serialize canvas to JSON with custom properties
 */
export function serializeCanvas(canvas) {
  if (!canvas) return null;
  return canvas.toJSON(['id', 'contextData', 'objectType']);
}

/**
 * Assign a unique ID to a fabric object
 */
export function assignId(obj) {
  if (!obj.id) {
    obj.id = Math.random().toString(36).slice(2, 9);
  }
  return obj;
}

/**
 * Find a canvas object by its ID
 */
export function findObjectById(canvas, id) {
  if (!canvas || !id) return null;
  return canvas.getObjects().find((o) => o.id === id) || null;
}

/**
 * Get a summary description of all canvas objects (for Architecture Assist)
 */
export function getCanvasSummary(canvas) {
  if (!canvas) return '';
  const objects = canvas.getObjects();
  const parts = objects.map((o) => {
    if (o.type === 'i-text' || o.type === 'text') {
      return `text: "${o.text}"`;
    }
    if (o.type === 'rect') return 'rectangle box';
    if (o.type === 'circle') return 'circle/node';
    if (o.type === 'group') return 'arrow/connection';
    if (o.type === 'path') return 'freehand drawing';
    return o.type;
  });
  return parts.join(', ');
}

/**
 * Export canvas as PNG data URL
 */
export function exportAsPng(canvas) {
  if (!canvas) return null;
  return canvas.toDataURL({ format: 'png', multiplier: 2 });
}

/**
 * Zoom canvas to fit all objects
 */
export function zoomToFit(canvas) {
  if (!canvas) return;
  const objects = canvas.getObjects();
  if (objects.length === 0) return;

  const group = new window.fabric.Group(objects);
  const scaleX = canvas.width / group.width;
  const scaleY = canvas.height / group.height;
  const scale = Math.min(scaleX, scaleY) * 0.85;

  canvas.setZoom(scale);
  canvas.viewportTransform[4] = (canvas.width - group.width * scale) / 2;
  canvas.viewportTransform[5] = (canvas.height - group.height * scale) / 2;
  canvas.renderAll();
  group.destroy();
}
