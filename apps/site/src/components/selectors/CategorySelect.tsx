'use client';

import { listCategories, type Category } from '../../lib/guild-api';
import { ResourceSelect } from './ResourceSelect';

type CategorySelectProps = {
  /** Servidor cujas categorias de canais são listadas. */
  guildId: string;
  /** ID da categoria escolhida; vazio quando nenhuma. */
  value: string;
  onChange: (categoryId: string) => void;
  /** Rótulo do campo; padrão "Categoria". */
  label?: string;
  disabled?: boolean;
};

function renderCategories(categories: Category[]) {
  return categories.map((category) => <option key={category.id} className="bg-surface text-text" value={category.id}>{category.name}</option>);
}

/**
 * Seleção de categoria de canais de um servidor, na ordem do Discord.
 *
 *     <CategorySelect guildId={guildId} value={categoryId} onChange={setCategoryId} />
 */
function CategorySelect({ guildId, value, onChange, label = 'Categoria', disabled = false }: CategorySelectProps) {
  return (
    <ResourceSelect
      guildId={guildId}
      value={value}
      onChange={onChange}
      label={label}
      disabled={disabled}
      load={listCategories}
      renderOptions={renderCategories}
      placeholder="Escolha uma categoria"
      emptyMessage="Este servidor não tem categorias."
      manualPlaceholder="ID da categoria"
      loadingLabel="Carregando categorias"
    />
  );
}

export { CategorySelect };
export type { CategorySelectProps };
