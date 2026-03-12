/** Snapshot of a single node's properties at a specific breakpoint */
export interface NodeSnapshot {
  originalId: string
  name: string
  nodeType: "frame" | "text" | "svg" | "componentInstance"
  properties: Record<string, unknown>
  textContent?: string
  children: NodeSnapshot[]
}

/** Snapshot of one breakpoint's version of the entire element tree */
export interface BreakpointSnapshot {
  breakpointName: string
  breakpointWidth: number
  isPrimary: boolean
  rootSnapshot: NodeSnapshot
}

/** Complete capture of all breakpoints for a selected element */
export interface ResponsiveCapture {
  elementName: string
  primaryBreakpointId: string
  snapshots: BreakpointSnapshot[]
  capturedAt: string
}

/** Info about a detected breakpoint on the page */
export interface BreakpointInfo {
  id: string
  name: string
  width: number
  isPrimary: boolean
}

/** Result of the restore operation */
export interface RestoreResult {
  variantName: string
  propertiesApplied: number
}
