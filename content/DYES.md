# Corantes extras: direção visual e integração

Os 22 corantes são ícones nativos 16×16. Nesta revisão, os 21 corantes extras
(exceto Âmbar) foram refinados como montes de pigmento no estilo vanilla:
contornos coloridos, grãos claros conectados, luz superior esquerda e sombra
curta na parte inferior. As antigas fendas quase pretas foram removidas.
Cada cor conserva um desenho próprio; não se usa um único molde recolorido.

## Camadas e originais protegidos

O pigmento é uma camada transparente independente, armazenada em
`tools/generated/dye-layers/<cor>_pigment.png`. A composição final usa a placa
do criador, `RP/textures/items/dyes/wooden_base.png`, abaixo do pigmento, sem
redesenhá-la, redimensioná-la ou alterar seus pixels. A camada de pigmento não
contém cores da madeira.

A placa toca intencionalmente as bordas laterais e inferior do canvas.
A margem de um pixel se aplica ao pigmento, não à composição completa.

Arquivos preservados byte a byte nesta revisão, SHA-256:

- Placa: `71f54548123dd34c6c4bd88fc7801f849a9c4b19affd0e2a94691dc349de2c80`.
- Âmbar atual do criador: `560ef9f0f7abe56d0cfd93ad1e02925b4e3a671e23b7a1121d88c6267c4c438d`.

O Âmbar é referência de estilo e fica explicitamente protegido no gerador.
Os PNGs anteriores a este refinamento estão em
`tools/references/dye-vanilla-before`, com seus hashes originais.

## Referências vanilla

Foram inspecionadas as 15 texturas oficiais mostradas pelo criador, incluindo
`dye_powder_blue_new.png`, `brown_new`, `red`, `purple` e `white_new`.
As fontes são do repositório
[Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples/tree/46ba6ea985fb5a92d79a9419198f10dda14c199d/resource_pack/textures/items),
commit `46ba6ea985fb5a92d79a9419198f10dda14c199d`.

As cópias originais e o manifesto com URLs e hashes estão em
`tools/references/mojang/vanilla-dyes`. A folha de referências é
`tools/generated/dyes-vanilla-references.png`. São referências de tratamento
dos grãos, contraste e volume; as silhuetas novas não foram traçadas delas.

## Regeneração

`content/dye-art.json` contém as silhuetas, os grãos e as paletas próprias de
cada desenho. A skill Dorios Pixel Art rasteriza esses planos e registra as
correções `artistic_patch` em `tools/generated/dyes`. O addon não depende
da skill para funcionar.

```powershell
npm run content:dyes:apply
npm run content:dyes:check
python tools/preview-dye-layers.py
python tools/preview-dye-vanilla.py
```

Para limitar a regeneração, use
`python tools/generate-dye-textures.py --write --only indigo navy wine`.
O gerador preserva edições manuais detectadas pelos digests dos pixels; as
prévias mostram os PNGs reais. `--snapshot` do comparador só deve ser usado
uma vez, antes do refinamento; ele recusa sobrescrever o registro existente.

## Inspeção desta versão

Status: model_reviewed. Avaliador: Codex. Aprovação humana desta revisão:
não registrada. Foram inspecionados os PNGs nativos, as ampliações nos fundos
claro/escuro, a comparação antes/depois e as referências vanilla. O novo
tratamento remove as fendas escuras e mantém grãos legíveis nos pigmentos
escuros; as cores claras têm reflexos contidos, sem branco puro de brilho.
As 22 máscaras alpha continuam distintas.

Digests SHA-256 dos pixels RGBA decodificados, em ordem de linhas:

- `tools/generated/dyes-preview.png`, 1440×832:
  `76798f3cee37f27d555c1b994a5724e4fb5d15b5a953525dcf55a6ff88de1404`.
- `tools/generated/dyes-vanilla-comparison.png`, 960×600:
  `52fc7ed08747cf8278e35652278a10ebbb874a7545df3e2dfecd5679152f723a`.
- `tools/generated/dyes-layers-preview.png`, 960×208:
  `4881fc5c74bb60ca3f06c67a9b64dcdd2491ef87bd87e5b6956352d4a8abf25f`.

Esta revisão visual vale apenas para esses pixels. O perfil técnico `item`
encontrou zero erros nos 21 PNGs e um aviso `isolated_pixels` por imagem.
São grãos/diagonais e pixels de madeira herdados da referência; os avisos
permanecem nos relatórios `tools/generated/dye-vanilla-validation`.
Relatórios antigos continuam vinculados às versões anteriores.

## Integração existente

Os IDs seguem `dorios_atelier:<cor>_dye`, com pilhas de 64, atlas de itens,
grupo próprio de corantes na aba Natureza e traduções nos cinco idiomas do pack. Misturar dois
corantes vanilla produz dois corantes extras; um corante extra tinge oito
concretos brancos. As receitas e os blocos não foram alterados neste refinamento.

O grupo `dorios_atelier:itemGroup.name.dyes` chama-se Dyes / Corantes / Tintes.
A ordem de `content/dye-catalog.json` segue as duas fotos do criador, sem repetir
Chartreuse na junção: Areia, Pêssego, Coral, Escarlate, Vinho, Rosa Intenso,
Bordô, Roxo Empoeirado, Lavanda, Slate, Índigo, Navy, Aqua, Teal, Menta,
Esmeralda, Floresta, Chartreuse, Oliva, Marfim, Âmbar e Cobre.
O ícone do grupo é o corante Areia. A ordem dos concretos não é modificada.

Esses itens não ampliam automaticamente as cores nativas de ovelhas, armaduras,
camas ou outros objetos. Os testes de integração e as verificações dos PNGs
não substituem a avaliação da aparência dentro do Bedrock.
