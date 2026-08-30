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

    // Simulation grid dimensions (scaled down for super fast 60-120fps wave propagation)
    const SIM_SCALE = 4; // 1 simulation cell = 4 screen pixels
    let simWidth = 0;
    let simHeight = 0;
    let bufferSize = 0;

    let buffer1;
    let buffer2;
    let currentBuffer;
    let nextBuffer;

    const DAMPING = 0.982; // High fluidity & sustained gentle ripples

    // Offscreen logo canvas
    const sourceCanvas = document.createElement('canvas');
    const sourceCtx = sourceCanvas.getContext('2d');
    let sourceData = null;

    // Logo image
    const logoImg = new Image();
    logoImg.src = '/logo.png';
    let logoLoaded = false;

    // Mouse velocity & position tracking
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

      // 1. Deep Oceanic Gradient Backdrop
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

      // 2. Large Centered OmniOS Logo
      if (logoLoaded && logoImg.width > 0) {
        const logoSize = Math.min(width * 0.76, height * 0.76, 460);
        const logoX = (width - logoSize) * 0.5;
        const logoY = (height - logoSize) * 0.5;

        // Glowing water-caustic aura behind logo
        const auraGrad = sourceCtx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          10,
          width * 0.5,
          height * 0.5,
          logoSize * 0.8
        );
        auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
        auraGrad.addColorStop(0.4, 'rgba(99, 102, 241, 0.25)');
        auraGrad.addColorStop(0.8, 'rgba(14, 165, 233, 0.08)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sourceCtx.fillStyle = auraGrad;
        sourceCtx.fillRect(logoX - 50, logoY - 50, logoSize + 100, logoSize + 100);

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

    // Disturb water surface along mouse trajectory (Bresenham line interpolation for continuous ripples)
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

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      if (mouse.active && mouse.prevX >= 0 && mouse.prevY >= 0) {
        const speed = Math.hypot(currentX - mouse.prevX, currentY - mouse.prevY);
        // Dynamic wave energy based on cursor velocity
        const strength = Math.min(240, 45 + speed * 3.5);
        const radius = Math.min(32, 16 + speed * 0.4);
        addDropLine(mouse.prevX, mouse.prevY, currentX, currentY, radius, strength);
      } else {
        addDrop(currentX, currentY, 20, 90);
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
      mouse.prevX = currentX;
      mouse.prevY = currentY;
      mouse.x = currentX;
      mouse.y = currentY;
      mouse.active = true;
      addDrop(currentX, currentY, 24, 120);
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.prevX = -1;
      mouse.prevY = -1;
    };

    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseenter', handleMouseEnter, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    let time = 0;

    // Ambient automatic raindrop ripple generator when user is idle
    const ambientRippleInterval = setInterval(() => {
      if (!mouse.active && width > 0 && height > 0) {
        const rx = width * 0.2 + Math.random() * width * 0.6;
        const ry = height * 0.2 + Math.random() * height * 0.6;
        addDrop(rx, ry, 18, 75);
      }
    }, 2400);

    const render = () => {
      time += 1;

      if (!sourceData || width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const outputImgData = ctx.createImageData(width, height);
      const outData32 = new Uint32Array(outputImgData.data.buffer);
      const srcData32 = new Uint32Array(sourceData.data.buffer);

      // -- 1. Wave Physics Step (2D Wave Equation Discrete Wave Equation) --
      for (let y = 1; y < simHeight - 1; y++) {
        const rowOffset = y * simWidth;
        const topRowOffset = (y - 1) * simWidth;
        const bottomRowOffset = (y + 1) * simWidth;

        for (let x = 1; x < simWidth - 1; x++) {
          const idx = rowOffset + x;
          // Standard discrete Laplacian operator
          const waveHeight =
            ((currentBuffer[idx - 1] +
              currentBuffer[idx + 1] +
              currentBuffer[topRowOffset + x] +
              currentBuffer[bottomRowOffset + x]) *
              0.5) -
            nextBuffer[idx];

          nextBuffer[idx] = waveHeight * DAMPING;
        }
      }

      // Swap wave buffers
      const temp = currentBuffer;
      currentBuffer = nextBuffer;
      nextBuffer = temp;

      // -- 2. Optical Refraction & Caustic Render Pass --
      const srcW = width;
      const srcH = height;

      for (let y = 0; y < height; y++) {
        const simY = Math.min(simHeight - 2, Math.floor(y / SIM_SCALE));
        const simRow = simY * simWidth;
        const simRowNext = (simY + 1) * simWidth;

        const outRow = y * width;

        for (let x = 0; x < width; x++) {
          const simX = Math.min(simWidth - 2, Math.floor(x / SIM_SCALE));
          const simIdx = simRow + simX;

          // Compute surface normal gradient (slope of the water wave)
          const gradX = currentBuffer[simIdx + 1] - currentBuffer[simIdx - 1];
          const gradY = currentBuffer[simRowNext + simX] - currentBuffer[(simY - 1 < 0 ? 0 : simY - 1) * simWidth + simX];

          // Refracted sample coordinates on the source texture
          let refX = Math.floor(x + gradX * 0.85);
          let refY = Math.floor(y + gradY * 0.85);

          if (refX < 0) refX = 0;
          if (refX >= srcW) refX = srcW - 1;
          if (refY < 0) refY = 0;
          if (refY >= srcH) refY = srcH - 1;

          // Sample distorted color
          let pixel = srcData32[refY * srcW + refX];

          // Specular caustic water sheen highlight
          const shading = Math.floor((gradX - gradY) * 1.6);
          if (shading !== 0) {
            let r = pixel & 0xff;
            let g = (pixel >> 8) & 0xff;
            let b = (pixel >> 16) & 0xff;

            // Water specular tint (electric cyan & white glint)
            r = Math.min(255, Math.max(0, r + shading * 0.7));
            g = Math.min(255, Math.max(0, g + shading * 0.9));
            b = Math.min(255, Math.max(0, b + shading * 1.2));

            pixel = (0xff000000) | (b << 16) | (g << 8) | r;
          }

          outData32[outRow + x] = pixel;
        }
      }

      ctx.putImageData(outputImgData, 0, 0);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      clearInterval(ambientRippleInterval);
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
        className="w-full h-full block cursor-pointer"
      />
    </div>
  );
};

export default WaterWaveCanvas;
