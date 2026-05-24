"use client";

import { useEffect } from "react";

import { trackShareViewed } from "@/app/lib/analytics";

// Fires the `share_viewed` GA event exactly once per mount. Server-side
// view bumps happen in app/c/[code]/page.tsx; this is the client-side
// counterpart so the event lands on the loaded gtag in the browser.

export function ShareViewBeacon() {
  useEffect(() => {
    trackShareViewed();
  }, []);
  return null;
}
