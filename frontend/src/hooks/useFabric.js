import { useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import useWhiteboardStore from '../store/whiteboardStore';

export function useFabric(canvasElRef) {
  const fabricRef = useRef(null);
  const { setFabricCanvas, setSelectedObject, activeTool, strokeColor, fillColor, strokeWidth, fontSize } =
    useWhiteboardStore();

  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      backgroundColor: '#0f0f13',
      selection: true,
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;
    setFabricCanvas(canvas);

    const resize = () => {
      canvas.setWidth(window.innerWidth - 64);
      canvas.setHeight(window.innerHeight - 48);
      canvas.renderAll();
    };

    setTimeout(resize, 50);
    window.addEventListener('resize', resize);

    canvas.on('selection:created', (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on('selection:updated', (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on('selection:cleared', () => setSelectedObject(null));

    return () => {
      window.removeEventListener('resize', resize);
      canvas.dispose();
      fabricRef.current = null;
      setFabricCanvas(null);
    };
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === 'pen';

    if (activeTool === 'pen') {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }

    canvas.selection = activeTool === 'select';
    canvas.defaultCursor = activeTool === 'text' ? 'text' : activeTool === 'select' ? 'default' : 'crosshair';
  }, [activeTool, strokeColor, strokeWidth]);

  const addRect = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const rect = new fabric.Rect({
      left: 100 + Math.random() * 300,
      top: 100 + Math.random() * 200,
      width: 160,
      height: 100,
      fill: fillColor === 'transparent' ? 'rgba(108,99,255,0.1)' : fillColor,
      stroke: strokeColor,
      strokeWidth,
      rx: 8,
      ry: 8,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    return rect;
  }, [fillColor, strokeColor, strokeWidth]);

  const addCircle = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const circle = new fabric.Circle({
      left: 150 + Math.random() * 200,
      top: 150 + Math.random() * 150,
      radius: 60,
      fill: fillColor === 'transparent' ? 'rgba(108,99,255,0.1)' : fillColor,
      stroke: strokeColor,
      strokeWidth,
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    return circle;
  }, [fillColor, strokeColor, strokeWidth]);

  const addText = useCallback((text = 'Double click to edit') => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const iText = new fabric.IText(text, {
      left: 200 + Math.random() * 200,
      top: 150 + Math.random() * 150,
      fontSize,
      fill: strokeColor,
      fontFamily: 'sans-serif',
    });
    canvas.add(iText);
    canvas.setActiveObject(iText);
    canvas.renderAll();
    return iText;
  }, [fontSize, strokeColor]);

  const addArrow = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const line = new fabric.Line([100, 200, 300, 200], {
      stroke: strokeColor,
      strokeWidth: strokeWidth + 1,
      selectable: true,
      evented: true,
    });
    const arrowHead = new fabric.Triangle({
      left: 295,
      top: 193,
      originX: 'center',
      originY: 'center',
      angle: 90,
      width: 16,
      height: 16,
      fill: strokeColor,
    });
    const group = new fabric.Group([line, arrowHead]);
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    return group;
  }, [strokeColor, strokeWidth]);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    active.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = '#0f0f13';
    canvas.renderAll();
  }, []);

  const getJSON = useCallback(() => {
    return fabricRef.current?.toJSON(['id', 'contextData']) || null;
  }, []);

  const loadJSON = useCallback((json) => {
    const canvas = fabricRef.current;
    if (!canvas || !json) return;
    canvas.loadFromJSON(json, () => canvas.renderAll());
  }, []);

  return {
    canvas: fabricRef.current,
    addRect,
    addCircle,
    addText,
    addArrow,
    deleteSelected,
    clearCanvas,
    getJSON,
    loadJSON,
  };
}