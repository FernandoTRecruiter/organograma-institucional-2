# -*- coding: utf-8 -*-
"""
gera_powerbi.py: transforma o organograma num HTML ÚNICO e numa MEDIDA DAX para o
visual "HTML Content" do Power BI (o mesmo caminho da v1, que era uma medida DAX).

Por que precisa de um gerador:
  - o visual não lê arquivos separados (js/ e css/): tudo vai num texto só e sem
    internet (a fonte do Google fica de fora; entra a fonte do sistema);
  - o DAX não aceita texto com mais de ~32 mil caracteres: o HTML vai em pedaços
    (_a1... antes dos dados, _d1... depois) que a medida junta no RETURN;
  - os dados não ficam no código: a medida monta o JSON da SUA tabela com
    CONCATENATEX e entrega em window.ORGANOGRAMA_DADOS (formato no README).

Rodar (na pasta do repositório):  python powerbi/gera_powerbi.py   (o CSV de exemplo usa o Node)
Saídas em powerbi/:
  MedidaOrganograma.dax       a medida para colar no Power BI
  organograma_powerbi.html    o HTML único com a empresa fictícia (abra para conferir)
  exemplo_organograma.csv     a empresa fictícia no formato da tabela (para testar a medida)
  teste_powerbi.html          o HTML único lendo o CSV de exemplo como a medida entregaria
"""
import csv, datetime, io, json, pathlib, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")

PASTA = pathlib.Path(__file__).resolve().parent
RAIZ = PASTA.parent
LIMITE = 30000  # caracteres por pedaço, já contando as aspas dobradas do DAX


# Passo 1: os css/js locais, na ordem em que o index.html carrega.
def arquivos():
    html = (RAIZ / "index.html").read_text(encoding="utf-8")
    return re.findall(r'href="(css/[^"]+)"', html), re.findall(r'<script src="(js/[^"]+)"></script>', html)


# Passo 2: tirar só comentário que ocupa a linha inteira (cabeçalhos e notas).
# Comentário no meio do código fica: tirar dali exigiria entender o código, e o risco não compensa.
def sem_comentarios(texto):
    saida, dentro = [], False
    for linha in texto.splitlines():
        t = linha.strip()
        if dentro:
            dentro = "*/" not in t
            continue
        if t.startswith("/*"):
            dentro = "*/" not in t
            continue
        if not t or t.startswith("//"):
            continue
        saida.append(linha.rstrip())
    return "\n".join(saida)


def montar():
    css, js = arquivos()
    estilo = "\n".join(sem_comentarios((RAIZ / c).read_text(encoding="utf-8")) for c in css)
    codigo = "\n".join(sem_comentarios((RAIZ / j).read_text(encoding="utf-8")) for j in js)
    codigo = codigo.replace("</script", "<\\/script")  # senão o navegador fecha a tag antes da hora
    antes = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
             '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Organograma</title>'
             "<style>" + estilo + '</style></head><body><div class="app" id="app"></div>'
             "<script>window.MODO_POWERBI = true;</script>")
    depois = "<script>" + codigo + "</script></body></html>"
    return antes, depois


# Passo 3: texto vira pedaços de DAX (aspas viram aspas dobradas) com no máximo LIMITE.
def pedacos(texto):
    saida, atual, tam = [], [], 0
    for ch in texto:
        e = '""' if ch == '"' else ch
        if tam + len(e) > LIMITE:
            saida.append("".join(atual))
            atual, tam = [], 0
        atual.append(e)
        tam += len(e)
    if atual:
        saida.append("".join(atual))
    return saida


# Campo -> coluna do modelo. Cada linha da medida começa com a própria vírgula: dá para
# comentar (--) a linha de uma coluna que você não tem sem quebrar o resto.
CAMPOS = [
    ("id", "'Pessoas'[ID]", "texto", True),
    ("nome", "'Pessoas'[Nome]", "texto", True),
    ("cargo", "'Pessoas'[Cargo]", "texto", True),
    ("gestor_id", "'Pessoas'[GestorID]", "texto", True),
    ("area", "'Pessoas'[Area]", "texto", False),
    ("unidade", "'Pessoas'[Unidade]", "texto", False),
    ("nivel", "'Pessoas'[Nivel]", "texto", False),
    ("admissao", "'Pessoas'[Admissao]", "data", False),
    ("aniversario", "'Pessoas'[Nascimento]", "diames", False),
    ("tipo", "'Pessoas'[Tipo]", "texto", False),
]


def valor_dax(coluna, tipo):
    if tipo == "data":
        return f'IF(ISBLANK({coluna}), "", FORMAT({coluna}, "yyyy-mm-dd"))'
    if tipo == "diames":
        # Só dia e mês (o ano de nascimento não sai do modelo). FORMAT com "dd/mm" trocaria
        # a barra pelo separador de data da região; montando à mão, a barra fica.
        return f'IF(ISBLANK({coluna}), "", FORMAT({coluna}, "dd") & "/" & FORMAT({coluna}, "mm"))'
    # Texto entra no JSON entre aspas: aspas, barra invertida, quebra de linha e "<" saem.
    return (f'SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({coluna} & "", """", "\'"), "\\", "/"), '
            f'UNICHAR(10), " "), UNICHAR(13), " "), "<", " ")')


def escrever_dax(antes, depois):
    pa, pd = pedacos(antes), pedacos(depois)
    linhas = []
    for i, (campo, coluna, tipo, obrigatorio) in enumerate(CAMPOS):
        # Em DAX, "" dentro do texto é uma aspa: "{""id"":""" vira {"id":"  e  ",""nome"":""" vira ,"nome":"
        prefixo = "{" if i == 0 else ","
        nota = "" if obrigatorio else "   -- opcional: sem esta coluna, comente a linha"
        linhas.append(f'        "{prefixo}""{campo}"":""" & {valor_dax(coluna, tipo)} & """" &{nota}')
    out = [
        "OrganogramaHTML =",
        f"-- Gerado por powerbi/gera_powerbi.py em {datetime.date.today().isoformat()}. Os blocos _a e _d sao o codigo do organograma: nao edite, rode o gerador de novo.",
        "-- PASSO 1: troque 'Pessoas' e cada [Coluna] pelos nomes do SEU modelo (veja powerbi/LEIA-ME.md).",
        "-- Uma linha por pessoa ATIVA (e por vaga aberta, se tiver). gestor_id vazio = topo.",
        "VAR _linhas =",
        "    CONCATENATEX(",
        "        'Pessoas',",
        *linhas,
        '        "}",',
        '        ","',
        "    )",
        "-- Data da estrutura: aniversariantes do mes e novatos (menos de 90 dias) contam a partir dela.",
        'VAR _dataRef = FORMAT(TODAY(), "yyyy-mm-dd")',
        'VAR _empresa = "Minha empresa"',
        "",
    ]
    out += [f'VAR _a{i} = "{t}"' for i, t in enumerate(pa, 1)]
    out += [f'VAR _d{i} = "{t}"' for i, t in enumerate(pd, 1)]
    out += [
        "",
        "RETURN",
        "    " + " & ".join(f"_a{i}" for i in range(1, len(pa) + 1)) + " &",
        '    "<script>window.ORGANOGRAMA_DADOS = {""empresa"":""" & _empresa & """,""dataRef"":""" & _dataRef & """,""pessoas"":[" & _linhas & "]};</script>" &',
        "    " + " & ".join(f"_d{i}" for i in range(1, len(pd) + 1)),
    ]
    (PASTA / "MedidaOrganograma.dax").write_text("\n".join(out) + "\n", encoding="utf-8")
    return len(pa) + len(pd), max(len(x) for x in pa + pd)


# Passo 4: a empresa fictícia no formato da tabela (a mesma exportação do botão "Baixar CSV").
def exemplo_csv():
    js = r"""
    global.window = {};
    ['dados', 'estrutura', 'i18n'].forEach(f => require(process.argv[1] + '/js/' + f + '.js'));
    const E = window.ESTRUTURA, org = E.daFicticia(window.DADOS), nos = [];
    const andar = n => { nos.push(n); (org.filhos.get(n.id) || []).forEach(andar); };
    org.raizes.forEach(andar);
    process.stdout.write(E.paraCsv(org, nos, window.I18N.nome));
    """
    texto = subprocess.run(["node", "-e", js, str(RAIZ)], capture_output=True, text=True, encoding="utf-8", check=True).stdout
    (PASTA / "exemplo_organograma.csv").write_text(texto, encoding="utf-8", newline="")
    return texto


# Passo 5: o que a medida entregaria lendo o CSV de exemplo (mesmos campos do DAX).
def html_de_teste(antes, depois, texto_csv):
    leitor = csv.DictReader(io.StringIO(texto_csv.lstrip(chr(0xFEFF))), delimiter=";")
    pessoas = []
    for r in leitor:
        pessoas.append({"id": r["id"], "nome": r["nome"], "cargo": r["cargo"], "gestor_id": r["gestor_id"], "area": r["area"],
                        "unidade": r["unidade"], "nivel": r["nivel"], "admissao": r["admissao"], "aniversario": r["aniversario"], "tipo": r["tipo"]})
    dados = {"empresa": "C. & Paoli corp.", "dataRef": "2026-09-30", "pessoas": pessoas}
    meio = "<script>window.ORGANOGRAMA_DADOS = " + json.dumps(dados, ensure_ascii=False).replace("</", "<\\/") + ";</script>"
    (PASTA / "teste_powerbi.html").write_text(antes + meio + depois, encoding="utf-8")
    return len(pessoas)


if __name__ == "__main__":
    antes, depois = montar()
    (PASTA / "organograma_powerbi.html").write_text(antes + depois, encoding="utf-8")
    n_pedacos, maior = escrever_dax(antes, depois)
    linhas = html_de_teste(antes, depois, exemplo_csv())
    print(f"HTML único: {len(antes) + len(depois):,} caracteres | medida: {n_pedacos} pedaços (maior {maior:,})"
          f" | exemplo: {linhas} linhas".replace(",", "."))
