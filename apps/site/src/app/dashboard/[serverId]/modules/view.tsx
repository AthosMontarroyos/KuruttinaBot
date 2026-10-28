import { Message } from '../../ui';

function ModulesView({ guildName }: { guildName: string }) {
  return (
    <>
      <h1 className="text-[28px] font-semibold">Módulos</h1>
      <Message title="Módulos em construção">
        <svg className="mx-auto mb-3 size-10 text-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
        </svg>
        A configuração dos módulos de {guildName} aparece aqui quando estiver pronta.
      </Message>
    </>
  );
}

export { ModulesView };
