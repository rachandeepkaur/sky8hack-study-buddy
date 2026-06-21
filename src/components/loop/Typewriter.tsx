import { useEffect, useState } from "react";

export function Typewriter({ text, speedMs = 28, className = "" }: { text: string; speedMs?: number; className?: string }) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setShown("");
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, speedMs]);
  return (
    <span className={className + (done ? "" : " loop-caret")}>{shown}</span>
  );
}
