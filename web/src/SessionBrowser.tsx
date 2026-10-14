import { useEffect, useId, useRef, useState } from "react";
import { Badge, Button, Collapse, Select } from "@mantine/core";
import { color, sessionKey, setColor, type Filters, type Shot } from "./data";

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

export function SessionBrowser({
  shots,
  filters,
  onChange,
}: {
  shots: Shot[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [year, setYear] = useState("all");
  const id = useId();
  const scroll = useRef<HTMLDivElement>(null);
  const sessions = new Map<string, { shot: Shot; count: number }>();
  for (const shot of shots) {
    const key = sessionKey(shot);
    const session = sessions.get(key);
    if (session) session.count++;
    else sessions.set(key, { shot, count: 1 });
  }
  const entries = [...sessions.entries()].sort(
    (a, b) =>
      (b[1].shot.session_date ?? "").localeCompare(
        a[1].shot.session_date ?? "",
      ) || a[0].localeCompare(b[0]),
  );
  const years = [
    ...new Set(
      entries.flatMap(([, s]) =>
        s.shot.session_date ? [s.shot.session_date.slice(0, 4)] : [],
      ),
    ),
  ]
    .sort()
    .reverse();
  const hasUndated = entries.some(([, s]) => !s.shot.session_date);
  const options = [
    { value: "all", label: "All years" },
    ...years.map((value) => ({ value, label: value })),
    ...(hasUndated ? [{ value: "undated", label: "Undated" }] : []),
  ];
  const selectedYear = options.some((o) => o.value === year) ? year : "all";
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [selectedYear]);
  const visible = entries.filter(
    ([, s]) =>
      selectedYear === "all" ||
      (selectedYear === "undated"
        ? s.shot.session_date === null
        : s.shot.session_date?.startsWith(selectedYear)),
  );
  const months = new Map<string, typeof visible>();
  for (const entry of visible) {
    const month = entry[1].shot.session_date?.slice(0, 7) ?? "undated";
    const group = months.get(month) ?? [];
    group.push(entry);
    months.set(month, group);
  }
  return (
    <div className="session-browser">
      <Button
        variant="default"
        size="sm"
        aria-expanded={opened}
        aria-controls={id}
        onClick={() => setOpened(!opened)}
        leftSection={<span aria-hidden="true">{opened ? "▾" : "▸"}</span>}
      >
        Browse sessions · {sessions.size}
      </Button>
      <Collapse in={opened} id={id}>
        <div className="session-browser-tools">
          <Select
            label="Browse year"
            value={selectedYear}
            data={options}
            onChange={(v) => v && setYear(v)}
          />
          <span className="muted small">
            {visible.length} sessions · newest first
          </span>
        </div>
        <div
          className="session-columns session-column-labels"
          aria-hidden="true"
        >
          <span>Date</span>
          <span>Source</span>
          <span>Club set</span>
          <span>Shots</span>
        </div>
        <div
          ref={scroll}
          className="session-scroll"
          role="region"
          aria-label="Practice sessions"
          tabIndex={0}
        >
          {[...months].map(([month, rows]) => (
            <div className="session-month" key={month}>
              <h3>{month === "undated" ? "Undated" : monthLabel(month)}</h3>
              {rows.map(([key, { shot, count }]) => (
                <button
                  key={key}
                  className={`session-columns session-row ${filters.session === key ? "active" : ""}`}
                  aria-pressed={filters.session === key}
                  aria-label={`${shot.session_date ?? "Undated"}, ${shot.source}, ${shot.set_id}, ${count} shots`}
                  onClick={() =>
                    onChange({
                      ...filters,
                      session: filters.session === key ? "" : key,
                      start: "",
                      end: "",
                      undated: false,
                    })
                  }
                >
                  <span>
                    {shot.session_date
                      ? dayLabel(shot.session_date)
                      : "Unknown"}
                  </span>
                  <span className="session-source">
                    <i style={{ background: color(shot.source) }} />
                    {shot.source}
                  </span>
                  <span>
                    <Badge
                      size="xs"
                      variant="light"
                      color={setColor(shot.set_id)}
                    >
                      {shot.set_id}
                    </Badge>
                  </span>
                  <span className="session-shot-count">{count}</span>
                </button>
              ))}
            </div>
          ))}
          {!visible.length && <p className="muted small">No sessions yet.</p>}
        </div>
        {hasUndated && (
          <Button
            variant={filters.undated ? "filled" : "light"}
            size="xs"
            className="undated-toggle"
            onClick={() =>
              onChange({
                ...filters,
                undated: !filters.undated,
                start: "",
                end: "",
                session: "",
              })
            }
          >
            Undated only
          </Button>
        )}
      </Collapse>
    </div>
  );
}
