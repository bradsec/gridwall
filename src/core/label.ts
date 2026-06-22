export type MeasureFn = (text: string) => number;

export function truncateText(text: string, measure: MeasureFn, maxWidth: number): string {
  const ellipsis = "...";
  const ellipsisWidth = measure(ellipsis);
  if (ellipsisWidth > maxWidth) return "";
  if (measure(text) <= maxWidth) return text;

  let t = text;
  while (t.length > 0) {
    if (measure(t) + ellipsisWidth <= maxWidth) return t + ellipsis;
    t = t.slice(0, -1);
  }
  return ellipsis;
}
