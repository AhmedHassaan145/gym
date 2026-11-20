/**
 * progression.js — Double Progression engine
 *
 * Rules implemented (see spec):
 *  1. If all working sets hit the upper end of the rep range -> increase weight.
 *  2. Still within range but not all sets at the upper limit -> keep weight, improve reps.
 *  3. Performance regressed -> do NOT increase.
 *  4. Consistently missing the lower bound -> flag "needs attention".
 *  5. Never auto-increase just because weight was repeated.
 *  6. Only the latest *completed* workout is used for the recommendation.
 */

/**
 * Status constants
 */
export const Status = Object.freeze({
  READY: "ready",         // increase weight next time
  IMPROVING: "improving", // within range, pushing reps up
  MAINTAINING: "maintaining", // holding steady
  ATTENTION: "attention", // consistently missing low end
  NEW: "new",             // no history yet
});

/**
 * Extract completed (non-skipped) sets from a history exercise entry
 */
function completedSets(exEntry) {
  if (!exEntry || exEntry.skipped) return [];
  return (exEntry.sets || []).filter((s) => s.reps !== null && s.reps !== undefined && s.reps !== "");
}

/**
 * Find the most recent completed history record that contains this exercise.
 * "Completed" = not skipped and has at least one logged set.
 */
export function lastPerformance(history, exerciseId) {
  if (!history || !history.length) return null;
  for (const rec of history) {
    const ex = (rec.exercises || []).find(
      (e) => e.exerciseId === exerciseId && !e.skipped && (e.sets || []).some((s) => s.reps != null && s.reps !== "")
    );
    if (ex) return { record: rec, exercise: ex, sets: completedSets(ex) };
  }
  return null;
}

/**
 * All history entries for an exercise, oldest-first
 */
export function exerciseHistory(history, exerciseId) {
  const out = [];
  for (let i = (history || []).length - 1; i >= 0; i--) {
    const rec = history[i];
    const ex = (rec.exercises || []).find((e) => e.exerciseId === exerciseId && !e.skipped);
    if (ex) {
      const sets = completedSets(ex);
      if (sets.length) out.push({ record: rec, exercise: ex, sets });
    }
  }
  return out;
}

/**
 * Decide the recommended weight + status for the next session.
 *
 * @param {Object} exercise — current exercise definition
 * @param {Array}  history  — full history, newest first
 * @returns {{
 *   status: string,
 *   recommendedWeight: number,
 *   recommendedReps: number,
 *   reason: string,
 *   lastWeight?: number,
 *   lastReps?: number[],
 *   prevWeight?: number,
 * }}
 */
export function recommend(exercise, history) {
  const inc = Number(exercise.increment) || 2.5;
  const repMin = Number(exercise.repMin) || 8;
  const repMax = Number(exercise.repMax) || 12;
  const currentWeight = Number(exercise.weight) || 0;

  const hist = exerciseHistory(history, exercise.id);

  if (!hist.length) {
    return {
      status: Status.NEW,
      recommendedWeight: currentWeight,
      recommendedReps: repMin,
      reason: "No history yet. Start with your current working weight.",
      lastWeight: null,
      lastReps: null,
    };
  }

  const latest = hist[hist.length - 1];
  const prev = hist.length > 1 ? hist[hist.length - 2] : null;
  const lastSets = latest.sets;
  const lastWeight = Number(lastSets[0]?.weight) || currentWeight;
  const lastReps = lastSets.map((s) => Number(s.reps) || 0);

  // All sets reached the upper rep range -> ready to increase
  const allAtMax = lastReps.length > 0 && lastReps.every((r) => r >= repMax);

  // Did performance drop vs previous session at the same weight?
  let regressed = false;
  if (prev) {
    const prevReps = prev.sets.map((s) => Number(s.reps) || 0);
    const sameWeight = Math.abs(Number(prev.sets[0]?.weight) - lastWeight) < 0.001;
    if (sameWeight && prevReps.length === lastReps.length) {
      const prevTotal = prevReps.reduce((a, b) => a + b, 0);
      const lastTotal = lastReps.reduce((a, b) => a + b, 0);
      if (lastTotal < prevTotal) regressed = true;
    }
  }

  // Consistently missing the low end (last 2 sessions below repMin in all sets)
  let chronicMiss = false;
  if (hist.length >= 2) {
    const lastTwo = hist.slice(-2);
    chronicMiss = lastTwo.every((h) => {
      const reps = h.sets.map((s) => Number(s.reps) || 0);
      return reps.length > 0 && reps.every((r) => r < repMin);
    });
  }

  // Missing the low end in the latest session
  const missedLow = lastReps.length > 0 && lastReps.some((r) => r < repMin);

  if (chronicMiss) {
    return {
      status: Status.ATTENTION,
      recommendedWeight: lastWeight,
      recommendedReps: repMin,
      reason: "Reps are consistently below your target range. Consider deloading or reviewing recovery.",
      lastWeight,
      lastReps,
    };
  }

  if (allAtMax && !regressed) {
    const nextWeight = roundWeight(lastWeight + inc, exercise.unit);
    return {
      status: Status.READY,
      recommendedWeight: nextWeight,
      recommendedReps: repMin,
      reason: `All sets reached ${repMax} reps. Increase to ${nextWeight} and aim for ${repMin}.`,
      lastWeight,
      lastReps,
    };
  }

  if (regressed || missedLow) {
    return {
      status: Status.MAINTAINING,
      recommendedWeight: lastWeight,
      recommendedReps: repMin,
      reason: "Performance dipped or reps missed. Keep the weight and focus on form and recovery.",
      lastWeight,
      lastReps,
      prevWeight: prev ? Number(prev.sets[0]?.weight) : undefined,
    };
  }

  // Within range but not all sets at the top -> improving
  const withinRange = lastReps.every((r) => r >= repMin);
  if (withinRange && !allAtMax) {
    return {
      status: Status.IMPROVING,
      recommendedWeight: lastWeight,
      recommendedReps: repMax,
      reason: `Good work. Keep ${lastWeight} and push toward ${repMax} reps on every set.`,
      lastWeight,
      lastReps,
    };
  }

  // Fallback: maintaining
  return {
    status: Status.MAINTAINING,
    recommendedWeight: lastWeight,
    recommendedReps: repMin,
    reason: "Hold this weight and stay consistent.",
    lastWeight,
    lastReps,
  };
}

/** Round weight to a realistic plate value (nearest 0.5 for kg, 1 for lb) */
export function roundWeight(w, unit = "kg") {
  if (!isFinite(w)) return 0;
  if (unit === "lb") {
    return Math.round(w);
  }
  return Math.round(w * 2) / 2;
}

/**
 * Aggregate status counts across all exercises (for dashboard summary)
 */
export function summary(exercises, history) {
  const counts = { ready: 0, improving: 0, maintaining: 0, attention: 0, new: 0 };
  for (const ex of exercises) {
    const r = recommend(ex, history);
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  return counts;
}

/**
 * Estimated 1-rep max using Epley formula.
 * weight + reps in the input unit.
 */
export function estimate1RM(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
