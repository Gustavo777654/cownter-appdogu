# Cownter App

Gestão de rebanho bovino pensada para o celular e para o campo: **funciona sem internet**.
Projeto de TCC, evolução do site Cownter desenvolvido na faculdade.

- **Mobile-first:** navegação na base da tela, botões grandes, formulários em painéis que sobem de baixo.
- **Offline-first:** os dados ficam no aparelho (IndexedDB) e o app inteiro é guardado em cache (PWA).
- **Foco em gado:** cadastro de animais (com pasto e vacinas já aplicadas), pastos com rodízio, remédio, sal, tarefas e observações.

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
2. Navegue pelas telas (Início, Rebanho, Vacinas, Mais) para o app ser guardado em cache.
3. No Chrome: DevTools > Application > Service Workers > marque **Offline** (ou ligue o modo avião no celular).
4. Recarregue a página e cadastre um animal. Tudo continua funcionando e fica salvo no aparelho.

> Instalar o app na tela inicial e usar o service worker exigem **HTTPS ou localhost**.
> Para testar no celular, use o Chrome do computador em `chrome://inspect` com o aparelho
> conectado por USB (redirecionando a porta 3000), ou publique em um endereço HTTPS.

### Testes automatizados

```bash
npm test           # 44 testes: animais, pastos, rodízio, rotinas, alertas, datas e migração do banco
```

## Pastos (lotes), rotinas e rodízio

- **Lote = pasto.** Cada animal fica em um único pasto por vez. Dá para mover animais escolhidos para um pasto
  ("Trazer animais") ou mover o pasto inteiro para outro ("Mover todos"), que é o gesto do rodízio.
- **Reservar para descanso.** Só é possível reservar um pasto vazio, e um pasto reservado não recebe animais até ser
  liberado. A tela de lotes mostra há quantos dias cada pasto está em uso ou descansando.
- **Nível do pasto:** Alto, Médio ou Baixo (quantidade de capim), com a data da última atualização.
- **Rotinas:** remédio (repete a cada N **meses**) e sal (repete a cada N **dias**). O produtor informa a última vez e o
  intervalo; o app calcula a próxima e mostra "Em 3 dias" ou "Atrasado há 5 dias". "Feito hoje" reinicia a contagem.
- **Tarefas** (arrumar cerca, jogar adubo, roçar, jogar veneno...) com prazo opcional e **observações** por pasto.
- **Vacinas já aplicadas:** lista (nome + data opcional) no cadastro de cada animal.
- **Tela inicial:** bloco "Para fazer" com o que está atrasado, é para hoje ou vence nos próximos 7 dias.

> **Avisos (notificações):** hoje os avisos aparecem **dentro do app**, na tela inicial e nos pastos. Notificação com o
> app fechado e sem internet exige o app Android (APK com Capacitor), que agenda os avisos no próprio aparelho. Está no
> roadmap. Uma página web instalada (PWA) não consegue agendar aviso offline sozinha.

## Como o offline funciona

| Camada | O que faz | Onde está |
| --- | --- | --- |
| Banco local | Todas as telas leem e gravam no IndexedDB (via Dexie), nunca direto na internet | `src/lib/db.ts`, `src/lib/animals.ts`, `src/lib/lotes.ts` |
| Cache do app | Service worker (Serwist) guarda páginas, scripts, fontes e ícones | `src/app/sw.ts`, `next.config.mjs` |
| Sincronização *(próxima etapa)* | Registros alterados offline ficam com `syncStatus = "pending"` e serão enviados ao servidor quando houver conexão | campos `id` (UUID), `updatedAt`, `deletedAt`, `syncStatus` em `src/lib/types.ts` |

Decisões de projeto:

- **IDs UUID gerados no aparelho**, para dois celulares offline nunca criarem o mesmo id.
- **Exclusão lógica** (`deletedAt`): o servidor precisa saber que o animal foi removido quando o aparelho voltar a ter internet.
- **Fontes empacotadas no app** (`@fontsource`), sem depender do Google Fonts, que falharia offline.
- **Banco com versões e migração:** a versão 2 acrescentou pastos, tarefas e observações e converte os animais já cadastrados
  (entram sem pasto e sem vacinas), então quem já usou o app não perde dados. Há teste automatizado disso.
- **Rota `/lote?id=...` em vez de `/lotes/[id]`:** uma rota fixa pode ser guardada em cache e abrir offline para qualquer pasto.
- **Sem recarga automática ao voltar a internet:** por padrão o Serwist recarrega a página quando o sinal volta, o que
  faria o produtor perder um cadastro em andamento. Foi desligado (`reloadOnOnline: false`).
- **Login local provisório:** validado no aparelho para funcionar offline. Será substituído por autenticação real com o backend.

## Estrutura

```
src/
  app/
    (app)/            telas protegidas: inicio, rebanho, lotes, lote, vacinas, mais
    login/            tela de login
    sw.ts             service worker
    manifest.ts       manifesto do PWA (nome, cores, ícones)
  components/
    animals/          cartão, formulário (com pasto e vacinas), detalhes e confirmação de exclusão
    lotes/            cartão do pasto, rotinas (remédio/sal), tarefas, observações e mover animais
    layout/           barra inferior, aviso offline, cabeçalho de página
    ui/               painel (bottom sheet), selo de status, logo
  contexts/           autenticação
  lib/                banco local, regras de animais e pastos, datas das rotinas, hooks, utilitários e testes
```

## Roadmap

- [x] Base mobile + PWA com a identidade visual do Cownter
- [x] Banco local, cadastro / edição / exclusão de animais offline
- [x] Pastos: rodízio, reserva para descanso, nível do pasto, remédio, sal, tarefas e observações
- [x] Pasto e vacinas já aplicadas no cadastro do animal
- [ ] Vacinações (calendário, próximos vencimentos, vacinação em lote)
- [ ] Natalidade e morte, compra e venda, estoque sanitário
- [ ] Backend, login real e fila de sincronização (tratamento de conflitos)
- [ ] Assinatura mensal com licença que funciona offline (prazo de tolerância)
- [ ] Notificações no aparelho (APK com Capacitor)
- [ ] Localização do lote com GPS (e mapa offline, se der tempo)
- [ ] Empacotar como APK com Capacitor (Android Studio)
- [ ] Teste de campo com produtores da região
