import React from "react";
import { RegisterPersonForm } from "./register-form";
import { UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default function RegisterPersonPage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-lg">
              <UserPlus className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Register New Person</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Enroll a new individual into the IntelliGuard biometric database with automatic 512D face vector generation.
          </p>
        </div>
      </div>

      {/* Form Container */}
      <RegisterPersonForm />
    </div>
  );
}
