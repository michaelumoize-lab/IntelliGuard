import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  Camera,
  LayoutDashboard,
  Cpu,
  Lock,
  Sparkles,
  Activity,
  Scan,
  Database,
  CheckCircle2,
  Zap,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Top Portal Navigation */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-base block text-foreground">IntelliGuard</span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                Biometric Defense Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live System Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>AI SERVICE ONLINE</span>
            </div>

            <Link
              href="/dashboard/simulation"
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors hidden md:inline-flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Webcam Reticle</span>
            </Link>

            <Link
              href="/dashboard"
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>Command Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden">
          {/* Subtle Cyber Grid Background Accent */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>InsightFace 512D ArcFace + pgvector Similarity</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                Intelligent Biometric <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-primary via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                  Access Control Intelligence
                </span>
              </h1>

              {/* Description */}
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Enterprise physical security orchestrator combining sub-second neural face recognition,
                zero-trust hardware device authorization, real-time audio HUD feedback, and live telemetry.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <LayoutDashboard className="w-4 h-4" /> Enter Dashboard
                </Link>

                <Link
                  href="/dashboard/simulation"
                  className="w-full sm:w-auto px-6 py-3 bg-secondary hover:bg-muted text-secondary-foreground font-semibold text-sm rounded-xl border border-border transition-all flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 text-primary" /> Live Webcam Reticle
                </Link>

                <Link
                  href="/dashboard/persons/register"
                  className="w-full sm:w-auto px-6 py-3 bg-background hover:bg-muted text-foreground font-semibold text-sm rounded-xl border border-border transition-all flex items-center justify-center gap-2"
                >
                  <span>Enroll Identity</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>
            </div>

            {/* Interactive Preview HUD Mockup */}
            <div className="mt-12 sm:mt-16 max-w-4xl mx-auto">
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                {/* Window Top Controls */}
                <div className="flex items-center justify-between pb-4 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-destructive/60 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/60 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/60 inline-block" />
                    <span className="text-xs font-mono text-muted-foreground ml-2">
                      terminal://sim-gate-01.local
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-500">
                    <Zap className="w-3.5 h-3.5" />
                    <span>28ms INFERENCE</span>
                  </div>
                </div>

                {/* Biometric HUD Simulation Snapshot */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  {/* Verification Telemetry */}
                  <div className="p-4 rounded-xl border border-border/80 bg-background/50 space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>BIOMETRIC STATUS</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                        MATCHED
                      </span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-foreground">98.4%</div>
                    <p className="text-[11px] text-muted-foreground">
                      ArcFace cosine similarity exceeds threshold (0.60). Identity authenticated.
                    </p>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-[98%]" />
                    </div>
                  </div>

                  {/* Access Grant */}
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                      <span>DOOR ACTUATOR</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      GRANTED
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Relay triggered: Unlock pulse sent to electronic strike. Lock timeout: 5s.
                    </p>
                    <span className="inline-block font-mono text-[10px] text-muted-foreground">
                      AUTH CODE: AUT-7F3B92
                    </span>
                  </div>

                  {/* Identity Detail */}
                  <div className="p-4 rounded-xl border border-border/80 bg-background/50 space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>SUBJECT PROFILE</span>
                      <span className="text-[10px] font-mono text-primary">PER-481920</span>
                    </div>
                    <div className="text-sm font-bold text-foreground">Verified Personnel</div>
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Role:</span>
                        <span className="font-semibold text-foreground">Engineering Lead</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Security Level:</span>
                        <span className="font-semibold text-emerald-500">Tier 1 Unrestricted</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vector Dims:</span>
                        <span className="font-mono text-foreground">512 FP32</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-16 border-t border-border bg-muted/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Engineered for High-Security Physical Infrastructure
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Unified biometric intelligence bridging modern neural vision with enterprise edge hardware.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
                <div className="p-2.5 w-fit rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Scan className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">512D ArcFace Inference</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  InsightFace buffalo_l deep neural network crops, normalizes, and embeds faces with extreme fidelity.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
                <div className="p-2.5 w-fit rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">pgvector Similarity Index</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  PostgreSQL native vector similarity queries execute across thousands of identities in milliseconds.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
                <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Edge Gate Authentication</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cryptographic device API keys validate physical terminals and actuate door locks instantly.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
                <div className="p-2.5 w-fit rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Live Telemetry & Sound</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Web Audio synthesizers deliver real-time terminal audio chimes with automated security alert auditing.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">IntelliGuard Security Platform</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/simulation" className="hover:text-foreground transition-colors">
              Simulation
            </Link>
            <Link href="/dashboard/persons" className="hover:text-foreground transition-colors">
              Personnel
            </Link>
            <Link href="/settings/account" className="hover:text-foreground transition-colors">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
