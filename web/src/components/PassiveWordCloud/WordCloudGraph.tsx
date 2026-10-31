'use client';

/**
 * WordCloudGraph.tsx
 * 
 * Nuvem de Palavras - Estilo Mentimeter Definitivo
 * Correções:
 * 1. Colisão Pixel-Perfect: Usa actualBoundingBox do Canvas para medir acentos e descendentes, evitando sobreposições.
 * 2. Regra Vertical Restrita: Apenas palavras únicas (sem espaços) podem ficar na vertical.
 * 3. Espiral Ovalada: Força as frases longas a se distribuírem horizontalmente, acabando com o empilhamento vertical.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { WordFrequency } from '../../types';

export interface WordCloudGraphProps {
  data?: WordFrequency[];
  words?: WordFrequency[];
  width?: number;
  height?: number;
  minFontSize?: number;
  maxFontSize?: number;
  fontFamily?: string;
  colors?: string[];
  maxDisplayWords?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface WordNode {
  id: string;
  text: string;
  count: number;
  fontSize: number;
  targetFontSize: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  targetAlpha: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isVertical: boolean;
  bounds: { left: number; right: number; top: number; bottom: number };
}

const DEFAULT_PALETTE = [
  '#34d399', '#f87171', '#38bdf8', '#fbbf24', '#a78bfa', 
  '#fb7185', '#4ade80', '#c084fc', '#60a5fa'
];

function getHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function WordCloudGraph({
  data,
  words: wordsProp,
  width: customWidth,
  height: customHeight,
  minFontSize = 18,
  maxFontSize = 100,
  fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  colors = DEFAULT_PALETTE,
  maxDisplayWords = 70,
  className = '',
  style = {},
}: WordCloudGraphProps) {
  const words = useMemo(() => data ?? wordsProp ?? [], [data, wordsProp]);
  const wordsStr = useMemo(() => JSON.stringify(words.slice(0, maxDisplayWords)), [words, maxDisplayWords]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const nodesRef = useRef<Map<string, WordNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 800, height: 600 });
  
  const targetScaleRef = useRef<number>(1);
  const currentScaleRef = useRef<number>(0.1); 

  const colorScale = useMemo(() => {
    return d3.scaleOrdinal<string, string>().range(colors);
  }, [colors]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const w = customWidth || Math.max(rect.width, 300);
      const h = customHeight || Math.max(rect.height, 300);
      dimensionsRef.current = { width: w, height: h };

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(() => updateDimensions());
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [customWidth, customHeight]);

  // CÁLCULO FÍSICO E DISTRIBUIÇÃO OVAL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeList: WordFrequency[] = JSON.parse(wordsStr);
    
    if (activeList.length === 0) {
      nodesRef.current.forEach((n) => { n.targetAlpha = 0; });
      return;
    }

    const counts = activeList.map((w) => w.count);
    const maxCount = Math.max(...counts, 1);
    const minCount = Math.min(...counts, 1);

    const currentMap = nodesRef.current;
    const activeKeys = new Set<string>();

    const sortedActiveList = [...activeList].sort((a, b) => b.count - a.count);
    const placedNodes: WordNode[] = [];

    let minLeft = 0, maxRight = 0, minTop = 0, maxBottom = 0;

    sortedActiveList.forEach((item, index) => {
      const key = item.text.toLowerCase();
      activeKeys.add(key);

      const normalizedRatio = maxCount === minCount ? 0.5 : (item.count - minCount) / (maxCount - minCount);
      const targetFontSize = Math.round(minFontSize + normalizedRatio * (maxFontSize - minFontSize));

      ctx.font = `900 ${targetFontSize}px ${fontFamily}`;
      
      // Medição Pixel-Perfect do Canvas: Pega a largura exata e a altura real (incluindo acentos/descendentes)
      const metrics = ctx.measureText(item.text);
      const textWidth = metrics.width;
      
      // Fallback de segurança caso o navegador não suporte actualBoundingBox
      const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const textHeight = (actualHeight && actualHeight > 0) ? actualHeight : targetFontSize * 0.85;

      const wordHash = getHash(key);
      
      // REGRA VERTICAL ESTRITA: Apenas palavras únicas (sem espaço) e curtas podem ficar em pé.
      const isSingleWord = !item.text.includes(' ');
      const isVertical = index > 0 && isSingleWord && item.text.length <= 10 && (wordHash % 100) > 70;

      // Respiro (Padding) garantido entre as palavras para não colar uma na outra
      const padX = 14; 
      const padY = 10; 

      const w = (isVertical ? textHeight : textWidth) + padX;
      const h = (isVertical ? textWidth : textHeight) + padY;

      let t = 0; 
      let targetX = 0;
      let targetY = 0;
      let bounds = { left: 0, right: 0, top: 0, bottom: 0 };
      let hasPlaced = false;

      // Desloca o ângulo inicial para que o centro seja atacado por todos os lados
      const startAngle = (wordHash % 360) * (Math.PI / 180);

      while (!hasPlaced && t < 5000) {
        let r = 1.5 * t; 
        let angle = startAngle + t;

        // O SEGREDO DO TETRIS HORIZONTAL: Multiplicador 1.8 espalha no eixo X (laterais), 
        // e 0.6 espreme no eixo Y. Isso impede o "empilhamento" e cria uma nuvem larga e orgânica.
        targetX = r * Math.cos(angle) * 1.8;
        targetY = r * Math.sin(angle) * 0.6;

        bounds = {
          left: targetX - w / 2,
          right: targetX + w / 2,
          top: targetY - h / 2,
          bottom: targetY + h / 2
        };

        const collision = placedNodes.some(p => {
          return !(bounds.left >= p.bounds.right || bounds.right <= p.bounds.left || 
                   bounds.top >= p.bounds.bottom || bounds.bottom <= p.bounds.top);
        });

        if (!collision) {
          hasPlaced = true;
          if (bounds.left < minLeft) minLeft = bounds.left;
          if (bounds.right > maxRight) maxRight = bounds.right;
          if (bounds.top < minTop) minTop = bounds.top;
          if (bounds.bottom > maxBottom) maxBottom = bounds.bottom;
        } else {
          t += 0.1; // Passo ultra preciso para achar frestas menores
        }
      }

      const existingNode = currentMap.get(key);

      if (existingNode) {
        existingNode.count = item.count;
        existingNode.targetFontSize = targetFontSize;
        existingNode.width = textWidth;
        existingNode.height = textHeight;
        existingNode.targetX = targetX;
        existingNode.targetY = targetY;
        existingNode.isVertical = isVertical;
        existingNode.bounds = bounds;
        existingNode.targetAlpha = 1;
        placedNodes.push(existingNode);
      } else {
        const newNode: WordNode = {
          id: key,
          text: item.text,
          count: item.count,
          fontSize: Math.max(minFontSize, targetFontSize * 0.3),
          targetFontSize,
          width: textWidth,
          height: textHeight,
          color: colorScale(key),
          alpha: 0,
          targetAlpha: 1,
          x: targetX * 0.1, 
          y: targetY * 0.1,
          targetX,
          targetY,
          isVertical,
          bounds,
        };
        currentMap.set(key, newNode);
        placedNodes.push(newNode);
      }
    });

    const cloudTotalWidth = Math.max(maxRight - minLeft, 100);
    const cloudTotalHeight = Math.max(maxBottom - minTop, 100);
    const { width, height } = dimensionsRef.current;
    
    const safeAreaWidth = width * 0.85;
    const safeAreaHeight = height * 0.85;

    let newScale = 1;
    if (cloudTotalWidth > safeAreaWidth || cloudTotalHeight > safeAreaHeight) {
      newScale = Math.min(safeAreaWidth / cloudTotalWidth, safeAreaHeight / cloudTotalHeight);
    }
    targetScaleRef.current = newScale;

    currentMap.forEach((node, key) => {
      if (!activeKeys.has(key)) {
        node.targetAlpha = 0;
      }
    });

  }, [wordsStr, minFontSize, maxFontSize, fontFamily, maxDisplayWords, colorScale]);

  // MOTOR DE ANIMAÇÃO
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const { width, height } = dimensionsRef.current;
      ctx.clearRect(0, 0, width, height);

      const currentMap = nodesRef.current;
      const nodesToDelete: string[] = [];

      currentScaleRef.current += (targetScaleRef.current - currentScaleRef.current) * 0.08;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(currentScaleRef.current, currentScaleRef.current);

      const sortedNodes = Array.from(currentMap.values()).sort((a, b) => a.count - b.count);
      const maxCount = Math.max(...sortedNodes.map((n) => n.count), 1);

      sortedNodes.forEach((node) => {
        node.x += (node.targetX - node.x) * 0.08;
        node.y += (node.targetY - node.y) * 0.08;
        node.fontSize += (node.targetFontSize - node.fontSize) * 0.12;
        node.alpha += (node.targetAlpha - node.alpha) * 0.1;

        if (node.alpha <= 0.02 && node.targetAlpha === 0) {
          nodesToDelete.push(node.id);
          return;
        }

        if (node.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, node.alpha));

        const isProminent = node.count >= maxCount * 0.7 && node.count > 1;

        if (isProminent) {
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 15;
        }

        ctx.font = `900 ${Math.round(node.fontSize)}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = node.color;

        ctx.translate(node.x, node.y);
        if (node.isVertical) {
          ctx.rotate(-Math.PI / 2);
        }
        
        ctx.fillText(node.text, 0, 0);
        ctx.restore();
      });

      ctx.restore();

      if (nodesToDelete.length > 0) {
        nodesToDelete.forEach((id) => currentMap.delete(id));
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [fontFamily]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[60vh] flex items-center justify-center overflow-hidden ${className}`}
      style={{ minHeight: 400, ...style }}
    >
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
      {words.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-slate-500/70">
          <p className="text-sm font-medium animate-pulse tracking-wide">
            Aguardando fala para gerar a nuvem de palavras…
          </p>
        </div>
      )}
    </div>
  );
}