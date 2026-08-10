"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PersonModal } from "@/components/ai/person-modal";
import { ReplaceFaceModal } from "@/components/ai/replace-face-modal";
import { DataTableSearch } from "@/components/dashboard/data-table-search";
import {
  PlusIcon,
  SearchIcon,
  FilterIcon,
  MoreVerticalIcon,
  EyeIcon,
  PencilIcon,
  CameraIcon,
  Trash2Icon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react";

interface PersonsClientFiltersProps {
  initialSearch: string;
  initialStatus: string;
  initialCategory: string;
}

export function PersonsClientFilters({
  initialSearch,
  initialStatus,
  initialCategory,
}: PersonsClientFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialSearch);

  const updateFilters = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // Reset to page 1 on filter change

    Object.entries(newParams).forEach(([key, val]) => {
      if (val && val !== "all") {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    updateFilters({ search: val });
  };

  return (
    <Card>
      <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Debounced Search-as-you-type Input */}
        <DataTableSearch
          placeholder="Search by code, name, email, phone, department..."
          className="max-w-none flex-1"
        />

        {/* Status & Category Filters */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 border border-input rounded-md px-2.5 py-1.5 text-xs bg-background">
            <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Status:</span>
            <select
              value={initialStatus}
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="bg-transparent border-none focus:outline-none cursor-pointer font-medium"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 border border-input rounded-md px-2.5 py-1.5 text-xs bg-background">
            <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Category:</span>
            <select
              value={initialCategory}
              onChange={(e) => updateFilters({ category: e.target.value })}
              className="bg-transparent border-none focus:outline-none cursor-pointer font-medium"
            >
              <option value="all">All</option>
              <option value="employee">Employee</option>
              <option value="student">Student</option>
              <option value="visitor">Visitor</option>
              <option value="contractor">Contractor</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RegisterPersonButton() {
  return (
    <Button asChild>
      <Link href="/dashboard/persons/register">
        <PlusIcon className="mr-2 h-4 w-4" /> Register Person
      </Link>
    </Button>
  );
}

export function PersonRowActions({ person }: { person: any }) {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [isReplacingFace, setIsReplacingFace] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleStatusToggle = async (newStatus: string) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);

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
      toast.error("Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/persons/${person.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Deleted ${person.firstName} ${person.lastName}.`);
        setShowDeleteConfirm(false);
        router.refresh();
      } else {
        toast.error(data.message || "Failed to delete person.");
      }
    } catch (err) {
      toast.error("Failed to delete person.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVerticalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href={`/dashboard/persons/${person.id}`} className="cursor-pointer">
              <EyeIcon className="mr-2 h-4 w-4" /> View Profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
            <PencilIcon className="mr-2 h-4 w-4" /> Edit Details
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setIsReplacingFace(true)} className="cursor-pointer">
            <CameraIcon className="mr-2 h-4 w-4" /> Replace Face Photo
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {person.status === "active" ? (
            <DropdownMenuItem onClick={() => handleStatusToggle("inactive")} className="cursor-pointer text-amber-600">
              <UserXIcon className="mr-2 h-4 w-4" /> Deactivate Person
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => handleStatusToggle("active")} className="cursor-pointer text-emerald-600">
              <UserCheckIcon className="mr-2 h-4 w-4" /> Activate Person
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="cursor-pointer text-destructive focus:text-destructive">
            <Trash2Icon className="mr-2 h-4 w-4" /> Delete Person
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Modal */}
      {isEditing && (
        <PersonModal
          isOpen={isEditing}
          initialData={person}
          onClose={() => setIsEditing(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Replace Face Modal */}
      {isReplacingFace && (
        <ReplaceFaceModal
          isOpen={isReplacingFace}
          person={person}
          onClose={() => setIsReplacingFace(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => !isDeleting && setShowDeleteConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Registered Person?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{person.firstName} {person.lastName}</strong> ({person.personCode})?
              This will permanently delete their person record, facial embedding vectors, and cloud ImageKit face asset.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
            >
              {isDeleting ? "Deleting..." : "Delete Person"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PersonPagination({
  total,
  page,
  limit,
  totalPages,
}: {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigateToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs">
      <span className="text-muted-foreground">
        Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} persons
      </span>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => navigateToPage(page - 1)}
          className="h-7 text-xs"
        >
          Previous
        </Button>

        <span className="font-medium">
          Page {page} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => navigateToPage(page + 1)}
          className="h-7 text-xs"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
