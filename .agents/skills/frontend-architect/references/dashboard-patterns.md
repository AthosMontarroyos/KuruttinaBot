# Frontend Architect - React + TypeScript Dashboard Patterns

Templates and code structures for building the KuruttinaBot web dashboard.

## 1. Typed Bot Status & Stats Card Component

```tsx
// src/components/dashboard/BotStatsCard.tsx
import React from 'react';

interface BotStatsProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
}

export const BotStatsCard: React.FC<BotStatsProps> = ({ title, value, change, icon, status }) => {
  const statusColors = {
    online: 'bg-emerald-500',
    idle: 'bg-amber-500',
    dnd: 'bg-rose-500',
    offline: 'bg-slate-500',
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md transition-all hover:border-indigo-500/50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className="rounded-lg bg-slate-800/80 p-2 text-indigo-400">{icon}</div>
      </div>
      
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-100">{value}</span>
        {status && (
          <span className={`h-2.5 w-2.5 rounded-full ${statusColors[status]} animate-pulse`} />
        )}
        {change && <span className="text-xs font-semibold text-emerald-400">{change}</span>}
      </div>
    </div>
  );
};
```

## 2. Server Configuration Toggle Form (PostgreSQL Sync)

```tsx
// src/components/dashboard/ServerConfigForm.tsx
import React, { useState } from 'react';

interface GuildConfig {
  guildId: string;
  prefix: string;
  welcomeChannelId: string;
  autoRoleEnabled: boolean;
  moderationLogsEnabled: boolean;
}

interface ServerConfigFormProps {
  config: GuildConfig;
  onSave: (updatedConfig: GuildConfig) => Promise<void>;
}

export const ServerConfigForm: React.FC<ServerConfigFormProps> = ({ config, onSave }) => {
  const [formData, setFormData] = useState<GuildConfig>(config);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-slate-100">Configurações do Servidor</h3>

      <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
        <div>
          <p className="font-medium text-slate-200">Sistema de Moderação</p>
          <p className="text-sm text-slate-400">Registra ações de ban, kick e mute no banco de dados.</p>
        </div>
        <input
          type="checkbox"
          checked={formData.moderationLogsEnabled}
          onChange={(e) => setFormData({ ...formData, moderationLogsEnabled: e.target.checked })}
          className="h-5 w-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
};
```

## 3. Integração com Impeccable

Sempre que refatorar ou criar componentes no React:
- Execute auditorias de acessibilidade (`aria-*`, suporte a teclado).
- Verifique a harmonia de cores e contraste (especialmente em temas dark).
- Garanta estados visuais para carregamento (Skeletons) e mensagens de erro amigáveis.
