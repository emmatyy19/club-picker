import { useState } from "react";
import { Button, FileButton, Select, SegmentedControl } from "@mantine/core";
import {
  feedbackKey,
  makeFeedback,
  parseFeedback,
  recordResult,
  serializeFeedback,
  type FeedbackEntry,
  type FeedbackPlan,
  type FeedbackResult,
} from "./feedback";
import type { Unit } from "./data";

function initialLog(demo: boolean) {
  if (demo) return { entries: [] as FeedbackEntry[], error: "" };
  try {
    const raw = localStorage.getItem(feedbackKey);
    return { entries: raw ? parseFeedback(JSON.parse(raw)) : [], error: "" };
  } catch {
    return {
      entries: [] as FeedbackEntry[],
      error:
        "Could not read your saved log. It has not been overwritten. Restore a valid backup to continue.",
    };
  }
}
export function FeedbackLog({
  plan,
  clubs,
  unit,
  demo = false,
}: {
  demo?: boolean;
  plan: FeedbackPlan | null;
  clubs: { id: string; label: string }[];
  unit: Unit;
}) {
  const [initial] = useState(() => initialLog(demo));
  const [entries, setEntries] = useState(initial.entries);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [error, setError] = useState(initial.error);
  const [notice, setNotice] = useState("");
  const [played, setPlayed] = useState("");
  const [swingChoice, setSwing] = useState<"full" | "partial" | "">("");
  const swing =
    swingChoice || (plan?.intent === "partial" ? "partial" : "full");
  const [restore, setRestore] = useState<FeedbackEntry[] | null>(null);
  const chosen =
    clubs.find((c) => c.id === played) ??
    clubs.find((c) => c.id === plan?.suggested.id);
  function persist(next: FeedbackEntry[]) {
    try {
      const text = serializeFeedback(next);
      if (!demo) localStorage.setItem(feedbackKey, text);
      setEntries(next);
      setError("");
      return true;
    } catch {
      setError(
        "Could not save. Your previous log is unchanged. Check browser storage or export a backup.",
      );
      return false;
    }
  }
  function save() {
    if (!plan || !chosen || blocked) return;
    try {
      if (persist([makeFeedback(plan, chosen, swing), ...entries]))
        setNotice("Shot saved. Add its result below after you play.");
    } catch {
      setError("Could not save this shot. Check the recommendation inputs.");
    }
  }
  function exportLog() {
    const url = URL.createObjectURL(
      new Blob([serializeFeedback(entries)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-caddie-private-feedback.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <details className="approach-context feedback-log">
      <summary>On-course log · {entries.length} saved</summary>
      <p className="muted small">
        {demo
          ? "Demo log only. Entries disappear when you leave this page."
          : "Saved only in this browser, not in your repo. Export a private backup before changing devices or clearing browser data."}
      </p>
      <p>
        Before playing, save the suggestion and the club you intend to use. Add
        the result afterward.
      </p>
      <div className="feedback-controls">
        <Select
          label="Club I’ll play"
          placeholder="Enter a target first"
          value={chosen?.id ?? null}
          onChange={(v) => setPlayed(v ?? "")}
          data={clubs.map((c) => ({ value: c.id, label: c.label }))}
          disabled={!plan}
          allowDeselect={false}
        />
        <div className="approach-toggle-field">
          <span className="approach-field-label">Swing I’ll play</span>
          <SegmentedControl
            aria-label="Played swing"
            value={swing}
            onChange={(v) => setSwing(v as "full" | "partial")}
            data={[
              { value: "full", label: "Full" },
              { value: "partial", label: "Partial" },
            ]}
          />
        </div>
        <Button disabled={!plan || !chosen || blocked} onClick={save}>
          Save shot plan
        </Button>
      </div>
      {!plan && (
        <p className="muted small">
          Enter a valid target to get a suggestion first.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="feedback-actions">
        <Button variant="light" onClick={exportLog} disabled={!entries.length}>
          Export private backup
        </Button>
        {!demo && (
          <FileButton
            accept="application/json"
            onChange={async (file) => {
              if (!file) return;
              try {
                if (file.size > 10000000) throw Error();
                setRestore(parseFeedback(JSON.parse(await file.text())));
                setError("");
              } catch {
                setError(
                  "That file is not a valid feedback backup. Nothing changed.",
                );
              }
            }}
          >
            {(props) => (
              <Button variant="default" {...props}>
                Restore backup
              </Button>
            )}
          </FileButton>
        )}
      </div>
      {restore !== null && (
        <div className="feedback-restore">
          <p>
            Replace this browser’s log with {restore.length} saved shots? Export
            the current log first if you want to keep it.
          </p>
          <Button
            onClick={() => {
              if (persist(restore)) {
                setBlocked(false);
                setRestore(null);
                setNotice("Backup restored.");
              }
            }}
          >
            Replace log
          </Button>
          <Button variant="default" onClick={() => setRestore(null)}>
            Cancel
          </Button>
        </div>
      )}
      <div className="feedback-entries">
        {entries.map((entry) => (
          <ResultEntry
            key={entry.id}
            entry={entry}
            unit={unit}
            onSave={(result) => {
              try {
                if (persist(recordResult(entries, entry.id, result))) {
                  setNotice("Result saved.");
                  return true;
                }
              } catch {
                setError("Choose at least one result before saving.");
              }
              return false;
            }}
          />
        ))}
      </div>
      <p className="muted small">
        Results describe where the ball finished relative to your target. They
        are not measured carry distances and do not train the recommender. Only
        the club you played has an observed outcome.
      </p>
    </details>
  );
}
function ResultEntry({
  entry,
  unit,
  onSave,
}: {
  entry: FeedbackEntry;
  unit: Unit;
  onSave: (result: FeedbackResult) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<FeedbackResult>(
    entry.result ?? { finish: "unknown", side: "unknown", hazard: "unknown" },
  );
  const show = (m: number) => (m / (unit === "yd" ? 0.9144 : 1)).toFixed(1);
  return (
    <article className="feedback-entry">
      <strong>
        {entry.played.label} · {entry.plan.set} · {entry.swing} swing
      </strong>
      <p className="muted small">
        {new Date(entry.savedAt).toLocaleString()} · Target{" "}
        {show(entry.plan.targetM)} {unit} · Suggested{" "}
        {entry.plan.suggested.label}
      </p>
      {entry.result && (
        <p>
          Result:{" "}
          {[
            entry.result.finish === "unknown"
              ? null
              : entry.result.finish === "on"
                ? "on target"
                : entry.result.finish,
            entry.result.side === "unknown"
              ? null
              : entry.result.side === "center"
                ? "on line"
                : entry.result.side,
            entry.result.hazard === "unknown"
              ? null
              : entry.result.hazard === "none"
                ? "no hazard"
                : entry.result.hazard,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <Button
        variant="light"
        onClick={() => {
          setResult(
            entry.result ?? {
              finish: "unknown",
              side: "unknown",
              hazard: "unknown",
            },
          );
          setEditing(!editing);
        }}
      >
        {editing ? "Cancel" : entry.result ? "Edit result" : "Add result"}
      </Button>
      {editing && (
        <div className="feedback-controls">
          <Select
            label="Finish distance"
            value={result.finish}
            allowDeselect={false}
            onChange={(v) =>
              setResult({ ...result, finish: v as FeedbackResult["finish"] })
            }
            data={[
              { value: "unknown", label: "Not recorded" },
              { value: "short", label: "Short" },
              { value: "on", label: "On target" },
              { value: "long", label: "Long" },
            ]}
          />
          <Select
            label="Left / right"
            value={result.side}
            allowDeselect={false}
            onChange={(v) =>
              setResult({ ...result, side: v as FeedbackResult["side"] })
            }
            data={[
              { value: "unknown", label: "Not recorded" },
              { value: "left", label: "Left" },
              { value: "center", label: "On line" },
              { value: "right", label: "Right" },
            ]}
          />
          <Select
            label="Hazard"
            value={result.hazard}
            allowDeselect={false}
            onChange={(v) =>
              setResult({ ...result, hazard: v as FeedbackResult["hazard"] })
            }
            data={[
              { value: "unknown", label: "Not recorded" },
              { value: "none", label: "None" },
              { value: "bunker", label: "Bunker" },
              { value: "water", label: "Water" },
              { value: "other", label: "Other" },
            ]}
          />
          <Button
            disabled={Object.values(result).every((v) => v === "unknown")}
            onClick={() => {
              if (onSave(result)) setEditing(false);
            }}
          >
            Save result
          </Button>
        </div>
      )}
    </article>
  );
}
