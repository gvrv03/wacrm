'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { DataTable, type Column } from '@/components/admin/data-table';

interface ContactRow {
  id: string;
  user_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  created_at: string;
  owner?: { full_name: string; email: string } | null;
}

const columns: Column<ContactRow>[] = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    render: (row) => (
      <span className="font-medium text-gray-900">{row.name || '—'}</span>
    ),
  },
  {
    key: 'phone',
    label: 'Phone',
    sortable: true,
    render: (row) => (
      <span className="font-mono text-xs text-gray-600">{row.phone}</span>
    ),
  },
  {
    key: 'email',
    label: 'Email',
    sortable: true,
    render: (row) => (
      <span className="text-gray-500">{row.email || '—'}</span>
    ),
  },
  {
    key: 'owner',
    label: 'Business (Owner)',
    render: (row) => (
      <div>
        <p className="text-sm font-medium text-gray-900">{row.owner?.full_name || '—'}</p>
        <p className="text-xs text-gray-400">{row.owner?.email || ''}</p>
      </div>
    ),
  },
  {
    key: 'created_at',
    label: 'Created',
    sortable: true,
    render: (row) => (
      <span className="text-gray-500 text-xs">
        {new Date(row.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

export default function AdminContactsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ contacts: ContactRow[]; totalCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get('page')) || 1;
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'created_at';
  const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
  const pageSize = 20;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, order });
        if (q) params.set('q', q);
        const res = await fetch(`/api/admin/contacts?${params}`);
        if (!res.ok) throw new Error('Failed to load contacts');
        setData(await res.json());
      } catch {
        toast.error('Failed to load contacts');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, q, sort, order]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <p className="text-sm text-gray-500 mt-1">All contacts across all business accounts</p>
      </div>

      <DataTable
        columns={columns}
        data={data?.contacts ?? []}
        totalCount={data?.totalCount ?? 0}
        pageSize={pageSize}
        currentPage={page}
        sortBy={sort}
        sortOrder={order}
        searchQuery={q}
        searchPlaceholder="Search by name, phone, or email..."
        isLoading={loading}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
