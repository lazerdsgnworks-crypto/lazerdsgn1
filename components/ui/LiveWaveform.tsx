import React, { useRef, useEffect } from 'react';

interface LiveWaveformProps {
  active?: boolean;
  processing?: boolean;
  height?: number;
  barWidth?: number;
  barGap?: number;
  mode?: 'static' | 'scrolling';
}

const LiveWaveform: React.FC<LiveWaveformProps> = ({
  active = false,
  processing = false,
  height = 80,
  barWidth = 3,
  barGap = 2,
  mode = 'static',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      animationFrameId.current = requestAnimationFrame(render);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      const width = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, width, h);

      const style = getComputedStyle(document.documentElement);
      const primaryColor = style.getPropertyValue('--text-primary').trim() || '#0f1419';

      ctx.lineWidth = barWidth;
      ctx.strokeStyle = primaryColor;
      ctx.lineCap = 'round';
      
      timeRef.current += 0.05;
      
      const barCount = Math.floor(width / (barWidth + barGap));

      if (mode === 'scrolling') {
        let amplitude;
        if (!active) {
            amplitude = 0;
        } else if (processing) {
            amplitude = (Math.sin(timeRef.current * 2) * 0.4 + 0.6) * (h / 2);
        } else {
            amplitude = (Math.sin(timeRef.current) * 0.1 + 0.2) * (h / 2);
        }
        const newSample = Math.max(2, amplitude * (Math.random() * 0.4 + 0.8));
        historyRef.current.push(newSample);
        if (historyRef.current.length > barCount) {
          historyRef.current.shift();
        }

        for (let i = 0; i < historyRef.current.length; i++) {
            const barHeight = historyRef.current[i];
            const xPos = i * (barWidth + barGap);
            const yPos = (h - barHeight) / 2;
            
            ctx.beginPath();
            ctx.moveTo(xPos, yPos);
            ctx.lineTo(xPos, yPos + barHeight);
            ctx.stroke();
        }

      } else { // Static Mode
         for (let i = 0; i < barCount; i++) {
            const x = i / (barCount - 1);
            
            // Unify the wave function, but vary speed and amplitude based on `processing` state.
            const speed = processing ? 5 : 1.5;
            const amplitude = processing ? 0.9 : 0.5;

            const wave = (Math.sin(x * 10 + timeRef.current * speed) + 1) / 2;
            const amp = active ? amplitude : 0;
            
            const barHeight = Math.max(2, wave * h * amp + h * 0.02);

            const xPos = i * (barWidth + barGap);
            const yPos = (h - barHeight) / 2;

            ctx.beginPath();
            ctx.moveTo(xPos, yPos);
            ctx.lineTo(xPos, yPos + barHeight);
            ctx.stroke();
        }
      }
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [active, processing, mode, height, barWidth, barGap]);

  return <canvas ref={canvasRef} style={{ height: `${height}px`, width: '100%' }} />;
};

export default LiveWaveform;
