(function(root, factory) {
  const signs = factory();
  if (typeof module === 'object' && module.exports) module.exports = signs;
  else root.DrivePortfolioSignText = signs;
})(globalThis, function() {
  'use strict';

  const horizontalScales = new WeakMap();
  const resolution = pixels => Math.min(2048, Math.max(128, 2 ** Math.round(Math.log2(pixels))));

  function canvas(faceWidth, faceHeight, width, height) {
    const aspect = faceWidth / faceHeight;
    const image = document.createElement('canvas');
    image.height = resolution(height);
    image.width = resolution(image.height * aspect);
    const ctx = image.getContext('2d');
    ctx.scale(image.width / width, image.height / height);
    horizontalScales.set(ctx, (width / height) / aspect);
    return {canvas:image,ctx,width,height};
  }

  function text(ctx, label, x, y, maxWidth) {
    const correction = horizontalScales.get(ctx) ?? 1;
    const needed = maxWidth ? ctx.measureText(label).width * correction : 0;
    const fit = needed > maxWidth ? maxWidth / needed : 1;
    ctx.save();
    ctx.translate(x,y);
    // World-space glyph proportions and the width limit use the same scale
    // on both axes. The sign artwork keeps its authored layout coordinates.
    ctx.scale(correction * fit,fit);
    ctx.fillText(label,0,0);
    ctx.restore();
  }

  return {canvas,text};
});
