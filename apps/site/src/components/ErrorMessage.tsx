/** Erro de formulário. Quebra em vários parágrafos quando a frase traz mais de uma linha. */
function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="flex flex-col gap-1 text-sm text-red-600">
      {message.split('\n').map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
    </div>
  );
}

export { ErrorMessage };
