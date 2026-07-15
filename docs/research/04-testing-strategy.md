# Estratégia de testes

## Estado observado

Há 46 testes unitários/de integração leve distribuídos principalmente entre compiler, Playwright com bindings fake, CLI, timeline, preview, Remotion e Studio. Não há suíte end-to-end com browser real, render visual versionado, contract tests de JSON, nem type tests dedicados. O teste da CLI mocka `renderDemoVideo`, portanto não detecta corrupção de MP4 ou atomicidade (`packages/cli/src/index.test.ts:9-14`, `211-256`).

## Pirâmide recomendada

### Unitários — rápidos, maioria

- canonicalização e hash determinístico;
- slug, timestamp, short ID, collision retry;
- transições de metadata e escrita atômica;
- parser de flags e validação numérica;
- normalize/validate de cada step;
- timeline em limites de frame;
- câmera e overlays em várias dimensões;
- redaction de metadata/log.

### Contrato — todo PR

- fixtures válidas e inválidas por versão de schema;
- round trip `parse -> normalize -> serialize -> parse`;
- catálogo de diagnostics: todo código emitido existe;
- readers atuais abrem artefatos da versão anterior;
- JSON Schema gerado corresponde ao parser Zod.

### Integração — todo PR, sem browser quando possível

- CLI render mockado verifica layout, metadata e compatibilidade de output explícito;
- artifact lifecycle com filesystem temporário real;
- runner com Playwright bindings fake verifica cleanup e estados;
- Studio queue verifica success/failure/cancel e metadata;
- rotas de filesystem rejeitam traversal.

### E2E — merge/main e release

Aplicação fixture local determinística:

1. iniciar servidor em porta dinâmica;
2. compilar demo;
3. capturar Chromium real;
4. resolver timeline;
5. renderizar vídeo curto;
6. validar metadata, duração/codec com `ffprobe` e presença de frames;
7. cancelar um segundo render e verificar cleanup;
8. executar duas renderizações concorrentes e verificar isolamento.

### Visual — main/release

- frames sentinela por scene/transition, não vídeo inteiro;
- SSIM/perceptual diff com threshold documentado;
- matriz 1920x1080, 1440x900 e 1080x1920;
- baseline versionada somente para fixture própria, sem dados reais;
- relatório HTML com expected/actual/diff.

### Type tests

- target ID inválido deve falhar em compile time;
- unions de step exigem payload correto;
- custom visual registry preserva props;
- exports `client` não trazem módulos Node;
- exemplos públicos compilam com a versão publicada.

## Casos essenciais para artefatos

| Caso | Evidência |
| --- | --- |
| dois renders no mesmo ms | diretórios diferentes |
| ID hostil (`../A B`) | slug contido na raiz |
| erro do renderer | metadata `failed`, sem `video.mp4` |
| cancelamento | metadata `cancelled`, temp removido |
| crash antes de promoção | somente temp + metadata não completed |
| `--output-file` | path exato e chamada legada |
| metadata write interrompida | JSON anterior permanece válido |
| jobs Studio | outputPath aponta para `video.mp4` gerenciado |

## Gates

### Pull request

```text
lint -> typecheck -> unit + contract + integration -> build
```

### Main

Adicionar E2E Chromium real e visual sentinela.

### Release

Instalar tarballs empacotados em fixture vazia, rodar smoke CLI, verificar exports ESM e gerar SBOM/checksum.

## Anti-flakiness

- clocks e random source injetáveis em unit tests;
- porta dinâmica e healthcheck, nunca sleep fixo;
- timezone/locale/storage state explícitos;
- thresholds visuais separados por plataforma ou container único;
- retries somente no nível de infraestrutura, registrando todas as tentativas;
- artefatos de falha sempre publicados.

## Critério de cobertura

Não perseguir percentual global isolado. Exigir 100% de branches nas state machines de artifact/cancelamento, todos os variants dos schemas e pelo menos um E2E por caminho público principal.

## Cobertura do erro de enqueue do Studio

O helper que preserva `error` e a primeira issue path-aware da resposta HTTP é
testado diretamente. O wiring `StudioProvider -> renderError -> RenderPanel`
foi inspecionado, formatado e coberto por typecheck; esta rodada não adiciona um
harness React novo apenas para reproduzir essa ligação simples.
