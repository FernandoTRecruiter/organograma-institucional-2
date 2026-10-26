/* =============================================================================
   layout.js: onde cada cartão fica e por onde passa cada fio.

   Como pensa (três passadas, sem flexbox aninhado):
   1. medir(): de baixo para cima, cada ramo vira uma CAIXA (largura x altura)
      com a receita de como os filhos foram arrumados;
   2. posicionar(): de cima para baixo, a receita vira coordenada de verdade;
   3. fios(): com as coordenadas prontas, cada filho ganha o caminho até o pai.

   Dois modos:
   - ESPALHADO: o organograma clássico, todo filho lado a lado.
   - COMPACTO: quem não tem equipe fica PENDURADO em colunas, ligado a um
     trilho na lateral (lê-se como uma lista da equipe, não como mais um nível);
     e um líder com muitos sublíderes quebra os ramos em linhas, também com o
     trilho à esquerda. O trilho mora num corredor reservado, então nenhum fio
     atravessa cartão.
   ============================================================================= */
window.LAYOUT = (function () {
  'use strict';
  // Medidas em pixels do "mundo" (zoom 1). O cartão tem tamanho FIXO: o desenho
  // não depende do tamanho do texto (texto longo corta com reticências).
  const C = {
    W: 248, H: 92,
    GX: 28,           // entre ramos irmãos
    GY: 56,           // do pé do cartão até a linha dos filhos
    TRILHO: 16,       // distância do trilho até a borda esquerda da coluna
    RECUO: 40,        // onde começa o cartão pendurado (o trilho fica no recuo)
    LINHA: 12,        // entre cartões pendurados
    COLUNA: 24,       // entre colunas penduradas
    PENDURA: 24,      // do pé do líder até o começo das colunas
    TOPO: 12,         // folga entre a barra que une as colunas e o primeiro cartão
    LINHAS_MAX: 10,   // cartões por coluna antes de abrir outra coluna
    QUEBRA: 6,        // ramos por linha antes de quebrar em mais linhas (compacto)
    MISTO_MIN: 3,     // líder com equipe E sublíderes: a equipe vira coluna a partir de 3
    RAIO: 7           // curva das quinas dos fios
  };

  /* opcoes = {
       raizes: [nó],             quem não tem gestor (pode ser mais de um)
       filhos(nó): [nó],         filhos que aparecem (vazio se o ramo está recolhido)
       folha(nó): bool,          não tem ninguém abaixo (independe de estar recolhido)
       modo: 'compacto' | 'espalhado'
     }
     devolve { pos: Map(id -> {x, y}), fios: [{de, para, d}], w, h } */
  function calcular(op) {
    const caixas = new Map();
    const compacto = op.modo === 'compacto';

    /* ---------- passada 1: medir ---------- */

    // Folhas em colunas equilibradas: 26 pessoas com no máximo 10 por coluna = 9, 9, 8.
    function colunas(folhas) {
      const k = Math.ceil(folhas.length / C.LINHAS_MAX);
      const porColuna = Math.ceil(folhas.length / k);
      const cols = [];
      for (let i = 0; i < folhas.length; i += porColuna) cols.push(folhas.slice(i, i + porColuna));
      return cols;
    }
    // Bloco de folhas penduradas. O ponto de encaixe (ax) é o topo do primeiro trilho.
    function bloco(folhas) {
      const cols = colunas(folhas);
      const maior = Math.max(...cols.map(c => c.length));
      return {
        tipo: 'bloco', cols,
        w: cols.length * (C.RECUO + C.W) + (cols.length - 1) * C.COLUNA,
        h: C.TOPO + maior * C.H + (maior - 1) * C.LINHA,
        ax: C.TRILHO
      };
    }
    // Um filho que é ramo (ou cartão sozinho) entra na linha pelo meio do topo do cartão.
    function item(no) { const c = medir(no); return { tipo: 'no', no, w: c.w, h: c.h, ax: c.cx + C.W / 2 }; }

    function medir(no) {
      const filhos = op.filhos(no);
      let c;
      if (!filhos.length) c = { tipo: 'so', w: C.W, h: C.H, cx: 0 };
      else if (compacto && filhos.every(op.folha)) c = pendurado(filhos);
      else {
        // Sublíderes primeiro, equipe depois, NOS DOIS MODOS: com a mesma ordem da esquerda
        // para a direita, a transição entre os modos não faz um cartão cruzar o outro.
        const folhas = filhos.filter(op.folha), ramos = filhos.filter(f => !op.folha(f));
        const itens = ramos.map(item).concat(compacto && folhas.length >= C.MISTO_MIN ? [bloco(folhas)] : folhas.map(item));
        c = compacto && itens.length > C.QUEBRA ? emLinhas(itens) : emLinha(itens);
      }
      caixas.set(no.id, c);
      return c;
    }
    // Equipe sem sublíderes: pendurada logo abaixo do líder, que fica à esquerda.
    function pendurado(folhas) {
      const b = bloco(folhas);
      b.dx = 0; b.dy = C.H + C.PENDURA;
      return { tipo: 'pendurado', bloco: b, w: Math.max(C.W, b.w), h: C.H + C.PENDURA + b.h, cx: 0 };
    }
    // Clássico: filhos lado a lado e o pai centrado entre o primeiro e o último encaixe.
    function emLinha(itens) {
      let x = 0;
      itens.forEach(it => { it.dx = x; it.dy = C.H + C.GY; x += it.w + C.GX; });
      const largura = x - C.GX;
      const centro = (itens[0].dx + itens[0].ax + itens[itens.length - 1].dx + itens[itens.length - 1].ax) / 2;
      let cx = centro - C.W / 2;
      const esq = Math.min(0, cx), dir = Math.max(largura, cx + C.W);
      itens.forEach(it => { it.dx -= esq; });
      cx -= esq;
      return { tipo: 'linha', itens, w: dir - esq, h: C.H + C.GY + Math.max(...itens.map(it => it.h)), cx };
    }
    // Muitos ramos: quebra em linhas equilibradas; o trilho desce pela esquerda
    // e cada linha ganha sua própria barra (o pai fica no canto, em cima do trilho).
    function emLinhas(itens) {
      const nLinhas = Math.ceil(itens.length / C.QUEBRA);
      const porLinha = Math.ceil(itens.length / nLinhas);
      const linhas = [];
      let y = C.H + C.GY, largura = C.W;
      for (let i = 0; i < itens.length; i += porLinha) {
        const linha = itens.slice(i, i + porLinha);
        let x = C.RECUO;
        linha.forEach(it => { it.dx = x; it.dy = y; x += it.w + C.GX; });
        largura = Math.max(largura, x - C.GX);
        linhas.push({ y, itens: linha });
        y += Math.max(...linha.map(it => it.h)) + C.GY;
      }
      return { tipo: 'linhas', itens, linhas, w: largura, h: y - C.GY, cx: 0 };
    }

    /* ---------- passada 2: posicionar ---------- */
    const pos = new Map();
    const fios = [];

    function posicionar(no, x, y) {
      const c = caixas.get(no.id);
      pos.set(no.id, { x: x + c.cx, y });
      if (c.tipo === 'pendurado') colocarBloco(c.bloco, x + c.bloco.dx, y + c.bloco.dy);
      if (c.tipo === 'linha' || c.tipo === 'linhas') c.itens.forEach(it => {
        if (it.tipo === 'no') posicionar(it.no, x + it.dx, y + it.dy);
        else colocarBloco(it, x + it.dx, y + it.dy);
      });
    }
    function colocarBloco(b, x, y) {
      b.x = x; b.y = y;
      b.cols.forEach((col, j) => col.forEach((f, i) => {
        pos.set(f.id, { x: x + j * (C.RECUO + C.W + C.COLUNA) + C.RECUO, y: y + C.TOPO + i * (C.H + C.LINHA) });
      }));
    }

    /* ---------- passada 3: fios (um caminho por filho, do pai até ele) ---------- */
    function fiosDe(no) {
      const c = caixas.get(no.id);
      const p = pos.get(no.id);
      const pe = p.y + C.H;                    // pé do cartão do pai
      if (c.tipo === 'pendurado') {
        ligarBloco(no, c.bloco, [[p.x + C.TRILHO, pe]]);
      } else if (c.tipo === 'linha') {
        const sx = p.x + C.W / 2, barra = pe + C.GY / 2;
        c.itens.forEach(it => {
          const inicio = [[sx, pe], [sx, barra]];
          if (it.tipo === 'no') { const f = pos.get(it.no.id); fio(no, it.no, inicio.concat([[f.x + C.W / 2, barra], [f.x + C.W / 2, f.y]])); }
          else ligarBloco(no, it, inicio.concat([[it.x + it.ax, barra]]));
        });
      } else if (c.tipo === 'linhas') {
        const tx = p.x + C.TRILHO;
        c.linhas.forEach(l => {
          const barra = p.y + l.y - C.GY / 2;
          l.itens.forEach(it => {
            const inicio = [[tx, pe], [tx, barra]];
            if (it.tipo === 'no') { const f = pos.get(it.no.id); fio(no, it.no, inicio.concat([[f.x + C.W / 2, barra], [f.x + C.W / 2, f.y]])); }
            else ligarBloco(no, it, inicio.concat([[it.x + it.ax, barra]]));
          });
        });
      }
      op.filhos(no).forEach(f => { if (caixas.get(f.id)) fiosDe(f); });
    }
    // Dentro do bloco: desce até a barra das colunas, anda até o trilho da coluna
    // da pessoa, desce pelo trilho e entra no cartão pela esquerda.
    function ligarBloco(pai, b, inicio) {
      b.cols.forEach((col, j) => {
        const trilho = b.x + j * (C.RECUO + C.W + C.COLUNA) + C.TRILHO;
        col.forEach(f => {
          const q = pos.get(f.id), meio = q.y + C.H / 2;
          fio(pai, f, inicio.concat([[b.x + C.TRILHO, b.y], [trilho, b.y], [trilho, meio], [q.x, meio]]));
        });
      });
    }
    function fio(pai, filho, pontos) { fios.push({ de: pai.id, para: filho.id, d: caminho(pontos) }); }

    // Várias raízes (dado próprio com mais de um topo) ficam lado a lado.
    let x = 0, alt = 0;
    op.raizes.forEach(r => {
      const c = medir(r);
      posicionar(r, x, 0);
      x += c.w + C.GX * 2;
      alt = Math.max(alt, c.h);
    });
    op.raizes.forEach(fiosDe);
    return { pos, fios, w: Math.max(0, x - C.GX * 2), h: alt };
  }

  // Linha quebrada vira caminho SVG com quinas arredondadas. Antes tira ponto
  // repetido e ponto no meio de reta (senão a curva sai torta).
  function caminho(pontos) {
    const q = [];
    pontos.forEach(pt => {
      const n = q.length;
      if (n && q[n - 1][0] === pt[0] && q[n - 1][1] === pt[1]) return;
      if (n >= 2) {
        const a = q[n - 2], b = q[n - 1];
        if ((a[0] === b[0] && b[0] === pt[0]) || (a[1] === b[1] && b[1] === pt[1])) { q[n - 1] = pt; return; }
      }
      q.push(pt);
    });
    const r1 = v => Math.round(v * 10) / 10;
    let d = 'M' + r1(q[0][0]) + ' ' + r1(q[0][1]);
    for (let i = 1; i < q.length; i++) {
      const [x, y] = q[i];
      if (i === q.length - 1) { d += 'L' + r1(x) + ' ' + r1(y); break; }
      const [x0, y0] = q[i - 1], [x2, y2] = q[i + 1];
      const r = Math.min(C.RAIO, Math.hypot(x - x0, y - y0) / 2, Math.hypot(x2 - x, y2 - y) / 2);
      d += 'L' + r1(x - Math.sign(x - x0) * r) + ' ' + r1(y - Math.sign(y - y0) * r) +
        'Q' + r1(x) + ' ' + r1(y) + ' ' + r1(x + Math.sign(x2 - x) * r) + ' ' + r1(y + Math.sign(y2 - y) * r);
    }
    return d;
  }

  return { calcular, C };
})();
