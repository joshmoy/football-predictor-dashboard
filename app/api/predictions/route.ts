import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

type PredictionRequest = {
  dataSource?: "sample" | "football-data-api";
  competitionCode?: string;
  gameweek?: number | null;
  futureGameweekOnly?: boolean;
  historicalSeasons?: string | null;
  season?: number | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PredictionRequest;
    const repoRoot =
      process.env.FOOTBALL_MODEL_ROOT ??
      path.resolve(process.cwd(), "..", "goborr-ai");
    const pythonBin =
      process.env.FOOTBALL_MODEL_PYTHON ??
      path.join(repoRoot, "venv", "bin", "python");
    const scriptPath = path.join(repoRoot, "main.py");

    const args = [
      scriptPath,
      "--output",
      "json",
      "--data-source",
      body.dataSource ?? "sample",
      "--competition-code",
      body.competitionCode ?? "PL"
    ];

    if (typeof body.gameweek === "number") {
      args.push("--gameweek", String(body.gameweek));
    }
    if (body.futureGameweekOnly) {
      args.push("--future-gameweek-only");
    }
    if (body.historicalSeasons && body.historicalSeasons.trim()) {
      args.push("--historical-seasons", body.historicalSeasons.trim());
    }
    if (typeof body.season === "number") {
      args.push("--season", String(body.season));
    }

    const { stdout, stderr } = await execFileAsync(pythonBin, args, {
      cwd: repoRoot,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024
    });

    if (stderr.trim()) {
      console.warn(stderr);
    }

    return NextResponse.json(JSON.parse(stdout));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Prediction request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
