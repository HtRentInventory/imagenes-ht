/* Imágenes HT — admin.js. El marcado se inyecta aquí para que la
   cáscara HTML nunca tenga que cambiar. */

document.getElementById('app').innerHTML = `
<header class="topbar">
  <div class="topbar-in">
    <div class="marca"><b>Imágenes <em>HT</em></b><span>Administración</span></div>
    <div class="sesion" id="sesion" hidden>
      <span id="quien"></span>
      <button class="salir" id="salir">Cerrar sesión</button>
    </div>
  </div>
  <div class="cinta" aria-hidden="true"></div>
</header>

<main>
  <!-- entrar -->
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

  <!-- panel -->
  <section id="pantallaPanel" hidden>
    <h1>Ligas publicadas</h1>
    <div class="sub" id="resumen"></div>

    <div class="caja">
      <h2>Nueva liga</h2>
      <p class="nota">Una liga permanente incluye todos los levantamientos y se actualiza sola conforme subes patios y cargas nuevas. Una liga de un levantamiento se queda congelada en ese corte.</p>
      <div class="campos">
        <div class="campo">
          <label for="fAlcance">Qué publica</label>
          <select id="fAlcance">
            <option value="permanente">Todo, y se actualiza solo</option>
            <option value="levantamiento">Un levantamiento fijo</option>
          </select>
        </div>
        <div class="campo" id="cajaLev" hidden>
          <label for="fLev">Levantamiento</label>
          <select id="fLev"></select>
        </div>
        <div class="campo">
          <label for="fPatio">Patio</label>
          <select id="fPatio"><option value="">Todos los patios</option></select>
        </div>
        <div class="campo">
          <label for="fTitulo">Título que verá quien la abra</label>
          <input id="fTitulo" type="text" placeholder="Ej. Patio JJ — agosto 2026">
        </div>
        <div class="campo">
          <label for="fExpira">Vence el (opcional)</label>
          <input id="fExpira" type="date">
        </div>
      </div>
      <label class="check"><input id="fPend" type="checkbox"> Incluir también equipos pendientes de revisar</label>
      <div style="margin-top:18px"><button class="btn btn-lleno" id="btnCrear">Crear liga</button></div>
      <div class="error" id="errorCrear"></div>
    </div>

    <div id="listaLigas"></div>
  </section>
</main>

<div class="aviso" id="aviso" role="status" aria-live="polite"></div>
`;

const SB_URL = 'https://myfmstaeilegsoobllni.supabase.co';
const SB_KEY = 'sb_publishable_9H_QYw9zDv1FO1mVLvgmCw_OSWHuERz';
const BASE   = location.href.replace(/admin\.html.*$/,'').replace(/\?.*$/,'');

const $ = id => document.getElementById(id);
let SESION = null, TABLERO = null;

/* ---------- API ---------- */
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

/* ---------- pantallas ---------- */
function mostrarPanel(){
  $('pantallaEntrar').hidden = true;
  $('pantallaPanel').hidden = false;
  $('sesion').hidden = false;
  $('quien').textContent = SESION.user?.email || '';
}
async function cargarTablero(){
  $('listaLigas').innerHTML = `<div class="estado"><span class="cargando"></span><b>Cargando</b>Trayendo tus ligas.</div>`;
  const d = await rpc('admin_tablero');
  if(d.error){
    $('listaLigas').innerHTML = `<div class="estado"><b>Sin acceso</b>${d.error}</div>`;
    return;
  }
  TABLERO = d;
  $('fLev').innerHTML = d.levantamientos.map(l =>
    `<option value="${l.id}">${l.fecha} — ${l.nombre} (${l.equipos} equipos)</option>`).join('');
  $('fPatio').innerHTML = '<option value="">Todos los patios</option>' +
    d.patios.map(p => `<option value="${p}">${p}</option>`).join('');
  const vivas = d.ligas.filter(l=>l.activo).length;
  $('resumen').textContent =
    `${d.ligas.length} ligas · ${vivas} activas · ${d.levantamientos.length} levantamientos`;
  pintarLigas();
}
function ligaURL(t){ return `${BASE}?t=${t}`; }
function pintarLigas(){
  if(!TABLERO.ligas.length){
    $('listaLigas').innerHTML = `<div class="estado"><b>Todavía no hay ligas</b>Crea la primera arriba.</div>`;
    return;
  }
  $('listaLigas').innerHTML = TABLERO.ligas.map(l => `
    <div class="liga ${l.activo?'':'apagada'}">
      <div class="liga-cab">
        <div>
          <p class="liga-tit">${l.titulo || 'Sin título'}</p>
          <div class="liga-meta">
            ${l.alcance==='permanente' ? 'Se actualiza solo' : 'Levantamiento: '+(l.levantamiento||'—')}
            · ${l.patio || 'Todos los patios'}
            ${l.expira ? ' · vence '+l.expira : ''}
            ${l.incluir_pendientes ? ' · incluye pendientes' : ''}
          </div>
        </div>
        <span class="sello ${l.activo?'viva':''}">${l.activo?'Activa':'Apagada'}</span>
      </div>
      <div class="url"><code>${ligaURL(l.token)}</code>
        <button class="btn-min" data-copiar="${l.token}">Copiar</button></div>
      <div class="liga-acc">
        <button class="btn-min" data-abrir="${l.token}">Abrir</button>
        <button class="btn-min" data-estado="${l.token}" data-valor="${l.activo?'0':'1'}">
          ${l.activo?'Apagar':'Encender'}</button>
        <button class="btn-min peligro" data-borrar="${l.token}">Borrar</button>
      </div>
    </div>`).join('');

  $('listaLigas').querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => {
    navigator.clipboard?.writeText(ligaURL(b.dataset.copiar)); aviso('Liga copiada.');
  });
  $('listaLigas').querySelectorAll('[data-abrir]').forEach(b => b.onclick = () =>
    window.open(ligaURL(b.dataset.abrir), '_blank'));
  $('listaLigas').querySelectorAll('[data-estado]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    await rpc('admin_liga_estado', {p_token:b.dataset.estado, p_activo: b.dataset.valor==='1'});
    await cargarTablero(); aviso('Liga actualizada.');
  });
  $('listaLigas').querySelectorAll('[data-borrar]').forEach(b => b.onclick = async () => {
    if(!confirm('Esta liga dejará de abrir para todos los que la tengan. ¿Borrarla?')) return;
    b.disabled = true;
    await rpc('admin_borrar_liga', {p_token:b.dataset.borrar});
    await cargarTablero(); aviso('Liga borrada.');
  });
}

/* ---------- eventos ---------- */
$('fAlcance').onchange = ev => { $('cajaLev').hidden = ev.target.value !== 'levantamiento'; };

$('btnEntrar').onclick = async () => {
  const b = $('btnEntrar'); $('errorEntrar').textContent = ''; b.disabled = true;
  try{
    SESION = await entrar($('email').value.trim(), $('pass').value);
    $('pass').value = '';
    mostrarPanel();
    await cargarTablero();
  }catch(e){
    $('errorEntrar').textContent = 'No se pudo entrar. Revisa tu correo y contraseña.';
  }finally{ b.disabled = false; }
};
$('pass').addEventListener('keydown', e => { if(e.key==='Enter') $('btnEntrar').click(); });

$('salir').onclick = () => { SESION = null; TABLERO = null; location.reload(); };

$('btnCrear').onclick = async () => {
  const b = $('btnCrear'); $('errorCrear').textContent = ''; b.disabled = true;
  try{
    const alcance = $('fAlcance').value;
    const d = await rpc('admin_crear_liga', {
      p_alcance: alcance,
      p_levantamiento_id: alcance==='levantamiento' ? $('fLev').value : null,
      p_patio: $('fPatio').value || null,
      p_titulo: $('fTitulo').value.trim() || null,
      p_incluir_pendientes: $('fPend').checked,
      p_expira: $('fExpira').value || null
    });
    if(d.error){ $('errorCrear').textContent = d.error; return; }
    $('fTitulo').value = ''; $('fExpira').value = ''; $('fPend').checked = false;
    await cargarTablero();
    navigator.clipboard?.writeText(ligaURL(d.token));
    aviso('Liga creada y copiada al portapapeles.');
  }catch(e){
    $('errorCrear').textContent = 'No se pudo crear la liga. Intenta de nuevo.';
  }finally{ b.disabled = false; }
};

let avisoT;
function aviso(txt){
  const a = $('aviso'); a.textContent = txt; a.classList.add('visible');
  clearTimeout(avisoT); avisoT = setTimeout(()=>a.classList.remove('visible'), 3200);
}
