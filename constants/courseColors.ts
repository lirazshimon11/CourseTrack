export const COURSE_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
  "#6366F1",
  "#14B8A6",
  "#D946EF",
  "#EAB308",
  "#0EA5E9",
  "#A855F7",
  "#64748B",
];
// Keep the first courses visually distinct; larger imports receive additional hues.
export function courseColor(index: number): string {
  if (index < COURSE_COLORS.length) return COURSE_COLORS[index];
  const hue = (((index - COURSE_COLORS.length) * 137.508 + 17) % 360) / 60;
  const chroma = 0.65,
    x = chroma * (1 - Math.abs((hue % 2) - 1)),
    m = 0.25;
  const rgb =
    hue < 1
      ? [chroma, x, 0]
      : hue < 2
        ? [x, chroma, 0]
        : hue < 3
          ? [0, chroma, x]
          : hue < 4
            ? [0, x, chroma]
            : hue < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round((v + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}
