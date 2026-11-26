# Campanha L2/L3 — dois terminais (v2)
Santos é o único porto. Level 2: cinco rodadas, quatro origens por rodada (GO/MG e MT), rodoviário direto ou multimodal via terminal de referência. Level 3: seis rodadas, quatro origens por rodada, algumas origens do leste de MT têm três alternativas (direto, Rio Verde e Rondonópolis). A origem define os modais disponíveis; o jogador seleciona sem pré-seleção automática. Tarifas dos terminais variam independentemente, ligadas às notícias e aos fretes rodoviários.
Todos os valores são simulados. A geometria ferroviária será extraída da camada pública Infra S.A./ANTT (Declaração de Rede 2024), limitada a RMN/RMC/RMP. O extrator preserva geometrias fonte; não desenha conexões artificiais; pequenos hiatos de topologia não são desenhados. Caso a geometria não esteja disponível, não existe fallback esquemático; o mapa exibe aviso. OSRM para rodovias; o frete não depende da distância roteada.
Scorecard e progressão preservados. Novos recordes v2, desbloqueios existentes preservados. L1 e demais modos não alterados. Auditoria exaustiva com opções variáveis por rodada e verificação independente de contas e volume.

## Auditoria de geometria
Dados oficiais extraídos e armazenados localmente: `data/campaign/rail-corridors.geojson`. As coordenadas dos terminais derivam dos pátios declarados. Acesso final ferroviário à região portuária inclui segmentos MRS quando necessários; não é homologação de itinerário operacional de um trem. Hiatos de até 200 m usados apenas para conexão topológica, não desenhados.
- Rio Verde: 1185 km de geometria, 20 hiatos topológicos, ponto ferroviário final a 0.61 km da referência de Santos.
- Rondonópolis: 1635.3 km de geometria, 35 hiatos topológicos, ponto ferroviário final a 0.61 km da referência de Santos.

Auditoria comercial: L2 59.049 sequências; 3.379 aprovadas (3.129 multimodais misturadas); L3 990.000 sequências; 44.005 aprovadas (40.182 misturadas). 9/11 e 15/9 ofertas favorecem rodoviário/ferroviário respectivamente.
