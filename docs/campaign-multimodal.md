# Campanha L2/L3 — dois terminais (v2)
Santos é o único porto. Level 2: cinco rodadas, quatro origens por rodada (GO/MG e MT), rodoviário direto ou multimodal via terminal de referência. Level 3: seis rodadas, quatro origens por rodada, algumas origens do leste de MT têm três alternativas (direto, Rio Verde e Rondonópolis). A origem define os modais disponíveis; o jogador seleciona sem pré-seleção automática. Tarifas dos terminais variam independentemente, ligadas às notícias e aos fretes rodoviários.
Todos os valores são simulados. A geometria ferroviária será extraída da camada pública Infra S.A./ANTT (Declaração de Rede 2024), limitada a RMN/RMC/RMP. O extrator preserva geometrias fonte; não desenha conexões artificiais; pequenos hiatos de topologia não são desenhados. Caso a geometria não esteja disponível, não existe fallback esquemático; o mapa exibe aviso. OSRM para rodovias; o frete não depende da distância roteada.
Scorecard e progressão preservados. Novos recordes v2, desbloqueios existentes preservados. L1 e demais modos não alterados. Auditoria exaustiva com opções variáveis por rodada e verificação independente de contas e volume.

## Auditoria de geometria
Dados oficiais extraídos e armazenados localmente: `data/campaign/rail-corridors.geojson`. As coordenadas dos terminais derivam dos pátios declarados. Acesso final ferroviário à região portuária inclui segmentos MRS quando necessários; não é homologação de itinerário operacional de um trem. Hiatos de até 200 m usados apenas para conexão topológica, não desenhados.
- Rio Verde: 1185 km de geometria, 20 hiatos topológicos, ponto ferroviário final a 0.61 km da referência de Santos.
- Rondonópolis: 1635.3 km de geometria, 35 hiatos topológicos, ponto ferroviário final a 0.61 km da referência de Santos.

Auditoria comercial: L2 59.049 sequências; 3.379 aprovadas (3.129 multimodais misturadas); L3 990.000 sequências; 44.005 aprovadas (40.182 misturadas). 9/11 e 15/9 ofertas favorecem rodoviário/ferroviário respectivamente.

## Revisão de praças — v3 (26/11/2026)
- L2: R1: Jataí/GO, Sorriso/MT, Itumbiara/GO, Nova Mutum/MT; R2: Primavera do Leste/MT, Cristalina/GO, Lucas do Rio Verde/MT, Jataí/GO; R3: Rio Verde/GO, Campo Novo do Parecis/MT, Itumbiara/GO, Sapezal/MT; R4: Sinop/MT, Jataí/GO, Primavera do Leste/MT, Chapadão do Sul/MS; R5: Cristalina/GO, Sapezal/MT, Rio Verde/GO, Água Boa/MT
- L3: R1: Querência/MT, Cristalina/GO, Jataí/GO, Água Boa/MT; R2: Rio Verde/GO, Sorriso/MT, Primavera do Leste/MT, Itumbiara/GO; R3: Água Boa/MT, Cristalina/GO, Campo Novo do Parecis/MT, Chapadão do Sul/MS; R4: Itumbiara/GO, Querência/MT, Jataí/GO, Primavera do Leste/MT; R5: Sorriso/MT, Silvânia/GO, Rio Verde/GO, Água Boa/MT; R6: Jataí/GO, Lucas do Rio Verde/MT, Querência/MT, Itumbiara/GO
Fretes-base observados da S46 (08–14/11), BRZ Fretes, base4626-358.pdf, grãos, sem ICMS. Multiplicados pelos índices simulados existentes e arredondados em R$ 5/t. Acesso local Rio Verde R$ 45/t é simulado. Preços recalibrados para manter dificuldade de cada oferta; referência de tela de 12/11 para fev/27 registrada quando disponível. Nenhuma tarifa ferroviária é cotação observada. Os recordes v3 ficam separados dos antigos, preservando desbloqueios.
- L2: 59049 sequências, 5943 aprovadas, 5313 com ambos os modais; 11 rodo, 8 ferro, 1 empate; melhor 98/100.
- L3: 990000 sequências, 47690 aprovadas, 41182 com ambos os modais; 10 rodo, 13 ferro, 1 empate; melhor 100/100.
