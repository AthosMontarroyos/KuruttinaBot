/**
 * Separa o nome do command do restante de um exemplo, para a tela destacar só o nome (`/ban` e `membro:@Fulano motivo:Spam`).
 * Se o exemplo não começa pelo nome, devolve tudo como resto, sem destaque.
 */
function splitExample(example: string, name: string): { name: string; rest: string } {
  return example.startsWith(name) ? { name, rest: example.slice(name.length) } : { name: '', rest: example };
}

export { splitExample };
