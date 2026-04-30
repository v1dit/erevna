# Erevna

**Autonomous End-to-End Research System**

> One question in. Complete research out.

**Top 10** at the **YC × AWS** hackathon.

---

## Overview

Erevna is an autonomous multi-agent system that executes the full scientific research workflow end-to-end.

A user provides a natural language research question. The system:

* finds relevant literature
* forms a hypothesis
* selects and processes data
* trains and evaluates machine learning models
* generates a structured research output

All without human intervention.

This is not a chatbot.
This is a system that **performs research**.

---

## The Problem

Research today is fragmented and manual.

To answer a single empirical question, you must:

* search and read papers
* decide what’s relevant
* formulate hypotheses
* find and clean datasets
* write and run ML experiments
* interpret results

Even with AI tools, the human remains the orchestrator.

The bottleneck isn’t compute — it’s **coordination**.

---

## The Solution

Erevna removes the human from the loop.

Instead of assisting each step, it executes the entire pipeline:

```
Research Question
      ↓
Literature Agent
      ↓
Hypothesis Agent
      ↓
Data Intake + Processing
      ↓
Model Training + Evaluation
      ↓
Prediction + Output
```

Each step is handled by a specialized agent.

---

## Differentiation

Existing platforms like Orchestra focus on *AI-assisted research*.

Erevna is **autonomous research**.

| Feature              | Orchestra | Erevna          |
| -------------------- | --------- | --------------- |
| Human in loop        | Yes       | No              |
| Step-by-step control | Required  | None            |
| Execution            | Assisted  | Autonomous      |
| Output               | Insights  | Full experiment |

Erevna doesn’t help you do research.

It **does the research for you**.

---

## Architecture

Erevna is a multi-agent system built on three core layers:

---

### 1. Intelligence Layer — TokenRouter

All agent reasoning flows through TokenRouter.

* Routes LLM calls across agents
* Enables model selection per task
* Optimizes cost vs performance
* Provides observability into token usage

```ts
baseURL: "https://tokenrouter.url"
```

---

### 2. Execution Layer — Reboot (MCP)

Erevna uses Reboot as a Model Context Protocol (MCP) layer.

This exposes the system as tools the AI can call:

* `create_experiment`
* `start`
* `get_status`
* `predict`

Instead of:

```
AI → suggests → human executes
```

We have:

```
AI → calls tools → system executes
```

This is what enables **true autonomy**.

---

### 3. Output + Dev Layer — Lightspring

Lightspring is used for:

**Development**

* rapid prompt iteration
* refining agent outputs

**Output**

* structured research reports
* actionable artifacts for teams

---

## 🔬 Agents

Each phase of research is handled by a specialized agent:

| Agent            | Role                                        |
| ---------------- | ------------------------------------------- |
| Literature Agent | Searches arXiv and summarizes relevant work |
| Hypothesis Agent | Generates testable hypothesis + features    |
| Data Agent       | Parses and prepares dataset                 |
| Modeling Agent   | Trains and evaluates ML models              |
| Prediction Agent | Runs inference on unseen data               |
| Research Agent   | Generates final structured output           |

---

## Demo

Example:

**Input:**

```
Can Bitcoin’s next-week price direction be predicted from historical data?
```

**System Execution:**

* Finds financial time-series research
* Generates hypothesis (momentum + volatility signals)
* Loads Bitcoin dataset
* Trains models
* Outputs predictions and evaluation

---

## Tech Stack

| Layer           | Tech                                 |
| --------------- | ------------------------------------ |
| Backend         | TypeScript (Next.js API routes)      |
| ML              | Python (scikit-learn, pandas, NumPy) |
| LLM Routing     | TokenRouter                          |
| Agent Execution | Reboot MCP                           |
| Data Source     | arXiv API                            |
| Output          | Lightspring                          |

---

## ⚡ Getting Started

```bash
git clone https://github.com/your-repo/erevna
cd erevna
npm install
npm run dev
```

Run backend:

```bash
npm run start
```

Make sure to configure:

```
TOKENROUTER_API_KEY=your_key
```

---

## Example Flow

1. Submit research question
2. Agents execute sequentially
3. Pipeline runs automatically
4. Output generated + pushed to Lightsprint

---

## Limitations

* Limited dataset sourcing (manual or CSV upload)
* Uses standard ML models (scikit-learn)
* No deep time-series models yet
* Reasoning depends on available literature
* Single-run execution (no multi-iteration loop yet)

---

## Future Work

* Automated dataset discovery
* Advanced modeling (LSTM, transformers, time-series models)
* Multi-run experimentation + optimization loops
* Stronger statistical validation
* Cloud-based scaling for large workloads

---

## Vision

Erevna is not just an ML tool.

It’s a step toward **autonomous knowledge discovery systems**.

Instead of:

* researchers using tools

We move toward:

* systems performing research

---

## TL;DR

> Ask a question.
> Walk away.
> Get a research result.

---

## License

MIT
