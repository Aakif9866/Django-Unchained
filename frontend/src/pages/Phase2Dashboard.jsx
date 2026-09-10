import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const HEALTH_LABEL = {
  OK: 'Healthy',
  OK_WITH_FINDINGS: 'Open findings',
  AT_RISK: 'At risk',
  UNKNOWN_BEYOND_100_USERS: 'Untested beyond 100 users',
  NOT_TESTED: 'Not tested',
};

const HEALTH_CLASS = {
  OK: 'dot-ok',
  OK_WITH_FINDINGS: 'dot-warn',
  AT_RISK: 'dot-bad',
  UNKNOWN_BEYOND_100_USERS: 'dot-unknown',
  NOT_TESTED: 'dot-unknown',
};

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const SEVERITY_CLASS = {
  CRITICAL: 'sev-critical',
  HIGH: 'sev-high',
  MEDIUM: 'sev-medium',
  LOW: 'sev-low',
  INFO: 'sev-info',
};

function StatCard({ label, value, tone }) {
  return (
    <div className={`stat-card ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  if (!severity || severity === 'N/A') return null;
  return <span className={`sev-badge ${SEVERITY_CLASS[severity] || ''}`}>{severity}</span>;
}

function FindingRow({ finding, expanded, onToggle }) {
  return (
    <div className="finding-row">
      <button className="finding-summary" onClick={onToggle}>
        <SeverityBadge severity={finding.severity} />
        <span className="finding-id">{finding.id}</span>
        <span className="finding-title">{finding.title}</span>
        <span className="finding-status">{finding.status}</span>
        <span className="finding-chevron">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="finding-detail">
          {finding.component && <div><strong>Component:</strong> {finding.component}</div>}
          {finding.impact && <div><strong>Impact:</strong> {finding.impact}</div>}
          {'exploitable' in finding && (
            <div><strong>Exploitable:</strong> {finding.exploitable ? 'Yes' : 'No'}</div>
          )}
          {finding.recommendation && (
            <div><strong>Recommendation:</strong> {finding.recommendation}</div>
          )}
          {finding.evidence && <div><strong>Evidence:</strong> {finding.evidence}</div>}
        </div>
      )}
    </div>
  );
}

export function Phase2Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.getPhase2Dashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const allFindings = useMemo(() => {
    if (!data) return [];
    return [...(data.security_findings || [])].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    );
  }, [data]);

  const visibleFindings = severityFilter === 'ALL'
    ? allFindings
    : allFindings.filter((f) => f.severity === severityFilter);

  if (loading) return <div className="center-screen muted">Loading Phase 2 results…</div>;

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <Link to="/notes" className="btn btn-ghost btn-small">← Back to Notes</Link>
        </div>
        <div className="form-error" style={{ margin: '24px' }}>
          Could not load Phase 2 results: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Phase 2 Testing Dashboard</h1>
          <p className="muted dashboard-subtitle">
            Security, performance &amp; reliability results — generated {new Date(data.generated_at).toLocaleString()}
            {' '}on <code>{data.branch}</code>
          </p>
        </div>
        <Link to="/notes" className="btn btn-ghost btn-small">← Back to Notes</Link>
      </div>

      {/* Overall health */}
      <section className="dashboard-section">
        <h2 className="section-title">Overall Health</h2>
        <div className="health-grid">
          {Object.entries(data.health).map(([key, value]) => (
            <div className="health-item" key={key}>
              <span className={`health-dot ${HEALTH_CLASS[value] || 'dot-unknown'}`} />
              <div>
                <div className="health-name">{key.replace(/_/g, ' ')}</div>
                <div className="health-value muted">{HEALTH_LABEL[value] || value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="dashboard-section">
        <h2 className="section-title">Test Statistics</h2>
        <div className="stat-grid">
          <StatCard label="Total tests" value={data.summary.total_tests} />
          <StatCard label="Passed" value={data.summary.passed} tone="ok" />
          <StatCard label="Failed" value={data.summary.failed} tone="bad" />
          <StatCard label="Info" value={data.summary.info} />
          <StatCard label="Blocked" value={data.summary.blocked} />
          <StatCard label="Deferred" value={data.summary.deferred} />
          <StatCard label="Critical" value={data.summary.critical} tone={data.summary.critical ? 'bad' : undefined} />
          <StatCard label="High" value={data.summary.high} tone={data.summary.high ? 'bad' : undefined} />
          <StatCard label="Medium" value={data.summary.medium} tone={data.summary.medium ? 'warn' : undefined} />
          <StatCard label="Low" value={data.summary.low} />
        </div>
      </section>

      {/* API tests */}
      <section className="dashboard-section">
        <h2 className="section-title">API Test Suite</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {data.api_tests.tool} — {data.api_tests.passed}/{data.api_tests.total} passed in{' '}
          {data.api_tests.duration_seconds}s
        </p>
        <div className="chip-row">
          {data.api_tests.categories.map((c) => (
            <span className="chip" key={c.name}>{c.name}: {c.passed}/{c.count}</span>
          ))}
        </div>
        <p className="muted small-note">{data.api_tests.note}</p>
      </section>

      {/* Security findings */}
      <section className="dashboard-section">
        <h2 className="section-title">Security Findings</h2>
        <div className="filter-row">
          {['ALL', ...SEVERITY_ORDER].map((sev) => (
            <button
              key={sev}
              className={`chip chip-button ${severityFilter === sev ? 'chip-active' : ''}`}
              onClick={() => setSeverityFilter(sev)}
            >
              {sev}
            </button>
          ))}
        </div>
        <div className="findings-list">
          {visibleFindings.length === 0 && <p className="muted">No findings at this severity.</p>}
          {visibleFindings.map((f) => (
            <FindingRow
              key={f.id}
              finding={f}
              expanded={expandedId === f.id}
              onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
            />
          ))}
        </div>
        {data.security_passed?.length > 0 && (
          <>
            <h3 className="subsection-title">Confirmed working correctly</h3>
            <ul className="passed-list">
              {data.security_passed.map((p) => (
                <li key={p.id}><span className="pass-check">✓</span> <strong>{p.id}</strong> — {p.title}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Performance */}
      <section className="dashboard-section">
        <h2 className="section-title">Performance &amp; Load Testing</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tool</th><th>Users</th><th>Requests</th><th>Failures</th>
                <th>Req/s</th><th>Notes avg</th><th>Auth avg</th>
              </tr>
            </thead>
            <tbody>
              {data.performance.load_stages.map((s, i) => (
                <tr key={i}>
                  <td>{s.tool}</td>
                  <td>{s.users}</td>
                  <td>{s.total_requests}</td>
                  <td className={s.failures ? 'cell-bad' : 'cell-ok'}>
                    {s.failures} ({s.error_rate_pct}%)
                  </td>
                  <td>{s.req_per_s}</td>
                  <td>{s.notes_avg_ms ? `${s.notes_avg_ms}ms` : (s.aggregate_avg_ms ? `${s.aggregate_avg_ms}ms*` : '—')}</td>
                  <td>{s.auth_avg_ms ? `${s.auth_avg_ms}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small-note">*k6 measures the whole flow per iteration, not split by endpoint.</p>

        <div className="callout callout-warn">
          <strong>Bottleneck: {data.performance.bottleneck.title}</strong>
          <p>{data.performance.bottleneck.root_cause}</p>
          <p className="muted small-note">{data.performance.bottleneck.evidence}</p>
          <p className="muted small-note"><em>{data.performance.bottleneck.caveat}</em></p>
        </div>
      </section>

      {/* Reliability */}
      <section className="dashboard-section">
        <h2 className="section-title">Reliability</h2>
        <ul className="passed-list">
          {data.reliability_findings.map((r) => (
            <li key={r.id}>
              <span className={r.status === 'PASS' ? 'pass-check' : 'fail-check'}>
                {r.status === 'PASS' ? '✓' : '✕'}
              </span>{' '}
              <strong>{r.id}</strong> — {r.title}
            </li>
          ))}
        </ul>
      </section>

      {/* Database */}
      <section className="dashboard-section">
        <h2 className="section-title">Database (PostgreSQL / Neon)</h2>
        <ul className="passed-list">
          {data.database.findings.map((d) => (
            <li key={d.id}>
              <span className={d.status === 'PASS' ? 'pass-check' : 'warn-check'}>
                {d.status === 'PASS' ? '✓' : '!'}
              </span>{' '}
              <strong>{d.id}</strong> — {d.title}
              {d.recommendation && <div className="muted small-note">{d.recommendation}</div>}
            </li>
          ))}
        </ul>
      </section>

      {/* DevOps */}
      <section className="dashboard-section">
        <h2 className="section-title">Docker / DevOps</h2>
        <div className="callout callout-neutral">
          <strong>Not tested — {data.devops.status.replace('_', ' ')}</strong>
          <p className="muted">{data.devops.reason}</p>
        </div>
      </section>
    </div>
  );
}
