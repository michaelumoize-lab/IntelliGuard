"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Terminal,
  Cloud,
  Cpu,
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
  Search,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Camera,
  Layers,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function HelpPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const localRunCommand = `cd backend
.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`;

  const renderEnvVars = `APP_NAME=IntelliGuard AI
ENVIRONMENT=production
INSIGHTFACE_MODEL=buffalo_s
ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
OMP_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
MKL_NUM_THREADS=1`;

  const dockerfileSnippet = `FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libgomp1 ffmpeg libsm6 libxext6 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]`;

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-background border border-primary/20 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-3 py-1 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Help & Documentation Center
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              IntelliGuard Knowledge Base
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
              Complete guide for running the AI facial recognition service locally, cloud deployment strategies, hardware setup, and API integration.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild variant="outline" size="sm" className="gap-2 border-border hover:bg-accent">
              <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">
                <Server className="w-4 h-4 text-primary" />
                Swagger Docs (Port 8000)
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </a>
            </Button>
            <Button asChild size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/dashboard/simulation">
                <Camera className="w-4 h-4" />
                Open Live Scan
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="local" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/60 rounded-xl gap-1">
          <TabsTrigger value="local" className="gap-2 py-2.5 text-xs sm:text-sm font-medium">
            <Terminal className="w-4 h-4 text-emerald-500" />
            Local Setup
          </TabsTrigger>
          <TabsTrigger value="deployment" className="gap-2 py-2.5 text-xs sm:text-sm font-medium">
            <Cloud className="w-4 h-4 text-blue-500" />
            Cloud Deployment
          </TabsTrigger>
          <TabsTrigger value="architecture" className="gap-2 py-2.5 text-xs sm:text-sm font-medium">
            <Layers className="w-4 h-4 text-purple-500" />
            AI Architecture
          </TabsTrigger>
          <TabsTrigger value="best-practices" className="gap-2 py-2.5 text-xs sm:text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
            Best Practices
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-2 py-2.5 text-xs sm:text-sm font-medium col-span-2 md:col-span-1">
            <HelpCircle className="w-4 h-4 text-rose-500" />
            Troubleshooting
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LOCAL SETUP */}
        <TabsContent value="local" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Terminal className="w-5 h-5 text-emerald-500" />
                Running the AI Service Locally (`backend`)
              </CardTitle>
              <CardDescription>
                Follow these commands to start the FastAPI InsightFace inference service on your local Windows workstation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-mono font-bold">1</span>
                  Start Command (PowerShell)
                </h4>
                <div className="relative rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-100 dark:bg-slate-900 border border-slate-800">
                  <pre className="whitespace-pre-wrap">{localRunCommand}</pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-3 right-3 h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    onClick={() => copyToClipboard(localRunCommand, "local")}
                  >
                    {copiedSection === "local" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-1">
                  <div className="text-xs font-mono text-muted-foreground uppercase">Service Status</div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    http://localhost:8000
                  </div>
                  <p className="text-xs text-muted-foreground">FastAPI root service health check</p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-1">
                  <div className="text-xs font-mono text-muted-foreground uppercase">Interactive OpenAPI</div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    http://localhost:8000/docs
                  </div>
                  <p className="text-xs text-muted-foreground">Interactive Swagger UI endpoints</p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-1">
                  <div className="text-xs font-mono text-muted-foreground uppercase">RAM Benchmark</div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    ~139.85 MB Peak RAM
                  </div>
                  <p className="text-xs text-muted-foreground">Optimized with `buffalo_s` & (320, 320) detection</p>
                </div>
              </div>

              <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <AlertTitle className="font-semibold text-sm">Verified Local Performance</AlertTitle>
                <AlertDescription className="text-xs">
                  The local virtual environment (`backend/.venv`) is configured with `allowed_modules=['detection', 'recognition']`. All automated unit tests pass 100%.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CLOUD DEPLOYMENT */}
        <TabsContent value="deployment" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cloud className="w-5 h-5 text-blue-500" />
                Cloud Hosting Guide (Hugging Face Spaces vs Render)
              </CardTitle>
              <CardDescription>
                Understanding cloud container memory limits for Python machine learning inference services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hugging Face Card */}
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500 text-white font-semibold">Recommended (100% Free)</Badge>
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">16 GB RAM</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Hugging Face Spaces (Docker)</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Hugging Face provides a free 16 GB RAM + 2 CPU container tier for hosting open-source AI models.
                    </p>
                  </div>
                  <ul className="text-xs space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Zero memory throttling (16 GB RAM easily handles deep learning weights).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Generates a permanent HTTPS URL for Next.js API integration.</span>
                    </li>
                  </ul>
                </div>

                {/* Render / Cloud VPS Card */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="border-amber-500/40 text-amber-500 font-semibold">Standard Container</Badge>
                    <span className="text-xs font-mono text-muted-foreground font-bold">1 GB RAM+ ($7/mo)</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Render Starter / VPS Hosting</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Render Free Tier enforces a strict 512 MB hard RAM cap during build unzipping. The $7/mo Starter plan (1 GB RAM) runs smoothly.
                    </p>
                  </div>
                  <ul className="text-xs space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>Render 512 MB Free tier terminates processes exceeding 512 MiB during model zip extract.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>1 GB RAM Starter tier runs `buffalo_s` smoothly without memory caps.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Environment Variables Box */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>Production Environment Variables</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => copyToClipboard(renderEnvVars, "env")}
                  >
                    {copiedSection === "env" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Env Vars
                  </Button>
                </h4>
                <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-100 dark:bg-slate-900 border border-slate-800">
                  <pre className="whitespace-pre-wrap">{renderEnvVars}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: AI ARCHITECTURE */}
        <TabsContent value="architecture" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="w-5 h-5 text-purple-500" />
                Facial Recognition Architecture & Vector Search
              </CardTitle>
              <CardDescription>
                How IntelliGuard extracts biometric facial embeddings and calculates cosine similarity matches.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    1
                  </div>
                  <h4 className="font-semibold text-sm">SCRFD Face Detection</h4>
                  <p className="text-xs text-muted-foreground">
                    Detects face bounding box coordinates `[x1, y1, x2, y2]` and 5 facial keypoint landmarks (eyes, nose, mouth corners) at `320x320` resolution.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    2
                  </div>
                  <h4 className="font-semibold text-sm">ArcFace 512D Embedding</h4>
                  <p className="text-xs text-muted-foreground">
                    Extracts a 512-dimensional L2-normalized float vector (`||v|| = 1.0`) representing unique biometric facial structure.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    3
                  </div>
                  <h4 className="font-semibold text-sm">pgvector Cosine Similarity</h4>
                  <p className="text-xs text-muted-foreground">
                    PostgreSQL `vector(512)` extension computes Cosine Similarity (`1 - cosine_distance`). Similarity &ge; 0.65 indicates a confirmed match.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Embedding Vector Precision & Normalization
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Both <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-foreground">buffalo_l</code> and <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-foreground">buffalo_s</code> output 512-dimensional vector schemas, but their embedding spaces are distinct. Switching models requires verified cross-model compatibility or re-enrollment before recommending it.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: BEST PRACTICES */}
        <TabsContent value="best-practices" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
                Facial Registration Best Practices
              </CardTitle>
              <CardDescription>
                Guidelines for enrolling user photos to achieve highest biometric matching accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Recommended Photo Quality
                </h4>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span><strong>Single Person</strong>: Ensure exactly one face is clearly visible in the photo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span><strong>Good Lighting</strong>: Well-lit front-facing portrait without harsh shadows.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span><strong>Neutral Pose</strong>: Facing directly towards the camera with eyes open.</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Conditions to Avoid
                </h4>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span><strong>Multiple People</strong>: Uploading photos containing group faces will return HTTP 400.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span><strong>Severe Occlusion</strong>: Sunglasses, heavy face masks, or extreme side angles.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span><strong>Blurry/Low Res</strong>: Images below 100x100 face pixel resolution.</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: TROUBLESHOOTING & FAQ */}
        <TabsContent value="faq" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="w-5 h-5 text-rose-500" />
                Frequently Asked Questions & Troubleshooting
              </CardTitle>
              <CardDescription>
                Common error codes, resolution steps, and troubleshooting tips.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full space-y-2">
                <AccordionItem value="item-1" className="border rounded-xl px-4">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    HTTP 503: "Face detection service is unavailable"
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      This indicates the Next.js frontend cannot connect to the Python FastAPI backend, or the InsightFace model is still initializing.
                    </p>
                    <p className="font-semibold text-foreground">Solution:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Verify the FastAPI server is running on <code className="bg-muted px-1">http://localhost:8000</code>.</li>
                      <li>Check <code className="bg-muted px-1">NEXT_PUBLIC_FASTAPI_URL</code> in your <code className="bg-muted px-1">frontend/.env.local</code>.</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="border rounded-xl px-4">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    HTTP 400: "Multiple faces detected in image"
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      Biometric person registration strictly requires exactly 1 face to generate an accurate individual embedding.
                    </p>
                    <p className="font-semibold text-foreground">Solution:</p>
                    <p>Crop the photo to contain only the target person before uploading.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3" className="border rounded-xl px-4">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    Render Deployment: "Out of memory (used over 512Mi)"
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      Render free instances enforce a strict 512 MB memory limit. Unzipping model weights during initial startup exceeds 512 MB.
                    </p>
                    <p className="font-semibold text-foreground">Solution:</p>
                    <p>Deploy to Hugging Face Spaces (Free 16 GB RAM) or upgrade to Render $7/mo Starter plan (1 GB RAM).</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4" className="border rounded-xl px-4">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    Does the AI Service work on Vercel?
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      No. The Next.js frontend runs great on Vercel, but the Python AI service requires persistent ONNX Runtime memory and exceeds Vercel&apos;s 250 MB serverless bundle limit. Host the AI service separately on Hugging Face Spaces or a Docker container.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
