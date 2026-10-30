import type { ComponentPropsWithRef } from "react";
import { Shield } from "lucide-react";

export function Logo(props: ComponentPropsWithRef<"svg">) {
  return (
    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
      <Shield className="size-4" aria-label="IntelliGuard Security" role="img" />
    </div>
  );
}
