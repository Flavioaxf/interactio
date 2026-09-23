'use client';

/**
 * WordCloudGraph.tsx
 * 
 * Componente de visualização em tempo real de Nuvem de Palavras animada.
 * Utiliza HTML5 Canvas com aceleração gráfica e D3 Force Simulation para
 * calcular dinamicamente colisões, forças atrativas e posicionamento elástico
 * conforme novas palavras são capturadas e suas frequências aumentam.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { WordFrequency } from '../../types';

export interface WordCloudGraphProps {
  /** Lista de palavras com suas frequências */
  words: WordFrequency[];
  /** Largura personalizada (opcional, padrão: 100% do container) */
  width?: number;
  /** Altura personalizada (opcional, padrão: 100% do container) */
  height?: number;
  /** Tamanho mínimo da fonte em pixels */
  minFontSize?: number;
  /** Tamanho máximo da fonte em pixels */
  maxFontSize?: number;
  /** Família tipográfica */
  fontFamily?: string;
  /** Paleta de cores para os termos */
  colors?: string[];
  /** Limite máximo de termos visíveis simultaneamente */
  maxDisplayWords?: number;
  /** Classe CSS do container */
  className?: string;
  /** Estilos inline adicionais */
  style?: React.CSSProperties;
}

interface WordNode extends d3.SimulationNodeDatum {
  id: string;
  text: string;
  count: number;
  fontSize: number;
  targetFontSize: number;
  width: number;
  height: number;
  radius: number;
  color: string;
  alpha: number;
  targetAlpha: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

const DEFAULT_PALETTE = [
  '#a78bfa', // Roxo suave
  '#60a5fa', // Azul céu
  '#34d399', // Esmeralda
  '#fbbf24', // Âmbar
  '#f87171', // Coral
  '#38bdf8', // Ciano
  '#c084fc', // Violeta
  '#4ade80', // Verde menta
  '#fb7185', // Rosa
];

export function WordCloudGraph({
  words,
  width: customWidth,
  height: customHeight,
  minFontSize = 20,
  maxFontSize = 80,
  fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  colors = DEFAULT_PALETTE,
  maxDisplayWords = 70,
  className = '',
  style = {},
}: WordCloudGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Armazena nós persistentes para garantir continuidade das posições e transições orgânicas
  const nodesRef = useRef<Map<string, WordNode>>(new Map());
  const simulationRef = useRef<d3.Simulation<WordNode, undefined> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 800, height: 600 });

  // Escala de cores D3 memorizada
  const colorScale = useMemo(() => {
    return d3.scaleOrdinal<string, string>().range(colors);
  }, [colors]);

  // Inicializa o Canvas e o ResizeObserver
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

      // Atualiza forças de centralização no D3
      if (simulationRef.current) {
        simulationRef.current
          .force('center', d3.forceCenter(w / 2, h / 2).strength(0.08))
          .force('x', d3.forceX(w / 2).strength(0.06))
          .force('y', d3.forceY(h / 2).strength(0.06));
        simulationRef.current.alpha(0.3).restart();
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [customWidth, customHeight]);

  // Configuração da Simulação D3
  useEffect(() => {
    const { width, height } = dimensionsRef.current;

    const simulation = d3
      .forceSimulation<WordNode>([])
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
      .force('x', d3.forceX(width / 2).strength(0.06))
      .force('y', d3.forceY(height / 2).strength(0.06))
      .force(
        'collide',
        d3
          .forceCollide<WordNode>((d) => d.radius + 6)
          .strength(0.9)
          .iterations(2)
      )
      .force(
        'charge',
        d3
          .forceManyBody<WordNode>()
          .strength((d) => -d.radius * 2)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, []);

  // Atualização dos nós conforme as palavras mudam
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeList = words.slice(0, maxDisplayWords);
    if (activeList.length === 0) {
      nodesRef.current.forEach((n) => {
        n.targetAlpha = 0;
      });
      if (simulationRef.current) {
        simulationRef.current.alpha(0.2).restart();
      }
      return;
    }

    const counts = activeList.map((w) => w.count);
    const maxCount = Math.max(...counts, 1);
    const minCount = Math.min(...counts, 1);

    const { width, height } = dimensionsRef.current;
    const currentMap = nodesRef.current;
    const activeKeys = new Set<string>();

    activeList.forEach((item) => {
      const key = item.text.toLowerCase();
      activeKeys.add(key);

      // Interpolação de tamanho da fonte baseada na frequência
      const normalizedRatio =
        maxCount === minCount ? 0.5 : (item.count - minCount) / (maxCount - minCount);
      const targetFontSize = Math.round(
        minFontSize + normalizedRatio * (maxFontSize - minFontSize)
      );

      // Medição precisa do raio de colisão baseado no canvas
      ctx.font = `bold ${targetFontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(item.text);
      const textWidth = metrics.width;
      const textHeight = targetFontSize;
      const radius = Math.sqrt(Math.pow(textWidth / 2, 2) + Math.pow(textHeight / 2, 2)) + 4;

      const existingNode = currentMap.get(key);

      if (existingNode) {
        // Atualiza propriedades preservando posição e velocidade
        existingNode.count = item.count;
        existingNode.targetFontSize = targetFontSize;
        existingNode.width = textWidth;
        existingNode.height = textHeight;
        existingNode.radius = radius;
        existingNode.targetAlpha = 1;
      } else {
        // Novo termo: surge do centro com leve dispersão aleatória
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 40;
        const initialX = width / 2 + Math.cos(angle) * distance;
        const initialY = height / 2 + Math.sin(angle) * distance;

        const newNode: WordNode = {
          id: key,
          text: item.text,
          count: item.count,
          fontSize: Math.max(minFontSize, targetFontSize * 0.3),
          targetFontSize,
          width: textWidth,
          height: textHeight,
          radius,
          color: colorScale(key),
          alpha: 0,
          targetAlpha: 1,
          x: initialX,
          y: initialY,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
        };

        currentMap.set(key, newNode);
      }
    });

    // Termos que saíram da lista realizam fade out gradual
    currentMap.forEach((node, key) => {
      if (!activeKeys.has(key)) {
        node.targetAlpha = 0;
      }
    });

    // Atualiza nós da simulação D3
    if (simulationRef.current) {
      const nodeList = Array.from(currentMap.values());
      simulationRef.current.nodes(nodeList);
      simulationRef.current.alpha(0.35).restart();
    }
  }, [words, minFontSize, maxFontSize, fontFamily, maxDisplayWords, colorScale]);

  // Loop contínuo de renderização via RequestAnimationFrame
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

      // Converte e ordena nós por contagem para que os termos maiores sobreponham os menores
      const sortedNodes = Array.from(currentMap.values()).sort(
        (a, b) => a.count - b.count
      );

      const maxCount = Math.max(...sortedNodes.map((n) => n.count), 1);

      sortedNodes.forEach((node) => {
        // Transição suave de fonte (lerp)
        node.fontSize += (node.targetFontSize - node.fontSize) * 0.12;

        // Transição suave de transparência (fade in / fade out)
        node.alpha += (node.targetAlpha - node.alpha) * 0.1;

        if (node.alpha <= 0.02 && node.targetAlpha === 0) {
          nodesToDelete.push(node.id);
          return;
        }

        if (node.alpha <= 0 || node.x == null || node.y == null) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, node.alpha));

        const isProminent = node.count >= maxCount * 0.7 && node.count > 1;

        // Efeito de brilho neon nos termos dominantes
        if (isProminent) {
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 14;
        }

        ctx.font = `700 ${Math.round(node.fontSize)}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = node.color;

        ctx.fillText(node.text, node.x, node.y);
        ctx.restore();
      });

      // Remove definitivamente nós expirados
      if (nodesToDelete.length > 0) {
        nodesToDelete.forEach((id) => currentMap.delete(id));
        if (simulationRef.current) {
          simulationRef.current.nodes(Array.from(currentMap.values()));
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [fontFamily]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}
      style={{ minHeight: 350, ...style }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full pointer-events-none"
      />
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
