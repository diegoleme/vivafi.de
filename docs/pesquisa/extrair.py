import re,html,os,json,glob

HEAD = ['Forania','Igreja Matriz','Endereço','Atendimento','Telefone','Email','WhatsApp',
        'Criação','Festa','Clero','Pároco','Vigários','Missas','Confissões',
        'Adoração ao Santíssimo Sacramento','Localização','Comunidade','Comunidades',
        'Serviços Pastorais','Pastorais','Associações e Movimentos','Padroeiro']

def linhas(path):
    s=open(path,encoding='utf-8',errors='replace').read()
    s=re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>',' ',s)
    m=re.search(r'(?is)<main.*?</main>',s); body=m.group(0) if m else s
    body=re.sub(r'(?is)<br\s*/?>','\n',body)
    body=re.sub(r'(?is)</(p|div|li|tr|h[1-6]|td|span)>','\n',body)
    t=html.unescape(re.sub(r'(?s)<[^>]+>',' ',body))
    out=[]
    for l in t.split('\n'):
        l=re.sub(r'[ \t\xa0]+',' ',l).strip()
        if l and (not out or out[-1]!=l): out.append(l)
    return out

def secao(ls,nome,fim=HEAD):
    try: i=ls.index(nome)
    except ValueError: return []
    r=[]
    for l in ls[i+1:]:
        if l in fim: break
        r.append(l)
    return r

def campo(ls,nome):
    v=secao(ls,nome)
    return v[0] if v else None

reg=[]
for path in sorted(glob.glob('pages/*.html'))+sorted(glob.glob('com/*.html')):
    ls=linhas(path)
    tipo='paroquia' if path.startswith('pages/') else 'comunidade'
    reg.append({
        'tipo':tipo,'slug':os.path.basename(path)[:-5],
        'nome':ls[0] if ls else None,
        'forania':campo(ls,'Forania'),
        'festa':campo(ls,'Festa'),
        'missas':secao(ls,'Missas'),
        'confissoes':secao(ls,'Confissões'),
        'adoracao':secao(ls,'Adoração ao Santíssimo Sacramento'),
    })
json.dump(reg,open('dados.json','w'),ensure_ascii=False,indent=1)

par=[r for r in reg if r['tipo']=='paroquia']; com=[r for r in reg if r['tipo']=='comunidade']
print(f"registros: {len(reg)} (paroquias {len(par)}, comunidades {len(com)})")
print(f"com bloco Missas nao-vazio: {sum(1 for r in reg if r['missas'])}")
print(f"sem bloco Missas: {sum(1 for r in reg if not r['missas'])}")
print(f"com Festa (data do padroeiro): {sum(1 for r in reg if r['festa'])}")
print(f"com Confissoes: {sum(1 for r in reg if r['confissoes'])}")
print(f"com Adoracao: {sum(1 for r in reg if r['adoracao'])}")
print()
print("=== FORANIAS ===")
from collections import Counter
print(Counter(r['forania'] for r in par if r['forania']))
