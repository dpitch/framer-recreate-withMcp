import { framer } from "framer-plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./App.css"

framer.showUI({
  position: "top right",
  width: 300,
  minWidth: 280,
  maxWidth: 400,
  height: 500,
  minHeight: 400,
  resizable: "height",
})

const root = document.getElementById("root")!
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
