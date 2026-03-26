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
  expected_home_goals: number;
  expected_away_goals: number;
  predicted_outcome: string;
  model_confidence: number;
  predicted_scoreline: string;
  scoreline_probability: number;
};

type PredictorResponse = {
  request: {
    data_source: "sample" | "football-data-api";
    competition_code: string;
    gameweek: number | null;
    future_gameweek_only: boolean;
    historical_seasons: number[] | null;
    season: number | null;
  };
  summary: {
    data_source_label: string;
    historical_match_count: number;
    upcoming_fixture_count: number;
    team_context_count: number;
    selected_gameweeks: number[];
  };
  validation_metrics: Record<string, number>;
  predictions: Prediction[];
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

  const selectedGameweeks = data?.summary.selected_gameweeks ?? [];

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
                    <span className="panel-label">Expected goals</span>
                    <strong>
                      {prediction.expected_home_goals.toFixed(2)} - {prediction.expected_away_goals.toFixed(2)}
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
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
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
