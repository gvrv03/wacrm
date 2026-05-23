'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Contact,
  MessageSquare,
  Zap,
  Workflow,
  TrendingUp,
  Loader2,
} from 'lucide-react';

interface Analytics {
  totalUsers: number;
  totalContacts: number;
  totalConversations: number;
  totalAutomations: number;
  activeAutomations: number;
  totalFlows: number;
  totalMessages: number;
  recentSignups: number;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/analytics');
        if (!res.ok) throw new Error('Failed to load analytics');
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Users', value: data.totalUsers, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'New Users (7d)', value: data.recentSignups, icon: TrendingUp, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { label: 'Total Contacts', value: data.totalContacts, icon: Contact, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { label: 'Conversations', value: data.totalConversations, icon: MessageSquare, color: 'text-sky-600', bgColor: 'bg-sky-50' },
    { label: 'Messages', value: data.totalMessages, icon: MessageSquare, color: 'text-teal-600', bgColor: 'bg-teal-50' },
    { label: 'Automations', value: data.totalAutomations, subtitle: `${data.activeAutomations} active`, icon: Zap, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Flows', value: data.totalFlows, icon: Workflow, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform-wide analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className={`flex size-11 items-center justify-center rounded-lg ${card.bgColor}`}>
                  <Icon className={`size-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">
                    {card.value.toLocaleString()}
                  </p>
                  {'subtitle' in card && card.subtitle && (
                    <p className="text-xs text-gray-400">{card.subtitle}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
