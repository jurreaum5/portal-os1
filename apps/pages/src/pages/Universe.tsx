import { useState } from "react";
import { Link } from "react-router-dom";
import { getEcosystem } from "../api/universe";
import { useApi } from "../hooks/useApi";
import { AsyncState } from "../components/AsyncState";
import { UniverseSummary } from "../components/UniverseSummary";
import SportsIntelligence from "./SportsIntelligence";
export function UniverseNav() {
  return (
    <nav className="universe-tabs" aria-label="Universe scenes">
      {[
        ["/portal/universe", "Ecosystem Galaxy"],
        ["/portal/universe/products", "Product Constellation"],
        ["/portal/universe/pipeline", "Pipeline Universe"],
        ["/portal/universe/departments", "Department Operations"],
        ["/portal/universe/sports", "MAX Sports"],
        ["/portal/twin", "Relationship Map"],
      ].map(([to, label]) => (
        <Link key={to} to={to}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
export default function Universe({
  products = false,
  sports = false,
}: {
  products?: boolean;
  sports?: boolean;
}) {
  const state = useApi(getEcosystem, 15000),
    [metric, setMetric] = useState("revenue"),
    [search, setSearch] = useState("");
  const u = state.data;
  const rows =
    u?.products.filter(
      (p) =>
        (!sports || p.divisionId === "max-sports") &&
        p.name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const title = sports
    ? "MAX Sports"
    : products
      ? "Product constellation"
      : "Ecosystem galaxy";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAX UNIVERSE · LIVE ECOSYSTEM</div>
          <h1>
            {title}
            <span className="title-dot">.</span>
          </h1>
          <p>
            {sports
              ? "Intelligence across the world of sport."
              : products
                ? "Every product, its trajectory and the systems it depends on."
                : "One connected universe. Every division in view."}
          </p>
        </div>
        <Link className="button primary" to="/portal/bemax">
          Ask BEMAX ↗
        </Link>
      </div>
      <UniverseNav />
      <AsyncState {...state} retry={state.reload} />
      {u && (
        <>
          <UniverseSummary data={u} />
          {!products && !sports && (
            <section className="panel galaxy-panel">
              <div className="section-heading">
                <h2>Division orbits</h2>
                <label>
                  Node size
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                  >
                    <option value="revenue">Reported revenue</option>
                    <option value="users">Observed users</option>
                    <option value="impact">
                      Portfolio score · impact proxy
                    </option>
                  </select>
                </label>
              </div>
              <p>
                Amber: risk flags · Mint: no current flags · Grey: unknown. Size
                uses{" "}
                {metric === "impact"
                  ? "portfolio score as an explicit impact proxy"
                  : metric}
                ; missing values use a minimum radius.
              </p>
              <svg
                className="galaxy"
                viewBox="0 0 1000 600"
                role="img"
                aria-label="Navigable ecosystem galaxy"
              >
                <defs>
                  <radialGradient id="galaxy-bg">
                    <stop stopColor="#223246" />
                    <stop offset="1" stopColor="#0e1727" />
                  </radialGradient>
                </defs>
                <rect
                  width="1000"
                  height="600"
                  rx="20"
                  fill="url(#galaxy-bg)"
                />
                {[100, 190, 260].map((r) => (
                  <ellipse
                    key={r}
                    cx="500"
                    cy="300"
                    rx={r * 1.5}
                    ry={r}
                    fill="none"
                    stroke="#ffffff12"
                  />
                ))}
                <circle cx="500" cy="300" r="43" fill="#c8f5df" />
                <text
                  x="500"
                  y="305"
                  textAnchor="middle"
                  fill="#102b28"
                  fontSize="16"
                >
                  MAX
                </text>
                {u.divisions.map((d, i) => {
                  const angle =
                      (i / u.divisions.length) * Math.PI * 2 - Math.PI / 2,
                    x = 500 + Math.cos(angle) * 350,
                    y = 300 + Math.sin(angle) * 205;
                  const ps = u.products.filter((p) => p.divisionId === d.id);
                  const value =
                    metric === "revenue"
                      ? d.revenue
                      : metric === "impact"
                        ? d.portfolioScore
                        : ps.length && ps.every((p) => p.users !== null)
                          ? ps.reduce((sum, p) => sum + p.users!, 0)
                          : null;
                  const radius =
                    18 + Math.min(30, Math.log2(1 + (value ?? 0)) * 2);
                  return (
                    <g key={d.id}>
                      <line
                        x1="500"
                        y1="300"
                        x2={x}
                        y2={y}
                        stroke="#b2cbd333"
                      />
                      <Link
                        to={`/portal/divisions/${encodeURIComponent(d.id)}`}
                        aria-label={`Explore ${d.name}`}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={radius}
                          fill={
                            d.risk === null
                              ? "#8090a8"
                              : d.risk > 0
                                ? "#f3b76a"
                                : "#9cdec5"
                          }
                        />
                        <text
                          x={x}
                          y={y + radius + 22}
                          textAnchor="middle"
                          fill="#f2f5fc"
                          fontSize="15"
                        >
                          {d.name}
                        </text>
                        <text
                          x={x}
                          y={y + radius + 40}
                          textAnchor="middle"
                          fill="#a8b7ce"
                          fontSize="12"
                        >
                          {value === null
                            ? "No observations"
                            : value.toLocaleString()}{" "}
                          · {d.products} products
                        </text>
                      </Link>
                    </g>
                  );
                })}
              </svg>
              <div className="universe-drilldowns">
                {u.divisions.map((d) => (
                  <Link
                    key={d.id}
                    to={`/portal/divisions/${encodeURIComponent(d.id)}`}
                  >
                    {d.name} ↗
                  </Link>
                ))}
              </div>
              <p className="muted">
                New divisions join automatically through the existing division
                intake.
              </p>
            </section>
          )}
          {sports && <SportsIntelligence />}
          <section className="panel">
            <div className="section-heading">
              <h2>{products ? "Product constellation" : "Product signals"}</h2>
              <label>
                Find a product
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products"
                />
              </label>
            </div>
            <div className="constellation-grid">
              {rows.map((p) => (
                <article key={p.id}>
                  <span
                    className={`badge ${p.risk ? "attention" : "published"}`}
                  >
                    {p.stage} · risk {p.risk}
                  </span>
                  <h3>
                    <Link
                      to={`/portal/products/${encodeURIComponent(p.id)}/twin`}
                    >
                      {p.name} ↗
                    </Link>
                  </h3>
                  <div className="stat-row">
                    <span>Health</span>
                    <strong>{p.health ?? "Unknown"}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Monthly revenue</span>
                    <strong>${p.revenue.toLocaleString()}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Users</span>
                    <strong>{p.users ?? "Unknown"}</strong>
                  </div>
                  <p>
                    Next-month baseline: $
                    {p.forecast.baselineNextMonthUsd.toLocaleString()}
                  </p>
                  <p className="muted">{p.forecast.confidence}</p>
                  <h4>Dependencies</h4>
                  {p.dependencies.length ? (
                    <ul>
                      {p.dependencies.map((id) => (
                        <li key={id}>
                          <Link
                            to={`/portal/products/${encodeURIComponent(id)}/twin`}
                          >
                            {u.products.find((item) => item.id === id)?.name ??
                              id}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No recorded dependencies.</p>
                  )}
                  <h4>Recommendation</h4>
                  <p>{p.nextBestAction}</p>
                  <Link
                    to={`/portal/twin?root=${encodeURIComponent(`product:${p.id}`)}`}
                  >
                    Explore relationships ↗
                  </Link>
                </article>
              ))}
            </div>
            {!rows.length && <p>No products match this view.</p>}
          </section>
        </>
      )}
    </>
  );
}
