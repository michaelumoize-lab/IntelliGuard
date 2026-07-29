"use client";

import { useAuth, useDeleteUser, useListAccounts } from "@better-auth-ui/react";
import { TriangleAlert } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type DeleteUserProps = {
  className?: string;
};

/**
 * Danger-zone card to delete the authenticated account, with a confirmation dialog and toasts.
 */
export function DeleteUser({ className }: DeleteUserProps) {
  const {
    basePaths,
    deleteUser: deleteUserConfig,
    localization,
    viewPaths,
    navigate,
  } = useAuth();

  const { data: accounts } = useListAccounts();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");

  const hasCredentialAccount = accounts?.some(
    (account) => account.providerId === "credential",
  );
  const needsPassword =
    !deleteUserConfig?.sendDeleteAccountVerification && hasCredentialAccount;

  const { mutate: deleteUser, isPending } = useDeleteUser();

  const handleDialogOpenChange = (open: boolean) => {
    setConfirmOpen(open);
    setPassword("");
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const params = {
      ...(needsPassword ? { password } : {}),
    };

    deleteUser(params, {
      onSuccess: () => {
        setConfirmOpen(false);
        setPassword("");

        if (deleteUserConfig?.sendDeleteAccountVerification) {
          toast.success(localization.settings.deleteUserVerificationSent);
        } else {
          toast.success(localization.settings.deleteUserSuccess);
          navigate({
            to: `${basePaths.auth}/${viewPaths.auth.signIn}`,
            replace: true,
          });
        }
      },
      onError: (error) => {
        toast.error(error.error?.message || error.message);
      },
    });
  };

  return (
    <Card className={cn("border-destructive", className)}>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium leading-tight">
            {localization.settings.deleteUser}
          </p>

          <p className="text-muted-foreground text-xs mt-0.5">
            {localization.settings.deleteUserDescription}
          </p>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={handleDialogOpenChange}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={!accounts}>
              {localization.settings.deleteUser}
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                  <TriangleAlert />
                </AlertDialogMedia>

                <AlertDialogTitle>
                  {localization.settings.deleteUser}
                </AlertDialogTitle>

                <AlertDialogDescription>
                  {localization.settings.deleteUserDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>

              {needsPassword && (
                <Field>
                  <Label htmlFor="delete-password">
                    {localization.auth.password}
                  </Label>

                  <Input
                    id="delete-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder={localization.auth.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isPending}
                    required
                  />

                  <FieldError />
                </Field>
              )}

              <AlertDialogFooter>
                <AlertDialogCancel>
                  {localization.settings.cancel}
                </AlertDialogCancel>
                <AlertDialogAction type="submit" variant="destructive">
                  {isPending && <Spinner />}
                  {localization.settings.deleteUser}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// "use client";

// import {
//   useAuth,
//   useDeleteUser,
//   useListAccounts,
//   useSession,
// } from "@better-auth-ui/react";
// import { TriangleAlert } from "lucide-react";
// import { type SyntheticEvent, useState } from "react";
// import { toast } from "sonner";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogMedia,
//   AlertDialogTitle,
//   AlertDialogTrigger,
// } from "@/components/ui/alert-dialog";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import { Field, FieldError } from "@/components/ui/field";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Spinner } from "@/components/ui/spinner";
// import { cn } from "@/lib/utils";

// export type DeleteUserProps = {
//   className?: string;
// };

// export function DeleteUser({ className }: DeleteUserProps) {
//   const {
//     basePaths,
//     deleteUser: deleteUserConfig,
//     localization,
//     viewPaths,
//     navigate,
//   } = useAuth();

//   const { data: session } = useSession();
//   const { data: accounts } = useListAccounts();
//   const [confirmOpen, setConfirmOpen] = useState(false);
//   const [password, setPassword] = useState("");

//   // Check if user has a credential (email/password) account
//   const hasCredentialAccount = accounts?.some(
//     (account) => account.providerId === "credential",
//   );

//   // Check if user signed up with OAuth only
//   const isOAuthOnly = session?.user && !hasCredentialAccount;

//   // Password is only needed for credential accounts when not using email verification
//   const needsPassword =
//     !deleteUserConfig?.sendDeleteAccountVerification &&
//     hasCredentialAccount &&
//     !isOAuthOnly;

//   const { mutate: deleteUser, isPending } = useDeleteUser();

//   const handleDialogOpenChange = (open: boolean) => {
//     setConfirmOpen(open);
//     setPassword("");
//   };

//   const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
//     e.preventDefault();

//     // For OAuth-only accounts, don't send password
//     const params = isOAuthOnly ? {} : needsPassword ? { password } : {};

//     deleteUser(params, {
//       onSuccess: () => {
//         setConfirmOpen(false);
//         setPassword("");

//         if (deleteUserConfig?.sendDeleteAccountVerification) {
//           toast.success(localization.settings.deleteUserVerificationSent);
//         } else {
//           toast.success(localization.settings.deleteUserSuccess);
//           navigate({
//             to: `${basePaths.auth}/${viewPaths.auth.signIn}`,
//             replace: true,
//           });
//         }
//       },
//       onError: (error) => {
//         console.error("Delete user error:", error);
//         toast.error(
//           error.error?.message || error.message || "Failed to delete account",
//         );
//       },
//     });
//   };

//   // Don't render if no accounts loaded
//   if (!accounts) return null;

//   return (
//     <Card className={cn("border-destructive", className)}>
//       <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
//         <div>
//           <p className="text-sm font-medium leading-tight">
//             {localization.settings.deleteUser}
//           </p>

//           <p className="text-muted-foreground text-xs mt-0.5">
//             {localization.settings.deleteUserDescription}
//           </p>
//           {isOAuthOnly && (
//             <p className="text-xs text-muted-foreground mt-1">
//               OAuth accounts don&apos;t require password verification for
//               deletion.
//             </p>
//           )}
//         </div>

//         <AlertDialog open={confirmOpen} onOpenChange={handleDialogOpenChange}>
//           <AlertDialogTrigger asChild>
//             <Button variant="destructive" size="sm">
//               {localization.settings.deleteUser}
//             </Button>
//           </AlertDialogTrigger>

//           <AlertDialogContent>
//             <form onSubmit={handleSubmit} className="flex flex-col gap-6">
//               <AlertDialogHeader>
//                 <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
//                   <TriangleAlert />
//                 </AlertDialogMedia>

//                 <AlertDialogTitle>
//                   {localization.settings.deleteUser}
//                 </AlertDialogTitle>

//                 <AlertDialogDescription>
//                   {isOAuthOnly
//                     ? "This action cannot be undone. Your account will be permanently deleted."
//                     : localization.settings.deleteUserDescription}
//                 </AlertDialogDescription>
//               </AlertDialogHeader>

//               {needsPassword && (
//                 <Field>
//                   <Label htmlFor="delete-password">
//                     {localization.auth.password}
//                   </Label>

//                   <Input
//                     id="delete-password"
//                     name="password"
//                     type="password"
//                     autoComplete="current-password"
//                     placeholder={localization.auth.passwordPlaceholder}
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     disabled={isPending}
//                     required
//                   />

//                   <FieldError />
//                 </Field>
//               )}

//               {isOAuthOnly && (
//                 <AlertDialogDescription className="text-sm text-destructive">
//                   Warning: You signed up with Google. Deleting your account is
//                   permanent and cannot be undone.
//                 </AlertDialogDescription>
//               )}

//               <AlertDialogFooter>
//                 <AlertDialogCancel>
//                   {localization.settings.cancel}
//                 </AlertDialogCancel>
//                 <AlertDialogAction type="submit" variant="destructive">
//                   {isPending && <Spinner />}
//                   {localization.settings.deleteUser}
//                 </AlertDialogAction>
//               </AlertDialogFooter>
//             </form>
//           </AlertDialogContent>
//         </AlertDialog>
//       </CardContent>
//     </Card>
//   );
// }
