import { useState, useEffect, useCallback } from "react"
import { framer } from "framer-plugin"
import type { ResponsiveCapture, RestoreResult } from "./types"
import { countOverrides } from "./utils"
import { captureResponsiveLayouts } from "./capture"
import { restoreVariants } from "./restore"

type Step = 1 | 2 | 3

export function App() {
  const [step, setStep] = useState<Step>(1)
  const [capture, setCapture] = useState<ResponsiveCapture | null>(null)
  const [restoreResults, setRestoreResults] = useState<RestoreResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectionCount, setSelectionCount] = useState(0)

  // Subscribe to selection changes
  useEffect(() => {
    return framer.subscribeToSelection((nodes) => {
      setSelectionCount(nodes.length)
    })
  }, [])


  const handleCapture = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await captureResponsiveLayouts()
      setCapture(result)
      setStep(2)
      framer.notify("Responsive layouts captured!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleComponentCreated = useCallback(() => {
    setStep(3)
  }, [])

  const handleRestore = useCallback(async () => {
    if (!capture) return
    setLoading(true)
    setError(null)
    try {
      const results = await restoreVariants(capture)
      setRestoreResults(results)
      framer.notify("Variants restored successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed")
    } finally {
      setLoading(false)
    }
  }, [capture])

  const handleReset = useCallback(() => {
    setStep(1)
    setCapture(null)
    setRestoreResults(null)
    setError(null)
  }, [])

  return (
    <div className="plugin">
      <div className="header">
        <h2>Responsive Component Maker</h2>
        <p className="subtitle">Preserve responsive layouts when creating components</p>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {/* Step 1: Capture */}
      <div className={`step ${step === 1 ? "active" : step > 1 ? "done" : ""}`}>
        <div className="step-header">
          <span className="step-number">{step > 1 ? "\u2713" : "1"}</span>
          <span className="step-title">Capture</span>
        </div>
        <div className="step-body">
          {step === 1 && (
            <>
              <p>Select an element on the primary breakpoint and click capture.</p>
              <button
                onClick={handleCapture}
                disabled={loading || selectionCount !== 1}
                className="primary"
              >
                {loading ? "Capturing..." : "Capture Responsive Layouts"}
              </button>
              {selectionCount !== 1 && (
                <p className="hint">
                  {selectionCount === 0
                    ? "Select one element to continue"
                    : `${selectionCount} elements selected — select exactly one`}
                </p>
              )}
            </>
          )}
          {capture && <CaptureStatus capture={capture} />}
        </div>
      </div>

      {/* Step 2: Create Component */}
      <div className={`step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>
        <div className="step-header">
          <span className="step-number">{step > 2 ? "\u2713" : "2"}</span>
          <span className="step-title">Create Component</span>
        </div>
        <div className="step-body">
          {step === 2 && (
            <>
              <p>Right-click your element and select <strong>"Create Component"</strong> in Framer.</p>
              <p>Then double-click into the component and click the button below.</p>
              <button
                onClick={handleComponentCreated}
                className="primary"
              >
                I've Created the Component
              </button>
            </>
          )}
        </div>
      </div>

      {/* Step 3: Restore */}
      <div className={`step ${step === 3 ? "active" : ""}`}>
        <div className="step-header">
          <span className="step-number">{restoreResults ? "\u2713" : "3"}</span>
          <span className="step-title">Restore</span>
        </div>
        <div className="step-body">
          {step === 3 && !restoreResults && (
            <>
              <p>Make sure you're inside the component (double-clicked into it), then click restore.</p>
              <button
                onClick={handleRestore}
                disabled={loading}
                className="primary"
              >
                {loading ? "Restoring..." : "Restore Responsive Variants"}
              </button>
            </>
          )}
          {restoreResults && <RestoreStatus results={restoreResults} />}
        </div>
      </div>

      {/* Reset */}
      {(capture || restoreResults) && (
        <div className="footer">
          <button onClick={handleReset} className="secondary">
            Start Over
          </button>
        </div>
      )}
    </div>
  )
}

function CaptureStatus({ capture }: { capture: ResponsiveCapture }) {
  const primarySnapshot = capture.snapshots.find((s) => s.isPrimary)

  return (
    <div className="status">
      <p className="status-title">
        Captured {capture.snapshots.length} breakpoint{capture.snapshots.length !== 1 ? "s" : ""}
      </p>
      <ul>
        {capture.snapshots.map((s) => (
          <li key={s.breakpointName}>
            <strong>{s.breakpointName}</strong> ({s.breakpointWidth}px)
            {s.isPrimary
              ? " — primary"
              : primarySnapshot
                ? ` — ${countOverrides(primarySnapshot.rootSnapshot, s.rootSnapshot)} overrides`
                : ""}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RestoreStatus({ results }: { results: RestoreResult[] }) {
  return (
    <div className="status success">
      <p className="status-title">
        Created {results.length} variant{results.length !== 1 ? "s" : ""}
      </p>
      <ul>
        {results.map((r) => (
          <li key={r.variantName}>
            <strong>{r.variantName}</strong> — {r.propertiesApplied} properties applied
          </li>
        ))}
      </ul>
    </div>
  )
}
