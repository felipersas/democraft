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

## Falhas observadas

- Manifest da captura é gravado diretamente (`packages/playwright/src/runner.ts:121-124`).
- O trace só para no caminho normal (`packages/playwright/src/runner.ts:68-93`).
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
