# Plataforma, grupos de conexão e permissões

Remodelação de 23/10/2026 sobre a revisão de autenticação da branch `fix/auth-registration-audit` (`870e0bb`). O aplicativo continua usando Expo SDK 58, Expo Router e a API Express/SQLite. Não há novo serviço externo nem nova dependência.

## Entrada e divisão das igrejas

1. A pessoa cria uma conta com confirmação do e-mail e entra com seu e-mail/usuário e senha.
2. Se ainda não tiver igreja, a página inicial apresenta o campo de convite da igreja ou grupo. Não existe catálogo público de membros ou dados das outras igrejas.
3. Depois do vínculo, a página inicial mostra a igreja, os grupos e respostas pertinentes àquela pessoa. A aba **Conexões** abre os grupos aos quais ela pertence; a administração pode abrir todos os grupos da sua igreja.
4. O catálogo **Explorar** permite ingressar nos grupos da própria igreja. Antes de participar, não é possível consultar participantes, ciclo, ranking individual ou conteúdo do grupo. Uma pessoa sem igreja precisa de convite, e não pode se vincular usando apenas o ID de um grupo.

Nesta versão, cada conta tem uma igreja ativa, persistida em `users.church_id`. O e-mail da conta é único na plataforma. Uma pessoa com contas distintas pode usar **Alternar conta → Conectar Outra Conta**, autenticar-se e trocar entre os perfis salvos no aparelho. Isso troca a conta; não concede participação em duas igrejas à mesma conta.

A igreja e o cargo não são aceitos como autoridade do formulário, da URL ou de informações antigas no aplicativo. A API busca o usuário atual no SQLite em toda requisição autenticada, a partir do JWT validado. Toda consulta privada inclui a igreja dessa sessão e, quando necessário, a participação no grupo ou a liderança atribuída.

O isolamento entre igrejas é lógico, em uma base compartilhada. As imagens são entregues por rota autenticada após validar igreja e autorização; a pasta de uploads não é pública. Uma jornada entre igrejas, quando criada e aceita pelas administrações, compartilha somente a classificação agregada das igrejas participantes, sem abrir fotos, dúvidas, respostas ou membros de outra igreja.

## Experiência conectada

O grupo tem quatro abas:

- **Leituras:** celebrações do grupo; imagem e reflexão visíveis somente a quem tem autorização. O participante registra a leitura com o grupo já selecionado e pode perguntar sobre uma leitura sua.
- **Dúvidas:** pergunta privada, imagem/passagem vinculadas quando a dúvida parte da leitura, resposta da liderança, indicação de resposta ainda não lida e confirmação de leitura pelo autor. Também é possível perguntar sem anexar uma leitura.
- **Conquistas:** metas do grupo e da igreja, progresso com a pontuação correspondente, cupons próprios, apresentação do QR, pódio e encerramento do ciclo. O administrador cadastra o prêmio sem sair do grupo.
- **Pessoas:** participantes daquele grupo e identificação da liderança. E-mails de colegas não são enviados a participantes comuns.

Após enviar a imagem, o aplicativo oferece **Registrar dúvida sobre esta leitura**, **Ver minha leitura no grupo** e **Acompanhar conquistas do grupo**. A caixa **Conversas** reúne dúvidas e respostas permitidas ao usuário, além das orientações anteriores sobre devocionais. As listas têm paginação; avisos e dados são atualizados ao abrir ou atualizar a tela. Não há promessa de notificação push ou envio de e-mail para cada dúvida/resposta.

No navegador e na mesma origem, o administrador abre o painel pelo menu do aplicativo com sua sessão atual. O painel abre novamente a área do grupo por **Leituras e dúvidas**, ou o aplicativo pelo link superior. O token é transferido pelo armazenamento da sessão, sem entrar na URL. Sair do painel remove também a sessão web ativa correspondente. No app nativo, o painel é aberto no navegador e usa a autenticação desse navegador.

O cabeçalho do painel se reorganiza em telas pequenas para manter os links e o botão de sair acessíveis, sem sobreposição com o indicador de conexão.

## Permissões

| Ação | Membro | Líder | Administrador da igreja |
| --- | --- | --- | --- |
| Ver celebrações e participantes de um grupo | Grupos dos quais participa | Grupos dos quais participa ou sob sua liderança | Grupos da sua igreja |
| Publicar imagem | Nos grupos em que participa e com ciclo ativo | Mesma regra de participação | Mesma regra de participação |
| Ver imagem/reflexão privada | Suas próprias publicações | Próprias e dos grupos sob seu cuidado | Publicações da sua igreja |
| Perguntar | Em grupo ao qual tem acesso | Em grupo ao qual tem acesso | Em grupo da sua igreja |
| Ver pergunta e resposta | Suas próprias conversas | Próprias e dos grupos atribuídos | Conversas da sua igreja |
| Responder pergunta/orientar leitura | Não | Grupos sob sua liderança | Grupos da sua igreja |
| Cadastrar prêmio ou atribuir cargo | Não | Não | Somente na sua igreja |
| Apresentar QR de cupom | Cupons próprios | Cupons próprios | Cupons próprios |
| Registrar entrega | Não | Prêmio do grupo que lidera; prêmio geral de participante sob seu cuidado | Prêmios da sua igreja |
| Encerrar ciclo | Não | Grupo sob seu cuidado | Grupo da sua igreja |
| Ver dados privados de outra igreja | Não | Não | Não |

`super_admin` continua reservado, sem interface para atribuição a um membro ou para atravessar igrejas. Não é utilizado como um passe para ignorar `church_id`.

Ao revogar um cargo, a API aplica a nova permissão imediatamente. A navegação autenticada é remontada quando mudam conta, igreja ou cargo, evitando reaproveitar telas e dados da conta anterior. O líder precisa delegar o grupo antes de sair. A administração preserva pelo menos um administrador por igreja.

Para mudar de igreja, a administração desvincula a pessoa, remove participações e responsabilidades, encerra a elegibilidade dos cupons ativos e zera pontos e sequência daquele vínculo. O histórico da igreja anterior é preservado para auditoria. Um novo convite entra como membro; cargos e pontos não são transportados para outra igreja.

## Regras de premiação

- A meta de pontos do grupo considera a soma de `devotionals.points_awarded` daquele membro no grupo, entre as datas do ciclo, quando definidas. Pontos de outro grupo, bônus gerais ou leituras fora desse período não antecipam a conquista.
- O pódio usa a mesma soma, com desempate pela data de entrada no grupo e pelo ID. A classificação e a emissão usam a mesma ordenação.
- Prêmios gerais continuam usando o saldo da igreja. A tela não apresenta mais metas fixas de janeiro de 2026 ou patamares que não foram cadastrados.
- Perguntar e responder não gera pontos. Ocupação na liderança também não garante prêmio.
- Os cupons de metas são emitidos uma única vez por pessoa/prêmio. A apresentação usa QR e código; a entrega é registrada pela liderança autorizada ou administração.
- O encerramento emite os cupons de pódio dos prêmios da temporada vigente e bloqueia novo encerramento. Prêmios de pódio precisam ser cadastrados antes de encerrar.
- Um prêmio com cupons emitidos não pode ser transferido para outro grupo ou modalidade. A moderação de uma leitura revê a elegibilidade de cupons pendentes; cupons entregues mantêm o registro da entrega.

## Verificação de 23/10/2026

`npm run check`: **232 verificações** aprovadas, build do backend, tipos e lint. São as 171 verificações anteriores e **61 casos de jornada e isolamento**. Os novos casos cobrem imagem, pergunta/resposta vinculadas, tentativa de ler/responder por outro membro/líder/igreja, contatos protegidos, pontos do ciclo, pódio, entrega, revogação de cargo, moderação, convite e transferência.

`npm run test:journey:browser`: **42 cenários**, 14 em cada perfil — Chromium desktop, WebKit/iPhone 13 e Chromium/Pixel 7. Usam contas separadas de membro, liderança e administração, além de outra igreja. A interface envia a imagem pela galeria, publica a dúvida, responde, mostra o aviso na página inicial, marca a resposta como lida, apresenta QR, entrega o prêmio, encerra o ciclo e troca entre contas de igrejas diferentes. Também exercita a sessão entre aplicativo e painel e seu encerramento.

Foram repetidos os **30 cenários de cadastro/login** de `test:auth:browser` e os **20 cenários existentes** do aplicativo e painel de `test:browser`. Total: **92 cenários de navegador**, além das verificações da API. Não houve erros JavaScript não tratados nos fluxos exercitados. As simulações usaram imagens, pessoas, igrejas e bancos temporários; nenhum dado operacional foi utilizado.

```powershell
npm run setup
npm run check
npm install --no-save --package-lock=false playwright
npx playwright install chromium webkit
npm run build:web
npm run test:journey:browser
npm run test:auth:browser
```

Os dois últimos comandos iniciam seus próprios servidores locais e bancos temporários. `COMUNHAO_TEST_PROFILES=desktop,iphone,android` seleciona os perfis e `COMUNHAO_TEST_ARTIFACTS` define a pasta de capturas. A suíte anterior `test:browser` precisa de uma API de demonstração com `DATA_DIR` temporário, conforme o README.

As capturas comprovam a interface web e a navegação em Chromium/WebKit. Não substituem a validação nativa de câmera, permissões e armazenamento seguro em aparelhos físicos. A confirmação de cadastro em e-mail real continua dependendo do SMTP configurado. As mudanças não fazem implantação em produção nem integram automaticamente o PR em `master`.
