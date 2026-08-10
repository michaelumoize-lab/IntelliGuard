"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PersonModal } from "@/components/ai/person-modal";
import { ReplaceFaceModal } from "@/components/ai/replace-face-modal";
import { PencilIcon, CameraIcon, UserCheckIcon, UserXIcon, Loader2 } from "lucide-react";

export function PersonDetailsClientHeaderActions({ person }: { person: any }) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isReplaceFaceOpen, setIsReplaceFaceOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
          <PencilIcon className="mr-1.5 h-3.5 w-3.5" /> Edit Metadata
        </Button>

        <Button size="sm" onClick={() => setIsReplaceFaceOpen(true)}>
          <CameraIcon className="mr-1.5 h-3.5 w-3.5" /> Replace Face Photo
        </Button>
      </div>

      {isEditOpen && (
        <PersonModal
          isOpen={isEditOpen}
          initialData={person}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {isReplaceFaceOpen && (
        <ReplaceFaceModal
          isOpen={isReplaceFaceOpen}
          person={person}
          onClose={() => setIsReplaceFaceOpen(false)}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}

export function PersonDetailsStatusToggle({ person }: { person: any }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusToggle = async (newStatus: string) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/persons/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Updated status for ${person.firstName} ${person.lastName} to ${newStatus}.`);
        router.refresh();
      } else {
        toast.error(data.message || "Failed to update status.");
      }
    } catch (err) {
      toast.error("Failed to update person status.");
    } finally {
      setIsLoading(false);
    }
  };

  const isActive = person.status === "active";
  const targetStatus = isActive ? "inactive" : "active";

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isLoading}
      onClick={() => handleStatusToggle(targetStatus)}
      className={`h-7 text-xs min-w-[110px] flex items-center justify-center ${
        isActive ? "text-amber-600 dark:text-amber-400 hover:text-amber-700" : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
      }`}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          <span>Updating...</span>
        </>
      ) : isActive ? (
        <>
          <UserXIcon className="mr-1.5 h-3.5 w-3.5" />
          <span>Deactivate</span>
        </>
      ) : (
        <>
          <UserCheckIcon className="mr-1.5 h-3.5 w-3.5" />
          <span>Activate</span>
        </>
      )}
    </Button>
  );
}
