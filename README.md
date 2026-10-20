# ✝️ App Devocional Gamificado da Igreja

Ecossistema comunitário completo para incentivar o hábito diário de leitura bíblica e devocionais entre jovens, adultos e idosos. O sistema conta com **comprovação autêntica via foto da folha manuscrita**, acúmulo de pontos com **bônus de constância (streak 🔥)** e **recompensas trimestrais reais** (livros, camisas, restaurantes parceiros) validadas por QR Code nos cultos.

---

## 🏗️ Arquitetura do Sistema

```
App da Igreja/
├── backend/                       # API REST Node.js + Express + SQLite + TypeScript
│   ├── src/
│   │   ├── config/database.ts     # Schema SQLite com chaves estrangeiras e índices
│   │   ├── config/seed.ts         # População automática com dados da igreja e demo
│   │   ├── controllers/           # Auth, Grupos, Devocionais, Gamificação e Admin
│   │   ├── middleware/            # Proteção JWT e Multer para fotos das folhas
│   │   ├── routes/                # Endpoints REST
│   │   ├── test.ts                # Bateria com 10 testes E2E automatizados
│   │   └── server.ts              # Servidor Express com uploads e painel estático
│   ├── public/admin/              # Painel Administrativo Web (HTML + Tailwind moderno)
│   ├── uploads/devotionals/       # Armazenamento local das fotos das folhas
│   └── package.json
│
├── mobile/                        # Aplicativo Mobile (Expo / React Native / TypeScript)
│   ├── src/
│   │   ├── components/            # Botões acessíveis (56px+), Cards de Folha, QR Code
│   │   ├── context/               # AuthContext (sessão e troca rápida de usuários demo)
│   │   ├── screens/               # Login, Home, Feed do Grupo, Câmera Acessível, Prêmios, Líder
│   │   ├── services/api.ts        # Cliente Axios com baseURL e interceptores JWT
│   │   └── theme/                 # Paleta igreja, modo alto contraste e texto grande para idosos
│   ├── App.tsx                    # Navegação por Abas e Stacks
│   └── package.json
│
└── README.md                      # Guia completo de uso e execução
```

---

## 🎯 Regras de Gamificação e Acessibilidade

1. **Envio da Folha Manuscrita**:
   - Cada folha de caderno anotada e fotografada concede **+50 pontos** imediatos.
   - Limite de 1 envio pontuado por grupo a cada dia para preservar a profundidade devocional.
2. **Bônus de Constância (Streak 🔥)**:
   - Para cada dia consecutivo de leitura, o membro recebe **+10 pontos extras por dia de sequência**.
   - Incentiva o membro a não quebrar o hábito diário.
3. **Níveis de Metas no Trimestre**:
   - 🥉 **Bronze** (1.500 pts): Desconto de 15% na Livraria da Igreja.
   - 🥈 **Prata** (2.800 pts): R$ 20,00 de desconto na Camisa da Conferência 2026.
   - 🥇 **Ouro** (4.000 pts): Almoço no Restaurante Parceiro + Livro do Trimestre.
4. **Cupons Digitais com QR Code**:
   - Ao atingir a pontuação necessária, o sistema gera automaticamente um cupom com código exclusivo e imagem de QR Code.
   - O membro exibe o QR Code no culto e o líder/balconista dá baixa instantânea.
5. **Acessibilidade para Idosos ("Modo Super Acessível")**:
   - Todos os botões possuem área de toque generosa (mínimo de 56px de altura).
   - Tipografia ampliada (17px a 28px) de alta legibilidade.
   - Tela de confirmação amigável de nitidez: *"Sua anotação ficou nítida e legível?"* com duas opções diretas: *"📸 Tirar Outra"* ou *"✅ Tudo Certo, Enviar!"*.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js instalado (v18+)
- Celular físico com o aplicativo **Expo Go** instalado (ou emulador Android/iOS, ou no navegador)

---

### Passo 1: Iniciar o Backend e Painel Administrativo

Abra um terminal na pasta `backend`:

```bash
cd backend
npm run dev
```

O servidor iniciará automaticamente na porta 3000:
- **API Healthcheck**: `http://localhost:3000/api/health`
- **Painel Administrativo Web**: `http://localhost:3000/admin`

> O banco de dados SQLite (`data/igreja_devocional.db`) e o seed inicial são criados de forma automática na primeira inicialização!

---

### Passo 2: Acessar o Painel Administrativo Web

Abra o navegador no computador e acesse:
```
http://localhost:3000/admin
```

Recursos do Painel Web:
- **Visão Geral**: Métricas de devocionais de hoje, total de folhas, membros ativos e engajamento dos grupos.
- **Auditoria de Folhas**: Fotos das folhas manuscritas em alta resolução com clique para ampliar e moderação.
- **Ranking**: Pódio da igreja (1º, 2º, 3º lugar) e ranking geral por pontos e constância.
- **Membros & Bônus**: Gestão de irmãos com ferramenta para o Pastor conceder pontos de bônus discricionários (+100 pts) por destaque no culto.
- **Validador de Cupons**: Campo rápido para digitar ou ler o código do cupom e registrar a entrega do prêmio.

---

### Passo 3: Iniciar o Aplicativo Mobile (Expo)

Abra outro terminal na pasta `mobile`:

```bash
cd mobile
npm start
```

Você tem 3 opções para rodar o app:

1. **No seu Celular Físico (Mais recomendado)**:
   - Abra o aplicativo **Expo Go** no celular.
   - Escaneie o QR Code exibido no terminal.
   - *Dica*: No app móvel, clique em `⚙️ Configurar Servidor` na tela de login e digite o IP do seu computador na rede Wi-Fi (ex: `http://192.168.1.15:3000`).
2. **No Navegador Web do Computador**:
   - Pressione `w` no terminal do Expo ou rode `npm run web`.
3. **No Emulador Android**:
   - Pressione `a` no terminal do Expo.

---

## 👥 Contas de Demonstração (1 Toque no App)

Na tela de login do app mobile existem botões de 1 toque para alternar entre os perfis:

| Nome | E-mail | Senha | Perfil no Sistema |
| :--- | :--- | :--- | :--- |
| **Dona Maria** | `maria@igreja.com` | `123456` | Idosa exemplar, 30 dias de sequência (🔥 30d), nível Ouro atingido com cupom pronto |
| **João Pedro** | `joao@igreja.com` | `123456` | Jovem, devocionais em Tiago, nível Bronze atingido |
| **Líder Marcos** | `lider@igreja.com` | `123456` | Líder com acesso à aba "Líder" para validar e dar baixa em cupons com QR Code |
| **Pastor Davi** | `admin@igreja.com` | `123456` | Pastor e administrador do painel web |

---

## 🧪 Testes Automatizados E2E

Para rodar a bateria completa com os 10 testes ponta a ponta da API (Cadastro, Login, Grupos, Upload de Folha, Pontuação, Streak, Reações, Bônus, Desbloqueio de Cupons e Baixa de QR Code):

```bash
cd backend
npm test
```
