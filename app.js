/* ============ Nior — Mapa de Processos ============ */

const STORAGE_KEY = 'nior_data_v1';

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function seedData(){
  const b = (id,nome,eyebrow,x,y,descricao) => ({id,nome,eyebrow,x,y,descricao:descricao||'', passos:[], conexoes:[]});
  const blocos = [
    b('sistema','Sistema','Excia ERP', 0, -260, 'Limpeza e organização do sistema: lotes atuais e pendências antigas.'),
    b('corte','Corte', 'Etapa 1', -260, -90),
    b('costura','Costura', 'Etapa 2', -260, 90),
    b('estamparia','Estamparia', 'Etapa 3', 40, 90, ''),
    b('aplique','Aplique', 'Etapa 3', 40, 250),
    b('plaquinha','Plaquinha', 'Etapa 4', 300, 250, 'Pecinha costurada/caseada, geralmente em shorts e vestidos.'),
    b('embalagem','Embalagem', 'Etapa final', 300, 0),
    b('insumos','Insumos & NF', 'Apoio', -520, 0, 'Organização de insumos, nota fiscal e lotes.'),
  ];
  const conn = (a,bb) => { const n = blocos.find(x=>x.id===a); if(n && !n.conexoes.includes(bb)) n.conexoes.push(bb); };
  conn('insumos','corte');
  conn('corte','costura');
  conn('costura','estamparia');
  conn('costura','aplique');
  conn('aplique','plaquinha');
  conn('estamparia','embalagem');
  conn('plaquinha','embalagem');
  conn('sistema','corte');
  return { blocos, view:{ x: window.innerWidth/2, y: window.innerHeight/2 + 40, scale: 0.9 } };
}

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return seedData();
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}

/* ---------- refs ---------- */
const canvasWrap = document.getElementById('canvasWrap');
const canvasStage = document.getElementById('canvasStage');
const canvasNodes = document.getElementById('canvasNodes');
const canvasLines = document.getElementById('canvasLines');
const hintBar = document.getElementById('hintBar');

let activeBlocoId = null;

/* ---------- render ---------- */
function applyTransform(){
  canvasStage.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
}

function render(){
  canvasNodes.innerHTML = '';
  state.blocos.forEach(bloco=>{
    const el = document.createElement('div');
    el.className = 'node';
    el.style.left = bloco.x + 'px';
    el.style.top = bloco.y + 'px';
    el.dataset.id = bloco.id;
    el.innerHTML = `
      <div class="node-eyebrow">${escapeHtml(bloco.eyebrow||'BLOCO')}</div>
      <div class="node-title">${escapeHtml(bloco.nome||'Sem nome')}</div>
      <div class="node-meta"><span class="dot"></span>${bloco.passos.length} passo${bloco.passos.length===1?'':'s'}</div>
    `;
    attachNodeDrag(el, bloco);
    canvasNodes.appendChild(el);
  });
  renderLines();
  applyTransform();
}

function renderLines(){
  const w = 8000, h = 8000, offset = 4000;
  let svg = `<g transform="translate(${offset},${offset})">`;
  state.blocos.forEach(bloco=>{
    bloco.conexoes.forEach(destId=>{
      const dest = state.blocos.find(x=>x.id===destId);
      if(!dest) return;
      const mx = (bloco.x+dest.x)/2, my = (bloco.y+dest.y)/2 - 30;
      svg += `<path class="stitch-line" d="M${bloco.x},${bloco.y} Q${mx},${my} ${dest.x},${dest.y}"/>`;
    });
  });
  svg += '</g>';
  canvasLines.setAttribute('viewBox', `0 0 ${w} ${h}`);
  canvasLines.innerHTML = svg;
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- pan / zoom do canvas ---------- */
let panning = false, panStart = {x:0,y:0}, viewStart = {x:0,y:0};
let pinchStartDist = 0, pinchStartScale = 1;
let didDrag = false;

canvasWrap.addEventListener('pointerdown', (e)=>{
  if(e.target.closest('.node')) return;
  panning = true; didDrag = false;
  canvasWrap.classList.add('dragging');
  panStart = {x:e.clientX, y:e.clientY};
  viewStart = {x:state.view.x, y:state.view.y};
  canvasWrap.setPointerCapture(e.pointerId);
});
canvasWrap.addEventListener('pointermove', (e)=>{
  if(!panning) return;
  const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
  if(Math.abs(dx)>3 || Math.abs(dy)>3) didDrag = true;
  state.view.x = viewStart.x + dx;
  state.view.y = viewStart.y + dy;
  applyTransform();
});
function endPan(){
  if(panning){ panning = false; canvasWrap.classList.remove('dragging'); saveState(); }
}
canvasWrap.addEventListener('pointerup', endPan);
canvasWrap.addEventListener('pointercancel', endPan);

canvasWrap.addEventListener('wheel', (e)=>{
  e.preventDefault();
  const delta = -e.deltaY * 0.0012;
  zoomAt(e.clientX, e.clientY, delta);
}, {passive:false});

// pinch (touch)
let touches = {};
canvasWrap.addEventListener('touchstart', (e)=>{
  if(e.touches.length===2){
    panning = false;
    pinchStartDist = touchDist(e.touches);
    pinchStartScale = state.view.scale;
  }
}, {passive:true});
canvasWrap.addEventListener('touchmove', (e)=>{
  if(e.touches.length===2){
    e.preventDefault();
    const d = touchDist(e.touches);
    const factor = d / pinchStartDist;
    const newScale = clamp(pinchStartScale * factor, 0.35, 2.2);
    const cx = (e.touches[0].clientX + e.touches[1].clientX)/2;
    const cy = (e.touches[0].clientY + e.touches[1].clientY)/2;
    setZoom(newScale, cx, cy);
  }
}, {passive:false});

function touchDist(t){
  return Math.hypot(t[0].clientX-t[1].clientX, t[0].clientY-t[1].clientY);
}
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function zoomAt(clientX, clientY, delta){
  const newScale = clamp(state.view.scale * (1+delta), 0.35, 2.2);
  setZoom(newScale, clientX, clientY);
}
function setZoom(newScale, clientX, clientY){
  const rect = canvasWrap.getBoundingClientRect();
  const px = clientX - rect.left, py = clientY - rect.top;
  const worldX = (px - state.view.x) / state.view.scale;
  const worldY = (py - state.view.y) / state.view.scale;
  state.view.scale = newScale;
  state.view.x = px - worldX*newScale;
  state.view.y = py - worldY*newScale;
  applyTransform();
  saveState();
}

document.getElementById('btnZoomIn').addEventListener('click', ()=> zoomAt(window.innerWidth/2, window.innerHeight/2, 0.25));
document.getElementById('btnZoomOut').addEventListener('click', ()=> zoomAt(window.innerWidth/2, window.innerHeight/2, -0.25));
document.getElementById('btnZoomReset').addEventListener('click', ()=>{
  state.view = { x: window.innerWidth/2, y: window.innerHeight/2 + 40, scale: 0.9 };
  applyTransform(); saveState();
});

/* ---------- drag individual de nó ---------- */
function attachNodeDrag(el, bloco){
  let dragging = false, moved = false;
  let startClient = {x:0,y:0}, startPos = {x:0,y:0};

  el.addEventListener('pointerdown', (e)=>{
    e.stopPropagation();
    dragging = true; moved = false;
    startClient = {x:e.clientX, y:e.clientY};
    startPos = {x:bloco.x, y:bloco.y};
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const dx = (e.clientX - startClient.x) / state.view.scale;
    const dy = (e.clientY - startClient.y) / state.view.scale;
    if(Math.abs(dx)>3 || Math.abs(dy)>3) moved = true;
    if(moved){
      bloco.x = startPos.x + dx;
      bloco.y = startPos.y + dy;
      el.style.left = bloco.x+'px';
      el.style.top = bloco.y+'px';
      renderLines();
    }
  });
  el.addEventListener('pointerup', (e)=>{
    e.stopPropagation();
    dragging = false;
    if(moved){ saveState(); }
    else{ openPanel(bloco.id); }
  });
}

/* ---------- Novo bloco ---------- */
document.getElementById('btnNovoBloco').addEventListener('click', ()=>{
  const id = uid();
  const centerWorld = {
    x: (window.innerWidth/2 - state.view.x)/state.view.scale,
    y: (window.innerHeight/2 - state.view.y)/state.view.scale
  };
  state.blocos.push({ id, nome:'', eyebrow:'BLOCO', x:centerWorld.x, y:centerWorld.y, descricao:'', passos:[], conexoes:[] });
  saveState();
  render();
  openPanel(id);
});

/* ============ Painel lateral ============ */
const overlay = document.getElementById('overlay');
const panel = document.getElementById('panelBloco');
const panelTag = document.getElementById('panelTag');
const panelTitulo = document.getElementById('panelTitulo');
const panelDescricao = document.getElementById('panelDescricao');
const passosLista = document.getElementById('passosLista');
const conexoesLista = document.getElementById('conexoesLista');
const conexoesEmptyHint = document.getElementById('conexoesEmptyHint');

function getBloco(id){ return state.blocos.find(b=>b.id===id); }

function openPanel(id){
  activeBlocoId = id;
  const bloco = getBloco(id);
  if(!bloco) return;
  panelTag.textContent = bloco.eyebrow || 'BLOCO';
  panelTitulo.value = bloco.nome || '';
  panelDescricao.value = bloco.descricao || '';
  renderPassos(bloco);
  renderConexoes(bloco);
  overlay.classList.add('show');
  panel.classList.add('show');
}
function closePanel(){
  overlay.classList.remove('show');
  panel.classList.remove('show');
  activeBlocoId = null;
  render();
}
document.getElementById('panelClose').addEventListener('click', closePanel);
overlay.addEventListener('click', closePanel);

panelTitulo.addEventListener('input', ()=>{
  const bloco = getBloco(activeBlocoId); if(!bloco) return;
  bloco.nome = panelTitulo.value; saveState();
});
panelDescricao.addEventListener('input', ()=>{
  const bloco = getBloco(activeBlocoId); if(!bloco) return;
  bloco.descricao = panelDescricao.value; saveState();
});

function renderPassos(bloco){
  passosLista.innerHTML = '';
  if(bloco.passos.length===0){
    passosLista.innerHTML = '<p class="empty-hint">Nenhum passo ainda. Toque em "+ Passo".</p>';
    return;
  }
  bloco.passos.forEach((p, idx)=>{
    const card = document.createElement('div');
    card.className = 'passo-card';
    card.innerHTML = `
      <span class="passo-num">PASSO ${String(idx+1).padStart(2,'0')}</span>
      <p class="passo-texto">${escapeHtml(p.texto)}</p>
      ${p.melhoria ? `<p class="passo-melhoria">${escapeHtml(p.melhoria)}</p>` : ''}
      <div class="passo-actions">
        <button data-act="edit" title="Editar">✎</button>
        <button data-act="del" title="Excluir">🗑</button>
      </div>
    `;
    card.querySelector('[data-act="edit"]').addEventListener('click', ()=> openPassoModal(bloco.id, p.id));
    card.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      bloco.passos = bloco.passos.filter(x=>x.id!==p.id);
      saveState(); renderPassos(bloco);
    });
    passosLista.appendChild(card);
  });
}

document.getElementById('btnAddPasso').addEventListener('click', ()=>{
  if(!activeBlocoId) return;
  openPassoModal(activeBlocoId, null);
});

function renderConexoes(bloco){
  conexoesLista.innerHTML = '';
  if(bloco.conexoes.length===0){
    conexoesEmptyHint.style.display = 'block';
  }else{
    conexoesEmptyHint.style.display = 'none';
    bloco.conexoes.forEach(destId=>{
      const dest = getBloco(destId);
      if(!dest) return;
      const chip = document.createElement('div');
      chip.className = 'conexao-chip';
      chip.innerHTML = `<span>→ ${escapeHtml(dest.nome||'Sem nome')}</span><button>×</button>`;
      chip.querySelector('button').addEventListener('click', ()=>{
        bloco.conexoes = bloco.conexoes.filter(x=>x!==destId);
        saveState(); renderConexoes(bloco);
      });
      conexoesLista.appendChild(chip);
    });
  }
}

document.getElementById('btnExcluirBloco').addEventListener('click', ()=>{
  if(!activeBlocoId) return;
  if(!confirm('Excluir este bloco e suas conexões?')) return;
  state.blocos = state.blocos.filter(b=>b.id!==activeBlocoId);
  state.blocos.forEach(b=> b.conexoes = b.conexoes.filter(c=>c!==activeBlocoId));
  saveState();
  closePanel();
});

/* ---------- Modal conectar ---------- */
const overlayConectar = document.getElementById('overlayConectar');
const modalConectar = document.getElementById('modalConectar');
const modalConectarLista = document.getElementById('modalConectarLista');

document.getElementById('btnConectar').addEventListener('click', ()=>{
  if(!activeBlocoId) return;
  const bloco = getBloco(activeBlocoId);
  modalConectarLista.innerHTML = '';
  state.blocos.filter(b=>b.id!==activeBlocoId).forEach(b=>{
    const item = document.createElement('div');
    item.className = 'modal-select-item';
    const already = bloco.conexoes.includes(b.id);
    item.innerHTML = `<span>${escapeHtml(b.nome||'Sem nome')}</span>${already?'<span class="check">✓</span>':''}`;
    item.addEventListener('click', ()=>{
      if(bloco.conexoes.includes(b.id)){
        bloco.conexoes = bloco.conexoes.filter(x=>x!==b.id);
      }else{
        bloco.conexoes.push(b.id);
      }
      saveState();
      renderConexoes(bloco);
      closeModalConectar();
    });
    modalConectarLista.appendChild(item);
  });
  overlayConectar.classList.add('show');
  modalConectar.classList.add('show');
});
function closeModalConectar(){
  overlayConectar.classList.remove('show');
  modalConectar.classList.remove('show');
}
document.getElementById('modalConectarClose').addEventListener('click', closeModalConectar);
overlayConectar.addEventListener('click', closeModalConectar);

/* ---------- Modal passo ---------- */
const overlayPasso = document.getElementById('overlayPasso');
const modalPasso = document.getElementById('modalPasso');
const modalPassoTitulo = document.getElementById('modalPassoTitulo');
const passoDescricao = document.getElementById('passoDescricao');
const passoMelhoria = document.getElementById('passoMelhoria');
let editingPassoId = null;

function openPassoModal(blocoId, passoId){
  activeBlocoId = blocoId;
  editingPassoId = passoId;
  const bloco = getBloco(blocoId);
  if(passoId){
    const p = bloco.passos.find(x=>x.id===passoId);
    modalPassoTitulo.textContent = 'Editar passo';
    passoDescricao.value = p.texto || '';
    passoMelhoria.value = p.melhoria || '';
  }else{
    modalPassoTitulo.textContent = 'Novo passo';
    passoDescricao.value = '';
    passoMelhoria.value = '';
  }
  overlayPasso.classList.add('show');
  modalPasso.classList.add('show');
  setTimeout(()=>passoDescricao.focus(), 50);
}
function closeModalPasso(){
  overlayPasso.classList.remove('show');
  modalPasso.classList.remove('show');
}
document.getElementById('modalPassoClose').addEventListener('click', closeModalPasso);
overlayPasso.addEventListener('click', closeModalPasso);

document.getElementById('btnSalvarPasso').addEventListener('click', ()=>{
  const bloco = getBloco(activeBlocoId);
  if(!bloco) return;
  const texto = passoDescricao.value.trim();
  if(!texto){ passoDescricao.focus(); return; }
  if(editingPassoId){
    const p = bloco.passos.find(x=>x.id===editingPassoId);
    p.texto = texto;
    p.melhoria = passoMelhoria.value.trim();
  }else{
    bloco.passos.push({ id: uid(), texto, melhoria: passoMelhoria.value.trim() });
  }
  saveState();
  renderPassos(bloco);
  render();
  closeModalPasso();
});

/* ---------- init ---------- */
render();

// esconder dica depois de um tempo
setTimeout(()=>{ hintBar.style.transition='opacity .6s'; hintBar.style.opacity='0'; }, 5000);

// registrar service worker
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
