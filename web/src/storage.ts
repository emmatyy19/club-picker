import { parseSnapshot, type Snapshot } from "./data";
const key = "club-picker.library.v1";
export function loadLibrary(): Snapshot | null {
  if (import.meta.env.MODE === "showcase") return null;
  const raw = localStorage.getItem(key);
  return raw ? parseSnapshot(JSON.parse(raw)) : null;
}
export function saveLibrary(snapshot: Snapshot): void {
  if (import.meta.env.MODE === "showcase")
    throw new Error(
      "Personal libraries cannot be saved in the synthetic demo.",
    );
  localStorage.setItem(key, JSON.stringify(parseSnapshot(snapshot)));
}
export function download(snapshot: Snapshot): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "club-picker-private-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Read only the reviewed file served by Vite, never raw provider exports.
export async function loadRepoLibrary(): Promise<Snapshot | null> {
  if (import.meta.env.MODE === "showcase") {
    const data = await import("../../data/synthetic/showcase.json");
    return parseSnapshot(data.default);
  }
  const response = await fetch("/__local_snapshot", { cache: "no-store" });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error("Could not read the repo library.");
  return parseSnapshot(await response.json());
}
