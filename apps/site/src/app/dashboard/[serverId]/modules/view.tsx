import { ConstructionIcon, Message } from '../../ui';

function ModulesView({ guildName }: { guildName: string }) {
  return (
    <>
      <h1 className="text-[28px] font-semibold">Módulos</h1>
      <Message title="Módulos em construção">
        <ConstructionIcon className="mx-auto mb-3 size-10 text-text" />
        A configuração dos módulos de {guildName} aparece aqui quando estiver pronta.
      </Message>
    </>
  );
}

export { ModulesView };
