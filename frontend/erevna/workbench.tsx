"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EvidenceWorkspace } from "@/frontend/erevna/components/evidence-workspace";
import { TopologyMatrix } from "@/frontend/erevna/components/topology-matrix";
import {
  STAGES,
  artifactBundleName,
  buildCandidateOptions,
  buildPredictionSeed,
  buildStageIntel,
  buildSummaryCards,
  coercePredictionPayload,
  downloadableArtifacts,
  getStageStatusMap,
  humanizeTaskSubtype,
  isResearchStage,
  normalizeResolveMessages,
  normalizeRunMessages,
  pickSuggestedTarget,
  preferredArtifactId,
  pythonBundleName,
  summaryToText,
  visibleVisualizations,
  type ShellMessage,
  type ShellPhase,
  type SourceMode,
} from "@/frontend/erevna/lib/stages";
import type {
  AgentStatus,
  LabPredictionResponse,
  LabRunError,
  LabRunResult,
  ResearchHypothesis,
  SourceResolveResult,
} from "@/lib/erevna/types";

// Backend SSE event shape (from research-pipeline.ts).
type BackendStatusEvent = {
  id: string;
  agent: string;
  stageId: string;
  status: "running" | "complete" | "queued" | "failed";
  message: string;
  timestamp: string;
  data?: unknown;
};

type BackendLiteraturePaper = {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  url: string;
  pdfUrl?: string;
  published?: string;
};

type BackendCompleteEvent = {
  runId: string;
  researchQuestion: string;
  hypothesis: ResearchHypothesis;
  intentPrompt: string;
  literature: {
    papers: BackendLiteraturePaper[];
    summary: string;
    keyFindings: string[];
  };
  events: BackendStatusEvent[];
};

type BackendErrorPayload = {
  error: string;
  details?: string;
  upstreamStatus?: number;
};

const STAGE_ID_MAP: Record<string, string> = {
  literature: "literature-review",
  hypothesis: "hypothesis",
};

const AGENT_LABEL: Record<string, string> = {
  IntentAgent: "Intent Agent",
  LiteratureAgent: "Literature Agent",
  HypothesisAgent: "Hypothesis Agent",
  ModelingAgent: "Modeling Agent",
};

const SOURCE_MODE_LABELS: Record<SourceMode, string> = {
  kaggle: "Kaggle",
  upload: "Upload CSV",
  demo: "Demo CSV",
};

const DEFAULT_INTENT =
  "Test the hypothesis on the dataset, surface evidence, and package the model for reuse.";
const DEMO_DATASET_PATH = "/data/demo-churn.csv";
const DEMO_TARGET = "churn";

export function ErevnaWorkbench() {
  const [phase, setPhase] = useState<ShellPhase>("idle");
  const [researchQuestion, setResearchQuestion] = useState<string>("");
  const [draftQuestion, setDraftQuestion] = useState<string>("");
  const [messages, setMessages] = useState<ShellMessage[]>([]);
  const [hypothesis, setHypothesis] = useState<ResearchHypothesis | null>(null);
  const [literatureSummary, setLiteratureSummary] = useState<string>("");
  const [keyFindings, setKeyFindings] = useState<string[]>([]);
  const [papers, setPapers] = useState<BackendLiteraturePaper[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>(STAGES[0].id);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Dataset intake state (mirrors ML pipeline UX) ──────────────────────────
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [intentPrompt, setIntentPrompt] = useState<string>(DEFAULT_INTENT);
  const [kaggleInput, setKaggleInput] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCandidatePath, setSelectedCandidatePath] = useState<string>("");
  const [sourceResolution, setSourceResolution] = useState<SourceResolveResult | null>(null);
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [runResult, setRunResult] = useState<LabRunResult | null>(null);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [predictionValues, setPredictionValues] = useState<Record<string, string>>({});
  const [predictionResult, setPredictionResult] = useState<LabPredictionResponse | null>(null);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const kaggleResolveTimer = useRef<number | null>(null);
  const replayTimers = useRef<number[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      replayTimers.current.forEach((handle) => window.clearTimeout(handle));
      if (kaggleResolveTimer.current) {
        window.clearTimeout(kaggleResolveTimer.current);
      }
    };
  }, []);

  const stageStatusMap = useMemo(() => getStageStatusMap(messages, phase), [messages, phase]);
  const stageIntel = useMemo(
    () => buildStageIntel(selectedStageId, runResult, sourceResolution, messages),
    [messages, runResult, selectedStageId, sourceResolution],
  );
  const unlockedVisualizations = useMemo(
    () => visibleVisualizations(runResult, messages, selectedStageId),
    [messages, runResult, selectedStageId],
  );
  const summaryCards = useMemo(() => (runResult ? buildSummaryCards(runResult) : []), [runResult]);
  const artifacts = useMemo(() => downloadableArtifacts(runResult), [runResult]);

  const completedStageCount = useMemo(
    () => Object.values(stageStatusMap).filter((status) => status === "complete").length,
    [stageStatusMap],
  );

  const candidateOptions = sourceResolution ? buildCandidateOptions(sourceResolution) : [];
  const canRunLab =
    phase !== "running" &&
    Boolean(sourceResolution?.sourceToken && targetColumn.trim()) &&
    !isResolving;

  const handleRun = useCallback(async (question: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResearchQuestion(question);
    setMessages([]);
    setHypothesis(null);
    setLiteratureSummary("");
    setKeyFindings([]);
    setPapers([]);
    setErrorMessage(null);
    setPhase("resolving");
    setSelectedStageId("literature-review");

    setMessages([
      {
        id: "intent-bootstrap",
        agent: AGENT_LABEL.IntentAgent,
        stageId: "literature-review",
        status: "running",
        message: `Parsed the research question: "${question}".`,
      },
    ]);
    setPhase("running");

    try {
      const response = await fetch("/api/research/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ researchQuestion: question, stream: true }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errorPayload = (await response.json().catch(() => null)) as BackendErrorPayload | null;
        throw new Error(
          errorPayload?.details ?? errorPayload?.error ?? `Research run failed (HTTP ${response.status}).`,
        );
      }

      await consumeSseStream(response.body, {
        onStatus: handleStatusEvent,
        onComplete: handleCompleteEvent,
        onError: handleStreamError,
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      handleStreamError(error);
    }
  }, []);

  const handleStatusEvent = useCallback((event: BackendStatusEvent) => {
    const mappedStageId = STAGE_ID_MAP[event.stageId] ?? event.stageId;
    const agentLabel = AGENT_LABEL[event.agent] ?? event.agent;
    const status = mapBackendStatus(event.status);

    setMessages((current) => {
      const id = `${event.id}-${current.length}`;
      const next: ShellMessage = {
        id,
        agent: agentLabel,
        stageId: mappedStageId,
        status,
        message: event.message,
      };
      return appendOrReplace(current, next);
    });

    if (status !== "queued") {
      setSelectedStageId(mappedStageId);
    }

    if (event.agent === "LiteratureAgent" && event.status === "complete") {
      const data = event.data as { paperCount?: number; keyFindings?: string[] } | undefined;
      if (data?.keyFindings) {
        setKeyFindings(data.keyFindings);
      }
    }

    if (event.agent === "HypothesisAgent" && event.status === "complete") {
      const hypothesisPayload = event.data as ResearchHypothesis | undefined;
      if (hypothesisPayload?.hypothesis) {
        setHypothesis({
          hypothesis: hypothesisPayload.hypothesis,
          predictedTarget: hypothesisPayload.predictedTarget ?? "",
          suggestedFeatures: Array.isArray(hypothesisPayload.suggestedFeatures)
            ? hypothesisPayload.suggestedFeatures
            : [],
        });
      }
    }
  }, []);

  const handleCompleteEvent = useCallback((payload: BackendCompleteEvent) => {
    if (payload.hypothesis?.hypothesis) {
      setHypothesis({
        hypothesis: payload.hypothesis.hypothesis,
        predictedTarget: payload.hypothesis.predictedTarget ?? "",
        suggestedFeatures: Array.isArray(payload.hypothesis.suggestedFeatures)
          ? payload.hypothesis.suggestedFeatures
          : [],
      });
    }
    if (payload.literature?.summary) {
      setLiteratureSummary(payload.literature.summary);
    }
    if (Array.isArray(payload.literature?.keyFindings)) {
      setKeyFindings(payload.literature.keyFindings);
    }
    if (Array.isArray(payload.literature?.papers)) {
      setPapers(payload.literature.papers);
    }
    setPhase("complete");
  }, []);

  const handleStreamError = useCallback((error: unknown) => {
    const details = error instanceof Error ? error.message : "The research run hit an unexpected error.";
    setErrorMessage(details);
    setPhase("error");
    setMessages((current) => [
      ...current,
      {
        id: `shell-error-${current.length + 1}`,
        agent: "Shell",
        stageId: "literature-review",
        status: "failed",
        message: details,
      },
    ]);
  }, []);

  // ── Dataset intake handlers ────────────────────────────────────────────────

  const clearReplayTimers = useCallback(() => {
    replayTimers.current.forEach((handle) => window.clearTimeout(handle));
    replayTimers.current = [];
  }, []);

  const applyResolvedSource = useCallback(
    (resolveResult: SourceResolveResult, preferredTarget?: string) => {
      clearReplayTimers();
      setSourceResolution(resolveResult);
      setRunResult(null);
      setPredictionResult(null);
      setActiveArtifactId(null);
      setSelectedCandidatePath(resolveResult.selectedFilePath ?? "");

      // Append source-resolution trace messages to whatever exists (research stages).
      const resolveMessages = normalizeResolveMessages(resolveResult);
      setMessages((current) => [
        ...current.filter((message) => !message.id.startsWith("local-intake")),
        ...resolveMessages,
      ]);

      setSelectedStageId(resolveResult.selectedFilePath ? "schema-profiling" : "source-resolution");
      setPhase(resolveResult.selectedFilePath ? "resolved" : "error");

      const inferred =
        preferredTarget ??
        (hypothesis?.predictedTarget && resolveResult.headers.includes(hypothesis.predictedTarget)
          ? hypothesis.predictedTarget
          : pickSuggestedTarget(resolveResult));
      setTargetColumn(inferred);

      if (!resolveResult.selectedFilePath) {
        setErrorMessage("Choose the CSV table you want Erevna to analyze.");
      } else {
        setErrorMessage(null);
      }
    },
    [clearReplayTimers, hypothesis],
  );

  const postResolveRequest = async (formData: FormData): Promise<SourceResolveResult> => {
    const response = await fetch("/api/lab/source/resolve", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as SourceResolveResult | LabRunError;
    if (!response.ok) {
      throw new Error(
        (payload as LabRunError).details ??
          (payload as LabRunError).error ??
          "Source resolution failed.",
      );
    }
    return payload as SourceResolveResult;
  };

  const resolveUploadSource = useCallback(
    async (file: File, preferredTarget?: string) => {
      clearReplayTimers();
      setPhase("resolving");
      setIsResolving(true);
      setErrorMessage(null);
      setRunResult(null);
      setPredictionResult(null);
      setMessages((current) => [
        ...current,
        {
          id: `local-intake-${Date.now()}`,
          agent: "Source Intake Agent",
          stageId: "source-intake",
          status: "running",
          message: `Reading ${file.name} and preparing a structured preview.`,
        },
      ]);

      try {
        const formData = new FormData();
        formData.set("file", file, file.name);
        const resolveResult = await postResolveRequest(formData);
        applyResolvedSource(resolveResult, preferredTarget);
      } catch (error) {
        handleLabError(error);
      } finally {
        setIsResolving(false);
      }
    },
    [applyResolvedSource, clearReplayTimers],
  );

  const resolveKaggleSource = useCallback(async () => {
    if (!kaggleInput.trim()) return;
    clearReplayTimers();
    setPhase("resolving");
    setIsResolving(true);
    setErrorMessage(null);
    setMessages((current) => [
      ...current,
      {
        id: `kaggle-source-intake-${Date.now()}`,
        agent: "Connector Agent",
        stageId: "source-intake",
        status: "running",
        message: "Parsing Kaggle input and requesting dataset resolution.",
      },
    ]);

    try {
      const formData = new FormData();
      formData.set("kaggleInput", kaggleInput.trim());
      if (selectedCandidatePath.trim()) {
        formData.set("selectedFilePath", selectedCandidatePath.trim());
      }
      const resolveResult = await postResolveRequest(formData);
      applyResolvedSource(resolveResult);
    } catch (error) {
      handleLabError(error);
    } finally {
      setIsResolving(false);
    }
  }, [applyResolvedSource, clearReplayTimers, kaggleInput, selectedCandidatePath]);

  const handleUploadSelected = useCallback(
    async (file: File | null) => {
      setSourceMode("upload");
      setSelectedFile(file);
      setSelectedCandidatePath("");
      setSourceResolution(null);
      setRunResult(null);
      setPredictionResult(null);
      setActiveArtifactId(null);
      if (!file) {
        setTargetColumn("");
        return;
      }
      await resolveUploadSource(file);
    },
    [resolveUploadSource],
  );

  const handleLoadDemoDataset = useCallback(async () => {
    setSourceMode("demo");
    setErrorMessage(null);
    try {
      const response = await fetch(DEMO_DATASET_PATH);
      const blob = await response.blob();
      const file = new File([blob], "demo-churn.csv", { type: "text/csv" });
      setSelectedFile(file);
      setSelectedCandidatePath("");
      await resolveUploadSource(file, DEMO_TARGET);
    } catch (error) {
      handleLabError(error);
    }
  }, [resolveUploadSource]);

  // Debounced auto-resolve for Kaggle input.
  useEffect(() => {
    if (sourceMode !== "kaggle" || !kaggleInput.trim()) return;
    if (kaggleResolveTimer.current) {
      window.clearTimeout(kaggleResolveTimer.current);
    }
    kaggleResolveTimer.current = window.setTimeout(() => {
      void resolveKaggleSource();
    }, 650);
    return () => {
      if (kaggleResolveTimer.current) {
        window.clearTimeout(kaggleResolveTimer.current);
      }
    };
  }, [kaggleInput, selectedCandidatePath, sourceMode, resolveKaggleSource]);

  // When the hypothesis lands and matches a header, prefer it as the target.
  useEffect(() => {
    if (!hypothesis?.predictedTarget || !sourceResolution) return;
    if (sourceResolution.headers.includes(hypothesis.predictedTarget)) {
      setTargetColumn(hypothesis.predictedTarget);
    }
  }, [hypothesis, sourceResolution]);

  function handleLabError(error: unknown) {
    clearReplayTimers();
    const details = error instanceof Error ? error.message : "The lab hit an unexpected error.";
    setPhase("error");
    setErrorMessage(details);
    setMessages((current) => [
      ...current,
      {
        id: `lab-error-${current.length + 1}`,
        agent: "Lab",
        stageId: selectedStageId,
        status: "failed",
        message: details,
      },
    ]);
  }

  const replayRunTrace = useCallback(
    (result: LabRunResult) => {
      const runMessages = normalizeRunMessages(result);
      runMessages.forEach((message, index) => {
        const delay = 220 * (index + 1);
        const handle = window.setTimeout(() => {
          setMessages((current) => [...current, message]);
          setSelectedStageId(message.stageId);
        }, delay);
        replayTimers.current.push(handle);
      });

      const completionDelay = runMessages.length * 220 + 280;
      const completionHandle = window.setTimeout(() => {
        setPhase("complete");
        setSelectedStageId("export");
      }, completionDelay);
      replayTimers.current.push(completionHandle);
    },
    [],
  );

  const handleRunLab = useCallback(async () => {
    if (!sourceResolution?.sourceToken || !targetColumn.trim()) return;
    clearReplayTimers();
    setPhase("running");
    setErrorMessage(null);
    setRunResult(null);
    setPredictionResult(null);
    setActiveArtifactId(null);
    setSelectedStageId("preprocessing");
    setMessages((current) => [
      ...current,
      {
        id: `runtime-start-${current.length + 1}`,
        agent: "Run Controller",
        stageId: "preprocessing",
        status: "running",
        message: `Launching the lab on target "${targetColumn}".`,
      },
    ]);

    try {
      const formData = new FormData();
      formData.set("sourceToken", sourceResolution.sourceToken);
      formData.set("targetColumn", targetColumn.trim());
      formData.set("intentPrompt", intentPrompt.trim());

      const response = await fetch("/api/lab/run", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as LabRunResult | LabRunError;
      if (!response.ok) {
        throw new Error(
          (payload as LabRunError).details ??
            (payload as LabRunError).error ??
            "Lab run failed.",
        );
      }
      const result = payload as LabRunResult;
      setRunResult(result);
      setPredictionValues(buildPredictionSeed(result.predictionInputSchema?.fields ?? []));
      setActiveArtifactId(preferredArtifactId(downloadableArtifacts(result)));
      replayRunTrace(result);
    } catch (error) {
      handleLabError(error);
    }
  }, [clearReplayTimers, intentPrompt, replayRunTrace, sourceResolution, targetColumn]);

  const handlePredict = useCallback(async () => {
    if (!runResult?.predictionInputSchema) return;
    setIsPredicting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/lab/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: runResult.runId,
          input: coercePredictionPayload(
            runResult.predictionInputSchema.fields,
            predictionValues,
          ),
        }),
      });
      const payload = (await response.json()) as LabPredictionResponse | LabRunError;
      if (!response.ok) {
        throw new Error(
          (payload as LabRunError).details ??
            (payload as LabRunError).error ??
            "Prediction failed.",
        );
      }
      setPredictionResult(payload as LabPredictionResponse);
    } catch (error) {
      handleLabError(error);
    } finally {
      setIsPredicting(false);
    }
  }, [predictionValues, runResult]);

  const handleDownloadArtifact = useCallback(
    (artifact: { filename: string; content: string }) => {
      downloadBlob(
        artifact.filename,
        new Blob([artifact.content], { type: "text/plain;charset=utf-8" }),
      );
    },
    [],
  );

  const handleDownloadBundle = useCallback(async () => {
    if (!runResult) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    artifacts.forEach((artifact) => {
      zip.file(artifact.filename, artifact.content);
    });
    zip.file("plain-english-summary.txt", summaryToText(runResult.plainEnglishSummary));
    zip.file("run.json", JSON.stringify(runResult, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(artifactBundleName(runResult), blob);
  }, [artifacts, runResult]);

  const handleDownloadPythonBundle = useCallback(async () => {
    if (!runResult) return;
    const pythonArtifacts = artifacts.filter((artifact) => artifact.filename.endsWith(".py"));
    if (!pythonArtifacts.length) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    pythonArtifacts.forEach((artifact) => {
      zip.file(artifact.filename, artifact.content);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(pythonBundleName(runResult), blob);
  }, [artifacts, runResult]);

  const submit = () => {
    const trimmed = draftQuestion.trim();
    if (!trimmed || phase === "running" || phase === "resolving") return;
    void handleRun(trimmed);
  };

  const isBusy = phase === "running" || phase === "resolving";
  const phaseLabel = resolvePhaseLabel(phase);
  const statusTone =
    phase === "running" || phase === "resolving"
      ? "tone-running"
      : phase === "complete"
        ? "tone-complete"
        : phase === "error"
          ? "tone-failed"
          : "tone-idle";

  return (
    <div className="erevna-command-shell">
      <section className="command-intake-row">
        <aside className="command-card source-card">
          <div className="card-header">
            <span className="shell-kicker">Research Intake</span>
            <h2>Frame the research question</h2>
            <p className="source-intro">
              Type a plain-English research question. Erevna runs the literature review, forms a
              testable hypothesis, and hands off to the ML pipeline.
            </p>
          </div>

          <div className="research-terminal">
            <span className="terminal-prompt" aria-hidden="true">
              &gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              className="research-terminal-input"
              placeholder="Enter your research question..."
              value={draftQuestion}
              spellCheck={false}
              autoComplete="off"
              disabled={isBusy}
              onChange={(event) => setDraftQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          <div className={`research-status ${statusTone}`} aria-live="polite">
            <span>STATUS:</span>
            <strong>{phaseLabel}</strong>
            <span className="research-status-pulse" aria-hidden="true" />
          </div>

          <div className="source-footer">
            <div className="source-detail">
              <span>Stages</span>
              <strong>
                {completedStageCount}/{STAGES.length}
              </strong>
            </div>
            <div className="source-detail">
              <span>Papers</span>
              <strong>{papers.length}</strong>
            </div>
          </div>

          <button
            type="button"
            className="shell-button primary"
            disabled={isBusy || !draftQuestion.trim()}
            onClick={submit}
          >
            {isBusy ? "Running ..." : "[ RUN ]"}
          </button>
        </aside>

        <aside className="command-card source-card">
          <div className="card-header">
            <span className="shell-kicker">Dataset Intake</span>
            <h2>Run the model on real data</h2>
            <p className="source-intro">
              Upload a CSV, paste a Kaggle reference, or load the bundled demo. Erevna profiles the
              dataset, frames the task, and trains real models against the hypothesis target.
            </p>
          </div>

          <div className="mode-toggle">
            {(["upload", "kaggle", "demo"] as SourceMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={sourceMode === mode ? "shell-button active" : "shell-button"}
                onClick={() => {
                  setSourceMode(mode);
                  setErrorMessage(null);
                  setRunResult(null);
                  setSourceResolution(null);
                  setTargetColumn(mode === "demo" ? DEMO_TARGET : "");
                  setPhase((current) => (current === "complete" ? "idle" : current));
                }}
              >
                {SOURCE_MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {sourceMode === "kaggle" ? (
            <label className="shell-field">
              <span>Kaggle link, slug, or code snippet</span>
              <textarea
                rows={5}
                value={kaggleInput}
                onChange={(event) => {
                  setKaggleInput(event.target.value);
                  setSelectedCandidatePath("");
                  setSourceResolution(null);
                  setRunResult(null);
                  setPredictionResult(null);
                  setPhase("idle");
                }}
                placeholder='Paste something like path = kagglehub.dataset_download("owner/dataset")'
              />
            </label>
          ) : null}

          {sourceMode === "upload" ? (
            <label className="shell-field">
              <span>Upload CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleUploadSelected(event.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}

          {sourceMode === "demo" ? (
            <button
              type="button"
              className="shell-button primary"
              onClick={() => void handleLoadDemoDataset()}
            >
              Load bundled demo dataset
            </button>
          ) : null}

          {candidateOptions.length > 1 ? (
            <label className="shell-field">
              <span>Dataset table</span>
              <select
                value={selectedCandidatePath}
                onChange={(event) => setSelectedCandidatePath(event.target.value)}
              >
                <option value="">Choose the CSV table to analyze</option>
                {candidateOptions.map((option) => (
                  <option key={option.path} value={option.path}>
                    {option.label}
                    {option.meta ? ` · ${option.meta}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="shell-field">
            <span>Describe the ML project</span>
            <textarea
              rows={3}
              value={intentPrompt}
              onChange={(event) => setIntentPrompt(event.target.value)}
              placeholder="What should this model detect, forecast, or explain?"
            />
          </label>

          <label className="shell-field">
            <span>What should we predict?</span>
            <select
              value={targetColumn}
              onChange={(event) => setTargetColumn(event.target.value)}
              disabled={!sourceResolution?.headers.length}
            >
              <option value="">Choose a prediction target</option>
              {sourceResolution?.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>

          {sourceResolution?.targetSuggestions.length ? (
            <div className="suggestion-stack">
              {sourceResolution.targetSuggestions.map((suggestion) => (
                <button
                  key={suggestion.column}
                  type="button"
                  className={
                    suggestion.column === targetColumn ? "suggestion-pill active" : "suggestion-pill"
                  }
                  onClick={() => setTargetColumn(suggestion.column)}
                >
                  {suggestion.column} · {Math.round(suggestion.confidence * 100)}%
                </button>
              ))}
            </div>
          ) : null}

          <div className="source-footer">
            <div className="source-detail">
              <span>Resolved table</span>
              <strong>{sourceResolution?.selectedFilePath ?? "pending"}</strong>
            </div>
            <div className="source-detail">
              <span>Detected columns</span>
              <strong>{sourceResolution?.headers.length ?? 0}</strong>
            </div>
          </div>

          <button
            type="button"
            className="shell-button primary"
            disabled={!canRunLab}
            onClick={() => void handleRunLab()}
          >
            {phase === "running" ? "Training models ..." : "Run dataset"}
          </button>
        </aside>

        <header className="shell-header shell-header-compact">
          <div className="brand-lockup">
            <span className="shell-kicker">Erevna</span>
            <h1>Autonomous research lab.</h1>
            <p>
              Ask a research question. Erevna searches the literature, forms a hypothesis,
              and runs the modeling pipeline with evidence and a packaged report.
            </p>
          </div>

          <div className="header-metrics">
            <div className="header-chip">
              <span>Status</span>
              <strong>{phaseLabel}</strong>
            </div>
            <div className="header-chip">
              <span>Source</span>
              <strong>{sourceResolution?.sourceLabel ?? "waiting"}</strong>
            </div>
            <div className="header-chip">
              <span>Solver</span>
              <strong>
                {runResult
                  ? `${humanizeTaskSubtype(runResult.problemFraming.taskSubtype)} · ${runResult.bestModel.modelName}`
                  : hypothesis
                    ? "hypothesis ready"
                    : "pending"}
              </strong>
            </div>
            <div className="header-chip">
              <span>Metric</span>
              <strong>{runResult?.problemFraming.primaryMetric ?? "waiting"}</strong>
            </div>
          </div>
        </header>
      </section>

      <section className="command-grid-top command-grid-core">
        <section className="command-card topology-card">
          <div className="card-header">
            <span className="shell-kicker">Topology</span>
            <h2>How Erevna is researching</h2>
          </div>
          <TopologyMatrix
            selectedStageId={selectedStageId}
            stageStatusMap={stageStatusMap}
            onSelectStage={setSelectedStageId}
          />
        </section>

        <aside className="command-card intel-card">
          <div className="card-header">
            <span className="shell-kicker">Stage Intel</span>
            <h2>{stageIntel.title}</h2>
          </div>
          <p className="intel-copy">{stageIntel.description}</p>
          <div className="intel-highlight">
            <strong>{stageIntel.callout}</strong>
          </div>
          {stageIntel.details.length ? (
            <div className="intel-stack">
              {stageIntel.details.map((detail) => (
                <p key={detail}>{detail}</p>
              ))}
            </div>
          ) : null}
          {selectedStageId === "literature-review" && keyFindings.length ? (
            <div className="framing-block">
              <span className="shell-kicker">Key findings</span>
              <div className="bullet-stack">
                {keyFindings.slice(0, 4).map((finding) => (
                  <p key={finding}>{finding}</p>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="command-grid-middle">
        <article className="command-card trace-card">
          <div className="card-header">
            <span className="shell-kicker">Assistant Rail</span>
            <h2>Resolution and run trace</h2>
          </div>
          <div className="trace-list" aria-live="polite">
            {messages.length ? (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`trace-item tone-${message.status} ${stageAccentClass(message.stageId)}`}
                >
                  <span>{message.agent}</span>
                  <strong>{message.message}</strong>
                </article>
              ))
            ) : (
              <article className="trace-item tone-queued">
                <span>Erevna</span>
                <strong>Type a research question to begin the pipeline.</strong>
              </article>
            )}
          </div>
        </article>

        <article className="command-card preview-card">
          <div className="card-header">
            <span className="shell-kicker">Resolved Literature</span>
            <h2>Papers and key findings</h2>
          </div>
          {papers.length ? (
            <div className="preview-table">
              <div
                className="preview-head"
                style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 0.6fr)" }}
              >
                <span>Title</span>
                <span>Authors</span>
                <span>Published</span>
              </div>
              {papers.slice(0, 10).map((paper) => (
                <div
                  key={paper.id}
                  className="preview-row"
                  style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 0.6fr)" }}
                >
                  <span>
                    <a href={paper.url} target="_blank" rel="noreferrer">
                      {paper.title}
                    </a>
                  </span>
                  <span>{paper.authors.slice(0, 2).join(", ")}{paper.authors.length > 2 ? ", …" : ""}</span>
                  <span>{paper.published?.slice(0, 10) ?? "—"}</span>
                </div>
              ))}
            </div>
          ) : researchQuestion ? (
            <p className="empty-message">
              Searching arXiv. The literature table appears here once the Literature Agent returns.
            </p>
          ) : (
            <p className="empty-message">
              Submit a research question to resolve the literature and surface relevant papers.
            </p>
          )}
          {literatureSummary ? (
            <div className="intel-highlight">
              <strong>{literatureSummary}</strong>
            </div>
          ) : null}
        </article>
      </section>

      <EvidenceWorkspace
        hypothesis={hypothesis}
        runResult={runResult}
        summaryCards={summaryCards}
        visualizations={unlockedVisualizations}
        artifacts={artifacts}
        activeArtifactId={activeArtifactId}
        onSelectArtifact={setActiveArtifactId}
        onSelectStage={setSelectedStageId}
        onDownloadArtifact={handleDownloadArtifact}
        onDownloadBundle={() => void handleDownloadBundle()}
        onDownloadPythonBundle={() => void handleDownloadPythonBundle()}
        predictionValues={predictionValues}
        predictionResult={predictionResult}
        isPredicting={isPredicting}
        onPredictionChange={(fieldName, value) =>
          setPredictionValues((current) => ({ ...current, [fieldName]: value }))
        }
        onPredict={() => void handlePredict()}
      />

      {errorMessage ? (
        <section className="shell-error-banner">
          <span className="shell-kicker">Shell error</span>
          <p>{errorMessage}</p>
        </section>
      ) : null}
    </div>
  );
}

function appendOrReplace(messages: ShellMessage[], next: ShellMessage): ShellMessage[] {
  const lastForStageIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.stageId === next.stageId)?.index;

  if (
    lastForStageIndex !== undefined &&
    messages[lastForStageIndex].status === "running" &&
    next.status !== "running"
  ) {
    const replaced = messages.slice();
    replaced[lastForStageIndex] = next;
    return replaced;
  }

  return [...messages, next];
}

function mapBackendStatus(status: BackendStatusEvent["status"]): AgentStatus {
  if (status === "complete") return "complete";
  if (status === "running") return "running";
  if (status === "queued") return "queued";
  return "failed";
}

function stageAccentClass(stageId: string): string {
  if (stageId === "literature-review") return "accent-research-literature";
  if (stageId === "hypothesis") return "accent-research-hypothesis";
  if (isResearchStage(stageId)) return "accent-research-literature";
  return "accent-ml";
}

function resolvePhaseLabel(phase: ShellPhase): string {
  if (phase === "resolving") return "resolving …";
  if (phase === "running") return "running …";
  if (phase === "complete") return "complete";
  if (phase === "error") return "attention needed";
  if (phase === "resolved") return "ready to run";
  return "waiting";
}

function truncate(value: string, maxLength: number): string {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

type SseHandlers = {
  onStatus: (event: BackendStatusEvent) => void;
  onComplete: (payload: BackendCompleteEvent) => void;
  onError: (error: unknown) => void;
};

async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  handlers: SseHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split("\n\n");
    buffer = segments.pop() ?? "";

    for (const segment of segments) {
      if (!segment.trim()) continue;
      const event = parseSseSegment(segment);
      if (!event) continue;

      try {
        if (event.event === "status") {
          handlers.onStatus(JSON.parse(event.data) as BackendStatusEvent);
        } else if (event.event === "complete") {
          handlers.onComplete(JSON.parse(event.data) as BackendCompleteEvent);
        } else if (event.event === "error") {
          const parsed = JSON.parse(event.data) as BackendErrorPayload;
          handlers.onError(new Error(parsed.details ?? parsed.error ?? "Stream error."));
        }
      } catch (error) {
        handlers.onError(error);
      }
    }
  }
}

function parseSseSegment(segment: string): { event: string; data: string } | null {
  const lines = segment.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
