import React, { useRef, useEffect } from 'react';

export const WaterWaveCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;

    // Simulation grid dimensions (1 cell = 4 screen pixels for 120fps fluid physics)
    const SIM_SCALE = 4;
    let simWidth = 0;
    let simHeight = 0;
    let bufferSize = 0;

    let buffer1;
    let buffer2;
    let currentBuffer;
    let nextBuffer;

    // Natural fluid damping for authentic pond physics (dissipates to stillness in ~1.5s)
    const DAMPING = 0.968;
    const EPSILON = 0.005; // Resting threshold for absolute still water

    // Offscreen logo canvas
    const sourceCanvas = document.createElement('canvas');
    const sourceCtx = sourceCanvas.getContext('2d');
    let sourceData = null;

    // Logo image
    const logoImg = new Image();
    logoImg.src = '/logo.png';
    let logoLoaded = false;

    // Custom Glowing Plus Cursor when near logo
    const PLUS_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='M14 3 L14 25 M3 14 L25 14' stroke='%2338bdf8' stroke-width='2.5' stroke-linecap='round'/><circle cx='14' cy='14' r='2.5' fill='%236366f1'/></svg>") 14 14, crosshair`;

    // Mouse velocity & interaction state
    const mouse = {
      x: -1,
      y: -1,
      prevX: -1,
      prevY: -1,
      active: false,
    };

    const drawSourceTexture = () => {
      if (!sourceCtx || width === 0 || height === 0) return;

      sourceCanvas.width = width;
      sourceCanvas.height = height;

      // 1. Deep Oceanic Calm Backdrop
      const bgGrad = sourceCtx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        10,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.75
      );
      bgGrad.addColorStop(0, '#101528');
      bgGrad.addColorStop(0.5, '#090d18');
      bgGrad.addColorStop(1, '#05070c');
      sourceCtx.fillStyle = bgGrad;
      sourceCtx.fillRect(0, 0, width, height);

      // 2. Large Centered OmniOS Logo (Prominent crisp logo in silent pond)
      if (logoLoaded && logoImg.width > 0) {
        const logoSize = Math.min(width * 0.76, height * 0.76, 460);
        const logoX = (width - logoSize) * 0.5;
        const logoY = (height - logoSize) * 0.5;

        // Radiant calm ambient aura behind logo
        const auraGrad = sourceCtx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          10,
          width * 0.5,
          height * 0.5,
          logoSize * 0.8
        );
        auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        auraGrad.addColorStop(0.45, 'rgba(99, 102, 241, 0.25)');
        auraGrad.addColorStop(0.8, 'rgba(14, 165, 233, 0.08)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sourceCtx.fillStyle = auraGrad;
        sourceCtx.fillRect(logoX - 60, logoY - 60, logoSize + 120, logoSize + 120);

        // Draw Logo
        sourceCtx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      }

      try {
        sourceData = sourceCtx.getImageData(0, 0, width, height);
      } catch (e) {
        console.warn('Water canvas image data read notice:', e);
      }
    };

    const initSimulation = () => {
      if (!canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      width = canvas.width = Math.floor(rect.width);
      height = canvas.height = Math.floor(rect.height);

      simWidth = Math.ceil(width / SIM_SCALE);
      simHeight = Math.ceil(height / SIM_SCALE);
      bufferSize = simWidth * simHeight;

      // Clean zeroed buffers (Primal state = Completely Still Calm Water)
      buffer1 = new Float32Array(bufferSize);
      buffer2 = new Float32Array(bufferSize);
      currentBuffer = buffer1;
      nextBuffer = buffer2;

      drawSourceTexture();
    };

    logoImg.onload = () => {
      logoLoaded = true;
      drawSourceTexture();
    };

    initSimulation();

    const handleResize = () => {
      initSimulation();
    };
    window.addEventListener('resize', handleResize);

    // Disturb water surface ONLY upon user cursor action
    const addDrop = (x, y, radius, strength) => {
      const simX = Math.floor(x / SIM_SCALE);
      const simY = Math.floor(y / SIM_SCALE);
      const simRadius = Math.max(1, Math.floor(radius / SIM_SCALE));

      const minX = Math.max(1, simX - simRadius);
      const maxX = Math.min(simWidth - 2, simX + simRadius);
      const minY = Math.max(1, simY - simRadius);
      const maxY = Math.min(simHeight - 2, simY + simRadius);

      const rSq = simRadius * simRadius;

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const dx = px - simX;
          const dy = py - simY;
          const distSq = dx * dx + dy * dy;
          if (distSq <= rSq) {
            const factor = Math.cos((Math.sqrt(distSq) / simRadius) * Math.PI * 0.5);
            currentBuffer[py * simWidth + px] += strength * factor;
          }
        }
      }
    };

    const addDropLine = (x0, y0, x1, y1, radius, strength) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.floor(dist / (SIM_SCALE * 1.5)));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        addDrop(x0 + dx * t, y0 + dy * t, radius, strength);
      }
    };

    const updateCursorState = (x, y) => {
      if (width === 0 || height === 0) return;
      const logoSize = Math.min(width * 0.76, height * 0.76, 460);
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const distFromCenter = Math.hypot(x - centerX, y - centerY);
      const logoRadius = (logoSize * 0.5) * 1.08; // Logo zone

      // When cursor is over or near the logo, transform cursor to PLUS (+)
      if (distFromCenter <= logoRadius) {
        canvas.style.cursor = PLUS_CURSOR;
      } else {
        canvas.style.cursor = 'default';
      }
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      updateCursorState(currentX, currentY);

      if (mouse.active && mouse.prevX >= 0 && mouse.prevY >= 0) {
        const speed = Math.hypot(currentX - mouse.prevX, currentY - mouse.prevY);
        // Wave energy directly proportional to cursor drag
        const strength = Math.min(220, 40 + speed * 3.2);
        const radius = Math.min(30, 15 + speed * 0.35);
        addDropLine(mouse.prevX, mouse.prevY, currentX, currentY, radius, strength);
      } else {
        addDrop(currentX, currentY, 18, 70);
      }

      mouse.prevX = currentX;
      mouse.prevY = currentY;
      mouse.x = currentX;
      mouse.y = currentY;
      mouse.active = true;
    };

    const handleMouseEnter = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      updateCursorState(currentX, currentY);
      mouse.prevX = currentX;
      mouse.prevY = currentY;
      mouse.x = currentX;
      mouse.y = currentY;
      mouse.active = true;
      // Gentle initial surface entry wake
      addDrop(currentX, currentY, 20, 80);
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.prevX = -1;
      mouse.prevY = -1;
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseenter', handleMouseEnter, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    const render = () => {
      if (!sourceData || width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const outputImgData = ctx.createImageData(width, height);
      const outData32 = new Uint32Array(outputImgData.data.buffer);
      const srcData32 = new Uint32Array(sourceData.data.buffer);

      let maxEnergy = 0;

      // -- 1. Discrete 2D Wave Propagation Step --
      for (let y = 1; y < simHeight - 1; y++) {
        const rowOffset = y * simWidth;
        const topRowOffset = (y - 1) * simWidth;
        const bottomRowOffset = (y + 1) * simWidth;

        for (let x = 1; x < simWidth - 1; x++) {
          const idx = rowOffset + x;
          let waveHeight =
            ((currentBuffer[idx - 1] +
              currentBuffer[idx + 1] +
              currentBuffer[topRowOffset + x] +
              currentBuffer[bottomRowOffset + x]) *
              0.5) -
            nextBuffer[idx];

          // Natural liquid viscosity damping
          waveHeight *= DAMPING;

          // Dissipate below threshold to guarantee pristine, crystal-clear resting stillness (Silent Pond)
          if (Math.abs(waveHeight) < EPSILON) {
            waveHeight = 0;
          } else {
            const absH = Math.abs(waveHeight);
            if (absH > maxEnergy) maxEnergy = absH;
          }

          nextBuffer[idx] = waveHeight;
        }
      }

      // Swap buffers
      const temp = currentBuffer;
      currentBuffer = nextBuffer;
      nextBuffer = temp;

      // -- 2. Refraction & Specular Caustics Render --
      const srcW = width;
      const srcH = height;

      // Fast path: If water is completely still, blit pristine un-distorted crystal pond
      if (maxEnergy === 0) {
        outData32.set(srcData32);
      } else {
        for (let y = 0; y < height; y++) {
          const simY = Math.min(simHeight - 2, Math.floor(y / SIM_SCALE));
          const simRow = simY * simWidth;
          const simRowNext = (simY + 1) * simWidth;
          const outRow = y * width;

          for (let x = 0; x < width; x++) {
            const simX = Math.min(simWidth - 2, Math.floor(x / SIM_SCALE));
            const simIdx = simRow + simX;

            const gradX = currentBuffer[simIdx + 1] - currentBuffer[simIdx - 1];
            const gradY = currentBuffer[simRowNext + simX] - currentBuffer[(simY - 1 < 0 ? 0 : simY - 1) * simWidth + simX];

            // If local surface is flat, direct sample
            if (gradX === 0 && gradY === 0) {
              outData32[outRow + x] = srcData32[y * srcW + x];
              continue;
            }

            // Optical surface refraction coordinates
            let refX = Math.floor(x + gradX * 0.85);
            let refY = Math.floor(y + gradY * 0.85);

            if (refX < 0) refX = 0;
            if (refX >= srcW) refX = srcW - 1;
            if (refY < 0) refY = 0;
            if (refY >= srcH) refY = srcH - 1;

            let pixel = srcData32[refY * srcW + refX];

            // Specular caustic wave gleam
            const shading = Math.floor((gradX - gradY) * 1.5);
            if (shading !== 0) {
              let r = pixel & 0xff;
              let g = (pixel >> 8) & 0xff;
              let b = (pixel >> 16) & 0xff;

              r = Math.min(255, Math.max(0, r + shading * 0.65));
              g = Math.min(255, Math.max(0, g + shading * 0.85));
              b = Math.min(255, Math.max(0, b + shading * 1.15));

              pixel = (0xff000000) | (b << 16) | (g << 8) | r;
            }

            outData32[outRow + x] = pixel;
          }
        }
      }

      ctx.putImageData(outputImgData, 0, 0);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
};

export default WaterWaveCanvas;
