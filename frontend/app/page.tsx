import Link from "next/link";
import { Shield, ArrowRight, Camera, LayoutDashboard } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground p-6">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary mb-2">
          <Shield className="w-8 h-8" />
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          IntelliGuard Biometric Access Control
        </h1>

        <p className="text-base text-muted-foreground max-w-lg mx-auto">
          AI-powered face recognition, pgvector similarity search, access decision engine, and real-time security telemetry.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <LayoutDashboard className="w-4 h-4" /> Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/dashboard/simulation"
            className="w-full sm:w-auto px-6 py-3 bg-secondary hover:bg-muted text-secondary-foreground font-semibold text-sm rounded-xl border border-border transition-all flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" /> Webcam Simulation
          </Link>
        </div>
      </div>
    </div>
  );
}
