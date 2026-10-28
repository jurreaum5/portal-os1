import { useState } from "react";
import { api } from "../api/client";
import { divisions } from "../../../../uss/contracts";
export function SimulationRegistration({ onChange }: { onChange: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <h2>Register a simulation</h2>
      <p>
        Compound growth scenario · version 1. Inputs, uncertainty, outputs and
        replay evidence remain attached to a stable identity.
      </p>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const n = (key: string) => Number(data.get(key));
          const value = (key: string) => String(data.get(key));
          setBusy(true);
          setError("");
          const confidence = {
            confidence: n("confidence"),
            probability: null,
            risk: value("risk"),
            assumptions: [value("assumptions")],
            range: {
              lower: n("lower"),
              upper: n("upper"),
              unit: value("unit"),
            },
          };
          void api("/api/uss/records", {
            method: "POST",
            body: JSON.stringify({
              registry: "simulation",
              title: value("title"),
              owner: value("owner"),
              division: value("division"),
              lifecycle: "proposed",
              references: [],
              uncertainty: confidence,
              content: {
                modelType: value("modelType"),
                modelVersion: "compound-growth-v1",
                source: value("source"),
                inputs: {
                  initial: n("initial"),
                  rate: n("rate"),
                  steps: n("steps"),
                },
                confidence,
              },
            }),
          })
            .then(() => onChange())
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {["title", "owner", "source", "risk", "assumptions", "unit"].map(
          (name) => (
            <div key={name}>
              <label htmlFor={`sim-${name}`}>
                {name[0].toUpperCase() + name.slice(1)}
              </label>
              <input id={`sim-${name}`} name={name} required maxLength={200} />
            </div>
          ),
        )}
        <label htmlFor="sim-division">Division</label>
        <select id="sim-division" name="division">
          {divisions.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label htmlFor="sim-type">Model domain</label>
        <select id="sim-type" name="modelType">
          {[
            "product",
            "sports",
            "forecast",
            "scenario",
            "market",
            "department",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {(
          [
            {
              name: "initial",
              label: "Initial value",
              step: "any",
              value: 100,
            },
            {
              name: "rate",
              label: "Growth rate per step (fraction)",
              step: "any",
              value: 0.1,
              min: -1,
              max: 10,
            },
            {
              name: "steps",
              label: "Number of steps",
              step: 1,
              value: 3,
              min: 0,
              max: 120,
            },
            {
              name: "confidence",
              label: "Declared confidence (0–1)",
              step: "any",
              value: 0.5,
              min: 0,
              max: 1,
            },
            {
              name: "lower",
              label: "Forecast range lower bound",
              step: "any",
              value: 90,
            },
            {
              name: "upper",
              label: "Forecast range upper bound",
              step: "any",
              value: 150,
            },
          ] as const
        ).map((field) => (
          <div key={field.name}>
            <label htmlFor={`sim-${field.name}`}>{field.label}</label>
            <input
              id={`sim-${field.name}`}
              name={field.name}
              type="number"
              step={field.step}
              min={"min" in field ? field.min : undefined}
              max={"max" in field ? field.max : undefined}
              defaultValue={field.value}
              required
            />
          </div>
        ))}
        <button disabled={busy}>Register for review</button>
      </form>
    </section>
  );
}
