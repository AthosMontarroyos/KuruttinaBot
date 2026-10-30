'use client';

import { Fragment } from 'react';
import { listVoiceChannels, type VoiceChannel } from '../../lib/guild-api';
import { ResourceSelect } from './ResourceSelect';

type VoiceChannelSelectProps = {
  /** Servidor cujos canais de voz e de palco são listados. */
  guildId: string;
  /** ID do canal escolhido; vazio quando nenhum. */
  value: string;
  onChange: (channelId: string) => void;
  /** Rótulo do campo; padrão "Canal de voz". */
  label?: string;
  disabled?: boolean;
};

/** Agrupa os canais por categoria, mantendo a ordem do Discord (os sem categoria vêm primeiro). */
function groupByCategory(channels: VoiceChannel[]): Array<{ category: string | null; channels: VoiceChannel[] }> {
  const groups: Array<{ category: string | null; channels: VoiceChannel[] }> = [];
  for (const channel of channels) {
    const last = groups[groups.length - 1];
    if (last && last.category === channel.category) last.channels.push(channel);
    else groups.push({ category: channel.category, channels: [channel] });
  }
  return groups;
}

function renderVoiceChannels(channels: VoiceChannel[]) {
  return groupByCategory(channels).map((group) => {
    const options = group.channels.map((channel) => (
      <option key={channel.id} className="bg-surface text-text" value={channel.id}>
        {`🔊 ${channel.name}${channel.type === 'stage' ? ' (palco)' : ''}`}
      </option>
    ));
    return group.category === null
      ? <Fragment key="sem-categoria">{options}</Fragment>
      : <optgroup key={group.category} className="bg-surface text-muted" label={group.category}>{options}</optgroup>;
  });
}

/**
 * Seleção de canal de voz (ou de palco) de um servidor, para qualquer módulo que precise de um canal de voz.
 *
 *     <VoiceChannelSelect guildId={guildId} value={channelId} onChange={setChannelId} />
 */
function VoiceChannelSelect({ guildId, value, onChange, label = 'Canal de voz', disabled = false }: VoiceChannelSelectProps) {
  return (
    <ResourceSelect
      guildId={guildId}
      value={value}
      onChange={onChange}
      label={label}
      disabled={disabled}
      load={listVoiceChannels}
      renderOptions={renderVoiceChannels}
      placeholder="Escolha um canal de voz"
      emptyMessage="Este servidor não tem canais de voz."
      manualPlaceholder="ID do canal de voz"
      loadingLabel="Carregando canais de voz"
    />
  );
}

export { VoiceChannelSelect };
export type { VoiceChannelSelectProps };
