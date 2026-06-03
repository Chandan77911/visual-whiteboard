/**
 * Mass Cleanup Algorithm
 * Automatically arranges canvas objects into a clean grid layout.
 */

const PADDING = 24;
const COLS = 3;
const CELL_WIDTH = 200;
const CELL_HEIGHT = 140;
const START_X = 60;
const START_Y = 60;

/**
 * Rearranges all fabric canvas objects into a tidy grid.
 * @param {fabric.Canvas} canvas
 */
export function massCleanup(canvas) {
  if (!canvas) return;

  const objects = canvas.getObjects().filter((o) => o.selectable !== false);
  if (objects.length === 0) return;

  // Group by type for smarter arrangement
  const texts = objects.filter((o) => o.type === 'i-text' || o.type === 'text');
  const shapes = objects.filter(
    (o) => o.type === 'rect' || o.type === 'circle' || o.type === 'ellipse'
  );
  const others = objects.filter(
    (o) => !texts.includes(o) && !shapes.includes(o)
  );

  const ordered = [...shapes, ...texts, ...others];

  ordered.forEach((obj, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);

    const targetLeft = START_X + col * (CELL_WIDTH + PADDING);
    const targetTop = START_Y + row * (CELL_HEIGHT + PADDING);

    // Animate to new position
    obj.animate('left', targetLeft, {
      duration: 400,
      easing: easeOutCubic,
      onChange: canvas.renderAll.bind(canvas),
    });

    obj.animate('top', targetTop, {
      duration: 400,
      easing: easeOutCubic,
      onChange: canvas.renderAll.bind(canvas),
    });

    // Reset rotation for cleanup
    obj.animate('angle', 0, {
      duration: 300,
      easing: easeOutCubic,
      onChange: canvas.renderAll.bind(canvas),
    });
  });

  setTimeout(() => {
    canvas.renderAll();
  }, 450);
}

/**
 * Align selected objects to a grid
 */
export function alignToGrid(canvas, gridSize = 20) {
  if (!canvas) return;
  const objects = canvas.getActiveObjects();
  objects.forEach((obj) => {
    obj.set({
      left: Math.round(obj.left / gridSize) * gridSize,
      top: Math.round(obj.top / gridSize) * gridSize,
    });
    obj.setCoords();
  });
  canvas.renderAll();
}

/**
 * Distribute objects evenly horizontally
 */
export function distributeHorizontally(canvas) {
  if (!canvas) return;
  const objects = canvas.getActiveObjects();
  if (objects.length < 2) return;

  const sorted = [...objects].sort((a, b) => a.left - b.left);
  const first = sorted[0].left;
  const last = sorted[sorted.length - 1].left + sorted[sorted.length - 1].width;
  const totalWidth = sorted.reduce((sum, o) => sum + o.width, 0);
  const gap = (last - first - totalWidth) / (sorted.length - 1);

  let currentX = first;
  sorted.forEach((obj) => {
    obj.set('left', currentX);
    obj.setCoords();
    currentX += obj.width + gap;
  });
  canvas.renderAll();
}

// Easing function
function easeOutCubic(t, b, c, d) {
  t /= d;
  t--;
  return c * (t * t * t + 1) + b;
}
