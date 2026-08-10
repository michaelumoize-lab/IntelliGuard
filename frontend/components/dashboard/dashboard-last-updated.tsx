"use client";

import React, { useEffect, useState } from "react";

export function DashboardLastUpdated({ isoTimestamp }: { isoTimestamp: string }) {
  const [formattedTime, setFormattedTime] = useState<string>("");

  useEffect(() => {
    setFormattedTime(
      new Date(isoTimestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }, [isoTimestamp]);

  return <span className="font-mono text-muted-foreground">{formattedTime || "Loading..."}</span>;
}
