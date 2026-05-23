'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Loader2, MoreVertical, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable, type Column } from '@/components/admin/data-table';

interface UserRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

const columns: Column<UserRow>[] = [
  {
    key: 'full_name',
    label: 'Name',
    sortable: true,
    render: (row) => (
      <span className="font-medium text-gray-900">{row.full_name || '—'}</span>
    ),
  },
  {
    key: 'email',
    label: 'Email',
    sortable: true,
  },
  {
    key: 'role',
    label: 'Role',
    sortable: true,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          row.role === 'admin'
            ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20'
            : 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/10'
        }`}
      >
        {row.role || 'user'}
      </span>
    ),
  },
  {
    key: 'created_at',
    label: 'Joined',
    sortable: true,
    render: (row) => (
      <span className="text-gray-500 text-xs">
        {new Date(row.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ users: UserRow[]; totalCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'user' });
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const page = Number(searchParams.get('page')) || 1;
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'created_at';
  const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
  const pageSize = 20;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, order });
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to load users');
      setData(await res.json());
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, q, sort, order]);

  async function handleCreate() {
    if (!newUser.email || !newUser.password) { toast.error('Email and password are required'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Failed to create user'); return; }
      toast.success('User created successfully');
      setShowCreate(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'user' });
      load();
    } catch { toast.error('Failed to create user'); } finally { setCreating(false); }
  }

  async function handleToggleRole(user: UserRow) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) { const b = await res.json(); toast.error(b.error || 'Failed'); return; }
      toast.success(`${user.full_name || user.email} is now ${newRole}`);
      load();
    } catch { toast.error('Failed to update role'); }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${pendingDelete.id}`, { method: 'DELETE' });
      if (!res.ok) { const b = await res.json(); toast.error(b.error || 'Failed'); return; }
      toast.success('User deleted');
      setPendingDelete(null);
      load();
    } catch { toast.error('Failed to delete user'); } finally { setDeleting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all platform users</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="size-4" />
          Create User
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.users ?? []}
        totalCount={data?.totalCount ?? 0}
        pageSize={pageSize}
        currentPage={page}
        sortBy={sort}
        sortOrder={order}
        searchQuery={q}
        searchPlaceholder="Search by name or email..."
        isLoading={loading}
        getRowKey={(row) => row.id}
        rowActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => handleToggleRole(row)}
              title={row.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
              className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
            >
              <Shield className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(row)}
              title="Delete User"
              className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      />

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New User</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input value={newUser.full_name} onChange={(e) => setNewUser((s) => ({ ...s, full_name: e.target.value }))} placeholder="John Doe" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))} placeholder="user@example.com" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))} placeholder="Min 6 characters" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser((s) => ({ ...s, role: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-indigo-700 disabled:opacity-50">
                {creating && <Loader2 className="size-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setPendingDelete(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Delete User</h2>
            <p className="mt-2 text-sm text-gray-600">
              Permanently delete <span className="font-medium text-gray-900">{pendingDelete.full_name || pendingDelete.email}</span> and all their data? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPendingDelete(null)} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-red-700 disabled:opacity-50">
                {deleting && <Loader2 className="size-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
