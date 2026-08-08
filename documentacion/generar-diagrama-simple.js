const fs = require('node:fs');
const path = require('node:path');

const W = 2400, H = 1500;
const nodes = [
  ['rol','ROL',70,370,190,68,'blue'], ['gestion','GESTION',70,570,190,68,'blue'],
  ['perfil','PERFIL USUARIO',390,460,220,76,'blue'], ['documento','DOCUMENTOS USUARIO',390,680,220,68,'blue'],
  ['autorizacion','AUTORIZACION\nEDICION PERFIL',390,850,220,78,'dark'],
  ['preregistro','PREREGISTRO',760,460,210,68,'blue'], ['cuota','CUOTAS',760,250,210,68,'blue'],
  ['detallecuota','DETALLE CUOTAS',760,90,210,68,'dark'], ['configpago','CONFIGURACION\nDE PAGO',1080,90,220,78,'dark'],
  ['aceptacion','ACEPTACION TERMINOS\nDE PAGO',1080,250,230,78,'dark'],
  ['postulante','POSTULANTES GUIAS',760,700,220,68,'blue'], ['merito','MERITOS GUIA',760,880,210,68,'dark'],
  ['fraterno','FRATERNOS',1130,460,210,68,'blue'], ['traspaso','TRASPASO',1130,620,210,68,'blue'],
  ['guia','GUIAS',1130,800,190,68,'dark'], ['bloque','BLOQUE',1490,800,190,68,'dark'],
  ['detallebloque','DETALLE BLOQUE',1490,980,210,68,'dark'],
  ['asistencia','ASISTENCIA',1490,410,210,68,'blue'], ['talla','TALLAS FRATERNO',1840,250,220,68,'dark'],
  ['prenda','PRENDAS\nINDUMENTARIA',2110,430,220,78,'dark'], ['entrega','ENTREGAS\nINDUMENTARIA',1840,560,220,78,'dark'],
  ['anuncio','ANUNCIOS',320,1190,200,68,'blue'], ['notificacion','NOTIFICACIONES',700,1190,220,68,'blue'],
  ['video','PASOS Y CANCIONES',1110,1190,230,68,'blue'], ['auditoria','AUDITORIA',1510,1190,200,68,'blue'],
];
const edges = [
  ['rol','perfil','N:N'], ['gestion','perfil','N:N'], ['perfil','documento','1:N'], ['perfil','autorizacion','1:N'],
  ['perfil','preregistro','1:N'], ['gestion','preregistro','1:N'], ['preregistro','cuota','1:0..1'],
  ['cuota','detallecuota','1:N'], ['gestion','configpago','1:0..1'], ['perfil','aceptacion','1:N'], ['gestion','aceptacion','1:N'],
  ['preregistro','postulante','1:0..1'], ['postulante','merito','1:N'], ['postulante','guia','1:0..1'],
  ['preregistro','guia','1:0..1'], ['preregistro','fraterno','1:0..1'], ['guia','bloque','N:N'],
  ['bloque','detallebloque','1:N'], ['fraterno','detallebloque','1:0..1'], ['fraterno','asistencia','1:N'],
  ['postulante','asistencia','1:N'], ['preregistro','traspaso','1:N'], ['cuota','traspaso','0..1:N'],
  ['fraterno','talla','1:0..1'], ['fraterno','entrega','1:N'], ['prenda','entrega','1:N'],
  ['perfil','notificacion','1:N'], ['anuncio','notificacion','1:N'], ['perfil','anuncio','1:N'],
  ['perfil','video','1:N'], ['perfil','auditoria','1:N'],
];
const byId = Object.fromEntries(nodes.map(n => [n[0], n]));
const xmlEsc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

const cells = ['<mxCell id="0"/>','<mxCell id="1" parent="0"/>'];
[
  ['zona-identidad','IDENTIDAD Y SEGURIDAD',35,290,620,700,'#7f1d1d'],
  ['zona-admision','ADMISION Y PAGOS',690,45,680,960,'#1e3a8a'],
  ['zona-operacion','GUIAS, BLOQUES Y OPERACION',1410,190,970,900,'#155e75'],
  ['zona-info','COMUNICACION Y CONTROL',250,1110,1540,230,'#581c87'],
].forEach(([id,label,x,y,w,h,color]) => cells.push(`<mxCell id="${id}" value="${label}" style="swimlane;html=1;startSize=34;horizontal=1;rounded=0;fillColor=none;swimlaneFillColor=none;strokeColor=${color};fontColor=#f8fafc;fontStyle=1;fontSize=15;collapsible=0;pointerEvents=0;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`));
nodes.forEach(([id,label,x,y,w,h,type]) => cells.push(`<mxCell id="${id}" value="${xmlEsc(label).replaceAll('\n','&lt;br&gt;')}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=${type === 'blue' ? '#60a5fa' : '#171717'};strokeColor=#e5e7eb;fontColor=${type === 'blue' ? '#10213a' : '#f8fafc'};fontSize=14;strokeWidth=1.5;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`));
const sideUses = new Map();
function side(a,b) { const A=byId[a], B=byId[b], dx=B[2]+B[4]/2-(A[2]+A[4]/2), dy=B[3]+B[5]/2-(A[3]+A[5]/2); return Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'bottom':'top'); }
edges.forEach(([a,b]) => { for (const [n,s] of [[a,side(a,b)],[b,side(b,a)]]) { const k=`${n}:${s}`; sideUses.set(k,(sideUses.get(k)||0)+1); } });
const sideIndex = new Map();
function port(n,s) { const k=`${n}:${s}`, i=sideIndex.get(k)||0, total=sideUses.get(k)||1; sideIndex.set(k,i+1); const p=(i+1)/(total+1); return s==='right'?[1,p]:s==='left'?[0,p]:s==='bottom'?[p,1]:[p,0]; }
edges.forEach(([from,to,label],i) => {
  const ss=side(from,to), ts=side(to,from), [ex,ey]=port(from,ss), [ix,iy]=port(to,ts);
  const muted=['anuncio','notificacion','video','auditoria'].includes(from)||['anuncio','notificacion','video','auditoria'].includes(to);
  cells.push(`<mxCell id="e${i}" value="${label}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=${24+(i%4)*9};html=1;strokeColor=${muted?'#a78bfa':'#e5e7eb'};strokeWidth=1.4;endArrow=ERmany;startArrow=ERone;endFill=0;startFill=0;fontColor=#facc15;fontSize=10;labelBackgroundColor=#111827;exitX=${ex};exitY=${ey};exitDx=0;exitDy=0;entryX=${ix};entryY=${iy};entryDx=0;entryDy=0;${muted?'dashed=1;':''}" edge="1" parent="1" source="${from}" target="${to}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
});
cells.push(`<mxCell id="titulo" value="BASE DE DATOS ACTUAL DEL SISTEMA TINKUS" style="text;html=1;strokeColor=none;fillColor=none;align=center;fontColor=#f8fafc;fontSize=24;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="650" y="5" width="1100" height="40" as="geometry"/></mxCell>`);
const drawio = `<mxfile host="app.diagrams.net" agent="Codex"><diagram id="modelo-simple" name="Base de datos actual"><mxGraphModel grid="1" gridSize="10" page="1" pageWidth="${W}" pageHeight="${H}" background="#111315"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`;
fs.writeFileSync(path.join(__dirname,'diagrama-base-datos-modelo-simple.drawio'), drawio);

function svgPort(n, toward) {
  const [, , x,y,w,h] = n, [, , tx,ty,tw,th] = toward;
  const cx=x+w/2, cy=y+h/2, tcx=tx+tw/2, tcy=ty+th/2;
  if (Math.abs(tcx-cx) > Math.abs(tcy-cy)) return tcx > cx ? [x+w,cy] : [x,cy];
  return tcy > cy ? [cx,y+h] : [cx,y];
}
const svgEdges = edges.map(([a,b,label]) => {
  const [x1,y1]=svgPort(byId[a],byId[b]), [x2,y2]=svgPort(byId[b],byId[a]);
  const horizontal=Math.abs(x2-x1)>Math.abs(y2-y1);
  const d=horizontal ? `M${x1},${y1} H${(x1+x2)/2} V${y2} H${x2}` : `M${x1},${y1} V${(y1+y2)/2} H${x2} V${y2}`;
  return `<path d="${d}"/><text x="${(x1+x2)/2+5}" y="${(y1+y2)/2-5}">${label}</text>`;
}).join('');
const svgNodes = nodes.map(([,label,x,y,w,h,type]) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" class="${type}"/>${label.split('\n').map((line,i,all)=>`<text x="${x+w/2}" y="${y+h/2+(i-(all.length-1)/2)*18+5}" class="nodeText">${line}</text>`).join('')}</g>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><pattern id="small" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#25292d" stroke-width="1"/></pattern><pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="url(#small)"/><path d="M80 0H0V80" fill="none" stroke="#343a40" stroke-width="1.2"/></pattern></defs><rect width="100%" height="100%" fill="#111315"/><rect width="100%" height="100%" fill="url(#grid)"/><style>path{fill:none;stroke:#e5e7eb;stroke-width:1.5}.blue{fill:#69aaf3;stroke:#e5e7eb;stroke-width:1.5}.dark{fill:#181818;stroke:#e5e7eb;stroke-width:1.5}.nodeText{fill:#f8fafc;font:14px Arial,sans-serif;text-anchor:middle}.blue+text,.blue~text{fill:#122033}text{fill:#facc15;font:10px Arial,sans-serif}.title{fill:#f8fafc;font:bold 25px Arial,sans-serif;text-anchor:middle}.sub{fill:#94a3b8;font:13px Arial,sans-serif;text-anchor:middle}</style><text x="${W/2}" y="48" class="title">BASE DE DATOS ACTUAL DEL SISTEMA TINKUS</text><text x="${W/2}" y="73" class="sub">Colecciones MongoDB y relaciones implementadas</text><g>${svgEdges}</g><g>${svgNodes}</g><text x="${W/2}" y="${H-35}" class="sub">1:N = uno a muchos   |   N:N = muchos a muchos   |   0..1 = relación opcional</text></svg>`;
fs.writeFileSync(path.join(__dirname,'diagrama-base-datos-modelo-simple.svg'), svg);
console.log('Diagrama conceptual simple generado.');
