'use client';

import { Fragment } from 'react';
import { listChannels, type Channel } from '../../lib/guild-api';
import { ResourceSelect } from './ResourceSelect';

type ChannelSelectProps = {
  /** Servidor cujos canais de texto e de anúncio são listados. */
  guildId: string;
  /** ID do canal escolhido; vazio quando nenhum. */
  value: string;
  onChange: (channelId: string) => void;
  /** Rótulo do campo; padrão "Canal". */
  label?: string;
  disabled?: boolean;
};

/** Agrupa os canais por categoria, mantendo a ordem do Discord (os sem categoria vêm primeiro). */
function groupByCategory(channels: Channel[]): Array<{ category: string | null; channels: Channel[] }> {
  const groups: Array<{ category: string | null; channels: Channel[] }> = [];
  for (const channel of channels) {
    const last = groups[groups.length - 1];
    if (last && last.category === channel.category) last.channels.push(channel);
    else groups.push({ category: channel.category, channels: [channel] });
  }
  return groups;
}

function renderChannels(channels: Channel[]) {
  return groupByCategory(channels).map((group) => {
    const options = group.channels.map((channel) => (
      <option key={channel.id} className="bg-surface text-text" value={channel.id}>
        {`# ${channel.name}${channel.type === 'announcement' ? ' (anúncios)' : ''}`}
      </option>
    ));
    return group.category === null
      ? <Fragment key="sem-categoria">{options}</Fragment>
      : <optgroup key={group.category} className="bg-surface text-muted" label={group.category}>{options}</optgroup>;
  });
}

/**
 * Seleção de canal de um servidor, para qualquer módulo que precise de um canal (enviar mensagem,
 * chegada, saída...).
 *
 *     <ChannelSelect guildId={guildId} value={channelId} onChange={setChannelId} />
 */
function ChannelSelect({ guildId, value, onChange, label = 'Canal', disabled = false }: ChannelSelectProps) {
  return (
    <ResourceSelect
      guildId={guildId}
      value={value}
      onChange={onChange}
      label={label}
      disabled={disabled}
      load={listChannels}
      renderOptions={renderChannels}
      placeholder="Escolha um canal"
      emptyMessage="Este servidor não tem canais de texto."
      manualPlaceholder="ID do canal"
      loadingLabel="Carregando canais"
    />
  );
}

export { ChannelSelect };
export type { ChannelSelectProps };
