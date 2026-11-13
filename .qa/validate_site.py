#!/usr/bin/env python3
"""Validação estática e de imutabilidade do pacote Trading Games.
Para mudanças autorizadas nos outros modos, o baseline requer revisão explícita.
"""
from pathlib import Path
import hashlib, json, sys
root=Path(__file__).resolve().parents[1]
requirements=['index.html','game.js','styles.css','admin.html','calibration.json','gameData.json','data/gameData.manifest.json','data/campaign/campaignData.json','data/campaign/levels/level1.json','data/campaign/levels/level2.json','data/campaign/levels/level3.json','data/guided/gameData.json','data/expert/gameData.json']
issues=[]
for rel in requirements:
    p=root/rel
    if not p.is_file(): issues.append('Arquivo ausente: '+rel)
    elif rel.endswith('.json'):
        try: json.loads(p.read_text(encoding='utf-8-sig'))
        except Exception as exc: issues.append('JSON inválido '+rel+': '+str(exc))
manifest=json.loads((root/'data/gameData.manifest.json').read_text(encoding='utf-8'))
for key in ('guided','expert','campaign'):
    val=manifest.get(key)
    if not val or not (root/val).is_file(): issues.append('Manifesto inválido: '+key)
for rel in manifest.get('campaignLevels',[]):
    if not (root/rel).is_file(): issues.append('Level inexistente: '+rel)
base=json.loads((root/'.qa/protected_files.json').read_text(encoding='utf-8'))
for rel,want in base['files'].items():
    file=root/rel
    got=hashlib.sha256(file.read_bytes()).hexdigest() if file.is_file() else 'AUSENTE'
    if got!=want: issues.append('Arquivo protegido alterado: '+rel)
for folder in ['assets','data']:
    if not (root/folder).is_dir(): issues.append('Pasta ausente: '+folder)
if issues:
    for i in issues: print('ERRO:',i)
    sys.exit(1)
print('OK: arquivos, JSON, manifesto, dados dos outros modos e telas protegidas.')
