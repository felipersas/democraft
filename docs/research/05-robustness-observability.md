# Robustez e observabilidade

## Modelo de execução

Capture e render devem compartilhar um envelope, sem compartilhar implementação:

```ts
type ExecutionState =
  | "created"
  | "preparing"
  | "running"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";
```

Cada transição grava `updatedAt`, estágio, tentativa e diagnostic opcional. Estados terminais não voltam a executar.

## Falhas observadas e status

- Manifest da captura era gravado diretamente; a P1B passou a usar temp + rename.
- O trace parava somente no caminho normal; a P1B agora finaliza trace, context e browser em sucesso, falha e cancelamento.
- Renderer escreve no output final (`packages/remotion/src/server.ts:91-104`).
- Studio cancela via `CancelSignal`, mas classifica cancelamento por closure local (`packages/studio/lib/render-queue.ts:197-205`).
- A fila desaparece no restart (`packages/studio/lib/render-queue.ts:1-8`, `41-48`).

## Política de erros

Erros devem preservar:

- `code` estável;
- estágio (`compile`, `browser.launch`, `target.resolve`, `render.bundle`, `render.encode`, `artifact.promote`);
- mensagem original;
- causa serializada de forma segura;
- retryable boolean;
- scene/step/target quando aplicável;
- stack somente em log local/debug, não em JSON exportável por default.

Não substituir exceção concreta por “Render failed.” quando existe mensagem original.

## Cancelamento

API alvo:

```ts
capture(ir, {signal: AbortSignal});
render(input, {signal: AbortSignal});
```

Adapters convertem `AbortSignal` para Playwright/Remotion. Ordem de cleanup: impedir novos steps/frames, encerrar trace, fechar page/context/browser, remover temporários, persistir `cancelled`. Cleanup deve tolerar chamadas repetidas.

Na captura, `RunDemoOptions.signal` já é cooperativo: é verificado antes de
qualquer side effect, antes das fronteiras Playwright e entre steps. Uma chamada
Playwright já em curso não é interrompida à força; ela termina antes do aborto,
evitando fechar context no meio de uma operação não preparada para isso.
Somente aborto solicitado pelo `signal` ou criado internamente pelo lifecycle é
classificado como `cancelled`; uma exceção externa chamada `AbortError` continua
`failed`. Falha e cancelamento a partir de `created` recebem `startedAt` para
manter o contrato temporal válido.

Re-capture no Studio é single-flight e responde `409` à segunda requisição. A
materialização é preparada em uma generation irmã e promovida por rename, com
rollback da geração anterior quando a promoção falha, evitando misturar
screenshots e JSONs de capturas diferentes.

Mensagens persistidas ou publicadas pela API/SSE removem credenciais em userinfo
de URL e parâmetros sensíveis como token, code, key, secret, password, auth e
signature, preservando a etapa e a causa operacional restante.

## Retry

Retry apenas para operações classificadas:

- browser launch e navegação por erro transitório;
- resolução de target somente se a política permitir espera;
- bundle/encode não deve reiniciar automaticamente sem registrar tentativa;
- validation, assertion e schema error nunca são retryable.

Backoff com jitter e budget total. Cada tentativa aparece no log, não como uma única duração opaca.

## Logs estruturados

Formato JSONL opcional:

```json
{"ts":"...","level":"info","runId":"...","stage":"render.encode","event":"progress","progress":0.42}
```

Campos comuns: `runId`, `demoId`, `definitionHash`, `captureHash`, `stage`, `event`, `durationMs`, `diagnosticCode`. Redigir headers, cookies, storage state, query secrets e paths quando exportando.

## Progresso e métricas

Separar duração de:

- load/compile;
- browser launch;
- cada scene/step e settle;
- bundle;
- select composition;
- render frames;
- mux;
- artifact promotion.

O callback do Remotion já fornece progresso (`packages/remotion/src/server.ts:41-50`, `101-103`); falta persistir resumo e expor estágio consistente na CLI.

## Hooks

Hooks mínimos, assíncronos e isolados:

```ts
onExecutionStart(meta)
onStageChange(stage)
onDiagnostic(diagnostic)
onExecutionEnd(result)
```

Falha de hook não deve corromper o render; registrar diagnostic próprio. Webhooks/remotes ficam fora do core.

## `democraft doctor`

Verificações propostas:

- Node/pnpm/Remotion/Chromium/ffmpeg disponíveis e versões;
- escrita e rename atômico na raiz `.democraft`;
- espaço livre aproximado;
- demo module importável;
- manifest/timeline parseáveis e compatíveis;
- recording/screenshots referenciados existem;
- entry Remotion resolvível;
- jobs `running` órfãos;
- `.democraft` e `.env` ignorados pelo Git.

Saída humana e `--json`; nenhum check deve ler ou imprimir conteúdo de segredo.

## Sinais de processo

CLI deve registrar SIGINT/SIGTERM somente enquanto há operação ativa, abortar, aguardar cleanup com timeout e restaurar handlers. Segundo sinal pode forçar saída. Bibliotecas não instalam handlers globais.
