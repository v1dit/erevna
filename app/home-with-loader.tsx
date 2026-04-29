"use client";

import { useEffect, useState } from "react";
import { ErevnaWorkbench } from "@/frontend/erevna/workbench";

const LOAD_MS = 1100;

export function HomeWithLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), LOAD_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <>
      <section className="erevna-splash" aria-busy={!ready} aria-live="polite">
        <div className="erevna-splash__glow" aria-hidden />
        <div className="erevna-splash__inner">
          <p className="erevna-splash__kicker">Erevna</p>
          <h1 className="erevna-splash__title">Autonomous research lab</h1>
          <p className="erevna-splash__status">
            {ready ? (
              <a className="erevna-splash__link" href="#erevna-workbench">
                Scroll for the workbench ↓
              </a>
            ) : (
              <span className="erevna-splash__loading">Loading…</span>
            )}
          </p>
          {!ready ? (
            <div className="erevna-splash__dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>
      </section>

      <div id="erevna-workbench" className="erevna-workbench-anchor">
        <ErevnaWorkbench />
      </div>
    </>
  );
}
