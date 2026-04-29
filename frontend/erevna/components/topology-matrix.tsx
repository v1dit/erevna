"use client";

import { useEffect, useRef } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { STAGES, type StageStatus } from "@/frontend/erevna/lib/stages";

type TopologyMatrixProps = {
  selectedStageId: string;
  stageStatusMap: Record<string, StageStatus>;
  onSelectStage: (stageId: string) => void;
};

const EDGES: Array<[string, string]> = [
  ["literature-review", "hypothesis"],
  ["hypothesis", "source-intake"],
  ["source-intake", "source-resolution"],
  ["source-resolution", "schema-profiling"],
  ["schema-profiling", "target-framing"],
  ["target-framing", "preprocessing"],
  ["preprocessing", "baseline"],
  ["baseline", "linear-model"],
  ["linear-model", "tree-model"],
  ["tree-model", "boosted-model"],
  ["boosted-model", "evaluation"],
  ["evaluation", "critic"],
  ["critic", "export"],
];

const RESEARCH_STAGE_IDS = new Set(["literature-review", "hypothesis"]);

export function TopologyMatrix({
  selectedStageId,
  stageStatusMap,
  onSelectStage,
}: TopologyMatrixProps) {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }

    const cy = cytoscape({
      container: graphRef.current,
      elements: buildElements(stageStatusMap),
      layout: { name: "preset" },
      minZoom: 0.5,
      maxZoom: 1.8,
      wheelSensitivity: 0.12,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            shape: "round-rectangle",
            width: 168,
            height: 56,
            color: "#0c1a12",
            "font-family": "JetBrains Mono, IBM Plex Mono, monospace",
            "font-size": 10,
            "font-weight": 500,
            "text-transform": "uppercase",
            "text-wrap": "wrap",
            "text-max-width": "118px",
            "text-valign": "center",
            "background-color": "#ffffff",
            "border-width": 1.2,
            "border-color": "rgba(20,30,25,0.18)",
            "text-outline-opacity": 0,
          },
        },
        {
          selector: "node.research-literature",
          style: {
            "border-color": "rgba(74,63,176,0.45)",
          },
        },
        {
          selector: "node.research-literature.complete",
          style: {
            "border-color": "#4a3fb0",
            "background-color": "#f3f1fc",
          },
        },
        {
          selector: "node.research-literature.running",
          style: {
            "background-color": "#f3f1fc",
            "border-color": "#4a3fb0",
          },
        },
        {
          selector: "node.research-hypothesis",
          style: {
            "border-color": "rgba(163,90,20,0.45)",
          },
        },
        {
          selector: "node.research-hypothesis.complete",
          style: {
            "border-color": "#a35a14",
            "background-color": "#fbf3e9",
          },
        },
        {
          selector: "node.research-hypothesis.running",
          style: {
            "background-color": "#fbf3e9",
            "border-color": "#a35a14",
          },
        },
        {
          selector: "node.active",
          style: {
            "border-color": "#0d4d33",
            "border-width": 2.5,
            "overlay-color": "rgba(13,77,51,0.12)",
            "overlay-opacity": 0.18,
          },
        },
        {
          selector: ".complete",
          style: {
            "background-color": "#ecf6f1",
            "border-color": "#0d4d33",
          },
        },
        {
          selector: ".running",
          style: {
            "background-color": "#ddf0e6",
            "border-color": "#0f6e4a",
          },
        },
        {
          selector: ".queued",
          style: {
            "background-color": "#ffffff",
            "border-color": "rgba(20,30,25,0.22)",
            "border-style": "dashed",
          },
        },
        {
          selector: ".warning",
          style: {
            "background-color": "#faf2e0",
            "border-color": "#b8841b",
          },
        },
        {
          selector: ".failed",
          style: {
            "background-color": "#fbecec",
            "border-color": "#b94445",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "rgba(20,30,25,0.20)",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "rgba(20,30,25,0.20)",
            "curve-style": "bezier",
          },
        },
        {
          selector: "edge.flow-complete",
          style: {
            width: 2.5,
            "line-color": "#0f6e4a",
            "target-arrow-color": "#0f6e4a",
          },
        },
        {
          selector: "edge.flow-research",
          style: {
            width: 2.5,
            "line-color": "#4a3fb0",
            "target-arrow-color": "#4a3fb0",
          },
        },
      ],
    });

    cy.on("tap", "node", (event) => {
      const nodeId = event.target.id();
      onSelectStage(nodeId);
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [onSelectStage, stageStatusMap]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.nodes().removeClass("active");
    const activeNode = cy.getElementById(selectedStageId);
    if (activeNode.nonempty()) {
      activeNode.addClass("active");
    }
  }, [selectedStageId]);

  return (
    <div className="topology-matrix-shell">
      <div className="topology-toolbar">
        <span className="shell-kicker">Erevna Pipeline Matrix</span>
        <div className="topology-legend">
          <span className="legend-dot legend-research-literature">Papers</span>
          <span className="legend-dot legend-research-hypothesis">Hypothesis</span>
          <span className="legend-dot legend-running">Running</span>
          <span className="legend-dot legend-complete">Complete</span>
        </div>
      </div>
      <div ref={graphRef} className="topology-canvas" />
    </div>
  );
}

function buildElements(stageStatusMap: Record<string, StageStatus>): ElementDefinition[] {
  const nodes = STAGES.map((stage) => {
    const baseClass = stageStatusMap[stage.id] ?? "idle";
    const researchClass =
      stage.id === "literature-review"
        ? "research-literature"
        : stage.id === "hypothesis"
          ? "research-hypothesis"
          : "";

    return {
      data: { id: stage.id, label: stage.shortLabel },
      position: {
        x: 240 + stage.x * 220,
        y: 110 + stage.y * 165,
      },
      classes: [baseClass, researchClass].filter(Boolean).join(" "),
    };
  });

  const edges = EDGES.map(([source, target]) => {
    const sourceStatus = stageStatusMap[source];
    const isResearchEdge = RESEARCH_STAGE_IDS.has(source) || RESEARCH_STAGE_IDS.has(target);
    const isComplete = sourceStatus === "complete" || sourceStatus === "warning";

    let edgeClass = "";
    if (isComplete && isResearchEdge) {
      edgeClass = "flow-research";
    } else if (isComplete) {
      edgeClass = "flow-complete";
    }

    return {
      data: { id: `${source}-${target}`, source, target },
      classes: edgeClass,
    };
  });

  return [...nodes, ...edges];
}
