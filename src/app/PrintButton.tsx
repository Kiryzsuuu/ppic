"use client";

import { useEffect } from "react";

export default function PrintButton(props: { className?: string; label?: string }) {
  const label = props.label ?? "Cetak / Simpan PDF";

  const triggerPrint = () => {
    const prevTitle = document.title;
    document.title = "";

    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);

    const t = window.setTimeout(() => {
      window.print();
      window.setTimeout(restore, 1000);
    }, 50);

    return () => {
      window.clearTimeout(t);
      restore();
    };
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("autoprint") !== "1") return;
    url.searchParams.delete("autoprint");
    window.history.replaceState({}, "", url.toString());
    return triggerPrint();
  }, []);

  return (
    <button
      type="button"
      className={
        props.className ??
        "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50"
      }
      onClick={() => {
        const url = new URL(window.location.href);
        if (url.searchParams.get("print") !== "1") {
          url.searchParams.set("print", "1");
          url.searchParams.set("autoprint", "1");
          url.searchParams.delete("day");
          url.searchParams.delete("week");
          url.hash = "";
          window.location.assign(url.toString());
          return;
        }
        triggerPrint();
      }}
    >
      {label}
    </button>
  );
}
