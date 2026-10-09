"use client";

import { useEffect, useState } from "react";

interface Loaded {
  src: string;
  image: HTMLImageElement;
}

/** Load a (data) URL into an HTMLImageElement for use with Konva. */
export function useHtmlImage(src: string | null | undefined): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLoaded({ src, image: img });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Only hand back an image that matches the current src, so a stale bitmap
  // is never shown while a new one is loading.
  return loaded && loaded.src === src ? loaded.image : null;
}
