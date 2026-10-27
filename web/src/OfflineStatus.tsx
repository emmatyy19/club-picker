import { useEffect, useState } from "react";
import { Button } from "@mantine/core";
let registration: Promise<ServiceWorkerRegistration> | undefined;
export function OfflineStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState("Preparing offline access…");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV) {
      setStatus("Offline access is available in the installed build.");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      setStatus("Offline access is unavailable in this browser.");
      return;
    }
    let mounted = true;
    registration ??= navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL },
    );
    void registration
      .then((reg) => {
        const check = () => {
          if (!mounted) return;
          if (reg.active) setStatus("Ready for offline use");
          setWaiting(reg.waiting);
        };
        check();
        reg.addEventListener("updatefound", () =>
          reg.installing?.addEventListener("statechange", check),
        );
        void navigator.serviceWorker.ready.then(check);
      })
      .catch(() => {
        if (mounted) setStatus("Offline setup failed. Reopen online to retry.");
        registration = undefined;
      });
    return () => {
      mounted = false;
    };
  }, []);
  function update() {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => location.reload(),
      { once: true },
    );
    waiting?.postMessage("ACTIVATE_UPDATE");
  }
  return (
    <div className="offline-status">
      <span className="muted small" role="status">
        {status}
      </span>
      {waiting && (
        <Button variant="light" size="xs" onClick={update}>
          Update app & reload
        </Button>
      )}
      {!compact && (
        <>
          <p>
            While online, add this site to your phone’s home screen, open it
            from that icon, and wait for “Ready for offline use”. Import your
            library there, then test once in airplane mode before relying on it
            away from home.
          </p>
          <p className="muted small">
            On iPhone, use Safari’s Share menu → Add to Home Screen. On Android,
            use the browser’s Install app or Add to Home screen option. Offline
            storage can be removed by the browser or device; keep private
            backups. Updates reload the page, so save any unfinished log entry
            first.
          </p>
        </>
      )}
    </div>
  );
}
