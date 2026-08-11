"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Check, Eye, EyeOff, ShieldAlert, Key } from "lucide-react";

interface DeviceApiKeyDialogProps {
  open: boolean;
  apiKey: string | null;
  deviceName?: string;
  onClose: () => void;
}

export function DeviceApiKeyDialog({
  open,
  apiKey,
  deviceName,
  onClose,
}: DeviceApiKeyDialogProps) {
  const [copied, setCopied] = React.useState(false);
  const [showKey, setShowKey] = React.useState(true);

  if (!apiKey) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy API key:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Key className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">
            API Key Generated
          </DialogTitle>
          <DialogDescription className="text-center">
            {deviceName ? `Credentials for "${deviceName}"` : "New device credentials created"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert variant="destructive" className="bg-amber-500/10 text-amber-900 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/40">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="font-semibold text-amber-800 dark:text-amber-300">
              Save This Key Securely!
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300/90 mt-1">
              This API key will <strong>only be shown once</strong>. It cannot be retrieved after closing this window. If lost, you will need to regenerate a new key.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Plaintext Device API Key
            </label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  readOnly
                  value={apiKey}
                  className="font-mono text-sm pr-10 bg-muted/40 font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                type="button"
                variant={copied ? "secondary" : "default"}
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto px-8"
          >
            I Have Saved This Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
