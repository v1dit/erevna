"use client";

import {
  humanizeTaskSubtype,
  predictionSummary,
  summaryToText,
  visualizationVariant,
  type DownloadableArtifact,
  type SummaryCard,
} from "@/frontend/erevna/lib/stages";
import { HypothesisCard } from "@/frontend/erevna/hypothesis-card";
import type {
  LabPredictionResponse,
  LabRunResult,
  PredictionInputField,
  ResearchHypothesis,
  Visualization,
} from "@/lib/erevna/types";

type EvidenceWorkspaceProps = {
  hypothesis: ResearchHypothesis | null;
  runResult: LabRunResult | null;
  summaryCards: SummaryCard[];
  visualizations: Visualization[];
  artifacts: DownloadableArtifact[];
  activeArtifactId: string | null;
  onSelectArtifact: (artifactId: string) => void;
  onDownloadArtifact: (artifact: DownloadableArtifact) => void;
  onDownloadBundle: () => void;
  onDownloadPythonBundle: () => void;
  predictionValues: Record<string, string>;
  predictionResult: LabPredictionResponse | null;
  isPredicting: boolean;
  onPredictionChange: (fieldName: string, value: string) => void;
  onPredict: () => void;
};

export function EvidenceWorkspace({
  hypothesis,
  runResult,
  summaryCards,
  visualizations,
  artifacts,
  activeArtifactId,
  onSelectArtifact,
  onDownloadArtifact,
  onDownloadBundle,
  onDownloadPythonBundle,
  predictionValues,
  predictionResult,
  isPredicting,
  onPredictionChange,
  onPredict,
}: EvidenceWorkspaceProps) {
  const pythonArtifacts = artifacts.filter((artifact) => artifact.filename.endsWith(".py"));
  const reportArtifacts = artifacts.filter((artifact) => !artifact.filename.endsWith(".py"));
  const activeArtifact =
    artifacts.find((artifact) => artifact.id === activeArtifactId) ??
    pythonArtifacts[0] ??
    artifacts[0] ??
    null;

  return (
    <section className="command-lower">
      <HypothesisCard hypothesis={hypothesis} />

      <article className="command-card summary-card">
        <div className="card-header">
          <span className="shell-kicker">Summary</span>
          <h3>Plain-English outcome</h3>
        </div>

        {runResult ? (
          <div className="summary-layout">
            <div className="summary-grid">
              {summaryCards.map((card) => (
                <div key={card.label} className="metric-tile">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.hint}</p>
                </div>
              ))}
            </div>

            <div className="narrative-stack">
              <div className="narrative-card">
                <h4>{runResult.plainEnglishSummary.headline}</h4>
                <p>{runResult.plainEnglishSummary.shortExplanation}</p>
                <div className="bullet-stack">
                  {runResult.plainEnglishSummary.takeaways.map((takeaway) => (
                    <p key={takeaway}>{takeaway}</p>
                  ))}
                </div>
              </div>

              <div className="narrative-card evidence-brief-card">
                <span className="shell-kicker">How the backend solved it</span>
                <h4>{humanizeTaskSubtype(runResult.problemFraming.taskSubtype)}</h4>
                <p>{runResult.problemFraming.rationale}</p>
                <div className="bullet-stack">
                  <p>
                    The run used <strong>{runResult.problemFraming.primaryMetric}</strong> to rank
                    the winner on held-out data.
                  </p>
                  <p>
                    Baseline {runResult.bestModel.baselineScore.toFixed(3)} → best{" "}
                    {runResult.bestModel.score.toFixed(3)} for an absolute lift of{" "}
                    {runResult.bestModel.absoluteImprovement >= 0 ? "+" : ""}
                    {runResult.bestModel.absoluteImprovement.toFixed(3)}.
                  </p>
                  <p>{runResult.bestModel.whyItWon}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyMessage text="Resolve and run a dataset to unlock the summary layer." />
        )}
      </article>

      <div className="command-grid">
        <article className="command-card evidence-card">
          <div className="card-header">
            <span className="shell-kicker">Evidence</span>
            <h3>Graphs and diagnostics</h3>
          </div>
          {visualizations.length ? (
            <div className="visualization-grid">
              {visualizations.map((visualization) => (
                <VisualizationCard key={visualization.id} visualization={visualization} />
              ))}
            </div>
          ) : (
            <EmptyMessage text="Resolved profiling and model evidence will appear here as stages complete." />
          )}
        </article>

        <article className="command-card leaderboard-card-shell">
          <div className="card-header">
            <span className="shell-kicker">Leaderboard</span>
            <h3>Model comparison</h3>
          </div>
          {runResult ? (
            <div className="leaderboard-shell">
              <div className="leaderboard-head leaderboard-head-detailed">
                <span>Model</span>
                <span>Family</span>
                <span>Held-out</span>
                <span>Train</span>
                <span>Test</span>
                <span>Delta</span>
              </div>
              {runResult.leaderboard.map((entry) => (
                <div key={`${entry.modelName}-${entry.family}`} className="leaderboard-row-block">
                  <div className="leaderboard-row-shell leaderboard-row-detailed">
                    <span>{entry.modelName}</span>
                    <span>{entry.family}</span>
                    <strong>{entry.score.toFixed(3)}</strong>
                    <strong>{formatMaybeMetric(entry.trainScore)}</strong>
                    <strong>{formatMaybeMetric(entry.testScore)}</strong>
                    <strong>{formatImprovement(entry.improvementOverBaseline)}</strong>
                  </div>
                  {entry.notes ? <p className="leaderboard-note">{entry.notes}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyMessage text="The leaderboard appears after the experiment sweep completes." />
          )}
        </article>

        <article className="command-card artifact-shell">
          <div className="card-header">
            <span className="shell-kicker">Exports</span>
            <h3>Python, reports, and bundles</h3>
          </div>

          {runResult ? (
            <>
              <div className="artifact-group-shell">
                <div className="artifact-group-header">
                  <span className="shell-kicker">Python scripts</span>
                  <h4>Runnable code artifacts</h4>
                </div>
                <div className="artifact-actions">
                  {pythonArtifacts.map((artifact) => (
                    <button
                      key={artifact.id}
                      type="button"
                      className={
                        artifact.id === activeArtifact?.id ? "shell-button active" : "shell-button"
                      }
                      onClick={() => onSelectArtifact(artifact.id)}
                    >
                      {artifact.filename}
                    </button>
                  ))}
                </div>
                <div className="artifact-downloads">
                  {pythonArtifacts.map((artifact) => (
                    <button
                      key={`${artifact.id}-download`}
                      type="button"
                      className="shell-button ghost"
                      onClick={() => onDownloadArtifact(artifact)}
                    >
                      Download {artifact.filename}
                    </button>
                  ))}
                  <button type="button" className="shell-button primary" onClick={onDownloadPythonBundle}>
                    Download Python bundle
                  </button>
                </div>
              </div>

              <div className="artifact-group-shell">
                <div className="artifact-group-header">
                  <span className="shell-kicker">Reports and summaries</span>
                  <h4>Human-readable outcome package</h4>
                </div>
                <div className="artifact-actions">
                  {reportArtifacts.map((artifact) => (
                    <button
                      key={artifact.id}
                      type="button"
                      className={
                        artifact.id === activeArtifact?.id ? "shell-button active" : "shell-button"
                      }
                      onClick={() => onSelectArtifact(artifact.id)}
                    >
                      {artifact.filename}
                    </button>
                  ))}
                </div>
                <div className="artifact-downloads">
                  {reportArtifacts.map((artifact) => (
                    <button
                      key={`${artifact.id}-download`}
                      type="button"
                      className="shell-button ghost"
                      onClick={() => onDownloadArtifact(artifact)}
                    >
                      Download {artifact.filename}
                    </button>
                  ))}
                  <button type="button" className="shell-button primary" onClick={onDownloadBundle}>
                    Download run bundle
                  </button>
                  <button
                    type="button"
                    className="shell-button ghost"
                    onClick={() =>
                      onDownloadArtifact({
                        id: "plain-english-summary.txt",
                        filename: "plain-english-summary.txt",
                        type: "report",
                        content: summaryToText(runResult.plainEnglishSummary),
                      })
                    }
                  >
                    Download summary
                  </button>
                </div>
              </div>

              <div className="artifact-preview">
                <pre>{activeArtifact?.content ?? "Choose an artifact to preview it here."}</pre>
              </div>
            </>
          ) : (
            <EmptyMessage text="Reports, code, and the run bundle appear after a successful experiment." />
          )}
        </article>

        <article className="command-card report-shell">
          <div className="card-header">
            <span className="shell-kicker">Research Layer</span>
            <h3>Critique and report</h3>
          </div>
          {runResult ? (
            <div className="report-stack">
              <section className="critic-grid-shell">
                {[
                  { title: "Warnings", items: runResult.criticReport.warnings },
                  { title: "Failure Modes", items: runResult.criticReport.failureModes },
                  { title: "Next Experiments", items: runResult.criticReport.nextExperiments },
                  { title: "Limitations", items: runResult.criticReport.limitations },
                ].map(({ title, items }) => (
                  <article key={title} className="critic-card-shell">
                    <span className="shell-kicker">{title}</span>
                    {items.length ? (
                      items.map((item) => <p key={item}>{item}</p>)
                    ) : (
                      <p>No major notes in this category.</p>
                    )}
                  </article>
                ))}
              </section>
              <div className="report-preview">
                <pre>{runResult.finalReportMarkdown}</pre>
              </div>
            </div>
          ) : (
            <EmptyMessage text="The report layer activates after the backend packaging stage completes." />
          )}
        </article>

        <article className="command-card prediction-shell">
          <div className="card-header">
            <span className="shell-kicker">Try Here</span>
            <h3>Score one fresh example</h3>
          </div>
          {runResult?.predictionInputSchema ? (
            <div className="prediction-layout">
              <div className="prediction-fields">
                {runResult.predictionInputSchema.fields.map((field) => (
                  <PredictionField
                    key={field.name}
                    field={field}
                    value={predictionValues[field.name] ?? ""}
                    onChange={(value) => onPredictionChange(field.name, value)}
                  />
                ))}
              </div>
              <div className="prediction-output">
                <p>{predictionSummary(predictionResult)}</p>
                {predictionResult ? (
                  <>
                    <strong>{predictionResult.explanation}</strong>
                    <div className="bullet-stack">
                      {predictionResult.topFactors.map((factor) => (
                        <p key={factor}>{factor}</p>
                      ))}
                    </div>
                  </>
                ) : null}
                <button
                  type="button"
                  className="shell-button primary"
                  onClick={onPredict}
                  disabled={isPredicting}
                >
                  {isPredicting ? "Scoring ..." : "Predict with saved model"}
                </button>
              </div>
            </div>
          ) : (
            <EmptyMessage text="The prediction form appears after the run returns a scoring schema." />
          )}
        </article>
      </div>
    </section>
  );
}

function PredictionField({
  field,
  value,
  onChange,
}: {
  field: PredictionInputField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.options?.length) {
    return (
      <label className="shell-field">
        <span>{field.label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="shell-field">
      <span>{field.label}</span>
      <input
        type={field.kind === "number" ? "number" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.example !== undefined ? String(field.example) : ""}
      />
    </label>
  );
}

function VisualizationCard({ visualization }: { visualization: Visualization }) {
  return (
    <article className="viz-card">
      <div className="viz-header">
        <span className="shell-kicker">{visualization.type.replaceAll("_", " ")}</span>
        <h4>{visualization.title}</h4>
      </div>
      <VisualizationSurface visualization={visualization} />
    </article>
  );
}

function VisualizationSurface({ visualization }: { visualization: Visualization }) {
  const variant = visualizationVariant(visualization.type);
  switch (variant) {
    case "bars":
      return <BarVisualization visualization={visualization} />;
    case "grid":
      return <GridVisualization visualization={visualization} />;
    case "line":
      return <LineVisualization visualization={visualization} />;
    case "graph":
      return <GraphVisualization visualization={visualization} />;
    default:
      return (
        <div className="viz-fallback">
          <pre>{JSON.stringify(visualization.data, null, 2)}</pre>
        </div>
      );
  }
}

function BarVisualization({ visualization }: { visualization: Visualization }) {
  const rows = Array.isArray(visualization.data) ? visualization.data.slice(0, 10) : [];
  const barRows = rows.map((row, index) => toBarRow(visualization, row as Record<string, unknown>, index));
  const maxValue = Math.max(...barRows.map((row) => row.normalizationValue), 1);

  return (
    <div className="bar-stack-shell">
      {barRows.map((row) => (
        <div key={row.id} className="bar-row-shell">
          <div className="bar-label">
            <span>{row.label}</span>
            <strong>{row.primaryValue}</strong>
          </div>
          <div className="bar-track-shell">
            <div
              className="bar-fill-shell"
              style={{ width: `${Math.max(8, Math.min(100, (row.normalizationValue / maxValue) * 100))}%` }}
            />
          </div>
          {row.detail ? <p className="bar-detail">{row.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

function GridVisualization({ visualization }: { visualization: Visualization }) {
  const data = visualization.data as
    | { columns?: string[]; matrix?: number[][]; labels?: string[] }
    | undefined;
  const labels = data?.columns ?? data?.labels ?? [];
  const matrix = data?.matrix ?? [];

  if (!labels.length || !matrix.length) {
    return <EmptyMessage text="No grid data is available for this stage." compact />;
  }

  return (
    <div className="grid-shell">
      <div
        className="grid-shell-matrix detailed"
        style={{ gridTemplateColumns: `88px repeat(${labels.length}, minmax(0, 1fr))` }}
      >
        <span className="grid-axis-label" />
        {labels.map((label) => (
          <span key={`column-${label}`} className="grid-axis-label">
            {label}
          </span>
        ))}

        {matrix.map((row, rowIndex) => (
          <GridRow
            key={`row-${labels[rowIndex] ?? rowIndex}`}
            rowLabel={labels[rowIndex] ?? `row-${rowIndex + 1}`}
            row={row}
            labels={labels}
          />
        ))}
      </div>
      <p className="grid-footnote">Darker cells mean weaker relationships. Numbers are shown directly in-cell.</p>
    </div>
  );
}

function GridRow({
  rowLabel,
  row,
  labels,
}: {
  rowLabel: string;
  row: number[];
  labels: string[];
}) {
  return (
    <>
      <span className="grid-axis-label row">{rowLabel}</span>
      {row.map((value, columnIndex) => (
        <div
          key={`${rowLabel}-${labels[columnIndex] ?? columnIndex}`}
          className="grid-cell-shell"
          style={{ opacity: 0.22 + Math.min(Math.abs(Number(value)), 1) * 0.78 }}
          title={`${rowLabel} · ${labels[columnIndex] ?? columnIndex}: ${value}`}
        >
          <span>{Math.abs(value) <= 1 ? value.toFixed(2) : value.toFixed(0)}</span>
        </div>
      ))}
    </>
  );
}

function LineVisualization({ visualization }: { visualization: Visualization }) {
  const spec = buildLineSpec(visualization);
  if (!spec.points.length) {
    return <EmptyMessage text="No plotted points are available for this stage." compact />;
  }

  const path = spec.points
    .map((point, index) => {
      const x = 18 + point.x * 248;
      const y = 154 - point.y * 118;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="line-shell">
      <div className="line-axis-meta">
        <span>{spec.yLabel}</span>
        <strong>{formatAxisValue(spec.yMax)}</strong>
      </div>
      <svg viewBox="0 0 286 172" className="line-shell-svg" role="img" aria-label={visualization.title}>
        <path d="M18 154 H268" className="axis-path" />
        <path d="M18 154 V26" className="axis-path" />
        <path d={path} className="signal-path" />
        {spec.points.slice(0, 18).map((point, index) => {
          const x = 18 + point.x * 248;
          const y = 154 - point.y * 118;
          return <circle key={`${visualization.id}-point-${index}`} cx={x} cy={y} r="2.4" className="signal-dot" />;
        })}
      </svg>
      <div className="line-axis-footer">
        <strong>{formatAxisValue(spec.xMin)}</strong>
        <span>{spec.xLabel}</span>
        <strong>{formatAxisValue(spec.xMax)}</strong>
      </div>
      <p className="line-footnote">{spec.note}</p>
    </div>
  );
}

function GraphVisualization({ visualization }: { visualization: Visualization }) {
  const data = visualization.data as { nodes?: string[]; edges?: string[][] } | undefined;
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];
  return (
    <div className="mini-graph-shell">
      <div className="mini-node-row">
        {nodes.map((node) => (
          <span key={node} className="mini-node-pill">
            {node}
          </span>
        ))}
      </div>
      <div className="mini-edge-row">
        {edges.slice(0, 10).map(([from, to], index) => (
          <p key={`${from}-${to}-${index}`}>
            {from} → {to}
          </p>
        ))}
      </div>
      <p className="graph-footnote">
        {nodes.length} stages connected by {edges.length} experiment transitions.
      </p>
    </div>
  );
}

function toBarRow(visualization: Visualization, record: Record<string, unknown>, index: number) {
  const fallbackLabel = `value-${index + 1}`;

  if (visualization.type === "class_balance") {
    const count = Number(record.count ?? 0);
    const ratio = Number(record.ratio ?? 0);
    return {
      id: `${record.label ?? fallbackLabel}-${index}`,
      label: String(record.label ?? fallbackLabel),
      primaryValue: `${count.toLocaleString()} rows`,
      normalizationValue: count,
      detail: `${(ratio * 100).toFixed(1)}% of the dataset`,
    };
  }

  if (visualization.type === "missingness_summary") {
    const missingCount = Number(record.missingCount ?? 0);
    const missingRatio = Number(record.missingRatio ?? 0);
    return {
      id: `${record.column ?? fallbackLabel}-${index}`,
      label: String(record.column ?? fallbackLabel),
      primaryValue: `${missingCount.toLocaleString()} missing`,
      normalizationValue: Math.max(missingCount, missingRatio),
      detail: `${(missingRatio * 100).toFixed(1)}% null coverage`,
    };
  }

  if (visualization.type === "model_comparison") {
    const score = Number(record.score ?? 0);
    const trainScore = Number(record.trainScore ?? Number.NaN);
    const testScore = Number(record.testScore ?? Number.NaN);
    return {
      id: `${record.modelName ?? fallbackLabel}-${index}`,
      label: String(record.modelName ?? fallbackLabel),
      primaryValue: score.toFixed(3),
      normalizationValue: score,
      detail: `train ${formatMaybeMetric(trainScore)} · test ${formatMaybeMetric(testScore)}`,
    };
  }

  if (visualization.type === "feature_importance") {
    const importance = Number(record.importance ?? 0);
    return {
      id: `${record.feature ?? fallbackLabel}-${index}`,
      label: String(record.feature ?? fallbackLabel),
      primaryValue: importance.toFixed(3),
      normalizationValue: importance,
      detail: `source column: ${String(record.sourceColumn ?? "derived feature")}`,
    };
  }

  if (visualization.type === "feature_type_breakdown") {
    const count = Number(record.count ?? 0);
    return {
      id: `${record.label ?? fallbackLabel}-${index}`,
      label: String(record.label ?? fallbackLabel),
      primaryValue: `${count.toLocaleString()} features`,
      normalizationValue: count,
      detail: "Detected during schema profiling",
    };
  }

  const score = Number(
    record.ratio ?? record.score ?? record.importance ?? record.missingRatio ?? record.count ?? 0,
  );
  const label = String(
    record.label ??
      record.modelName ??
      record.feature ??
      record.column ??
      record.sourceColumn ??
      fallbackLabel,
  );

  return {
    id: `${label}-${index}`,
    label,
    primaryValue: Number.isFinite(score) ? score.toFixed(3) : "0.000",
    normalizationValue: Number.isFinite(score) ? score : 0,
    detail: "",
  };
}

function buildLineSpec(visualization: Visualization) {
  if (visualization.type === "roc_curve") {
    const data = visualization.data as { fpr?: number[]; tpr?: number[] } | undefined;
    return {
      xLabel: "False Positive Rate",
      yLabel: "True Positive Rate",
      xMin: 0,
      xMax: 1,
      yMin: 0,
      yMax: 1,
      note: visualization.title,
      points: pairArrays(data?.fpr ?? [], data?.tpr ?? []),
    };
  }

  if (visualization.type === "pr_curve") {
    const data = visualization.data as { recall?: number[]; precision?: number[] } | undefined;
    return {
      xLabel: "Recall",
      yLabel: "Precision",
      xMin: 0,
      xMax: 1,
      yMin: 0,
      yMax: 1,
      note: `${(data?.precision?.length ?? 0).toLocaleString()} threshold checkpoints`,
      points: pairArrays(data?.recall ?? [], data?.precision ?? []),
    };
  }

  if (visualization.type === "residual_plot") {
    const rows = Array.isArray(visualization.data) ? visualization.data : [];
    const residuals = rows
      .map((row) => Number((row as Record<string, unknown>).residual ?? 0))
      .filter((value) => Number.isFinite(value));
    const minResidual = Math.min(...residuals, 0);
    const maxResidual = Math.max(...residuals, 0);
    return {
      xLabel: "Sample index",
      yLabel: "Residual",
      xMin: 0,
      xMax: Math.max(rows.length - 1, 1),
      yMin: minResidual,
      yMax: maxResidual,
      note: `${rows.length.toLocaleString()} scored examples`,
      points: rows.slice(0, 60).map((row, index) => ({
        x: normalize(index, 0, Math.max(rows.length - 1, 1)),
        y: normalize(Number((row as Record<string, unknown>).residual ?? 0), minResidual, maxResidual || 1),
      })),
    };
  }

  const rows = Array.isArray(visualization.data) ? visualization.data : [];
  const actuals = rows
    .map((row) => Number((row as Record<string, unknown>).actual ?? 0))
    .filter((value) => Number.isFinite(value));
  const predictions = rows
    .map((row) => Number((row as Record<string, unknown>).predicted ?? 0))
    .filter((value) => Number.isFinite(value));
  const minActual = Math.min(...actuals, 0);
  const maxActual = Math.max(...actuals, 1);
  const minPredicted = Math.min(...predictions, 0);
  const maxPredicted = Math.max(...predictions, 1);

  return {
    xLabel: "Actual value",
    yLabel: "Predicted value",
    xMin: minActual,
    xMax: maxActual,
    yMin: minPredicted,
    yMax: maxPredicted,
    note: `${rows.length.toLocaleString()} actual vs predicted comparisons`,
    points: rows.slice(0, 60).map((row) => ({
      x: normalize(Number((row as Record<string, unknown>).actual ?? 0), minActual, maxActual || 1),
      y: normalize(
        Number((row as Record<string, unknown>).predicted ?? 0),
        minPredicted,
        maxPredicted || 1,
      ),
    })),
  };
}

function pairArrays(left: number[], right: number[]) {
  return left.slice(0, Math.min(left.length, right.length)).map((value, index) => ({
    x: clamp01(value),
    y: clamp01(right[index] ?? 0),
  }));
}

function normalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const span = max - min;
  if (span <= 0) {
    return 0.5;
  }

  return clamp01((value - min) / span);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatMaybeMetric(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? "n/a" : value.toFixed(3);
}

function formatImprovement(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function formatAxisValue(value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  return value.toFixed(2);
}

function EmptyMessage({ text, compact = false }: { text: string; compact?: boolean }) {
  return <p className={compact ? "empty-message compact" : "empty-message"}>{text}</p>;
}
