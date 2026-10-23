# Testar pelo GitHub Pages

O Pages publica a interface em `https://saruakaza.github.io/app-da-igreja/`. Ele não executa Node.js nem armazena o banco SQLite e as fotos. Cadastro, confirmação por e-mail, login, grupos, dúvidas e prêmios continuam usando a API do projeto em **outro endereço HTTPS**.

## Publicação da interface

O workflow `.github/workflows/pages.yml` instala somente a interface, verifica tipos e lint, gera o aplicativo e envia o resultado ao Pages. Ele publica os pushes de `fix/auth-registration-audit` (versão de testes) e `master`. Não é necessário mesclar a versão de testes para publicá-la.

1. Abra [Settings → Pages](https://github.com/SaruAkaza/app-da-igreja/settings/pages).
2. Em **Build and deployment → Source**, selecione **GitHub Actions**. Essa configuração inicial exige administração do repositório e não pode ser feita com as operações disponíveis na conexão do assistente.
3. Abra [Actions](https://github.com/SaruAkaza/app-da-igreja/actions), entre na execução **Publicar aplicativo no GitHub Pages** e use **Re-run failed jobs** caso a publicação tenha sido bloqueada pela configuração inicial.
4. Acesse o link exibido pelo job de publicação depois que ele concluir com sucesso.

O build configura o prefixo `/app-da-igreja`, desativa Jekyll e gera entradas HTML para as rotas do aplicativo. Assim, atualizar `/group/?groupId=...&tab=questions` mantém os parâmetros e abre o grupo correto. A saída fica em `mobile/dist-pages`, separada do build que a API serve em `/`.

## Conectar a API

Use um servidor Node.js com HTTPS e armazenamento persistente para o diretório `DATA_DIR` (SQLite e fotos). Para testes temporários, a API pode ficar no Windows com um túnel HTTPS; o computador e o túnel precisam permanecer ligados.

No ambiente da API, configure:

```dotenv
CORS_ORIGINS=https://saruakaza.github.io
```

Use somente a origem, sem `/app-da-igreja`. Se outras interfaces também usarem a API, preserve suas origens separadas por vírgulas. Reinicie a API após alterar a configuração.

Para todo visitante já receber a conexão pronta:

1. Em **Settings → Secrets and variables → Actions → Variables**, adicione a variável **EXPO_PUBLIC_API_URL** com a origem HTTPS da API, por exemplo `https://api.suaigreja.com`.
2. Execute novamente **todos os jobs** do workflow para gerar uma nova interface com esse endereço. A variável é pública e deve conter somente a URL, nunca senha ou token.

Também é possível abrir **Conectar servidor** na tela de entrada e informar o endereço HTTPS. A conexão só é salva depois que a API responder à verificação pública. Uma URL HTTP é recusada quando o aplicativo está em HTTPS. Uma interface sem API configurada apresenta um aviso e solicita a conexão antes do login ou cadastro.

O painel administrativo permanece em `https://ENDERECO-DA-API/admin/`. Como o painel e o Pages têm origens diferentes, o painel pede seu próprio login; tokens não são colocados no endereço do navegador para transferir a sessão.

## Confirmação do cadastro

Para validar o envio real de e-mail, configure `SMTP_URL` e `MAIL_FROM` **no servidor**. O Pages não substitui o provedor de e-mail e não libera cadastro sem confirmação. Fora da demonstração, o código chega somente pelo provedor configurado.

`DEMO_MODE=true` usa dados fictícios e mostra códigos de teste na tela; o servidor recusa essa opção com `NODE_ENV=production`. Não habilite a demonstração sobre dados reais. A autorização de responsáveis por menores também depende do serviço de entrega configurado no backend.

## Verificar antes de publicar

```bash
npm run build:pages
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm run test:pages:browser
```

O último comando requer Playwright, Chromium, WebKit e OpenSSL. Use um build sem `EXPO_PUBLIC_API_URL` para exercitar a configuração da conexão. O teste usa duas origens HTTPS locais, banco temporário, fotos e contas fictícias e uma caixa SMTP local; não envia mensagens externas nem altera dados da igreja. Verifica desktop, iPhone e Android, incluindo código incorreto, cadastro confirmado, login, atualização de rotas, upload, dúvida, foto protegida e resposta.

Essas simulações verificam a estrutura exigida pelo Pages. A publicação só está concluída depois de o workflow publicar com sucesso e o endereço público responder; a entrega de e-mail por um provedor externo requer validação com a configuração desse provedor.

Validação local desta configuração: **18 cenários aprovados**, seis em cada perfil (Chromium desktop, WebKit iPhone 13 e Chromium Pixel 7), além da exportação para o Pages, build do backend, tipos e lint da interface. A troca rápida de tela pode cancelar uma imagem ainda em trânsito; o teste aguarda a imagem protegida do autor carregar antes de navegar e também verifica a imagem recebida pela liderança.
