/* =============================================================================
   camera.js: arrastar, zoom e enquadrar. Não sabe nada de organograma: só
   conhece a TELA (a janela que recorta) e o MUNDO (o desenho inteiro, que anda
   e escala dentro dela com um transform). Separado para dar para trocar o
   desenho sem mexer na navegação.
   ============================================================================= */
window.CAMERA = function (tela, mundo, opcoes) {
  'use strict';
  const ZMIN = 0.05, ZMAX = 2.4;
  const cam = { x: 0, y: 0, z: 1, arrastou: false };
  // Área útil = tela menos o painel lateral (quem chama diz quanto o painel come).
  const util = () => {
    const tira = opcoes.larguraPainel ? opcoes.larguraPainel() : 0;
    return { w: Math.max(80, tela.clientWidth - tira), h: tela.clientHeight };
  };

  // Passo 1: aplicar. Os pontinhos do fundo andam junto, para o arrastar parecer físico.
  function aplicar(animar) {
    mundo.classList.toggle('animando', !!animar);
    mundo.style.transform = 'translate(' + cam.x + 'px,' + cam.y + 'px) scale(' + cam.z + ')';
    const passo = Math.max(6, 24 * cam.z);
    tela.style.backgroundSize = passo + 'px ' + passo + 'px';
    tela.style.backgroundPosition = cam.x + 'px ' + cam.y + 'px';
    if (opcoes.aoMudar) opcoes.aoMudar(cam);
  }

  // Zoom com um ponto da tela parado (o cursor): o que está sob o mouse continua sob o mouse.
  function zoomEm(z, cx, cy, animar) {
    z = Math.min(ZMAX, Math.max(ZMIN, z));
    const wx = (cx - cam.x) / cam.z, wy = (cy - cam.y) / cam.z;
    cam.z = z; cam.x = cx - wx * z; cam.y = cy - wy * z;
    aplicar(animar);
  }
  function zoomNoCentro(fator) { const u = util(); zoomEm(cam.z * fator, u.w / 2, u.h / 2, true); }

  // Enquadra uma caixa do mundo {x, y, w, h}. Se couber folgado, centraliza;
  // se for mais alta que a tela, encosta no topo (o topo do organograma é o que importa).
  // Em cima ficam os botões flutuantes e embaixo a legenda e o zoom: a caixa fica entre eles.
  const TOPO_LIVRE = 52, BASE_LIVRE = 56;
  function enquadrar(cx, op) {
    op = op || {};
    const u = util(), folga = op.folga == null ? 48 : op.folga, alt = u.h - TOPO_LIVRE - BASE_LIVRE;
    const z = Math.min(op.zMax || 1, Math.max(ZMIN, Math.min((u.w - folga * 2) / Math.max(cx.w, 1), (alt - folga * 2) / Math.max(cx.h, 1))));
    cam.z = z;
    cam.x = (u.w - cx.w * z) / 2 - cx.x * z;
    cam.y = TOPO_LIVRE + Math.max(folga, (alt - cx.h * z) / 2) - cx.y * z;
    aplicar(op.animar);
  }
  // Põe um ponto do mundo no centro da área útil, com um zoom mínimo para ler.
  function centrarEm(px, py, zMin, animar) {
    const u = util();
    cam.z = Math.min(ZMAX, Math.max(cam.z, zMin || 0));
    cam.x = u.w / 2 - px * cam.z; cam.y = u.h / 2 - py * cam.z;
    aplicar(animar);
  }
  // Passo 2: arrastar com qualquer ponteiro (mouse, caneta, dedo) e pinça com dois dedos.
  const ponteiros = new Map();
  let inicio = null, pinca = null;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  tela.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.flutua, .legenda, .pilula')) return; // controle não arrasta
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cam.arrastou = false;
    if (ponteiros.size === 1) inicio = { px: e.clientX, py: e.clientY, x: cam.x, y: cam.y };
    if (ponteiros.size === 2) { const [a, b] = [...ponteiros.values()]; pinca = { d: dist(a, b) || 1, z: cam.z }; }
  });
  tela.addEventListener('pointermove', e => {
    if (!ponteiros.has(e.pointerId)) return;
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.size === 2 && pinca) {
      const [a, b] = [...ponteiros.values()], r = tela.getBoundingClientRect();
      cam.arrastou = true;
      zoomEm(pinca.z * dist(a, b) / pinca.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    if (!inicio) return;
    const dx = e.clientX - inicio.px, dy = e.clientY - inicio.py;
    if (!cam.arrastou && Math.hypot(dx, dy) < 5) return; // tremidinha de clique não é arrasto
    if (!cam.arrastou) {
      cam.arrastou = true;
      tela.classList.add('arrastando');
      try { tela.setPointerCapture(e.pointerId); } catch (erro) { /* ponteiro já saiu: tudo bem */ }
    }
    cam.x = inicio.x + dx; cam.y = inicio.y + dy;
    aplicar(false);
  });
  function soltar(e) {
    ponteiros.delete(e.pointerId);
    if (ponteiros.size < 2) pinca = null;
    // Sobrou um dedo depois da pinça: o arrasto recomeça dele (senão o desenho pula).
    if (ponteiros.size === 1) { const p = [...ponteiros.values()][0]; inicio = { px: p.x, py: p.y, x: cam.x, y: cam.y }; }
    if (!ponteiros.size) { inicio = null; tela.classList.remove('arrastando'); }
  }
  tela.addEventListener('pointerup', soltar);
  tela.addEventListener('pointercancel', soltar);
  // Clique que termina um arrasto não abre cartão.
  tela.addEventListener('click', e => { if (cam.arrastou) { e.stopPropagation(); e.preventDefault(); cam.arrastou = false; } }, true);

  // Navegar com Tab até um cartão fora da tela faz o navegador ROLAR a tela (mesmo com
  // overflow escondido), e a conta da câmera deixaria de bater. A rolagem vira movimento da câmera.
  tela.addEventListener('scroll', () => {
    if (!tela.scrollLeft && !tela.scrollTop) return;
    cam.x -= tela.scrollLeft; cam.y -= tela.scrollTop;
    tela.scrollLeft = 0; tela.scrollTop = 0;
    aplicar(false);
  });

  // Passo 3: roda do mouse = zoom no cursor (e pinça do touchpad, que chega como roda com ctrl).
  // Rolagem com componente lateral (dois dedos no touchpad, ou Shift + roda) = andar, não zoom.
  tela.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.deltaX && !e.ctrlKey) { cam.x -= e.deltaX; cam.y -= e.deltaY; aplicar(false); return; }
    const r = tela.getBoundingClientRect();
    const fator = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0016));
    zoomEm(cam.z * fator, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // Andar (setas do teclado) e voltar para 100% (clique no número do zoom).
  function andar(dx, dy) { cam.x += dx; cam.y += dy; aplicar(true); }
  function zoomCem() { const u = util(); zoomEm(1, u.w / 2, u.h / 2, true); }

  return { cam, aplicar, zoomEm, zoomNoCentro, enquadrar, centrarEm, andar, zoomCem, util };
};
