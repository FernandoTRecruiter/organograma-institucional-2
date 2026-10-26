/* =============================================================================
   visual.js: os moldes de HTML (cartão, linha da lista, painel, janela de
   dados) e os formatadores. Funções puras: recebem o nó e o que a tela já
   calculou e devolvem texto. Quem decide O QUE mostrar é o app.js.
   ============================================================================= */
window.VISUAL = (function () {
  'use strict';
  const I = window.I18N, T = I.T;
  const DIA = 864e5;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Ícones desenhados aqui mesmo (traço simples, herdam a cor do texto).
  const svg = (d, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  const ICONES = {
    org: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="14" y="7" width="12" height="8" rx="2.5" fill="currentColor"/><path d="M20 15v5M9.5 20h21M9.5 20v5M20 20v5M30.5 20v5" stroke="currentColor" stroke-width="1.6" fill="none" opacity=".7"/><rect x="5" y="25" width="9" height="8" rx="2.5" fill="currentColor" opacity=".85"/><rect x="15.5" y="25" width="9" height="8" rx="2.5" fill="currentColor" opacity=".85"/><rect x="26" y="25" width="9" height="8" rx="2.5" fill="currentColor" opacity=".85"/></svg>',
    busca: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    bolo: svg('<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0"/><path d="M12 12V8"/><path d="M12 5.5c.8-.6.8-1.6 0-2.5-.8.9-.8 1.9 0 2.5z"/>'),
    novo: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    maleta: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
    baixar: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    imprimir: svg('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
    subir: svg('<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>'),
    mais: svg('<path d="M12 6v12M6 12h12"/>', ' class="ic-p"'),
    menos: svg('<path d="M6 12h12"/>', ' class="ic-p"'),
    direita: svg('<path d="M9 6l6 6-6 6"/>', ' class="ic-p"'),
    baixo: svg('<path d="M6 9l6 6 6-6"/>', ' class="ic-p"')
  };

  /* ---------- formatadores (sempre no idioma da tela) ---------- */
  function iniciais(nome) {
    const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  const dataTxt = d => d ? d.toLocaleDateString(I.locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  // Aniversário sem ano: 12/09 em português, 09/12 em inglês.
  const diaMes = a => a ? new Date(2000, a.m - 1, a.d).toLocaleDateString(I.locale(), { day: '2-digit', month: '2-digit' }) : '';
  const dias = (de, ate) => Math.max(0, Math.round((ate - de) / DIA));
  // Tempo de casa contado em meses cheios: "3a 2m", "8 meses", "45 dias".
  function tempo(adm, ref) {
    if (!adm) return '';
    let meses = (ref.getFullYear() - adm.getFullYear()) * 12 + (ref.getMonth() - adm.getMonth());
    if (ref.getDate() < adm.getDate()) meses -= 1;
    if (meses < 1) return T('t_dias', { d: dias(adm, ref) });
    const a = Math.floor(meses / 12), m = meses % 12;
    if (!a) return m === 1 ? T('t_mes') : T('t_meses', { m });
    if (!m) return a === 1 ? T('t_ano') : T('t_anos', { a });
    return T('t_anos_meses', { a, m });
  }
  const nomeDe = n => n.tipo === 'vaga' ? T('vaga') : n.nome;
  const avatar = n => '<span class="av">' + (n.tipo === 'vaga' ? ICONES.maleta : esc(iniciais(n.nome))) + '</span>';
  const etapa = e => ['triagem', 'entrevistas', 'oferta'].includes(e) ? T('etapa_' + e) : (e || '-');

  /* ---------- cartão do desenho ---------- */
  // v = { x, y, classes, temFilhos, recolhido, ramo, novo, aniv, org }
  function cartao(n, v) {
    const org = v.org, vaga = n.tipo === 'vaga';
    const area = I.nome(org.areas[n.area]);
    let dir = '';
    if (v.novo) dir += '<i class="c-novo">' + esc(T('novo').toUpperCase()) + '</i>';
    if (v.aniv) dir += '<i class="c-aniv" title="' + esc(T('aniv_chip', { d: diaMes(n.aniversario) })) + '">' + ICONES.bolo + '</i>';
    dir += '<span class="c-tempo">' + esc(vaga ? (n.abertura ? T('vaga_ha', { n: dias(n.abertura, org.dataRef) }) : '') : tempo(n.admissao, org.dataRef)) + '</span>';
    const pilula = v.temFilhos
      ? '<button class="pilula' + (v.recolhido ? ' fechada' : '') + '" data-acao="ramo" data-id="' + esc(n.id) + '" aria-expanded="' + !v.recolhido + '" title="' +
        esc(T(v.recolhido ? 'abrir_ramo' : 'fechar_ramo') + ' · ' + T('no_ramo', { n: v.ramo })) + '">' + (v.recolhido ? ICONES.mais : ICONES.menos) + v.ramo + '</button>'
      : '';
    return '<div class="cartao ' + v.classes + '" data-id="' + esc(n.id) + '" data-tipo="' + n.tipo + '"' + (n.gestor ? ' data-gestor="' + esc(n.gestor) + '"' : '') +
      ' style="left:' + v.x + 'px;top:' + v.y + 'px" tabindex="0" role="button" aria-label="' + esc(nomeDe(n) + ', ' + I.nome(n.cargo)) + '">' +
      avatar(n) + '<span class="c-txt"><b class="c-nome">' + esc(nomeDe(n)) + '</b><span class="c-cargo">' + esc(I.nome(n.cargo)) + '</span>' +
      '<span class="c-pe"><span class="c-area">' + esc(area) + '</span><span class="c-dir">' + dir + '</span></span></span>' + pilula + '</div>';
  }

  /* ---------- linha da lista em árvore (celular) ---------- */
  function linha(n, v) {
    const area = I.nome(v.org.areas[n.area]);
    let dir = '';
    if (v.novo) dir += '<i class="c-novo">' + esc(T('novo').toUpperCase()) + '</i>';
    if (v.aniv) dir += '<i class="c-aniv" title="' + esc(T('aniv_chip', { d: diaMes(n.aniversario) })) + '">' + ICONES.bolo + '</i>';
    if (v.temFilhos) dir += '<span title="' + esc(T('no_ramo', { n: v.ramo })) + '">' + v.ramo + '</span>';
    return '<li class="li ' + v.classes + '" data-id="' + esc(n.id) + '" data-tipo="' + n.tipo + '" role="treeitem" aria-level="' + (v.nivel + 1) + '"' +
      (v.temFilhos ? ' aria-expanded="' + !v.recolhido + '"' : '') + ' style="--nivel:' + v.nivel + '">' +
      (v.temFilhos ? '<button class="li-seta" data-acao="ramo" data-id="' + esc(n.id) + '" aria-label="' + esc(T(v.recolhido ? 'abrir_ramo' : 'fechar_ramo')) + '">' + (v.recolhido ? ICONES.direita : ICONES.baixo) + '</button>' : '<span></span>') +
      avatar(n) + '<span class="li-txt"><b>' + esc(nomeDe(n)) + '</b><small>' + esc(I.nome(n.cargo) + (area ? ' · ' + area : '')) + '</small></span>' +
      '<span class="li-dir">' + dir + '</span></li>';
  }

  /* ---------- painel: detalhe da pessoa (ou da vaga) ---------- */
  // Botão de pessoa usado no painel inteiro: clicar leva até o cartão.
  function pessoaBtn(n, direita) {
    return '<button class="pessoa-btn" data-acao="ir" data-id="' + esc(n.id) + '">' + avatar(n) +
      '<span><b>' + esc(nomeDe(n)) + '</b><small>' + esc(I.nome(n.cargo)) + '</small></span><span class="mono">' + esc(direita || '') + '</span></button>';
  }
  // c = { org, gestor, cadeia, diretos, ramo, novo, aniv, temFilhos, recolhido }
  function painelPessoa(n, c) {
    const org = c.org, ref = org.dataRef, vaga = n.tipo === 'vaga';
    const campo = (rot, val) => val ? '<dt>' + esc(T(rot)) + '</dt><dd>' + val + '</dd>' : '';
    let chips = '';
    if (vaga) chips += '<span>' + esc(T('vaga')) + '</span>';
    if (c.novo) chips += '<span>' + esc(T('novo')) + ' · ' + esc(tempo(n.admissao, ref)) + '</span>';
    if (c.aniv) chips += '<span>' + esc(T('aniv_chip', { d: diaMes(n.aniversario) })) + '</span>';
    let campos = campo('p_area', esc(I.nome(org.areas[n.area]))) + campo('p_unidade', esc(I.nome(org.unidades[n.unidade])));
    if (vaga) {
      campos += campo('p_aberta', n.abertura ? esc(dataTxt(n.abertura)) : '') + campo('p_dias', n.abertura ? String(dias(n.abertura, ref)) : '') + campo('p_etapa', n.etapa ? esc(etapa(n.etapa)) : '');
    } else {
      campos += campo('p_nivel', n.nivel && org.niveis[n.nivel] ? esc(I.nome(org.niveis[n.nivel])) : '') +
        campo('p_tempo', n.admissao ? esc(tempo(n.admissao, ref)) + ' <small>' + esc(T('p_desde', { d: dataTxt(n.admissao) })) + '</small>' : '') +
        campo('p_aniv', n.aniversario ? esc(diaMes(n.aniversario)) : '') +
        campo('p_email', n.email ? esc(n.email) + (org.ficticio ? ' <small>(' + esc(T('p_email_fic')) + ')</small>' : '') : '');
    }
    campos += campo('p_codigo', n.codigo ? '<span class="mono">' + esc(n.codigo) + '</span>' : '') + campo('p_id', '<span class="mono">' + esc(n.id) + '</span>');
    if (c.temFilhos) campos += campo('p_diretos', String(c.diretos.length)) + campo('p_ramo', String(c.ramo));
    let h = '<div class="pn-cab">' + avatar(n) + '<div><h2>' + esc(nomeDe(n)) + '</h2><p>' + esc(I.nome(n.cargo)) + '</p></div>' +
      '<button class="pn-x" data-acao="fechar-painel" aria-label="' + esc(T('fechar')) + '">✕</button></div><div class="pn-corpo">' +
      (chips ? '<div class="pn-chips">' + chips + '</div>' : '') + '<dl class="campos">' + campos + '</dl>';
    h += '<h3 class="pn-sub">' + esc(T('p_gestor')) + '</h3>' + (c.gestor ? pessoaBtn(c.gestor) : '<p class="pn-dica">' + esc(T('p_topo')) + '</p>');
    if (c.cadeia.length > 1) {
      h += '<h3 class="pn-sub">' + esc(T('p_cadeia')) + '</h3><ol class="cadeia">' +
        c.cadeia.map((x, i) => '<li' + (i === c.cadeia.length - 1 ? ' class="eu"' : '') + '>' + pessoaBtn(x, x.codigo || '') + '</li>').join('') + '</ol>';
    }
    if (c.diretos.length) {
      h += '<h3 class="pn-sub">' + esc(T('p_diretos')) + ' (' + c.diretos.length + ')</h3><ul class="pn-lista">' +
        c.diretos.map(x => '<li>' + pessoaBtn(x) + '</li>').join('') + '</ul>';
    }
    h += '<div class="pn-acoes"><button class="botao" data-acao="mostrar" data-id="' + esc(n.id) + '">' + esc(T(c.emLista ? 'p_ver_lista' : 'p_ver')) + '</button>' +
      (c.temFilhos && !c.emLista ? '<button class="botao" data-acao="ver-ramo" data-id="' + esc(n.id) + '">' + esc(T('p_ver_ramo')) + '</button>' : '') +
      (c.temFilhos ? '<button class="botao" data-acao="ramo" data-id="' + esc(n.id) + '">' + esc(T(c.recolhido ? 'abrir_ramo' : 'fechar_ramo')) + '</button>' : '') + '</div></div>';
    return h;
  }

  /* ---------- painel: lista de um destaque (aniversariantes, novatos, vagas) ---------- */
  function painelLista(titulo, nos, direita) {
    return '<div class="pn-cab so-texto"><div><h2>' + esc(titulo) + '</h2><p>' + nos.length + '</p></div>' +
      '<button class="pn-x" data-acao="fechar-painel" aria-label="' + esc(T('fechar')) + '">✕</button></div><div class="pn-corpo">' +
      (nos.length ? '<p class="pn-dica">' + esc(T('l_dica')) + '</p><ul class="pn-lista">' + nos.map(n => '<li>' + pessoaBtn(n, direita(n)) + '</li>').join('') + '</ul>'
        : '<p class="pn-dica">' + esc(T('l_vazio')) + '</p>') + '</div>';
  }

  /* ---------- janela "usar meus dados" ---------- */
  // r = { texto, ok, erro, avisos, ficticio }
  function modalDados(r) {
    const av = (r.avisos || []).slice(0, 8).map(a => '<li>' + esc(T('av_' + a.tipo, a)) + '</li>').join('') +
      ((r.avisos || []).length > 8 ? '<li>+ ' + (r.avisos.length - 8) + '</li>' : '');
    return '<div class="modal-fundo" data-acao="fechar-modal-fundo"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="md-titulo">' +
      '<h2 id="md-titulo">' + esc(T('imp_titulo')) + '</h2><p>' + esc(T('imp_texto')) + '</p><p>' + esc(T('imp_colunas')) + '</p>' +
      '<textarea id="md-texto" spellcheck="false" placeholder="' + esc(T('imp_exemplo')) + '">' + esc(r.texto || '') + '</textarea>' +
      '<div class="modal-acoes"><label class="botao arquivo">' + ICONES.subir + esc(T('imp_arquivo')) + '<input type="file" id="md-arquivo" accept=".csv,.json,.txt,text/csv,application/json"></label>' +
      '<button class="botao leve" data-acao="modelo">' + ICONES.baixar + esc(T('imp_modelo')) + '</button>' +
      '<span class="direita">' + (r.ficticio ? '' : '<button class="botao leve" data-acao="voltar-ficticia">' + esc(T('imp_voltar')) + '</button>') +
      '<button class="botao leve" data-acao="fechar-modal">' + esc(T('fechar')) + '</button><button class="botao forte" data-acao="carregar">' + esc(T('imp_carregar')) + '</button></span></div>' +
      (r.ok ? '<div class="retorno ok">' + esc(r.ok) + (av ? '<br><b>' + esc(T('avisos')) + '</b><ul>' + av + '</ul>' : '') + '</div>' : '') +
      (r.erro ? '<div class="retorno erro">' + esc(r.erro) + '</div>' : '') + '</div></div>';
  }

  return { esc, ICONES, iniciais, dataTxt, diaMes, dias, tempo, cartao, linha, painelPessoa, painelLista, modalDados, pessoaBtn };
})();
