# Estado atual e diagnóstico

## Método

Esta análise leu o código-fonte do monorepo, testes, configurações, documentos de arquitetura e o exemplo local ignorado. O baseline executou build, lint, typecheck e testes. As marcações abaixo distinguem:

- **Observado:** comprovado pelo repositório ou por comando local.
- **Hipótese:** consequência provável que precisa de teste de runtime.
- **Recomendação:** mudança proposta, não comportamento existente.

Severidade: P0 bloqueia confiança no resultado; P1 causa falhas ou dados errados em fluxos normais; P2 prejudica operação/manutenção; P3 é melhoria incremental.

## Inventário do pipeline

| Estágio | Pacote | Responsabilidade atual | Estado |
| --- | --- | --- | --- |
| autoria | `@democraft/core` | DSL, targets e definição de demo | pequeno e legível |
| contrato | `@democraft/schema` | tipos compartilhados e schemas parciais | cobertura runtime insuficiente |
| compilação | `@democraft/compiler` | captura da DSL, normalização, IR e diagnostics | determinístico, identidade autoral e de captura versionadas |
| captura | `@democraft/playwright` | browser, steps, screenshots, vídeo e trace | funcional, lifecycle frágil |
| tempo | `@democraft/timeline` | IR + manifest para tracks em frames | boa separação de tempo real/apresentação |
| preview | `@democraft/preview` | HTML autocontido | útil para diagnóstico rápido |
| vídeo | `@democraft/remotion` | composição e render H.264 | boa base, output direto |
| orquestração | `@democraft/cli` | comandos do pipeline | UX fragmentada, parsing permissivo |
| edição | `@democraft/studio` | preview, overrides, recapture e fila | produtivo, estado efêmero |

## Achados prioritários

### P0 — identidade de conteúdo inexistente (resolvido)

**Observado.** O compilador atribui `ir.id: definition.id`; não há canonicalização nem hash (`packages/compiler/src/compile.ts:54-63`). A CLI e a captura usam esse ID nos caminhos (`packages/playwright/src/runner.ts:32-33`). Partes do Studio comparam esse valor para decidir staleness, e a documentação o descreve como content hash.

**Impacto.** Alterar steps, targets ou source mantendo o ID pode fazer uma captura antiga parecer atual. Isso contamina preview, timeline e render sem erro explícito.

**Risco.** Alto: resultado visual incorreto com aparência de sucesso.

**Recomendação.** Separar `demoId` humano de `definitionHash` calculado sobre IR canônica. Nunca reaproveitar `id` existente para o hash; isso seria breaking. Persistir ambos em manifest, timeline e metadata, com fallback para artefatos legados.

**Status pós-implementação.** `definitionHash` identifica a definição autoral e
`captureHash` decide compatibilidade de screenshots. Ambos são propagados por
IR, manifest, timeline, metadata do Studio e render gerenciado. Artefatos
legados sem hash são legíveis, porém têm compatibilidade desconhecida e não são
reutilizados silenciosamente.

### P0 — render padrão sobrescreve histórico (resolvido)

**Observado.** A CLI usa `.democraft/renders/${timeline.demoId}.mp4` quando `--output-file` não é informado (`packages/cli/src/run.ts:149-172`). O renderer grava diretamente no destino (`packages/remotion/src/server.ts:91-104`).

**Impacto.** Uma execução bem-sucedida ou parcial substitui a anterior; não há rastreabilidade, rollback ou comparação.

**Risco.** Alto para uso iterativo e CI concorrente.

**Recomendação.** Diretório único por execução e promoção atômica de um arquivo temporário. Manter `--output-file` com semântica legada.

**Status pós-implementação.** CLI sem `--output-file` e fila do Studio usam um
diretório único por tentativa, metadata terminal e promoção do MP4 temporário
apenas no sucesso. Falha e cancelamento preservam estado terminal; output
explícito mantém a semântica anterior.

### P1 — JSON externo não é validado

**Observado.** CLI faz cast de `JSON.parse` para manifest/timeline (`packages/cli/src/run.ts:92-97`, `143-148`, `229-231`). Os schemas Zod só cobrem locator, target e diagnostic (`packages/schema/src/schemas.ts:5-37`).

**Impacto.** Erros aparecem longe da entrada, com mensagens do renderer ou acesso a propriedade indefinida.

**Recomendação.** Schemas versionados para DemoIR, RecordedDemoManifest e RenderTimeline; `safeParse` com path e diagnostic code estável.

### P1 — captura não possui estado terminal confiável

**Observado.** trace é parado apenas no caminho normal (`packages/playwright/src/runner.ts:68-93`); manifest é escrito diretamente após fechar o contexto (`:96-124`). Não há metadata de `running/failed/cancelled`, escrita atômica ou `AbortSignal`.

**Impacto.** Interrupções podem deixar diretório ambíguo e sem explicação durável.

**Recomendação.** State machine persistida, cleanup idempotente e manifest temporário promovido por rename.

### P1 — execução de steps tende a sucesso parcial silencioso

**Observado.** O runner acumula diagnostics e continua os loops (`packages/playwright/src/runner.ts:71-88`). A API retorna apenas o manifest; quem chama precisa inferir falha por diagnostics.

**Impacto.** Assertions e resolução de targets podem falhar sem status terminal de captura.

**Recomendação.** Política explícita `failureMode: "fail-fast" | "collect"`, default compatível inicialmente, mais status derivado no metadata.

### P1 — códigos de diagnostic divergentes

**Observado.** A tabela pública define `DC001..DC105` (`packages/schema/src/diagnostics.ts:1-9`), enquanto caminhos de normalização/runtime usam variantes `MD...` em partes do código e docs.

**Impacto.** Automação e suporte não podem depender de um namespace estável.

**Recomendação.** Teste de contrato que rejeite códigos fora do catálogo; alias de leitura para artefatos antigos.

### P1 — trust boundary do Studio aberta demais

**Observado.** `/api/open-folder?path=` aceita um caminho arbitrário existente e o entrega ao shell do sistema (`packages/studio/app/api/open-folder/route.ts:14-50`), apesar do comentário dizer “under the renders dir”.

**Impacto.** Um origin capaz de alcançar o Studio local pode induzir abertura/revelação de arquivos fora do workspace.

**Recomendação.** Resolver somente job IDs ou validar `path.relative` contra a raiz permitida; bind em loopback e token anti-CSRF para mutações.

### P2 — parser CLI permissivo

**Observado.** Flags desconhecidas são ignoradas, valores ausentes viram `undefined`/`NaN` (`packages/cli/src/args.ts:14-53`).

**Impacto.** Typos mudam comportamento silenciosamente.

**Recomendação.** Parser declarativo com erros antes de I/O; preservar nomes e defaults existentes.

### P2 — lint inclui output gerado

**Observado.** `.gitignore` ignora `.next` (`.gitignore:8-10`), mas a configuração ESLint não (`eslint.config.mjs:8-14`). Após o build, `pnpm lint` analisou `apps/docs/.next` e falhou com milhares de erros gerados.

**Impacto.** O gate depende da ordem dos comandos e produz ruído.

**Recomendação.** Espelhar diretórios gerados no ignore do ESLint.

### P2 — fila do Studio é efêmera

**Observado.** Jobs existem em `Map` na memória (`packages/studio/lib/render-queue.ts:41-48`) e o próprio comentário declara ausência de persistência (`:1-8`).

**Impacto.** Reiniciar Studio perde histórico e associação entre UI e arquivos.

**Recomendação.** Reconstruir a listagem lendo metadata dos diretórios; a fila ativa pode continuar em memória.

### P2 — dimensões visuais parcialmente fixas

**Observado.** A composição aceita width/height, mas cálculos de câmera/callout ainda carregam coordenadas de referência fixas em módulos visuais.

**Hipótese.** Formatos verticais e capturas não padrão podem enquadrar incorretamente.

**Recomendação.** Testes matriciais 16:9, 4:3 e 9:16 antes de prometer formatos adaptativos.

## Pontos fortes a preservar

- DSL não depende de Playwright nem Remotion.
- IR e timeline são serializáveis e inspecionáveis.
- Timeline usa pacing planejado em vez de ruído da latência real.
- `@democraft/remotion/server` já separa dependências Node do consumo client.
- Studio serializa renders e já suporta progresso/cancelamento.
- `storageState`, locale, timezone, viewport e settle tornam captura reproduzível.

## Baseline de qualidade

**Observado em 2026-07-14:** build, typecheck e 46 testes existentes concluíram com sucesso, porém via cache do Turborepo. O lint falhou após build por atravessar `.next`. A verificação final deste trabalho deve ser forçada e registrada depois das mudanças; cache não é evidência suficiente para conclusão.

## Conclusão

O produto está em condição de evoluir incrementalmente. O núcleo correto é tornar identidade, artefatos e validação explícitos; uma reescrita do pipeline criaria risco sem resolver melhor esses problemas.
