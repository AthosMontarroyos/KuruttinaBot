/**
 * Desvinculação de Components apagados: tira a referência de um template sem apagar o botão ou o menu dele.
 * Função pura, sem dependências e sem banco: não muta a entrada. Quando nada muda, devolve a mesma referência.
 * @typedef {'button'|'select'} UnlinkKind
 * @typedef {{content: unknown, changed: boolean}} UnlinkResult
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Cópia rasa de `object` sem a chave `key`. @param {Record<string, unknown>} object @param {string} key */
function withoutKey(object, key) {
  const copy = { ...object };
  delete copy[key];
  return copy;
}

/** Botões: tira `component` de cada botão com o id. Devolve a própria linha quando nada muda. @param {unknown} row @param {number} id */
function unlinkButtonRow(row, id) {
  if (!isRecord(row) || !Array.isArray(row.buttons)) return row;
  let changed = false;
  const buttons = row.buttons.map((button) => {
    if (!isRecord(button) || button.component !== id) return button;
    changed = true;
    return withoutKey(button, 'component');
  });
  return changed ? { ...row, buttons } : row;
}

/** Menu: se o menu tem o id, tira `component` do menu e `componentOption` de todas as opções. @param {unknown} row @param {number} id */
function unlinkMenuRow(row, id) {
  if (!isRecord(row) || !isRecord(row.menu) || row.menu.component !== id) return row;
  const menu = withoutKey(row.menu, 'component');
  if (Array.isArray(menu.options)) {
    menu.options = menu.options.map((option) => (isRecord(option) && 'componentOption' in option ? withoutKey(option, 'componentOption') : option));
  }
  return { ...row, menu };
}

/**
 * Tira a referência a um Component apagado (`kind` `'button'` para `custom_buttons`, `'select'` para `custom_selects`).
 * Só mexe nas referências desse tipo e desse id; o resto do template fica igual.
 * @param {unknown} content conteúdo do template (`MessageTemplate`)
 * @param {UnlinkKind} kind
 * @param {number} id
 * @returns {UnlinkResult}
 */
export function unlinkComponent(content, kind, id) {
  if (kind !== 'button' && kind !== 'select') throw new Error('Invalid component kind');
  if (!isRecord(content) || !Array.isArray(content.components)) return { content, changed: false };
  const unlinkRow = kind === 'button' ? unlinkButtonRow : unlinkMenuRow;
  let changed = false;
  const components = content.components.map((row) => {
    const next = unlinkRow(row, id);
    if (next !== row) changed = true;
    return next;
  });
  if (!changed) return { content, changed: false };
  return { content: { ...content, components }, changed: true };
}
