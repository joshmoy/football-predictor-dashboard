"use client";

import { FormEvent, useEffect, useState } from "react";

type Prediction = {
  fixture_date: string;
  gameweek: number;
  home_team: string;
  away_team: string;
  home_win_probability: number;
  draw_probability: number;
  away_win_probability: number;
  predicted_home_goals: number;
  predicted_away_goals: number;
  predicted_outcome: string;
  model_confidence: number;
  predicted_scoreline: string;
  scoreline_probability: number;
};

type GeminiContextRow = {
  team: string;
  effective_date: string | null;
  gameweek: number | null;
  squad_strength: number | null;
  availability_score: number | null;
  expected_lineup_strength: number | null;
  injury_count: number | null;
  suspended_count: number | null;
  confidence: number | null;
  notes: string | null;
  source_summary: string | null;
};

type PredictorResponse = {
  request: {
    data_source: "sample" | "football-data-api";
    competition_code: string;
    gameweek: number | null;
    future_gameweek_only: boolean;
    historical_seasons: number[] | null;
    season: number | null;
    use_gemini_context: boolean;
    gemini_model: string | null;
    gemini_context_output_path: string | null;
  };
  summary: {
    data_source_label: string;
    historical_match_count: number;
    upcoming_fixture_count: number;
    team_context_count: number;
    gemini_context_count: number;
    gemini_context_artifact_path: string | null;
    selected_gameweeks: number[];
  };
  gemini_context_rows: GeminiContextRow[];
  validation_metrics: Record<string, number>;
  predictions: Prediction[];
};

type PublishResult = {
  fixture_id: number;
  fixture: {
    id: number;
    round: number;
    home_team: string;
    away_team: string;
    kickoff_time: string | null;
  };
  submitted_prediction: {
    home_team_score: number;
    away_team_score: number;
  };
  response: {
    message?: string;
    status?: boolean;
  };
};

type DashboardForm = {
  dataSource: "sample" | "football-data-api";
  gameweek: string;
  futureGameweekOnly: boolean;
  competitionCode: string;
  historicalSeasons: string;
  season: string;
};

const initialForm: DashboardForm = {
  dataSource: "football-data-api",
  gameweek: "",
  futureGameweekOnly: false,
  competitionCode: "PL",
  historicalSeasons: "2025",
  season: ""
};

const predictorApiUrl =
  process.env.NEXT_PUBLIC_PREDICTOR_API_URL ?? "http://127.0.0.1:8000/predict";

export function PredictorDashboard() {
  const [form, setForm] = useState<DashboardForm>(initialForm);
  const [data, setData] = useState<PredictorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<Record<string, string>>({});

  useEffect(() => {
    void runPrediction(initialForm);
  }, []);

  async function runPrediction(nextForm: DashboardForm) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(predictorApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          dataSource: nextForm.dataSource,
          gameweek: nextForm.gameweek ? Number(nextForm.gameweek) : null,
          futureGameweekOnly: nextForm.futureGameweekOnly,
          competitionCode: nextForm.competitionCode,
          historicalSeasons: nextForm.historicalSeasons,
          season: nextForm.season ? Number(nextForm.season) : null
        })
      });

      const payload = (await response.json()) as PredictorResponse | { error: string };
      if (!response.ok || "error" in payload || "detail" in payload) {
        if ("error" in payload) {
          throw new Error(payload.error);
        }
        if ("detail" in payload) {
          throw new Error(String(payload.detail));
        }
        throw new Error("Prediction request failed.");
      }

      setData(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Prediction request failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runPrediction(form);
  }

  async function sendPredictionToGoborr(prediction: Prediction) {
    const predictionKey = `${prediction.fixture_date}-${prediction.home_team}-${prediction.away_team}`;
    setPublishState((current) => ({ ...current, [predictionKey]: "Sending..." }));

    try {
      const response = await fetch(`${predictorApiUrl.replace(/\/predict$/, "")}/goborr/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roundNumber: prediction.gameweek,
          homeTeam: prediction.home_team,
          awayTeam: prediction.away_team,
          homeScore: prediction.predicted_home_goals,
          awayScore: prediction.predicted_away_goals
        })
      });

      const payload = (await response.json()) as PublishResult | { detail?: string; error?: string };
      if (!response.ok || "detail" in payload || "error" in payload) {
        if ("detail" in payload && payload.detail) {
          throw new Error(payload.detail);
        }
        if ("error" in payload && payload.error) {
          throw new Error(payload.error);
        }
        throw new Error("Failed to publish prediction to Goborr.");
      }

      const publishPayload = payload as PublishResult;
      const message =
        publishPayload.response?.message ??
        `Sent to Goborr fixture ${publishPayload.fixture_id}`;
      setPublishState((current) => ({ ...current, [predictionKey]: message }));
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to publish prediction to Goborr.";
      setPublishState((current) => ({ ...current, [predictionKey]: message }));
    }
  }

  const selectedGameweeks = data?.summary.selected_gameweeks ?? [];
  const geminiContextRows = data?.gemini_context_rows ?? [];

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Goborr Match Dashboard</p>
          <h1>Run the Python fixture model without leaving the browser.</h1>
          <p className="lede">
            Switch between the sample dataset and the football-data.org flow, then inspect
            gameweek probabilities, projected goals, and the model&apos;s most likely scoreline.
          </p>
        </div>
        <div className="hero-panel">
          <span className="panel-label">Current view</span>
          <strong>{data?.summary.data_source_label ?? "Awaiting first run"}</strong>
          <span>
            {selectedGameweeks.length > 0
              ? `Gameweek ${selectedGameweeks.join(", ")}`
              : "No gameweek selected yet"}
          </span>
        </div>
      </section>

      <section className="workspace">
        <form className="control-panel" onSubmit={handleSubmit}>
          <div className="panel-header">
            <h2>Controls</h2>
            <button className="primary-button" disabled={loading} type="submit">
              {loading ? "Running model..." : "Run predictions"}
            </button>
          </div>

          <label className="field">
            <span>Data source</span>
            <select
              value={form.dataSource}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dataSource: event.target.value as DashboardForm["dataSource"]
                }))
              }
            >
              <option value="football-data-api">football-data.org API</option>
              <option value="sample">Bundled sample data</option>
            </select>
          </label>

          <label className="field">
            <span>Competition code</span>
            <input
              value={form.competitionCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, competitionCode: event.target.value.toUpperCase() }))
              }
              placeholder="PL"
            />
          </label>

          <label className="field">
            <span>Specific gameweek</span>
            <input
              inputMode="numeric"
              value={form.gameweek}
              onChange={(event) => setForm((current) => ({ ...current, gameweek: event.target.value }))}
              placeholder="Leave blank to auto-select"
            />
          </label>

          <label className="field">
            <span>Historical seasons</span>
            <input
              value={form.historicalSeasons}
              onChange={(event) =>
                setForm((current) => ({ ...current, historicalSeasons: event.target.value }))
              }
              placeholder="2025"
            />
          </label>

          <label className="field">
            <span>Fixture season</span>
            <input
              inputMode="numeric"
              value={form.season}
              onChange={(event) => setForm((current) => ({ ...current, season: event.target.value }))}
              placeholder="Leave blank for current season"
            />
          </label>

          <label className="checkbox-row">
            <input
              checked={form.futureGameweekOnly}
              onChange={(event) =>
                setForm((current) => ({ ...current, futureGameweekOnly: event.target.checked }))
              }
              type="checkbox"
            />
            <span>Skip a partially remaining matchweek and jump to the next future one.</span>
          </label>

          <p className="helper">
            API mode uses the same Python entrypoint as the terminal workflow, so your `.env`
            token and model logic stay in the FastAPI backend while this frontend just renders
            the results.
          </p>
        </form>

        <section className="results-panel">
          {error ? <div className="error-banner">{error}</div> : null}

          <div className="stats-grid">
            <MetricCard label="Historical matches" value={data?.summary.historical_match_count ?? 0} />
            <MetricCard label="Upcoming fixtures" value={data?.summary.upcoming_fixture_count ?? 0} />
            <MetricCard label="Team context rows" value={data?.summary.team_context_count ?? 0} />
            <MetricCard label="Gemini rows" value={data?.summary.gemini_context_count ?? 0} />
            <MetricCard
              label="Selected gameweek"
              value={selectedGameweeks.length > 0 ? selectedGameweeks.join(", ") : "Auto"}
            />
          </div>

          <div className="validation-card">
            <div>
              <span className="panel-label">Validation snapshot</span>
              <h2>Holdout metrics from the current training run</h2>
            </div>
            <div className="validation-grid">
              <MetricCard
                label="Accuracy"
                value={formatPercent(data?.validation_metrics.accuracy)}
                compact
              />
              <MetricCard
                label="Log loss"
                value={formatDecimal(data?.validation_metrics.log_loss)}
                compact
              />
              <MetricCard
                label="Home goals MAE"
                value={formatDecimal(data?.validation_metrics.home_goals_mae)}
                compact
              />
              <MetricCard
                label="Away goals MAE"
                value={formatDecimal(data?.validation_metrics.away_goals_mae)}
                compact
              />
            </div>
          </div>

          <div className="validation-card">
            <div className="context-header">
              <div>
                <span className="panel-label">Gemini audit</span>
                <h2>Live team context fed into the model</h2>
              </div>
              <div className="context-meta">
                <span>{data?.request.gemini_model ?? "Gemini disabled"}</span>
                {data?.summary.gemini_context_artifact_path ? (
                  <code>{data.summary.gemini_context_artifact_path}</code>
                ) : null}
              </div>
            </div>

            {geminiContextRows.length > 0 ? (
              <div className="context-grid">
                {geminiContextRows.map((row) => (
                  <article className="context-card" key={`${row.team}-${row.gameweek ?? "na"}`}>
                    <div className="context-card-top">
                      <div>
                        <p className="panel-label">
                          {row.effective_date ?? "Unknown date"}
                          {row.gameweek ? ` · Gameweek ${row.gameweek}` : ""}
                        </p>
                        <h3>{row.team}</h3>
                      </div>
                      <span className="context-confidence">
                        Confidence {formatPercent(row.confidence ?? undefined)}
                      </span>
                    </div>

                    <div className="context-metrics">
                      <MetricChip label="Squad" value={formatOneDecimal(row.squad_strength)} />
                      <MetricChip label="Available" value={formatOneDecimal(row.availability_score)} />
                      <MetricChip label="Lineup" value={formatOneDecimal(row.expected_lineup_strength)} />
                      <MetricChip label="Injuries" value={formatOneDecimal(row.injury_count)} />
                      <MetricChip label="Suspensions" value={formatOneDecimal(row.suspended_count)} />
                    </div>

                    {row.notes ? <p className="context-notes">{row.notes}</p> : null}
                    {row.source_summary ? (
                      <p className="context-sources">
                        <span className="panel-label">Sources</span>
                        {row.source_summary}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="helper context-empty">
                No Gemini context rows were returned for this run.
              </p>
            )}
          </div>

          <div className="prediction-list">
            {data?.predictions?.map((prediction) => (
              <article className="prediction-card" key={`${prediction.fixture_date}-${prediction.home_team}-${prediction.away_team}`}>
                <div className="prediction-topline">
                  <div>
                    <p className="panel-label">
                      {prediction.fixture_date} · Gameweek {prediction.gameweek}
                    </p>
                    <h3>
                      {prediction.home_team} vs {prediction.away_team}
                    </h3>
                  </div>
                  <span className="outcome-pill">{prediction.predicted_outcome.replace("_", " ")}</span>
                </div>

                <div className="scoreline-band">
                  <div>
                    <span className="panel-label">Projected scoreline</span>
                    <strong>{prediction.predicted_scoreline}</strong>
                  </div>
                  <div>
                    <span className="panel-label">Scoreline probability</span>
                    <strong>{formatPercent(prediction.scoreline_probability)}</strong>
                  </div>
                  <div>
                    <span className="panel-label">Predicted goals</span>
                    <strong>
                      {prediction.predicted_home_goals} - {prediction.predicted_away_goals}
                    </strong>
                  </div>
                </div>

                <div className="probability-grid">
                  <ProbabilityBar label={prediction.home_team} value={prediction.home_win_probability} />
                  <ProbabilityBar label="Draw" value={prediction.draw_probability} />
                  <ProbabilityBar label={prediction.away_team} value={prediction.away_win_probability} />
                </div>

                <p className="confidence-line">
                  Model confidence: <strong>{formatPercent(prediction.model_confidence)}</strong>
                </p>

                <div className="publish-row">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void sendPredictionToGoborr(prediction)}
                    disabled={loading}
                  >
                    Send to Goborr
                  </button>
                  <span className="publish-status">
                    {
                      publishState[
                        `${prediction.fixture_date}-${prediction.home_team}-${prediction.away_team}`
                      ] ?? "Not sent yet"
                    }
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({
  label,
  value,
  compact = false
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "metric-card compact" : "metric-card"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="probability-row">
      <div className="probability-copy">
        <span>{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="probability-track">
        <div className="probability-fill" style={{ width: `${Math.max(value * 100, 2)}%` }} />
      </div>
    </div>
  );
}

function formatPercent(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function formatDecimal(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(3);
}

function formatOneDecimal(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(1);
}
