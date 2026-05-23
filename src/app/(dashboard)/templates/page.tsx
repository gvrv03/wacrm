'use client';

import { TemplateManager } from '@/components/settings/template-manager';

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your WhatsApp message templates.
        </p>
      </div>

      <TemplateManager />
    </div>
  );
}
