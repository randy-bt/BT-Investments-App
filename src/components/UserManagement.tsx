"use client";

import { useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { changeUserRole, removeUser } from "@/actions/users";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { User, UserRole } from "@/lib/types";

type UserManagementProps = {
  initialUsers: User[];
};

export function UserManagement({ initialUsers }: UserManagementProps) {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState(initialUsers);
  const [isPending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  function handleRoleChange(userId: string, role: UserRole) {
    startTransition(async () => {
      const result = await changeUserRole(userId, { role });
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? result.data : u))
        );
      }
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      const result = await removeUser(userId);
      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }
      setConfirmRemove(null);
    });
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-neutral-500">
        Only admins can manage users.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-dashed border-neutral-100"
              >
                <td className="px-3 py-2 font-editable">{u.name}</td>
                <td className="px-3 py-2 text-neutral-500">{u.email}</td>
                <td className="px-3 py-2">
                  {u.id === currentUser.id ? (
                    <span className="text-xs text-neutral-500">{u.role}</span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={(e) =>
                        handleRoleChange(u.id, e.target.value as UserRole)
                      }
                      disabled={isPending}
                      className="rounded border border-neutral-300 px-1 py-0.5 text-xs"
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  {u.id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(u.id)}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove User"
        message="This will permanently delete this user and revoke their access. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => confirmRemove && handleRemove(confirmRemove)}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
