# OPENCAESAR — ESPECIFICAÇÃO DO SISTEMA ALIMENTAR

## 1. Objetivo desta especificação

Implementar uma cadeia alimentar completa, visual, determinística e inspecionável.

O sistema deve permitir que o jogador:

1. produza diferentes tipos de alimento;
2. transporte fisicamente os alimentos;
3. armazene cargas em granários;
4. configure prioridades e limites de estoque;
5. abasteça mercados;
6. distribua alimentos pelas ruas;
7. mantenha estoques dentro das residências;
8. evolua habitações por meio de variedade alimentar;
9. importe ou exporte alimentos;
10. diagnostique gargalos por meio do HUD, overlays e telas de gestão.

A cadeia básica é:

```text
Fonte de alimento
→ produtor
→ carregador
→ granário
→ comprador do mercado
→ mercado
→ vendedora do mercado
→ residência
→ consumo doméstico
```

Para peixe:

```text
Área de pesca
→ barco pesqueiro
→ cais pesqueiro
→ carregador
→ granário
→ mercado
→ residência
```

Para alimentos importados:

```text
Comerciante
→ entreposto ou cais comercial
→ carregador
→ granário
→ mercado
→ residência
```

Nenhum alimento pode aparecer magicamente em um mercado, residência ou granário.

Todo alimento deve possuir:

* uma origem;
* uma quantidade;
* um proprietário atual;
* uma localização;
* um destino;
* um estado logístico;
* um histórico mínimo de movimentação.

---

# 2. Princípios de design

## 2.1 Mercadorias físicas

Alimentos devem existir como cargas movimentadas pelo mapa.

Uma fazenda não aumenta um número global de trigo. Ela cria uma carga de trigo em seu estoque de saída.

Essa carga precisa ser:

1. criada;
2. reservada;
3. associada a um carregador;
4. transportada;
5. recebida;
6. armazenada;
7. posteriormente retirada;
8. transportada novamente;
9. consumida.

## 2.2 Rede, e não raio mágico

A produção e distribuição dependem de:

* estrada;
* acesso à mão de obra;
* conectividade;
* distância;
* capacidade;
* disponibilidade de carregadores;
* ordens logísticas;
* prioridades.

Granários e mercados não puxam produtos de qualquer parte da cidade instantaneamente.

## 2.3 Problemas explicáveis

Qualquer edifício parado deve informar exatamente o motivo.

Exemplos:

* “Não há trabalhadores suficientes.”
* “A entrada do edifício não está ligada a uma estrada.”
* “A produção está pronta, mas nenhum granário aceita trigo.”
* “O granário mais próximo está cheio.”
* “A carga está reservada por outro transportador.”
* “O comprador do mercado não encontra vegetais dentro do alcance máximo.”
* “A vendedora não passou por esta residência há 38 dias.”
* “O mercado possui trigo, mas está sem trabalhadores para distribuí-lo.”
* “A residência consome mais alimento do que o mercado consegue fornecer.”
* “A fazenda está funcionando com apenas 43% da equipe.”

## 2.4 Interface orientada a causas

Nunca mostrar somente:

```text
Sem comida.
```

Mostrar:

```text
Esta residência está sem comida porque o seu estoque de trigo acabou há 4 dias.

O mercado responsável está a 18 segmentos de estrada.
O mercado está sem trigo.
O granário mais próximo possui 12 cargas de trigo, mas o comprador do mercado não consegue atravessar o bloqueio da Rua Norte.
```

## 2.5 Crescimento gradual

A cidade deve começar com uma cadeia simples:

```text
Fazenda → Granário → Mercado → Casas
```

E evoluir para uma cadeia complexa:

```text
Múltiplas fazendas
→ múltiplos granários especializados
→ mercados de bairro
→ quatro ou cinco alimentos
→ importações
→ reservas administrativas
→ exportações de excedentes
```

---

# 3. Tipos de alimento

Implementar inicialmente cinco tipos.

| ID           | Nome     | Fonte principal     | Armazenamento | Uso doméstico      |
| ------------ | -------- | ------------------- | ------------- | ------------------ |
| `wheat`      | Trigo    | Fazenda de trigo    | Granário      | Alimento básico    |
| `vegetables` | Vegetais | Fazenda de vegetais | Granário      | Variedade          |
| `fruit`      | Frutas   | Pomar               | Granário      | Variedade          |
| `meat`       | Carne    | Fazenda pecuária    | Granário      | Variedade avançada |
| `fish`       | Peixe    | Cais pesqueiro      | Granário      | Variedade regional |

Todos os alimentos pertencem à categoria:

```text
food
```

Diferenças possíveis:

* tempo de produção;
* fertilidade necessária;
* capacidade por carga;
* valor comercial;
* velocidade de deterioração;
* disponibilidade regional;
* requisitos de terreno;
* preferência de classe social.

## 3.1 Unidade de carga

A unidade logística padrão é uma carga.

Valor inicial:

```text
1 carga = 100 unidades alimentares
```

As unidades alimentares são usadas internamente para consumo doméstico.

O jogador vê principalmente:

* cargas completas;
* cargas parciais;
* meses de abastecimento;
* unidades quando inspeciona um edifício.

Exemplo:

```text
Trigo armazenado: 12,6 cargas
Unidades totais: 1.260
```

## 3.2 Cargas parciais

Um carregador pode transportar cargas parciais.

Exemplo:

```text
Capacidade do carro: 100 unidades
Carga atual: 63 unidades de vegetais
```

Para simplificar visualmente:

* de 1 a 24 unidades: carro pouco carregado;
* de 25 a 74: carro parcialmente carregado;
* de 75 a 100: carro cheio.

## 3.3 Deterioração

A deterioração deve ser configurável por dificuldade.

Valores iniciais:

| Produto  | Perda mensal fora de edifício | Perda mensal em granário |
| -------- | ----------------------------: | -----------------------: |
| Trigo    |                            8% |                       1% |
| Vegetais |                           15% |                       3% |
| Frutas   |                           18% |                       4% |
| Carne    |                           22% |                       5% |
| Peixe    |                           25% |                       6% |

Para o primeiro protótipo, a deterioração pode ser desativada.

O modelo de dados deve, no entanto, suportá-la desde o início.

O jogador deve poder ver:

* perdas no mês;
* alimento estragado;
* causa;
* edifício responsável;
* custo estimado da perda.

---

# 4. Edifícios envolvidos

O sistema alimentar depende dos seguintes tipos de construção:

## Infraestrutura

* estrada;
* estrada pavimentada;
* ponte;
* praça;
* bloqueio de walkers;
* ponto de entrada da cidade.

## Produção

* fazenda de trigo;
* fazenda de vegetais;
* pomar;
* fazenda pecuária;
* cais pesqueiro.

## Armazenamento

* granário;
* entreposto comercial, quando houver importações;
* cais comercial, quando houver importações marítimas.

## Distribuição

* mercado.

## Consumo

* residências.

## Apoio

* reservatório ou poço, se determinado produtor exigir água;
* posto de engenharia;
* brigada urbana;
* centro administrativo;
* edifícios de mão de obra.

---

# 5. Estradas e conectividade

## 5.1 Entrada do edifício

Todo edifício deve possuir um ou mais pontos de entrada.

Exemplo de definição:

```json
{
  "roadAccessPoints": [
    [1, 2],
    [2, 2]
  ]
}
```

Um edifício é considerado conectado quando pelo menos um ponto de acesso:

* está adjacente a uma estrada válida;
* pertence a uma rede que alcança o destino necessário;
* não está bloqueado por configuração de tráfego incompatível.

## 5.2 Categorias de acesso

Separar os seguintes conceitos:

### Acesso local à estrada

Existe uma estrada ao lado da entrada.

### Acesso à rede urbana

A estrada faz parte de uma rede conectada a outras áreas da cidade.

### Acesso à mão de obra

Um recrutador consegue alcançar uma residência plebeia.

### Acesso logístico

Um carregador consegue alcançar um granário ou outro destino.

### Acesso ao mercado

O comprador e a vendedora conseguem circular.

### Acesso regional

A rede alcança o ponto de entrada de comerciantes e imigrantes.

Um edifício pode ter acesso local à estrada, mas não ter acesso logístico.

## 5.3 Bloqueios de estrada

O bloqueio deve possuir permissões por categoria.

Configuração padrão:

| Tipo de agente           | Pode atravessar |
| ------------------------ | --------------- |
| Vendedora do mercado     | Não             |
| Sacerdote                | Não             |
| Médico                   | Não             |
| Carregador de mercadoria | Sim             |
| Comprador de mercado     | Configurável    |
| Comerciante              | Sim             |
| Imigrante                | Sim             |
| Recrutador               | Configurável    |
| Engenheiro               | Não             |
| Bombeiro                 | Não             |

O jogador deve poder editar o bloqueio:

```text
[✓] Transporte de cargas
[✓] Compradores de mercado
[ ] Walkers de serviço
[✓] Comerciantes
[✓] Imigrantes
[ ] Recrutadores
```

## 5.4 Distância rodoviária

Toda distância logística deve ser calculada pela estrada, não em linha reta.

Exemplo:

```text
Fazenda e granário estão separados por 4 tiles em linha reta.
A distância efetiva pela estrada é de 19 segmentos.
```

A interface deve mostrar a distância efetiva.

## 5.5 Custo logístico da distância

A distância não deve apenas aumentar o tempo visual.

Ela afeta:

* tempo de entrega;
* quantidade de entregas por mês;
* ocupação dos carregadores;
* risco de congestionamento;
* deterioração;
* capacidade de resposta a oscilações.

---

# 6. Fazenda de trigo

## 6.1 Função

Produzir trigo em terreno fértil.

## 6.2 Footprint

```text
3×3
```

## 6.3 Requisitos

* pelo menos 50% do footprint sobre terra fértil;
* entrada ligada à estrada;
* acesso à mão de obra;
* trabalhadores;
* espaço no estoque de saída;
* destino logístico disponível.

## 6.4 Capacidade

Valores iniciais:

```text
Trabalhadores necessários: 10
Estoque de saída: 200 unidades
Tempo-base de produção: 45 dias
Produção-base: 100 unidades
```

## 6.5 Fertilidade

Calcular fertilidade média do footprint.

```text
fertilidadeMédia =
somaDaFertilidadeDosTilesAgrícolas
/ quantidadeDeTilesAgrícolas
```

Valores:

* terra comum: 0%;
* pouco fértil: 50%;
* fértil: 100%;
* muito fértil: 125%.

## 6.6 Produção

```text
produçãoEfetiva =
produçãoBase
× fertilidadeMédia
× proporçãoDeTrabalhadores
× bônusDeEvento
× bônusReligioso
× condiçãoDoEdifício
```

A velocidade de progresso pode usar a mesma fórmula.

Exemplo:

```text
Produção-base: 100
Fertilidade: 90%
Trabalhadores: 80%
Bônus de Ceres: 110%
Condição: 100%

Produção esperada:
100 × 0,90 × 0,80 × 1,10 = 79,2 unidades
```

## 6.7 Estados da fazenda

* construindo;
* procurando trabalhadores;
* sem acesso à mão de obra;
* funcionando;
* funcionamento parcial;
* colheita pronta;
* aguardando carregador;
* estoque de saída cheio;
* sem destino;
* pausada;
* danificada;
* em risco de incêndio;
* em risco de colapso.

## 6.8 Transporte

Quando houver pelo menos uma quantidade mínima:

```text
mínimo para despacho: 25 unidades
```

A fazenda procura um destino.

Prioridade inicial:

1. granário que esteja solicitando trigo;
2. granário abaixo de sua meta de trigo;
3. granário configurado para aceitar trigo;
4. entreposto reservado para pedido administrativo;
5. entreposto comercial, quando a exportação estiver habilitada.

Nunca enviar diretamente ao mercado, salvo se uma regra futura habilitar “compra direta na fazenda”.

---

# 7. Fazenda de vegetais

Funciona como a fazenda de trigo, com diferenças de balanceamento.

```text
Footprint: 3×3
Trabalhadores: 10
Tempo-base: 40 dias
Produção-base: 90 unidades
Estoque de saída: 180 unidades
Fertilidade mínima: 60%
```

Características:

* produz mais rapidamente;
* deteriora mais rapidamente;
* possui valor comercial ligeiramente superior;
* é usada para fornecer o segundo tipo de alimento às residências.

A tela deve destacar que vegetais são perecíveis.

---

# 8. Pomar

## 8.1 Função

Produzir frutas.

## 8.2 Características

```text
Footprint: 3×3
Trabalhadores: 12
Primeira colheita: 90 dias
Colheitas seguintes: 50 dias
Produção: 100 unidades
```

O pomar demora mais para iniciar, mas depois produz regularmente.

## 8.3 Estágios visuais

* terreno preparado;
* mudas;
* árvores jovens;
* árvores maduras;
* florada;
* frutos;
* colheita;
* descanso.

O estágio deve ser visível no mapa.

## 8.4 Replantio

No sistema básico, não exige replantio manual.

Eventos podem:

* reduzir produtividade;
* atrasar colheita;
* destruir parte das árvores;
* fornecer colheita excepcional.

---

# 9. Fazenda pecuária

## 9.1 Função

Produzir carne.

## 9.2 Requisitos

* terreno comum ou fértil;
* acesso à estrada;
* trabalhadores;
* água disponível em raio ou rede, dependendo do balanceamento;
* capacidade de saída;
* destino.

## 9.3 Valores iniciais

```text
Footprint: 4×4
Trabalhadores: 16
Produção-base: 100 unidades
Ciclo: 75 dias
Estoque de saída: 200 unidades
```

## 9.4 Impactos

* desejabilidade negativa;
* maior consumo de água;
* maior risco sanitário;
* maior valor comercial;
* produção mais lenta;
* alimento destinado principalmente a casas avançadas.

## 9.5 Representação

Não exibir violência gráfica.

Mostrar:

* animais;
* currais;
* trabalhadores;
* carro de produto processado;
* área de alimentação;
* bebedouro.

---

# 10. Cais pesqueiro

## 10.1 Colocação

O edifício deve ocupar:

* parte em terra;
* parte adjacente à água navegável.

Footprint lógico sugerido:

```text
2×2 em terra
+ ponto de ancoragem na água
```

## 10.2 Requisitos

* água navegável;
* acesso rodoviário;
* acesso à mão de obra;
* rota aquática até zona de pesca;
* espaço no cais;
* barco disponível.

## 10.3 Ciclo

1. barco parte;
2. navega até zona de pesca;
3. inicia pesca;
4. acumula peixe;
5. retorna;
6. descarrega no cais;
7. carregador transporta até granário.

## 10.4 Valores iniciais

```text
Trabalhadores: 12
Barcos: 1
Capacidade do barco: 100 unidades
Tempo de pesca: 30 dias
Estoque no cais: 200 unidades
```

## 10.5 Estados

* sem trabalhadores;
* barco em manutenção;
* barco procurando zona;
* navegando;
* pescando;
* retornando;
* descarregando;
* cais cheio;
* sem granário;
* rio bloqueado;
* produção reduzida;
* pausado.

## 10.6 Tela do barco

Ao clicar no barco:

* cais de origem;
* carga atual;
* capacidade;
* destino;
* tempo estimado;
* estado;
* caminho aquático;
* produtividade da zona;
* data prevista de retorno.

---

# 11. Granário

## 11.1 Papel

O granário é o principal hub logístico de alimentos.

Ele:

* recebe alimentos;
* armazena alimentos;
* reserva cargas;
* transfere cargas;
* fornece produtos aos mercados;
* atende pedidos administrativos;
* disponibiliza excedentes para exportação;
* recebe importações.

## 11.2 Footprint

```text
3×3
```

## 11.3 Capacidade inicial

```text
Capacidade total: 3.200 unidades
Equivalente: 32 cargas
```

A capacidade é compartilhada entre todos os alimentos.

Exemplo:

```text
Trigo: 1.200
Vegetais: 800
Frutas: 400
Carne: 0
Peixe: 200
Espaço livre: 600
```

## 11.4 Slots visuais

O edifício deve mostrar estoque no mapa.

Exemplos:

* sacos para trigo;
* cestos para vegetais;
* caixas para frutas;
* recipientes para carne;
* cestos ou barris para peixe.

Não é necessário representar cada unidade.

Usar faixas visuais:

* vazio;
* 1–25%;
* 26–50%;
* 51–75%;
* 76–100%.

## 11.5 Ordens por alimento

Cada alimento deve possuir uma ordem independente.

### Aceitar

Pode receber normalmente.

```text
Aceitar trigo
```

### Recusar

Não recebe novas entregas.

O estoque existente continua disponível.

```text
Recusar trigo
```

### Solicitar

Tenta obter o alimento de outros granários ou produtores.

```text
Solicitar trigo
```

### Manter quantidade

Define estoque-alvo.

```text
Manter 800 unidades de trigo
```

Abaixo da meta:

* recebe prioridade.

Acima da meta:

* não impede novas entradas, a menos que combinado com limite máximo;
* disponibiliza excedente para transferência ou comércio.

### Esvaziar

Não recebe novas cargas e tenta remover todo o estoque.

```text
Esvaziar vegetais
```

### Reservar

Protege determinada quantidade.

```text
Reservar 500 unidades de trigo
```

Quantidade reservada não pode ser:

* buscada por mercados;
* exportada;
* usada por transferência automática;
* usada por pedidos diferentes.

### Limite máximo

```text
Máximo de frutas: 600 unidades
```

O granário rejeita entradas acima do limite.

## 11.6 Prioridade de recebimento

Por produto:

* muito baixa;
* baixa;
* normal;
* alta;
* crítica.

Essa prioridade influencia a seleção de destino dos produtores.

## 11.7 Tipos de estoque

Separar:

```text
availableStock
reservedStock
incomingStock
outgoingStock
spoiledStock
```

Exemplo:

```text
Trigo físico no granário: 1.000
Reservado para mercados: 200
Reservado para pedido: 300
Disponível: 500
Em trânsito para o granário: 400
Em trânsito saindo: 100
```

## 11.8 Reservas transacionais

Quando um comprador de mercado decide buscar 100 unidades:

1. granário cria uma reserva;
2. reserva recebe ID;
3. produto deixa de estar disponível para outros;
4. comprador parte;
5. ao chegar, reserva é confirmada;
6. produto é transferido;
7. se o comprador falhar, a reserva expira.

Exemplo:

```json
{
  "reservationId": "res-8472",
  "commodity": "wheat",
  "amount": 100,
  "owner": "market-12",
  "collector": "walker-991",
  "expiresAt": "year-4-month-3-day-18"
}
```

## 11.9 Transferências entre granários

Um granário pode solicitar produtos de outro.

Regras:

1. origem possui estoque disponível;
2. destino está abaixo da meta;
3. caminho existe;
4. transferência não viola reserva;
5. distância está dentro do limite;
6. origem não ficará abaixo de sua reserva mínima.

## 11.10 Carregadores do granário

Granários podem possuir carregadores próprios.

Funções:

* buscar alimento em produtores;
* transferir para outro granário;
* entregar em entrepostos;
* mover reservas administrativas.

Mercados normalmente enviam seus próprios compradores para buscar alimento.

---

# 12. Mercado

## 12.1 Papel

O mercado faz a ligação entre o estoque em grande escala e o consumo das residências.

O mercado possui:

* compradores;
* vendedoras;
* estoque interno;
* área de atendimento;
* regras de produtos;
* demanda estimada;
* fornecedores preferidos.

## 12.2 Footprint

```text
2×2
```

## 12.3 Trabalhadores

Valor inicial:

```text
Trabalhadores necessários: 8
```

Distribuição:

* 2 compradores;
* 2 vendedoras;
* 4 funcionários internos.

O número real de agentes ativos depende da eficiência.

| Eficiência | Compradores | Vendedoras |
| ---------: | ----------: | ---------: |
|      0–24% |           0 |          0 |
|     25–49% |           1 |          0 |
|     50–74% |           1 |          1 |
|     75–99% |           2 |          1 |
|       100% |           2 |          2 |

## 12.4 Capacidade interna

```text
Capacidade total: 500 unidades
Capacidade por alimento: configurável
```

Configuração inicial:

* trigo: 200;
* vegetais: 100;
* frutas: 100;
* carne: 50;
* peixe: 50.

O jogador pode alterar os limites.

## 12.5 Comprador do mercado

O comprador é um walker de destino.

Fluxo:

1. mercado calcula demanda;
2. identifica produto mais urgente;
3. procura fornecedor;
4. cria reserva;
5. desloca-se;
6. coleta alimento;
7. retorna;
8. deposita no mercado.

## 12.6 Cálculo de demanda

Para cada tipo de alimento:

```text
demanda =
consumoEsperadoDasCasasAtendidas
+ estoqueDeSegurança
- estoqueAtualDoMercado
- produtoJáEmTrânsito
```

Exemplo:

```text
Consumo previsto de trigo: 120 unidades/mês
Estoque de segurança: 120
Estoque atual: 40
Em trânsito: 100

Demanda:
120 + 120 - 40 - 100 = 100
```

## 12.7 Escolha do alimento a buscar

Ordem padrão:

1. alimento básico completamente ausente;
2. alimento com menos dias de cobertura;
3. alimento que impede evolução de mais residências;
4. alimento abaixo do estoque mínimo;
5. alimento com maior demanda mensal;
6. alimento de maior prioridade configurada.

## 12.8 Escolha do granário

Pontuação sugerida:

```text
score =
distânciaRodoviária × pesoDistância
+ congestionamento × pesoCongestionamento
- prioridadeDoGranário
- quantidadeDisponível
+ penalidadeDeBloqueio
+ penalidadeDeRisco
```

O fornecedor escolhido deve ser explicável.

Exemplo:

```text
Fornecedor selecionado: Granário Central

Motivos:
+ possui 800 unidades disponíveis;
+ está a 14 segmentos de estrada;
+ prioridade alta para mercados;
- o Granário Norte está mais próximo, mas reservou todo o trigo.
```

## 12.9 Vendedora do mercado

A vendedora é um walker errante.

Ela:

1. sai com uma seleção de produtos;
2. percorre as ruas;
3. identifica residências elegíveis;
4. entrega alimentos;
5. reduz seu inventário;
6. retorna quando vazia ou ao alcançar o limite.

## 12.10 Carga da vendedora

Capacidade inicial:

```text
100 unidades
```

Ela pode carregar múltiplos alimentos.

Exemplo:

```text
Trigo: 50
Vegetais: 25
Frutas: 25
```

A composição depende da demanda das casas.

## 12.11 Seleção de carga

Prioridade:

1. alimento básico;
2. alimentos ausentes nas casas;
3. alimentos que bloqueiam evolução;
4. reposição de estoques baixos;
5. bens de luxo, em futuras expansões.

## 12.12 Rota da vendedora

Configurações:

```text
Máximo de 40 segmentos de estrada
Máximo de 60 dias fora
Retornar quando estoque chegar a zero
```

Em cruzamentos:

1. evitar retorno imediato;
2. respeitar bloqueios;
3. preferir ruas ainda não percorridas;
4. preferir direção com mais demanda;
5. retornar antes de exceder o limite.

## 12.13 Cobertura do mercado

Uma casa não é atendida apenas por estar próxima.

Ela é atendida quando a vendedora passa por um tile de estrada adjacente.

O mercado deve registrar:

```text
lastMarketVisit
lastFoodDelivery
servingMarketId
foodDeliveredByType
```

## 12.14 Configurações do mercado

O jogador pode definir:

* alimentos permitidos;
* alimentos proibidos;
* prioridade por alimento;
* estoque mínimo;
* estoque máximo;
* reserva de segurança;
* granário preferido;
* distância máxima do comprador;
* impedir travessia de bloqueios;
* limitar atendimento a determinado bairro;
* priorizar residências em regressão;
* priorizar residências próximas;
* priorizar evolução.

## 12.15 Política de atendimento

Opções:

### Equilibrada

Distribui proporcionalmente entre as casas.

### Evitar fome

Prioriza casas sem alimento básico.

### Promover evolução

Prioriza casas que podem evoluir ao receber variedade.

### Bairro local

Evita atender residências distantes.

### Reservar para patrícios

Prioriza alimentos raros para casas avançadas.

A política deve ser configurável por mercado.

---

# 13. Residências e consumo

## 13.1 Estoque doméstico

Cada residência possui inventário alimentar.

Exemplo:

```json
{
  "wheat": 48,
  "vegetables": 12,
  "fruit": 0,
  "meat": 0,
  "fish": 0
}
```

## 13.2 Consumo

O consumo depende da população.

Fórmula inicial:

```text
consumoDiário =
população
× consumoBasePorPessoa
× modificadorDoNívelDaCasa
× modificadorDeDificuldade
```

Exemplo:

```text
Consumo-base: 0,03 unidade por pessoa/dia
População: 20
Consumo diário: 0,6 unidade
Consumo mensal: 18 unidades
```

## 13.3 Ordem de consumo

A residência distingue:

* alimento básico;
* variedade alimentar.

Ela consome primeiro o alimento configurado como básico.

Por padrão:

1. trigo;
2. vegetais;
3. frutas;
4. peixe;
5. carne.

Mas o sistema deve permitir que qualquer alimento sustente a casa.

Uma casa com apenas vegetais não deve morrer de fome por ausência de trigo.

A variedade é calculada pelo número de tipos disponíveis, não por um tipo obrigatório específico.

## 13.4 Variedade alimentar

Exemplo de requisitos:

| Nível residencial | Tipos necessários |
| ----------------- | ----------------: |
| Tenda             |                 0 |
| Cabana            |                 1 |
| Casa simples      |                 1 |
| Ínsula média      |                 2 |
| Ínsula avançada   |                 2 |
| Vila              |                 3 |
| Palácio           |                 4 |

Uma residência possui um tipo de alimento quando:

* o estoque daquele tipo é maior que zero;
* ou recebeu aquele alimento durante o período de memória.

## 13.5 Memória de variedade

Evitar regressão instantânea quando um alimento acaba.

Exemplo:

```text
Acesso recente a vegetais: 20 dias restantes
```

A casa continua contando aquele tipo até a memória acabar.

Valores iniciais:

```text
Memória de alimento: 30 dias
Tolerância para regressão: 30 dias adicionais
```

## 13.6 Capacidade doméstica

Casas mais avançadas armazenam mais.

| Classe  | Capacidade alimentar |
| ------- | -------------------: |
| Tenda   |          20 unidades |
| Cabana  |                   40 |
| Casa    |                   80 |
| Ínsula  |                  160 |
| Vila    |                  250 |
| Palácio |                  400 |

## 13.7 Entrega doméstica

Quando a vendedora passa:

1. calcula espaço livre;
2. identifica alimentos permitidos;
3. identifica alimentos necessários;
4. transfere até o limite;
5. atualiza histórico;
6. registra o mercado responsável.

## 13.8 Estados alimentares da residência

* sem necessidade de alimento;
* bem abastecida;
* abastecimento adequado;
* estoque baixo;
* estoque crítico;
* sem alimento;
* em fome prolongada;
* variedade insuficiente;
* aguardando mercado;
* mercado passou sem produto necessário.

## 13.9 Efeitos da falta de alimento

### Estoque baixo

* aviso;
* queda leve de humor.

### Sem alimento por poucos dias

* casa para de evoluir;
* humor cai;
* saúde cai.

### Sem alimento prolongadamente

* regressão;
* emigração;
* mortalidade opcional;
* aumento de crime;
* redução de produtividade urbana.

---

# 14. Importação e exportação de alimentos

## 14.1 Importação

O jogador pode configurar:

```text
Importar trigo até 1.500 unidades
```

Fluxo:

1. comerciante chega;
2. descarrega no entreposto;
3. produto é reservado para um granário;
4. carregador transporta;
5. granário recebe;
6. mercado busca normalmente.

## 14.2 Destino de importações

Prioridade:

1. granário definido como centro alimentar;
2. granário solicitando o produto;
3. granário abaixo da meta;
4. granário que aceite o produto;
5. entreposto temporário.

## 14.3 Exportação

O jogador pode configurar:

```text
Exportar trigo acima de 2.000 unidades
```

O estoque reservado para consumo interno não pode ser exportado.

## 14.4 Reserva alimentar urbana

Configuração global:

```text
Reserva mínima de trigo: 6 meses
```

Antes de exportar, calcular:

```text
estoqueExportável =
estoqueDisponível
- consumoProjetadoDaCidade
- reservasAdministrativas
- produtoEmTrânsitoParaMercados
```

## 14.5 Alerta de exportação perigosa

Se uma exportação puder deixar a cidade com menos de determinada cobertura:

```text
Esta venda reduzirá a reserva de trigo de 4,2 para 1,7 mês.
```

O jogador pode:

* cancelar;
* vender mesmo assim;
* reduzir quantidade;
* aumentar reserva mínima.

---

# 15. HUD principal do jogo

O HUD deve fornecer uma leitura imediata do estado alimentar sem exigir abertura de telas.

## 15.1 Indicador resumido de comida

Na barra superior:

```text
Comida: 5,8 meses
```

O valor representa:

```text
total de alimento disponível
/ consumo mensal projetado
```

Considerar:

* granários;
* mercados;
* residências;
* alimentos em trânsito para a cidade;
* excluir produtos reservados para exportação ou pedidos;
* opcionalmente excluir estoque doméstico da projeção estratégica.

## 15.2 Estado visual

* verde: acima de 6 meses;
* amarelo: entre 3 e 6;
* laranja: entre 1 e 3;
* vermelho: menos de 1;
* cinza: sem consumo ou sem população.

Nunca depender somente da cor.

Adicionar ícone e texto.

## 15.3 Tooltip do indicador

Ao posicionar o cursor:

```text
Abastecimento alimentar: 5,8 meses

Produção mensal: 1.420 unidades
Consumo mensal: 1.180 unidades
Saldo projetado: +240 unidades/mês

Estoque:
Trigo: 3.200
Vegetais: 1.100
Frutas: 800
Carne: 200
Peixe: 0

Variedade:
1 alimento: 96% da população
2 alimentos: 68%
3 alimentos: 21%
4 alimentos: 0%

Principais problemas:
• O distrito sul não recebe vegetais.
• Dois mercados estão sem trabalhadores.
• O peixe não é produzido nesta província.
```

## 15.4 Clique no indicador

Abre o Conselheiro de Alimentação.

## 15.5 Alertas rápidos

Exibir pequenos indicadores para:

* cidade com menos de três meses de comida;
* cidade sem alimento básico;
* produção menor que consumo;
* granários quase cheios;
* mercados sem estoque;
* casas em fome;
* carga sem destino;
* deterioração alta;
* importação bloqueada.

## 15.6 Painel lateral contextual

Quando uma construção alimentar é selecionada, o painel contextual deve abrir sem pausar obrigatoriamente o jogo.

Configuração:

* largura entre 360 e 480 px;
* pode ser fixado;
* pode ser minimizado;
* pode ser movido;
* pode permanecer aberto enquanto outro edifício é selecionado;
* pode ser comparado com outro edifício do mesmo tipo.

---

# 16. Tela de detalhe da fazenda

## 16.1 Cabeçalho

Mostrar:

* nome;
* tipo de produto;
* estado;
* eficiência;
* trabalhadores;
* ícone;
* botão de pausar;
* botão de localizar;
* botão de demolir;
* botão de copiar configurações.

Exemplo:

```text
Fazenda de trigo
Funcionando — 82% de eficiência
8/10 trabalhadores
```

## 16.2 Resumo operacional

Cards:

* progresso atual;
* produção por ciclo;
* produção mensal;
* estoque de saída;
* destino;
* tempo até próxima carga.

Exemplo:

```text
Colheita: 64%
Produção estimada: 82 unidades
Próxima colheita: 17 dias
Estoque de saída: 100/200
```

## 16.3 Fertilidade

Mostrar:

* fertilidade média;
* fertilidade por tile;
* penalidades;
* bônus.

Botão:

```text
Mostrar fertilidade no mapa
```

## 16.4 Mão de obra

Mostrar:

* trabalhadores necessários;
* alocados;
* eficiência;
* setor;
* prioridade;
* acesso à habitação;
* distância do recrutador;
* última contratação.

## 16.5 Logística

Mostrar:

* granário atual;
* distância;
* carregador;
* carga;
* destino reservado;
* tempo estimado;
* último despacho;
* frequência média.

## 16.6 Produção histórica

Gráfico de 12 meses:

* produção;
* cargas despachadas;
* tempo parada;
* perdas.

## 16.7 Diagnóstico

Lista ordenada:

```text
1. Produção reduzida em 18% por falta de trabalhadores.
2. O granário de destino está a 31 segmentos.
3. A fazenda ficou 12 dias com estoque de saída cheio no mês anterior.
```

## 16.8 Controles

* pausar;
* prioridade de mão de obra;
* destino preferido;
* permitir qualquer granário;
* quantidade mínima para despacho;
* exportação direta desabilitada;
* aplicar a todas as fazendas deste tipo.

---

# 17. Tela do cais pesqueiro

Além das informações comuns:

## 17.1 Barcos

Tabela:

```text
Barco | Estado | Carga | Destino | Retorno previsto
```

## 17.2 Área de pesca

Mostrar:

* zona atual;
* produtividade;
* distância;
* congestionamento;
* outros barcos na área.

## 17.3 Água navegável

Mostrar:

* conexão;
* bloqueios;
* pontes incompatíveis;
* profundidade;
* saída regional.

## 17.4 Estoque do cais

* peixe descarregado;
* peixe reservado;
* peixe esperando carregador;
* deterioração.

## 17.5 Diagnóstico específico

* barco não encontra zona de pesca;
* água bloqueada;
* cais sem espaço;
* granário não aceita peixe;
* falta de trabalhadores;
* peixe deteriorando no cais.

---

# 18. Tela de detalhe do granário

## 18.1 Cabeçalho

```text
Granário Central
Capacidade: 2.640/3.200
82% ocupado
8/8 trabalhadores
```

## 18.2 Visualização do estoque

Tabela:

| Produto  | Físico | Disponível | Reservado | Entrada | Saída | Ordem        |
| -------- | -----: | ---------: | --------: | ------: | ----: | ------------ |
| Trigo    |  1.200 |        700 |       500 |     300 |   200 | Manter 1.000 |
| Vegetais |    600 |        500 |       100 |       0 |   100 | Aceitar      |
| Frutas   |    400 |        400 |         0 |     200 |     0 | Solicitar    |
| Carne    |    200 |          0 |       200 |       0 |     0 | Reservar     |
| Peixe    |    240 |        240 |         0 |       0 |   100 | Esvaziar     |

## 18.3 Configuração por produto

Ao clicar numa linha, abrir:

* aceitar;
* recusar;
* solicitar;
* esvaziar;
* quantidade mínima;
* quantidade máxima;
* reserva;
* prioridade;
* permitir mercados;
* permitir comércio;
* permitir transferências;
* permitir pedidos administrativos.

## 18.4 Capacidade

Mostrar:

* total;
* usada;
* reservada;
* esperada em trânsito;
* espaço efetivo;
* previsão de lotação.

Exemplo:

```text
Espaço físico livre: 560
Cargas a caminho: 800
Lotação prevista: 110%
```

## 18.5 Atividade logística

Lista:

```text
Carro 14 está trazendo 100 de trigo da Fazenda Oeste.
Compradora 21 está buscando 80 de vegetais para o Mercado Sul.
Carro 8 está levando 100 de carne ao Granário Norte.
```

## 18.6 Reservas

Tabela:

* ID;
* produto;
* quantidade;
* proprietário;
* destino;
* validade;
* estado.

## 18.7 Fornecedores e consumidores

### Fornecedores

* fazendas conectadas;
* produção mensal;
* distância;
* última entrega.

### Consumidores

* mercados;
* consumo;
* distância;
* última coleta.

## 18.8 Diagnóstico

Exemplos:

* “O granário atingirá a capacidade em aproximadamente 18 dias.”
* “700 unidades de trigo estão reservadas, mas apenas 300 possuem transporte.”
* “O Mercado Sul busca vegetais neste granário apesar de existir um fornecedor 12 segmentos mais próximo.”
* “A ordem de solicitar frutas está causando transferências cruzadas com o Granário Norte.”

## 18.9 Controles globais

* definir como Centro Alimentar;
* recusar todos;
* aceitar todos;
* copiar ordens;
* colar ordens;
* esvaziar edifício;
* aplicar preset;
* mostrar fluxos no mapa.

---

# 19. Tela de detalhe do mercado

## 19.1 Cabeçalho

```text
Mercado do Fórum
Funcionando — 100%
8/8 trabalhadores
Atende 148 residências
```

## 19.2 Estoque interno

Tabela:

| Produto  | Atual | Mínimo | Máximo | Em trânsito | Demanda mensal |
| -------- | ----: | -----: | -----: | ----------: | -------------: |
| Trigo    |   120 |    100 |    200 |         100 |            180 |
| Vegetais |    20 |     50 |    100 |           0 |             90 |
| Frutas   |     0 |     25 |    100 |         100 |             70 |
| Carne    |     0 |      0 |     50 |           0 |             15 |
| Peixe    |     0 |      0 |     50 |           0 |              0 |

## 19.3 Compradores

Cards ou tabela:

```text
Compradora 1
Buscando 100 de trigo
Granário Central
14 segmentos
Retorno em aproximadamente 6 dias
```

```text
Compradora 2
Sem tarefa
Motivo: nenhum fornecedor possui frutas disponíveis
```

## 19.4 Vendedoras

Mostrar:

* carga;
* rota;
* casas visitadas;
* entregas;
* tempo fora;
* previsão de retorno.

## 19.5 Área atendida

Mostrar:

* residências alcançadas nos últimos 30 dias;
* população atendida;
* residências sem visita;
* residências sem alimento;
* limite de rota;
* mapa da rota recente.

## 19.6 Demanda

Resumo:

```text
População atendida: 1.180
Consumo mensal previsto: 354 unidades

Casas aguardando:
Trigo: 18
Vegetais: 42
Frutas: 16
Carne: 0
Peixe: 0
```

## 19.7 Evolução habitacional

Mostrar:

```text
26 residências podem evoluir se receberem vegetais.
8 residências podem evoluir se receberem frutas.
```

Botão:

```text
Priorizar evolução
```

## 19.8 Configurações

* política de atendimento;
* produtos permitidos;
* mínimo;
* máximo;
* prioridade;
* granário preferido;
* distância máxima de compra;
* limite da rota de venda;
* atravessar bloqueios;
* atender somente distrito;
* priorizar fome;
* priorizar regressão;
* priorizar evolução.

## 19.9 Diagnóstico

Exemplos:

* “O mercado possui trigo suficiente para apenas 18 dias.”
* “A procura de frutas está falhando porque o Granário Central reservou todo o estoque.”
* “A vendedora percorre uma rota de 57 segmentos e retorna antes de alcançar o bairro leste.”
* “Este mercado atende 38% mais habitantes do que a capacidade recomendada.”
* “Há trabalhadores suficientes, mas apenas uma vendedora está ativa porque a segunda rota está bloqueada.”

---

# 20. Tela de detalhe da residência

## 20.1 Cabeçalho

```text
Ínsula média
18/20 habitantes
Próximo nível: Ínsula grande
```

## 20.2 Estado alimentar

Mostrar:

```text
Abastecimento geral: 42 dias
Variedade atual: 2 tipos
Variedade necessária: 2 tipos
```

Tabela:

| Alimento | Estoque | Duração | Última entrega | Mercado          |
| -------- | ------: | ------: | -------------- | ---------------- |
| Trigo    |      24 | 40 dias | há 8 dias      | Mercado do Fórum |
| Vegetais |       7 | 12 dias | há 22 dias     | Mercado do Fórum |
| Frutas   |       0 |       — | nunca          | —                |
| Carne    |       0 |       — | nunca          | —                |
| Peixe    |       0 |       — | nunca          | —                |

## 20.3 Mercado responsável

Mostrar:

* mercado;
* distância;
* última visita;
* última entrega;
* vendedora;
* rota;
* estado do mercado.

## 20.4 Evolução

Checklist:

```text
[✓] Um tipo de alimento
[✓] Dois tipos de alimento
[✓] Água de fonte
[ ] Acesso ao banho público
[✓] Cerâmica
[✓] Desejabilidade mínima
```

Se alimento bloquear evolução:

```text
Esta casa precisa manter dois tipos de alimento.
Os vegetais acabarão em aproximadamente 12 dias.
```

## 20.5 Diagnóstico encadeado

Exemplo:

```text
Esta casa não recebeu frutas.

Causa imediata:
O mercado responsável não possui frutas.

Causa do mercado:
Nenhum comprador encontrou frutas disponíveis.

Causa logística:
O único granário com frutas está configurado para “Reservar 400”.

Ação sugerida:
Altere a reserva ou permita que outro granário receba frutas.
```

## 20.6 Controles

* localizar mercado;
* localizar fornecedor;
* mostrar rota;
* abrir overlay de alimento;
* fixar evolução;
* impedir evolução;
* aplicar configuração ao bloco.

---

# 21. Conselheiro de Alimentação

Esta deve ser a principal tela de gestão do supply chain.

## 21.1 Resumo superior

Cards:

* meses totais de comida;
* produção mensal;
* consumo mensal;
* saldo;
* população sem alimento;
* população com um tipo;
* população com dois tipos;
* população com três tipos;
* perdas;
* capacidade dos granários.

## 21.2 Tabela por alimento

| Alimento | Estoque | Produção/mês | Consumo/mês | Saldo | Meses | Importação | Exportação |
| -------- | ------: | -----------: | ----------: | ----: | ----: | ---------: | ---------: |
| Trigo    |   3.200 |          900 |         600 |  +300 |   5,3 |          0 |          0 |
| Vegetais |     800 |          240 |         360 |  -120 |   2,2 |          0 |          0 |
| Frutas   |     400 |          180 |         160 |   +20 |   2,5 |          0 |          0 |
| Carne    |     200 |            0 |          80 |   -80 |   2,5 |        100 |          0 |
| Peixe    |       0 |            0 |           0 |     0 |     — |          0 |          0 |

## 21.3 Cadeia por produto

Ao selecionar trigo:

```text
Fazendas:
8 construídas
7 ativas
1 sem trabalhadores

Produção:
900 unidades/mês

Transporte:
780 entregues
120 aguardando carregador

Granários:
3.200 armazenadas
500 reservadas

Mercados:
600 unidades/mês consumidas
120 em trânsito

Residências:
4.200 habitantes atendidos
180 com estoque crítico
```

## 21.4 Gargalos automáticos

Classificar:

### Produção

* poucos produtores;
* baixa fertilidade;
* falta de trabalhadores;
* produção pausada.

### Transporte

* carregadores ocupados;
* caminhos longos;
* bloqueios;
* congestionamento.

### Armazenamento

* granários cheios;
* produto recusado;
* reservas excessivas;
* capacidade mal distribuída.

### Mercado

* mercados vazios;
* mercados sobrecarregados;
* compradores sem fornecedor;
* vendedoras com rotas ruins.

### Consumo

* bairros sem cobertura;
* variedade insuficiente;
* crescimento acima da produção;
* consumo aristocrático elevado.

## 21.5 Recomendações

Exemplos:

```text
Vegetais entrarão em déficit dentro de aproximadamente 62 dias.
Construa uma fazenda adicional ou abra uma rota de importação.
```

```text
O Granário Norte possui 1.400 unidades de trigo, mas nenhum mercado o utiliza.
O acesso dos compradores está bloqueado.
```

```text
O Mercado Sul atende 2.300 habitantes, 74% acima de sua capacidade recomendada.
```

## 21.6 Histórico

Gráficos separados:

* estoque;
* produção;
* consumo;
* variedade;
* fome;
* perdas;
* importações;
* exportações.

Filtros:

* 12 meses;
* 5 anos;
* toda a partida.

## 21.7 Ações

* localizar produtores parados;
* localizar granários cheios;
* localizar mercados sem estoque;
* localizar casas com fome;
* abrir overlay;
* configurar comércio;
* construir edifício;
* criar reserva mínima;
* definir Centro Alimentar.

---

# 22. Overlays alimentares

## 22.1 Overlay de abastecimento geral

Casas:

* verde: mais de 60 dias;
* amarelo: 30–60;
* laranja: 10–29;
* vermelho: menos de 10;
* preto ou símbolo específico: sem alimento.

Mostrar número de dias sobre a casa quando o zoom permitir.

## 22.2 Overlay por alimento

Um overlay para cada:

* trigo;
* vegetais;
* frutas;
* carne;
* peixe.

Casas mostram:

* estoque;
* memória de acesso;
* falta.

Edifícios destacados:

* produtores;
* granários;
* mercados;
* carregadores;
* compradores;
* vendedoras.

## 22.3 Overlay de variedade

Mostrar quantidade de tipos:

* 0;
* 1;
* 2;
* 3;
* 4;
* 5.

Adicionar ícones, não somente cores.

## 22.4 Overlay logístico

Mostrar linhas animadas:

* produtor → granário;
* granário → mercado;
* mercado → bairro;
* comércio → granário.

Espessura da linha:

* volume transportado.

Cor ou padrão:

* funcionando;
* saturado;
* bloqueado;
* sem rota;
* reservado.

## 22.5 Overlay de granários

Mostrar:

* ocupação;
* espaço livre;
* produto predominante;
* ordens;
* previsão de lotação;
* cargas a caminho.

## 22.6 Overlay de mercados

Mostrar:

* área realmente visitada;
* não apenas alcance teórico;
* demanda;
* estoque;
* número de casas;
* sobrecarga;
* rotas das vendedoras.

## 22.7 Overlay de fertilidade

Mostrar fertilidade dos tiles.

Ao posicionar o cursor:

```text
Fertilidade: 100%
Fazenda possível: sim
Produção estimada: normal
```

---

# 23. Notificações e alertas

## 23.1 Alertas críticos

* cidade completamente sem alimento;
* mais de 10% da população em fome;
* nenhum mercado funcionando;
* todos os granários cheios;
* produção alimentar interrompida;
* estoque inferior a um mês.

## 23.2 Alertas urgentes

* produção abaixo do consumo;
* mercado sem alimento básico;
* bairro sem cobertura;
* alimento raro em falta;
* importação bloqueada;
* exportação reduzindo reserva crítica.

## 23.3 Alertas de atenção

* granário acima de 85%;
* mercado sobrecarregado;
* fazenda sem eficiência;
* distância logística excessiva;
* perdas por deterioração;
* alimento com menos de três meses.

## 23.4 Agrupamento

Em vez de:

```text
Fazenda 1 sem trabalhadores.
Fazenda 2 sem trabalhadores.
Fazenda 3 sem trabalhadores.
```

Mostrar:

```text
Três fazendas estão com falta de trabalhadores.
```

Ao clicar, abrir lista e permitir navegar entre elas.

---

# 24. Regras de seleção de destino

## 24.1 Produtor para granário

Pontuação sugerida:

```text
score =
distância
+ ocupaçãoDoDestino × 20
- prioridadeDeRecebimento × 10
- necessidadeDoDestino × 15
+ congestionamento
+ riscoDeFalha
```

Escolher o menor score.

## 24.2 Mercado para granário

Critérios:

1. produto disponível;
2. não reservado;
3. caminho válido;
4. dentro do alcance;
5. granário permite retirada;
6. reserva criada com sucesso.

Depois, pontuar:

* distância;
* quantidade;
* congestionamento;
* preferência;
* tempo de espera.

## 24.3 Transferência entre granários

Só realizar quando houver benefício real.

Evitar:

* transferências circulares;
* dois granários solicitando um ao outro;
* oscilações de estoque;
* cargas cruzando a cidade sem necessidade.

Adicionar cooldown:

```text
Após enviar produto para um granário, não solicitar de volta por 90 dias.
```

## 24.4 Prevenção de ping-pong

Toda carga mantém:

```text
lastLocations
lastTransferReason
lastTransferTimestamp
```

Se a carga voltar repetidamente:

* cancelar transferência;
* gerar diagnóstico;
* marcar conflito de configuração.

---

# 25. Estados das cargas

Toda carga deve passar por uma máquina de estados.

```text
CREATED
AVAILABLE
RESERVED
ASSIGNED
PICKING_UP
IN_TRANSIT
WAITING_TO_UNLOAD
DELIVERED
CONSUMED
EXPORTED
SPOILED
CANCELLED
LOST
```

Transições inválidas devem gerar erro de desenvolvimento.

Exemplo:

```text
AVAILABLE → RESERVED
RESERVED → ASSIGNED
ASSIGNED → PICKING_UP
PICKING_UP → IN_TRANSIT
IN_TRANSIT → DELIVERED
```

Se um carregador desaparecer:

```text
IN_TRANSIT → CANCELLED
```

O produto deve:

* retornar ao estoque de origem;
* ser materializado no destino mais próximo;
* ou ser recuperado conforme a causa.

Nunca simplesmente sumir.

---

# 26. Modelo de dados

## 26.1 Mercadoria

```json
{
  "id": "wheat",
  "name": "Trigo",
  "category": "food",
  "unitsPerLoad": 100,
  "tradable": true,
  "householdFood": true,
  "baseSpoilageRate": 0.01,
  "baseImportPrice": 30,
  "baseExportPrice": 22,
  "icon": "food_wheat"
}
```

## 26.2 Produtor

```json
{
  "id": "wheat_farm",
  "name": "Fazenda de trigo",
  "footprint": [3, 3],
  "workersRequired": 10,
  "roadAccessRequired": true,
  "production": {
    "commodity": "wheat",
    "baseUnits": 100,
    "baseDays": 45,
    "outputCapacity": 200
  },
  "terrainRequirements": {
    "fertilityMinimum": 0.5
  },
  "transport": {
    "carrierCount": 1,
    "carrierCapacity": 100,
    "minimumDispatch": 25
  }
}
```

## 26.3 Granário

```json
{
  "id": "granary",
  "name": "Granário",
  "footprint": [3, 3],
  "workersRequired": 8,
  "capacity": 3200,
  "acceptedCategories": ["food"],
  "carrierCount": 2,
  "defaultRules": {
    "wheat": {
      "mode": "accept",
      "minimum": 0,
      "maximum": 3200,
      "reserve": 0,
      "priority": 3
    }
  }
}
```

## 26.4 Mercado

```json
{
  "id": "market",
  "name": "Mercado",
  "footprint": [2, 2],
  "workersRequired": 8,
  "internalCapacity": 500,
  "buyers": 2,
  "sellers": 2,
  "buyerCapacity": 100,
  "sellerCapacity": 100,
  "buyerMaximumRoadDistance": 80,
  "sellerMaximumRoadSteps": 40,
  "defaultPolicy": "balanced"
}
```

## 26.5 Estoque doméstico

```json
{
  "houseId": "house-188",
  "foodInventory": {
    "wheat": {
      "units": 24,
      "lastDeliveryDay": 1240,
      "accessMemoryDays": 30
    },
    "vegetables": {
      "units": 7,
      "lastDeliveryDay": 1224,
      "accessMemoryDays": 14
    }
  }
}
```

---

# 27. Ordem da simulação

Usar passo fixo.

Ordem diária sugerida:

1. atualizar tempo;
2. atualizar trabalhadores;
3. atualizar produtores;
4. concluir ciclos de produção;
5. criar cargas;
6. expirar reservas;
7. atribuir transportes;
8. movimentar walkers;
9. processar coletas;
10. processar entregas;
11. atualizar mercados;
12. distribuir produtos;
13. consumir estoques domésticos;
14. atualizar memória de variedade;
15. aplicar deterioração;
16. recalcular alertas;
17. atualizar estatísticas.

Processamento mensal:

* projeção de produção;
* projeção de consumo;
* histórico;
* evolução residencial;
* regressão;
* migração;
* saúde;
* rating;
* comércio.

---

# 28. Congestionamento

Cada segmento de estrada deve medir tráfego.

Categorias:

* walkers de serviço;
* carregadores;
* compradores;
* comerciantes;
* imigrantes.

O congestionamento pode:

* reduzir velocidade;
* atrasar entregas;
* aumentar tempo fora;
* causar filas em granários;
* reduzir cobertura dos mercados.

O jogador deve ver:

```text
Esta rota está 72% congestionada.
O tempo médio de entrega aumentou de 5 para 11 dias.
```

---

# 29. Falhas e casos extremos

## 29.1 Produtor sem destino

A produção para quando o estoque de saída enche.

Não destruir produto.

## 29.2 Granário demolido com estoque

Antes de demolir:

```text
Este granário contém 2.400 unidades de alimento.
A demolição destruirá o estoque que não puder ser transferido.
```

Opções:

* cancelar;
* esvaziar primeiro;
* demolir e perder;
* transferência automática.

## 29.3 Mercado demolido

Casas mantêm seus estoques, mas deixam de receber entregas.

A memória de mercado expira normalmente.

## 29.4 Estrada removida

Walkers em rota:

1. tentam recalcular;
2. retornam;
3. esperam;
4. cancelam a tarefa após timeout.

Reservas são liberadas.

## 29.5 Produto recusado durante transporte

Se um granário passa a recusar enquanto a carga está a caminho:

* permitir a entrega já reservada;
* ou redirecionar, conforme configuração global.

Padrão:

```text
Reservas existentes continuam válidas.
```

## 29.6 Cidade sem granário

Fazendas produzem até encher o estoque local.

Mercados não compram diretamente por padrão.

Tutorial deve explicar a necessidade do granário.

## 29.7 Granário cheio com importação

A mercadoria permanece no entreposto por um período.

Depois:

* gera custo;
* deteriora;
* pode ser recusada;
* comerciante pode ir embora com a carga.

Nunca adicionar além da capacidade.

## 29.8 Crescimento rápido

Se a população aumenta acima da produção:

* previsão de cobertura cai;
* HUD muda;
* conselheiro alerta;
* mercados ajustam demanda;
* jogador recebe aviso antes da fome.

---

# 30. Métricas internas

Registrar:

## Produção

* unidades produzidas;
* capacidade teórica;
* dias parados;
* causa da parada;
* eficiência média.

## Transporte

* cargas movidas;
* distância;
* tempo;
* viagens;
* filas;
* entregas falhadas.

## Armazenamento

* ocupação;
* giro;
* perdas;
* reservas;
* excesso;
* falta.

## Mercado

* compras;
* entregas;
* casas visitadas;
* produtos distribuídos;
* demanda não atendida.

## Residências

* consumo;
* dias sem comida;
* variedade;
* desperdício;
* evolução bloqueada.

Esses dados alimentam as telas de gestão.

---

# 31. Testes unitários

Implementar testes para:

* fórmula de fertilidade;
* produção parcial;
* criação de cargas;
* seleção de granário;
* limites de capacidade;
* reservas;
* expiração de reservas;
* ordens de aceitar;
* ordens de recusar;
* ordens de solicitar;
* ordem de esvaziar;
* reserva mínima;
* seleção do comprador;
* cálculo de demanda;
* composição da carga da vendedora;
* consumo residencial;
* variedade alimentar;
* memória de acesso;
* deterioração;
* projeção de meses;
* exportação acima de reserva;
* prevenção de transferências circulares.

---

# 32. Testes de integração

## 32.1 Cadeia básica

1. construir estrada;
2. construir casas;
3. construir fazenda;
4. construir granário;
5. construir mercado;
6. aguardar trabalhadores;
7. fazenda produz;
8. carregador entrega;
9. granário armazena;
10. comprador busca;
11. mercado recebe;
12. vendedora distribui;
13. casa consome;
14. casa evolui.

## 32.2 Granário recusando produto

1. configurar trigo como recusado;
2. concluir colheita;
3. verificar que a fazenda não envia;
4. mostrar motivo;
5. alterar para aceitar;
6. transporte iniciar.

## 32.3 Mercado sem rota

1. remover estrada;
2. comprador falhar;
3. reserva expirar;
4. mercado mostrar diagnóstico;
5. casas consumirem estoque;
6. alerta surgir.

## 32.4 Variedade

1. fornecer apenas trigo;
2. casa manter nível básico;
3. fornecer vegetais;
4. casa reconhecer dois tipos;
5. evoluir;
6. interromper vegetais;
7. memória expirar;
8. iniciar tolerância;
9. regredir.

## 32.5 Sobrecarga

1. conectar um mercado a muitas casas;
2. medir queda na frequência;
3. casas distantes ficarem sem visita;
4. conselheiro detectar sobrecarga;
5. construir segundo mercado;
6. cobertura melhorar.

## 32.6 Importação

1. configurar meta;
2. receber alimento;
3. armazenar no entreposto;
4. transportar ao granário;
5. mercado buscar;
6. residência consumir;
7. tesouro reduzir corretamente.

## 32.7 Exportação

1. definir reserva mínima;
2. produzir excedente;
3. comerciante coletar apenas excedente;
4. reserva permanecer;
5. quota atualizar;
6. tesouro aumentar.

## 32.8 Save e load

1. salvar com cargas em trânsito;
2. carregar;
3. rotas permanecerem;
4. reservas permanecerem;
5. entregas concluírem;
6. resultado ser determinístico.

---

# 33. Critérios de aceitação

O sistema alimentar só pode ser considerado funcional quando:

1. fazendas produzem com base em fertilidade e trabalhadores;
2. peixe exige barco e água navegável;
3. produtos existem como cargas físicas;
4. carregadores percorrem estradas;
5. granários possuem capacidade real;
6. ordens por produto funcionam;
7. reservas impedem uso duplicado;
8. mercados calculam demanda;
9. compradores buscam produtos;
10. vendedoras distribuem pelas ruas;
11. casas armazenam comida;
12. casas consomem diariamente;
13. variedade afeta evolução;
14. falta de comida afeta a cidade;
15. importações entram fisicamente;
16. exportações respeitam reservas;
17. o HUD mostra meses de comida;
18. overlays mostram cobertura real;
19. telas explicam gargalos;
20. save e load preservam toda a cadeia;
21. nenhuma mercadoria é teleportada;
22. nenhuma mercadoria desaparece sem causa;
23. nenhum painel mostra valores inventados;
24. todos os botões descritos executam ações reais.

---

# 34. Ordem de implementação recomendada

## Fase 1 — Produção

* trigo;
* fazenda;
* fertilidade;
* trabalhadores;
* estoque de saída.

## Fase 2 — Armazenamento

* granário;
* capacidade;
* cargas;
* carregador;
* seleção de destino.

## Fase 3 — Mercado

* estoque interno;
* comprador;
* reservas;
* vendedora;
* distribuição.

## Fase 4 — Residências

* inventário;
* consumo;
* fome;
* evolução com um alimento.

## Fase 5 — Variedade

* vegetais;
* frutas;
* carne;
* peixe;
* requisitos por nível.

## Fase 6 — Gestão

* HUD;
* telas de edifício;
* conselheiro;
* overlays;
* alertas.

## Fase 7 — Comércio

* importação;
* exportação;
* reservas urbanas;
* quotas.

## Fase 8 — Polimento

* deterioração;
* congestionamento;
* animações;
* histórico;
* balanceamento;
* performance.

---

# 35. Instrução final para o agente de coding

Implemente o supply chain alimentar como uma fatia vertical completa.

Não implemente apenas:

* telas estáticas;
* números globais;
* mockups;
* animações sem simulação;
* estoques sem origem;
* coberturas por raio que ignorem walkers;
* transporte instantâneo;
* mercados que criem comida;
* casas que consumam um estoque global.

Antes de alterar o projeto:

1. examine a arquitetura;
2. encontre os sistemas existentes de mapa, estrada, edifícios e agentes;
3. identifique o que pode ser reutilizado;
4. divida a implementação pelas fases descritas;
5. crie testes para cada fase.

A primeira entrega jogável deve permitir:

```text
Fazenda de trigo
→ carregador
→ granário
→ comprador
→ mercado
→ vendedora
→ residência
→ consumo
→ evolução
```

Somente depois de esse fluxo estar funcional devem ser adicionados os demais alimentos, comércio, deterioração e otimizações.
