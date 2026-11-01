/** Mesmos tetos de `DISCORD_MESSAGE_LIMITS` em `packages/message-templates/limits.js`. */
const limits = {
  content: 2000,
  embeds: 10,
  embedTitle: 256,
  embedDescription: 4096,
  embedFields: 25,
  fieldName: 256,
  fieldValue: 1024,
  embedTotal: 6000,
  componentRows: 5,
  buttonsPerRow: 5,
  buttonLabel: 80,
  selectOptions: 25,
  selectOptionText: 100,
} as const;

type TemplateIssue = { code: string; path: string; message: string };

const fieldPath = /^embeds\[(\d+)\]\.fields\[(\d+)\]\.(name|value)$/u;

function at(match: RegExpMatchArray, index: number): number {
  return Number(match[index]) + 1;
}

function fieldPlace(embed: number, field: number): string {
  return embed === 1 ? `No campo ${field}` : `No embed ${embed}, no campo ${field}`;
}

function embedPlace(path: string): string | null {
  const match = /^embeds\[(\d+)\]/u.exec(path);
  return match?.[1] === undefined ? null : `No embed ${Number(match[1]) + 1}`;
}

function describeField(issue: TemplateIssue, embed: number, field: number, part: 'name' | 'value'): string | null {
  const where = fieldPlace(embed, field);
  const written = part === 'name' ? 'o nome' : 'o valor';
  if (issue.code === 'empty_text') {
    return part === 'name'
      ? `${where}, você escreveu o valor mas falta o nome.`
      : `${where}, você escreveu o nome mas falta o valor.`;
  }
  if (issue.code === 'limit_exceeded') {
    const max = part === 'name' ? limits.fieldName : limits.fieldValue;
    return `${where}, ${written} passou de ${max} caracteres.`;
  }
  if (issue.code === 'unknown_variable' || issue.code === 'invalid_variable') {
    return `${where}, ${written} tem um trecho entre chaves que este modelo não aceita.`;
  }
  return null;
}

function describeEmbedPart(issue: TemplateIssue): string | null {
  const place = embedPlace(issue.path);
  if (!place) return null;
  if (issue.code === 'empty_embed' && /^embeds\[\d+\]$/u.test(issue.path)) {
    return `${place}, não há título, descrição nem campo.`;
  }
  if (issue.code === 'too_many_fields') return `${place}, passou de ${limits.embedFields} campos.`;
  if (issue.code === 'invalid_color') return `${place}, a cor não é válida.`;
  if (issue.path.endsWith('.title') && issue.code === 'limit_exceeded') return `${place}, o título passou de ${limits.embedTitle} caracteres.`;
  if (issue.path.endsWith('.description') && issue.code === 'limit_exceeded') return `${place}, a descrição passou de ${limits.embedDescription} caracteres.`;
  if (issue.path.endsWith('.author.name') && issue.code === 'empty_text') return `${place}, você informou o autor mas falta o nome.`;
  if (issue.path.endsWith('.footer.text') && issue.code === 'empty_text') return `${place}, você informou o rodapé mas falta o texto.`;
  if (issue.code === 'invalid_url') return `${place}, o link precisa ser uma URL https://.`;
  if (issue.code === 'limit_exceeded' && issue.path === 'embeds') return `Os embeds juntos passaram de ${limits.embedTotal} caracteres.`;
  return null;
}

function describeComponent(issue: TemplateIssue): string | null {
  const button = /^components\[(\d+)\]\.buttons\[(\d+)\]\.(label|url|component|emoji)$/u.exec(issue.path);
  if (button?.[1] !== undefined && button[2] !== undefined) {
    const where = `No botão ${at(button, 2)}`;
    if (button[3] === 'label' && issue.code === 'empty_text') return `${where}, falta o texto ou um emoji.`;
    if (button[3] === 'label' && issue.code === 'limit_exceeded') return `${where}, o texto passou de ${limits.buttonLabel} caracteres.`;
    if (button[3] === 'url' && issue.code === 'invalid_url') return `${where}, o link precisa ser uma URL https://.`;
    if (button[3] === 'component' && issue.code === 'unknown_component') return `${where}, este botão aponta para um Component que não existe mais.`;
    if (button[3] === 'emoji' && issue.code === 'invalid_emoji') return `${where}, o emoji não é válido.`;
    if (button[3] === 'emoji' && issue.code === 'unknown_guild_emoji') return `${where}, o emoji não existe mais neste servidor.`;
  }
  const option = /^components\[(\d+)\]\.menu\.options\[(\d+)\]\.(label|value)$/u.exec(issue.path);
  if (option?.[2] !== undefined && issue.code === 'limit_exceeded') {
    const part = option[3] === 'label' ? 'o texto' : 'o valor';
    return `Na opção ${at(option, 2)} do menu, ${part} precisa ter de 1 a ${limits.selectOptionText} caracteres.`;
  }
  const menu = /^components\[(\d+)\]\.menu\.(minValues|maxValues|component)$/u.exec(issue.path);
  if (menu?.[1] !== undefined && menu[2] !== undefined) {
    const row = at(menu, 1);
    if (menu[2] === 'component' && issue.code === 'unknown_component') return 'Este menu aponta para um Component que não existe mais.';
    if (menu[2] === 'minValues' && issue.code === 'invalid_action') return `Na linha ${row}, o mínimo de seleções precisa ser de 0 a ${limits.selectOptions} e não pode passar do máximo.`;
    if (menu[2] === 'maxValues' && issue.code === 'invalid_action') return `Na linha ${row}, o máximo de seleções precisa ser de 1 a ${limits.selectOptions} e não pode passar do número de opções.`;
  }
  const menuOption = /^components\[(\d+)\]\.menu\.options\[(\d+)\]\.(componentOption|emoji|default)$/u.exec(issue.path);
  if (menuOption?.[2] !== undefined && menuOption[3] !== undefined) {
    const number = at(menuOption, 2);
    if (menuOption[3] === 'componentOption' && issue.code === 'unknown_component_option') return `A opção ${number} aponta para uma ação do menu que não existe mais.`;
    if (menuOption[3] === 'emoji' && issue.code === 'unknown_guild_emoji') return `A opção ${number} usa um emoji que não existe mais neste servidor.`;
    if (menuOption[3] === 'emoji' && issue.code === 'invalid_emoji') return `A opção ${number} usa um emoji inválido.`;
    if (menuOption[3] === 'default' && issue.code === 'invalid_action') return `A opção ${number} tem um valor inválido em "selecionada por padrão".`;
  }
  if (issue.code === 'empty_row') return 'Uma linha de botões ou o menu está vazio.';
  if (issue.code === 'too_many_buttons') return `Uma linha passou de ${limits.buttonsPerRow} botões.`;
  if (issue.code === 'too_many_rows') return `A mensagem passou de ${limits.componentRows} linhas de botões ou menus.`;
  if (issue.code === 'too_many_options') return `O menu passou de ${limits.selectOptions} opções.`;
  return null;
}

/** Explica um erro de formato do modelo em texto de produto, a partir do caminho da validação. */
function describeTemplateIssue(issue: TemplateIssue): string {
  const field = fieldPath.exec(issue.path);
  if (field?.[1] !== undefined && field[2] !== undefined && (field[3] === 'name' || field[3] === 'value')) {
    const text = describeField(issue, at(field, 1), at(field, 2), field[3]);
    if (text) return text;
  }
  if (issue.code === 'empty_message') return 'A mensagem está vazia. Escreva um texto, um embed ou um botão.';
  if (issue.code === 'components_not_allowed') return 'Botões e menus não estão disponíveis nesta mensagem.';
  if (issue.code === 'too_many_embeds') return `A mensagem passou de ${limits.embeds} embeds.`;
  if (issue.path === 'content' && issue.code === 'limit_exceeded') return `O texto da mensagem passou de ${limits.content} caracteres.`;
  return describeEmbedPart(issue) ?? describeComponent(issue) ?? issue.message;
}

function describeTemplateIssues(issues: readonly TemplateIssue[]): string[] {
  return issues.map(describeTemplateIssue);
}

export { describeTemplateIssue, describeTemplateIssues };
export type { TemplateIssue };
