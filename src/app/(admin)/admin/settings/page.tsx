'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Save, Shield, Globe, Bell } from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    allowSignups: false,
    maintenanceMode: false,
    maxUsersPerAccount: '100',
    defaultUserRole: 'user',
    notifyAdminOnSignup: true,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '',
  });

  const update = (key: string, value: unknown) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const handleSave = () => {
    toast.success('Settings saved');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Platform-wide configuration</p>
      </div>

      {/* General */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-900">General</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Core platform settings</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Site URL</label>
            <input
              value={settings.siteUrl}
              onChange={(e) => update('siteUrl', e.target.value)}
              placeholder="https://your-domain.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Maintenance Mode</p>
              <p className="text-xs text-gray-500">Disable access for non-admin users</p>
            </div>
            <Toggle checked={settings.maintenanceMode} onChange={(v) => update('maintenanceMode', v)} />
          </div>
        </div>
      </div>

      {/* Access Control */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-900">Access Control</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">User registration and permissions</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Allow Public Signups</p>
              <p className="text-xs text-gray-500">Let new users register on their own</p>
            </div>
            <Toggle checked={settings.allowSignups} onChange={(v) => update('allowSignups', v)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Default Role</label>
            <select
              value={settings.defaultUserRole}
              onChange={(e) => update('defaultUserRole', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max Contacts per Account</label>
            <input
              type="number"
              value={settings.maxUsersPerAccount}
              onChange={(e) => update('maxUsersPerAccount', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Admin notification preferences</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Notify on New User</p>
              <p className="text-xs text-gray-500">Alert when a new user is created</p>
            </div>
            <Toggle checked={settings.notifyAdminOnSignup} onChange={(v) => update('notifyAdminOnSignup', v)} />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-indigo-700 transition-colors"
      >
        <Save className="size-4" />
        Save Settings
      </button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
