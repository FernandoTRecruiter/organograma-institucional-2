/* =============================================================================
   app.js: liga tudo. Guarda o estado, decide quem aparece (filtro, ramo
   recolhido, destaque), pede o layout, desenha (cartões e fios, ou a lista no
   celular) e responde a clique, busca, teclado e botões.
   Regra que se repete: muda o estado, redesenha. Simples de seguir.
   ============================================================================= */
(function () {
  'use strict';
  const I = window.I18N, T = I.T, E = window.ESTRUTURA, L = window.LAYOUT, V = window.VISUAL, esc = V.esc;
  const CHAVE = 'paoli-organograma-2';
  const DIA = 864e5;
  const CELULAR = window.matchMedia('(max-width: 720px)');
  const semAcento = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  // Mesma regra, mas letra por letra: o texto não muda de tamanho (serve para pintar o trecho achado).
  const semAcentoMesmoTamanho = s => String(s || '').split('').map(c => semAcento(c)[0] || c).join('');

  /* ---------- Passo 1: estado. Quem manda: endereço (?lang=en) > última escolha > padrão ---------- */
  function lerGuardado() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function guardar() {
    try { localStorage.setItem(CHAVE, JSON.stringify({ lang: estado.lang, tema: estado.tema, modo: estado.modo, vista: estado.vista })); } catch (e) { /* sem armazenamento: tudo bem */ }
  }
  const q = new URLSearchParams(location.search), g = lerGuardado();
  const escuroSistema = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const escolha = (nome, validos, padrao) => validos.includes(q.get(nome)) ? q.get(nome) : (validos.includes(g[nome]) ? g[nome] : padrao);
  const estado = {
    lang: escolha('lang', ['pt', 'en'], 'en'),
    tema: escolha('tema', ['claro', 'escuro'], escuroSistema ? 'escuro' : 'claro'),
    modo: escolha('modo', ['compacto', 'espalhado'], 'compacto'),
    vista: escolha('vista', ['desenho', 'lista'], 'desenho'),
    filtros: { unidade: '', area: '' },
    destaque: '',   // '', 'aniv', 'novatos' ou 'vagas'
    foco: null,     // quem está selecionado: caminho aceso até o topo
    painel: null,   // null, 'pessoa' ou 'lista'
    modal: null     // janela de dados próprios aberta (e o que ela mostra)
  };

  /* ---------- Passo 2: o dado. Próprio (window.ORGANOGRAMA_DADOS) ou a empresa fictícia ---------- */
  function orgInicial() {
    const x = window.ORGANOGRAMA_DADOS;
    if (x) return E.deLinhas(Array.isArray(x) ? { linhas: x } : { linhas: x.pessoas || [], empresa: x.empresa, dataRef: x.dataRef });
    return E.daFicticia(window.DADOS);
  }
  let org = orgInicial();
  // Organograma grande abre só os primeiros níveis (cerca de 30 cartões): legível de cara.
  function recolhimentoInicial() {
    const r = new Set();
    if (org.nos.length <= 60) return r;
    let fronteira = org.raizes.slice(), total = fronteira.length;
    for (;;) {
      const prox = fronteira.flatMap(n => org.filhos.get(n.id) || []);
      if (!prox.length) break;
      if (total + prox.length > 30) { fronteira.forEach(n => { if ((org.filhos.get(n.id) || []).length) r.add(n.id); }); break; }
      total += prox.length;
      fronteira = prox;
    }
    return r;
  }
  let recolhido = recolhimentoInicial();

  /* ---------- Passo 3: quem aparece ---------- */
  // Filtro mantém quem casa E a cadeia até o topo (apagada, "contexto"):
  // o desenho nunca fica solto no ar e a contagem por ramo continua honesta.
  function calcularVisao() {
    const f = estado.filtros, temFiltro = !!(f.unidade || f.area);
    const casa = new Set(), mostra = new Set();
    org.nos.forEach(n => { if ((!f.unidade || n.unidade === f.unidade) && (!f.area || n.area === f.area)) casa.add(n.id); });
    const subir = (id, alvo) => { let n = org.porId.get(id); while (n && !alvo.has(n.id)) { alvo.add(n.id); n = n.gestor ? org.porId.get(n.gestor) : null; } };
    casa.forEach(id => subir(id, mostra));
    const filhos = n => (org.filhos.get(n.id) || []).filter(c => mostra.has(c.id));
    const ramo = new Map();
    const contar = n => { let t = 0; filhos(n).forEach(c => { t += contar(c) + (c.tipo === 'pessoa' && casa.has(c.id) ? 1 : 0); }); ramo.set(n.id, t); return t; };
    const raizes = org.raizes.filter(r => mostra.has(r.id));
    raizes.forEach(contar);
    // Destaques: tudo relativo à data da estrutura (não ao relógio de quem abre).
    const ref = org.dataRef, mes = ref.getMonth() + 1;
    const novo = n => n.tipo === 'pessoa' && !!n.admissao && n.admissao <= ref && (ref - n.admissao) / DIA < 90;
    const aniv = n => n.tipo === 'pessoa' && !!n.aniversario && n.aniversario.m === mes;
    const regras = { aniv, novatos: novo, vagas: n => n.tipo === 'vaga' };
    const regra = regras[estado.destaque] || null;
    const realce = new Set(regra ? [...casa].filter(id => regra(org.porId.get(id))) : []);
    const realceCadeia = new Set();
    realce.forEach(id => subir(id, realceCadeia));
    const cadeia = new Set();
    if (estado.foco && mostra.has(estado.foco)) subir(estado.foco, cadeia);
    return { temFiltro, casa, mostra, filhos, ramo, raizes, novo, aniv, regras, regra, realce, realceCadeia, cadeia };
  }

  /* ---------- Passo 4: a moldura da página (criada uma vez) ---------- */
  const app = document.getElementById('app');
  app.innerHTML = '<header class="topo" id="topo"></header>' +
    '<div class="barra" id="barra"><div class="busca-caixa">' + V.ICONES.busca +
    '<input id="busca" class="busca" type="search" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="sugestoes">' +
    '<ul class="sugestoes" id="sugestoes" role="listbox" hidden></ul></div><div id="barra-resto" style="display:contents"></div></div>' +
    '<div class="so-impressao" id="imp-cab"></div>' +
    '<main class="palco" id="palco"><div class="tela" id="tela"><div class="mundo" id="mundo"></div>' +
    '<div class="flutua f-topo" id="f-topo"></div><div class="flutua f-zoom" id="f-zoom"></div>' +
    '<div class="legenda" id="legenda"></div><div class="dica-nav" id="dica-nav"></div></div>' +
    '<div class="lista" id="lista" hidden></div><aside class="painel" id="painel" hidden></aside></main>' +
    '<div id="modal"></div><div class="aviso" id="aviso" role="status" hidden></div>';
  const $ = id => document.getElementById(id);
  const topo = $('topo'), resto = $('barra-resto'), busca = $('busca'), sug = $('sugestoes'), palco = $('palco'), tela = $('tela'), mundo = $('mundo');
  const listaEl = $('lista'), painelEl = $('painel'), modalEl = $('modal'), avisoEl = $('aviso');
  const emLista = () => CELULAR.matches || estado.vista === 'lista';

  const camera = window.CAMERA(tela, mundo, {
    larguraPainel: () => (estado.painel && !CELULAR.matches && !painelEl.hidden ? painelEl.offsetWidth : 0),
    aoMudar: cam => { const el = $('zoom-pct'); if (el) el.textContent = Math.round(cam.z * 100) + '%'; }
  });
  // A dica de navegação some no primeiro gesto da pessoa.
  const someDica = () => $('dica-nav').classList.add('some');
  tela.addEventListener('pointerdown', someDica, { once: true });
  tela.addEventListener('wheel', someDica, { once: true, passive: true });

  /* ---------- Passo 5: desenhar ---------- */
  let visao = null, ultimo = null; // última visão e último layout (os testes leem os dois)
  // Deslocamento do mundo: o layout sempre começa em (0,0), mas a tela soma este deslocamento.
  // Ao redesenhar com âncora, ele é escolhido para a âncora cair no MESMO ponto de antes:
  // a câmera não se mexe e o cartão que a pessoa olhava fica parado (nada "pula").
  let origem = { x: 0, y: 0 }, relogioFios = 0;

  // op = { ancora: id que fica parado, transicao: 'xy' | 'yx' | 'junto' (sem = sem animação) }
  function desenhar(op) {
    op = op || {};
    I.lang = estado.lang;
    document.documentElement.lang = estado.lang === 'en' ? 'en' : 'pt-BR';
    document.documentElement.dataset.theme = estado.tema === 'escuro' ? 'dark' : 'light';
    document.title = T('titulo') + (org.empresa ? ' · ' + org.empresa : '');
    busca.placeholder = T('busca');
    busca.setAttribute('aria-label', T('busca'));
    visao = calcularVisao();
    desenharTopo();
    desenharBarra();
    const lista = emLista();
    tela.hidden = lista;
    listaEl.hidden = !lista;
    if (lista) { ultimo = null; desenharLista(); } else { desenharFlutuantes(); desenharDesenho(op); }
    desenharPainel();
    guardar();
  }

  // Dentro do Power BI (powerbi/gera_powerbi.py) o dado vem do relatório e o visual não deixa
  // baixar arquivo nem imprimir: esses botões somem lá.
  const POWERBI = !!window.MODO_POWERBI;
  function desenharTopo() {
    const pt = estado.lang === 'pt', fonte = org.ficticio ? 'ficticio' : POWERBI ? 'fonte_pbi' : 'proprio';
    topo.innerHTML = '<div class="marca"><span class="icone">' + V.ICONES.org + '</span><div><div class="eyebrow">' + esc(T(org.ficticio ? 'eyebrow' : 'eyebrow_real')) + '</div>' +
      '<h1>' + esc(T('titulo')) + '</h1><div class="empresa"><span>' + esc((org.empresa ? org.empresa + ' · ' : '') + T(fonte)) + '</span>' +
      '<span class="selo" title="' + esc(T(org.ficticio ? 'dica_data' : fonte)) + '"><i></i>' + esc(T('numeros_de')) + ' <b class="mono">' + esc(V.dataTxt(org.dataRef)) + '</b></span>' +
      contagem() + '</div></div></div><div class="acoes">' +
      (POWERBI ? '' : '<button class="botao leve" data-acao="dados">' + V.ICONES.subir + esc(T('meus_dados')) + '</button>' +
        '<button class="botao leve" data-acao="csv">' + V.ICONES.baixar + esc(T('baixar_csv')) + '</button>' +
        '<button class="botao leve" data-acao="imprimir">' + V.ICONES.imprimir + esc(T('imprimir')) + '</button>') +
      '<div class="seg" role="group" aria-label="' + esc(T('idioma')) + '"><button data-acao="lang" data-v="pt" class="' + (pt ? 'ativo' : '') + '" aria-pressed="' + pt + '">PT</button>' +
      '<button data-acao="lang" data-v="en" class="' + (pt ? '' : 'ativo') + '" aria-pressed="' + !pt + '">EN</button></div>' +
      '<button class="botao leve" data-acao="tema">' + (estado.tema === 'escuro' ? '☀ ' + esc(T('tema_claro')) : '☾ ' + esc(T('tema_escuro'))) + '</button></div>';
  }

  function desenharBarra() {
    const f = estado.filtros, v = visao;
    const usados = campo => new Set(org.nos.map(n => n[campo]));
    const opcoes = (nome, cad, valor) => {
      const tem = usados(nome);
      return '<label class="filtro"><select data-filtro="' + nome + '" aria-label="' + esc(T('f_' + nome)) + '"' + (valor ? ' class="ligado"' : '') + '>' +
        '<option value="">' + esc(T('todas_' + nome)) + '</option>' + Object.keys(cad).filter(k => tem.has(k)).map(k =>
          '<option value="' + esc(k) + '"' + (valor === k ? ' selected' : '') + '>' + esc(I.nome(cad[k])) + '</option>').join('') + '</select></label>';
    };
    const conta = regra => [...v.casa].filter(id => regra(org.porId.get(id))).length;
    const existe = regra => org.nos.some(regra);
    const chip = (k, rot, icone) => existe(v.regras[k]) ? '<button class="chip' + (estado.destaque === k ? ' ativo' : '') + '" data-acao="destaque" data-v="' + k +
      '" aria-pressed="' + (estado.destaque === k) + '">' + icone + esc(rot) + ' <b>' + conta(v.regras[k]) + '</b></button>' : '';
    resto.innerHTML = opcoes('unidade', org.unidades, f.unidade) + opcoes('area', org.areas, f.area) +
      '<button class="botao limpar" data-acao="limpar"' + (v.temFiltro ? '' : ' disabled') + '>✕ ' + esc(T('limpar')) + '</button><span class="sep"></span>' +
      '<div class="chips" role="group" aria-label="' + esc(T('destaques')) + '">' + chip('aniv', T('d_aniv', { mes: nomeMes() }), V.ICONES.bolo) +
      chip('novatos', T('d_novatos'), V.ICONES.novo) + chip('vagas', T('d_vagas'), V.ICONES.maleta) + '</div>';
  }
  // "27 de 261 pessoas + 3 vagas": quantas pessoas os filtros deixam na tela.
  function contagem() {
    const pessoas = org.nos.filter(n => n.tipo === 'pessoa').length;
    const casam = [...visao.casa].filter(id => org.porId.get(id).tipo === 'pessoa').length;
    const vagas = visao.casa.size - casam;
    return '<span class="conta" id="conta" data-n="' + casam + '" data-t="' + pessoas + '">' + esc(T('mostrando', { n: casam, t: pessoas })) +
      (vagas ? ' ' + esc(vagas === 1 ? T('mais_vaga') : T('mais_vagas', { n: vagas })) : '') + '</span>';
  }
  const nomeMes = () => org.dataRef.toLocaleDateString(I.locale(), { month: 'long' });

  function desenharFlutuantes() {
    const seg = (acao, atual, pares) => '<div class="seg" role="group">' + pares.map(([v, rot, dica]) =>
      '<button data-acao="' + acao + '" data-v="' + v + '" class="' + (atual === v ? 'ativo' : '') + '" aria-pressed="' + (atual === v) + '"' + (dica ? ' title="' + esc(T(dica)) + '"' : '') + '>' + esc(T(rot)) + '</button>').join('') + '</div>';
    $('f-topo').innerHTML = seg('modo', estado.modo, [['compacto', 'compacto', 'dica_compacto'], ['espalhado', 'espalhado', 'dica_espalhado']]) +
      seg('vista', estado.vista, [['desenho', 'desenho'], ['lista', 'lista']]) +
      '<button class="botao" data-acao="expandir-tudo">' + esc(T('expandir_tudo')) + '</button><button class="botao" data-acao="recolher-tudo">' + esc(T('recolher_tudo')) + '</button>';
    $('f-zoom').innerHTML = '<div class="zoom-grupo"><button data-acao="zoom-menos" aria-label="' + esc(T('zoom_menos')) + '">−</button>' +
      '<button class="zoom-pct" id="zoom-pct" data-acao="zoom-100" title="' + esc(T('zoom_100')) + '">' + Math.round(camera.cam.z * 100) + '%</button>' +
      '<button data-acao="zoom-mais" aria-label="' + esc(T('zoom_mais')) + '">+</button></div><button class="botao" data-acao="centralizar">' + esc(T('centralizar')) + '</button>';
    $('legenda').innerHTML = (estado.modo === 'compacto' ? '<span title="' + esc(T('dica_compacto')) + '"><i class="lg-trilho"></i>' + esc(T('leg_equipe')) + '</span>' : '') +
      '<span><i class="lg-vaga"></i>' + esc(T('leg_vaga')) + '</span><span><i class="c-novo">' + esc(T('novo').toUpperCase()) + '</i>' + esc(T('leg_novo')) + '</span>' +
      '<span><i class="c-aniv">' + V.ICONES.bolo + '</i>' + esc(T('leg_aniv')) + '</span>' +
      (visao.temFiltro ? '<span><i class="lg-contexto"></i>' + esc(T('leg_contexto')) + '</span>' : '');
    $('dica-nav').textContent = T('navegar');
  }

  // Classes de um cartão (ou linha da lista): quem é e em que situação está agora.
  function info(n) {
    const v = visao, temFilhos = v.filhos(n).length > 0, cls = [];
    if (temFilhos) cls.push('lider');
    if (n.tipo === 'vaga') cls.push('vaga');
    if (!n.gestor) cls.push('topo');
    if (v.temFiltro && !v.casa.has(n.id)) cls.push('contexto');
    if (v.regra) cls.push(v.realce.has(n.id) ? 'realce' : v.realceCadeia.has(n.id) ? 'via' : 'apagado');
    if (estado.foco === n.id) cls.push('foco'); else if (v.cadeia.has(n.id)) cls.push('caminho');
    return { classes: cls.join(' '), temFilhos, recolhido: recolhido.has(n.id), ramo: v.ramo.get(n.id) || v.filhos(n).length, novo: v.novo(n), aniv: v.aniv(n), org };
  }

  function desenharDesenho(op) {
    const v = visao;
    const partida = op.transicao && ultimo ? posicoesNaTela() : null;
    const ancoraAntes = op.ancora && ultimo && ultimo.pos.get(op.ancora);
    if (!v.raizes.length) { mundo.innerHTML = '<div class="vazio">' + esc(T('sem_dados')) + '</div>'; ultimo = { pos: new Map(), fios: [], w: 0, h: 0, x0: 0, y0: 0 }; return; }
    const bruto = L.calcular({ raizes: v.raizes, filhos: n => (recolhido.has(n.id) ? [] : v.filhos(n)), folha: n => !v.filhos(n).length, modo: estado.modo });
    const a = op.ancora && bruto.pos.get(op.ancora);
    if (ancoraAntes && a) origem = { x: ancoraAntes.x - a.x, y: ancoraAntes.y - a.y };
    const pos = new Map();
    bruto.pos.forEach((p, id) => pos.set(id, { x: p.x + origem.x, y: p.y + origem.y }));
    ultimo = { pos, fios: bruto.fios, w: bruto.w, h: bruto.h, x0: origem.x, y0: origem.y };
    // Fios acesos (caminho do selecionado ou de um destaque) vão por último: ficam por cima.
    let fios = '', acesos = '';
    ultimo.fios.forEach(f => {
      const caminho = v.cadeia.has(f.para) || (v.regra && v.realceCadeia.has(f.para));
      const apagado = v.regra && !v.realceCadeia.has(f.para);
      const p = '<path class="fio' + (caminho ? ' caminho' : apagado ? ' apagado' : '') + '" data-de="' + esc(f.de) + '" data-para="' + esc(f.para) + '" d="' + f.d + '"/>';
      if (caminho) acesos += p; else fios += p;
    });
    // Os fios usam as coordenadas do layout; o próprio SVG anda o deslocamento.
    let html = '<svg class="fios" style="left:' + origem.x + 'px;top:' + origem.y + 'px" width="' + Math.ceil(ultimo.w) + '" height="' + Math.ceil(ultimo.h) + '" aria-hidden="true">' + fios + acesos + '</svg>';
    ultimo.pos.forEach((p, id) => { const n = org.porId.get(id); html += V.cartao(n, Object.assign(info(n), { x: p.x, y: p.y })); });
    if (partida) mundo.classList.add('movendo'); // fios escondidos ANTES de aparecer na geometria nova
    mundo.innerHTML = html;
    ultimo.mexeu = partida ? animarTroca(partida, op.transicao) : false;
    if (partida && !ultimo.mexeu) mundo.classList.remove('movendo');
  }

  // Onde cada cartão está AGORA, em coordenadas do mundo, medido no próprio cartão.
  // Se uma transição estiver no meio, a próxima parte de onde o cartão está: sem salto.
  // (posição do estilo + deslocamento da animação em curso; a escala do "surgir" não conta).
  function posicoesNaTela() {
    const out = new Map();
    mundo.querySelectorAll('.cartao').forEach(el => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      out.set(el.dataset.id, { x: parseFloat(el.style.left) + m.m41, y: parseFloat(el.style.top) + m.m42 });
    });
    return out;
  }

  // A transição (técnica FLIP): o cartão já está no lugar novo, mas começa desenhado no
  // antigo e desliza. 'xy' = primeiro de lado, depois na vertical; 'yx' = o contrário;
  // 'junto' = os dois de uma vez (abrir e recolher ramo). Por que um eixo de cada vez: com
  // a mesma ordem de irmãos nos dois modos, quem divide a mesma faixa nunca troca de lado,
  // então nenhum cartão passa por cima de outro (o teste confere quadro a quadro).
  const DURACAO = { xy: 760, yx: 760, junto: 380 };
  function animarTroca(partida, tipo) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const curva = 'cubic-bezier(.3,.7,.25,1)', t = (x, y) => 'translate(' + x + 'px,' + y + 'px)';
    let mexeu = false;
    mundo.querySelectorAll('.cartao').forEach(el => {
      const de = partida.get(el.dataset.id), para = ultimo.pos.get(el.dataset.id);
      if (!de) { // cartão que acabou de aparecer (ramo aberto): surge depois que os outros abriram espaço
        el.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: DURACAO[tipo] * 0.6, fill: 'backwards', easing: 'ease-out' });
        return;
      }
      const dx = de.x - para.x, dy = de.y - para.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      mexeu = true;
      const meio = tipo === 'xy' ? [{ transform: t(0, dy), offset: 0.5, easing: curva }] : tipo === 'yx' ? [{ transform: t(dx, 0), offset: 0.5, easing: curva }] : [];
      el.animate([{ transform: t(dx, dy), easing: curva }].concat(meio, [{ transform: t(0, 0) }]), { duration: DURACAO[tipo], easing: 'linear' });
    });
    if (mexeu) { // os fios voltam (já na geometria nova) quando os cartões chegam
      clearTimeout(relogioFios);
      relogioFios = setTimeout(() => mundo.classList.remove('movendo'), DURACAO[tipo]);
    }
    return mexeu;
  }
  // O cartão mais perto do centro da área útil (o que a pessoa está olhando).
  function ancoraNaTela() {
    if (!ultimo || !ultimo.pos.size) return null;
    const c = camera.cam, u = camera.util(), cx = (u.w / 2 - c.x) / c.z, cy = (u.h / 2 - c.y) / c.z;
    let melhor = null, menor = Infinity;
    ultimo.pos.forEach((p, id) => {
      const d = Math.hypot(p.x + L.C.W / 2 - cx, p.y + L.C.H / 2 - cy);
      if (d < menor) { menor = d; melhor = id; }
    });
    return melhor;
  }

  function desenharLista() {
    const v = visao, linhas = [];
    const andar = (n, nivel) => {
      const i = Object.assign(info(n), { nivel });
      linhas.push(V.linha(n, i));
      if (i.temFilhos && !i.recolhido) v.filhos(n).forEach(c => andar(c, nivel + 1));
    };
    v.raizes.forEach(r => andar(r, 0));
    const vista = CELULAR.matches ? '' : '<div class="seg" role="group"><button data-acao="vista" data-v="desenho">' + esc(T('desenho')) + '</button><button data-acao="vista" data-v="lista" class="ativo" aria-pressed="true">' + esc(T('lista')) + '</button></div>';
    listaEl.innerHTML = '<div class="lista-acoes">' + vista + '<button class="botao" data-acao="expandir-tudo">' + esc(T('expandir_tudo')) + '</button><button class="botao" data-acao="recolher-tudo">' + esc(T('recolher_tudo')) + '</button></div>' +
      (linhas.length ? '<ul class="arvore" role="tree" aria-label="' + esc(T('titulo')) + '">' + linhas.join('') + '</ul>' : '<p class="pn-dica">' + esc(T('sem_dados')) + '</p>');
  }

  function desenharPainel() {
    if (estado.painel === 'pessoa' && !org.porId.get(estado.foco)) estado.painel = null;
    if (!estado.painel) { painelEl.hidden = true; palco.classList.remove('com-painel'); return; }
    if (estado.painel === 'pessoa') {
      const n = org.porId.get(estado.foco), cadeia = [];
      for (let x = n; x; x = x.gestor ? org.porId.get(x.gestor) : null) cadeia.unshift(x);
      const i = info(n);
      painelEl.innerHTML = V.painelPessoa(n, { org, gestor: n.gestor ? org.porId.get(n.gestor) : null, cadeia, diretos: visao.filhos(n),
        ramo: visao.ramo.get(n.id) || 0, novo: i.novo, aniv: i.aniv, temFilhos: i.temFilhos, recolhido: i.recolhido, emLista: emLista() });
    } else {
      const ref = org.dataRef, k = estado.destaque;
      const nos = [...visao.realce].map(id => org.porId.get(id));
      const ordem = { aniv: (a, b) => a.aniversario.d - b.aniversario.d, novatos: (a, b) => b.admissao - a.admissao, vagas: (a, b) => (a.abertura || ref) - (b.abertura || ref) }[k];
      nos.sort((a, b) => ordem(a, b) || (a.nome || '').localeCompare(b.nome || '', 'pt'));
      const titulo = { aniv: T('d_aniv', { mes: nomeMes() }), novatos: T('d_novatos'), vagas: T('d_vagas') }[k];
      const direita = { aniv: n => V.diaMes(n.aniversario), novatos: n => V.tempo(n.admissao, ref), vagas: n => n.abertura ? T('vaga_ha', { n: V.dias(n.abertura, ref) }) : '' }[k];
      painelEl.innerHTML = V.painelLista(titulo, nos, direita);
    }
    painelEl.hidden = false;
    palco.classList.add('com-painel');
  }

  /* ---------- Passo 6: navegar ---------- */
  function centralizar(animar) {
    if (emLista() || !ultimo || !ultimo.pos.size) return;
    camera.enquadrar({ x: ultimo.x0, y: ultimo.y0, w: ultimo.w, h: ultimo.h }, { zMax: 1, animar });
  }
  // Caixa que contém os cartões destes ids (no mundo, zoom 1).
  function caixaDe(ids) {
    const ps = ids.map(id => ultimo && ultimo.pos.get(id)).filter(Boolean);
    if (!ps.length) return null;
    const x0 = Math.min(...ps.map(p => p.x)), y0 = Math.min(...ps.map(p => p.y));
    return { x: x0, y: y0, w: Math.max(...ps.map(p => p.x)) + L.C.W - x0, h: Math.max(...ps.map(p => p.y)) + L.C.H - y0 };
  }
  function enquadrarIds(ids) { const cx = caixaDe(ids); if (cx) camera.enquadrar(cx, { zMax: 0.9, animar: true, folga: 64 }); }
  // Quem aparece no ramo de um líder (ele e todo mundo abaixo que está aberto).
  function idsDoRamo(id) {
    const ids = [];
    const andar = n => { ids.push(n.id); if (!recolhido.has(n.id)) visao.filhos(n).forEach(andar); };
    andar(org.porId.get(id));
    return ids;
  }
  // Abriu um ramo que não cabe na tela: afasta e anda até caber (nunca aproxima).
  function mostrarRamo(id) {
    const cx = caixaDe(idsDoRamo(id)), c = camera.cam, u = camera.util();
    if (!cx) return;
    const cabe = c.x + cx.x * c.z >= 0 && c.y + cx.y * c.z >= 0 && c.x + (cx.x + cx.w) * c.z <= u.w && c.y + (cx.y + cx.h) * c.z <= u.h;
    if (!cabe) camera.enquadrar(cx, { zMax: c.z, animar: true, folga: 40 });
  }
  // "Ver o ramo inteiro": abre o ramo (se estiver recolhido) e enquadra o líder com a equipe toda.
  function enquadrarRamo(id) {
    if (emLista()) return;
    recolhido.delete(id);
    desenhar({ ancora: id, transicao: 'junto' });
    const cx = caixaDe(idsDoRamo(id));
    if (cx) camera.enquadrar(cx, { zMax: 1, animar: true, folga: 32 });
  }
  // Leva até o cartão (desenho) ou até a linha (lista).
  function mostrar(id) {
    if (emLista()) { const el = listaEl.querySelector('[data-id="' + CSS.escape(id) + '"]'); if (el) el.scrollIntoView({ block: 'center' }); return; }
    const p = ultimo && ultimo.pos.get(id);
    if (p) camera.centrarEm(p.x + L.C.W / 2, p.y + L.C.H / 2, 0.85, true);
  }
  function abrirCadeia(id) {
    const n = org.porId.get(id);
    for (let x = n && n.gestor ? org.porId.get(n.gestor) : null; x; x = x.gestor ? org.porId.get(x.gestor) : null) recolhido.delete(x.id);
  }
  // Ir até alguém: se um filtro esconde a pessoa, o filtro sai (e a tela avisa).
  function irPara(id) {
    const n = org.porId.get(id);
    if (!n) return;
    if (!visao.mostra.has(id)) { estado.filtros = { unidade: '', area: '' }; aviso(T('t_filtros_limpos', { nome: n.nome || T('vaga') })); }
    abrirCadeia(id);
    estado.foco = id;
    estado.painel = 'pessoa';
    desenhar();
    mostrar(id);
  }
  // Clique no cartão: seleciona sem mexer na câmera, a não ser que o painel vá cobrir o cartão.
  function selecionar(id) {
    estado.foco = id;
    estado.painel = 'pessoa';
    desenhar();
    if (emLista()) return;
    const p = ultimo.pos.get(id), c = camera.cam, u = camera.util();
    const x = c.x + p.x * c.z, y = c.y + p.y * c.z;
    if (x < 0 || y < 0 || x + L.C.W * c.z > u.w || y + L.C.H * c.z > u.h) mostrar(id);
  }
  function alternarRamo(id) {
    const abrindo = recolhido.has(id);
    if (abrindo) recolhido.delete(id); else recolhido.add(id);
    desenhar({ ancora: id, transicao: 'junto' });
    if (abrindo && !emLista()) mostrarRamo(id);
  }
  // Compacto <-> espalhado: o cartão do centro da tela fica parado e os outros deslizam.
  // Indo para o espalhado, primeiro de lado e depois na vertical; voltando, o contrário.
  function trocarModo(modo) {
    if (estado.modo === modo) return;
    const antes = ultimo && new Map(ultimo.pos);
    estado.modo = modo;
    desenhar({ ancora: ancoraNaTela(), transicao: modo === 'espalhado' ? 'xy' : 'yx' });
    // Com as equipes recolhidas os dois modos desenham igual: avisar em vez de parecer quebrado.
    if (antes && ultimo && ![...ultimo.pos].some(([id, p]) => { const q = antes.get(id); return !q || Math.abs(q.x - p.x) > 0.5 || Math.abs(q.y - p.y) > 0.5; })) aviso(T('t_modo_igual'));
  }

  /* ---------- Passo 7: busca por nome ou cargo ---------- */
  let sugAtiva = -1;
  function sugerir() {
    const termo = semAcento(busca.value.trim());
    sugAtiva = -1;
    if (termo.length < 2) { sug.hidden = true; busca.setAttribute('aria-expanded', 'false'); return; }
    const achados = [];
    org.nos.forEach(n => {
      const nome = semAcento(n.nome), cargo = semAcento(I.nome(n.cargo));
      const pos = nome.indexOf(termo);
      const nota = pos === 0 || nome.includes(' ' + termo) ? 0 : pos > 0 ? 1 : cargo.includes(termo) ? 2 : -1;
      if (nota >= 0) achados.push({ n, nota });
    });
    achados.sort((a, b) => a.nota - b.nota || (a.n.nome || '').localeCompare(b.n.nome || '', 'pt'));
    const marca = (txt) => {
      const i = semAcentoMesmoTamanho(txt).indexOf(termo);
      return i < 0 ? esc(txt) : esc(txt.slice(0, i)) + '<mark>' + esc(txt.slice(i, i + termo.length)) + '</mark>' + esc(txt.slice(i + termo.length));
    };
    sug.innerHTML = achados.length ? achados.slice(0, 8).map(({ n }) => '<li role="option"><button data-acao="ir" data-id="' + esc(n.id) + '">' +
      '<span class="av">' + (n.tipo === 'vaga' ? V.ICONES.maleta : esc(V.iniciais(n.nome))) + '</span><span><b>' + marca(n.nome || T('vaga')) + '</b><small>' +
      marca(I.nome(n.cargo)) + ' · ' + esc(I.nome(org.areas[n.area])) + '</small></span></button></li>').join('')
      : '<li class="nada">' + esc(T('sem_resultado')) + '</li>';
    sug.hidden = false;
    busca.setAttribute('aria-expanded', 'true');
  }
  busca.addEventListener('input', sugerir);
  busca.addEventListener('focus', () => { if (busca.value.trim().length >= 2) sugerir(); });
  busca.addEventListener('keydown', e => {
    const itens = [...sug.querySelectorAll('button[data-id]')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!itens.length) return;
      e.preventDefault();
      sugAtiva = (sugAtiva + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
      itens.forEach((b, i) => b.classList.toggle('ativa', i === sugAtiva));
    } else if (e.key === 'Enter') {
      const b = itens[Math.max(0, sugAtiva)];
      if (b) { e.preventDefault(); escolherSugestao(b.dataset.id); }
    } else if (e.key === 'Escape') { sug.hidden = true; busca.blur(); }
  });
  function escolherSugestao(id) {
    const n = org.porId.get(id);
    busca.value = n ? (n.nome || I.nome(n.cargo)) : '';
    sug.hidden = true;
    busca.setAttribute('aria-expanded', 'false');
    irPara(id);
  }

  /* ---------- Passo 8: exportar, imprimir e dado próprio ---------- */
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // Ordem do arquivo = ordem da árvore (de cima para baixo), só quem casa com os filtros.
  function nosEmOrdem(todos) {
    const out = [];
    const andar = n => { if (todos || visao.casa.has(n.id)) out.push(n); (org.filhos.get(n.id) || []).forEach(andar); };
    org.raizes.forEach(andar);
    return out;
  }
  const textoCsv = todos => E.paraCsv(org, nosEmOrdem(todos), I.nome, I.lang);
  function baixar(nome, texto) {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function exportarCsv() {
    const t = textoCsv(false);
    baixar(T('arq_csv') + '-' + iso(org.dataRef) + '.csv', t);
    aviso(T('t_csv', { n: t.trim().split('\r\n').length - 1 }));
    return t;
  }
  function imprimir() {
    const f = estado.filtros, filtros = [f.unidade && I.nome(org.unidades[f.unidade]), f.area && I.nome(org.areas[f.area])].filter(Boolean);
    $('imp-cab').textContent = (org.empresa ? org.empresa + ' · ' : '') + T('numeros_de') + ' ' + V.dataTxt(org.dataRef) +
      (filtros.length ? ' · ' + T('filtros_ativos') + ': ' + filtros.join(', ') : '') + ' · ' + T('impresso_em', { d: V.dataTxt(new Date()) });
    window.print();
  }
  function desenharModal() {
    modalEl.innerHTML = estado.modal ? V.modalDados(estado.modal) : '';
    const arq = $('md-arquivo');
    if (arq) arq.addEventListener('change', () => {
      const f = arq.files && arq.files[0];
      if (!f) return;
      const leitor = new FileReader();
      leitor.onload = () => { $('md-texto').value = String(leitor.result || ''); carregar(); };
      leitor.readAsText(f, 'utf-8');
    });
  }
  function trocarOrg(novo) {
    org = novo;
    estado.filtros = { unidade: '', area: '' };
    estado.destaque = ''; estado.foco = null; estado.painel = null;
    recolhido = recolhimentoInicial();
    busca.value = '';
    desenhar();
    centralizar(false);
  }
  function carregar() {
    const texto = $('md-texto').value;
    estado.modal = { texto, ficticio: org.ficticio };
    if (!texto.trim()) { estado.modal.erro = T('imp_vazio'); desenharModal(); return; }
    try {
      const novo = E.deLinhas(E.lerTexto(texto));
      if (!novo.nos.length) throw new Error(T('sem_dados'));
      trocarOrg(novo);
      estado.modal = { texto, ok: T('imp_ok', { n: novo.nos.length }), avisos: novo.avisos, ficticio: false };
    } catch (erro) { estado.modal.erro = T('imp_erro', { e: erro.message }); }
    desenharModal();
  }
  let avisoT = 0;
  function aviso(txt) {
    avisoEl.textContent = txt;
    avisoEl.hidden = false;
    clearTimeout(avisoT);
    avisoT = setTimeout(() => { avisoEl.hidden = true; }, 2800);
  }

  /* ---------- Passo 9: cliques (um ouvinte só, pelo data-acao) ---------- */
  const ACOES = {
    lang: b => { estado.lang = b.dataset.v; desenhar(); },
    tema: () => { estado.tema = estado.tema === 'escuro' ? 'claro' : 'escuro'; desenhar(); },
    modo: b => trocarModo(b.dataset.v),
    vista: b => { estado.vista = b.dataset.v; desenhar(); if (!emLista()) { if (estado.foco) mostrar(estado.foco); else centralizar(false); } },
    limpar: () => { estado.filtros = { unidade: '', area: '' }; recolhido = recolhimentoInicial(); desenhar(); centralizar(true); },
    destaque: b => {
      estado.destaque = estado.destaque === b.dataset.v ? '' : b.dataset.v;
      if (estado.destaque) {
        visao = calcularVisao();
        visao.realce.forEach(abrirCadeia);
        estado.painel = 'lista'; estado.foco = null;
      } else if (estado.painel === 'lista') estado.painel = null;
      desenhar();
      if (estado.destaque) enquadrarIds([...visao.realce]);
    },
    'expandir-tudo': () => { const a = ancoraNaTela(); recolhido.clear(); desenhar({ ancora: a, transicao: 'junto' }); },
    'recolher-tudo': () => {
      recolhido = new Set(org.nos.filter(n => n.gestor && (org.filhos.get(n.id) || []).length).map(n => n.id));
      if (estado.foco && org.porId.get(estado.foco).gestor) { estado.foco = null; if (estado.painel === 'pessoa') estado.painel = null; }
      desenhar();
      centralizar(true);
    },
    centralizar: () => centralizar(true),
    'zoom-mais': () => camera.zoomNoCentro(1.25),
    'zoom-menos': () => camera.zoomNoCentro(0.8),
    'zoom-100': () => camera.zoomCem(),
    ramo: b => alternarRamo(b.dataset.id),
    ir: b => (b.closest('#sugestoes') ? escolherSugestao(b.dataset.id) : irPara(b.dataset.id)),
    // No celular o painel cobre a lista: fecha o painel e rola até a linha (que fica marcada).
    mostrar: b => { if (CELULAR.matches) { estado.painel = null; desenhar(); } mostrar(b.dataset.id); },
    'ver-ramo': b => enquadrarRamo(b.dataset.id),
    'fechar-painel': () => { estado.painel = null; estado.foco = null; desenhar(); },
    csv: () => exportarCsv(),
    imprimir: () => imprimir(),
    dados: () => { estado.modal = { texto: '', ficticio: org.ficticio }; desenharModal(); const t = $('md-texto'); if (t) t.focus(); },
    carregar: () => carregar(),
    modelo: () => baixar(T('arq_modelo') + '.csv', textoCsv(true)),
    'voltar-ficticia': () => { trocarOrg(E.daFicticia(window.DADOS)); estado.modal = null; desenharModal(); },
    'fechar-modal': () => { estado.modal = null; desenharModal(); },
    'fechar-modal-fundo': (b, e) => { if (e.target === b) { estado.modal = null; desenharModal(); } }
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-acao]');
    if (b && ACOES[b.dataset.acao]) { ACOES[b.dataset.acao](b, e); return; }
    const c = e.target.closest('.cartao, .li');
    if (c && c.dataset.id) { selecionar(c.dataset.id); return; }
    if (!e.target.closest('.busca-caixa')) { sug.hidden = true; busca.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-filtro]');
    if (!s) return;
    estado.filtros[s.dataset.filtro] = s.value;
    // Com filtro, a árvore encolhe: abre tudo para mostrar quem casa. Sem filtro, volta ao começo.
    recolhido = estado.filtros.unidade || estado.filtros.area ? new Set() : recolhimentoInicial();
    if (estado.painel === 'lista') visao = calcularVisao();
    desenhar();
    centralizar(true);
  });
  // Teclado: "/" busca, Esc fecha o que estiver aberto, + - 0 no zoom, Enter abre o cartão em foco.
  document.addEventListener('keydown', e => {
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === 'Escape') {
      if (estado.modal) { estado.modal = null; desenharModal(); return; }
      if (!sug.hidden) { sug.hidden = true; return; }
      if (estado.painel || estado.destaque) { estado.painel = null; estado.foco = null; estado.destaque = ''; desenhar(); }
      return;
    }
    if (digitando || e.ctrlKey || e.metaKey || e.altKey) return;
    // Enter num botão (pílula, seta da lista) é do botão; no resto do cartão, abre o detalhe.
    const c = e.target.closest && !e.target.closest('button') && e.target.closest('.cartao, .li');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selecionar(c.dataset.id); return; }
    if (e.key === '/') { e.preventDefault(); busca.focus(); return; }
    if (emLista()) return;
    // Setas andam pelo desenho (com Shift, quatro vezes mais).
    const passo = e.shiftKey ? 320 : 80, setas = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] };
    if (setas[e.key]) { e.preventDefault(); camera.andar(setas[e.key][0], setas[e.key][1]); return; }
    if (e.key === '+' || e.key === '=') camera.zoomNoCentro(1.25);
    else if (e.key === '-') camera.zoomNoCentro(0.8);
    else if (e.key === '0') centralizar(true);
  });
  // Duplo clique: num líder, mostra o ramo inteiro; em outro cartão, centraliza; no fundo, aproxima ali.
  tela.addEventListener('dblclick', e => {
    if (e.target.closest('.flutua, .legenda, .pilula')) return;
    const c = e.target.closest('.cartao');
    if (c) { if (visao.filhos(org.porId.get(c.dataset.id)).length) enquadrarRamo(c.dataset.id); else mostrar(c.dataset.id); return; }
    const r = tela.getBoundingClientRect();
    camera.zoomEm(camera.cam.z * 1.6, e.clientX - r.left, e.clientY - r.top, true);
  });
  // Cruzou a largura de celular (girou o aparelho, redimensionou): desenho <-> lista.
  CELULAR.addEventListener('change', () => { desenhar(); centralizar(false); });

  /* ---------- Passo 10: começar ---------- */
  desenhar();
  centralizar(false);
  if (q.get('sel') && org.porId.get(q.get('sel'))) irPara(q.get('sel'));

  // Para os testes automáticos lerem o que a tela mostrou (e mexerem como uma pessoa mexeria).
  window.__org = {
    estado, camera: camera.cam,
    org: () => org, visao: () => visao, layout: () => ultimo, recolhidos: () => [...recolhido],
    irPara, centralizar, textoCsv, exportarCsv, enquadrarRamo, ancoraNaTela,
    expandirTudo: () => ACOES['expandir-tudo'](),
    carregarTexto: t => { trocarOrg(E.deLinhas(E.lerTexto(t))); return org.nos.length; },
    voltarFicticia: () => trocarOrg(E.daFicticia(window.DADOS))
  };
})();
