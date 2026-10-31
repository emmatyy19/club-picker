import { ChartTools } from "./ChartTools";
import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Modal,
  Select,
  SegmentedControl,
  Table,
  Tooltip,
} from "@mantine/core";
import { MeasurementContext } from "./MeasurementContext";
import {
  color,
  format,
  setColor,
  type Dimension,
  type Metric,
  type Shot,
  type Unit,
} from "./data";
import { rankClubs, type RankingMetric, type RankingStat } from "./rankings";
import { trendMetrics, trendUnit } from "./trends";
export function Rankings({
  shots,
  all,
  unit,
  lateral,
  onLateralChange,
  colorBy,
  settings,
  unitsControl,
  playbackControl,
}: {
  settings: ReactNode;
  unitsControl: ReactNode;
  playbackControl: ReactNode;
  shots: Shot[];
  all: Shot[];
  unit: Unit;
  lateral: Metric;
  onLateralChange: (metric: Metric) => void;
  colorBy: Dimension;
}) {
  const [metric, setMetric] = useState<RankingMetric>("carry");
  const [statistic, setStatistic] = useState<RankingStat>("range");
  const [detail, setDetail] = useState<Shot | null>(null);
  const [minimum, setMinimum] = useState("10");
  const stats = [
    { value: "range", label: "Smallest middle 80% range" },
    ...(["carry", "total"].includes(metric)
      ? [{ value: "relative", label: "Smallest relative distance spread" }]
      : []),
    ...(metric === "side"
      ? [{ value: "miss", label: "Smallest typical sideways miss" }]
      : []),
    { value: "median_high", label: "Highest median" },
    { value: "median_low", label: "Lowest median" },
  ];
  const stat: RankingStat = stats.some((s) => s.value === statistic)
    ? statistic
    : "range";
  const result = rankClubs(shots, {
    metric,
    unit,
    lateral,
    statistic: stat,
    minShots: Number(minimum),
  });
  const suffix = stat === "relative" ? "%" : trendUnit(metric, unit);
  const measuredUnit = trendUnit(metric, unit);
  const magnitude = Math.max(1, ...result.rows.map((r) => Math.abs(r.score)));
  const label =
    stat === "range"
      ? "80% width"
      : stat === "relative"
        ? "Relative width"
        : stat === "miss"
          ? "Typical miss"
          : "Median";
  return (
    <>
      <ChartTools playback={playbackControl}>
        {settings}
        <div className="plot-controls">
          {" "}
          <Select
            size="xs"
            label="Minimum shots"
            value={minimum}
            data={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "30", label: "30" },
              { value: "1", label: "All samples" },
            ]}
            onChange={(v) => v && setMinimum(v)}
          />
        </div>
      </ChartTools>
      <div className="plot-controls ranking-controls">
        {unitsControl}
        <Select
          size="xs"
          label="Measurement"
          value={metric}
          data={trendMetrics.filter((m) => m.value !== "spread")}
          onChange={(v) => v && setMetric(v as RankingMetric)}
        />
        <Select
          size="xs"
          label="Rank by"
          className="ranking-stat-select"
          value={stat}
          data={stats}
          onChange={(v) => v && setStatistic(v as RankingStat)}
        />
        {metric === "side" && (
          <div className="control-field">
            <span className="control-label">Left/right at</span>
            <SegmentedControl
              size="xs"
              disabled={metric !== "side"}
              aria-label="Ranking left/right position"
              value={lateral}
              onChange={(v) => onLateralChange(v as Metric)}
              data={[
                { value: "carry", label: "Landing" },
                { value: "total", label: "Finishing" },
              ]}
            />
          </div>
        )}
      </div>
      <div className="availability trend-availability">
        <strong>{result.rows.length} ranked groups</strong>
        {result.insufficient > 0 && (
          <span>{result.insufficient} below the minimum sample</span>
        )}
        {result.unavailable > 0 && (
          <span>{result.unavailable} without a rankable measurement</span>
        )}
      </div>
      <p className="muted small">
        {stat === "range"
          ? "P90 − P10 of observed shots. Smaller means more repeatable for this measurement."
          : stat === "relative"
            ? "Distance P90 − P10, divided by median distance. Compares spread relative to club length."
            : stat === "miss"
              ? "Median absolute sideways offset. Smaller means closer to the target line."
              : "Ranked by the observed median of this measurement."}
      </p>
      {metric === "side" && stat === "range" && (
        <p className="muted small">
          A tight group can still miss left or right. The median shows that
          bias.
        </p>
      )}
      {result.rows.length ? (
        <>
          <div className="ranking-mobile" aria-label="Club rankings">
            <p className="muted small">
              {label} ({suffix}) · tap a club for details
            </p>
            {result.rows.map((r) => (
              <details className="ranking-mobile-row" key={r.key}>
                <summary>
                  <span className="ranking-mobile-rank">{r.rank}</span>
                  <span className="ranking-mobile-club">
                    <strong>{r.club.club_label}</strong>
                    <span>
                      <Badge
                        size="xs"
                        color={setColor(r.club.set_id)}
                        variant="light"
                      >
                        {r.club.set_id}
                      </Badge>{" "}
                      <small>{r.club.source}</small>
                    </span>
                  </span>
                  <strong>{format(r.score)}</strong>
                </summary>
                <dl>
                  <div>
                    <dt>Median</dt>
                    <dd>
                      {format(r.median)} {measuredUnit}
                    </dd>
                  </div>
                  <div>
                    <dt>Middle 80%</dt>
                    <dd>
                      {format(r.low)} – {format(r.high)} {measuredUnit}
                    </dd>
                  </div>
                  <div>
                    <dt>Sample</dt>
                    <dd>
                      {r.n} {r.n === 1 ? "shot" : "shots"} · {r.sessions}{" "}
                      {r.sessions === 1 ? "session" : "sessions"}
                    </dd>
                  </div>
                </dl>
                {(r.n < 10 || r.sessions < 2) && (
                  <p className="muted small">
                    Limited history:{" "}
                    {r.n < 10
                      ? "fewer than 10 shots"
                      : "only one dated session"}
                    .
                  </p>
                )}
                {r.undated > 0 && (
                  <p className="muted small">
                    Includes {r.undated} undated shots.
                  </p>
                )}
                <MeasurementContext shot={r.club} />
              </details>
            ))}
          </div>
          <Table.ScrollContainer
            className="ranking-scroll"
            minWidth={750}
            maxHeight={440}
            type="native"
            tabIndex={0}
            role="region"
            aria-label="Club rankings"
          >
            <Table
              className="ranking-table"
              stickyHeader
              stickyHeaderOffset={0}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Rank</Table.Th>
                  <Table.Th>Club / set</Table.Th>
                  <Table.Th>
                    {label} ({suffix})
                  </Table.Th>
                  <Table.Th>Median ({measuredUnit})</Table.Th>
                  <Table.Th>Middle 80% ({measuredUnit})</Table.Th>
                  <Table.Th>Shots</Table.Th>
                  <Table.Th>Sessions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.rows.map((r) => (
                  <Table.Tr key={r.key}>
                    <Table.Td>{r.rank}</Table.Td>
                    <Table.Td>
                      <div className="ranking-club">
                        <i
                          style={{
                            background: color(
                              r.club[colorBy],
                              all.map((s) => s[colorBy]),
                            ),
                          }}
                        />
                        <strong>{r.club.club_label}</strong>
                        <Badge
                          size="xs"
                          variant="light"
                          color={setColor(r.club.set_id)}
                        >
                          {r.club.set_id}
                        </Badge>
                      </div>
                      <div className="ranking-source muted">
                        <span>{r.club.source}</span>
                        <Button
                          className="context-button"
                          variant="default"
                          size="compact-xs"
                          aria-label={`Measurement details for ${r.club.club_label}, ${r.club.set_id}, ${r.club.source}`}
                          onClick={() => setDetail(r.club)}
                        >
                          Details
                        </Button>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div className="ranking-value">
                        <strong>{format(r.score)}</strong>
                        <span className="ranking-bar">
                          <i
                            style={{
                              width: `${(Math.abs(r.score) / magnitude) * 100}%`,
                              background: color(
                                r.club[colorBy],
                                all.map((s) => s[colorBy]),
                              ),
                            }}
                          />
                        </span>
                      </div>
                    </Table.Td>
                    <Table.Td>{format(r.median)}</Table.Td>
                    <Table.Td>
                      {format(r.low)} – {format(r.high)}
                    </Table.Td>
                    <Table.Td>
                      <Tooltip
                        events={{ hover: true, focus: true, touch: true }}
                        label={
                          r.n < 10
                            ? "Fewer than 10 shots: a small sample."
                            : `${r.n} measured shots`
                        }
                      >
                        <span
                          className={r.n < 10 ? "limited-support" : undefined}
                          tabIndex={0}
                        >
                          {r.n}
                        </span>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip
                        events={{ hover: true, focus: true, touch: true }}
                        label={`${r.sessions === 1 ? "Only one dated session: more history will make this comparison more useful." : `${r.sessions} dated sessions`}${r.undated ? ` · ${r.undated} undated shots also included.` : ""}`}
                      >
                        <span
                          className={
                            r.sessions < 2 ? "limited-support" : undefined
                          }
                          tabIndex={0}
                        >
                          {r.sessions}
                          {r.undated > 0 ? "*" : ""}
                        </span>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </>
      ) : (
        <div className="chart-empty">
          <h3>No clubs meet this selection.</h3>
          <p>Try a different measurement, date range, or minimum sample.</p>
        </div>
      )}

      <Modal
        opened={detail !== null}
        onClose={() => setDetail(null)}
        title="Measurement details"
        centered
        closeButtonProps={{ "aria-label": "Close measurement details" }}
      >
        {detail && <MeasurementContext shot={detail} />}
      </Modal>
      <p className="chart-note">
        Clubs and settings stay separate. Dotted counts: limited history. *
        includes undated shots.
      </p>
    </>
  );
}
