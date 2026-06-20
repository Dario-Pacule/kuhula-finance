# 🧠 Kuhula Finance — Gerenciador Financeiro Inteligente

O **Kuhula Finance** é uma aplicação moderna de finanças pessoais que combina design premium (zinc dark mode), alta responsividade e inteligência artificial para ajudar indivíduos e famílias a organizarem as suas vidas financeiras. 

Construído com **Next.js**, **Tailwind CSS v4** e **Shadcn UI**, o Kuhula Finance integra o modelo **Gemini AI** para atuar como um assistente financeiro autónomo, capaz de sugerir estratégias de poupança, ajustar saldos e gerir contas de forma totalmente conversacional.

---

## 🚀 Funcionalidades Principais

* **💰 Dashboard Consolidado**: Veja o saldo global unificado e a separação automática entre contas bancárias tradicionais e carteiras móveis populares (como M-Pesa, e-Mola ou mKesh).
* **🤖 Kuhula AI (Orquestração de Inteligência Artificial)**: Um chat integrado com capacidade de executar comandos diretamente no seu painel através de *Function Calling*. A IA pode:
  * Criar ou excluir contas financeiras.
  * Injetar cartões de conselhos e alertas visuais de risco diretamente no seu dashboard (com níveis: *info*, *sucesso*, *aviso*, *crítico*).
  * Recomendar e implementar metodologias financeiras famosas, como a **Regra 50/30/20** ou o **Método dos Envelopes**.
* **📈 Previsibilidade de Caixa**: Um gráfico de área dinâmico (*Recharts*) que projeta o fluxo de caixa para os **próximos 180 dias**, tendo em conta as receitas e as despesas futuras estimadas.
* **📂 Histórico de Transações com Filtros Avançados**:
  * Pesquisa textual de transações por descrição, categoria ou conta.
  * Filtros rápidos por Tipo (Receitas, Despesas, Recorrentes), Categorias dinâmicas e Contas específicas.
  * **Design Móvel Flexível**: Barra de filtros e listagens adaptam-se automaticamente de forma fluida a ecrãs de telemóveis usando *Container Queries* do Tailwind CSS.
* **🛡️ Persistência Híbrida Inteligente**: 
  * Funciona localmente via `localStorage` sem qualquer configuração necessária.
  * Sincroniza e persiste automaticamente numa base de dados na nuvem (**MongoDB Atlas**) se a variável correspondente for detetada.

---

## 🛠️ Tecnologias Utilizadas

* **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
* **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
* **Componentes UI**: [Shadcn UI](https://ui.shadcn.com/) (Radix Primitives)
* **Gráficos**: [Recharts](https://recharts.org/)
* **Ícones**: [Lucide React](https://lucide.dev/)
* **Inteligência Artificial**: [Google Gemini API](https://ai.google.dev/)
* **Base de Dados**: [MongoDB](https://www.mongodb.com/) (com Mongoose)

---

## 💻 Instalação e Execução Local

### Pré-requisitos
* Node.js (v18.0.0 ou superior)
* npm, yarn, pnpm ou bun

### 1. Clonar o repositório
```bash
git clone https://github.com/Dario-Pacule/kuhula-finance.git
cd kuhula-finance
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as Variáveis de Ambiente (Opcional para modo Nuvem)
Crie um ficheiro `.env.local` na raiz do projeto:
```env
MONGODB_URI=mongodb+srv://<usuario>:<senha>@cluster0.xxxx.mongodb.net/kuhula?retryWrites=true&w=majority
GEMINI_API_KEY=sua_chave_api_do_gemini
```
> *Nota: Se não fornecer a `MONGODB_URI`, a aplicação funcionará em modo offline guardando todas as transações de forma segura no próprio navegador do utilizador.*

### 4. Executar o servidor de desenvolvimento
```bash
npm run dev
```
Abra o seu navegador em [http://localhost:3000](http://localhost:3000) para ver a aplicação em funcionamento.

---

## ⚙️ Implantação (Deploy) na Vercel + MongoDB Atlas

Para colocar o Kuhula Finance online com sincronização em tempo real entre todos os seus dispositivos, siga os passos abaixo:

### Passo 1: Configurar a Base de Dados
1. Crie uma conta gratuita no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) e inicialize um cluster partilhado gratuito (M0).
2. Em **Network Access**, adicione a regra para aceitar ligações de qualquer IP (`0.0.0.0/0`) pois a Vercel usa IPs dinâmicos.
3. Crie um utilizador em **Database Access** e copie a sua *Connection String* do driver de Node.js.

### Passo 2: Publicar no Vercel
1. Instale a CLI do Vercel (`npm install -g vercel`) ou ligue diretamente o seu repositório do GitHub à plataforma da Vercel.
2. Nas definições do projeto na Vercel, aceda a **Settings** -> **Environment Variables** e registe as variáveis:
   * `MONGODB_URI` (String de ligação do Atlas)
   * `GEMINI_API_KEY` (Chave de desenvolvimento do Gemini)
3. Promova uma nova compilação (*Redeploy*) na Vercel. A aplicação passará a salvar e recuperar os seus dados do MongoDB Atlas de forma automática!

---

## 📄 Licença

Este projeto está licenciado sob a licença MIT. Consulte o ficheiro [LICENSE](LICENSE) para obter mais informações.
