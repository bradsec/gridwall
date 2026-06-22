// Minimal inline SVG icons (consistent 1.5 stroke). Kept in-house to honor the
// project's zero-dependency, no-CDN constraint instead of pulling an icon library.
const NS = "http://www.w3.org/2000/svg";

type Child = [tag: string, attrs: Record<string, string>];

const ICONS: Record<string, Child[]> = {
  plus: [["path", { d: "M12 5v14" }], ["path", { d: "M5 12h14" }]],
  download: [
    ["path", { d: "M12 3v12" }],
    ["path", { d: "M7 10l5 5 5-5" }],
    ["path", { d: "M5 21h14" }],
  ],
  image: [
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }],
    ["circle", { cx: "8.5", cy: "8.5", r: "1.5" }],
    ["path", { d: "M3 15l4-4a2 2 0 0 1 3 0l5 5" }],
    ["path", { d: "M14 14l2-2a2 2 0 0 1 3 0l2 2" }],
  ],
  x: [["path", { d: "M6 6l12 12" }], ["path", { d: "M18 6l-12 12" }]],
  shuffle: [
    ["path", { d: "M16 3h5v5" }],
    ["path", { d: "M21 3l-7 7" }],
    ["path", { d: "M16 21h5v-5" }],
    ["path", { d: "M21 21l-7-7" }],
    ["path", { d: "M3 3l7 7" }],
    ["path", { d: "M3 21l5-5" }],
  ],
  "chevron-left": [["path", { d: "M15 18l-6-6 6-6" }]],
  "chevron-right": [["path", { d: "M9 18l6-6-6-6" }]],
  grip: [["path", { d: "M9 5v14" }], ["path", { d: "M15 5v14" }]],
  rotate: [["path", { d: "M21 12a9 9 0 1 1-3-6.7" }], ["path", { d: "M21 3v5h-5" }]],
};

export function icon(name: keyof typeof ICONS, size = 16): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of ICONS[name]) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}
