# Login, cadastro e confirmação por código — 23/10/2026

Revisão da branch `fix/auth-registration-audit`, a partir de `815323a5aba115bcb0a8f71b366dec23904c7080`, incorporando as alterações de `master` até `c7e5fce5fc4846a545115ecae24f11ebe8498dd7`. Ambiente Linux com Node.js 24.19.0. Todos os usuários, bancos, mensagens e autorizações utilizados são fictícios e temporários. Nenhum banco da igreja foi acessado.

## Falhas reproduzidas e corrigidas

| Fluxo | Falha reproduzida | Correção |
| --- | --- | --- |
| Cadastro | Uma senha válida no servidor, como `SenhaValida1'`, era recusada antes de solicitar o código. Outros símbolos eram aceitos na tela e recusados depois da confirmação. | Cadastro pessoal, pastoral e recuperação compartilham a mesma validação no aplicativo, com as regras da API e limite de 72 bytes do bcrypt, inclusive caracteres Unicode. |
| Login durante recuperação | Se a senha fosse redefinida durante a comparação assíncrona de um login, a senha antiga podia receber uma sessão válida com a versão nova. O teste determinístico retornava 200 antes da correção. | O login verifica novamente o hash e a versão de sessão após comparar a senha; o JWT usa a versão que foi validada. O mesmo teste agora retorna 401. |
| Solicitação de código | E-mails copiados com espaços eram recusados na confirmação, embora o cadastro e o login os normalizassem. | Confirmação e recuperação aceitam espaços externos e normalizam maiúsculas. |
| Reenvio | A geração aleatória podia repetir o código anterior. | O reenvio gera um código diferente e invalida o código e a prova anteriores. |
| E-mail existente | A tela solicitava um código antes de informar que a conta já existia. | A solicitação retorna 409 com orientação para entrar ou recuperar a senha, sem novo envio. |
| SMTP indisponível | A entrega não tinha limites explícitos para conexão, saudação e espera de dados. | Timeouts explícitos e resposta de indisponibilidade; a tela mantém os dados para nova tentativa. |

As alterações de túnel e de escuta do servidor já presentes em `master` foram preservadas.

## Confirmação no cadastro

O usuário solicita um código de seis dígitos, recebe a mensagem, informa o código e só então conclui o cadastro com uma prova assinada e vinculada ao seu e-mail. Código incorreto, expirado, consumido ou substituído por reenvio não libera a conta. Não basta confirmar o mesmo e-mail em outro cliente. Menores também precisam da confirmação enviada ao responsável; o cadastro pastoral confirma o e-mail antes de criar a igreja.

Esse mecanismo verifica a posse do e-mail no cadastro. Não é um autenticador TOTP nem exige um segundo código em cada login. A validade do código é de 15 minutos. Não foi removida a verificação para contornar a ausência de SMTP.

## Resultados

`npm run check` passou: build do backend, tipos do aplicativo, lint e **171 verificações**:

- 78 de API e funcionalidades;
- 56 regressões de autenticação, incluindo consumo concorrente, provas e limite real de tentativas;
- 22 de confirmação e entrega por SMTP fora da demonstração;
- 9 de configuração e 6 de CEP.

Os 22 novos casos usam uma caixa SMTP local que recebe a mensagem pelo protocolo real, sem substituir o envio por uma resposta falsa. Exercitam cadastro, normalização, confirmação, expiração, reenvio, recuperação, revogação de sessão, corrida entre login e troca de senha, rejeição SMTP e ausência de saudação. Um receptor HTTP local recebe a autorização parental pelo webhook e permite completar o cadastro do menor. A API não devolve os códigos ao cliente nesses testes.

`npm run build:web` exportou o aplicativo. `npm run test:auth:browser` passou **30 cenários de interface**, dez em cada perfil:

| Simulação | Motor | Resultado |
| --- | --- | --- |
| Desktop, 1440 × 1000 | Chromium | 10/10 |
| iPhone 13, 390 × 664 | WebKit | 10/10 |
| Pixel 7, 393 × 727 | Chromium | 10/10 |

Os cenários cobrem validação da senha antes do envio, falha SMTP com nova tentativa, código errado, código expirado, reenvio, cadastro com a mensagem recebida, login incorreto/correto, recuperação com rejeição da senha anterior, menor com autorização e cadastro pastoral. Não ocorreram erros JavaScript não tratados nem transbordamento horizontal nos pontos verificados.

Também passou `npm run test:browser`, com os **20 cenários existentes** do aplicativo e painel administrativo em demonstração, incluindo restauração de sessão durante indisponibilidade, conta expirada, alternância de conta e logout.

## Reproduzir

```powershell
npm run setup
npm run check
npm install --no-save --package-lock=false playwright
npx playwright install chromium webkit
npm run build:web
npm run test:auth:browser
```

O runner de autenticação cria e encerra a própria API e os receptores locais, remove seu banco ao terminar e informa a pasta das capturas. `COMUNHAO_TEST_ARTIFACTS` define outra pasta; `COMUNHAO_TEST_PROFILES` seleciona `desktop`, `iphone` e/ou `android`. Em Linux, os navegadores podem precisar das bibliotecas de sistema indicadas pelo instalador do Playwright.

## Limites

Os testes SMTP comprovam o fluxo de entrega na aplicação e a recepção local. Não comprovam entrega em Gmail/Outlook, reputação do domínio ou configuração de um provedor externo. Para o uso real, configure `SMTP_URL` e `MAIL_FROM`; a entrega ao responsável depende de `CONSENT_WEBHOOK_URL` e do provedor contratado. A falta dessas configurações continua sendo informada ao usuário.

As simulações executam a versão web nos motores Chromium e WebKit. Não equivalem a testes em aparelhos físicos ou a builds nativos. Câmera, permissões e armazenamento seguro nativo continuam pendentes dessa validação. O computador Windows estava offline no Desktop Commander Remote nesta rodada; não foi alterado.

Os 26 alertas da cadeia do Expo/React Native registrados na revisão anterior continuam pendentes de correção compatível; esta revisão não atualiza o SDK. As alterações ficam na branch de testes e no PR, sem implantação ou integração automática em `master`.
