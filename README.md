# Cownter App

Gestão de rebanho bovino pensada para o celular e para o campo: **funciona sem internet**.
Projeto de TCC, evolução do site Cownter desenvolvido na faculdade.

- **Mobile-first:** navegação na base da tela, botões grandes, formulários em painéis que sobem de baixo.
- **Offline-first:** os dados ficam no aparelho (IndexedDB) e o app inteiro é guardado em cache (PWA).
- **Foco em gado:** lotes de gado (com composição por sexo e categoria, vacinas e cabeças opcionais), pastos com rodízio, remédio, sal, tarefas e observações.

## Como rodar

```bash
npm install
npm run dev        # desenvolvimento (sem service worker, mais rápido para programar)
```

### Testando o modo offline

O service worker só é gerado no build de produção:

```bash
npm run build
npm start          # http://localhost:3000
```

1. Abra `http://localhost:3000` e entre com a conta de demonstração (`demo@cownter.com` / `demo123`).
2. Navegue pelas telas (Início, Gado, Pastos, Recursos, Finanças e o perfil) para o app ser guardado em cache.
3. No Chrome: DevTools > Application > Service Workers > marque **Offline** (ou ligue o modo avião no celular).
4. Recarregue a página e cadastre um lote de gado. Tudo continua funcionando e fica salvo no aparelho.

> Instalar o app na tela inicial e usar o service worker exigem **HTTPS ou localhost**.
> Para testar no celular, use o Chrome do computador em `chrome://inspect` com o aparelho
> conectado por USB (redirecionando a porta 3000), ou publique em um endereço HTTPS.

### Testes automatizados

```bash
npm test           # 60 testes: lotes de gado, cabeças, pastos, rodízio, rotinas, alertas, datas e migração do banco
```

## Lotes de gado, pastos e rotinas

- **Lote de gado = um grupo de animais.** O produtor cadastra o lote inteiro (nome + composição). A composição é uma lista de
  linhas de **sexo + categoria + quantidade**: fêmea (bezerra, vitela, novilha, vaca atrasada, vaca mojando, vaca parida) ou
  macho (bezerro, garrote, boi, touro). Lote misto tem mais de uma linha, e o total de cabeças é a soma.
- **Cabeça por cabeça (opcional):** dentro do lote dá para cadastrar uma cabeça com brinco, cor ou nome. O total do lote nunca
  fica menor que o número de cabeças cadastradas.
- **Vacinas do lote (opcional):** nome, aplicada ou não, data e quantas cabeças faltam.
- **Pasto = o terreno.** Cada lote fica em um único pasto, ou sem pasto. Pela tela do pasto, **Mover lote** lista os lotes:
  um lote que já está lá pede o pasto de destino; um lote de fora vem para o pasto.
- **Reservar para descanso.** Só é possível reservar um pasto sem lotes, e um pasto reservado não recebe lotes até ser liberado.
- **Nível do pasto:** Alto, Médio ou Baixo (quantidade de capim), com a data da última atualização.
- **Rotinas do pasto:** remédio (repete a cada N **meses**) e sal (repete a cada N **dias**). O app calcula a próxima data e mostra
  "Em 3 dias" ou "Atrasado há 5 dias". "Feito hoje" reinicia a contagem.
- **Tarefas** (arrumar cerca, jogar adubo, roçar, jogar veneno...) com prazo opcional e **observações** por pasto.
- **Tela inicial:** total de cabeças, de lotes e de pastos (em uso e descansando), e o bloco "Para fazer" com o que está atrasado,
  é para hoje ou vence nos próximos 7 dias.
- **Perfil:** o ícone no topo das telas abre os dados da conta, o estado da conexão e o botão de sair.
- **Recursos e Finanças:** telas reservadas, chegam nas próximas etapas.

> **Avisos (notificações):** hoje os avisos aparecem **dentro do app**, na tela inicial e nos pastos. Notificação com o
> app fechado e sem internet exige o app Android (APK com Capacitor), que agenda os avisos no próprio aparelho. Está no
> roadmap. Uma página web instalada (PWA) não consegue agendar aviso offline sozinha.

## Como o offline funciona

| Camada | O que faz | Onde está |
| --- | --- | --- |
| Banco local | Todas as telas leem e gravam no IndexedDB (via Dexie), nunca direto na internet | `src/lib/db.ts`, `src/lib/gado.ts`, `src/lib/pastos.ts` |
| Cache do app | Service worker (Serwist) guarda páginas, scripts, fontes e ícones | `src/app/sw.ts`, `next.config.mjs` |
| Sincronização *(próxima etapa)* | Registros alterados offline ficam com `syncStatus = "pending"` e serão enviados ao servidor quando houver conexão | campos `id` (UUID), `updatedAt`, `deletedAt`, `syncStatus` em `src/lib/types.ts` |

Decisões de projeto:

- **IDs UUID gerados no aparelho**, para dois celulares offline nunca criarem o mesmo id.
- **Exclusão lógica** (`deletedAt`): o servidor precisa saber que o registro foi removido quando o aparelho voltar a ter internet.
- **Fontes empacotadas no app** (`@fontsource`), sem depender do Google Fonts, que falharia offline.
- **Banco com versões e migração:** a versão 3 separou lote de gado (grupo de animais) de pasto (terreno): os pastos, as tarefas e
  as observações antigos são preservados; os animais soltos da versão 2 não têm equivalente e o produtor cadastra os lotes de novo.
  Há teste automatizado da migração.
- **Rotas `/lote?id=...` (lote de gado) e `/pasto?id=...` (pasto) em vez de `/lote/[id]`:** uma rota fixa pode ser guardada em cache e abrir offline para qualquer registro.
- **Sem recarga automática ao voltar a internet:** por padrão o Serwist recarrega a página quando o sinal volta, o que
  faria o produtor perder um cadastro em andamento. Foi desligado (`reloadOnOnline: false`).
- **Login local provisório:** validado no aparelho para funcionar offline. Será substituído por autenticação real com o backend.

## Estrutura

```
src/
  app/
    (app)/            telas protegidas: inicio, gado, lote, pastos, pasto, recursos, financas, perfil
    login/            tela de login
    sw.ts             service worker
    manifest.ts       manifesto do PWA (nome, cores, ícones)
  components/
    gado/             cartão do lote, formulário (composição e vacinas), cabeças cadastradas
    pastos/           cartão do pasto, rotinas (remédio/sal), tarefas, observações, mover lote
    layout/           barra inferior, ícone de perfil, aviso offline, cabeçalho de página
    ui/               painel (bottom sheet), confirmação, mensagem de erro, controles
  contexts/           autenticação
  lib/                banco local, regras de lotes de gado e pastos, datas das rotinas, hooks, utilitários e testes
```

## Roadmap

- [x] Base mobile + PWA com a identidade visual do Cownter
- [x] Banco local, cadastro / edição / exclusão de animais offline
- [x] Pastos: rodízio, reserva para descanso, nível do pasto, remédio, sal, tarefas e observações
- [x] Lotes de gado (composição por sexo e categoria, cabeças opcionais, vacinas) e pastos que recebem lotes
- [x] Perfil no topo e totais de cabeças e pastos na tela inicial
- [ ] Parto, bezerro ao pé e desmama (com avisos)
- [ ] Recursos: estoque de suplementos e remédios, baixa ao marcar sal e remédio, consumo por pasto
- [ ] Finanças: compras e vendas de gado, despesas, resumo e gráficos por mês, ano e pasto
- [ ] Backend, login real e fila de sincronização (tratamento de conflitos)
- [ ] Assinatura mensal com licença que funciona offline (prazo de tolerância)
- [ ] Notificações no aparelho (APK com Capacitor)
- [ ] Localização do lote com GPS (e mapa offline, se der tempo)
- [ ] Empacotar como APK com Capacitor (Android Studio)
- [ ] Teste de campo com produtores da região

## Ajustes pós-teste da etapa 3

- Tarefa do Início abre a tela do pasto (rota corrigida).
- Tarefas feitas ficam numa seção "Tarefas feitas (N)" abaixo da lista, com Reabrir e Apagar. Em Perfil > Configurações dá para apagar sozinhas após 7/30/90/180 dias.
- Origem do lote é texto livre (com sugestões).
- Aviso "lotes sem pasto" na aba Pastos abre a lista desses lotes.
- Mover lote para pasto descansando pede confirmação ("reservado desde dd/mm/aaaa"); ao confirmar, o pasto volta a "Em uso".

## Etapa 4: parto e desmama

- No lote com vacas: **Registrar parto** (sexo do bezerro, data, vaca opcional). O bezerro entra no lote da mãe e uma vaca mojando (a que está quase parindo) vira vaca parida.
- O lote mostra bezerros mamando e desmamados.
- **Desmamar**: escolhe os bezerros e manda para um lote novo (no mesmo pasto) ou para um lote existente; as mães voltam a ser vaca atrasada.
- Prazo de desmama configurável em Perfil (padrão 7 meses); o Início avisa quando o bezerro chega nessa idade.
- Banco local passou para a versão 5 (tabela `partos`); os dados anteriores são mantidos.

### Ajustes da etapa 4

- Ao registrar o parto, a mãe pode ser escolhida entre as cabeças já cadastradas ou cadastrada na hora (brinco, nome, cor, raça); ela vira cabeça do lote.
- A lista "Cabeças cadastradas (N)" fica recolhida; toca para abrir.

### Mover algumas cabeças entre lotes

- No lote: **Mover algumas cabeças**. Escolhe quantas de cada tipo saem (ex.: 3 novilhas), marca as cadastradas que vão junto e escolhe um lote existente ou um lote novo (no mesmo pasto).
- Bezerro mamando e vaca parida com bezerro só saem pela desmama. Para mover todas as cabeças, use "Mover" (lote inteiro para outro pasto).

### Excluir parto desfaz o efeito

- Excluir um parto tira o bezerro do lote e, se o parto tinha transformado uma vaca mojando em parida, ela volta a mojando. A vaca cadastrada como cabeça continua cadastrada.
- Lote com vaca parida sem parto registrado mostra o aviso "Registrar parto da vaca parida".
- Tocar em "bezerros desmamados" no lote mostra cada bezerro, a data da desmama e o lote para onde foi (com link).

## Etapa 5: Recursos (estoque)

- Aba **Recursos**: Suplementos (sacos + kg por saco + preço por saco) e Remédios (frascos + preço por frasco), com estoque decimal, mínimo para avisar e histórico de compras e usos.
- **Repor estoque**: soma ao estoque e guarda data e valor da compra (base das despesas em Finanças).
- No pasto, ao marcar **sal** ou **remédio** como feito: escolhe o item do estoque e a quantidade usada (decimal, vários itens), ou cadastra o item na hora. Dá para marcar sem baixar do estoque.
- Alertas no Início: estoque zerado, abaixo do mínimo, ou acabando pelo consumo médio (prazo configurável em Perfil, padrão 15 dias).
- Banco local na versão 6 (tabelas recursos, comprasRecurso, usosRecurso). 82 testes.
