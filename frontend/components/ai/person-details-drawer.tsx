"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Mail,
  Phone,
  Building,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Camera,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface PersonDrawerData {
  id: number;
  personCode: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  status: string;
  category: string;
  faceImageUrl?: string | null;
  createdAt?: string | Date;
  embeddingsCount?: number;
}

interface PersonDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  person: PersonDrawerData | null;
  onStatusUpdated?: (newStatus: string) => void;
}

export function PersonDetailsDrawer({
  isOpen,
  onClose,
  person,
  onStatusUpdated,
}: PersonDetailsDrawerProps) {
  const router = useRouter();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!person) return null;

  const handleStatusChange = async (newStatus: "active" | "inactive" | "suspended") => {
    if (isUpdatingStatus || person.status.toLowerCase() === newStatus) return;
    setIsUpdatingStatus(true);

    try {
      const res = await fetch(`/api/persons/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Person status updated to ${newStatus.toUpperCase()}`);
        if (onStatusUpdated) onStatusUpdated(newStatus);
        router.refresh();
      } else {
        toast.error(data.message || "Failed to update person status.");
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      toast.error("Failed to update person status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const currentStatus = person.status.toLowerCase();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-border p-6 overflow-y-auto space-y-6">
        <SheetHeader className="pb-4 border-b border-border/70 space-y-1">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px] font-mono uppercase px-2.5 py-0.5">
              Code: {person.personCode}
            </Badge>
            <Badge
              variant={
                currentStatus === "active"
                  ? "default"
                  : currentStatus === "suspended"
                  ? "destructive"
                  : "secondary"
              }
              className="text-xs uppercase font-semibold"
            >
              {person.status}
            </Badge>
          </div>
          <SheetTitle className="text-xl font-bold text-foreground">
            {person.firstName} {person.lastName}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Personnel biometric profile & access control clearance details.
          </SheetDescription>
        </SheetHeader>

        {/* Face Image & Biometric Vector Health Card */}
        <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 flex flex-col items-center text-center space-y-3">
          <div className="w-28 h-28 rounded-2xl bg-black border-2 border-border overflow-hidden flex items-center justify-center shadow-md relative">
            {person.faceImageUrl ? (
              <Image
                src={person.faceImageUrl}
                alt={`${person.firstName} ${person.lastName}`}
                width={112}
                height={112}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Active Enrolled Biometric
            </span>
            <p className="text-[11px] font-mono text-muted-foreground">
              Enrolled 512D Biometric Vector
            </p>
          </div>
        </div>

        {/* Contact & Organizational Details */}
        <div className="space-y-3 text-xs">
          <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground tracking-wider block">
            Organizational Information
          </span>
          <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-card">
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-primary" /> Department
              </span>
              <span className="font-semibold text-foreground">{person.department || "General"}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Category
              </span>
              <span className="font-semibold text-foreground uppercase text-[11px] font-mono">{person.category}</span>
            </div>
            {person.email && (
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Email
                </span>
                <span className="font-mono text-foreground truncate max-w-[190px]">{person.email}</span>
              </div>
            )}
            {person.phone && (
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" /> Phone
                </span>
                <span className="font-mono text-foreground">{person.phone}</span>
              </div>
            )}
            {person.createdAt && (
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> Enrolled On
                </span>
                <span className="font-mono text-foreground">
                  {new Date(person.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Access Status Toggle Buttons */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground tracking-wider block">
            Change Facility Access Status
          </span>
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant={currentStatus === "active" ? "default" : "outline"}
              onClick={() => handleStatusChange("active")}
              disabled={isUpdatingStatus}
              className="text-xs"
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={currentStatus === "inactive" ? "secondary" : "outline"}
              onClick={() => handleStatusChange("inactive")}
              disabled={isUpdatingStatus}
              className="text-xs"
            >
              Inactive
            </Button>
            <Button
              size="sm"
              variant={currentStatus === "suspended" ? "destructive" : "outline"}
              onClick={() => handleStatusChange("suspended")}
              disabled={isUpdatingStatus}
              className="text-xs"
            >
              Suspended
            </Button>
          </div>
        </div>

        {/* Profile Full Edit Button */}
        <div className="pt-2">
          <Button asChild variant="outline" className="w-full text-xs gap-2">
            <Link href={`/dashboard/persons/${person.id}`}>
              <Camera className="w-3.5 h-3.5 text-primary" /> Replace Face Photo / Full Profile
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
