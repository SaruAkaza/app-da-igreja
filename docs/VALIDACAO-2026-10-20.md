# Verificação de bugs e fluxos — 20/10/2026

Revisão sobre `master`, commit `f3d99743a5fc77f24ecbf7ac163a7eba847437ad`, em Linux com Node.js 24.19.0. Bancos, usuários e uploads dos testes foram criados em diretórios temporários; nenhum banco real da igreja foi utilizado.

## Correções

| Área | Problema reproduzido | Comportamento corrigido |
| --- | --- | --- |
| Cadastro | Uma confirmação global do e-mail permitia concluir cadastro sem comprovar a posse do código naquele cliente. | A confirmação devolve uma prova assinada vinculada ao e-mail e ao código, com prazo e consumo ao cadastrar. |
| Perfil | A resposta de atualização incluía hash da senha, código de recuperação e versão de sessão. | Respostas do perfil filtram os campos internos, inclusive quando há recuperação pendente. |
| Senha | Requisições simultâneas podiam usar o mesmo código de recuperação. | A troca da senha consome o código condicionalmente; apenas uma requisição vence e sessões anteriores são revogadas. |
| Menores | Trocar nome ou responsável preservava autorização antiga. | Cadastro e mudanças de identidade/responsável exigem prova válida e vinculada; o aplicativo permite solicitar a autorização. |
| Cadastro concorrente | E-mails e handles eram consultados antes da operação assíncrona de senha. | A validação é repetida após o hash e o handle é gerado sem colisões antes da gravação. |
| Login | Um handle de outra conta podia prevalecer sobre o e-mail exato. | O login prioriza o e-mail exato. |
| Igreja | E-mail marcado como confirmado sem verificação, perfil e bônus fictícios, trimestre fixado em janeiro de 2026 e convite com domínio inexistente. | Confirmação pastoral, perfil calculado pelos dados fornecidos, temporada do trimestre atual e convite por código. A tela de sucesso exibe o código antes de iniciar a sessão. |
| Sessões | Falha temporária ao restaurar a conta apagava a sessão; troca para conta expirada não tratava o erro. | Falhas de conexão/503 preservam a sessão; 401 remove a sessão inválida; a troca de conta mostra o erro. O painel também preserva sessão durante falha temporária. |
| Demonstração | Os botões de administrador usavam senha incorreta. | App e painel utilizam as credenciais do seed. |
| Grupos | Líder podia gerenciar participantes de outros líderes; líder designado não era inscrito no grupo. | Permissão limitada ao líder responsável; líder designado participa automaticamente. |
| Ciclos | Fechamento repetido podia gerar novos vencedores; registros continuavam pontuando depois de encerrar; datas inválidas eram aceitas. | Encerramento repetido e novos registros são bloqueados; datas reais e intervalo são validados. |
| Prêmios | Excluir um grupo transformava seus prêmios exclusivos em prêmios gerais pelo `ON DELETE SET NULL`. | Exclusão bloqueada enquanto houver prêmios vinculados, com orientação para revisá-los. |
| CEP | Falha dos provedores era tratada como endereço inexistente. | Ausência explícita retorna 404; indisponibilidade retorna 502 e permite preenchimento manual. Testes usam provedores controlados. |
| Execução | `npm start` na raiz falhava porque `tsx` estava instalado somente no backend; o build não compilava a API. | Build compila API e web; start executa a API compilada. Setup usa `npm ci`, com lockfile compatível. O painel abre o aplicativo no endereço da própria implantação. |

## Verificações automatizadas

`npm run check` executa build do backend, testes com HTTP real e SQLite temporário, tipos do mobile e lint. A suíte inclui:

- 78 verificações de API e funcionalidades: cadastro, permissões, grupos, upload, privacidade, orientações, bônus, cupons, moderação e ciclos.
- 56 regressões de autenticação: provas inválidas/expiradas, concorrência, senhas, sessões, consentimento, cadastro pastoral e limite de tentativas (61ª requisição bloqueada com `429` e `Retry-After`).
- 6 verificações de CEP: normalização, cache, fallback, ausência, indisponibilidade e resposta incompleta.
- 9 verificações de configuração em processos separados: serviços de entrega não configurados, ausência de códigos expostos e recusa de demonstração/chave JWT fraca em produção.

Total: **149 verificações**, além de compilação, tipos e lint. `npm run build` exporta o aplicativo web e compila o backend. `npm start` foi exercitado em instância temporária na porta 3017.

## Navegador

Chromium com Playwright, app em viewport 430 × 932 e painel em 1440 × 1000. O runner `npm run test:browser` reúne 7 cenários do aplicativo e 13 verificações do painel. Foram exercitados cadastro de membro e de igreja pela interface, confirmação por código, exibição do código da igreja antes do login, atualização de adulto para menor com autorização (incluindo perfil legado com autorização antiga), sessão após 503/desconexão, recuperação da conexão, sessão expirada, alternância de conta inválida e logout.

No painel, foram verificados bloqueio de membro, login demo, as sete páginas principais, link do app, restauração após 503 e logout. Não foram observados erros JavaScript não tratados nesses fluxos. Os testes de confirmação usam os códigos explícitos de demonstração; não entregam mensagens reais.

## Compatibilidade e limites

Clientes precisam ser atualizados junto com a API: `verify-code` devolve `verificationToken`, enviado como `emailVerificationToken` em `register`, `complete-registration` e `register-church`. A confirmação parental devolve `consentToken`, enviado como `parentConsentToken` no cadastro/atualização quando necessário. Provas não funcionam como sessão de usuário.

A consulta real ao CEP 01001000 retornou São Paulo/SP via BrasilAPI. A suíte principal usa fixtures para não depender da disponibilidade da internet. No ambiente em nuvem, o smoke externo usou `NODE_USE_ENV_PROXY=1`.

`npm audit --omit=dev` do backend: **0 vulnerabilidades**. Auditoria do mobile: **26 alertas (19 altos e 7 moderados)** na cadeia do Expo/React Native, incluindo `braces`, `node-forge` e `uuid`; não foi forçada troca incompatível de SDK. Esses alertas continuam pendentes de atualização compatível.

Entrega real por SMTP/SMS/WhatsApp, câmera, permissões nativas, SecureStore e builds Android/iOS dependem dos respectivos serviços/aparelhos e não foram validados. O teste sem credenciais confirma as mensagens de indisponibilidade, não a entrega. As correções não alteram dados legados já existentes nem fazem implantação em produção.

## Instalação no Windows — 21/10/2026

Um teste no Windows x64 com Node 24.12.0 falhou no `node-gyp rebuild` do `better-sqlite3`, por ausência de Visual Studio. O pacote 13.0.3 já distribui um binário Windows x64 e declara `gypfile:false`, mas o `npm ci` reconstrói metadados do lockfile sem preservar essa informação e acaba acionando a compilação implícita. A tentativa foi reproduzida em Linux com npm 11.6.2 e 11.9.0; trocar apenas o npm não a resolveu.

O setup passou a instalar o backend sem executar scripts nessa primeira etapa, respeitar o `gypfile:false` do SQLite e executar os ciclos das demais dependências via `npm rebuild`. Não há desativação global de scripts: o postinstall do esbuild continua sendo executado. Uma consulta SQLite em memória valida o carregamento do binário ao fim da instalação.

A instalação também recusa projetos dentro da pasta do Windows antes de instalar dependências. As instruções de PowerShell agora começam pela pasta do usuário e só iniciam a demonstração se o setup terminar com sucesso. Nenhum arquivo da cópia anterior em System32 é removido.

A correção foi verificada em instalações limpas no Linux, incluindo Node 24.12.0 e npm 11.6.2, sem compilador C/C++ disponível para os processos de teste. A validação física da instalação no Windows continua pendente porque a nova máquina não estava conectada ao Desktop Commander.
