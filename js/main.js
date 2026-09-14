(() => {
  "use strict";

  const sandbox = document.querySelector(".sandbox");
  const canvas = document.querySelector("#scene");
  const context = canvas.getContext("2d", { alpha: false });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const pointer = {
    x: 0.5,
    y: 0.42,
    targetX: 0.5,
    targetY: 0.42
  };

  const particles = Array.from({ length: 96 }, (_, index) => ({
    angle: ((index * 137.508) % 360) * (Math.PI / 180),
    radius: 0.08 + ((index * 47) % 89) / 100,
    depth: ((index * 29) % 97) / 97,
    speed: 0.04 + ((index * 11) % 17) / 250
  }));

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let hue = 188;
  let frame = 0;
  let previousTime = performance.now();

  function resize() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw(performance.now(), 0);
  }

  function updatePointer(event) {
    pointer.targetX = event.clientX / Math.max(width, 1);
    pointer.targetY = event.clientY / Math.max(height, 1);
  }

  function resetPointer() {
    pointer.targetX = 0.5;
    pointer.targetY = 0.42;
  }

  function drawBackground(vanishingX, horizon) {
    const wash = context.createRadialGradient(
      vanishingX,
      horizon,
      0,
      vanishingX,
      horizon,
      Math.max(width, height) * 0.82
    );

    wash.addColorStop(0, `hsl(${hue} 30% 13%)`);
    wash.addColorStop(0.35, "#090a10");
    wash.addColorStop(1, "#030305");
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);

    const glow = context.createLinearGradient(0, horizon - 40, 0, horizon + 100);
    glow.addColorStop(0, "transparent");
    glow.addColorStop(0.5, `hsl(${hue} 75% 62% / 0.08)`);
    glow.addColorStop(1, "transparent");
    context.fillStyle = glow;
    context.fillRect(0, horizon - 40, width, 140);
  }

  function drawGrid(vanishingX, horizon, elapsed) {
    const lowerHeight = height - horizon;
    const drift = reducedMotion.matches ? 0 : (elapsed * 0.00008) % 1;

    context.save();
    context.lineWidth = 1;

    for (let index = -18; index <= 18; index += 1) {
      const endX = vanishingX + index * Math.max(width / 12, 64);
      const gradient = context.createLinearGradient(vanishingX, horizon, endX, height);
      gradient.addColorStop(0, `hsl(${hue} 80% 68% / 0)`);
      gradient.addColorStop(1, `hsl(${hue} 70% 58% / 0.16)`);
      context.strokeStyle = gradient;
      context.beginPath();
      context.moveTo(vanishingX, horizon);
      context.lineTo(endX, height);
      context.stroke();
    }

    for (let index = 0; index < 24; index += 1) {
      const progress = ((index / 24) + drift) % 1;
      const eased = progress * progress;
      const y = horizon + lowerHeight * eased;
      context.strokeStyle = `hsl(${hue} 70% 62% / ${0.02 + eased * 0.13})`;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.restore();
  }

  function drawParticles(vanishingX, horizon, delta) {
    const scale = Math.min(width, height);

    context.save();
    context.globalCompositeOperation = "screen";

    particles.forEach((particle, index) => {
      if (!reducedMotion.matches) {
        particle.depth = (particle.depth + particle.speed * delta) % 1;
      }

      const expansion = 0.15 + particle.depth * particle.depth * 1.15;
      const x = vanishingX + Math.cos(particle.angle) * particle.radius * scale * expansion;
      const y = horizon + Math.sin(particle.angle) * particle.radius * scale * expansion * 0.56;
      const alpha = Math.sin(particle.depth * Math.PI) * 0.42;
      const size = 0.35 + particle.depth * 1.7;

      context.fillStyle = `hsl(${hue + (index % 3) * 18} 75% 72% / ${alpha})`;
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    });

    context.restore();
  }

  function drawSignal(vanishingX, horizon, elapsed) {
    const pulse = reducedMotion.matches ? 0.35 : 0.22 + Math.sin(elapsed * 0.001) * 0.08;

    context.save();
    context.globalCompositeOperation = "screen";
    context.strokeStyle = `hsl(${hue} 80% 70% / ${pulse})`;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(vanishingX, horizon, 18, 0, Math.PI * 2);
    context.stroke();

    context.strokeStyle = `hsl(${hue + 28} 80% 68% / ${pulse * 0.5})`;
    context.beginPath();
    context.arc(vanishingX, horizon, 34, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function draw(time, delta) {
    pointer.x += (pointer.targetX - pointer.x) * 0.045;
    pointer.y += (pointer.targetY - pointer.y) * 0.045;

    const vanishingX = width * (0.47 + pointer.x * 0.06);
    const horizon = height * (0.37 + pointer.y * 0.1);

    drawBackground(vanishingX, horizon);
    drawGrid(vanishingX, horizon, time);
    drawParticles(vanishingX, horizon, delta);
    drawSignal(vanishingX, horizon, time);
  }

  function animate(time) {
    const delta = Math.min((time - previousTime) / 1000, 0.1);
    previousTime = time;
    draw(time, delta);
    frame = requestAnimationFrame(animate);
  }

  function updateMotionPreference() {
    cancelAnimationFrame(frame);
    previousTime = performance.now();

    if (reducedMotion.matches) {
      draw(previousTime, 0);
    } else {
      frame = requestAnimationFrame(animate);
    }
  }

  function cycleHue() {
    hue = (hue + 47) % 360;
    draw(performance.now(), 0);
  }

  function handleKeydown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cycleHue();
    }
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", updatePointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", resetPointer);
  window.addEventListener("pointerdown", cycleHue);
  sandbox.addEventListener("keydown", handleKeydown);
  reducedMotion.addEventListener("change", updateMotionPreference);

  resize();
  updateMotionPreference();
})();
