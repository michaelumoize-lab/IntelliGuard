"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@better-auth-ui/react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  Users,
  Shield,
  Ban,
  UserCheck,
  Trash2,
  KeyRound,
  Eye,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  ShieldAlert,
  Activity,
  SlidersHorizontal,
  ChevronsUpDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ───────────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  banReason?: string;
  banExpires?: string | null;
  createdAt: string;
  emailVerified: boolean;
  image?: string | null;
};

type Session = {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
};

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    admin: "default",
    user: "secondary",
  };
  return (
    <Badge variant={variants[role] ?? "outline"} className="capitalize">
      {role}
    </Badge>
  );
}

// ─── Create User Dialog ───────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const { error } = await authClient.admin.createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role as "user" | "admin",
      });
      if (error) throw new Error(error.message);
      toast.success("User created successfully");
      onOpenChange(false);
      setForm({ name: "", email: "", password: "", role: "user" });
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Add a new user to the system.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-name">Full Name</Label>
            <Input
              id="cu-name"
              placeholder="Jane Doe"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-email">Email</Label>
            <Input
              id="cu-email"
              type="email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              required
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-password">Password</Label>
            <Input
              id="cu-password"
              type="password"
              placeholder="Min 8 characters"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
              minLength={8}
              disabled={isPending}
            />
          </div>{" "}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-role">Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
              disabled={isPending}
            >
              <SelectTrigger id="cu-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit User Dialog ─────────────────────────────────────────────────────────

function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [name, setName] = useState(user?.name ?? "");

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsPending(true);
    try {
      const { error } = await authClient.admin.updateUser({
        userId: user.id,
        data: { name },
      });
      if (error) throw new Error(error.message);
      toast.success("User updated");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update {user?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eu-name">Name</Label>
            <Input
              id="eu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Set Role Dialog ──────────────────────────────────────────────────────────

function SetRoleDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [role, setRole] = useState(user?.role ?? "user");

  useEffect(() => {
    if (user) setRole(user.role);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsPending(true);
    try {
      const { error } = await authClient.admin.setRole({
        userId: user.id,
        role: role as "user" | "admin",
      });
      if (error) throw new Error(error.message);
      toast.success(`Role updated to "${role}"`);
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set role");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Role</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isPending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Set Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Set Password Dialog ──────────────────────────────────────────────────────

function SetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsPending(true);
    try {
      const { error } = await authClient.admin.setUserPassword({
        userId: user.id,
        newPassword: password,
      });
      if (error) throw new Error(error.message);
      toast.success("Password updated");
      onOpenChange(false);
      setPassword("");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to set password",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Password</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-password">New Password</Label>
            <Input
              id="sp-password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Set Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ban User Dialog ──────────────────────────────────────────────────────────

function BanUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("permanent");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsPending(true);
    try {
      const banExpiresIn =
        duration === "permanent"
          ? undefined
          : duration === "1d"
            ? 60 * 60 * 24
            : duration === "7d"
              ? 60 * 60 * 24 * 7
              : 60 * 60 * 24 * 30;

      const { error } = await authClient.admin.banUser({
        userId: user.id,
        banReason: reason || undefined,
        banExpiresIn,
      });
      if (error) throw new Error(error.message);
      toast.success(`${user.name} has been banned`);
      onOpenChange(false);
      setReason("");
      setDuration("permanent");
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to ban user");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-destructive" />
            Ban User
          </DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ban-reason">Reason (optional)</Label>
            <Textarea
              id="ban-reason"
              placeholder="Reason for ban..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Duration</Label>
            <Select
              value={duration}
              onValueChange={setDuration}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="1d">1 Day</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending && <Spinner />}
              Ban User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sessions Dialog ──────────────────────────────────────────────────────────

function SessionsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await authClient.admin.listUserSessions({
        userId: user.id,
      });
      if (error) throw new Error(error.message);
      setSessions(
        (data as unknown as { sessions?: Session[] })?.sessions ??
          (data as unknown as Session[]) ??
          [],
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch sessions",
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) fetchSessions();
  }, [open, fetchSessions]);

  const revokeSession = async (token: string) => {
    setRevokingToken(token);
    try {
      const { error } = await authClient.admin.revokeUserSession({
        sessionToken: token,
      });
      if (error) throw new Error(error.message);
      toast.success("Session revoked");
      fetchSessions();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke session",
      );
    } finally {
      setRevokingToken(null);
    }
  };

  const revokeAll = async () => {
    if (!user) return;
    setRevokingAll(true);
    try {
      const { error } = await authClient.admin.revokeUserSessions({
        userId: user.id,
      });
      if (error) throw new Error(error.message);
      toast.success("All sessions revoked");
      fetchSessions();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke sessions",
      );
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Sessions</DialogTitle>
              <DialogDescription>{user?.email}</DialogDescription>
            </div>
            <div className="flex gap-2 mr-8">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSessions}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
              {sessions.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={revokeAll}
                  disabled={revokingAll}
                >
                  {revokingAll && <Spinner />}
                  Revoke All
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-100 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No active sessions
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span className="font-mono text-foreground truncate max-w-75">
                      {s.token.slice(0, 8)}...{s.token.slice(-4)}
                    </span>{" "}
                    {s.ipAddress && <span>IP: {s.ipAddress}</span>}
                    {s.userAgent && (
                      <span className="truncate max-w-87.5">{s.userAgent}</span>
                    )}
                    <span>
                      Expires: {new Date(s.expiresAt).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => revokeSession(s.token)}
                    disabled={revokingToken === s.token}
                  >
                    {revokingToken === s.token ? (
                      <Spinner />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Remove User Confirm ──────────────────────────────────────────────────────

function RemoveUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, setIsPending] = useState(false);

  const handleRemove = async () => {
    if (!user) return;
    setIsPending(true);
    try {
      const { error } = await authClient.admin.removeUser({ userId: user.id });
      if (error) throw new Error(error.message);
      toast.success("User permanently deleted");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{user?.email}</strong> and all
            their data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Spinner />}
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

interface StatsCardsProps {
  users: User[];
  totalUsers: number;
  adminsCount: number;
  bannedCount: number;
  verifiedCount: number;
}

function StatsCards({
  totalUsers,
  adminsCount,
  bannedCount,
  verifiedCount,
}: StatsCardsProps) {
  const stats = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "text-blue-500",
    },
    {
      label: "Admins",
      value: adminsCount,
      icon: Shield,
      color: "text-amber-500",
    },
    {
      label: "Banned",
      value: bannedCount,
      icon: Ban,
      color: "text-destructive",
    },
    {
      label: "Verified",
      value: verifiedCount,
      icon: UserCheck,
      color: "text-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-md bg-muted p-2 ${s.color}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const PAGE_SIZE = 10;

export default function AdminPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [searchField, setSearchField] = useState<"email" | "name">("email");
  const [latestUsers, setLatestUsers] = useState<User[]>([]);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);
  const [aggregateCounts, setAggregateCounts] = useState<{
    total: number;
    admins: number;
    banned: number;
    verified: number;
  }>({ total: 0, admins: 0, banned: 0, verified: 0 });

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [banUser, setBanUser] = useState<User | null>(null);
  const [sessionsUser, setSessionsUser] = useState<User | null>(null);
  const [removeUser, setRemoveUser] = useState<User | null>(null);

  // ── Guard: only admins ──────────────────────────────────────────────────────
  useEffect(() => {
    if (session && (session.user as unknown as User)?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [session, router]);

  // ── Check if currently impersonating ───────────────────────────────────────
  useEffect(() => {
    setIsImpersonating(
      !!(session?.session as { impersonatedBy?: string })?.impersonatedBy,
    );
  }, [session]);

  // ── Fetch users ─────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const query: Record<string, unknown> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sortBy,
        sortDirection: sortDir,
      };
      if (debouncedSearch) {
        query.searchValue = debouncedSearch;
        query.searchField = searchField;
        query.searchOperator = "contains";
      }
      if (filterField && filterValue) {
        query.filterField = filterField;
        query.filterValue = filterValue;
        query.filterOperator = "eq";
      }

      const { data, error } = await authClient.admin.listUsers({ query });
      if (error) throw new Error(error.message);
      setUsers((data as unknown as { users?: User[] })?.users ?? []);
      setTotal((data as { total?: number })?.total ?? 0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    searchField,
    sortBy,
    sortDir,
    filterField,
    filterValue,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Fetch latest 10 users ──────────────────────────────────────────────────
  const fetchLatestUsers = useCallback(async () => {
    setIsLoadingLatest(true);
    try {
      const { data, error } = await authClient.admin.listUsers({
        query: {
          limit: 10,
          offset: 0,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      });
      if (error) throw new Error(error.message);
      setLatestUsers((data as unknown as { users?: User[] })?.users ?? []);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch latest users",
      );
    } finally {
      setIsLoadingLatest(false);
    }
  }, []);

  // ── Fetch aggregate counts ─────────────────────────────────────────────────
  const fetchAggregateCounts = useCallback(async () => {
    try {
      const { data, error } = await authClient.admin.listUsers({
        query: {
          limit: 1,
          offset: 0,
        },
      });
      if (error) throw new Error(error.message);
      const totalCount = (data as { total?: number })?.total ?? 0;

      // Fetch all users to compute aggregate counts
      const { data: allData, error: allError } =
        await authClient.admin.listUsers({
          query: {
            limit: 10000,
            offset: 0,
          },
        });
      if (allError) throw new Error(allError.message);
      const allUsers = (allData as unknown as { users?: User[] })?.users ?? [];

      const adminsCount = allUsers.filter((u) => u.role === "admin").length;
      const bannedCount = allUsers.filter((u) => u.banned).length;
      const verifiedCount = allUsers.filter((u) => u.emailVerified).length;

      setAggregateCounts({
        total: totalCount,
        admins: adminsCount,
        banned: bannedCount,
        verified: verifiedCount,
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch aggregate counts",
      );
    }
  }, []);

  useEffect(() => {
    fetchLatestUsers();
  }, [fetchLatestUsers]);

  useEffect(() => {
    fetchAggregateCounts();
  }, [fetchAggregateCounts]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentUser = session?.user;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleUnban = async (user: User) => {
    try {
      const { error } = await authClient.admin.unbanUser({ userId: user.id });
      if (error) throw new Error(error.message);
      toast.success(`${user.name} has been unbanned`);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to unban user");
    }
  };

  const handleImpersonate = async (user: User) => {
    try {
      const { error } = await authClient.admin.impersonateUser({
        userId: user.id,
      });
      if (error) throw new Error(error.message);
      toast.success(`Now impersonating ${user.name}`);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to impersonate user",
      );
    }
  };

  const handleStopImpersonating = async () => {
    try {
      const { error } = await authClient.admin.stopImpersonating();
      if (error) throw new Error(error.message);
      toast.success("Stopped impersonating");
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to stop impersonating",
      );
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  // ── Guard render ─────────────────────────────────────────────────────────────
  if (!session || (session.user as unknown as User)?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container max-w-7xl mx-auto py-8 px-4 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">
                Manage users, roles, sessions, and more
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isImpersonating && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500 text-amber-600 hover:bg-amber-50 gap-1.5"
                onClick={handleStopImpersonating}
              >
                <LogOut className="h-3.5 w-3.5" />
                Stop Impersonating
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </div>
        </div>

        {/* Stats */}
        <StatsCards
          users={users}
          totalUsers={aggregateCounts.total}
          adminsCount={aggregateCounts.admins}
          bannedCount={aggregateCounts.banned}
          verifiedCount={aggregateCounts.verified}
        />

        {/* Main Content */}
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Users
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* ── Users Tab ── */}
          <TabsContent value="users" className="mt-4 flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search by ${searchField}…`}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                    }}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={searchField}
                  onValueChange={(v: "email" | "name") => setSearchField(v)}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Filter
                      {filterField && (
                        <Badge
                          variant="secondary"
                          className="ml-1 px-1 py-0 text-xs"
                        >
                          1
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Filter by role
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {["", "admin", "user"].map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => {
                          setFilterField(r ? "role" : "");
                          setFilterValue(r);
                          setPage(0);
                        }}
                        className="capitalize"
                      >
                        {r || "All roles"}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Filter by status
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {[
                      { label: "Banned", field: "banned", val: "true" },
                      { label: "Active", field: "banned", val: "false" },
                    ].map((f) => (
                      <DropdownMenuItem
                        key={f.label}
                        onClick={() => {
                          setFilterField(f.field);
                          setFilterValue(f.val);
                          setPage(0);
                        }}
                      >
                        {f.label}
                      </DropdownMenuItem>
                    ))}
                    {filterField && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setFilterField("");
                            setFilterValue("");
                            setPage(0);
                          }}
                          className="text-destructive"
                        >
                          <X className="h-3.5 w-3.5 mr-1.5" />
                          Clear filter
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 gap-1"
                        onClick={() => toggleSort("name")}
                      >
                        Name
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 gap-1"
                        onClick={() => toggleSort("email")}
                      >
                        Email
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 gap-1"
                        onClick={() => toggleSort("createdAt")}
                      >
                        Joined
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted rounded animate-pulse" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {user.name}
                            {user.id === currentUser?.id && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1 py-0"
                              >
                                You
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell>
                          {user.banned ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Banned
                            </Badge>
                          ) : user.emailVerified ? (
                            <Badge
                              variant="outline"
                              className="gap-1 text-green-600 border-green-300"
                            >
                              <UserCheck className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-300"
                            >
                              Unverified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              sideOffset={5}
                              className="min-w-[200px] max-w-[90vw] md:min-w-[220px]"
                            >
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => setEditUser(user)}
                              >
                                <UserCheck className="h-3.5 w-3.5 mr-2" />
                                Edit User
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  if (user.id !== currentUser?.id)
                                    setRoleUser(user);
                                }}
                                disabled={user.id === currentUser?.id}
                              >
                                <Shield className="h-3.5 w-3.5 mr-2" />
                                Set Role
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => setPasswordUser(user)}
                              >
                                <KeyRound className="h-3.5 w-3.5 mr-2" />
                                Set Password
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => setSessionsUser(user)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-2" />
                                View Sessions
                              </DropdownMenuItem>

                              {user.id !== currentUser?.id && (
                                <DropdownMenuItem
                                  onClick={() => handleImpersonate(user)}
                                >
                                  <LogIn className="h-3.5 w-3.5 mr-2" />
                                  Impersonate
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              {user.banned ? (
                                <DropdownMenuItem
                                  onClick={() => handleUnban(user)}
                                >
                                  <UserCheck className="h-3.5 w-3.5 mr-2 text-green-600" />
                                  Unban User
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (user.id !== currentUser?.id)
                                      setBanUser(user);
                                  }}
                                  disabled={user.id === currentUser?.id}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Ban className="h-3.5 w-3.5 mr-2" />
                                  Ban User
                                </DropdownMenuItem>
                              )}

                              {user.id !== currentUser?.id && (
                                <DropdownMenuItem
                                  onClick={() => setRemoveUser(user)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, total)} of {total} users
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1 || isLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Activity Tab ── */}
          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Recent Registrations
                </CardTitle>
                <CardDescription>
                  Last 10 users who joined the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingLatest ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : latestUsers.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No users found
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {latestUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium leading-none">{u.name}</p>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {u.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <RoleBadge role={u.role} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ── Dialogs ── */}
        <CreateUserDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={fetchUsers}
        />
        <EditUserDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(v) => !v && setEditUser(null)}
          onSuccess={fetchUsers}
        />
        <SetRoleDialog
          user={roleUser}
          open={!!roleUser}
          onOpenChange={(v) => !v && setRoleUser(null)}
          onSuccess={fetchUsers}
        />
        <SetPasswordDialog
          user={passwordUser}
          open={!!passwordUser}
          onOpenChange={(v) => !v && setPasswordUser(null)}
        />
        <BanUserDialog
          user={banUser}
          open={!!banUser}
          onOpenChange={(v) => !v && setBanUser(null)}
          onSuccess={fetchUsers}
        />
        <SessionsDialog
          user={sessionsUser}
          open={!!sessionsUser}
          onOpenChange={(v) => !v && setSessionsUser(null)}
        />
        <RemoveUserDialog
          user={removeUser}
          open={!!removeUser}
          onOpenChange={(v) => !v && setRemoveUser(null)}
          onSuccess={fetchUsers}
        />
      </div>
    </TooltipProvider>
  );
}
