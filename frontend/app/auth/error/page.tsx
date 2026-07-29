import { Suspense } from "react";
import ErrorContent from "./error-content";

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
