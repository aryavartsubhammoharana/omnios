import React, { useEffect, useRef } from 'react';

export default function ThreadFabricCanvas({ containerRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 800);

    const resize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
      initThreads();
    };
    window.addEventListener('resize', resize);

    // Mouse physics tracker with velocity
    const mouse = {
      x: width / 2,
      y: height / 2,
      prevX: width / 2,
      prevY: height / 2,
      vx: 0,
      vy: 0,
      radius: 120,
      active: false
    };

    // Thread & Fabric nodes structure
    const NUM_THREADS = 28;
    const POINTS_PER_THREAD = 32;
    let threads = [];

    const initThreads = () => {
      threads = [];
      const spacingY = height / (NUM_THREADS + 1);

      for (let i = 0; i < NUM_THREADS; i++) {
        const points = [];
        const baseY = spacingY * (i + 1);
        const spacingX = width / (POINTS_PER_THREAD - 1);

        for (let j = 0; j < POINTS_PER_THREAD; j++) {
          const baseX = spacingX * j;
          points.push({
            x: baseX,
            y: baseY,
            originX: baseX,
            originY: baseY,
            vx: 0,
            vy: 0,
            mass: 1.0 + (i % 3) * 0.2
          });
        }
        threads.push({
          points,
          hue: 215 + (i * 4) % 65, // Elegant gradient from Indigo (215) to Electric Cyan (280)
          tension: 0.045,
          damping: 0.88,
          amplitude: 8 + (i % 5) * 2,
          speed: 0.015 + (i % 4) * 0.005,
          phase: i * 0.35
        });
      }
    };

    initThreads();

    const handleMouseMove = (e) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      mouse.vx = (newX - mouse.prevX) * 0.6;
      mouse.vy = (newY - mouse.prevY) * 0.6;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
      mouse.x = newX;
      mouse.y = newY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.vx = 0;
      mouse.vy = 0;
    };

    const targetElem = containerRef?.current || canvas;
    targetElem.addEventListener('mousemove', handleMouseMove);
    targetElem.addEventListener('mouseleave', handleMouseLeave);

    let time = 0;

    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Render Fabric Threads
      for (let tIndex = 0; tIndex < threads.length; tIndex++) {
        const thread = threads[tIndex];
        const pts = thread.points;

        // Physics step for each thread point
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];

          // Natural harmonic wave oscillation (silk flow)
          const naturalWave = Math.sin(time * thread.speed + p.originX * 0.008 + thread.phase) * (thread.amplitude * 0.6);
          const targetY = p.originY + naturalWave;

          // Spring tension returning to equilibrium
          const forceY = (targetY - p.y) * thread.tension;
          const forceX = (p.originX - p.x) * thread.tension;

          p.vy += forceY / p.mass;
          p.vx += forceX / p.mass;

          // Interactive mouse cursor deformation & elastic drag
          if (mouse.active) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < mouse.radius && dist > 0) {
              const influence = (1 - dist / mouse.radius);
              const forceMagnitude = influence * 18;

              // Elastic displacement + drag in mouse velocity direction
              p.vx += (dx / dist) * forceMagnitude * 0.4 + mouse.vx * influence * 0.25;
              p.vy += (dy / dist) * forceMagnitude * 0.8 + mouse.vy * influence * 0.35;
            }
          }

          // Apply damping and integrate velocities
          p.vx *= thread.damping;
          p.vy *= thread.damping;
          p.x += p.vx;
          p.y += p.vy;
        }

        // Draw smooth Catmull-Rom or Quadratic Bézier elastic silk curve
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        for (let i = 0; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

        // Dynamic gradient & neon luminescence
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, `hsla(${thread.hue}, 85%, 65%, 0.15)`);
        gradient.addColorStop(0.5, `hsla(${thread.hue + 25}, 90%, 70%, 0.5)`);
        gradient.addColorStop(1, `hsla(${thread.hue + 55}, 95%, 60%, 0.2)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = tIndex % 2 === 0 ? 1.6 : 1.0;
        ctx.shadowColor = `hsla(${thread.hue + 20}, 90%, 65%, 0.4)`;
        ctx.shadowBlur = 6;
        ctx.stroke();
      }

      // Draw subtle vertical cross-stitch threads for authentic fabric weave look
      const crossStrandCount = 14;
      const crossSpacing = width / (crossStrandCount + 1);

      ctx.save();
      for (let c = 0; c < crossStrandCount; c++) {
        const xPos = crossSpacing * (c + 1);
        ctx.beginPath();
        ctx.moveTo(xPos, 0);

        for (let t = 0; t < threads.length; t++) {
          const ptIndex = Math.floor((xPos / width) * (POINTS_PER_THREAD - 1));
          const p = threads[t].points[ptIndex];
          if (p) {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.lineTo(xPos, height);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      targetElem.removeEventListener('mousemove', handleMouseMove);
      targetElem.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
