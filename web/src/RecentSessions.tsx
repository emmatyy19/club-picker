import { useState } from "react";
import { Button, Group, NumberInput, Popover, Tooltip } from "@mantine/core";
import { recentSessionFilters, type Filters, type Shot } from "./data";

export function RecentSessions({
  shots,
  filters,
  onChange,
}: {
  shots: Shot[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [count, setCount] = useState<string | number>(3);
  const dateCount = new Set(
    shots.flatMap((s) => (s.session_date ? [s.session_date] : [])),
  ).size;
  const active = (n: number) => {
    if (!dateCount || filters.session || filters.undated) return false;
    const range = recentSessionFilters(shots, filters, n);
    return filters.start === range.start && filters.end === range.end;
  };
  const select = (n: number) => {
    onChange(recentSessionFilters(shots, filters, n));
    setOpened(false);
  };
  const validCount =
    typeof count === "number" &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= dateCount;
  return (
    <div className="recent-sessions" role="group" aria-label="Recent sessions">
      <Tooltip
        multiline
        w={260}
        label="Counted by practice date across your library. Same-day sets and sources stay together. Your other filters still apply."
      >
        <span className="recent-sessions-label" tabIndex={0}>
          Recent
        </span>
      </Tooltip>
      <div className="recent-session-buttons">
        {[1, 3, 5].map((n) => (
          <Button
            key={n}
            size="xs"
            variant={active(n) ? "light" : "default"}
            aria-pressed={active(n)}
            disabled={dateCount < n}
            onClick={() => select(n)}
          >
            {n === 1 ? "Latest session" : `Last ${n}`}
          </Button>
        ))}
        <Popover
          opened={opened}
          onChange={setOpened}
          position="bottom-start"
          withinPortal
          trapFocus
        >
          <Popover.Target>
            <Button
              size="xs"
              variant="default"
              disabled={!dateCount}
              aria-expanded={opened}
              onClick={() => setOpened((v) => !v)}
            >
              Custom…
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <NumberInput
              label="Latest practice dates"
              value={count}
              onChange={setCount}
              min={1}
              max={dateCount}
              allowDecimal={false}
              allowNegative={false}
              w={200}
            />
            <Group justify="flex-end" mt="sm">
              <Button
                size="xs"
                disabled={!validCount}
                onClick={() => validCount && select(count as number)}
              >
                Apply
              </Button>
            </Group>
          </Popover.Dropdown>
        </Popover>
        <Button
          size="xs"
          variant="default"
          aria-pressed={
            !filters.start &&
            !filters.end &&
            !filters.session &&
            !filters.undated
          }
          onClick={() =>
            onChange({
              ...filters,
              start: "",
              end: "",
              session: "",
              undated: false,
            })
          }
        >
          All dates
        </Button>
      </div>
    </div>
  );
}
