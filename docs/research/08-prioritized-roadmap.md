# Roadmap priorizado

## Princípios

- Corrigir confiança antes de adicionar automação.
- Manter compatibilidade de DSL, CLI flags e renderer público.
- Cada fase termina em um artefato verificável e pode ser revertida isoladamente.
- Não implementar cache, remoto ou plugins antes de identidade e schemas.

## P0 — confiança no output

### Fase 0A: histórico de render

- IDs criptograficamente aleatórios e paths únicos.
- Diretório por render, metadata básica e promoção atômica.
- CLI default e Studio no mesmo protocolo.
- Compatibilidade de `--output-file`.
- Testes de sucesso, falha, cancelamento e colisão.

**Status:** escopo da implementação inicial deste estudo.

### Fase 0B: identidade estrutural

- canonicalização documentada;
- `definitionHash` separado de `demoId`;
- `captureHash` versionado separado da identidade autoral;
- persistência em manifest/timeline/render metadata;
- staleness do Studio baseado em hash;
- migration para artefato sem hash.

**Gate:** fixtures provam estabilidade e mudança do hash para cada campo estrutural.

**Status:** implementado de forma compatível; novos IRs propagam os hashes para
captura, timeline e metadata de render. Artefatos sem `captureHash` continuam
legíveis, mas o Studio classifica sua compatibilidade como desconhecida e pede
uma recaptura antes de re-resolver.

## P1 — boundaries confiáveis

### Fase 1A: schemas completos

- Zod + JSON Schema para IR, manifest, timeline e metadata;
- parsers com diagnostics por path;
- limites de tamanho/contagem;
- contract fixtures de versão anterior.

**Status:** runtime entregue parcialmente em 2026-07-15. `@democraft/schema`
agora publica schemas Zod e parsers v1 para `DemoIR`, manifest, timeline,
metadata de render e `StudioMeta`. CLI e Studio validam seus boundaries JSON;
versões desconhecidas e hashes prefixados inválidos falham com erro estável e
path-aware, enquanto campos opcionais legados continuam aceitos. Fixtures de
contrato, round trip e bloqueio do renderer/preview cobrem a migração. Restam a
publicação dos JSON Schemas e limites de tamanho/contagem definidos a partir de
fixtures reais, evitando introduzir thresholds arbitrários nesta etapa.

**Correções de contrato:** schemas base preservam extensões aninhadas; o
compilador diagnostica IDs vazios e targets sem locator; fps e flags numéricas
são rejeitados antes de produzir output; requests de render do Studio têm
schema e resposta 400 estruturada; metadata de render valida estados terminais
e ranges, inclusive no writer. `/api/data` expõe violações persistidas como 422
estruturado.

**Hardening posterior concluído:** rotas JSON mutáveis limitam o stream a 64 KiB
antes do parse; paths usam containment canônico/`realpath`; e a compilação do
Studio isola o grafo ESM transitivo. A validação dos eventos SSE no cliente
permanece como robustez P2.

### Fase 1B: lifecycle de captura

- run ID e diretório por captura;
- metadata/state machine;
- atomic manifest/trace finalization;
- AbortSignal e cleanup;
- Studio resolve `latest completed` explicitamente.

**Status:** implementado em 2026-07-15. O default cria uma execução única por
captura com metadata v1 e promoção atômica do manifest. Falhas de launch e
cancelamentos ficam terminais sem atualizar `latest.json`; CLI e Studio usam o
último `completed`, com fallback legado conservador. `outputDir` explícito e o
retorno público de `runDemo()` foram preservados.

**Hardening corretivo:** namespaces incluem digest estável do ID original;
pointer é reparável por scan validado; output explícito tem lock/lease; paths de
screenshot são canônicos e contidos; recapture é single-flight e promove uma
generation completa. Hardening por `realpath` contra symlinks continua na fase
1C, separado do containment lexical já aplicado.

### Fase 1C: hardening do Studio

**Implementada:** containment canônico de paths e roots gerenciadas; token de
sessão com Origin exata; bind/target loopback documentado e testado; histórico
terminal reconstruído do filesystem, com identidade estável, cache
single-flight e memória limitada durante a seleção dos candidatos mais recentes.

**Resíduo P2:** a reconstrução precisa enumerar os diretórios para garantir
recência quando a ordem do filesystem é arbitrária. O materializador inicial da
CLI agora promove manifest, timeline, metadata e mídia como uma única geração;
a escrita live de `timeline.json` usa promoção atômica contida.

### Resíduos de identidade/reload

**Implementados:** `captureHash` continua representando apenas a definição e um
`captureEnvironmentHash` separado identifica viewport/DPR, locale, timezone,
settle, timeout, digest do storage state e runtime Node/plataforma/engine. A
ausência desse novo hash mantém artefatos legados legíveis, mas com
compatibilidade `unknown` quando comparados a uma captura nova.

O Studio agora compila a definição em um processo filho curto. Cada operação de
staleness, re-resolve ou recapture recebe um grafo ESM novo, inclusive para
imports transitivos, e retorna ao processo longo apenas IR + diagnostics
validados.

## P2 — operação e DX

- parser CLI estrito e config efetiva;
- `doctor`, `validate-artifact`, `--dry-run`;
- logs JSONL e timings por estágio;
- `runs list/open/remove/prune`;
- integração real Chromium + vídeo curto no CI;
- frames visuais sentinela;
- reload confiável do grafo ESM transitivo no Studio;
- alinhar documentação com comportamento.

## P3 — expansão controlada

- Authoring IR JSON para agentes;
- cache por hashes de estágio;
- compare de render/timeline;
- presets portáveis;
- múltiplos aspect ratios suportados;
- adapter remoto somente após um caso real.

## Sequência e dependências

```text
render history
  -> complete schemas
  -> definition hash
  -> capture history
  -> Studio history/security
  -> doctor/retention/compare
  -> cache/remote
```

Schemas podem começar em paralelo com o design do hash, mas o hash só deve ser persistido depois que o envelope de artefato estiver versionado.

## Riscos de rollout

| Mudança | Risco | Mitigação |
| --- | --- | --- |
| novo default de output | scripts procuram path antigo | stdout claro; `--output-file` legado |
| definition hash | falsos stale | fixtures canônicas e campo opcional |
| schemas strict | rejeitar artefato legado | compat mode + migrations |
| capture history | scripts procuram pasta fixa | resolver `latest completed`; fallback legado; output explícito intacto |
| path hardening | UI usa path explícito | migrar para job ID antes de bloquear |

## Critério de “pronto para 1.0”

- nenhum fluxo normal sobrescreve artefato sem opção explícita;
- staleness usa identidade estrutural;
- todos os artefatos públicos têm parser e migration;
- capture/render têm estado terminal e cancelamento testado;
- um E2E empacotado roda em ambiente limpo;
- segurança local e classificação de dados estão documentadas.
