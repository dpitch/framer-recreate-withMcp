import {
  framer,
  CanvasNode,
  FrameNode,
  isFrameNode,
  isTextNode,
  isSVGNode,
  isComponentInstanceNode,
} from "framer-plugin"
import type { AnyNode } from "framer-plugin"
import type {
  NodeSnapshot,
  BreakpointSnapshot,
  BreakpointInfo,
  ResponsiveCapture,
} from "./types"
import { FRAME_PROPERTIES, TEXT_PROPERTIES, SVG_PROPERTIES, INSTANCE_PROPERTIES } from "./utils"


/** Read properties from a node based on its type */
function readProperties(node: CanvasNode): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  let keys: readonly string[]
  if (isFrameNode(node)) {
    keys = FRAME_PROPERTIES
  } else if (isTextNode(node)) {
    keys = TEXT_PROPERTIES
  } else if (isSVGNode(node)) {
    keys = SVG_PROPERTIES
  } else if (isComponentInstanceNode(node)) {
    keys = INSTANCE_PROPERTIES
  } else {
    return props
  }

  for (const key of keys) {
    const value = (node as unknown as Record<string, unknown>)[key]
    if (value !== undefined) {
      props[key] = value
    }
  }

  return props
}

/** Determine the node type string */
function getNodeType(node: CanvasNode): NodeSnapshot["nodeType"] {
  if (isFrameNode(node)) return "frame"
  if (isTextNode(node)) return "text"
  if (isSVGNode(node)) return "svg"
  if (isComponentInstanceNode(node)) return "componentInstance"
  return "frame" // fallback
}

/** Deep capture a node tree into a snapshot */
async function deepCapture(node: CanvasNode): Promise<NodeSnapshot> {
  const nodeType = getNodeType(node)
  const properties = readProperties(node)

  let textContent: string | undefined
  if (isTextNode(node)) {
    textContent = (await node.getText()) ?? undefined
  }

  // Don't recurse into component instances — they're self-contained
  let children: NodeSnapshot[] = []
  if (!isComponentInstanceNode(node)) {
    const childNodes = await node.getChildren()
    children = await Promise.all(childNodes.map(deepCapture))
  }

  return {
    originalId: node.id,
    name: (node as { name?: string | null }).name ?? "Unnamed",
    nodeType,
    properties,
    textContent,
    children,
  }
}

/** Check if a node's children contain breakpoints */
async function findBreakpointChildren(node: AnyNode): Promise<CanvasNode[]> {
  const children = await node.getChildren()
  return children.filter((c) => isFrameNode(c) && c.isBreakpoint)
}

/** Detect all breakpoints from a list of breakpoint nodes */
function extractBreakpointInfo(breakpointNodes: CanvasNode[]): BreakpointInfo[] {
  return breakpointNodes
    .filter(isFrameNode)
    .map((child) => ({
      id: child.id,
      name: child.name ?? "Unnamed",
      width: typeof child.width === "number" ? child.width : 0,
      isPrimary: child.isPrimaryBreakpoint,
    }))
}

/** Build a map of originalId -> node for all descendants in a breakpoint */
async function buildReplicaMap(breakpointNode: FrameNode): Promise<Map<string, CanvasNode>> {
  const map = new Map<string, CanvasNode>()

  for await (const node of breakpointNode.walk()) {
    if (node.originalId) {
      map.set(node.originalId, node as CanvasNode)
    }
  }

  return map
}

/**
 * Capture a node's snapshot from a replica map.
 * Uses the replica's properties if available, otherwise falls back to primary.
 */
async function captureFromReplicas(
  primarySnapshot: NodeSnapshot,
  replicaMap: Map<string, CanvasNode>
): Promise<NodeSnapshot> {
  const replicaNode = replicaMap.get(primarySnapshot.originalId)

  let properties: Record<string, unknown>
  let textContent: string | undefined

  if (replicaNode) {
    properties = readProperties(replicaNode)
    if (isTextNode(replicaNode)) {
      textContent = (await replicaNode.getText()) ?? undefined
    }
  } else {
    // No replica found — use primary values
    properties = { ...primarySnapshot.properties }
    textContent = primarySnapshot.textContent
  }

  const children: NodeSnapshot[] = await Promise.all(
    primarySnapshot.children.map((childSnapshot) =>
      captureFromReplicas(childSnapshot, replicaMap)
    )
  )

  return {
    originalId: primarySnapshot.originalId,
    name: primarySnapshot.name,
    nodeType: primarySnapshot.nodeType,
    properties,
    textContent,
    children,
  }
}

/**
 * Main capture function.
 * Captures the responsive layouts of the selected element across all breakpoints.
 */
export async function captureResponsiveLayouts(): Promise<ResponsiveCapture> {
  // 1. Get current selection
  const selection = await framer.getSelection()
  if (selection.length !== 1) {
    throw new Error("Please select exactly one element on the primary breakpoint.")
  }

  const selectedNode = selection[0]

  // 2. Find the page root (parent that contains breakpoints)
  // Walk up from the selected node checking each ancestor's children for breakpoints
  let pageRoot: AnyNode | null = null
  let breakpointNodes: CanvasNode[] = []
  let ancestor: AnyNode | null = await selectedNode.getParent()

  while (ancestor) {
    const bpChildren = await findBreakpointChildren(ancestor)
    if (bpChildren.length > 0) {
      pageRoot = ancestor
      breakpointNodes = bpChildren
      break
    }
    ancestor = await ancestor.getParent()
  }

  if (!pageRoot || breakpointNodes.length === 0) {
    throw new Error("Could not find page with breakpoints. Make sure you're on a page with responsive breakpoints.")
  }

  // 3. Extract breakpoint info
  const breakpoints = extractBreakpointInfo(breakpointNodes)
  if (breakpoints.length === 0) {
    throw new Error("No breakpoints found on this page.")
  }

  const primaryBp = breakpoints.find((bp) => bp.isPrimary)
  if (!primaryBp) {
    throw new Error("No primary breakpoint found.")
  }

  // 4. Capture the primary breakpoint snapshot
  const primarySnapshot = await deepCapture(selectedNode)

  // 5. Build snapshots for all breakpoints
  const snapshots: BreakpointSnapshot[] = []

  // Primary snapshot
  snapshots.push({
    breakpointName: primaryBp.name,
    breakpointWidth: primaryBp.width,
    isPrimary: true,
    rootSnapshot: primarySnapshot,
  })

  // Non-primary breakpoints
  for (const bp of breakpoints) {
    if (bp.isPrimary) continue

    const bpNode = await framer.getNode(bp.id)
    if (!bpNode || !isFrameNode(bpNode)) continue

    // Build replica map for this breakpoint
    const replicaMap = await buildReplicaMap(bpNode)

    // Capture using replicas
    const bpSnapshot = await captureFromReplicas(primarySnapshot, replicaMap)

    snapshots.push({
      breakpointName: bp.name,
      breakpointWidth: bp.width,
      isPrimary: false,
      rootSnapshot: bpSnapshot,
    })
  }

  const capture: ResponsiveCapture = {
    elementName: primarySnapshot.name,
    primaryBreakpointId: primaryBp.id,
    snapshots,
    capturedAt: new Date().toISOString(),
  }

  return capture
}
