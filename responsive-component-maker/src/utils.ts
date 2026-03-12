import type { NodeSnapshot } from "./types"

/** Properties to capture on frame nodes */
export const FRAME_PROPERTIES = [
  "name", "visible", "locked", "opacity", "rotation",
  "backgroundColor", "backgroundImage", "borderRadius",
  "position", "top", "right", "bottom", "left",
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
  "aspectRatio", "zIndex", "overflow",
  "layout", "gap", "padding",
  "stackDirection", "stackDistribution", "stackAlignment", "stackWrapEnabled",
  "gridColumnCount", "gridRowCount", "gridAlignment",
  "gridColumnWidthType", "gridColumnWidth", "gridColumnMinWidth",
  "gridRowHeightType", "gridRowHeight",
  "gridItemFillCellWidth", "gridItemFillCellHeight",
  "gridItemHorizontalAlignment", "gridItemVerticalAlignment",
  "gridItemColumnSpan", "gridItemRowSpan",
] as const

/** Properties to capture on text nodes */
export const TEXT_PROPERTIES = [
  "name", "visible", "locked", "opacity", "rotation",
  "position", "top", "right", "bottom", "left",
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
  "zIndex", "overflow", "font", "inlineTextStyle",
  "gridItemFillCellWidth", "gridItemFillCellHeight",
  "gridItemHorizontalAlignment", "gridItemVerticalAlignment",
  "gridItemColumnSpan", "gridItemRowSpan",
] as const

/** Properties to capture on SVG nodes */
export const SVG_PROPERTIES = [
  "name", "visible", "locked", "opacity", "rotation",
  "position", "top", "right", "bottom", "left",
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
  "zIndex", "svg",
] as const

/** Properties to capture on component instance nodes */
export const INSTANCE_PROPERTIES = [
  "name", "visible", "locked", "opacity", "rotation",
  "position", "top", "right", "bottom", "left",
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
  "zIndex",
  "gridItemFillCellWidth", "gridItemFillCellHeight",
  "gridItemHorizontalAlignment", "gridItemVerticalAlignment",
  "gridItemColumnSpan", "gridItemRowSpan",
] as const

/**
 * Compute the diff between a primary snapshot and a breakpoint snapshot.
 * Only returns properties that actually differ.
 */
export function computeDiff(
  primarySnapshot: NodeSnapshot,
  breakpointSnapshot: NodeSnapshot
): Record<string, unknown> {
  const diff: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(breakpointSnapshot.properties)) {
    if (JSON.stringify(value) !== JSON.stringify(primarySnapshot.properties[key])) {
      diff[key] = value
    }
  }
  return diff
}

/**
 * Recursively compute total override count between two snapshot trees.
 */
export function countOverrides(
  primary: NodeSnapshot,
  breakpoint: NodeSnapshot
): number {
  let count = Object.keys(computeDiff(primary, breakpoint)).length

  // Text content difference
  if (breakpoint.textContent !== undefined && breakpoint.textContent !== primary.textContent) {
    count++
  }

  const minLen = Math.min(primary.children.length, breakpoint.children.length)
  for (let i = 0; i < minLen; i++) {
    count += countOverrides(primary.children[i], breakpoint.children[i])
  }
  return count
}
