# Pesquisa técnica do Democraft

Data da análise: 2026-07-14. Escopo: código-fonte, testes, configuração, documentação e artefatos ignorados do monorepo. Segredos locais não foram lidos.

## Resumo executivo

O projeto já possui um pipeline coerente — DSL tipada, compilação para IR, captura com Playwright, timeline determinística, preview e render Remotion — e uma separação de pacotes melhor que a média para um produto neste estágio. O maior risco não é falta de arquitetura: é a diferença entre contratos declarados e comportamento real.

Os três problemas mais urgentes são:

1. **Identidade incorreta:** `DemoIR.id` é apenas o `definition.id`, embora Studio e documentação o tratem como hash de conteúdo. Uma alteração no roteiro pode reutilizar uma captura velha sem aviso.
2. **Artefatos destrutivos (corrigido):** renders e capturas gerenciados agora usam execuções versionadas e não sobrescrevem o resultado anterior; paths explícitos preservam o comportamento compatível.
3. **Fronteiras sem validação:** manifestos e timelines JSON entravam por `JSON.parse(...) as Type`; a fase P1A agora adiciona contratos Zod completos e migra os readers da CLI e do Studio.

As duas primeiras intervenções são deliberadamente incrementais: cada render sem `--output-file` ganha um ID único, diretório próprio, `video.mp4` e `metadata.json`; e novos artefatos separam `definitionHash` autoral, `captureHash` de compatibilidade e ID humano. O caminho explícito e a leitura de artefatos antigos continuam funcionando, mas capturas sem hash são tratadas conservadoramente como compatibilidade desconhecida. Gestão de retenção e comparação visual ficam em fases posteriores. O histórico de capturas foi entregue na P1B com metadata terminal e resolução explícita de `latest completed`.

## Mapa dos documentos

- [00-current-state.md](./00-current-state.md): inventário, estado atual e diagnóstico consolidado.
- [01-architecture-review.md](./01-architecture-review.md): arquitetura, dependências e limites recomendados.
- [02-api-redesign.md](./02-api-redesign.md): alternativas de API e contrato LLM-friendly.
- [03-render-artifacts.md](./03-render-artifacts.md): ciclo de vida de artefatos.
- [04-testing-strategy.md](./04-testing-strategy.md): pirâmide de testes e gates.
- [05-robustness-observability.md](./05-robustness-observability.md): estados, cancelamento e diagnóstico operacional.
- [06-feature-opportunities.md](./06-feature-opportunities.md): oportunidades classificadas por horizonte.
- [07-security-review.md](./07-security-review.md): trust boundaries, arquivos locais e hardening.
- [08-prioritized-roadmap.md](./08-prioritized-roadmap.md): prioridades P0–P3 e fases.
- [09-implementation-plan.md](./09-implementation-plan.md): plano executável e critérios de aceite.

## Decisão de curto prazo

Preservar as APIs públicas atuais. Corrigir primeiro a confiabilidade do output e criar uma trilha de metadados que permita evoluir para listagem, retenção, comparação e CI sem precisar renomear ou mover arquivos novamente.

## Progresso em 2026-07-15

Os contratos runtime v1 para `DemoIR`, manifest, timeline, metadata de render e
metadata do Studio estão publicados por `@democraft/schema`. Versões
desconhecidas e hashes malformados falham com `ArtifactValidationError` e paths
estruturados; campos opcionais legados continuam legíveis. CLI e Studio validam
os JSONs persistidos antes de preview, resolução ou render. Publicação de JSON
Schema e limites explícitos de tamanho/contagem permanecem como fechamento da
fase P1A.

A fase P1B também está implementada: a captura padrão usa
`.democraft/runs/<demo-slug>-<digest>/<timestamp>-<shortid>/`, grava metadata v1 e
manifest atomicamente, aceita `AbortSignal` cooperativo e atualiza
`latest.json` apenas depois de uma captura concluída. CLI e Studio resolvem o
último sucesso com fallback explícito para o layout legado; `--output-dir`
continua usando exatamente o diretório informado.
