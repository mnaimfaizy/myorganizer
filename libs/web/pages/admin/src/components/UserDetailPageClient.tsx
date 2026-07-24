'use client';

import type { AdminUserIdentity } from '@myorganizer/app-api-client';
import { Button } from '@myorganizer/web-ui';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { createPlatformAdminApi } from '../lib/apiClient';
import {
  formatBooleanLabel,
  formatUserDisplayName,
  formatUserRole,
} from '../lib/formatUserIdentity';

interface UserIdentityFieldProps {
  label: string;
  value: string;
}

function UserIdentityField({ label, value }: UserIdentityFieldProps) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function UserDetailPageClient() {
  const params = useParams();
  const userId =
    typeof params.userId === 'string' ? params.userId : params.userId?.[0];

  const [user, setUser] = useState<AdminUserIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadUser = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const api = createPlatformAdminApi();
      const response = await api.getUserById({ userId: id });
      setUser(response.data);
    } catch (err) {
      setUser(null);

      if (isAxiosError(err) && err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError('Unable to load user. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    void loadUser(userId);
  }, [loadUser, userId]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/admin/users">Back to users</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notFound ? (
        <p className="text-sm text-muted-foreground">User not found.</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : user ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatUserDisplayName(user)}
          </h1>

          <dl className="grid max-w-xl gap-4">
            <UserIdentityField label="ID" value={user.id} />
            <UserIdentityField label="Name" value={user.name} />
            <UserIdentityField label="Email" value={user.email} />
            <UserIdentityField label="First name" value={user.firstName} />
            <UserIdentityField label="Last name" value={user.lastName} />
            {user.phone ? (
              <UserIdentityField label="Phone" value={user.phone} />
            ) : null}
            <UserIdentityField label="Role" value={formatUserRole(user.role)} />
            <UserIdentityField
              label="Disabled"
              value={formatBooleanLabel(user.disabled)}
            />
            <UserIdentityField
              label="Email verified"
              value={formatBooleanLabel(user.emailVerified)}
            />
          </dl>
        </>
      ) : null}
    </div>
  );
}
