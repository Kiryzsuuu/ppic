"use client";

import { useEffect } from "react";

export default function PrintTitle(props: { title?: string }) {
  useEffect(() => {
    const prevTitle = document.title;
    const nextTitle = props.title ?? "";

    const apply = () => {
      document.title = nextTitle;
    };

    apply();

    window.addEventListener("beforeprint", apply);
    return () => {
      window.removeEventListener("beforeprint", apply);
      document.title = prevTitle;
    };
  }, [props.title]);

  return null;
}
