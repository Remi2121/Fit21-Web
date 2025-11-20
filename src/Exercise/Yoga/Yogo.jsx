import React from 'react'
import BigToe from "./Big Toe/Big-Toe"
import Bridge from "./Bridge/BridgePose"

const Yogo = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        overflowX: "auto",
        overflowY: "hidden",      // IMPORTANT: hide vertical scroll
        scrollBehavior: "smooth",
        width: "100vw",
        height: "100vh",          // full viewport height
        alignItems: "stretch"     // children will stretch vertically
      }}
    >
      <div style={{ flex: "0 0 100vw", height: "100%", boxSizing: "border-box" }}>
        <BigToe style={{ height: "100%" }} />
      </div>

      <div style={{ flex: "0 0 100vw", height: "100%", boxSizing: "border-box" }}>
        <Bridge style={{ height: "100%" }} />
      </div>
    </div>
  )
}

export default Yogo
