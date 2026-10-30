# Concretos coloridos

22 cores: 14 dos painéis do Ascendant Technology e 8 escolhidas para ampliar
o espectro. Cada cor possui bloco inteiro, laje, escada, laje vertical e muro:
110 blocos no total.
São materiais comuns de pedra, inclusive Cobre: picareta de madeira ou superior,
sem oxidação, gravidade ou comportamento metálico. Os blocos inteiros conduzem
redstone e as formas parciais herdam BlocksWithTraits, como as demais pedras.

As texturas opacas 16×16 preservam o granulado original do concreto branco da
[Mojang](https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/resource_pack/textures/blocks/concrete_white.png).
O tom mais frequente corresponde exatamente ao HEX escolhido. Não há bordas de UI
nas texturas. A referência imutável e seu hash ficam em `tools/references/mojang`.
Paletas, corantes e intenção visual ficam em `content/concrete-colors.json`.

## Obtenção

Primeiro misture **1 de cada corante vanilla listado abaixo** para obter
**2 corantes extras da cor correspondente**. Depois, na bancada, combine
**8 concretos brancos + 1 corante extra** para obter **8 concretos da nova cor**.
Os novos corantes aparecem no grupo vanilla de corantes, na categoria Natureza.

| Cor | HEX | Corantes vanilla para a mistura |
| --- | --- | --- |
| Cobre | #AD7655 | Laranja + marrom |
| Âmbar | #C79A42 | Amarelo + laranja |
| Areia | #CBB89A | Marrom + branco |
| Bordô | #713A50 | Vermelho + roxo |
| Lavanda | #B8A7D1 | Roxo + branco |
| Roxo Empoeirado | #806079 | Cinza + roxo |
| Oliva | #7A8052 | Verde + amarelo |
| Floresta | #3E6A50 | Verde + preto |
| Menta | #9FD3B9 | Verde-limão + branco |
| Índigo | #4C5389 | Azul + roxo |
| Slate | #687A8A | Cinza + ciano |
| Navy | #2D4265 | Azul + preto |
| Teal | #3B8381 | Ciano + verde |
| Aqua | #ADDEF1 | Azul-claro + branco |
| Escarlate | #C6443E | Vermelho + laranja |
| Coral | #DA796C | Vermelho + rosa |
| Pêssego | #E6B091 | Laranja + branco |
| Marfim | #E9DCA6 | Amarelo + branco |
| Chartreuse | #C7D85C | Verde-limão + amarelo |
| Esmeralda | #2FAD72 | Verde + verde-limão |
| Vinho | #7F2437 | Vermelho + marrom |
| Rosa Intenso | #BA4D73 | Vermelho + magenta |

As 8 adições priorizam os tons quentes da paleta apresentada:
Escarlate/Coral/Pêssego ampliam os vermelhos e laranjas; Marfim acrescenta amarelo
pálido; Chartreuse e Esmeralda completam os verdes; Vinho acrescenta um vermelho
profundo e mais quente que o Bordô existente; Rosa Intenso completa os rosas.
Cobalto, Pervinca, Violeta e Turquesa foram retirados; Malva foi substituído por
Vinho. São escolhas visuais locais,
identificadas como `spectrum_expansion` na configuração, sem recolorir as 14
texturas originais.

No cortador de pedras, cada bloco gera 2 lajes, 2 lajes verticais, 1 escada ou
1 muro. A conversão inversa exige 2 lajes ou 2 lajes verticais, ou 1 escada/muro,
e devolve 1 bloco da mesma cor. O martelo de móveis já reconhece esses sufixos.
Os 110 concretos e suas formas aparecem juntos no grupo próprio do inventário
criativo: Concrete (Extra) em inglês, Concreto (Extra) em pt_BR/es_MX,
Betão (Extra) em pt_PT e Hormigón (Extra) em es_ES.

## Geração e verificação

Com Node >=22, Python e Pillow disponíveis:

```powershell
npm run content:concretes:apply
npm run content:concretes:check
npm run content:dyes:check
npm test
```

A geração é local e repetível; a referência está fixada por commit e SHA-256.
`tools/generated/concrete-preview.png` apresenta as 22 cores em tamanho nativo,
ampliadas por nearest-neighbor e repetidas para inspeção de continuidade.
`tools/generated/concrete-expansion-preview.png` mostra apenas as 8 adições.
`tools/generated/dyes-preview.png` mostra os 22 corantes em fundos claro e escuro,
em escala nativa e ampliada. `tools/generated/dyes-silhouettes.png` permite
comparar suas formas sem a cor. Os desenhos individuais estão em
`content/dye-art.json`; consulte `content/DYES.md` para a direção visual.

A geração das novas texturas de itens usa o renderizador da skill
`dorios-pixel-art-skill` instalada em `.codex/skills` no perfil do usuário.
O script aceita `--skill <caminho>` para outra instalação. A verificação `--check`
das texturas existentes depende apenas de Python/Pillow.

As cores removidas ficam registradas em `retiredColors` para impedir registros
ativos órfãos. Ao aplicar a geração, somente os arquivos exatos dessas famílias
são movidos para um backup recuperável em `builds/retired-concretes/<timestamp>`.

As traduções cobrem en_US, pt_BR, pt_PT, es_ES e es_MX. O prefixo dos IDs é
`dorios_atelier:<color>_concrete`, seguido de `_slab`, `_stairs`, `_vertical_slab`
ou `_wall` para as formas parciais.

A conferência estática não substitui o teste no Bedrock. No pacote de
desenvolvimento, verificar receitas, quebra e drops com picaretas, orientação e
cantos das escadas/lajes verticais, conexões dos muros e conversões com o martelo.
