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
  XCircle,
  Zap,
  Users,
  UserCheck,
  History,
  ShieldAlert,
  AlertTriangle,
  Clock,
  User,
} from "lucide-react";
import { getServerSession } from "@/lib/get-session";
import { LandingHeaderAuth } from "@/components/landing-header-auth";

export default async function Home() {
  const session = await getServerSession();
  const user = session?.user
    ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }
    : null;

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

          <LandingHeaderAuth user={user} />
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
                  href="/dashboard/persons/register"
                  className="w-full sm:w-auto px-6 py-3 bg-background hover:bg-muted text-foreground font-semibold text-sm rounded-xl border border-border transition-all flex items-center justify-center gap-2"
                >
                  <span>Enroll Identity</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>
            </div>

            {/* Interactive Preview Mockup - Styled Like the Dashboard */}
            <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-4 sm:p-6 shadow-2xl relative overflow-hidden space-y-5">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                {/* Window Top Controls & Dashboard Title */}
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-destructive/60 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/60 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/60 inline-block" />
                    <span className="text-xs font-mono text-muted-foreground ml-2 hidden sm:inline">
                      dashboard://security-overview
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold">ALL SYSTEMS OPERATIONAL</span>
                  </div>
                </div>

                {/* Mini System Health Panel */}
                <div className="p-3 rounded-xl border border-border bg-background/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">Neural Inference:</span>
                    <span className="font-mono font-semibold text-foreground">Online (28ms)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">pgvector Search:</span>
                    <span className="font-mono font-semibold text-foreground">Operational</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">ESP32 Terminals:</span>
                    <span className="font-mono font-semibold text-foreground">Connected</span>
                  </div>
                </div>

                {/* Mini Dashboard KPI Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl border border-border/80 bg-background/40">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span className="text-[11px]">Registered</span>
                      <Users className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="text-lg font-bold font-mono text-foreground">1,284</div>
                    <span className="text-[10px] text-muted-foreground">Active personnel</span>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-background/40">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span className="text-[11px]">Active</span>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">1,240</div>
                    <span className="text-[10px] text-muted-foreground">Face embeddings</span>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-background/40">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span className="text-[11px]">Today Attempts</span>
                      <History className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-lg font-bold font-mono text-foreground">3,492</div>
                    <span className="text-[10px] text-muted-foreground">Total scans</span>
                  </div>

                  <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                      <span className="text-[11px]">Granted</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">3,418</div>
                    <span className="text-[10px] text-muted-foreground">97.9% unlock rate</span>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-background/40 col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span className="text-[11px]">Active Alerts</span>
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="text-lg font-bold font-mono text-amber-500">2</div>
                    <span className="text-[10px] text-muted-foreground">Under review</span>
                  </div>
                </div>

                {/* Dashboard Recent Access Table Preview */}
                <div className="rounded-xl border border-border/80 bg-background/60 p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Recent Access Events</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">Live Telemetry Feed</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground font-mono uppercase text-[10px]">
                          <th className="pb-2">Time</th>
                          <th className="pb-2">Individual</th>
                          <th className="pb-2">Match</th>
                          <th className="pb-2">Access</th>
                          <th className="pb-2">Gate / Reason</th>
                          <th className="pb-2 text-right">Similarity</th>
                          <th className="pb-2 text-right">Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                        <tr className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 text-muted-foreground">10:24:12 AM</td>
                          <td className="py-2.5 font-sans font-medium text-foreground">Alex Rivera</td>
                          <td className="py-2.5 font-semibold text-foreground">MATCHED</td>
                          <td className="py-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> GRANTED
                            </span>
                          </td>
                          <td className="py-2.5 text-muted-foreground uppercase text-[10px]">Main Entrance</td>
                          <td className="py-2.5 text-right font-semibold text-foreground">98.4%</td>
                          <td className="py-2.5 text-right text-muted-foreground">0.12s</td>
                        </tr>
                        <tr className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 text-muted-foreground">10:22:45 AM</td>
                          <td className="py-2.5 font-sans font-medium text-foreground">Elena Rostova</td>
                          <td className="py-2.5 font-semibold text-foreground">MATCHED</td>
                          <td className="py-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> GRANTED
                            </span>
                          </td>
                          <td className="py-2.5 text-muted-foreground uppercase text-[10px]">Lab Access</td>
                          <td className="py-2.5 text-right font-semibold text-foreground">99.1%</td>
                          <td className="py-2.5 text-right text-muted-foreground">0.09s</td>
                        </tr>
                        <tr className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 text-muted-foreground">10:19:03 AM</td>
                          <td className="py-2.5 font-sans italic text-muted-foreground">Unknown Face</td>
                          <td className="py-2.5 font-semibold text-muted-foreground">UNKNOWN</td>
                          <td className="py-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-[10px]">
                              <XCircle className="w-3 h-3" /> DENIED
                            </span>
                          </td>
                          <td className="py-2.5 text-muted-foreground uppercase text-[10px]">Perimeter Gate</td>
                          <td className="py-2.5 text-right font-semibold text-foreground">No Match</td>
                          <td className="py-2.5 text-right text-muted-foreground">0.08s</td>
                        </tr>
                      </tbody>
                    </table>
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
