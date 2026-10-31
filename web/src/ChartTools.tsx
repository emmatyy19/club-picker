import { Button, Modal } from "@mantine/core";
import { useState, type ReactNode } from "react";

/** Common controls stay above the visualization in every chart mode. */
export function ChartTools({
  playback,
  children,
}: {
  playback: ReactNode;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <div className="chart-tools">
      {playback}
      <Button
        className="chart-settings-trigger"
        size="xs"
        variant="default"
        onClick={() => setOpened(true)}
      >
        Chart settings
      </Button>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Chart settings"
        size="md"
        centered
        closeButtonProps={{ "aria-label": "Close chart settings" }}
      >
        <div className="chart-settings-content">{children}</div>
      </Modal>
    </div>
  );
}
