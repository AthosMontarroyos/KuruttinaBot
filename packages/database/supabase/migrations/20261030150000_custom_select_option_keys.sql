-- Chave estável de cada opção de menu (20261030150000_custom_select_option_keys.sql). O site gera a chave no
-- cliente e a grava a cada salvamento; como as opções são reescritas, o id da linha muda, mas a chave não.
-- Assim o template de mensagem pode apontar para uma opção sem depender do id. Mesmas policies e grants da tabela.
SET LOCAL ROLE kuruttina_owner;

ALTER TABLE bot_private.custom_select_options ADD COLUMN option_key text;
-- Linhas que já existiam ganham uma chave aleatória de 8 caracteres hexadecimais (cabe em [a-z0-9]).
UPDATE bot_private.custom_select_options SET option_key = substr(md5(id::text || random()::text), 1, 8) WHERE option_key IS NULL;
ALTER TABLE bot_private.custom_select_options ALTER COLUMN option_key SET NOT NULL;
ALTER TABLE bot_private.custom_select_options ADD CONSTRAINT custom_select_options_option_key_check CHECK (option_key ~ '^[a-z0-9]{6,12}$');
-- A chave só precisa ser única dentro do menu: o mesmo valor pode existir em outro menu.
ALTER TABLE bot_private.custom_select_options ADD CONSTRAINT custom_select_options_select_id_option_key_key UNIQUE (select_id, option_key);
RESET ROLE;
