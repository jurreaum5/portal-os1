import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type BemaxSummary = {
  generatedAt: string;
  portfolio: {
    totalProducts: number;
    averageScore: number;
    totalRevenue: number;
    activeProducts: number;
    livingDivisions: number;
    riskCount: number;
    pendingApprovals: number;
  };
  openRisks: Array<{ id: string; name: string; risk: number; stage: string; summary: string }>;
  openOpportunities: Array<{ id: string; name: string; score: number; summary: string }>;
  recommendedActions: Array<{ id: string; title: string; summary: string; score: number; category: string }>;
};

export default function BemaxHome() {
  const [summary, setSummary] = useState<BemaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const data = await api<BemaxSummary>("/api/bemax/summary");
        if (!ignore) {
          setSummary(data);
          setLoading(false);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const widgets = useMemo(
    () => [
      {
        label: "Executive Status",
        value: summary ? `${summary.portfolio.averageScore}/100` : "—",
        detail: "Portfolio score",
      },
      {
        label: "Open Risks",
        value: summary ? String(summary.openRisks.length) : "—",
        detail: "Active risk signals",
      },
      {
        label: "Open Opportunities",
        value: summary ? String(summary.openOpportunities.length) : "—",
        detail: "Promotion candidates",
      },
      {
        label: "Pending Approvals",
        value: summary ? String(summary.portfolio.pendingApprovals) : "—",
        detail: "Needs governor attention",
      },
      {
        label: "Provider Health",
        value: summary ? `${summary.portfolio.activeProducts} active` : "—",
        detail: "Execution capacity in view",
      },
      {
        label: "Simulation Activity",
        value: summary ? `${summary.portfolio.totalProducts}` : "—",
        detail: "Products tracked",
      },
      {
        label: "Research Activity",
        value: summary ? `${summary.portfolio.livingDivisions}` : "—",
        detail: "Visible divisions",
      },
      {
        label: "Recommended Actions",
        value: summary ? String(summary.recommendedActions.length) : "—",
        detail: "Current guidance",
      },
    ],
    [summary],
  );

  if (loading) {
    return <section className="panel"><h1>BEMAX</h1><p>Loading strategic intelligence…</p></section>;
  }

  if (error) {
    return <section className="panel"><h1>BEMAX</h1><p>Unable to load the strategic dashboard: {error}</p></section>;
  }

  return (
    <section className="page-shell">
      <div className="page-heading command-heading">
        <div>
          <div className="eyebrow"><span className="tiny-line" /> BEMAX OPERATING INTELLIGENCE</div>
          <h1>BEMAX<span className="title-dot">.</span></h1>
          <p>Strategic operating interface for the MAX Universe.</p>
        </div>
        <div className="heading-actions">
          <Link className="button primary" to="/portal/dashboard">Return to dashboard</Link>
        </div>
      </div>

      <div className="dashboard-toolbar" style={{ marginBottom: 16 }}>
        <div className="overview-tabs">
          <span className="selected">BEMAX home</span>
          <Link to="/portal/recommendations">Recommendations</Link>
        </div>
      </div>

      <div className="command-metrics">
        {widgets.map((widget) => (
          <article className="command-metric purple" key={widget.label}>
            <div className="metric-label">
              {widget.label}
              <span className="metric-symbol"><span aria-hidden="true">✦</span></span>
            </div>
            <strong>{widget.value}<small /></strong>
            <p><span className="metric-indicator" />{widget.detail}</p>
            <div className="metric-bottom">Strategic signal</div>
          </article>
        ))}
      </div>

      <div className="command-grid">
        <div className="command-primary">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Open Risks</h2>
                <p>Signals requiring intervention.</p>
              </div>
            </div>
            {summary?.openRisks.length ? (
              <div className="decision-list">
                {summary.openRisks.map((risk) => (
                  <div className="decision-preview" key={risk.id}>
                    <strong>{risk.name}</strong>
                    <p>{risk.summary}</p>
                    <span className="priority-tag medium">Risk {risk.risk}</span>
                    <span className="decision-risk">{risk.stage}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-copy">No active risks detected.</p>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Open Opportunities</h2>
                <p>High-confidence growth and promotion signals.</p>
              </div>
            </div>
            {summary?.openOpportunities.length ? (
              <div className="decision-list">
                {summary.openOpportunities.map((opportunity) => (
                  <div className="decision-preview" key={opportunity.id}>
                    <strong>{opportunity.name}</strong>
                    <p>{opportunity.summary}</p>
                    <span className="priority-tag high">Score {opportunity.score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-copy">No immediate opportunities surfaced.</p>
            )}
          </section>
        </div>

        <div className="command-secondary">
          <section className="panel">
            <div className="section-heading">
              <h2>Recommended Actions</h2>
            </div>
            {summary?.recommendedActions.length ? (
              <div className="decision-list">
                {summary.recommendedActions.map((action) => (
                  <div className="decision-preview" key={action.id}>
                    <strong>{action.title}</strong>
                    <p>{action.summary}</p>
                    <span className="priority-tag low">{action.category}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-copy">No actions recommended.</p>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Portfolio Snapshot</h2>
            </div>
            {summary && (
              <div className="health-services">
                <div><span>Total products</span><span>{summary.portfolio.totalProducts}</span></div>
                <div><span>Average score</span><span>{summary.portfolio.averageScore}</span></div>
                <div><span>Revenue</span><span>${summary.portfolio.totalRevenue.toLocaleString()}</span></div>
                <div><span>Active products</span><span>{summary.portfolio.activeProducts}</span></div>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
