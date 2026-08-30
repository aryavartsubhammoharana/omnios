import React, { useRef, useEffect } from 'react';

export const ThreadEffectCanvas = () => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({
    x: -1000,
    y: -1000,
    tx: -1000,
    ty: -1000,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Logo image instance
    const logoImg = new Image();
    logoImg.src = '/logo.png';
    let logoLoaded = false;

    // Stitch data structures
    let numStitches = 0;
    let cxArr;
    let cyArr;
    let angleArr;
    let targetAngleArr;
    let lenArr;
    let targetLenArr;
    let baseLenArr;
    let colorBucketIndices;
    let isLogoArr;

    // Distinct quantized color palette for batch rendering
    const paletteColors = [];
    const colorBuckets = [];

    const getPaletteBucketIndex = (r, g, b, a) => {
      const qr = Math.round(r / 24) * 24;
      const qg = Math.round(g / 24) * 24;
      const qb = Math.round(b / 24) * 24;
      const qa = a < 40 ? 0.25 : Math.min(1, +(a / 255).toFixed(2));
      const colorKey = `rgba(${qr},${qg},${qb},${qa})`;

      let idx = paletteColors.indexOf(colorKey);
      if (idx === -1) {
        idx = paletteColors.length;
        paletteColors.push(colorKey);
        colorBuckets.push([]);
      }
      return idx;
    };

    const initStitches = () => {
      if (!canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      paletteColors.length = 0;
      colorBuckets.length = 0;

      // Offscreen canvas for logo sampling
      const offCanvas = document.createElement('canvas');
      offCanvas.width = width;
      offCanvas.height = height;
      const offCtx = offCanvas.getContext('2d');

      if (offCtx) {
        // 1. Dark ambient backdrop
        const bgGrad = offCtx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          20,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.7
        );
        bgGrad.addColorStop(0, '#1a1936');
        bgGrad.addColorStop(0.5, '#101020');
        bgGrad.addColorStop(1, '#07070a');
        offCtx.fillStyle = bgGrad;
        offCtx.fillRect(0, 0, width, height);

        // 2. Draw Large Centered OmniOS Logo (No text, only big prominent logo)
        if (logoLoaded && logoImg.width > 0) {
          // Large scale: 78% of container or up to 480px
          const logoSize = Math.min(width * 0.82, height * 0.78, 480);
          const logoX = (width - logoSize) * 0.5;
          const logoY = (height - logoSize) * 0.5;

          // Vibrant Glowing Aura behind large logo
          const auraGrad = offCtx.createRadialGradient(
            width * 0.5,
            height * 0.5,
            10,
            width * 0.5,
            height * 0.5,
            logoSize * 0.85
          );
          auraGrad.addColorStop(0, 'rgba(99, 102, 241, 0.55)');
          auraGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.28)');
          auraGrad.addColorStop(0.7, 'rgba(139, 92, 246, 0.15)');
          auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          offCtx.fillStyle = auraGrad;
          offCtx.fillRect(logoX - 60, logoY - 60, logoSize + 120, logoSize + 120);

          // Draw Logo Image prominently in center
          offCtx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        }
      }

      let imgData = null;
      try {
        if (offCtx) {
          imgData = offCtx.getImageData(0, 0, width, height);
        }
      } catch (e) {
        console.warn('Canvas pixel sample notice:', e);
      }

      // High-density stitch spacing for rich, clear logo details
      const colSpacing = 11.2;
      const rowSpacing = 5.6;
      const cols = Math.ceil(width / colSpacing) + 2;
      const rows = Math.ceil(height / rowSpacing) + 2;

      numStitches = rows * cols;
      cxArr = new Float32Array(numStitches);
      cyArr = new Float32Array(numStitches);
      angleArr = new Float32Array(numStitches);
      targetAngleArr = new Float32Array(numStitches);
      lenArr = new Float32Array(numStitches);
      targetLenArr = new Float32Array(numStitches);
      baseLenArr = new Float32Array(numStitches);
      colorBucketIndices = new Int16Array(numStitches);
      isLogoArr = new Uint8Array(numStitches);

      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = Math.floor(c * colSpacing + (r % 2 === 0 ? 0 : colSpacing * 0.5));
          const cy = Math.floor(r * rowSpacing);

          let rVal = 12;
          let gVal = 13;
          let bVal = 18;
          let aVal = 255;
          let isLogo = 0;

          if (imgData && cx >= 0 && cx < width && cy >= 0 && cy < height) {
            const pIdx = (cy * width + cx) * 4;
            rVal = imgData.data[pIdx];
            gVal = imgData.data[pIdx + 1];
            bVal = imgData.data[pIdx + 2];
            aVal = imgData.data[pIdx + 3];

            if (rVal > 40 || gVal > 40 || bVal > 50) {
              isLogo = 1;
            }
          }

          const bucket = getPaletteBucketIndex(rVal, gVal, bVal, aVal);
          colorBuckets[bucket].push(idx);

          cxArr[idx] = cx;
          cyArr[idx] = cy;
          angleArr[idx] = 0;
          targetAngleArr[idx] = 0;
          const baseLen = isLogo ? 12.8 : 10.2;
          baseLenArr[idx] = baseLen;
          lenArr[idx] = baseLen;
          targetLenArr[idx] = baseLen;
          colorBucketIndices[idx] = bucket;
          isLogoArr[idx] = isLogo;

          idx++;
        }
      }
    };

    logoImg.onload = () => {
      logoLoaded = true;
      initStitches();
    };

    initStitches();

    const handleResize = () => {
      initStitches();
    };

    window.addEventListener('resize', handleResize);

    const handleMouseEnter = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      mouseRef.current.x = currentX;
      mouseRef.current.y = currentY;
      mouseRef.current.tx = currentX;
      mouseRef.current.ty = currentY;
      mouseRef.current.active = true;
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      if (!mouseRef.current.active) {
        mouseRef.current.x = currentX;
        mouseRef.current.y = currentY;
        mouseRef.current.active = true;
      }
      mouseRef.current.tx = currentX;
      mouseRef.current.ty = currentY;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener('mouseenter', handleMouseEnter, { passive: true });
    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    let time = 0;
    const render = () => {
      time += 0.02;

      const m = mouseRef.current;
      if (m.active) {
        m.x += (m.tx - m.x) * 0.35;
        m.y += (m.ty - m.y) * 0.35;
      }

      const mx = m.x;
      const my = m.y;
      const isMouseActive = m.active;
      const influenceRadius = 160;
      const influenceRadiusSq = influenceRadius * influenceRadius;

      ctx.fillStyle = '#08080c';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < numStitches; i++) {
        const cx = cxArr[i];
        const cy = cyArr[i];

        if (isMouseActive) {
          const dx = cx - mx;
          const dy = cy - my;
          const distSq = dx * dx + dy * dy;

          if (distSq < influenceRadiusSq) {
            const dist = Math.sqrt(distSq);
            const linearT = 1 - dist / influenceRadius;
            const t = linearT * linearT * (3 - 2 * linearT);

            const radialAngle = Math.atan2(dy, dx);
            targetAngleArr[i] = t * radialAngle;
            targetLenArr[i] = baseLenArr[i] * (1 + t * 0.45);
          } else {
            targetAngleArr[i] = 0;
            targetLenArr[i] = baseLenArr[i];
          }
        } else {
          targetAngleArr[i] = Math.sin(time + cx * 0.015 + cy * 0.02) * 0.05;
          targetLenArr[i] = baseLenArr[i];
        }

        angleArr[i] += (targetAngleArr[i] - angleArr[i]) * 0.22;
        lenArr[i] += (targetLenArr[i] - lenArr[i]) * 0.22;
      }

      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';

      for (let b = 0; b < paletteColors.length; b++) {
        const indices = colorBuckets[b];
        if (indices.length === 0) continue;

        ctx.strokeStyle = paletteColors[b];
        ctx.beginPath();

        for (let j = 0; j < indices.length; j++) {
          const i = indices[j];
          const cx = cxArr[i];
          const cy = cyArr[i];
          const halfLen = lenArr[i] * 0.5;
          const ang = angleArr[i];

          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);

          ctx.moveTo(cx - cosA * halfLen, cy - sinA * halfLen);
          ctx.lineTo(cx + cosA * halfLen, cy + sinA * halfLen);
        }

        ctx.stroke();
      }

      if (isMouseActive && mx > 0 && my > 0) {
        const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 140);
        halo.addColorStop(0, 'rgba(129, 140, 248, 0.2)');
        halo.addColorStop(0.6, 'rgba(168, 85, 247, 0.06)');
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(mx - 140, my - 140, 280, 280);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
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

export default ThreadEffectCanvas;
