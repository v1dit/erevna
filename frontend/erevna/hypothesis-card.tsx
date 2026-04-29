"use client";

import type { ResearchHypothesis } from "@/lib/erevna/types";

type HypothesisCardProps = {
  hypothesis: ResearchHypothesis | null;
};

export function HypothesisCard({ hypothesis }: HypothesisCardProps) {
  if (!hypothesis) {
    return (
      <article className="hypothesis-card pending">
        <div className="hypothesis-card-header">
          <span className="shell-kicker">Hypothesis</span>
          <h3>Awaiting hypothesis</h3>
        </div>
        <p className="hypothesis-card-pending">
          Submit a research question to form the testable hypothesis.
        </p>
      </article>
    );
  }

  return (
    <article className="hypothesis-card">
      <div className="hypothesis-card-header">
        <span className="shell-kicker">Hypothesis</span>
        <h3>Testable claim under investigation</h3>
      </div>
      <p className="hypothesis-text">{hypothesis.hypothesis}</p>
      <div className="hypothesis-meta">
        <div className="hypothesis-meta-row">
          <span>Predicted Target</span>
          <strong>{hypothesis.predictedTarget || "—"}</strong>
        </div>
        <div className="hypothesis-meta-row">
          <span>Key Features</span>
          <strong>
            {hypothesis.suggestedFeatures.length
              ? hypothesis.suggestedFeatures.join(", ")
              : "—"}
          </strong>
        </div>
      </div>
    </article>
  );
}
