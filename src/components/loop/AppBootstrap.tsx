import { useEffect, useState, type ReactNode } from "react";
import { loadSkillsCatalog } from "@/lib/loop-data";
import { hydrateStore } from "@/lib/loop-store";

export function AppBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await loadSkillsCatalog();
      await hydrateStore();
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading Loop…</p>
      </div>
    );
  }

  return <>{children}</>;
}
