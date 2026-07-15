# Ciclo de vida de artefatos de render

## Problema atual

A CLI escolhe um único arquivo por demo (`packages/cli/src/run.ts:149-172`). O Studio acrescenta `Date.now()` (`packages/studio/lib/render-queue.ts:172-177`), mas mantém somente job em memória (`:41-48`) e não grava metadata. Nenhum fluxo promove output atomicamente.

## Convenção recomendada

```text
.democraft/renders/
  <demo-slug>/
    <timestamp>-<shortid>/
      metadata.json
      video.mp4
      timeline.json          # fase 2
      manifest.json          # fase 2, cópia ou referência explícita
      render.log.jsonl       # fase 2
```

Exemplo de run ID: `checkout-2026-07-14T18-42-10-123Z-a1b2c3d4`. O nome do diretório pode omitir o slug porque ele já é o pai, mas `metadata.renderId` deve ser globalmente legível.

## Metadata v1

```json
{
  "schemaVersion": 1,
  "renderId": "checkout-2026-07-14T18-42-10-123Z-a1b2c3d4",
  "demoId": "checkout",
  "definitionHash": "definition-v1:sha256:3e8f...",
  "captureHash": "capture-v1:sha256:a92c...",
  "status": "completed",
  "createdAt": "2026-07-14T18:42:10.123Z",
  "startedAt": "2026-07-14T18:42:10.127Z",
  "finishedAt": "2026-07-14T18:43:02.004Z",
  "output": {"video": "video.mp4"},
  "render": {"fps": 60, "durationInFrames": 3120, "mediaMode": "screenshots"},
  "source": {"manifestPath": "...", "timelinePath": "..."}
}
```

Os hashes são opcionais para leitura de timelines e manifests antigos. Antes de
criar metadata, CLI e Studio rejeitam `demoId` divergente e `captureHash`
divergente quando ambos os lados o possuem. Ausência em um lado mantém leitura
legada; quando compatíveis, a timeline é a fonte preferida e o manifest é
fallback. `definitionHash` pode divergir quando a timeline contém apenas uma
edição apresentacional compatível com a captura.

Paths dentro do diretório devem ser relativos. Paths de origem podem ser absolutos para ferramenta local, mas precisam ser marcados como potencialmente sensíveis e removíveis em export/CI.

## State machine

```text
created -> rendering -> completed
                    -> failed
                    -> cancelled
```

Estados terminais são imutáveis. `metadata.json` é reescrito por arquivo temporário + rename. Vídeo é renderizado como `.video.<id>.tmp.mp4` e só renomeado para `video.mp4` após sucesso.

## Concorrência

- timestamp não é lock;
- short ID deve vir de `crypto.randomBytes`, não `Math.random`;
- criação do diretório usa `mkdir(..., {recursive: false})` e retry em `EEXIST`;
- cada execução escreve apenas no próprio diretório;
- aliases `latest` são atualizados depois do estado `completed` e nunca são fonte de verdade.

## Compatibilidade

- `--output-file X` continua produzindo exatamente X.
- ausência de `--output-file` ativa o artifact store gerenciado.
- `renderDemoVideo({outputFile})` continua público e inalterado.
- consumidores que procuram o caminho antigo devem usar o stdout ou um futuro `runs latest`; não criar cópia silenciosa que reintroduza overwrite.

## Operações futuras

| Operação | Semântica |
| --- | --- |
| `runs list` | lê metadata, ordena por `createdAt`, filtra demo/status |
| `runs latest` | último `completed`, não último diretório |
| `runs open` | resolve run ID sob a raiz e abre pasta |
| `runs remove` | valida raiz, remove uma execução, atualiza alias |
| `runs prune` | retenção por quantidade, idade e bytes; dry-run default |
| `runs compare` | compara metadata, timeline e frames selecionados |

## Retenção

Default inicial: não apagar automaticamente. Fase posterior pode oferecer `keepLast: 20`, `maxAgeDays: 30`, `maxBytes`, com pin por metadata. CI deve publicar artefato e remover workspace por política do runner, não por heurística local.

## Captura

Capturas hoje também reutilizam `.democraft/runs/<demoId>` (`packages/playwright/src/runner.ts:32-33`). Migrá-las exige atualizar Studio, staleness e resolução de assets em conjunto. Por isso fica fora da primeira mudança, mas deve adotar o mesmo envelope `runId/status/metadata` na fase seguinte.

## Critérios da primeira entrega

- dois renders padrão consecutivos produzem diretórios distintos;
- cada sucesso contém metadata `completed` e `video.mp4`;
- falha/cancelamento preserva metadata terminal e não expõe `video.mp4` final;
- output explícito permanece compatível;
- CLI e Studio compartilham a mesma criação e transição de artifact.
