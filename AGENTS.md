# 🤖 Diretrizes para Agentes de IA e CLI (Interactio Monorepo)

**Contexto do Sistema:** 
O Interactio é uma plataforma de apresentações interativas em tempo real. Este repositório é um monorepo estruturado por workspaces contendo:
* `/admin`: Portal do apresentador (React Native / Expo / Web).
* `/web`: Portal do participante (Next.js 14+ / App Router).
* `/packages/types`: Contratos TS e interfaces compartilhadas do Firebase.

---

## 🛑 1. Regras Estritas (O que NÃO fazer)
O agente deve abortar a operação ou pedir autorização explícita do usuário se precisar realizar qualquer uma das ações abaixo:
* **NÃO** alterar as configurações de inicialização do Firebase (`firebase.ts`), Auth ou regras de segurança.
* **NÃO** modificar layouts globais (`_layout.tsx` ou `layout.tsx`) nem o roteamento base sem autorização.
* **NÃO** instalar dependências pesadas. Para visualização de dados, prefira `d3` base. Evite wrappers excessivos.
* **NÃO** misturar contextos: Código do `/admin` (React Native) não deve importar componentes web, e código do `/web` (Next.js) não deve usar tags do React Native (como `<View>` ou `<Text>`).
* **NÃO** fazer commits em massa ou pular etapas do roteiro de desenvolvimento.

## ✅ 2. Boas Práticas (O que FAZER)
* **Arquitetura Isolada:** Novas funcionalidades devem ser criadas em pastas modulares (ex: `/src/components/FeatureName/`).
* **APIs do Navegador:** Funcionalidades que usam `Web Speech API`, `Canvas` ou `Window` devem estar em componentes estritamente Client-Side (use `"use client"` no topo do arquivo no Next.js).
* **Processamento Pesado:** Filtros de texto em tempo real, cálculos e agregações devem obrigatoriamente rodar em **Web Workers** para não bloquear a main thread do React.
* **Tipagem Única:** Se o modelo de dados do Firebase mudar, atualize o contrato primeiramente em `/packages/types/` para que `/admin` e `/web` herdem as tipagens.

---

## 🛠️ 3. Padrões de Commits e Fluxo de Trabalho
Você deve atuar de forma atômica. Trabalhe em um passo por vez, valide com o usuário, e só então faça o commit e avance.

**Padrão de Commit (Conventional Commits):**
* `feat:` Para novas funcionalidades.
* `fix:` Para correção de bugs.
* `refactor:` Para refatoração de código que não altera comportamento.
* `chore:` Para atualizações de dependências ou configuração.

**Exemplo de fluxo esperado:**
1. Criar arquivo X.
2. Validar o código (aguardar confirmação).
3. Executar `git add <arquivo_X>` e `git commit -m "feat: adiciona componente X"`.

---

## 🚀 4. Roadmap da Feature Atual: Nuvem de Palavras por Escuta Passiva
**Objetivo:** Módulo no portal `/admin` (ou tela de projeção no `/web`) que escuta o áudio do palestrante de forma contínua, filtra stop words e projeta uma Nuvem de Palavras animada via D3.

**Execução Atômica Exigida (Aguarde aprovação entre os passos):**

* **Passo 1: Tipagem e Dicionário (Commit 1)**
  * Criar interface dos novos dados no `/packages/types`.
  * Criar o array de `stopWords` (artigos, preposições em PT-BR) no diretório do componente.
* **Passo 2: Processamento Assíncrono (Commit 2)**
  * Criar `textProcessor.worker.ts`.
  * Implementar a lógica para receber o transcript, limpar caracteres especiais, filtrar stop words e contabilizar a frequência em um array de objetos ordenado.
* **Passo 3: Motor de Captura de Áudio (Commit 3)**
  * Criar o custom hook `usePassiveListening.ts`.
  * Instanciar `SpeechRecognition`, mantendo `continuous: true`.
  * Lidar com as reinicializações automáticas (API costuma pausar após silêncio longo) e comunicar com o Web Worker.
* **Passo 4: Motor de Renderização (Commit 4)**
  * Criar o componente `WordCloudGraph.tsx`.
  * Usar React `useRef` e D3.js para renderizar e animar as palavras no `<canvas>` conforme as frequências atualizam.
* **Passo 5: Integração Final (Commit 5)**
  * Unir tudo no arquivo principal e conectar à visualização do Telão.
  