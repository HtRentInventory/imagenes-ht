/* Imágenes HT — app.js. El marcado se inyecta aquí para que la
   cáscara HTML nunca tenga que cambiar. */

document.getElementById('app').innerHTML = `
<header class="topbar">
  <div class="topbar-in">
    <div class="marca"><b>Imágenes <em>HT</em></b><span>Repositorio de equipos</span></div>
    <div class="buscador">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input id="q" type="search" placeholder="Buscar NIV, tipo, marca o placas…" autocomplete="off" aria-label="Buscar equipo">
    </div>
    <div class="acceso"><span class="punto"></span> Solo lectura</div>
    <button class="btn-liga" id="copiar">Copiar liga</button>
  </div>
  <div class="cinta" aria-hidden="true"></div>
</header>

<nav class="patios" aria-label="Patios"><div class="patios-in" id="chips"></div></nav>

<main>
  <div class="cab">
    <div><h1 id="titulo">Cargando…</h1><div class="meta" id="meta"></div></div>
    <div class="acciones">
      <button class="btn btn-lleno" id="zipPatio" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v10m0 0l-4-4m4 4l4-4"/><path d="M4 18h16"/></svg>
        Descargar patio (ZIP)
      </button>
    </div>
  </div>
  <div class="rejilla" id="rejilla">
    <div class="estado"><span class="cargando"></span><b>Abriendo el repositorio</b>Un momento.</div>
  </div>
</main>

<footer class="pie">
  <span>Imágenes HT · Inmobiliaria THH</span>
  <span id="pieConteo"></span>
</footer>

<div class="visor" id="visor" role="dialog" aria-modal="true" aria-label="Visor de fotos">
  <div class="visor-cab">
    <div class="id"><span class="niv" id="vNiv"></span><span class="desc" id="vDesc"></span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="visor-btn" id="vFoto">Descargar esta foto</button>
      <button class="visor-btn" id="vZip">Descargar equipo (ZIP)</button>
      <button class="visor-btn" id="vCerrar" aria-label="Cerrar visor">Cerrar ✕</button>
    </div>
  </div>
  <div class="visor-cuerpo">
    <button class="nav prev" id="vPrev" aria-label="Foto anterior"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg></button>
    <div class="marco" id="vMarco"></div>
    <button class="nav next" id="vNext" aria-label="Foto siguiente"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></button>
  </div>
  <div class="tira" id="vTira"></div>
</div>

<div class="aviso" id="aviso" role="status" aria-live="polite"></div>
`;

/* ================== configuración ================== */
const SB_URL = 'https://myfmstaeilegsoobllni.supabase.co';
const SB_KEY = 'sb_publishable_9H_QYw9zDv1FO1mVLvgmCw_OSWHuERz';
const BUCKET = 'fotos-patio';

const TOKEN = new URLSearchParams(location.search).get('t') || '';
const $ = id => document.getElementById(id);
const urlFoto = ruta => `${SB_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(ruta)}`;

async function rpc(fn, args){
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY},
    body: JSON.stringify(args)
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

/* ================== estado ================== */
let INDICE = null;              // {titulo, alcance, actualizado, patios:[{patio,equipos,fotos}]}
const CACHE = new Map();        // patio -> [equipos]
let patioActivo = null, filtro = '', cargandoPatio = false;
let visorEq = null, visorIdx = 0;

/* ================== carga ================== */
async function iniciar(){
  if(!TOKEN) return pantalla('Falta la liga',
    'Abre el repositorio con la liga completa que te compartieron; debe terminar en <b>?t=…</b>');
  try{
    const d = await rpc('galeria_indice', {p_token: TOKEN});
    if(!d || d.error) return pantalla('Esta liga no está disponible',
      'Puede que se haya desactivado o vencido. Pide una nueva a Servicio a Clientes.');
    INDICE = d;
    if(!INDICE.patios.length) return pantalla('Todavía no hay fotos aquí',
      'La liga está publicada pero aún no se suben fotos de patio.');
    patioActivo = INDICE.patios[0].patio;
    pintarChips();
    await abrirPatio(patioActivo);
  }catch(e){
    pantalla('No se pudo abrir el repositorio','Revisa tu conexión y vuelve a intentar.');
  }
}
function pantalla(t,p){
  $('titulo').textContent = 'Imágenes HT'; $('meta').innerHTML = '';
  $('rejilla').innerHTML = `<div class="estado"><b>${t}</b>${p}</div>`;
}
async function traerPatio(nombre){
  if(CACHE.has(nombre)) return CACHE.get(nombre);
  const d = await rpc('galeria_patio', {p_token: TOKEN, p_patio: nombre});
  const eqs = (d && d.equipos) ? d.equipos : [];
  CACHE.set(nombre, eqs);
  return eqs;
}
async function abrirPatio(nombre){
  patioActivo = nombre; pintarChips();
  cargandoPatio = true; encabezado(); 
  $('rejilla').innerHTML = `<div class="estado"><span class="cargando"></span><b>Cargando ${nombre}</b>Trayendo los equipos de este patio.</div>`;
  try{
    if(nombre === '__todos__'){
      await Promise.all(INDICE.patios.map(p => traerPatio(p.patio)));
    }else{
      await traerPatio(nombre);
    }
  }catch(e){
    return pantalla('No se pudieron cargar los equipos','Vuelve a intentar en un momento.');
  }
  cargandoPatio = false; pintar();
}

/* ================== render ================== */
function equiposActuales(){
  if(patioActivo === '__todos__')
    return INDICE.patios.flatMap(p => CACHE.get(p.patio) || []);
  return CACHE.get(patioActivo) || [];
}
function visibles(){
  return equiposActuales().filter(e => {
    if(!filtro) return true;
    const t = [e.niv,e.tipo,e.marca,e.anio,e.placas,e.clasificacion,e.patio].join(' ').toLowerCase();
    return t.includes(filtro.toLowerCase());
  });
}
function pintarChips(){
  const totalEq = INDICE.patios.reduce((a,p)=>a+p.equipos,0);
  const lista = INDICE.patios.concat(
    INDICE.patios.length > 1 ? [{patio:'__todos__', equipos: totalEq}] : []);
  $('chips').innerHTML = lista.map(p => `
    <button class="chip" data-patio="${p.patio}" aria-current="${p.patio===patioActivo}">
      <span>${p.patio==='__todos__' ? 'Todos los patios' : p.patio}</span><i>${p.equipos}</i></button>`).join('');
  $('chips').querySelectorAll('.chip').forEach(c => c.onclick = () => {
    if(cargandoPatio) return;
    abrirPatio(c.dataset.patio);
    window.scrollTo({top:0,behavior:'smooth'});
  });
}
function encabezado(){
  const esTodos = patioActivo === '__todos__';
  $('titulo').textContent = esTodos ? (INDICE.titulo || 'Todos los patios') : patioActivo;
  const info = esTodos
    ? INDICE.patios.reduce((a,p)=>({e:a.e+p.equipos, f:a.f+p.fotos}),{e:0,f:0})
    : (()=>{ const p = INDICE.patios.find(x=>x.patio===patioActivo)||{equipos:0,fotos:0};
             return {e:p.equipos, f:p.fotos}; })();
  const alc = INDICE.alcance === 'permanente' ? 'Se actualiza solo' : 'Levantamiento fijo';
  $('meta').innerHTML = `${info.e} equipos <em>·</em> ${info.f} fotos <em>·</em> Al ${INDICE.actualizado} <em>·</em> ${alc}`;
}
function pintar(){
  encabezado();
  const eqs = visibles();
  $('zipPatio').disabled = !eqs.length;
  $('rejilla').innerHTML = eqs.length ? eqs.map((e,i) => `
    <button class="tarjeta" data-k="${e.patio}||${e.niv}">
      <div class="lienzo">
        <img src="${urlFoto(e.fotos[0].ruta)}" alt="${e.tipo||'Equipo'} ${e.niv}" loading="lazy" decoding="async">
        <span class="conteo">${e.fotos.length} fotos</span>
        <span class="velo">Ver fotos</span>
      </div>
      <div class="placa"><span class="niv">${e.niv}</span><span class="marca-eq">${e.marca||''}</span></div>
      <div class="cuerpo">
        <span class="tipo">${e.tipo||'Sin tipo'}</span>
        <span class="sub">${[e.anio,e.clasificacion,(patioActivo==='__todos__'?e.patio:null)].filter(Boolean).join(' · ')}</span>
        ${e.estado==='excedente' ? '<span class="etiqueta excedente">Excedente en patio</span>' : ''}
      </div>
    </button>`).join('')
  : `<div class="estado"><b>Ningún equipo coincide con “${filtro}”</b>Busca por NIV, tipo de equipo, marca o placas.</div>`;
  $('pieConteo').textContent = `${eqs.length} equipos en vista`;
  $('rejilla').querySelectorAll('.tarjeta').forEach(t => t.onclick = () => {
    const [p,n] = t.dataset.k.split('||');
    abrirVisor(equiposActuales().find(e => e.patio===p && e.niv===n));
  });
}

/* ================== visor ================== */
function abrirVisor(e){
  if(!e) return;
  visorEq = e; visorIdx = 0;
  $('visor').classList.add('abierto'); document.body.style.overflow='hidden';
  pintarVisor(); $('vCerrar').focus();
}
function pintarVisor(){
  const e = visorEq, f = e.fotos[visorIdx];
  $('vNiv').textContent = e.niv;
  $('vDesc').textContent = [e.tipo,e.marca,e.anio,e.patio].filter(Boolean).join(' · ');
  $('vMarco').innerHTML = `<img src="${urlFoto(f.ruta)}" alt="${f.angulo}">
    <span class="angulo">${visorIdx+1} / ${e.fotos.length} — ${f.angulo}${f.fecha ? ' · '+f.fecha : ''}</span>`;
  $('vTira').innerHTML = e.fotos.map((x,i) => `
    <button class="mini" data-i="${i}" aria-current="${i===visorIdx}" title="${x.angulo}${x.fecha?' · '+x.fecha:''}">
      <img src="${urlFoto(x.ruta)}" alt="${x.angulo}" loading="lazy"></button>`).join('');
  $('vTira').querySelectorAll('.mini').forEach(m => m.onclick = () => { visorIdx=+m.dataset.i; pintarVisor(); });
  $('vTira').children[visorIdx]?.scrollIntoView({block:'nearest',inline:'center'});
}
function mover(d){
  if(!visorEq) return;
  visorIdx = (visorIdx + d + visorEq.fotos.length) % visorEq.fotos.length;
  pintarVisor();
}
function cerrarVisor(){ $('visor').classList.remove('abierto'); document.body.style.overflow=''; visorEq=null; }

/* ================== descargas ================== */
const limpio = s => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                      .replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
const nombreFoto = (eq,f,i) => `${eq.niv}__${limpio(f.angulo)}__${String(i+1).padStart(2,'0')}.jpg`;
function bajar(blob, nombre){
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nombre; a.click();
  setTimeout(()=>URL.revokeObjectURL(u), 4000);
}
async function bajarFoto(){
  const e = visorEq, f = e.fotos[visorIdx];
  aviso('Descargando foto…');
  bajar(await (await fetch(urlFoto(f.ruta))).blob(), nombreFoto(e,f,visorIdx));
}
async function bajarZip(equipos, nombreZip, boton){
  const total = equipos.reduce((a,e)=>a+e.fotos.length,0);
  if(!total) return;
  boton.disabled = true;
  aviso(`Armando ZIP con ${total} fotos…`);
  try{
    const zip = new JSZip(); let hechas = 0;
    for(const e of equipos){
      const carpeta = zip.folder(`${limpio(e.patio)}/${e.niv}`);
      for(let i=0;i<e.fotos.length;i++){
        const f = e.fotos[i];
        carpeta.file(nombreFoto(e,f,i), await (await fetch(urlFoto(f.ruta))).blob());
        if(++hechas % 15 === 0) aviso(`Armando ZIP… ${hechas} de ${total}`);
      }
    }
    bajar(await zip.generateAsync({type:'blob'}), nombreZip);
    aviso('ZIP listo.');
  }catch(err){
    aviso('No se pudo armar el ZIP. Prueba con un patio a la vez.');
  }finally{ boton.disabled = false; }
}

/* ================== avisos ================== */
let avisoT;
function aviso(txt){
  const a = $('aviso'); a.textContent = txt; a.classList.add('visible');
  clearTimeout(avisoT); avisoT = setTimeout(()=>a.classList.remove('visible'), 3400);
}

/* ================== eventos ================== */
$('q').addEventListener('input', ev => { filtro = ev.target.value.trim(); if(INDICE && !cargandoPatio) pintar(); });
$('copiar').onclick = () => { navigator.clipboard?.writeText(location.href); aviso('Liga copiada al portapapeles.'); };
$('zipPatio').onclick = ev => bajarZip(visibles(),
  `imagenes-ht_${limpio(patioActivo==='__todos__'?'todos':patioActivo)}_${INDICE.actualizado}.zip`, ev.currentTarget);
$('vFoto').onclick = bajarFoto;
$('vZip').onclick = ev => bajarZip([visorEq], `${visorEq.niv}.zip`, ev.currentTarget);
$('vCerrar').onclick = cerrarVisor;
$('vPrev').onclick = () => mover(-1);
$('vNext').onclick = () => mover(1);
document.addEventListener('keydown', ev => {
  if(ev.key==='Escape') cerrarVisor();
  if($('visor').classList.contains('abierto')){
    if(ev.key==='ArrowLeft') mover(-1);
    if(ev.key==='ArrowRight') mover(1);
  }
});

iniciar();
