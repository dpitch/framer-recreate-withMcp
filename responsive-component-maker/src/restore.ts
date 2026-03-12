import {
  framer,
  isFrameNode,
  CanvasNode,
} from "framer-plugin"
import type {
  NodeSnapshot,
  ResponsiveCapture,
  RestoreResult,
} from "./types"
import { computeDiff } from "./utils"

/**
 * Apply property diffs recursively to a cloned variant tree.
 * Matches nodes by tree position (index-based) since the clone
 * has identical structure to the primary.
 */
async function applyDiffsRecursive(
  clonedNode: CanvasNode,
  primarySnapshot: NodeSnapshot,
  breakpointSnapshot: NodeSnapshot
): Promise<number> {
  let appliedCount = 0

  // Compute diff for this node
  const diff = computeDiff(primarySnapshot, breakpointSnapshot)
  const diffKeys = Object.keys(diff)

  if (diffKeys.length > 0) {
    // Filter out non-editable properties like 'name'
    const editableDiff: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(diff)) {
      if (key === "name") continue // Don't override node names
      editableDiff[key] = value
    }

    if (Object.keys(editableDiff).length > 0) {
      await clonedNode.setAttributes(editableDiff as Parameters<typeof clonedNode.setAttributes>[0])
      appliedCount += Object.keys(editableDiff).length
    }
  }

  // Handle text content differences
  if (
    breakpointSnapshot.textContent !== undefined &&
    breakpointSnapshot.textContent !== primarySnapshot.textContent &&
    "setText" in clonedNode &&
    typeof (clonedNode as { setText?: (t: string) => Promise<void> }).setText === "function"
  ) {
    await (clonedNode as { setText: (t: string) => Promise<void> }).setText(
      breakpointSnapshot.textContent
    )
    appliedCount++
  }

  // Recurse into children (positional match)
  const clonedChildren = await clonedNode.getChildren()
  const minLen = Math.min(
    clonedChildren.length,
    primarySnapshot.children.length,
    breakpointSnapshot.children.length
  )

  for (let i = 0; i < minLen; i++) {
    appliedCount += await applyDiffsRecursive(
      clonedChildren[i],
      primarySnapshot.children[i],
      breakpointSnapshot.children[i]
    )
  }

  return appliedCount
}

/**
 * Restore responsive variants from a capture.
 *
 * The user must be inside the component (double-clicked into it)
 * or have the component selected. The function will:
 * 1. Find the primary variant
 * 2. Clone it for each non-primary breakpoint
 * 3. Apply the captured property diffs to each clone
 */
export async function restoreVariants(capture: ResponsiveCapture): Promise<RestoreResult[]> {
  // Get the canvas root — if inside a component, this should be a ComponentNode
  const canvasRoot = await framer.getCanvasRoot()
  const rootChildren = await canvasRoot.getChildren()

  // Find the primary variant
  const primaryVariant = rootChildren.find(
    (child) => isFrameNode(child) && child.isPrimaryVariant
  )

  if (!primaryVariant) {
    throw new Error(
      "Could not find the primary variant. Make sure you've double-clicked into the component."
    )
  }

  const primarySnapshot = capture.snapshots.find((s) => s.isPrimary)
  if (!primarySnapshot) {
    throw new Error("No primary breakpoint found in capture data.")
  }

  const results: RestoreResult[] = []

  // For each non-primary breakpoint, clone and apply diffs
  for (const snapshot of capture.snapshots) {
    if (snapshot.isPrimary) continue

    // Clone the primary variant
    const cloned = await primaryVariant.clone()
    if (!cloned) {
      throw new Error(`Failed to clone variant for "${snapshot.breakpointName}".`)
    }

    // Rename the variant to match the breakpoint
    if (isFrameNode(cloned)) {
      await cloned.setAttributes({ name: snapshot.breakpointName })
    }

    // Apply property diffs recursively
    const propertiesApplied = await applyDiffsRecursive(
      cloned as CanvasNode,
      primarySnapshot.rootSnapshot,
      snapshot.rootSnapshot
    )

    results.push({
      variantName: snapshot.breakpointName,
      propertiesApplied,
    })
  }

  return results
}
