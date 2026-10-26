# -*- coding: utf-8 -*-
"""
teste_organograma.py: bateria do organograma, num navegador de verdade (Edge ou
Chrome headless, controlado pelo DevTools Protocol).

O que prova (cada item imprime OK ou FALHA com o número que decidiu):
  1. abre sem erro de JavaScript em PT/EN, claro/escuro, desenho/lista, compacto/espalhado
  2. nenhuma chave de tradução faltando ([chave]) e nenhum travessão na tela
  3. cartões de pessoa = pessoas ativas na data (contadas direto do gerador, id por id)
  4. todo cartão tem gestor que existe no desenho, menos o topo (exatamente 1)
  5. layout: nenhum cartão sobreposto e nenhum fio atravessando cartão (nos dois modos)
  6. o compacto é pelo menos 4x mais estreito que o espalhado
  7. busca acha pelo nome, centraliza o cartão, acende o caminho até o topo e abre o painel;
     e ignora acento ("debora" acha "Débora")
  8. mouse de verdade: clique abre o painel; arrastar move sem abrir; roda dá zoom no cursor
  9. filtro reduz (contagem e cartões) e Limpar volta
 10. recolher esconde o ramo inteiro sem tirar o cartão do lugar; expandir devolve;
     teclado de verdade: Enter na pílula também recolhe, e o foco não desalinha a tela
 11. destaques batem com o gerador: aniversariantes do mês, novatos (< 90 dias), vagas
 12. CSV: uma linha por cartão; colado de volta como dado próprio, desenha a mesma árvore;
     CSV com aspas, vírgula no nome e gestor inexistente é lido e avisado
 13. impressão: barra e botões somem, o desenho fica
 14. celular (390 px): lista em árvore, nada vaza para o lado, tocar abre o detalhe
 15. modo Power BI: o HTML único abre sem internet e sem erro; lendo o CSV de exemplo do
     jeito que a medida DAX entrega, desenha a mesma árvore da demo
 16. transição compacto <-> espalhado: animação pausada em 10 pontos de cada sentido, nenhum
     cartão sobreposto em nenhum quadro, âncora parada, fios escondidos no caminho
 17. idiomas: em EN nenhuma palavra ou acento de português na tela (fora nome próprio);
     em PT nenhum rótulo em inglês (texto, dicas e exemplos, com painel, destaque e janela)
 (8b rolagem lateral, setas e zoom 100%; 12c CSV em inglês de ida e volta)
Rodar: pip install websocket-client  e depois  python tests/teste_organograma.py
(sai com código 1 se algo falhar; fotos de conferência em tests/fotos/)
"""
import json, os, sys, pathlib
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(__file__))
from cdp_util import Edge

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL = (RAIZ / "index.html").as_uri()
FOTOS = RAIZ / "tests" / "fotos"
FOTOS.mkdir(exist_ok=True)
falhas = []


def checa(nome, cond, detalhe=""):
    print(("OK    " if cond else "FALHA ") + nome + (f"  [{detalhe}]" if detalhe else ""))
    if not cond:
        falhas.append(nome)


# Contas feitas DIRETO no gerador (window.DADOS), sem passar pelo código do organograma.
ATIVOS = "(function(){const D=window.DADOS,r=D.dataRef;return D.pessoas.filter(p=>p.admissao<=r&&(!p.desligamento||p.desligamento>r))})()"
TEXTOS_OK = r"(function(){const t=document.body.innerText;return {chave:(t.match(/\[[a-z_0-9]+\]/)||[''])[0],travessao:t.includes(String.fromCharCode(8212))}})()"

# Sobreposição e fio cruzando cartão, lidos do layout que a tela usou.
GEOMETRIA = r"""(function(){
  // Os fios estão nas coordenadas do layout; os cartões, somados ao deslocamento do mundo (x0, y0).
  const L=__org.layout(), W=window.LAYOUT.C.W, H=window.LAYOUT.C.H, ps=[...L.pos.entries()].map(([id,p])=>[id,{x:p.x-L.x0,y:p.y-L.y0}]);
  let sobre=0, cruza=0;
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i][1],b=ps[j][1];
    if(a.x<b.x+W&&b.x<a.x+W&&a.y<b.y+H&&b.y<a.y+H)sobre++;}
  L.fios.forEach(f=>{const t=f.d.match(/[MLQ]|-?\d+(\.\d+)?/g);let i=0,cx=0,cy=0;
    while(i<t.length){const c=t[i++];
      if(c==='M'){cx=+t[i++];cy=+t[i++];}
      else if(c==='Q'){i+=2;cx=+t[i++];cy=+t[i++];}
      else{const x=+t[i++],y=+t[i++];
        ps.forEach(([id,p])=>{if(id===f.de||id===f.para)return;
          const v=cx===x&&cx>p.x&&cx<p.x+W&&Math.max(Math.min(cy,y),p.y+1)<Math.min(Math.max(cy,y),p.y+H-1);
          const h=cy===y&&cy>p.y&&cy<p.y+H&&Math.max(Math.min(cx,x),p.x+1)<Math.min(Math.max(cx,x),p.x+W-1);
          if(v||h)cruza++;});
        cx=x;cy=y;}}});
  return {cartoes:ps.length, fios:L.fios.length, sobre, cruza, w:Math.round(L.w), h:Math.round(L.h)};
})()"""


def clicar_js(ed, seletor, espera=0.4):
    ed.js(f"document.querySelector({json.dumps(seletor)}).click()", espera=espera)


with Edge(1440, 900) as ed:
    # 1 e 2. todas as combinações, com painel, destaque e janela de dados abertos
    combinacoes = 0
    for lang in ("pt", "en"):
        for tema in ("claro", "escuro"):
            for vista, modo in (("desenho", "compacto"), ("desenho", "espalhado"), ("lista", "compacto")):
                ed.ir(URL + f"?lang={lang}&tema={tema}&vista={vista}&modo={modo}", espera=2)
                ed.js("__org.expandirTudo(); __org.irPara(__org.org().nos[60].id)", espera=0.5)
                t1 = ed.js(TEXTOS_OK)
                clicar_js(ed, "[data-acao=destaque][data-v=vagas]")
                t2 = ed.js(TEXTOS_OK)
                clicar_js(ed, "[data-acao=destaque][data-v=vagas]")
                clicar_js(ed, "[data-acao=dados]")
                t3 = ed.js(TEXTOS_OK)
                clicar_js(ed, "[data-acao=fechar-modal]")
                combinacoes += 1
                for t in (t1, t2, t3):
                    if t["chave"] or t["travessao"]:
                        checa(f"2. textos {lang}/{tema}/{vista}/{modo}", False, json.dumps(t))
    erros = ed.erros()
    checa(f"1. sem erro de JS em {combinacoes} combinações (com painel, destaque e janela abertos)", not erros, "; ".join(erros[:3]))
    checa("2. sem [chave] faltando e sem travessão na tela", not [f for f in falhas if f.startswith("2.")])

    # 3. cartões = pessoas ativas (id por id)
    ed.ir(URL + "?lang=pt&tema=claro&vista=desenho&modo=compacto", espera=2.5)
    ed.foto(str(FOTOS / "inicial.png"))
    ed.js("__org.expandirTudo()", espera=0.4)
    ids_tela = ed.js("[...document.querySelectorAll('.cartao[data-tipo=pessoa]')].map(c=>c.dataset.id).sort()")
    ids_gerador = ed.js(ATIVOS + ".map(p=>p.id).sort()")
    vagas_tela = ed.js("document.querySelectorAll('.cartao[data-tipo=vaga]').length")
    vagas_gerador = ed.js("window.DADOS.vagas.filter(v=>v.status==='aberta').length")
    checa("3. cartões de pessoa = pessoas ativas na data (mesmos ids)", ids_tela == ids_gerador,
          f"tela {len(ids_tela)} x gerador {len(ids_gerador)}; vagas tracejadas {vagas_tela} x abertas {vagas_gerador}")
    checa("3b. vagas tracejadas = vagas abertas do gerador", vagas_tela == vagas_gerador, f"{vagas_tela} x {vagas_gerador}")

    # 4. gestor existe
    g = ed.js("""(function(){const cs=[...document.querySelectorAll('.cartao')], ids=new Set(cs.map(c=>c.dataset.id));
      const sem=cs.filter(c=>!c.dataset.gestor), orf=cs.filter(c=>c.dataset.gestor&&!ids.has(c.dataset.gestor));
      return {sem:sem.length, orfaos:orf.length, topo:sem.length?sem[0].querySelector('.c-cargo').textContent:''}})()""")
    checa("4. todo cartão tem gestor no desenho, menos o topo", g["sem"] == 1 and g["orfaos"] == 0, json.dumps(g, ensure_ascii=False))

    # 5 e 6. geometria nos dois modos
    comp = ed.js(GEOMETRIA)
    clicar_js(ed, "[data-acao=modo][data-v=espalhado]")
    esp = ed.js(GEOMETRIA)
    clicar_js(ed, "[data-acao=modo][data-v=compacto]")
    checa("5. nenhum cartão sobreposto e nenhum fio cruzando cartão (compacto e espalhado)",
          comp["sobre"] == comp["cruza"] == esp["sobre"] == esp["cruza"] == 0 and comp["cartoes"] == esp["cartoes"] == comp["fios"] + 1,
          f"compacto {comp} | espalhado {esp}")
    checa("6. compacto pelo menos 4x mais estreito que o espalhado", comp["w"] * 4 <= esp["w"], f"{comp['w']} px x {esp['w']} px")

    # 7. busca
    ed.ir(URL + "?lang=pt&tema=claro&vista=desenho&modo=compacto", espera=2.5)
    alvo = ed.js("""(function(){const o=__org.org(), prof=n=>{let d=0;while(n.gestor){n=o.porId.get(n.gestor);d++;}return d;};
      const f=o.nos.filter(n=>n.tipo==='pessoa'&&!(o.filhos.get(n.id)||[]).length).sort((a,b)=>prof(b)-prof(a)||(a.id<b.id?-1:1));
      return {id:f[0].id, nome:f[0].nome, prof:prof(f[0])}})()""")
    ed.js(f"var b=document.getElementById('busca'); b.focus(); b.value={json.dumps(alvo['nome'])}; b.dispatchEvent(new Event('input',{{bubbles:true}}))", espera=0.3)
    primeira = ed.js("(function(){const b=document.querySelector('#sugestoes button[data-id]');return b?b.dataset.id:null})()")
    clicar_js(ed, "#sugestoes button[data-id]", espera=1.0)
    r = ed.js(f"""(function(){{const c=document.querySelector('.cartao[data-id="{alvo['id']}"]').getBoundingClientRect(), t=document.getElementById('tela').getBoundingClientRect(), p=document.getElementById('painel'), pw=p.hidden?0:p.offsetWidth;
      return {{dx:Math.round(c.left+c.width/2-(t.left+(t.width-pw)/2)), dy:Math.round(c.top+c.height/2-(t.top+t.height/2)), caminho:document.querySelectorAll('.fio.caminho').length,
      painel:!p.hidden&&p.querySelector('h2').textContent, foco:(document.querySelector('.cartao.foco')||{{dataset:{{}}}}).dataset.id}}}})()""")
    ed.foto(str(FOTOS / "busca.png"))
    checa("7. busca acha, centraliza, acende o caminho até o topo e abre o painel",
          primeira == alvo["id"] and abs(r["dx"]) <= 2 and abs(r["dy"]) <= 2 and r["caminho"] == alvo["prof"] and r["painel"] == alvo["nome"] and r["foco"] == alvo["id"],
          f"alvo {alvo['nome']} (nível {alvo['prof']}): 1ª sugestão {primeira == alvo['id']}, desvio do centro {r['dx']},{r['dy']} px, fios acesos {r['caminho']}, painel '{r['painel']}'")

    # 7b. busca sem acento: "debora card" acha "Débora Cardoso"
    ed.js("var b=document.getElementById('busca'); b.value='debora card'; b.dispatchEvent(new Event('input',{bubbles:true}))", espera=0.3)
    sug = ed.js("[...document.querySelectorAll('#sugestoes button[data-id] b')].map(b=>b.textContent)")
    checa("7b. busca ignora acento", "Débora Cardoso" in sug, f"'debora card' -> {sug}")
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)

    # 8. mouse de verdade
    ed.ir(URL + "?lang=pt&tema=claro&vista=desenho&modo=compacto", espera=2.5)
    c = ed.js("(function(){const e=document.querySelectorAll('.cartao')[1], r=e.getBoundingClientRect();return {id:e.dataset.id,x:r.left+r.width/2,y:r.top+30}})()")
    ed.clicar(c["x"], c["y"])
    ed.esperar(0.4)
    abriu = ed.js("__org.estado.foco") == c["id"] and ed.js("!document.getElementById('painel').hidden")
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.3)
    antes = ed.js("[__org.camera.x, __org.camera.y]")
    ed.cmd("Input.dispatchMouseEvent", type="mousePressed", x=c["x"], y=c["y"], button="left", clickCount=1)
    for k in range(1, 11):
        ed.cmd("Input.dispatchMouseEvent", type="mouseMoved", x=c["x"] + 20 * k, y=c["y"] + 5 * k, button="left", buttons=1)
    ed.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=c["x"] + 200, y=c["y"] + 50, button="left", clickCount=1)
    ed.esperar(0.3)
    depois = ed.js("[__org.camera.x, __org.camera.y]")
    sem_painel = ed.js("document.getElementById('painel').hidden")
    ponto = (700, 520)
    m0 = ed.js(f"(function(){{const t=document.getElementById('tela').getBoundingClientRect(),c=__org.camera;return [({ponto[0]}-t.left-c.x)/c.z, ({ponto[1]}-t.top-c.y)/c.z, c.z]}})()")
    ed.cmd("Input.dispatchMouseEvent", type="mouseWheel", x=ponto[0], y=ponto[1], deltaX=0, deltaY=-300)
    ed.esperar(0.3)
    m1 = ed.js(f"(function(){{const t=document.getElementById('tela').getBoundingClientRect(),c=__org.camera;return [({ponto[0]}-t.left-c.x)/c.z, ({ponto[1]}-t.top-c.y)/c.z, c.z]}})()")
    arrastou = round(depois[0] - antes[0]) == 200 and round(depois[1] - antes[1]) == 50 and sem_painel
    zoom_ok = m1[2] > m0[2] and abs(m1[0] - m0[0]) < 0.5 and abs(m1[1] - m0[1]) < 0.5
    checa("8. clique abre o painel; arrastar move sem abrir; roda dá zoom no cursor", abriu and arrastou and zoom_ok,
          f"clique={abriu}; arrasto {round(depois[0] - antes[0])},{round(depois[1] - antes[1])} px sem painel={sem_painel}; zoom {m0[2]:.2f} -> {m1[2]:.2f}, ponto sob o cursor andou {abs(m1[0] - m0[0]):.2f},{abs(m1[1] - m0[1]):.2f}")

    # 8b. touchpad / Shift + roda anda sem zoom; setas andam; clique no número do zoom volta a 100%
    c0 = ed.js("[__org.camera.x, __org.camera.y, __org.camera.z]")
    ed.cmd("Input.dispatchMouseEvent", type="mouseWheel", x=700, y=520, deltaX=120, deltaY=40)
    ed.esperar(0.2)
    c1 = ed.js("[__org.camera.x, __org.camera.y, __org.camera.z]")
    ed.cmd("Input.dispatchKeyEvent", type="rawKeyDown", key="ArrowRight", code="ArrowRight", windowsVirtualKeyCode=39)
    ed.cmd("Input.dispatchKeyEvent", type="keyUp", key="ArrowRight", code="ArrowRight", windowsVirtualKeyCode=39)
    ed.esperar(0.5)
    c2 = ed.js("[__org.camera.x, __org.camera.y, __org.camera.z]")
    clicar_js(ed, "[data-acao=zoom-100]", espera=0.6)
    c3 = ed.js("__org.camera.z")
    checa("8b. rolagem lateral anda sem zoom; seta anda; clique no zoom volta a 100%",
          round(c1[0] - c0[0]) == -120 and round(c1[1] - c0[1]) == -40 and c1[2] == c0[2] and round(c2[0] - c1[0]) == -80 and abs(c3 - 1) < 1e-9,
          f"rolagem moveu {round(c1[0] - c0[0])},{round(c1[1] - c0[1])} px com zoom igual={c1[2] == c0[2]}; seta {round(c2[0] - c1[0])} px; zoom final {c3:.2f}")

    # 9. filtro
    ed.ir(URL + "?lang=pt&tema=claro&vista=desenho&modo=compacto", espera=2.5)
    conta = "[+document.getElementById('conta').dataset.n, +document.getElementById('conta').dataset.t]"
    n0, t0 = ed.js(conta)
    ed.js("var s=document.querySelector('[data-filtro=unidade]'); s.value='cd'; s.dispatchEvent(new Event('change',{bubbles:true}))", espera=0.6)
    n1, _ = ed.js(conta)
    cart = ed.js("document.querySelectorAll('.cartao[data-tipo=pessoa]:not(.contexto)').length")
    esperado = ed.js(ATIVOS + ".filter(p=>p.unidade==='cd').length")
    ed.js("var s=document.querySelector('[data-filtro=area]'); s.value='log'; s.dispatchEvent(new Event('change',{bubbles:true}))", espera=0.6)
    n2, _ = ed.js(conta)
    clicar_js(ed, "[data-acao=limpar]", espera=0.6)
    n3, _ = ed.js(conta)
    checa("9. filtro reduz (contagem e cartões) e Limpar volta", n0 == t0 and 0 < n2 <= n1 < t0 and cart == n1 == esperado and n3 == t0,
          f"{n0} -> Centro de Distribuição {n1} (cartões {cart}, gerador {esperado}) -> + Logística {n2} -> Limpar {n3}")

    # 10. recolher e expandir (espera a animação do "Expandir tudo" acabar antes de medir)
    ed.js("__org.expandirTudo()", espera=1.0)
    rec = ed.js("""(function(){const o=__org.org(), g=o.nos.find(n=>n.nivel==='ger'&&n.area==='man'); let d=0;
      const c=n=>(o.filhos.get(n.id)||[]).forEach(f=>{d++;c(f)}); c(g);
      const r=document.querySelector('.cartao[data-id="'+g.id+'"]').getBoundingClientRect();
      return {id:g.id, desc:d, antes:document.querySelectorAll('.cartao').length, x:r.left, y:r.top}})()""")
    clicar_js(ed, f".cartao[data-id=\"{rec['id']}\"] .pilula", espera=0.5)
    dep = ed.js(f"""(function(){{const r=document.querySelector('.cartao[data-id="{rec['id']}"]').getBoundingClientRect();
      return {{n:document.querySelectorAll('.cartao').length, filhos:document.querySelectorAll('.cartao[data-gestor="{rec['id']}"]').length, x:r.left, y:r.top}}}})()""")
    clicar_js(ed, f".cartao[data-id=\"{rec['id']}\"] .pilula", espera=0.8)
    volta = ed.js("document.querySelectorAll('.cartao').length")
    checa("10. recolher esconde o ramo inteiro sem tirar o cartão do lugar; expandir devolve",
          dep["n"] == rec["antes"] - rec["desc"] and dep["filhos"] == 0 and abs(dep["x"] - rec["x"]) < 1 and abs(dep["y"] - rec["y"]) < 1 and volta == rec["antes"],
          f"{rec['antes']} cartões -> {dep['n']} (ramo de {rec['desc']}), cartão andou {abs(dep['x'] - rec['x']):.1f},{abs(dep['y'] - rec['y']):.1f} px -> {volta}")

    # 10b. teclado de verdade: Enter na pílula recolhe o ramo (e não abre o painel)
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)
    n_antes = ed.js("document.querySelectorAll('.cartao').length")
    ed.js(f"document.querySelector('.cartao[data-id=\"{rec['id']}\"] .pilula').focus()", espera=0.2)
    rolagem = ed.js("[document.getElementById('tela').scrollLeft, document.getElementById('tela').scrollTop]")
    ed.cmd("Input.dispatchKeyEvent", type="keyDown", key="Enter", code="Enter", windowsVirtualKeyCode=13, text="\r", unmodifiedText="\r")
    ed.cmd("Input.dispatchKeyEvent", type="keyUp", key="Enter", code="Enter", windowsVirtualKeyCode=13)
    ed.esperar(0.5)
    tecla = ed.js("[document.querySelectorAll('.cartao').length, document.getElementById('painel').hidden]")
    checa("10b. teclado: Enter na pílula recolhe o ramo sem abrir o painel; foco não desalinha a tela", tecla[0] == n_antes - rec["desc"] and tecla[1] and rolagem == [0, 0],
          f"{n_antes} -> {tecla[0]} cartões, painel fechado={tecla[1]}, rolagem da tela depois do foco {rolagem}")

    # 11. destaques contados direto do gerador
    ed.ir(URL + "?lang=pt&tema=claro&vista=desenho&modo=compacto", espera=2.5)
    regras = {
        "aniv": ATIVOS + ".filter(p=>p.nascimento.getMonth()===window.DADOS.dataRef.getMonth()).length",
        "novatos": ATIVOS + ".filter(p=>(window.DADOS.dataRef-p.admissao)/864e5<90).length",
        "vagas": "window.DADOS.vagas.filter(v=>v.status==='aberta').length",
    }
    partes, ok11 = [], True
    for chave, js in regras.items():
        esperado = ed.js(js)
        clicar_js(ed, f"[data-acao=destaque][data-v={chave}]", espera=0.6)
        tela = ed.js("[document.querySelectorAll('.cartao.realce').length, document.querySelectorAll('#painel .pn-lista li').length]")
        if chave == "aniv":
            ed.foto(str(FOTOS / "aniversariantes.png"))
        clicar_js(ed, f"[data-acao=destaque][data-v={chave}]", espera=0.3)
        ok11 = ok11 and tela[0] == tela[1] == esperado and esperado > 0
        partes.append(f"{chave} {tela[0]} cartões/{tela[1]} na lista x {esperado} no gerador")
    checa("11. destaques batem com o gerador", ok11, "; ".join(partes))

    # 12. CSV: ida e volta
    arvore = "JSON.stringify(__org.org().nos.map(n=>[n.id,n.gestor||'',n.tipo]).sort())"
    antes_csv = ed.js(arvore)
    linhas = ed.js("__org.textoCsv(true).trim().split('\\r\\n').length - 1")
    total = ed.js("__org.org().nos.length")
    ed.js("__org.carregarTexto(__org.textoCsv(true)); __org.expandirTudo()", espera=0.5)
    depois_csv = ed.js(arvore)
    proprio = ed.js("[__org.org().ficticio, __org.org().avisos.length, document.querySelectorAll('.cartao').length]")
    checa("12. CSV com uma linha por cartão; colado de volta desenha a mesma árvore", linhas == total and antes_csv == depois_csv and proprio == [False, 0, total],
          f"{linhas} linhas para {total} cartões; mesma árvore={antes_csv == depois_csv}; dado próprio={not proprio[0]}, avisos {proprio[1]}, cartões {proprio[2]}")
    dificil = 'id,nome,cargo,gestor_id,area\n1,"Pessoa, Um","Diretora ""Geral""",,Diretoria\n2,Pessoa Dois,Analista,1,Financeiro\n3,Pessoa Tres,Analista,99,Financeiro\n'
    ed.js(f"__org.carregarTexto({json.dumps(dificil)})", espera=0.3)
    d = ed.js("(function(){const o=__org.org();return {n:o.nos.length, raizes:o.raizes.length, cargo:o.porId.get('1').cargo, nome:o.porId.get('1').nome, avisos:o.avisos.map(a=>a.tipo)}})()")
    checa("12b. CSV com aspas, vírgula no nome e gestor inexistente: lido e avisado",
          d["n"] == 3 and d["raizes"] == 2 and d["cargo"] == 'Diretora "Geral"' and d["nome"] == "Pessoa, Um" and d["avisos"] == ["gestor_inexistente"], json.dumps(d, ensure_ascii=False))
    ed.js("__org.voltarFicticia()", espera=0.4)
    clicar_js(ed, "[data-acao=lang][data-v=en]", espera=0.3)
    cab_en = ed.js("__org.textoCsv(true).split('\\r\\n')[0].replace(String.fromCharCode(0xFEFF), '')")
    ed.js("__org.carregarTexto(__org.textoCsv(true))", espera=0.4)
    volta_en = ed.js(arvore)
    ed.js("__org.voltarFicticia()", espera=0.3)
    clicar_js(ed, "[data-acao=lang][data-v=pt]", espera=0.3)
    checa("12c. CSV em inglês (cabeçalho e valores) volta com a mesma árvore", volta_en == antes_csv and cab_en.startswith("id;name;title;department"),
          f"cabeçalho '{cab_en[:60]}...'; mesma árvore={volta_en == antes_csv}")

    # 13. impressão
    ed.cmd("Emulation.setEmulatedMedia", media="print")
    imp = ed.js("(function(){const v=e=>getComputedStyle(document.querySelector(e)).display;return {barra:v('.barra'), acoes:v('.acoes'), zoom:v('.f-zoom'), palco:v('.palco'), cartoes:document.querySelectorAll('.cartao').length}})()")
    ed.cmd("Emulation.setEmulatedMedia", media="")
    checa("13. impressão: barra e botões somem, o desenho fica", imp["barra"] == imp["acoes"] == imp["zoom"] == "none" and imp["palco"] != "none" and imp["cartoes"] > 0, json.dumps(imp))
    # 16. transição compacto <-> espalhado, quadro a quadro (animações pausadas em 10 pontos)
    ed.ir(URL + "?lang=pt&tema=claro&vista=desenho&modo=compacto", espera=2.5)
    ed.js("__org.expandirTudo()", espera=1.2)
    partes, ok16 = [], True
    for modo, nome in (("espalhado", "compacto -> espalhado"), ("compacto", "espalhado -> compacto")):
        anc = ed.js("__org.ancoraNaTela()")
        r0 = ed.js(f"(function(){{const r=document.querySelector('.cartao[data-id=\"{anc}\"]').getBoundingClientRect();return [r.left,r.top]}})()")
        ed.js(f"document.querySelector('[data-acao=modo][data-v={modo}]').click(); window.__anims = document.getAnimations().filter(a=>a.effect&&a.effect.target&&a.effect.target.classList.contains('cartao')); window.__anims.forEach(a=>a.pause())")
        fios_ocultos = ed.js("getComputedStyle(document.querySelector('.fios')).opacity === '0'")
        n_anim = ed.js("window.__anims.length")
        pior, anc_max = 0, 0.0
        for k in range(10):
            f = 0.05 + k * 0.1
            q = ed.js(f"""(function(){{window.__anims.forEach(a=>{{a.currentTime={f}*a.effect.getTiming().duration}});
              const rs=[...document.querySelectorAll('.cartao')].map(e=>e.getBoundingClientRect()); let n=0;
              for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){{const a=rs[i],b=rs[j];
                if(a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5)n++;}}
              const r=document.querySelector('.cartao[data-id="{anc}"]').getBoundingClientRect();return [n,r.left,r.top]}})()""")
            pior = max(pior, q[0])
            anc_max = max(anc_max, abs(q[1] - r0[0]), abs(q[2] - r0[1]))
        ed.js("window.__anims.forEach(a=>a.finish())", espera=1.0)
        fim = ed.js("[document.querySelectorAll('.cartao').length, getComputedStyle(document.querySelector('.fios')).opacity]")
        ok16 = ok16 and n_anim > 100 and pior == 0 and anc_max < 0.5 and fios_ocultos and fim == [273, "1"]
        partes.append(f"{nome}: {n_anim} cartões deslizando, sobreposições no pior quadro {pior}, âncora andou {anc_max:.1f} px, fios escondidos={fios_ocultos}, no fim {fim[0]} cartões e fios visíveis={fim[1] == '1'}")
    checa("16. transição desliza sem sobrepor cartões, âncora parada, fios escondidos no caminho", ok16, " | ".join(partes))

    # 17. idiomas: em EN nada de português (fora nome próprio); em PT nenhum rótulo em inglês
    # Iniciais no avatar saem do nome próprio ("DO" = Diego Oliveira): ficam fora da leitura.
    TELA = r"""(function(){const av=[...document.querySelectorAll('.av')];av.forEach(a=>a.style.display='none');
      let t=document.title+'\n'+document.body.innerText;av.forEach(a=>a.style.display='');
      document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e=>{if(e.closest('[hidden]'))return;
        ['placeholder','title','aria-label'].forEach(a=>{const v=e.getAttribute(a);if(v)t+='\n'+v;});});return t;})()"""
    NOMES = "(function(){const o=__org.org();return o.nos.map(n=>n.nome).filter(Boolean).concat([o.empresa]).sort((a,b)=>b.length-a.length)})()"
    import re
    PT_EM_EN = re.compile(r"[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]|\b(de|da|do|das|dos|para|com|pessoas?|vagas?|equipe|todas|limpar|buscar|desenho|lista|gerente|analista|coordenador|diretora?|unidade|estrutura|cargo|gestor|aniversariantes|novatos|ramo|topo|aberta|fechar|carregar|baixar|imprimir|escuro|claro|recolher|expandir|nome)\b", re.I)
    EN_EM_PT = re.compile(r"\b(the|and|of|to|all|search|clear|open|positions?|people|manager|team|chart|compact|spread|expand|collapse|center|download|print|light|dark|birthdays?|new|hires?|level|units?|areas|reports|chain|branch|show|view|close|load|choose|file|template|warnings|supply|specialist|analyst|operator|intern|board|office|remote|plant|finance|maintenance|operations|logistics|technology|demo)\b", re.I)
    achados17 = {}
    for lang in ("en", "pt"):
        textos = []
        for vista in ("desenho", "lista"):
            ed.ir(URL + f"?lang={lang}&tema=claro&vista={vista}&modo=compacto", espera=2)
            nomes = ed.js(NOMES)
            ed.js("__org.expandirTudo(); __org.irPara(__org.org().nos.find(n=>n.tipo==='vaga').id)", espera=0.6)
            textos.append(ed.js(TELA))
            ed.js("__org.irPara(__org.org().nos[80].id)", espera=0.5)
            textos.append(ed.js(TELA))
            clicar_js(ed, "[data-acao=destaque][data-v=aniv]", espera=0.5)
            textos.append(ed.js(TELA))
            clicar_js(ed, "[data-acao=dados]", espera=0.3)
            textos.append(ed.js(TELA))
            clicar_js(ed, "[data-acao=fechar-modal]", espera=0.2)
        texto = "\n".join(textos)
        for n in nomes:
            texto = texto.replace(n, " ")
        texto = re.sub(r"[\w.]+@cpaoli\.example", " ", texto)
        regra = PT_EM_EN if lang == "en" else EN_EM_PT
        achados17[lang] = sorted(set(m.group(0) for m in regra.finditer(texto)))
    checa("17. idiomas: em EN nenhum português fora nome próprio; em PT nenhum rótulo em inglês", not achados17["en"] and not achados17["pt"],
          f"português na tela em EN: {achados17['en'] or 'nenhum'}; inglês na tela em PT: {achados17['pt'] or 'nenhum'}")

    erros_fim = ed.erros()
    checa("1b. nenhum erro de JS durante os testes 3 a 17", not erros_fim, "; ".join(erros_fim[:3]))

with Edge(390, 844) as ed:
    ok14, partes = True, []
    for lang, tema in (("pt", "claro"), ("en", "escuro")):
        ed.ir(URL + f"?lang={lang}&tema={tema}", espera=2.5)
        sw, iw = ed.js("[document.documentElement.scrollWidth, innerWidth]")
        lista = ed.js("[document.querySelectorAll('.li').length, document.getElementById('tela').hidden]")
        ed.js("document.querySelectorAll('.li')[2].click()", espera=0.4)
        painel = ed.js("(function(){const p=document.getElementById('painel');return !p.hidden && Math.round(p.getBoundingClientRect().width)})()")
        if lang == "pt":
            ed.foto(str(FOTOS / "celular_detalhe.png"))
        ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.3)
        ed.js("__org.expandirTudo()", espera=0.4)
        sw2 = ed.js("document.documentElement.scrollWidth")
        ok14 = ok14 and sw <= iw and sw2 <= iw and lista[0] > 0 and lista[1] and painel == iw
        partes.append(f"{lang}/{tema}: largura {sw}/{sw2} de {iw}, {lista[0]} linhas, detalhe {painel}px")
    checa("14. celular: lista em árvore, nada vaza para o lado, tocar abre o detalhe", ok14 and not ed.erros(), "; ".join(partes) + ("; erros: " + "; ".join(ed.erros()[:2]) if ed.erros() else ""))

PBI = RAIZ / "powerbi"
if (PBI / "teste_powerbi.html").exists():
    with Edge(1440, 900) as ed:
        ed.ir((PBI / "organograma_powerbi.html").as_uri(), espera=2.5)
        a = ed.js("(function(){__org.expandirTudo();return {n:document.querySelectorAll('.cartao').length, botoes:document.querySelectorAll('[data-acao=csv],[data-acao=dados],[data-acao=imprimir]').length, fontes:document.querySelectorAll('link[href*=googleapis]').length}})()")
        demo = ed.js("JSON.stringify(__org.org().nos.map(n=>[n.id,n.gestor||'',n.tipo]).sort())")
        ed.ir((PBI / "teste_powerbi.html").as_uri(), espera=2.5)
        b = ed.js("(function(){__org.expandirTudo();const o=__org.org();return {n:document.querySelectorAll('.cartao').length, ficticio:o.ficticio, avisos:o.avisos.length, fonte:document.querySelector('.empresa').textContent}})()")
        mesma = ed.js("JSON.stringify(__org.org().nos.map(n=>[n.id,n.gestor||'',n.tipo]).sort())") == demo
        ed.foto(str(FOTOS / "powerbi.png"))
        checa("15. modo Power BI: HTML único sem internet e sem erro; dado da medida desenha a mesma árvore",
              a["n"] == b["n"] == 273 and a["botoes"] == 0 and a["fontes"] == 0 and b["ficticio"] is False and b["avisos"] == 0 and mesma and not ed.erros(),
              f"HTML único {a['n']} cartões, botões de arquivo {a['botoes']}, fontes externas {a['fontes']}; com o CSV da medida {b['n']} cartões, mesma árvore={mesma}, avisos {b['avisos']}; '{b['fonte'][:60]}'")

print("\nRESULTADO:", "TUDO OK" if not falhas else f"{len(falhas)} FALHA(S)")
sys.exit(1 if falhas else 0)
