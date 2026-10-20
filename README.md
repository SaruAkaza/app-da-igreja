# Comunhão · App devocional da igreja

Aplicativo Expo/React Native para leitura bíblica em comunidade, registro de anotações por foto, acompanhamento pastoral e recompensas. O backend usa Node.js, Express, TypeScript e SQLite. O painel web é servido pela própria API.

## Começar

Requer Node.js **22.13 ou mais recente** (validado com Node 24). Abra um terminal na raiz do projeto:

```powershell
npm run setup
npm run dev
```

O primeiro comando instala as dependências com os arquivos de versões fixadas. O segundo inicia API e Expo. Pressione **w** no terminal do Expo para abrir o aplicativo no navegador.

- Painel administrativo: http://localhost:3000/admin/
- Aplicativo Mobile Web unificado: http://localhost:3000/ (ou http://localhost:8081 via Metro)
- Saúde da API: http://localhost:3000/api/health
- Celular: Expo Go compatível com SDK 58; use o QR Code do Expo. Em **Configurar conexão com o servidor**, informe `http://IP_DO_COMPUTADOR:3000`. Computador e celular devem estar na mesma rede.

### 🌐 Como Compartilhar com Outras Pessoas na Internet para Teste

Você pode compartilhar o app de duas maneiras:

#### 1. Link Público Imediato (Túnel sem custo):
Com o servidor rodando, abra outro terminal e execute:
```bash
npm run tunnel
```
Isso gerará um link público seguro (ex: `https://sua-igreja.loca.lt`) que você pode enviar no WhatsApp para qualquer pessoa abrir no celular ou computador imediatamente!

#### 2. Build Unificado e Deploy em Nuvem (Render / Railway / VPS):
Compile a API e gere o aplicativo web para iniciar a implantação unificada:
```bash
npm run build
npm start
```
O backend em Node.js servirá tudo em um único endereço:
* `/` -> Aplicativo Mobile Web (membros e líderes)
* `/admin` -> Painel Administrativo da Igreja
* `/api` -> Toda a API REST e banco de dados SQLite Multi-Igrejas

Também é possível iniciar separadamente: `npm run dev` dentro de `backend` e `npm start` dentro de `mobile`.

## Conhecer sem alterar os dados da igreja

Na raiz, execute:

```powershell
npm run demo
```

A demonstração usa **outro banco**, na pasta `.demo-data`, e habilita os acessos rápidos. Não use simultaneamente com outra API na mesma porta. O seed só roda quando `DEMO_MODE=true` e o banco está vazio.

| Perfil | E-mail | Senha de demonstração |
| --- | --- | --- |
| Membro | maria@igreja.com | 123456 |
| Membro | joao@igreja.com | 123456 |
| Líder | lider@igreja.com | 123456 |
| Administrador | admin@igreja.com | 123456 |
| Administrador de outra igreja | pastor.silas@memorial.com | 123456 |

Os códigos de confirmação aparecem na tela **somente na demonstração**. Ela contém nomes, fotografias remotas, pontos e prêmios fictícios; suas datas são exemplos de 2026. Em produção, o modo de demonstração é recusado pelo servidor.

## Usar com sua igreja

1. Copie `backend/.env.example` para `backend/.env`. Preencha `JWT_SECRET` com uma chave aleatória de pelo menos 32 caracteres. Guarde essa chave: sua troca encerra as sessões existentes. Sem chave em desenvolvimento, uma chave temporária é criada a cada reinicialização.
2. Configure `SMTP_URL` e `MAIL_FROM` para confirmação de e-mail e recuperação de senha. Por exemplo, uma URL de conexão SMTP fornecida pelo seu provedor. O aplicativo informa quando o serviço ainda não está configurado.
3. Cadastre a igreja pelo botão **Levar o Comunhão para minha igreja** na entrada do aplicativo e confirme o e-mail pastoral, ou entre com um administrador já existente. O código da igreja aparece antes de iniciar a sessão. O painel exige perfil de administrador; líderes têm seu espaço no aplicativo.
4. No painel, crie grupos, compartilhe seus códigos e cadastre os prêmios disponíveis. Cada prêmio pertence ao trimestre atual; se não existir uma temporada para ele, o servidor a cria.
5. Os membros criam a conta em duas etapas, confirmam o e-mail, entram na igreja/grupo e registram sua primeira leitura. Menores também precisam de autorização do responsável.

Para a autorização do responsável, configure `CONSENT_WEBHOOK_URL` e, se necessário, `CONSENT_WEBHOOK_TOKEN`. O servidor faz um POST com `{phone, childName, code, expires_at}` para esse serviço, que deve entregar a mensagem diretamente ao responsável por um provedor de SMS ou WhatsApp. O código não é devolvido ao menor fora da demonstração. Sem o serviço, esse fluxo permanece indisponível e informa o motivo.

## Rotina

- **Membro:** lê, fotografa a anotação, informa a passagem e envia ao grupo. Sua reflexão e foto ficam disponíveis ao autor, líder responsável e administração da mesma igreja. Os demais participantes veem apenas a celebração da leitura e podem reagir.
- **Líder:** acompanha somente os grupos sob sua liderança, envia orientações e registra a entrega de prêmios pelo código do cupom.
- **Administrador:** acompanha atividade semanal, orientações pendentes e grupos; busca membros; concede bônus com motivo; cadastra grupos e prêmios; modera devocionais e valida entregas. Pode criar ou participar de jornadas entre igrejas.
- **Pontos:** 50 por registro, uma vez por grupo/dia; bônus de sequência de `min(dias × 10, 100)` uma vez por dia. O dia segue `America/Sao_Paulo` por padrão. Prêmios usam o saldo acumulado de pontos e geram um cupom por pessoa/prêmio no trimestre; os pontos não são gastos no resgate.
- **Acessibilidade:** botões principais de pelo menos 56 px e modo de leitura ampliada nas configurações, aplicado à tela inicial e aos botões compartilhados.

## Dados existentes e atualização

O banco padrão continua sendo `backend/data/igreja_devocional.db`. Novos uploads ficam em `backend/data/uploads/devotionals`. Fotos antigas em `backend/uploads/devotionals` continuam acessíveis **pela rota privada autenticada**, sem precisar mover os arquivos. A API não serve mais `/uploads` publicamente. Clientes antigos que utilizavam esse caminho precisam ser atualizados.

As migrações mantêm os registros e acrescentam a versão de sessão. A migração deixou de inventar endereços, idades e verificações para completar perfis. Dados fictícios que já foram gravados por versões anteriores precisam ser revisados pela igreja; a atualização não adivinha quais informações eram reais.

Faça backup consistente do SQLite e das duas pastas de uploads antes de uma atualização operacional. Com o servidor parado, copie o banco e uploads. Não coloque fotos, bancos ou `.env` no Git. Defina `DATA_DIR` para outro caminho absoluto, se necessário. Não mude esse valor sem migrar também os dados.

## Verificar

```powershell
npm run check
```

Executa compilação do backend, 149 verificações de API, autenticação, configuração e CEP, checagem de tipos do aplicativo e lint. Os testes criam banco e uploads temporários, iniciam uma API em porta aleatória e removem seus próprios arquivos ao terminar. Eles nunca se conectam ao servidor da porta 3000 nem alteram o banco da igreja. Os provedores de CEP são controlados nos testes; a suíte não depende da internet nem entrega mensagens reais.

Para verificar os formulários no navegador, instale opcionalmente `playwright` com `npm install --no-save --package-lock=false playwright` e o Chromium com `npx playwright install chromium`. Com o build pronto, inicie **uma API de demonstração com DATA_DIR temporário** e execute `npm run test:browser`. O runner usa `http://127.0.0.1:3017` por padrão, configurável em `COMUNHAO_TEST_URL`, e só aceita localhost com demonstração habilitada. Ele cria contas fictícias nesse banco. `PLAYWRIGHT_CHROMIUM_PATH` seleciona um Chromium já instalado e `COMUNHAO_TEST_ARTIFACTS` define a pasta de capturas.

Veja os problemas corrigidos, evidências e limites em [Validação de 20/10/2026](docs/VALIDACAO-2026-10-20.md). Clientes do app precisam acompanhar a atualização da API: os cadastros agora enviam `emailVerificationToken` devolvido pela confirmação do e-mail, e menores enviam `parentConsentToken` devolvido pela confirmação do responsável.

Para exportar o aplicativo web, execute `npx expo export --platform web` na pasta `mobile`.

## Antes de disponibilizar na internet

Use HTTPS, `NODE_ENV=production`, `JWT_SECRET` persistente, origens web explícitas em `CORS_ORIGINS` e `DEMO_MODE=false`. Não exponha o Metro/Expo de desenvolvimento. Configure entrega de mensagens, backups e contas reais; revise as contas de demonstração caso o banco antigo já as contenha. A API usa limite de tentativas por IP em memória, adequado a uma instância; uma implantação com várias instâncias precisa de controle compartilhado e armazenamento de arquivos apropriado.

A auditoria realizada em 20/10/2026 não encontrou vulnerabilidades nas dependências de produção do backend. A cadeia do Expo apresentou 26 alertas (19 altos e 7 moderados), com causas em `braces`, `node-forge` e `uuid`. As correções compatíveis automáticas foram aplicadas; as restantes não tinham solução compatível indicada pelo auditor. Não foi forçado downgrade do SDK. Reavalie as dependências antes de publicar.

Validação realizada em Windows e navegador. Câmera, permissões nativas, cofre do sistema e builds Android/iOS precisam de validação em aparelho físico antes da distribuição. Configuração de SMTP, provedor do responsável e hospedagem depende das credenciais e serviços da igreja.
