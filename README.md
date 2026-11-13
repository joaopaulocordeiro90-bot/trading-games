# Trading Games — Site Oficial (ponto de partida)

**Versão-base:** Level 1 BRZ, 12/11/2026. Aplicação estática HTML/CSS/JavaScript.

## Objetivo
Repositório dedicado ao Trading Games. O navegador sempre abre `index.html`, com os dados em `data/`, as imagens em `assets/` e as calibrações em `calibration.json`. O modo Campanha é segregado em `data/campaign/levels/level1.json` etc.

## Publicação — GitHub Pages
1. Crie no GitHub um repositório com nome `trading-games`, de preferência privado inicialmente, **sem outros projetos dentro**.
2. Faça upload **do conteúdo desta pasta para a raiz do repositório**. Não faça upload apenas do arquivo ZIP: é preciso extrair os arquivos. Também não coloque tudo dentro de uma subpasta.
3. Vá em **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main → / (root) → Save**.
4. O site terá endereço `https://<SEU-USUARIO>.github.io/trading-games/` (confirme a URL real mostrada em Settings → Pages).
5. Depois de publicada, todas as mudanças no ramo de publicação atualizarão o mesmo endereço. Utilize Ctrl+F5 / limpar cache quando necessário.

**Atenção:** GitHub Pages não fornece autenticação de usuários nem base de dados no servidor. Uma senha verificada por JavaScript não é segurança. Código, ofertas simuladas, imagens e regras públicas podem ser inspecionados por visitantes. Não inclua negócios privados, senhas nem credenciais do BRZ Report. O Admin opera localmente no navegador; alterações locais não salvam a versão publicada para todos.

## Regra de isolamento
**Qualquer alteração do Level 1 não deve afetar os modos Iniciante, Expert, nem outros levels.**
- A calibração exclusiva do L1 utiliza chaves com prefixo `l1_`.
- Há hashes protegidos para os dados de Iniciante, Expert, Levels 2 e 3 e arquivos estáticos compartilhados; teste automático `.qa/validate_site.py`.
- Qualquer mudança em `game.js` compartilhado exige teste funcional de regressão em navegador, pois o teste de hash não prova isolamento de lógica.
- Desenvolver em branch específica, comparar mudanças, testar os três modos antes de integrar à `main`.

## Próximas evoluções aprovadas — ainda NÃO implementadas neste pacote
1. Reorganização de UX e de jogabilidade em fases (mercado → ofertas/decisão → resultado), exclusiva do L1.
2. Calculadora pré-compra opcional: basis e custo CFR equivalente.
3. Avaliação de desempenho: originação, margem, ocupação e disciplina.
4. Progressão e desbloqueio do Level 2 depois da aprovação do L1.

## Testes locais
`python3 -m http.server 8000` e abrir `http://localhost:8000/`.

`python3 .qa/validate_site.py` para integridade estática.

## Versões
- 2026-11-12: pacote de implantação sem modificações na lógica nem nas telas do jogo — apenas arquivos de publicação, documentação, teste estático e remoção de backups obsoletos da pasta pública.
