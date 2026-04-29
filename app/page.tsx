export default function HomePage() {
  return (
    <main className="research-shell">
      <section className="status-panel" aria-labelledby="research-title">
        <p className="eyebrow">Research Lab AI</p>
        <h1 id="research-title">TokenRouter foundation is ready.</h1>
        <p className="lede">
          Server-side routing is isolated behind a small backend client, with a development smoke
          check available before the research agents are wired in.
        </p>
        <div className="status-grid" aria-label="Current integration status">
          <span>Model</span>
          <strong>auto:balance</strong>
          <span>Smoke route</span>
          <strong>/api/tokenrouter-smoke</strong>
          <span>Runtime</span>
          <strong>server only</strong>
        </div>
      </section>
    </main>
  );
}
