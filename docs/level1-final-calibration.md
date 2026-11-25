# Trading Games · Level 1 — calibração final (25/11/2026)

## Escopo
Originação pura; um navio de 60.000 t; rodoviário direto para Santos, destino Norte da China. Cinco rodadas com quatro ofertas distintas. Uma compra definitiva por rodada ou espera. Venda +130 ¢/bu; teto de basis médio +125 ¢/bu; nota ≥ 70/100. Fobbing US$ 11/t; marítimo US$ 46,60/t. A margem é a diferença de basis, não P&L realizado.

## Fontes e premissas
- Preços de referência: BRZ_Replacement_2026-11-12_C12_AUDITORIA_D1_D7_D30_FARELO_V4ES.html · dataPrecos · Soja · retirada fevereiro/2027 · referências de tela 06,09,10,11,12/11/2026. Cada preço EXW é uma cotação simulada; preço de referência e ajuste didático registrados por oferta.
- Fretes: BRZ_Fretes_2026-11-11_S46_FX_1111_MARITIMO_1111_V22f_DASHBOARD_ZOOM.html · dataRodo · destino Santos · S45 e S46 · grãos · R$/t · sem ICMS. Mineiros/GO sem cotação direta nessas semanas: proxy Jataí/GO R$ 295/t + R$ 15/t de ajuste simulado.
- Notícias, preços das ofertas, volumes, referência física contínua e venda CFR são simulados; referências de tela e fretes spot não representam negócio firme nem frete forward. O frete estimado de Mineiros não é cotação observada. Margem em basis, sem hedge completo, tributos, financiamento ou MTM.
- Para cada oferta, o JSON contém referência, ajuste simulado e natureza da cotação de frete. Os fretes S45/S46 são SPOT e sem ICMS; não são contratos futuros garantidos.
- Rio Verde/GO é a referência física contínua fictícia (R1 125,50; R2 124,50; R3 129,50; R4 132,00; R5 133,50 R$/sc); não se confunde com uma oferta necessariamente disponível.
- Os textos de mercado são hipotéticos e não notícias históricas verificadas. Os dados internos são calibrados sobre as referências consultadas.

## Auditoria de dados
### R1 — Chicago 1199.25 ¢/bu; dólar 5.6273
| Origem | Ref. R$/sc | Ajuste | Oferta R$/sc | Volume t | R$/t Santos | Natureza |
|---|---:|---:|---:|---:|---:|---|
| Querência/MT | 122 | -2.5 | 119.5 | 10000 | 450 | Referência spot |
| Sorriso/MT | 121.5 | -4 | 117.5 | 11000 | 495 | Referência spot |
| Rio Verde/GO | 125.5 | 0 | 125.5 | 18000 | 290 | Referência spot |
| Dourados/MS | 130.5 | -2 | 128.5 | 12000 | 340 | Referência spot |

### R2 — Chicago 1193.75 ¢/bu; dólar 5.6316
| Origem | Ref. R$/sc | Ajuste | Oferta R$/sc | Volume t | R$/t Santos | Natureza |
|---|---:|---:|---:|---:|---:|---|
| Sapezal/MT | 121.5 | -5.5 | 116 | 15000 | 525 | Referência spot |
| Primavera do Leste/MT | 123.5 | -7.5 | 116 | 10000 | 430 | Referência spot |
| Jataí/GO | 125.5 | 3.5 | 129 | 14000 | 295 | Referência spot |
| Maracaju/MS | 129 | -1.5 | 127.5 | 13000 | 345 | Referência spot |

### R3 — Chicago 1234.5 ¢/bu; dólar 5.7024
| Origem | Ref. R$/sc | Ajuste | Oferta R$/sc | Volume t | R$/t Santos | Natureza |
|---|---:|---:|---:|---:|---:|---|
| Rondonópolis/MT | 124.5 | -2.5 | 122 | 14000 | 400 | Referência spot |
| Mineiros/GO | 124.5 | 4 | 128.5 | 11000 | 310 | Estimado: Jataí +15 |
| Rio Verde/GO | 125.5 | 4 | 129.5 | 18000 | 290 | Referência spot |
| Dourados/MS | 130.5 | 0 | 130.5 | 15000 | 340 | Referência spot |

### R4 — Chicago 1237.5 ¢/bu; dólar 5.6784
| Origem | Ref. R$/sc | Ajuste | Oferta R$/sc | Volume t | R$/t Santos | Natureza |
|---|---:|---:|---:|---:|---:|---|
| Sorriso/MT | 121.5 | -3.5 | 118 | 17000 | 520 | Referência spot |
| Jataí/GO | 131 | -1.5 | 129.5 | 10000 | 295 | Referência spot |
| Rio Verde/GO | 131 | 1 | 132 | 13000 | 290 | Referência spot |
| Maracaju/MS | 129 | -3 | 126 | 15000 | 345 | Referência spot |

### R5 — Chicago 1225.5 ¢/bu; dólar 5.7644
| Origem | Ref. R$/sc | Ajuste | Oferta R$/sc | Volume t | R$/t Santos | Natureza |
|---|---:|---:|---:|---:|---:|---|
| Primavera do Leste/MT | 127.5 | -4.5 | 123 | 16000 | 430 | Referência spot |
| Sinop/MT | 122 | -3.5 | 118.5 | 12000 | 535 | Referência spot |
| Rio Verde/GO | 133 | 0.5 | 133.5 | 18000 | 290 | Referência spot |
| Dourados/MS | 130.5 | -1.5 | 129 | 20000 | 340 | Referência spot |

## Validação
Teste exaustivo de 3.125 sequências nominais, incluindo espera e repetição de escolhas depois de completar o navio (equivalências). Testes conferem 20 replacements independentes, volume parcial, basis ponderado, margem, score, aprovação e reprovação. Melhor posição por rodada: 3, 2, 1, 4, 1. Nenhuma estratégia de repetir sempre a mesma posição aprova. A interface exibe a referência física e a reação da notícia anterior, mantém o exemplo resolvido em R1, exercícios opcionais em R2–R5 e resultado completo ao final. A geometria de rotas reais depende do roteador público; o frete comercial permanece o cenário.

O recorde local da calibração final usa uma nova chave; progressos e desbloqueios anteriores não são apagados. Os modos Iniciante/Expert e os níveis 2/3 permanecem isolados.
