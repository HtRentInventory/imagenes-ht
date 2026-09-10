/* Imágenes HT — seminuevos.js
   Elegir la foto de portada por equipo y exportar el ZIP que
   espera el importador del catálogo. El marcado se inyecta aquí
   para que la cáscara HTML nunca tenga que cambiar. */

document.getElementById('app').innerHTML = `
<header class="topbar">
  <div class="topbar-in">
    <div class="marca"><b>Imágenes <em>HT</em></b><span>Portadas para el catálogo</span></div>
    <div class="sesion" id="sesion" hidden>
      <span id="quien"></span>
      <button class="salir" id="salir">Cerrar sesión</button>
    </div>
  </div>
  <div class="cinta" aria-hidden="true"></div>
</header>

<main>
  <section id="pantallaEntrar" class="entrar">
    <div class="caja">
      <h2>Entrar</h2>
      <p class="nota">Usa tu cuenta de HT Rent, la misma de la app de levantamientos.</p>
      <div style="display:grid;gap:14px">
        <div><label for="email">Correo</label><input id="email" type="email" autocomplete="username"></div>
        <div><label for="pass">Contraseña</label><input id="pass" type="password" autocomplete="current-password"></div>
        <button class="btn btn-lleno" id="btnEntrar" style="justify-content:center">Entrar</button>
      </div>
      <div class="error" id="errorEntrar"></div>
    </div>
  </section>

  <section id="pantallaPanel" hidden>
    <h1>Portadas del catálogo</h1>
    <div class="sub" id="resumen"></div>

    <div class="caja">
      <h2>Cómo funciona</h2>
      <p class="nota">La portada es la foto que el catálogo usa como imagen principal. Sale del ZIP con el sufijo <code>_portada</code> en el nombre; las demás fotos van tal cual, el orden no importa. Elige la que muestre la unidad completa de tres cuartos: es la que vende.</p>
      <div class="barra">
        <div class="campo" style="max-width:280px">
          <label for="fPatio">Patio</label>
          <select id="fPatio"><option value="">Todos los patios</option></select>
        </div>
        <div class="campo" style="max-width:260px">
          <label for="fBuscar">Buscar</label>
          <input id="fBuscar" type="text" placeholder="NIV, tipo o marca…" autocomplete="off">
        </div>
        <div class="campo" style="max-width:220px">
          <label for="fFiltro">Mostrar</label>
          <select id="fFiltro">
            <option value="todos">Todos</option>
            <option value="sin">Solo sin portada</option>
            <option value="con">Solo con portada</option>
          </select>
        </div>
      </div>
      <div class="barra" style="margin-top:16px">
        <button class="btn" id="btnSugerir">Proponer portadas faltantes</button>
        <button class="btn" id="btnTodos">Seleccionar todo lo visible</button>
        <button class="btn" id="btnNada">Quitar selección</button>
        <button class="btn btn-lleno" id="btnZip" disabled>Descargar ZIP del catálogo</button>
      </div>
      <div class="error" id="errorPanel"></div>
    </div>

    <div id="lista"></div>
  </section>
</main>

<div class="aviso" id="aviso" role="status" aria-live="polite"></div>
`;

/* ================== configuración ================== */
const SB_URL = 'https://myfmstaeilegsoobllni.supabase.co';
const SB_KEY = 'sb_publishable_9H_QYw9zDv1FO1mVLvgmCw_OSWHuERz';
const BUCKET = 'fotos-patio';

const $ = id => document.getElementById(id);
const urlFoto = ruta => `${SB_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(ruta)}`;

let SESION = null, DATOS = null;
const ELEGIDOS = new Set();

/* ================== API ================== */
async function entrar(email, password){
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method:'POST', headers:{'Content-Type':'application/json','apikey':SB_KEY},
    body: JSON.stringify({email, password})
  });
  const d = await r.json();
  if(!r.ok) throw new Error(d.error_description || d.msg || 'No se pudo entrar');
  return d;
}
async function rpc(fn, args={}){
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,
             'Authorization':'Bearer '+SESION.access_token},
    body: JSON.stringify(args)
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

/* ================== nombres de archivo ================== */
/* Windows no admite \ / : * ? " < > | en nombres */
const seguro = s => (s||'').toString()
  .replace(/["]/g,'')
  .replace(/[\\\/:*?<>|]/g,'-')
  .replace(/\s+/g,' ')
  .trim();
const carpeta  = e => seguro(`${e.niv} - ${e.tipo || 'SIN TIPO'}`);
const archivo  = (e, i, esPortada) =>
  esPortada ? `${e.niv}_portada.jpg` : `${e.niv}_${String(i).padStart(2,'0')}.jpg`;

/* ================== carga ================== */
async function cargar(){
  $('lista').innerHTML = `<div class="estado"><span class="cargando"></span><b>Cargando</b>Trayendo los equipos con fotos.</div>`;
  const d = await rpc('admin_catalogo', {p_patio: $('fPatio').value || null});
  if(d.error){
    $('lista').innerHTML = `<div class="estado"><b>Sin acceso</b>${d.error}</div>`;
    return;
  }
  DATOS = d;
  if($('fPatio').options.length <= 1){
    $('fPatio').innerHTML = '<option value="">Todos los patios</option>' +
      d.patios.map(p => `<option value="${p}">${p}</option>`).join('');
  }
  pintar();
}

/* ================== render ================== */
function visibles(){
  const q = $('fBuscar').value.trim().toLowerCase();
  const modo = $('fFiltro').value;
  return DATOS.equipos.filter(e => {
    const tienePortada = e.fotos.some(f => f.portada);
    if(modo === 'sin' && tienePortada) return false;
    if(modo === 'con' && !tienePortada) return false;
    if(!q) return true;
    return [e.niv,e.tipo,e.marca,e.anio,e.patio].join(' ').toLowerCase().includes(q);
  });
}
function pintar(){
  const eqs = visibles();
  const conPortada = DATOS.equipos.filter(e => e.fotos.some(f=>f.portada)).length;
  $('resumen').textContent =
    `${DATOS.equipos.length} equipos con fotos · ${conPortada} con portada · ` +
    `${DATOS.equipos.length - conPortada} pendientes · ${ELEGIDOS.size} seleccionados`;
  $('btnZip').disabled = ELEGIDOS.size === 0;

  if(!eqs.length){
    $('lista').innerHTML = `<div class="estado"><b>Nada que mostrar</b>Ajusta el patio o el filtro.</div>`;
    return;
  }

  $('lista').innerHTML = eqs.map(e => {
    const portada = e.fotos.find(f => f.portada);
    return `
    <div class="equipo ${portada?'':'sin-portada'}">
      <div class="equipo-cab">
        <label class="check">
          <input type="checkbox" data-sel="${e.id}" ${ELEGIDOS.has(e.id)?'checked':''}>
          <span class="equipo-niv">${e.niv}</span>
        </label>
        <div class="equipo-meta">
          ${[e.tipo,e.marca,e.anio,e.patio].filter(Boolean).join(' · ')}
          · ${e.fotos.length} fotos
        </div>
        <span class="sello ${portada?'viva':''}">
          ${portada ? 'Portada: '+portada.angulo : 'Sin portada'}</span>
      </div>
      <div class="tira-fotos">
        ${e.fotos.map(f => `
          <button class="foto ${f.portada?'es-portada':''}"
                  data-equipo="${e.id}" data-foto="${f.id}"
                  title="${f.angulo}${f.portada?' — es la portada':''}">
            <img src="${urlFoto(f.ruta)}" alt="${f.angulo}" loading="lazy" decoding="async">
            <small>${f.angulo}</small>
          </button>`).join('')}
      </div>
    </div>`;
  }).join('');

  $('lista').querySelectorAll('[data-sel]').forEach(c => c.onchange = () => {
    c.checked ? ELEGIDOS.add(c.dataset.sel) : ELEGIDOS.delete(c.dataset.sel);
    $('resumen').textContent = $('resumen').textContent.replace(/\d+ seleccionados/, ELEGIDOS.size+' seleccionados');
    $('btnZip').disabled = ELEGIDOS.size === 0;
  });
  $('lista').querySelectorAll('.foto').forEach(b => b.onclick = async () => {
    const eq = DATOS.equipos.find(x => x.id === b.dataset.equipo);
    const yaEs = eq.fotos.find(f => f.id === b.dataset.foto)?.portada;
    const d = await rpc('admin_portada', {
      p_equipo_id: b.dataset.equipo,
      p_foto_id: yaEs ? null : b.dataset.foto
    });
    if(d.error) return aviso(d.error);
    eq.fotos.forEach(f => f.portada = (!yaEs && f.id === b.dataset.foto));
    eq.fotos.sort((a,c) => (c.portada?1:0)-(a.portada?1:0));
    pintar();
    aviso(yaEs ? 'Portada quitada.' : 'Portada guardada.');
  });
}

/* ================== exportación ================== */
async function exportar(boton){
  const eqs = DATOS.equipos.filter(e => ELEGIDOS.has(e.id));
  const sinPortada = eqs.filter(e => !e.fotos.some(f => f.portada));
  if(sinPortada.length){
    const ok = confirm(
      `${sinPortada.length} de los ${eqs.length} equipos seleccionados no tienen portada elegida.\n\n` +
      `Si continúas se quedan fuera del ZIP, porque el catálogo pondría cualquier foto como principal.\n\n` +
      `¿Exportar solo los ${eqs.length - sinPortada.length} que sí la tienen?`);
    if(!ok) return;
  }
  const lista = eqs.filter(e => e.fotos.some(f => f.portada));
  if(!lista.length) return aviso('Ninguno de los seleccionados tiene portada.');

  const total = lista.reduce((a,e)=>a+e.fotos.length,0);
  boton.disabled = true;
  aviso(`Armando ZIP: ${lista.length} equipos, ${total} fotos…`);
  try{
    const zip = new JSZip();
    let hechas = 0;
    for(const e of lista){
      const dir = zip.folder(carpeta(e));
      const portada = e.fotos.find(f => f.portada);
      const resto = e.fotos.filter(f => !f.portada);
      dir.file(archivo(e, 1, true), await (await fetch(urlFoto(portada.ruta))).blob());
      hechas++;
      let i = 2;
      for(const f of resto){
        dir.file(archivo(e, i++, false), await (await fetch(urlFoto(f.ruta))).blob());
        if(++hechas % 20 === 0) aviso(`Armando ZIP… ${hechas} de ${total} fotos`);
      }
    }
    const blob = await zip.generateAsync({type:'blob'});
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u;
    a.download = `catalogo-seminuevos_${new Date().toISOString().slice(0,10)}.zip`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(u), 6000);
    aviso(`ZIP listo: ${lista.length} equipos.`);
  }catch(err){
    $('errorPanel').textContent =
      'No se pudo armar el ZIP. Si seleccionaste muchos equipos, hazlo por patio o en tandas.';
  }finally{ boton.disabled = false; }
}

/* ================== avisos ================== */
let avisoT;
function aviso(txt){
  const a = $('aviso'); a.textContent = txt; a.classList.add('visible');
  clearTimeout(avisoT); avisoT = setTimeout(()=>a.classList.remove('visible'), 3400);
}

/* ================== eventos ================== */
$('btnEntrar').onclick = async () => {
  const b = $('btnEntrar'); $('errorEntrar').textContent = ''; b.disabled = true;
  try{
    SESION = await entrar($('email').value.trim(), $('pass').value);
    $('pass').value = '';
    $('pantallaEntrar').hidden = true;
    $('pantallaPanel').hidden = false;
    $('sesion').hidden = false;
    $('quien').textContent = SESION.user?.email || '';
    await cargar();
  }catch(e){
    $('errorEntrar').textContent = 'No se pudo entrar. Revisa tu correo y contraseña.';
  }finally{ b.disabled = false; }
};
$('pass').addEventListener('keydown', e => { if(e.key==='Enter') $('btnEntrar').click(); });
$('salir').onclick = () => { SESION = null; location.reload(); };

$('fPatio').onchange = () => { ELEGIDOS.clear(); cargar(); };
$('fBuscar').addEventListener('input', () => { if(DATOS) pintar(); });
$('fFiltro').onchange = () => { if(DATOS) pintar(); };

$('btnSugerir').onclick = async ev => {
  ev.currentTarget.disabled = true;
  try{
    const d = await rpc('admin_portadas_sugeridas', {p_patio: $('fPatio').value || null});
    if(d.error) return aviso(d.error);
    await cargar();
    aviso(d.asignadas ? `${d.asignadas} portadas propuestas. Revísalas y cambia las que no te gusten.`
                      : 'Todos los equipos ya tenían portada.');
  }finally{ ev.currentTarget.disabled = false; }
};
$('btnTodos').onclick = () => { visibles().forEach(e => ELEGIDOS.add(e.id)); pintar(); };
$('btnNada').onclick  = () => { ELEGIDOS.clear(); pintar(); };
$('btnZip').onclick   = ev => exportar(ev.currentTarget);
