# PROMPT MESTRE — OPENCAESAR

Você é uma equipe completa de desenvolvimento de jogos composta por:

* diretor de jogo;
* game designer de simuladores econômicos;
* programador sênior de gameplay;
* programador de UI;
* engenheiro de dados;
* especialista em pathfinding;
* artista técnico de jogos isométricos;
* designer de UX;
* QA engineer;
* sound designer;
* escritor de campanhas e tutoriais.

Sua missão é projetar e implementar **OpenCaesar**, um city builder romano isométrico inspirado nos simuladores urbanos dos anos 1990.

O jogador assume o papel de governador de uma província romana e deve construir uma cidade funcional, lucrativa, saudável, culturalmente desenvolvida e capaz de sustentar diferentes classes sociais.

O jogo deve se concentrar em:

* planejamento urbano;
* construção de estradas;
* habitação e evolução residencial;
* migração e mão de obra;
* água e saneamento;
* agricultura;
* extração de recursos;
* manufatura;
* armazenamento;
* distribuição local;
* compra e venda de mercadorias;
* rotas comerciais terrestres e marítimas;
* tributação;
* orçamento público;
* saúde;
* educação;
* entretenimento;
* religião;
* desejabilidade;
* prevenção de incêndios e desabamentos;
* estabilidade social;
* objetivos de campanha;
* pedidos administrativos;
* gestão detalhada por conselheiros e overlays.

Não entregue somente documentos ou mockups. Implemente sistemas funcionais, conectados entre si e testáveis.

---

# 1. REGRA ABSOLUTA: NÃO EXISTE SISTEMA MILITAR

O OpenCaesar não deve possuir nenhuma lógica militar.

Não implementar:

* exércitos;
* legiões;
* soldados;
* arqueiros;
* cavalaria;
* invasões;
* batalhas;
* inimigos;
* combate;
* dano causado por unidades;
* fortalezas;
* quartéis;
* academias militares;
* muralhas defensivas;
* torres;
* portões militares;
* patrulhas militares;
* armas como equipamento militar;
* oficina de armas;
* conselheiro militar;
* classificação de paz baseada em invasões;
* eventos de ataque;
* pedidos de tropas;
* navios militares;
* piratas;
* bloqueios militares;
* animações de violência.

A segurança civil pode existir, mas deve ser não militar. Guardas urbanos devem:

* prevenir furtos;
* patrulhar bairros;
* acalmar protestos;
* auxiliar em evacuações;
* interditar áreas perigosas;
* acompanhar festivais;
* ajudar bombeiros.

Não deve haver combate entre guardas e cidadãos.

Substituições obrigatórias:

* “Oficina de armas” → **Metalúrgica de ferramentas**.
* “Armas” → **Ferramentas e artigos de metal**.
* “Classificação de paz” → **Estabilidade cívica**.
* “Marte” → **Vesta**, associada à proteção dos lares e prevenção de incêndios.
* Coliseu com gladiadores → **Grande Arena Cívica**, destinada a atletismo, música e festivais.
* Escola de gladiadores → **Guilda de atletas**.
* Escola de leões → não existe.
* Arco triunfal militar → **Arco Cívico**, concedido por marcos econômicos ou populacionais.

Faça uma busca no código e nos dados para garantir que nenhum sistema militar oculto, campo não utilizado ou placeholder militar permaneça.

---

# 2. IDENTIDADE E PROPRIEDADE INTELECTUAL

O jogo pode reproduzir o gênero e os princípios gerais de um city builder romano clássico, mas não deve copiar:

* sprites;
* retratos;
* mapas;
* campanhas;
* textos;
* diálogos;
* narração;
* música;
* efeitos sonoros;
* nomes fictícios;
* layout exato da interface;
* código;
* arquivos de dados;
* valores internos extraídos de outro jogo.

Utilize:

* arte original;
* ícones originais;
* textos próprios;
* missões próprias;
* personagens próprios;
* mapas próprios;
* nomenclatura própria;
* balanceamento configurável.

O nome de trabalho é **OpenCaesar**, mas todo o código deve permitir trocar facilmente o título exibido.

---

# 3. TECNOLOGIA E ARQUITETURA

Primeiro, examine o repositório existente.

Se já houver uma stack definida:

1. preserve a stack;
2. siga os padrões do projeto;
3. não reescreva módulos funcionais sem necessidade;
4. documente incompatibilidades antes de alterar a arquitetura.

Se o repositório estiver vazio, utilize uma stack apropriada para um city builder isométrico 2D. A implementação deve separar claramente:

* simulação;
* apresentação gráfica;
* interface;
* dados de balanceamento;
* persistência;
* áudio;
* input;
* campanha;
* testes.

A simulação nunca deve depender diretamente do frame rate.

Utilize um loop determinístico com passo fixo.

Estrutura conceitual mínima:

```text
Game
├── Simulation
│   ├── TimeSystem
│   ├── MapSystem
│   ├── BuildingSystem
│   ├── RoadNetworkSystem
│   ├── WalkerSystem
│   ├── PathfindingSystem
│   ├── PopulationSystem
│   ├── HousingSystem
│   ├── LaborSystem
│   ├── ProductionSystem
│   ├── StorageSystem
│   ├── DistributionSystem
│   ├── TradeSystem
│   ├── FinanceSystem
│   ├── WaterSystem
│   ├── ServiceCoverageSystem
│   ├── DesirabilitySystem
│   ├── RiskSystem
│   ├── ReligionSystem
│   ├── RatingSystem
│   ├── EventSystem
│   └── ObjectiveSystem
├── Presentation
│   ├── IsometricRenderer
│   ├── BuildingRenderer
│   ├── WalkerRenderer
│   ├── EffectsRenderer
│   ├── OverlayRenderer
│   └── CameraController
├── UI
│   ├── HUD
│   ├── BuildMenu
│   ├── Inspector
│   ├── Advisors
│   ├── EmpireMap
│   ├── Messages
│   ├── Objectives
│   └── Menus
├── Data
│   ├── Buildings
│   ├── Commodities
│   ├── HousingLevels
│   ├── Walkers
│   ├── TradeCities
│   ├── Events
│   ├── Missions
│   └── Localization
└── Persistence
    ├── SaveGame
    ├── Autosave
    └── Migration
```

Todas as definições de edifícios, mercadorias, custos, requisitos, capacidades, velocidades e tempos devem ser data-driven.

Não espalhar valores de balanceamento pelo código.

---

# 4. PILARES DE GAMEPLAY

O jogo deve obedecer aos seguintes pilares:

## 4.1 A cidade é uma rede

Edifícios isolados não funcionam.

A eficiência depende de:

* acesso a estradas;
* proximidade;
* desenho das rotas;
* acesso à mão de obra;
* distância até fornecedores;
* distância até armazenamento;
* distância até consumidores;
* cobertura dos serviços;
* capacidade de transporte.

## 4.2 Os bens existem fisicamente

Uma mercadoria não pode ser teleportada.

Ela deve percorrer uma cadeia:

```text
fonte → produtor → transportador → oficina → armazém → mercado ou comércio
```

Cada etapa deve possuir:

* estoque;
* capacidade;
* tempo de produção;
* necessidade de trabalhadores;
* acesso rodoviário;
* destino;
* veículo ou carregador visível;
* possibilidade de bloqueio logístico.

## 4.3 As casas evoluem organicamente

O jogador não constrói diretamente casas ricas.

Ele define lotes residenciais e fornece:

* água;
* alimentos;
* bens;
* serviços;
* desejabilidade.

As residências evoluem ou regridem conforme as condições reais do bairro.

## 4.4 Serviços percorrem as ruas

A maioria dos serviços não deve utilizar simplesmente um círculo invisível.

Edifícios públicos enviam walkers que percorrem estradas.

Uma residência recebe determinado serviço quando o walker correspondente passa perto dela.

## 4.5 A cidade deve mostrar seus problemas

Todo problema deve ser:

* visualizável;
* inspecionável;
* explicado;
* localizável;
* associado a uma causa concreta.

Nunca mostrar apenas “este prédio não funciona”.

Mostrar, por exemplo:

* “Faltam 6 trabalhadores.”
* “O recrutador não encontrou habitações a menos de 22 segmentos de estrada.”
* “O armazém de destino está cheio.”
* “A olaria não recebeu argila há 47 dias.”
* “A vendedora do mercado não visita esta casa há 31 dias.”
* “O reservatório não está ligado a uma fonte de água.”
* “A casa perderá acesso ao banho em 12 dias.”
* “A rota comercial atingiu a quota anual de 15 cargas.”

---

# 5. CICLO PRINCIPAL DO JOGO

O ciclo principal deve ser:

1. analisar terreno e objetivos;
2. construir estradas;
3. definir áreas residenciais;
4. fornecer água básica;
5. atrair imigrantes;
6. fornecer empregos;
7. produzir alimentos;
8. armazenar alimentos;
9. distribuir alimentos por mercados;
10. evoluir habitações;
11. arrecadar impostos;
12. extrair matérias-primas;
13. manufaturar produtos;
14. vender excedentes;
15. importar produtos indisponíveis;
16. ampliar saúde, educação, cultura e religião;
17. elevar a desejabilidade;
18. formar bairros aristocráticos;
19. cumprir pedidos e objetivos;
20. estabilizar a cidade em longo prazo.

O jogo deve permitir cidades que funcionem durante centenas de anos simulados sem intervenção constante, desde que estejam bem planejadas.

---

# 6. TEMPO E VELOCIDADE DA SIMULAÇÃO

Usar uma simulação determinística de passo fixo.

Velocidades disponíveis:

* pausa;
* 0,5×;
* 1×;
* 2×;
* 4×;
* 8×.

O jogador pode:

* construir enquanto o jogo está pausado;
* demolir enquanto está pausado;
* consultar painéis enquanto está pausado;
* alterar prioridades enquanto está pausado;
* emitir ordens comerciais enquanto está pausado.

Processamento sugerido:

* movimento de walkers: a cada tick;
* produção: diariamente;
* consumo doméstico: diariamente, agregado mensalmente;
* atualização de cobertura: quando walkers passam;
* migração: mensal;
* evolução residencial: mensal;
* salários: mensal;
* impostos: mensal, com resumo anual;
* ratings: mensal;
* quotas comerciais: anuais;
* favores divinos: mensal;
* eventos aleatórios: por agenda determinística baseada na seed.

Exibir:

* mês;
* ano;
* velocidade atual;
* indicador de pausa.

---

# 7. MAPA ISOMÉTRICO

## 7.1 Grade

Utilizar uma grade isométrica lógica.

Cada tile deve armazenar:

```text
coordinates
terrainType
elevation
fertility
resourceType
resourceAmount
waterDepth
road
aqueduct
buildingId
desirability
fireRisk
collapseRisk
pollution
traffic
serviceCoverage
ownership
blocked
```

## 7.2 Tipos de terreno

Implementar:

* terra comum;
* terra fértil;
* terra muito fértil;
* areia;
* rocha;
* floresta;
* margem de rio;
* rio navegável;
* rio não navegável;
* lago;
* costa;
* mar;
* elevação;
* penhasco;
* pântano opcional;
* terreno bloqueado por cenário.

## 7.3 Recursos naturais

Mapas podem possuir:

* áreas agrícolas;
* argila;
* madeira;
* minério de ferro;
* mármore;
* água;
* pesca;
* oliveiras cultiváveis;
* vinhas cultiváveis.

Nem todos os mapas devem possuir todos os recursos.

A ausência de um recurso deve incentivar importações.

## 7.4 Pontos especiais do mapa

Cada missão pode definir:

* ponto de entrada de imigrantes;
* ponto de saída de emigrantes;
* entrada de caravanas;
* saída de caravanas;
* entrada de navios;
* saída de navios;
* curso navegável;
* local da cidade provincial;
* ruínas;
* monumentos antigos;
* áreas protegidas;
* terrenos indisponíveis.

---

# 8. CÂMERA E CONTROLES

Implementar:

* deslocamento por WASD;
* deslocamento pelas setas;
* pan com botão central;
* pan ao aproximar o cursor das bordas, configurável;
* zoom pela roda;
* zoom por teclado;
* foco no edifício selecionado;
* retorno ao centro administrativo;
* minimapa clicável;
* rotação opcional somente se os assets permitirem;
* modo de visualização de edifícios transparentes;
* opção de esconder árvores;
* opção de esconder walkers;
* opção de reduzir animações.

Construção:

* clique para colocar;
* clicar e arrastar estradas;
* clicar e arrastar aquedutos;
* clicar e arrastar praças;
* preview verde/vermelho;
* custo total antes de confirmar;
* indicação do footprint;
* indicação de acesso a estrada;
* indicação de terreno incompatível;
* tecla Shift para construir repetidamente;
* tecla Alt para ignorar snap opcional;
* botão direito ou Escape para cancelar;
* desfazer apenas ações de construção recentes enquanto o tempo estiver pausado e antes de a simulação consumir o resultado.

Demolição:

* ferramenta individual;
* demolição por área;
* confirmação para edifícios importantes;
* custo de remoção opcional;
* reembolso parcial configurável;
* nunca remover acidentalmente monumentos ou edifícios administrativos sem confirmação.

---

# 9. ESTRADAS E PATHFINDING

## 9.1 Rede viária

Todo edifício operacional deve possuir acesso a uma estrada a no máximo um tile de uma entrada válida.

A rede deve ser representada como grafo.

Atualizar apenas regiões afetadas quando:

* uma estrada é construída;
* uma estrada é demolida;
* uma ponte é construída;
* um bloqueio é ativado;
* um edifício muda sua entrada.

Evitar recalcular todo o mapa a cada alteração.

## 9.2 Tipos de estrada

Implementar:

* estrada de terra;
* estrada pavimentada;
* praça;
* ponte;
* bloqueio de serviço;
* acesso ao cais;
* escadaria, caso haja elevações.

Efeitos:

* estrada de terra: velocidade normal;
* estrada pavimentada: pequena melhoria de velocidade e desejabilidade;
* praça: desejabilidade alta e velocidade normal;
* ponte: conecta margens;
* bloqueio: restringe walkers de serviço, mas pode permitir carregadores e comerciantes conforme configuração.

## 9.3 Categorias de agentes

### Walker errante

Sai de um edifício e percorre estradas próximas.

Usado por:

* sacerdote;
* professor;
* bibliotecário;
* médico;
* barbeiro;
* atendente do banho;
* engenheiro;
* bombeiro;
* guarda urbano;
* coletor de impostos;
* vendedor de mercado;
* artista;
* atleta;
* músico.

### Walker de destino

Escolhe um destino e encontra o menor caminho válido.

Usado por:

* comprador de mercado;
* carregador;
* carroceiro;
* imigrante;
* emigrante;
* comerciante terrestre;
* funcionário do cais;
* mensageiro;
* entregador de pedidos.

### Recrutador

Procura habitações próximas para estabelecer acesso à mão de obra.

O recrutador não representa cada trabalhador individualmente. Ele determina se o edifício está conectado à força de trabalho urbana.

## 9.4 Regras de walkers errantes

Cada tipo deve possuir dados configuráveis:

```text
maximumRoadSteps
serviceTTL
spawnInterval
movementSpeed
allowedRoadTypes
roadblockPolicy
serviceRadiusFromCurrentTile
preferredDirection
returnPolicy
```

Ao passar por uma casa, o walker renova o tempo de acesso ao serviço.

Exemplo:

```text
house.serviceAccess["bath"] = 45 dias
house.serviceAccess["doctor"] = 60 dias
house.serviceAccess["religion_ceres"] = 50 dias
```

O valor diminui diariamente.

Quando chega a zero, a casa perde o serviço.

## 9.5 Escolha de caminhos

O caminho de walkers errantes deve ser determinístico para a mesma seed e mesmo estado.

Em cruzamentos:

1. evitar retornar imediatamente;
2. respeitar bloqueios;
3. preferir caminhos ainda não visitados na viagem;
4. utilizar uma ordem pseudoaleatória estável;
5. retornar ao edifício ao atingir o limite;
6. não ficar preso em loops infinitos.

## 9.6 Debug de caminhos

Adicionar modo de debug que mostre:

* grafo rodoviário;
* path atual;
* destino;
* distância restante;
* tiles visitados;
* motivo da escolha;
* bloqueios;
* alcance máximo;
* casas cobertas;
* falhas de pathfinding.

---

# 10. POPULAÇÃO

## 10.1 Modelo populacional

A população é armazenada principalmente por residência, e não como milhares de agentes individuais.

Cada casa deve possuir:

```text
population
capacity
socialClass
ageDistribution
employedAdults
unemployedAdults
children
elderly
taxableIncome
foodInventory
goodsInventory
serviceAccess
desirability
sentiment
crimeRisk
healthRisk
```

Walkers visuais são representações da atividade urbana e não precisam corresponder um a um aos habitantes.

## 10.2 Faixas etárias

Manter:

* 0–5 anos;
* 6–11 anos;
* 12–15 anos;
* 16–25 anos;
* 26–40 anos;
* 41–60 anos;
* acima de 60 anos.

Regras:

* 6–11 demandam escola;
* 12–15 demandam escola ou academia, conforme classe;
* 16–60 podem integrar a força de trabalho;
* aristocratas não integram a força de trabalho comum;
* idosos e crianças não trabalham.

## 10.3 Migração

Calcular um índice de atratividade:

```text
attractiveness =
availableHousing
+ wageComparison
+ foodSecurity
+ health
+ cityMood
+ serviceQuality
+ employmentAvailability
+ prosperity
- taxPressure
- unemploymentPenalty
- homelessness
- disease
- unrest
- repeatedDisasters
```

Imigração ocorre quando:

* existem vagas residenciais;
* a atratividade é positiva;
* a entrada da cidade está conectada por estrada;
* não há crise severa;
* o jogador não bloqueou imigração, caso a missão permita esse controle.

Emigração ocorre quando:

* casas regridem e perdem capacidade;
* impostos estão excessivos;
* salários são muito inferiores ao padrão;
* falta alimento;
* há desemprego prolongado;
* há doença;
* a cidade está em déficit persistente;
* a estabilidade cívica está muito baixa.

Mostrar no mapa famílias entrando e saindo com seus pertences.

## 10.4 Desabrigados

Quando uma casa perde capacidade:

1. seus moradores procuram outra residência com vaga;
2. preferem moradia de nível semelhante;
3. aceitam moradia inferior se necessário;
4. se não encontrarem vaga, tornam-se desabrigados;
5. desabrigados diminuem estabilidade, saúde e atratividade;
6. após determinado tempo, deixam a cidade.

---

# 11. HABITAÇÃO E EVOLUÇÃO RESIDENCIAL

## 11.1 Colocação

O jogador coloca lotes residenciais de 1×1.

Imigrantes ocupam lotes ligados à estrada.

Casas adjacentes podem fundir-se em lotes maiores quando:

* possuem nível compatível;
* todos os tiles pertencem ao mesmo bloco;
* não existe edifício bloqueando;
* existe espaço para o footprint;
* a fusão é necessária para o próximo nível;
* a opção de fusão não está desativada pelo jogador.

Permitir marcar lotes como:

* permitir evolução;
* limitar nível máximo;
* impedir fusão;
* priorizar trabalhadores;
* reservar para aristocratas, somente em cenários avançados.

## 11.2 Requisitos cumulativos

Todos os requisitos são cumulativos.

Uma residência evolui quando:

* possui todos os bens exigidos;
* possui acesso ativo a todos os serviços exigidos;
* satisfaz a desejabilidade mínima;
* está ocupada;
* não possui risco extremo;
* permanece elegível pelo período mínimo configurado.

Uma residência regride quando:

* perde requisitos por mais que o período de tolerância;
* sua desejabilidade cai abaixo do limite de regressão;
* falta alimento;
* serviços essenciais ficam ausentes;
* ocorre dano estrutural prolongado.

Utilizar histerese:

* limite de evolução maior;
* limite de regressão menor;
* período de carência de 1–3 meses.

Isso evita evolução e regressão contínuas.

## 11.3 Progressão residencial inicial

Utilizar esta tabela como balanceamento inicial. Todos os valores devem ficar em dados editáveis.

| Nível | Nome               | Footprint | Capacidade | Novo requisito principal                        |
| ----- | ------------------ | --------: | ---------: | ----------------------------------------------- |
| 0     | Lote vazio         |       1×1 |          0 | Estrada e imigrantes                            |
| 1     | Tenda pequena      |       1×1 |          5 | Ocupação                                        |
| 2     | Tenda grande       |       1×1 |          7 | Poço ou fonte                                   |
| 3     | Cabana pequena     |       1×1 |          9 | Um tipo de alimento                             |
| 4     | Cabana grande      |       1×1 |         11 | Um culto religioso                              |
| 5     | Casebre pequeno    |       1×1 |         13 | Água de fonte                                   |
| 6     | Casebre grande     |       1×1 |         15 | Entretenimento básico                           |
| 7     | Casa simples       |       1×1 |         17 | Escola ou biblioteca                            |
| 8     | Casa urbana        |       1×1 |         19 | Banho público e cerâmica                        |
| 9     | Ínsula pequena     |       1×1 |         19 | Dois tipos de entretenimento                    |
| 10    | Ínsula média       |       1×1 |         20 | Médico ou hospital e mobiliário                 |
| 11    | Ínsula grande      |       2×2 |         84 | Escola, biblioteca, barbeiro e azeite           |
| 12    | Ínsula nobre       |       2×2 |         84 | Dois alimentos e entretenimento elevado         |
| 13    | Vila pequena       |       2×2 |         40 | Vinho e acesso a dois cultos                    |
| 14    | Vila média         |       2×2 |         42 | Médico e hospital                               |
| 15    | Vila grande        |       3×3 |         90 | Academia e cultura elevada                      |
| 16    | Vila aristocrática |       3×3 |        100 | Três alimentos e três cultos                    |
| 17    | Palácio urbano     |       3×3 |        106 | Duas variedades de vinho                        |
| 18    | Palácio senatorial |       3×3 |        112 | Quatro cultos e cultura muito elevada           |
| 19    | Grande palácio     |       4×4 |        190 | Grande Arena Cívica                             |
| 20    | Palácio luxuoso    |       4×4 |        200 | Todos os bens, serviços e desejabilidade máxima |

## 11.4 Classes sociais

### Plebeus

Moram entre tendas e ínsulas.

* fornecem trabalhadores;
* pagam impostos moderados;
* demandam alimento e serviços;
* possuem maior densidade populacional.

### Patrícios

Moram em vilas e palácios.

* não trabalham em empregos comuns;
* pagam impostos muito maiores;
* aumentam prosperidade;
* exigem serviços sofisticados;
* consomem vinho e bens de luxo;
* ocupam mais espaço por pessoa.

A transição de uma ínsula para vila pode reduzir a capacidade temporariamente. O sistema deve deslocar moradores excedentes.

## 11.5 Inventário doméstico

Casas armazenam quantidades abstratas de bens.

Exemplo:

```text
food_wheat: dias restantes
food_fruit: dias restantes
pottery: meses restantes
furniture: meses restantes
oil: meses restantes
wine_local: meses restantes
wine_imported: meses restantes
```

Alimentos são consumidos mais rapidamente.

Bens duráveis devem durar vários meses.

A interface da casa deve mostrar:

* estoque atual;
* consumo mensal;
* tempo restante;
* última entrega;
* mercado responsável;
* produto que está bloqueando a evolução.

---

# 12. DESEJABILIDADE

Cada tile deve possuir um valor de desejabilidade calculado a partir de influências radiais.

Um edifício pode fornecer:

```text
baseEffect
radius
falloffPerTile
minimumEffect
```

Influências positivas:

* jardins;
* praças;
* fontes ornamentais;
* estátuas;
* templos;
* oráculos;
* escolas;
* bibliotecas;
* academias;
* banhos;
* teatro;
* prédios administrativos;
* residências do governador;
* monumentos;
* margem de água limpa;
* terrenos elevados;
* casas aristocráticas.

Influências negativas:

* indústria;
* minas;
* pedreiras;
* armazéns;
* granários;
* mercados muito próximos;
* cais;
* tráfego;
* poços;
* lixo;
* incêndios;
* edifícios abandonados;
* desabrigados;
* doença;
* crime;
* áreas muito barulhentas.

Calcular incrementalmente quando edifícios são construídos ou removidos.

O inspector de uma casa deve decompor o valor:

```text
Desejabilidade total: 47

+18 Grande jardim
+12 Templo de Vênus
+8 Praça pavimentada
+5 Vista para o rio
+4 Fonte ornamental
-9 Mercado
-6 Armazém
-3 Tráfego
```

Nunca mostrar somente o total.

---

# 13. MÃO DE OBRA

## 13.1 Força de trabalho

Força de trabalho disponível:

```text
adultos plebeus entre 16 e 60
- incapacitados temporários
- trabalhadores já empregados
```

Patrícios não trabalham.

## 13.2 Acesso à mão de obra

Um edifício só pode contratar quando seu recrutador consegue alcançar uma residência plebeia pela estrada.

Configuração inicial:

* alcance máximo do recrutador: 22 segmentos;
* estrada pavimentada pode aumentar levemente o alcance;
* caminho deve ser contínuo;
* bloqueios podem impedir recrutadores;
* uma vez conectado, o edifício participa do pool urbano de mão de obra.

Mostrar:

* distância à residência alcançada;
* última tentativa;
* path do recrutador;
* quantidade solicitada;
* quantidade recebida.

## 13.3 Eficiência

```text
staffingRatio = workersAssigned / workersRequired
```

Efeito inicial:

* 0%: inativo;
* 1–24%: funcionamento mínimo;
* 25–49%: baixa eficiência;
* 50–74%: eficiência parcial;
* 75–99%: quase completo;
* 100%: produção integral.

Utilizar interpolação contínua para produção.

Alguns edifícios só enviam walkers acima de um limiar mínimo.

## 13.4 Setores de trabalho

Categorias:

* abastecimento de água;
* agricultura;
* extração;
* manufatura;
* armazenamento e mercados;
* comércio;
* engenharia;
* incêndio e segurança civil;
* saúde;
* educação;
* entretenimento;
* religião;
* administração;
* ornamentação e monumentos.

## 13.5 Prioridades

O Conselheiro de Trabalho deve permitir:

* ordenar setores por drag and drop;
* atribuir prioridade de 1 a 5;
* fixar quantidade mínima de trabalhadores;
* pausar um setor;
* restaurar prioridade automática;
* visualizar impacto antes de confirmar.

Quando faltam trabalhadores, alocar primeiro aos setores prioritários.

## 13.6 Salários e desemprego

Permitir ajustar salário urbano.

Mostrar comparação com salário de referência imperial:

* muito abaixo;
* abaixo;
* igual;
* acima;
* muito acima.

Salário afeta:

* atração de imigrantes;
* humor;
* despesas;
* retenção de trabalhadores.

Faixa saudável de desemprego inicial:

* 2–8%: equilibrado;
* 9–14%: atenção;
* 15–24%: alto;
* acima de 25%: crise;
* abaixo de 2%: escassez de mão de obra.

---

# 14. ÁGUA

## 14.1 Poço

* fornece água básica;
* não exige rede;
* possui alcance local;
* atende níveis residenciais baixos;
* reduz levemente desejabilidade;
* não é suficiente para bairros ricos;
* pode ter risco sanitário em regiões poluídas.

## 14.2 Reservatório

* footprint 3×3;
* precisa tocar uma fonte de água ou receber aqueduto;
* armazena água;
* alimenta aquedutos e fontes;
* mostra entrada, saída e nível.

## 14.3 Aqueduto

* construído tile a tile;
* conecta reservatórios;
* pode cruzar estrada por arco;
* não atravessa edifícios;
* pode elevar-se sobre depressões se suportado;
* fornece visualização clara do fluxo;
* pode ser demolido por segmento.

## 14.4 Fonte

* exige conexão à rede;
* fornece água limpa em raio;
* aumenta desejabilidade;
* atende habitações intermediárias e avançadas;
* desliga se perder água ou trabalhadores.

## 14.5 Banho público

* exige água de reservatório;
* exige trabalhadores;
* envia atendente pelas estradas;
* fornece serviço de banho;
* melhora saúde e desejabilidade;
* consome pequena quantidade de água.

## 14.6 Overlay de água

Mostrar:

* fontes naturais;
* reservatórios cheios ou vazios;
* aquedutos ativos;
* aquedutos sem fluxo;
* fontes ligadas;
* cobertura de poço;
* cobertura de fonte;
* casas sem água;
* casas com água básica;
* casas com água limpa;
* edifícios consumidores.

---

# 15. AGRICULTURA E ALIMENTOS

## 15.1 Tipos de alimento

Implementar inicialmente:

* trigo;
* vegetais;
* frutas;
* carne;
* peixe, em mapas costeiros ou fluviais.

Residências de nível baixo precisam de um alimento.

Residências intermediárias demandam dois.

Residências aristocráticas demandam três ou mais.

## 15.2 Fazendas

Tipos:

* fazenda de trigo;
* fazenda de vegetais;
* pomar;
* criação de animais;
* fazenda de oliveiras;
* vinha.

Regras:

* precisam de terreno fértil, exceto criação de animais;
* eficiência depende da fertilidade média do footprint;
* precisam de trabalhadores;
* precisam de acesso rodoviário;
* produzem cargas físicas;
* enviam cargas a granários, oficinas ou armazéns;
* podem ser pausadas.

Fórmula inicial:

```text
produção =
taxaBase
× fertilidadeMédia
× staffingRatio
× modificadorReligioso
× modificadorDeEvento
```

## 15.3 Pesca

Cais pesqueiro:

* deve tocar água navegável;
* envia barco de pesca;
* possui tempo de viagem;
* retorna com peixe;
* transfere peixe ao granário;
* pode ser afetado por baixa produtividade do rio.

Não existe combate naval.

## 15.4 Granário

O granário armazena somente alimentos.

Capacidade deve ser dividida em cargas.

Comandos por alimento:

* aceitar;
* recusar;
* solicitar;
* manter quantidade;
* esvaziar;
* reservar para consumo local;
* permitir exportação;
* prioridade alta ou baixa.

Mostrar visualmente o conteúdo do granário.

---

# 16. EXTRAÇÃO E MANUFATURA

## 16.1 Cadeias produtivas

Implementar:

```text
Argila → Olaria → Cerâmica
Madeira → Carpintaria → Mobiliário
Azeitonas → Prensa de azeite → Azeite
Uvas → Adega → Vinho
Minério de ferro → Metalúrgica → Ferramentas
Mármore → Armazém, construção ou exportação
```

Alimentos:

```text
Fazenda → Granário → Mercado → Casas
```

## 16.2 Extração

### Poço de argila

* somente próximo de depósitos válidos;
* produz argila;
* impacto negativo na desejabilidade;
* envia à olaria ou armazém.

### Pátio de madeira

* somente próximo de floresta;
* pode consumir recurso renovável ou representar manejo sustentável configurável;
* envia madeira à carpintaria ou armazém.

### Mina de ferro

* somente em terreno mineral;
* produz minério;
* alta necessidade de trabalhadores;
* alto impacto visual e de desejabilidade.

### Pedreira de mármore

* somente em rocha apropriada;
* produz mármore;
* produto de alto valor;
* usado em monumentos e comércio.

## 16.3 Oficinas

Cada oficina deve possuir:

* estoque interno de matéria-prima;
* capacidade de entrada;
* progresso da produção;
* estoque de saída;
* carregador;
* destino preferido;
* quantidade produzida;
* eficiência;
* tempo desde a última entrega.

Uma carga de matéria-prima gera uma carga de produto, salvo configuração diferente.

Balanceamento inicial:

* um produtor de matéria-prima plenamente operante sustenta aproximadamente duas oficinas;
* oficinas são mais intensivas em mão de obra;
* produto manufaturado vale mais do que matéria-prima;
* gargalos de transporte reduzem produção real.

## 16.4 Seleção de destino

Quando uma carga fica pronta:

1. procurar oficina que aceite a matéria-prima;
2. priorizar oficina mais próxima e necessitada;
3. se não houver, procurar armazém;
4. respeitar ordens especiais;
5. respeitar capacidade;
6. se nenhum destino existir, manter carga e marcar prédio como bloqueado.

Não destruir mercadorias silenciosamente.

---

# 17. ARMAZÉNS E LOGÍSTICA

## 17.1 Unidade logística

Definir a unidade padrão como **uma carga**.

Uma carga pode representar uma quantidade abstrata, por exemplo 100 unidades.

Todos os relatórios devem exibir:

* cargas;
* capacidade total;
* espaço livre;
* quantidade reservada;
* quantidade em trânsito.

## 17.2 Armazém

Footprint inicial: 3×3.

Possui pátios ou slots visuais.

Cada slot armazena uma carga de uma mercadoria.

Mercadorias:

* argila;
* madeira;
* minério de ferro;
* mármore;
* cerâmica;
* mobiliário;
* azeite;
* vinho local;
* vinho importado;
* ferramentas.

## 17.3 Ordens por mercadoria

Cada armazém deve permitir configurar individualmente:

### Aceitar

Recebe entregas normalmente e pode enviar mercadorias.

### Recusar

Não recebe novas entregas, mas continua enviando o estoque existente.

### Solicitar

Tenta receber mercadoria de outros armazéns ou produtores.

### Manter

Tenta manter uma quantidade definida.

Exemplo:

```text
Manter 8 cargas de cerâmica.
```

Se estiver abaixo da meta, torna-se destino prioritário.

### Esvaziar

Não recebe novas cargas e tenta remover todo o estoque.

### Reservar

Não permite que a mercadoria seja:

* exportada;
* distribuída;
* consumida por oficinas não prioritárias.

Utilizado para pedidos administrativos ou monumentos.

## 17.4 Centro comercial

A cidade deve possuir um único armazém designado como **Centro Comercial**.

Funções:

* destino preferido de importações terrestres;
* referência logística para comerciantes;
* ponto principal de descarga;
* pode ser alterado pelo jogador.

Se estiver cheio:

* procurar armazém alternativo que aceite o produto;
* mostrar aviso;
* nunca descartar a importação sem explicação.

## 17.5 Tela logística

Criar uma tela específica com:

* estoque total por produto;
* estoque por edifício;
* produção mensal;
* consumo mensal;
* importação mensal;
* exportação mensal;
* cargas em trânsito;
* capacidade ocupada;
* gargalos;
* edifícios parados;
* tempo médio de entrega;
* mapa de fluxo.

Permitir clicar em qualquer número para localizar os edifícios correspondentes.

---

# 18. MERCADOS E DISTRIBUIÇÃO DOMÉSTICA

## 18.1 Funcionários do mercado

Cada mercado possui:

### Comprador

Walker de destino.

Funções:

* procura alimento em granários;
* procura bens em armazéns;
* busca produtos demandados pelas casas atendidas;
* retorna ao mercado;
* atualiza estoque interno.

### Vendedor

Walker errante.

Funções:

* percorre bairros;
* identifica demanda;
* distribui alimentos e bens;
* reduz estoque interno;
* renova o estoque doméstico;
* retorna quando fica sem mercadorias ou alcança limite.

## 18.2 Estoque interno

O mercado deve possuir inventário separado:

* alimentos por tipo;
* cerâmica;
* mobiliário;
* azeite;
* vinho.

Mostrar:

* quantidade atual;
* capacidade;
* consumo recente;
* casas atendidas;
* produto mais solicitado;
* fornecedor atual;
* comprador em viagem;
* vendedor em viagem.

## 18.3 Seleção de fornecedor

O comprador deve:

1. consultar demanda do bairro;
2. selecionar o produto mais urgente;
3. procurar o granário ou armazém mais próximo que aceite retirada;
4. reservar a carga;
5. seguir até o destino;
6. coletar;
7. retornar.

Evitar múltiplos compradores reservando a mesma carga.

## 18.4 Distribuição

Ao passar próximo de uma casa, o vendedor:

1. verifica quais produtos a casa aceita;
2. verifica seu estoque;
3. entrega primeiro alimento essencial;
4. depois entrega o bem que bloqueia evolução;
5. depois completa reservas;
6. atualiza telemetria.

## 18.5 Configurações do mercado

Permitir:

* aceitar ou recusar alimentos específicos;
* aceitar ou recusar bens específicos;
* prioridade de compra;
* estoque-alvo;
* raio máximo do comprador;
* bloquear vinho para bairros plebeus;
* destacar rota do vendedor;
* selecionar granário preferencial;
* selecionar armazém preferencial.

---

# 19. COMÉRCIO EXTERNO

## 19.1 Mapa regional

Criar uma tela chamada **Mapa do Império** ou **Mapa Regional**.

Exibir:

* cidade do jogador;
* cidades comerciais;
* estradas regionais;
* rotas marítimas;
* ícones de mercadorias;
* custo de abertura;
* capacidade anual;
* distância;
* tempo estimado;
* estado da rota.

Cada cidade comercial define:

```text
goodsBought
goodsSold
annualQuotaPerGood
landOrSea
routeOpeningCost
merchantFrequency
priceModifiers
relationship
events
```

## 19.2 Abertura de rota

Para abrir:

1. selecionar cidade;
2. visualizar produtos;
3. visualizar preços;
4. visualizar quotas;
5. pagar custo;
6. confirmar;
7. rota fica ativa.

Uma rota aberta não deve obrigar compra ou venda. O jogador ainda precisa configurar produtos.

## 19.3 Comércio terrestre

Caravana:

* entra pelo ponto regional;
* segue por estradas;
* visita o Centro Comercial ou armazéns;
* compra exportações;
* entrega importações;
* respeita capacidade;
* sai do mapa.

Capacidade inicial sugerida: 8 cargas.

Se não existir estrada válida:

* caravana espera por período limitado;
* exibe mensagem;
* sai sem negociar;
* rota permanece aberta.

## 19.4 Comércio marítimo

Navio mercante:

* entra pelo rio ou mar;
* dirige-se a um cais;
* não pode atravessar pontes baixas;
* espera vaga;
* descarrega importações;
* solicita exportações;
* funcionários do cais buscam cargas em armazéns;
* parte quando termina ou alcança timeout.

Capacidade inicial sugerida: 16 cargas.

## 19.5 Cais comercial

O cais deve mostrar:

* navio atual;
* fila de navios;
* capacidade;
* trabalhadores;
* mercadoria solicitada;
* cargas recebidas;
* cargas pendentes;
* armazém de origem;
* rota marítima;
* tempo de espera;
* obstruções no rio.

## 19.6 Ordens comerciais

Para cada mercadoria:

### Não comercializar

Nenhuma importação ou exportação.

### Exportar tudo

Vender qualquer estoque disponível, respeitando reservas.

### Exportar acima de reserva

Exemplo:

```text
Exportar cerâmica acima de 12 cargas.
```

### Importar até meta

Exemplo:

```text
Importar azeite até 16 cargas.
```

### Estocar

Proibir exportação e distribuição doméstica.

### Permitir consumo prioritário

Reservar primeiro para casas ou oficinas antes de exportar.

## 19.7 Quotas anuais

Cada rota possui limites anuais por produto.

Exibir:

```text
Cerâmica exportada: 12/15
Vinho importado: 8/25
Mármore exportado: 30/40
```

Ao atingir a quota:

* suspender transações daquele produto;
* manter outras mercadorias;
* mostrar próximo reset;
* reiniciar no início do ano.

## 19.8 Preços

Cada produto possui:

* preço de importação;
* preço de exportação;
* histórico;
* tendência;
* diferença de preço;
* rotas disponíveis.

Importar deve custar mais do que exportar o mesmo produto, impedindo arbitragem trivial.

Eventos podem modificar preços temporariamente.

## 19.9 Reservas e transações

Uma exportação só ocorre quando:

* mercadoria existe;
* não está reservada;
* limiar de exportação foi atingido;
* quota está disponível;
* comerciante possui capacidade;
* armazém é alcançável.

Uma importação só ocorre quando:

* estoque está abaixo da meta;
* quota está disponível;
* tesouro possui dinheiro;
* existe armazenamento;
* armazém aceita o produto.

---

# 20. FINANÇAS

## 20.1 Receitas

Implementar:

* impostos;
* exportações;
* recompensas administrativas;
* doações do governador;
* subsídios excepcionais;
* eventos positivos.

## 20.2 Despesas

Implementar:

* construção;
* salários;
* importações;
* abertura de rotas;
* festivais;
* manutenção opcional;
* juros;
* salário do governador;
* pedidos;
* reparos emergenciais;
* eventos.

## 20.3 Impostos

A renda tributável depende do nível residencial.

Cada nível possui multiplicador.

Uma casa somente paga imposto se:

* estiver ocupada;
* um coletor de impostos tiver passado recentemente;
* estiver registrada;
* não estiver em período de isenção.

Coletores saem de:

* fórum;
* senado;
* repartição fiscal opcional.

A tela deve mostrar:

* taxa;
* população registrada;
* porcentagem de cobertura;
* receita potencial;
* receita efetiva;
* perda por falta de cobertura;
* impacto no humor;
* impostos por classe;
* impostos por bairro.

## 20.4 Tesouro

Mostrar sempre:

* saldo;
* variação mensal;
* projeção anual;
* dívida;
* juros;
* reserva mínima;
* alertas.

## 20.5 Dívida

Quando o saldo fica negativo:

* aplicar juros;
* reduzir favor administrativo;
* emitir alerta;
* permitir resgate limitado;
* tornar novos empréstimos progressivamente piores;
* não encerrar imediatamente a partida.

Déficit persistente pode causar derrota.

## 20.6 Salário do governador

O jogador pode selecionar salário:

* nenhum;
* modesto;
* padrão;
* elevado;
* extravagante.

O salário vai para uma conta pessoal abstrata.

O jogador pode:

* doar dinheiro pessoal à cidade;
* enviar presentes à administração imperial;
* financiar um festival.

Evitar que presentes sejam uma forma ilimitada de explorar favor.

---

# 21. INCÊNDIOS, DESABAMENTOS E SEGURANÇA CIVIL

## 21.1 Incêndio

Cada edifício possui risco de incêndio.

O risco aumenta por:

* tempo;
* material inflamável;
* falta de inspeção;
* seca;
* proximidade de indústria;
* baixa cobertura de água;
* evento.

O risco diminui quando o bombeiro passa.

Ao ocorrer incêndio:

* exibir chamas;
* evacuar moradores;
* bloquear operação;
* espalhar para edifícios próximos conforme configuração;
* permitir resposta de brigadas;
* destruir edifício se não controlado.

## 21.2 Brigada urbana

Edifício civil responsável por:

* prevenção de incêndios;
* inspeções;
* resposta a incêndios;
* evacuação;
* redução de risco.

Não possui função militar.

## 21.3 Desabamento

Todo edifício envelhece estruturalmente.

Engenheiros renovam a inspeção.

Sem cobertura:

* risco aumenta;
* aparecem rachaduras;
* surge aviso;
* edifício pode colapsar.

## 21.4 Posto de engenharia

Envia engenheiro walker.

Ao passar:

* reduz risco de colapso;
* registra inspeção;
* identifica edifícios críticos.

## 21.5 Crime e ordem civil

Crime depende de:

* desemprego;
* pobreza;
* impostos;
* falta de alimento;
* baixa estabilidade;
* baixa cobertura administrativa;
* desigualdade;
* desabrigados.

Eventos possíveis:

* furto em fórum;
* furto em mercado;
* vandalismo;
* protesto;
* greve;
* dano a jardim;
* bloqueio temporário de estrada.

Guardas urbanos:

* patrulham;
* diminuem risco;
* acalmam protestos;
* recuperam parte de mercadorias roubadas;
* não atacam cidadãos.

---

# 22. SAÚDE

Edifícios:

* banho público;
* barbeiro;
* clínica;
* hospital.

## 22.1 Barbeiro

* serviço básico;
* walker errante;
* melhora higiene;
* exigido por casas intermediárias.

## 22.2 Clínica

* atendimento local;
* envia médico;
* reduz risco de doença;
* exigida por casas intermediárias.

## 22.3 Hospital

* capacidade regional;
* trata surtos;
* atende grande população;
* exigido por bairros ricos;
* consome mais trabalhadores.

## 22.4 Saúde da cidade

Calcular com:

* variedade alimentar;
* acesso a água limpa;
* banho;
* clínica;
* hospital;
* densidade;
* poluição;
* esgoto ou higiene abstrata;
* presença de cadáveres, que não deve ser gráfica;
* eventos epidêmicos.

Estados:

* excelente;
* boa;
* razoável;
* preocupante;
* ruim;
* epidêmica.

## 22.5 Surtos

Um surto pode:

* reduzir trabalhadores;
* aumentar mortalidade;
* reduzir migração;
* elevar demanda hospitalar;
* gerar pedidos emergenciais.

Deve existir causa ou probabilidade explicável.

---

# 23. EDUCAÇÃO

Edifícios:

* escola;
* biblioteca;
* academia.

## 23.1 Escola

* atende crianças;
* envia professor;
* capacidade limitada;
* pequena penalidade de ruído próximo;
* exigida por casas em evolução.

## 23.2 Biblioteca

* atende adultos e jovens;
* envia bibliotecário;
* aumenta cultura;
* melhora desejabilidade;
* atende grande população.

## 23.3 Academia

* atende adolescentes de classes elevadas;
* aumenta cultura e prosperidade;
* exigida por vilas avançadas;
* capacidade reduzida e custo alto.

## 23.4 Capacidade e cobertura

Distinguir:

* capacidade global;
* cobertura local.

Uma cidade pode possuir vagas suficientes, mas uma casa ainda não receber o walker.

Mostrar as duas métricas separadamente.

---

# 24. ENTRETENIMENTO

Não utilizar entretenimento militar ou violento.

Edifícios de treinamento:

* companhia de atores;
* escola de música;
* guilda de atletas;
* estábulos de corrida.

Locais:

* teatro;
* auditório;
* anfiteatro cívico;
* arena cívica;
* hipódromo.

## 24.1 Funcionamento

Locais precisam de:

* trabalhadores;
* estrada;
* artista ou equipe compatível;
* capacidade;
* tempo entre apresentações.

Exemplo:

```text
Companhia de atores → envia atores → teatro
Escola de música → envia músicos → auditório
Guilda de atletas → envia atletas → arena
Estábulos → enviam equipes → hipódromo
```

O local envia um walker de divulgação ou cobertura pelas ruas.

## 24.2 Pontuação

Cada casa acumula pontos de entretenimento por tipo.

Apenas construir o edifício não basta. Ele precisa:

* funcionar;
* receber artistas;
* enviar cobertura;
* ter capacidade.

Evitar que dez edifícios idênticos substituam completamente variedade cultural.

## 24.3 Festivais

Tipos:

* pequeno;
* médio;
* grande;
* festival provincial.

Custos:

* dinheiro;
* vinho opcional;
* preparação;
* trabalhadores opcionais.

Efeitos:

* humor;
* religião;
* cultura;
* comércio local;
* produtividade temporária;
* desejabilidade temporária.

A tela deve mostrar:

* última realização;
* divindade homenageada;
* custo;
* duração;
* bônus esperado;
* tempo de preparação.

---

# 25. RELIGIÃO

Cultos:

* Ceres: agricultura e alimento;
* Netuno: água, pesca e comércio marítimo;
* Mercúrio: comércio e logística;
* Vesta: lares, estabilidade e proteção contra incêndio;
* Vênus: humor, cultura e atração migratória.

## 25.1 Edifícios

* templo pequeno;
* templo grande;
* oráculo;
* praça de festivais.

Templos enviam sacerdotes.

Oráculos:

* não enviam walkers;
* aumentam favor de todos;
* exigem mármore;
* elevam desejabilidade.

## 25.2 Favor

Cada divindade possui valor de 0 a 100.

Afetado por:

* quantidade de templos;
* tamanho dos templos;
* população;
* tempo desde último festival;
* cobertura;
* negligência;
* eventos.

Estados:

* furioso;
* descontente;
* indiferente;
* satisfeito;
* honrado;
* exaltado.

## 25.3 Bênçãos e penalidades

### Ceres

Bênção:

* colheita aumentada;
* granários preservam mais alimento.

Penalidade:

* redução temporária na agricultura.

### Netuno

Bênção:

* navios mais frequentes;
* pesca melhor.

Penalidade:

* atraso comercial ou baixa pesca.

### Mercúrio

Bênção:

* melhores preços de exportação;
* carregadores mais eficientes.

Penalidade:

* redução temporária das quotas ou atraso logístico.

### Vesta

Bênção:

* redução de risco de incêndio;
* estabilidade residencial.

Penalidade:

* risco de incêndio ligeiramente maior.

### Vênus

Bênção:

* aumento de humor;
* imigração;
* cultura.

Penalidade:

* queda de humor ou menor entretenimento.

Penalidades nunca devem ser instantaneamente devastadoras.

---

# 26. ADMINISTRAÇÃO E GOVERNO

Edifícios:

* fórum;
* senado;
* residência do governador;
* palácio do governador;
* mansão provincial;
* repartição de registros opcional.

## 26.1 Fórum

* envia coletores;
* armazena impostos temporariamente;
* aumenta desejabilidade moderadamente;
* fornece presença administrativa.

## 26.2 Senado

* centro administrativo;
* mostra ratings por bandeiras ou elementos visuais;
* envia coletores;
* armazena impostos;
* reúne estatísticas;
* pode ser ponto central da câmera.

## 26.3 Residência do governador

Três níveis:

* residência;
* palácio;
* mansão provincial.

Efeitos:

* desejabilidade;
* prestígio;
* favor;
* salário máximo permitido;
* marcos de campanha.

A construção deve exigir requisitos de população ou rating.

---

# 27. RATINGS DA CIDADE

Ratings de 0 a 100:

* Cultura;
* Prosperidade;
* Estabilidade cívica;
* Favor administrativo.

## 27.1 Cultura

Baseada em:

* educação;
* entretenimento;
* religião;
* festivais;
* acesso local;
* capacidade global.

Mostrar decomposição:

```text
Educação: 21
Entretenimento: 18
Religião: 16
Festivais: 4
Penalidade por baixa cobertura: -7
Total: 52
```

## 27.2 Prosperidade

Baseada em:

* nível médio das habitações;
* quantidade de patrícios;
* saldo operacional;
* desemprego;
* salários;
* comércio;
* estabilidade de longo prazo;
* dívida.

Custos de construção podem ser tratados separadamente do saldo operacional para não punir expansão produtiva.

## 27.3 Estabilidade cívica

Baseada em:

* tempo sem incêndios graves;
* ausência de desabrigados;
* baixo crime;
* ausência de protestos;
* saúde;
* abastecimento;
* emprego;
* ausência de colapsos;
* estabilidade residencial.

## 27.4 Favor administrativo

Baseado em:

* pedidos atendidos;
* pedidos ignorados;
* dívida;
* presentes;
* objetivos;
* tributos;
* salário do governador;
* desempenho da cidade.

## 27.5 Metas

Uma missão pode exigir:

```text
População: 5.000
Cultura: 60
Prosperidade: 55
Estabilidade: 70
Favor: 50
Tesouro: 10.000
Exportação anual de cerâmica: 20 cargas
```

A vitória só ocorre quando todos os requisitos forem mantidos pelo período definido, por exemplo três meses.

---

# 28. PEDIDOS ADMINISTRATIVOS

A administração imperial pode solicitar:

* alimento;
* cerâmica;
* azeite;
* vinho;
* mobiliário;
* ferramentas;
* mármore;
* dinheiro;
* realização de festival;
* construção de monumento;
* atingir população;
* abrir rota;
* manter determinada exportação.

Cada pedido deve possuir:

* título;
* descrição;
* quantidade;
* prazo;
* recompensa;
* penalidade;
* possibilidade de entrega parcial;
* botão de localizar estoque;
* botão de reservar produto;
* botão de enviar.

Quando o jogador aceita reservar bens:

* armazéns deixam de exportá-los;
* mercados deixam de distribuí-los, quando necessário;
* tela mostra progresso.

Não remover produtos instantaneamente antes de o jogador confirmar o envio.

---

# 29. EVENTOS NÃO MILITARES

Eventos possíveis:

* seca;
* colheita excepcional;
* praga agrícola;
* enchente;
* terremoto;
* incêndio;
* epidemia;
* crescimento populacional regional;
* queda de preço;
* alta de preço;
* rota temporariamente congestionada;
* atraso naval;
* greve;
* festival espontâneo;
* descoberta de mármore;
* redução de fertilidade;
* comerciante especial;
* pedido urgente;
* doação;
* visita administrativa;
* escassez regional;
* demanda excepcional por produto;
* acidente industrial;
* desabamento;
* contaminação de poço;
* onda de calor;
* inverno rigoroso, se a campanha usar clima.

Cada evento deve possuir:

* causa;
* duração;
* efeitos;
* mensagem inicial;
* atualização;
* mensagem final;
* severidade;
* opções de resposta quando aplicável.

---

# 30. CATÁLOGO INICIAL DE EDIFÍCIOS

Todos os valores são balanceamento inicial e devem ficar em arquivos de dados.

## Infraestrutura

| Edifício            |  Tamanho | Custo | Trabalhadores |
| ------------------- | -------: | ----: | ------------: |
| Estrada             |      1×1 |     4 |             0 |
| Estrada pavimentada |      1×1 |    12 |             0 |
| Praça               |      1×1 |    16 |             0 |
| Bloqueio de serviço |      1×1 |    20 |             0 |
| Ponte               | por tile |    24 |             0 |
| Aqueduto            |      1×1 |     8 |             0 |
| Jardim pequeno      |      1×1 |    20 |             0 |
| Jardim grande       |      2×2 |    80 |             0 |
| Estátua pequena     |      1×1 |    30 |             0 |
| Estátua média       |      2×2 |   100 |             0 |
| Estátua grande      |      3×3 |   300 |             0 |

## Água

| Edifício      | Tamanho | Custo | Trabalhadores |
| ------------- | ------: | ----: | ------------: |
| Poço          |     1×1 |    30 |             2 |
| Reservatório  |     3×3 |   400 |            10 |
| Fonte         |     1×1 |    80 |             4 |
| Banho público |     2×2 |   180 |            10 |

## Alimentação e distribuição

| Edifício            |    Tamanho | Custo | Trabalhadores |
| ------------------- | ---------: | ----: | ------------: |
| Fazenda de trigo    |        3×3 |   160 |            10 |
| Fazenda de vegetais |        3×3 |   170 |            10 |
| Pomar               |        3×3 |   180 |            10 |
| Criação de animais  |        3×3 |   220 |            12 |
| Cais pesqueiro      | 2×2 + água |   250 |            10 |
| Granário            |        3×3 |   300 |             6 |
| Mercado             |        2×2 |   120 |             6 |

## Matérias-primas

| Edifício             | Tamanho | Custo | Trabalhadores |
| -------------------- | ------: | ----: | ------------: |
| Poço de argila       |     2×2 |   140 |            10 |
| Pátio de madeira     |     2×2 |   160 |            10 |
| Mina de ferro        |     2×2 |   220 |            14 |
| Pedreira de mármore  |     3×3 |   300 |            16 |
| Fazenda de oliveiras |     3×3 |   180 |            10 |
| Vinha                |     3×3 |   180 |            10 |

## Oficinas

| Edifício         | Tamanho | Custo | Trabalhadores |
| ---------------- | ------: | ----: | ------------: |
| Olaria           |     2×2 |   180 |            12 |
| Carpintaria      |     2×2 |   190 |            12 |
| Prensa de azeite |     2×2 |   200 |            12 |
| Adega            |     2×2 |   220 |            12 |
| Metalúrgica      |     2×2 |   240 |            14 |

## Logística e comércio

| Edifício             |    Tamanho | Custo | Trabalhadores |
| -------------------- | ---------: | ----: | ------------: |
| Armazém              |        3×3 |   350 |             8 |
| Cais comercial       | 3×3 + água |   500 |            12 |
| Entreposto terrestre |        3×3 |   450 |            10 |

## Engenharia e segurança civil

| Edifício            | Tamanho | Custo | Trabalhadores |
| ------------------- | ------: | ----: | ------------: |
| Posto de engenharia |     1×1 |   100 |             5 |
| Brigada urbana      |     1×1 |   110 |             6 |
| Posto de vigília    |     1×1 |   120 |             6 |

## Saúde

| Edifício | Tamanho | Custo | Trabalhadores |
| -------- | ------: | ----: | ------------: |
| Barbeiro |     1×1 |    70 |             4 |
| Clínica  |     1×1 |   100 |             5 |
| Hospital |     3×3 |   500 |            30 |

## Educação

| Edifício   | Tamanho | Custo | Trabalhadores |
| ---------- | ------: | ----: | ------------: |
| Escola     |     2×2 |   150 |            10 |
| Biblioteca |     2×2 |   220 |            12 |
| Academia   |     3×3 |   400 |            20 |

## Entretenimento

| Edifício             |      Tamanho | Custo | Trabalhadores |
| -------------------- | -----------: | ----: | ------------: |
| Companhia de atores  |          2×2 |   140 |             8 |
| Escola de música     |          2×2 |   150 |             8 |
| Guilda de atletas    |          2×2 |   180 |            10 |
| Estábulos de corrida |          3×3 |   280 |            14 |
| Teatro               |          2×2 |   220 |            10 |
| Auditório            |          2×2 |   240 |            10 |
| Anfiteatro cívico    |          3×3 |   500 |            20 |
| Grande Arena Cívica  |          4×4 |   900 |            35 |
| Hipódromo            | 5×5 ou maior | 1.500 |            50 |

## Religião

Para cada divindade:

* templo pequeno;
* templo grande.

Outros:

* oráculo;
* praça de festivais.

## Administração

| Edifício                 | Tamanho | Custo | Trabalhadores |
| ------------------------ | ------: | ----: | ------------: |
| Fórum                    |     2×2 |   250 |            10 |
| Senado                   |     4×4 |   800 |            30 |
| Residência do governador |     2×2 |   300 |             5 |
| Palácio do governador    |     3×3 |   800 |            10 |
| Mansão provincial        |     4×4 | 1.600 |            20 |

---

# 31. HUD PRINCIPAL

A tela principal deve possuir quatro áreas.

## 31.1 Barra superior

Exibir:

* nome da cidade;
* mês e ano;
* tesouro;
* variação mensal;
* população;
* vagas residenciais;
* desemprego;
* meses de alimento;
* velocidade;
* alertas críticos.

Todos os itens devem possuir tooltip detalhado.

Ao clicar:

* tesouro abre Finanças;
* população abre População;
* desemprego abre Trabalho;
* alimento abre Produção;
* data abre histórico;
* alerta abre mensagem correspondente.

## 31.2 Menu de construção

Categorias:

* estradas e infraestrutura;
* habitação;
* água;
* alimentos;
* matérias-primas;
* oficinas;
* armazenamento;
* comércio;
* engenharia;
* saúde;
* educação;
* entretenimento;
* religião;
* governo;
* ornamentação;
* monumentos.

Cada item mostra:

* ícone;
* nome;
* custo;
* tamanho;
* trabalhadores;
* manutenção;
* requisitos;
* atalho;
* descrição curta.

## 31.3 Barra de controle

Botões:

* pausa;
* velocidades;
* desfazer;
* demolir;
* overlays;
* conselheiros;
* mapa regional;
* mensagens;
* objetivos;
* minimapa;
* opções.

## 31.4 Painel contextual

Ao selecionar algo, abrir inspector sem cobrir totalmente o mapa.

Permitir:

* fixar painel;
* comparar dois edifícios;
* redimensionar;
* recolher;
* navegar para edifícios semelhantes;
* ir para anterior/próximo.

---

# 32. CONSELHEIROS

Criar uma tela de gestão em abas.

Todas as telas devem possuir:

* indicadores atuais;
* tendência;
* comparação;
* alertas;
* explicação;
* ações;
* links para o mapa;
* filtros;
* histórico.

## 32.1 Conselheiro-chefe

Resumo geral.

Cards:

* população;
* alimentação;
* emprego;
* finanças;
* habitação;
* saúde;
* educação;
* cultura;
* religião;
* comércio;
* riscos;
* ratings;
* pedidos.

Classificar problemas:

* crítico;
* urgente;
* atenção;
* estável;
* excelente.

Exemplo de mensagens:

* “A cidade possui alimento para apenas 1,8 mês.”
* “Quatro oficinas estão paradas por falta de argila.”
* “23% das casas não estão registradas para impostos.”
* “A rota para Massília atingiu a quota de cerâmica.”
* “Há 312 empregos sem trabalhadores.”
* “O bairro oriental não recebe atendimento médico.”

Cada mensagem deve ser clicável.

## 32.2 Conselheiro de População

Exibir:

* população total;
* população alojada;
* desabrigados;
* vagas;
* imigração no mês;
* emigração no mês;
* nascimentos;
* mortes;
* trabalhadores;
* crianças;
* idosos;
* patrícios;
* plebeus.

Gráficos:

* histórico mensal;
* pirâmide etária;
* distribuição por classe;
* distribuição por nível de habitação;
* ocupação por bairro;
* migração histórica.

Ações:

* localizar desabrigados;
* localizar casas vazias;
* filtrar níveis;
* limitar evolução de um bairro;
* abrir overlay de habitação.

## 32.3 Conselheiro de Trabalho

Exibir tabela:

```text
Setor | Empregados | Necessários | Déficit | Prioridade | Eficiência
```

Controles:

* drag and drop de prioridades;
* salário;
* salário de referência;
* custo anual;
* desemprego;
* vagas;
* escassez;
* pausar setor;
* restaurar automático.

Gráficos:

* força de trabalho histórica;
* desemprego;
* custo salarial;
* empregos por setor.

Mostrar edifícios sem acesso local a habitações separadamente dos edifícios sem trabalhadores disponíveis.

## 32.4 Conselheiro Financeiro

Comparar:

* mês atual;
* ano atual;
* ano anterior;
* projeção anual.

Receitas:

* impostos plebeus;
* impostos patrícios;
* exportações;
* recompensas;
* doações;
* outros.

Despesas:

* salários;
* importações;
* construção;
* rotas;
* festivais;
* juros;
* salário do governador;
* reparos;
* outros.

Exibir:

* fluxo líquido;
* saldo;
* dívida;
* taxa de juros;
* cobertura fiscal;
* receita potencial perdida;
* taxa de imposto;
* impacto estimado de alterar taxa.

Adicionar gráfico mensal de receitas e despesas.

## 32.5 Conselheiro de Comércio

Tabela por mercadoria:

```text
Produto
Estoque
Produção mensal
Consumo mensal
Importação
Exportação
Preço de compra
Preço de venda
Quota restante
Reserva
Ordem comercial
```

Ações por produto:

* não negociar;
* exportar tudo;
* exportar acima de X;
* importar até X;
* estocar;
* localizar;
* ver produtores;
* ver consumidores;
* pausar indústria;
* mostrar histórico.

Mostrar:

* rotas abertas;
* comerciantes esperados;
* cargas em trânsito;
* Centro Comercial;
* cais congestionados;
* oportunidades.

## 32.6 Conselheiro de Produção e Logística

Fluxo por cadeia:

```text
Argila: 12/mês
Olaria consome: 10/mês
Cerâmica produzida: 9/mês
Demanda doméstica: 3/mês
Exportação: 5/mês
Variação de estoque: +1/mês
```

Detectar:

* falta de input;
* falta de armazenamento;
* falta de carregador;
* distância excessiva;
* falta de trabalhadores;
* produção excedente;
* oficina subutilizada;
* exportação bloqueada.

## 32.7 Conselheiro de Saúde

Tabela:

```text
Serviço | Prédios | Ativos | Capacidade | Demanda | Cobertura local
```

Exibir:

* saúde geral;
* água limpa;
* banho;
* barbeiro;
* clínica;
* hospital;
* surtos;
* bairros vulneráveis;
* mortalidade;
* ausência por doença.

## 32.8 Conselheiro de Educação

Exibir:

* crianças em idade escolar;
* vagas em escola;
* adolescentes;
* vagas em academia;
* população atendida por biblioteca;
* cobertura local;
* capacidade;
* cultura gerada.

Separar capacidade e acesso.

## 32.9 Conselheiro de Entretenimento

Exibir:

* locais ativos;
* locais sem artistas;
* companhias;
* capacidade;
* cobertura;
* pontuação por tipo;
* variedade;
* último festival;
* humor;
* bairros sem entretenimento.

Ações:

* organizar festival;
* localizar local vazio;
* localizar escola de artistas;
* abrir overlay.

## 32.10 Conselheiro Religioso

Para cada divindade:

```text
Favor
Estado
Templos pequenos
Templos grandes
Cobertura
População por templo
Último festival
Próxima mudança prevista
```

Mostrar:

* divindade mais negligenciada;
* efeitos ativos;
* bênçãos;
* penalidades;
* custo de festival;
* localização dos templos.

## 32.11 Conselheiro de Ratings

Para cada rating:

* atual;
* meta;
* tendência;
* decomposição;
* maior fator positivo;
* maior fator negativo;
* ações recomendadas;
* histórico.

## 32.12 Conselheiro Administrativo

Exibir:

* pedidos;
* prazos;
* entregas;
* favor;
* salário;
* conta pessoal;
* presentes;
* tributos;
* objetivos;
* marcos.

Não incluir qualquer aba militar.

---

# 33. MAPA REGIONAL DETALHADO

A tela deve possuir:

* mapa estilizado;
* zoom;
* pan;
* cidade selecionada;
* rotas;
* legenda;
* filtro terrestre;
* filtro marítimo;
* filtro por produto;
* filtro por rota aberta.

Painel da cidade:

```text
Nome
Descrição
Distância
Tipo de rota
Custo de abertura
Frequência
Produtos comprados
Produtos vendidos
Quotas
Preços
Relação
Eventos ativos
```

Painel global:

* rotas abertas;
* custo total;
* importações anuais;
* exportações anuais;
* produto mais lucrativo;
* produto mais importado;
* capacidade não utilizada.

---

# 34. OVERLAYS

Cada overlay deve:

* escurecer elementos irrelevantes;
* destacar edifícios do sistema;
* mostrar walkers correspondentes;
* exibir colunas ou heatmap nas casas;
* possuir legenda;
* permitir clicar numa casa;
* manter controles de câmera.

Implementar:

## Infraestrutura

* rede de estradas;
* acesso rodoviário;
* tráfego;
* bloqueios;
* pathfinding;
* água;
* aquedutos.

## Habitação

* nível residencial;
* ocupação;
* vagas;
* evolução;
* regressão;
* desejabilidade;
* valor tributável;
* humor;
* desabrigados.

## Riscos

* incêndio;
* desabamento;
* crime;
* doença;
* poluição;
* edifícios danificados.

## Trabalho

* acesso à mão de obra;
* staffing;
* setores;
* edifícios pausados;
* vagas;
* recrutadores.

## Alimentação

* estoque doméstico;
* acesso a mercado;
* trigo;
* vegetais;
* frutas;
* carne;
* peixe;
* variedade;
* meses de alimento.

## Bens

* cerâmica;
* mobiliário;
* azeite;
* vinho;
* ferramentas.

## Serviços

* banho;
* barbeiro;
* clínica;
* hospital;
* escola;
* biblioteca;
* academia;
* teatro;
* música;
* atletismo;
* corridas;
* religião total;
* cada divindade;
* coleta de impostos;
* engenharia;
* bombeiros;
* vigília urbana.

## Economia

* armazéns;
* granários;
* produção;
* gargalos;
* exportação;
* importação;
* receita fiscal;
* comércio.

---

# 35. INSPECTOR DE RESIDÊNCIA

Mostrar:

## Cabeçalho

* nome do nível;
* classe;
* população;
* capacidade;
* ocupação;
* footprint;
* estado;
* imposto mensal.

## Evolução

* próximo nível;
* elegível ou não;
* requisitos completos;
* requisitos ausentes;
* desejabilidade atual;
* desejabilidade exigida;
* tempo até avaliação;
* possibilidade de fusão;
* previsão de capacidade após evolução.

## Serviços

Para cada serviço:

* disponível;
* dias restantes;
* última visita;
* edifício fornecedor;
* walker;
* distância.

## Bens

Para cada produto:

* estoque;
* duração;
* último mercado;
* consumo;
* falta.

## Ambiente

* desejabilidade decomposta;
* risco de incêndio;
* risco de colapso;
* saúde;
* crime;
* ruído;
* tráfego.

## Controles

* limitar evolução;
* permitir fusão;
* localizar mercado;
* localizar serviço ausente;
* abrir overlay relevante;
* aplicar configuração ao bloco.

---

# 36. INSPECTOR DE EDIFÍCIOS PRODUTIVOS

Mostrar:

* nome;
* estado;
* trabalhadores;
* eficiência;
* acesso à estrada;
* acesso à mão de obra;
* input;
* output;
* capacidade;
* progresso;
* ciclos por mês;
* produção histórica;
* carregadores;
* carga em trânsito;
* destino;
* distância;
* risco;
* ordem atual;
* motivo de parada.

Estados padronizados:

* funcionando;
* sem trabalhadores;
* sem acesso à mão de obra;
* aguardando matéria-prima;
* saída cheia;
* sem destino;
* sem estrada;
* pausado;
* danificado;
* em chamas;
* risco estrutural;
* sem água;
* sem artista;
* sem rota.

---

# 37. INSPECTOR DE ARMAZÉM E GRANÁRIO

Mostrar representação visual dos slots.

Para cada produto:

* armazenado;
* reservado;
* em trânsito;
* capacidade;
* ordem;
* meta;
* entrada mensal;
* saída mensal.

Controles:

* aceitar;
* recusar;
* solicitar;
* manter;
* esvaziar;
* reservar;
* prioridade;
* Centro Comercial;
* aplicar a todos os armazéns;
* copiar configuração;
* colar configuração.

---

# 38. INSPECTOR DE MERCADO

Mostrar:

* trabalhadores;
* comprador;
* vendedor;
* casas atendidas;
* estoque;
* demanda;
* fornecedor;
* última compra;
* última distribuição;
* caminho atual;
* distância;
* produtos habilitados.

Permitir seguir visualmente:

* comprador;
* vendedor.

---

# 39. INSPECTOR DE WALKER

Ao clicar num walker:

* nome ou função;
* edifício de origem;
* tipo;
* estado;
* destino;
* carga;
* caminho;
* passos restantes;
* distância percorrida;
* serviços prestados;
* casas atendidas;
* tempo até retorno;
* motivo de espera.

Botões:

* seguir câmera;
* mostrar rota;
* abrir edifício de origem;
* abrir destino;
* ativar debug.

---

# 40. MENSAGENS E ALERTAS

Severidades:

* informativo;
* sucesso;
* atenção;
* urgente;
* crítico.

Categorias:

* população;
* alimento;
* comércio;
* produção;
* finanças;
* trabalho;
* saúde;
* risco;
* religião;
* objetivos;
* administração;
* tutorial.

Cada mensagem deve possuir:

* data;
* título;
* corpo;
* ícone;
* severidade;
* local;
* edifício relacionado;
* ação sugerida;
* botão localizar;
* botão abrir conselheiro;
* estado lida/não lida;
* opção de silenciar categoria.

Evitar spam.

Agrupar mensagens repetidas:

```text
5 oficinas estão sem argila.
```

Em vez de cinco mensagens individuais.

---

# 41. TELAS DE MENU

## Menu principal

* Continuar;
* Nova campanha;
* Carregar;
* Cidade livre;
* Editor de mapas;
* Tutorial;
* Opções;
* Créditos;
* Sair.

## Nova campanha

Mostrar:

* campanha;
* capítulo;
* missão;
* dificuldade;
* descrição;
* sistemas introduzidos;
* objetivos;
* mapa;
* produtos;
* rotas;
* modificadores.

## Cidade livre

Configurações:

* mapa;
* seed;
* tamanho;
* recursos;
* dinheiro;
* eventos;
* dificuldade;
* objetivos personalizados;
* comércio;
* clima;
* divindades;
* evolução residencial;
* custos.

Não oferecer opção militar.

## Carregar

* screenshot;
* cidade;
* missão;
* data;
* população;
* tesouro;
* tempo jogado;
* versão do save;
* autosave/manual;
* compatibilidade.

---

# 42. CAMPANHA

Criar campanha original sem guerras.

Estrutura sugerida:

## Missão 1 — Nas margens do rio

Ensina:

* estrada;
* habitação;
* poço;
* imigração;
* emprego.

## Missão 2 — O celeiro provincial

Ensina:

* agricultura;
* granário;
* mercado;
* distribuição.

## Missão 3 — Barro e fogo

Ensina:

* argila;
* olaria;
* cerâmica;
* armazenamento;
* evolução residencial.

## Missão 4 — Estradas de comércio

Ensina:

* rota terrestre;
* exportação;
* importação;
* quotas.

## Missão 5 — Água para todos

Ensina:

* reservatório;
* aqueduto;
* fonte;
* banho;
* saúde.

## Missão 6 — Cidade dos estudiosos

Ensina:

* escola;
* biblioteca;
* academia;
* cultura.

## Missão 7 — Favores dos deuses

Ensina:

* templos;
* festivais;
* favor;
* efeitos religiosos.

## Missão 8 — Porto do sul

Ensina:

* navegação;
* cais;
* comércio marítimo;
* congestionamento logístico.

## Missão 9 — A cidade dos patrícios

Ensina:

* desejabilidade;
* vilas;
* palácios;
* bens de luxo;
* tributação avançada.

## Missão 10 — Capital provincial

Exige domínio de todos os sistemas.

A campanha deve introduzir sistemas gradualmente.

---

# 43. TUTORIAL CONTEXTUAL

O tutorial deve observar o estado real.

Exemplo:

Se o jogador construiu casas, mas não há imigrantes:

1. verificar estrada até entrada;
2. verificar vagas;
3. verificar atratividade;
4. explicar a causa real.

Tutoriais devem possuir:

* destaque visual;
* texto curto;
* explicação expandida;
* botão “mostrar onde”;
* botão “não mostrar novamente”;
* codex relacionado.

Nunca obrigar o jogador a seguir uma sequência rígida depois da introdução.

---

# 44. CODEX

Criar enciclopédia interna com:

* edifícios;
* produtos;
* cadeias;
* serviços;
* housing;
* walkers;
* desejabilidade;
* comércio;
* finanças;
* ratings;
* religião;
* riscos;
* atalhos.

Cada entrada deve conter:

* descrição;
* funcionamento;
* inputs;
* outputs;
* trabalhadores;
* custo;
* dicas;
* requisitos;
* links relacionados.

---

# 45. SAVE E LOAD

O save deve registrar:

* seed;
* tempo;
* mapa;
* edifícios;
* casas;
* população;
* inventários;
* walkers relevantes;
* produção;
* rotas;
* comércio;
* preços;
* quotas;
* finanças;
* religião;
* ratings;
* eventos;
* objetivos;
* configurações;
* versão do schema.

Implementar:

* save manual;
* autosave rotativo;
* quicksave;
* quickload;
* migração de versões;
* validação;
* backup antes de migrar;
* recuperação de save corrompido quando possível.

A simulação após load deve permanecer determinística.

---

# 46. OPÇÕES E ACESSIBILIDADE

## Gráficos

* resolução;
* fullscreen;
* escala de UI;
* qualidade de sombras;
* quantidade de walkers;
* animações;
* partículas;
* transparência;
* limite de FPS.

## Áudio

Controles separados:

* música;
* ambiente;
* efeitos;
* interface;
* vozes;
* alertas.

## Gameplay

* velocidade padrão;
* pausa automática em eventos críticos;
* confirmação de demolição;
* pan nas bordas;
* autosave;
* frequência de alertas;
* dicas;
* dificuldade.

## Acessibilidade

* escala de texto;
* alto contraste;
* paletas para daltonismo;
* símbolos além de cores;
* redução de movimento;
* legendas;
* leitura de tooltips;
* remapeamento completo;
* navegação de UI por teclado;
* pausa automática ao abrir painéis;
* velocidade reduzida;
* opção de destacar entradas de edifícios.

---

# 47. DIREÇÃO VISUAL

Estilo:

* isométrico 2D;
* inspiração em mosaicos, pergaminhos e arquitetura romana;
* cores quentes;
* leitura clara;
* edifícios visualmente distintos;
* animações pequenas e frequentes;
* cidade viva;
* escala coerente;
* sinais visuais de estoque e operação.

Mostrar:

* fumaça de oficinas;
* trabalhadores;
* carrinhos;
* mercadorias nos pátios;
* água em fontes;
* artistas chegando;
* navios carregando;
* fazendas mudando durante o ciclo;
* casas melhorando;
* obras;
* incêndios;
* rachaduras;
* festivais.

Não copiar assets de jogos existentes.

---

# 48. ÁUDIO

Criar camadas:

* ambiente urbano;
* mercado;
* água;
* oficinas;
* campo;
* porto;
* teatro;
* templo;
* festival.

A intensidade deve mudar conforme zoom e localização da câmera.

Alertas devem possuir sons distintos por severidade, mas não intrusivos.

Música:

* instrumental original;
* influência mediterrânea e romana;
* transições suaves;
* variação conforme prosperidade e crise;
* sem reutilizar melodias existentes.

---

# 49. MODELO DE DADOS

Exemplo de definição de mercadoria:

```json
{
  "id": "pottery",
  "name": "Cerâmica",
  "category": "manufactured",
  "storage": "warehouse",
  "durabilityMonths": 12,
  "baseImportPrice": 48,
  "baseExportPrice": 36,
  "houseGood": true,
  "tradable": true,
  "icon": "commodity_pottery"
}
```

Exemplo de edifício:

```json
{
  "id": "pottery_workshop",
  "name": "Olaria",
  "category": "industry",
  "footprint": [2, 2],
  "cost": 180,
  "workersRequired": 12,
  "roadAccessRequired": true,
  "inputs": [
    {
      "commodity": "clay",
      "amount": 1
    }
  ],
  "outputs": [
    {
      "commodity": "pottery",
      "amount": 1
    }
  ],
  "productionDays": 30,
  "internalInputCapacity": 2,
  "internalOutputCapacity": 1,
  "fireRisk": 0.7,
  "collapseRisk": 0.4,
  "desirability": {
    "effect": -10,
    "radius": 3,
    "falloff": 3
  }
}
```

Exemplo de nível residencial:

```json
{
  "id": "large_urban_house",
  "level": 8,
  "name": "Casa urbana",
  "class": "plebeian",
  "footprint": [1, 1],
  "capacity": 19,
  "taxMultiplier": 2,
  "prosperityValue": 45,
  "evolveDesirability": 20,
  "devolveDesirability": 14,
  "requirements": {
    "foodTypes": 1,
    "goods": ["pottery"],
    "services": ["fountain", "bath"],
    "religionCount": 1,
    "entertainmentPoints": 10
  }
}
```

Exemplo de rota:

```json
{
  "id": "route_massilia",
  "cityName": "Massília",
  "type": "sea",
  "openingCost": 900,
  "merchantIntervalDays": [90, 150],
  "capacityPerMerchant": 16,
  "buys": {
    "pottery": 15,
    "furniture": 25,
    "marble": 40
  },
  "sells": {
    "oil": 25,
    "wine_imported": 15
  }
}
```

---

# 50. TELEMETRIA E DEBUG

Criar ferramentas internas para:

* alterar velocidade;
* gerar população;
* adicionar dinheiro;
* adicionar produtos;
* forçar evento;
* mostrar paths;
* mostrar cobertura;
* mostrar desejabilidade;
* mostrar riscos;
* mostrar graphs;
* avançar mês;
* avançar ano;
* testar housing;
* testar quotas;
* testar save/load;
* inspecionar RNG;
* validar rede viária;
* detectar agentes presos;
* detectar mercadorias sem destino;
* detectar edifícios sem entrada.

Os cheats devem ficar desativados em builds normais.

---

# 51. TESTES OBRIGATÓRIOS

## Testes unitários

Cobrir:

* coordenadas isométricas;
* pathfinding;
* rede viária;
* ordens de armazém;
* produção;
* consumo;
* evolução residencial;
* regressão;
* desejabilidade;
* impostos;
* salários;
* migração;
* quotas;
* preços;
* favor religioso;
* ratings;
* serialização.

## Testes de integração

### Cidade básica

* casas recebem água;
* imigrantes chegam;
* trabalhadores são alocados;
* fazenda produz;
* granário recebe;
* mercado busca;
* vendedor entrega;
* casa evolui.

### Cerâmica

* argila é extraída;
* olaria recebe;
* cerâmica é produzida;
* armazém recebe;
* mercado busca;
* casa consome.

### Exportação

* rota é aberta;
* ordem é configurada;
* caravana chega;
* coleta carga;
* quota reduz;
* tesouro aumenta.

### Importação

* meta é definida;
* comerciante entrega;
* tesouro diminui;
* carga chega ao Centro Comercial;
* mercado ou oficina consegue utilizá-la.

### Escassez de trabalho

* setor prioritário mantém empregados;
* setor de baixa prioridade perde empregados;
* UI explica a mudança.

### Evolução aristocrática

* casas fundem;
* capacidade muda;
* moradores excedentes procuram residência;
* impostos e prosperidade aumentam.

### Regressão

* remover serviço;
* aguardar carência;
* casa regride;
* população excedente é realocada;
* interface explica a causa.

### Save/load

* salvar;
* carregar;
* comparar estado;
* continuar simulação;
* obter mesmos resultados com a mesma seed.

## Teste de ausência militar

Validar automaticamente que não existem:

```text
military
army
legion
soldier
fort
barracks
weapon
enemy
invasion
combat
damageFromUnit
```

Permitir somente ocorrências em documentação que explique explicitamente que esses sistemas não existem.

---

# 52. PERFORMANCE

Objetivos iniciais:

* mapas grandes;
* milhares de edifícios;
* milhares de walkers visuais;
* dezenas de milhares de habitantes agregados;
* atualização fluida;
* painéis rápidos;
* save em tempo aceitável.

Otimizações:

* atualização espacial por chunks;
* cache de redes;
* recálculo incremental;
* pathfinding assíncrono quando seguro;
* pooling de walkers;
* LOD;
* agregação de simulação fora da câmera;
* atualizações escalonadas;
* evitar consultas globais por tick;
* índices por commodity;
* índices por tipo de edifício;
* filas de transporte;
* dirty flags.

Não sacrificar determinismo sem documentar.

---

# 53. DIFICULDADE

Modificar:

* dinheiro inicial;
* custos;
* salário;
* produtividade;
* consumo;
* tolerância a impostos;
* frequência de eventos;
* velocidade de risco;
* preço comercial;
* prazo de pedidos;
* exigência de ratings.

Níveis:

* relaxado;
* normal;
* desafiador;
* governador;
* personalizado.

Não aumentar dificuldade ocultando informações.

---

# 54. CRITÉRIOS DE ACEITAÇÃO

O núcleo do jogo só pode ser considerado funcional quando:

1. é possível construir estradas e casas;
2. imigrantes chegam fisicamente;
3. casas são ocupadas;
4. edifícios recrutam trabalhadores;
5. fazendas produzem cargas;
6. carregadores transportam cargas;
7. granários armazenam alimento;
8. mercados buscam alimento;
9. vendedores distribuem alimento;
10. casas consomem estoque;
11. casas evoluem;
12. serviços usam walkers;
13. cobertura expira;
14. desejabilidade afeta housing;
15. impostos são coletados;
16. salários são pagos;
17. indústrias transformam recursos;
18. armazéns respeitam ordens;
19. rotas podem ser abertas;
20. caravanas e navios negociam;
21. quotas são aplicadas;
22. preços afetam o tesouro;
23. conselheiros mostram dados reais;
24. overlays mostram dados reais;
25. mensagens localizam problemas;
26. saves restauram toda a simulação;
27. a cidade pode permanecer estável;
28. não existe lógica militar.

Nenhum botão central da interface pode ser meramente decorativo.

---

# 55. ORDEM DE IMPLEMENTAÇÃO

Implementar por fatias verticais.

## Etapa 1 — Fundação

* mapa;
* câmera;
* tiles;
* construção;
* estradas;
* edifícios;
* save básico.

## Etapa 2 — População

* lotes;
* imigração;
* ocupação;
* trabalho;
* recrutadores.

## Etapa 3 — Alimentação

* fazenda;
* granário;
* mercado;
* comprador;
* vendedor;
* consumo;
* primeira evolução.

## Etapa 4 — Serviços

* walkers;
* água;
* engenharia;
* incêndio;
* saúde;
* educação.

## Etapa 5 — Indústria

* recursos;
* oficinas;
* armazéns;
* ordens;
* logística.

## Etapa 6 — Comércio

* mapa regional;
* rotas;
* caravanas;
* navios;
* quotas;
* preços.

## Etapa 7 — Cidade avançada

* desejabilidade;
* aristocratas;
* cultura;
* entretenimento;
* religião;
* ratings.

## Etapa 8 — Gestão

* todos os conselheiros;
* overlays;
* gráficos;
* filtros;
* mensagens.

## Etapa 9 — Campanha

* objetivos;
* pedidos;
* eventos;
* tutorial;
* missões.

## Etapa 10 — Polimento

* áudio;
* arte;
* acessibilidade;
* performance;
* QA;
* balanceamento.

Cada etapa deve produzir uma versão jogável.

---

# 56. COMPORTAMENTO ESPERADO DO AGENTE DE CODING

Antes de modificar arquivos:

1. inspecione o projeto;
2. identifique arquitetura e stack;
3. liste os sistemas existentes;
4. identifique lacunas;
5. proponha um plano incremental;
6. crie uma checklist;
7. comece pela menor fatia vertical funcional.

Durante a implementação:

* não invente APIs inexistentes;
* não simule execução de testes;
* execute testes reais;
* reporte erros reais;
* preserve código funcional;
* faça commits ou mudanças logicamente agrupadas;
* atualize documentação;
* mantenha dados de balanceamento externos;
* não adicione sistemas militares;
* não deixe TODOs em sistemas centrais;
* não crie botões sem ação;
* não utilize estoques globais mágicos;
* não teleporte mercadorias;
* não transforme cobertura de walkers em raio sem justificativa;
* não use timers dependentes do frame rate;
* não pare após criar apenas a interface.

Quando uma decisão não estiver definida:

1. escolha a alternativa mais simples que preserve os pilares;
2. torne-a configurável;
3. documente a decisão;
4. continue a implementação.

Ao final de cada etapa, informe:

* arquivos alterados;
* sistemas implementados;
* testes executados;
* resultado dos testes;
* limitações;
* próximo passo.

O objetivo final é um city builder econômico completo, legível e profundamente interconectado, no qual o jogador consiga compreender cada falha observando a cidade, os walkers, as rotas, os estoques, os overlays e os painéis de gestão.
