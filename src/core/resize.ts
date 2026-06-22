export interface Size {
  w: number;
  h: number;
}

// Ports resizeImageAspect: exact target width, height rounded, min 1.
export function computeAspectResize(srcW: number, srcH: number, targetW: number): Size {
  if (srcW === 0 || srcH === 0) return { w: targetW, h: targetW };
  const scale = targetW / srcW;
  const h = Math.max(Math.round(srcH * scale), 1);
  return { w: targetW, h };
}

// Ports the scale step of resizeImage: shorter side to size, ceil, clamp up.
export function computeSquareScale(srcW: number, srcH: number, size: number): Size {
  if (srcW === 0 || srcH === 0) return { w: size, h: size };
  const scale = size / Math.min(srcW, srcH);
  let w = Math.ceil(srcW * scale);
  let h = Math.ceil(srcH * scale);
  if (w < size) w = size;
  if (h < size) h = size;
  return { w, h };
}

export function cropOffset(
  scaledW: number,
  scaledH: number,
  size: number,
  mode: "center" | "top",
): { x: number; y: number } {
  const x = Math.floor((scaledW - size) / 2);
  const y = mode === "top" ? 0 : Math.floor((scaledH - size) / 2);
  return { x, y };
}
