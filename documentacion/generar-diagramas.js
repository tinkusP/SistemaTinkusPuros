const fs = require('node:fs');
const path = require('node:path');

const OUT = __dirname;
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function diagram(name, width, height, build) {
  const cells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>',
  ];
  const api = {
    box(id, title, fields, x, y, w, color = '#2563eb') {
      const h = 32 + fields.length * 18;
      const html = `<div style="font-size:13px;font-weight:bold;color:#fff;padding:2px 4px">${title}</div>` +
        `<div style="font-size:10px;line-height:18px;color:#dbeafe;padding:4px 7px;text-align:left">${fields.join('<br>')}</div>`;
      const value = esc(html);
      cells.push(`<mxCell id="${id}" value="${value}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#111827;strokeColor=${color};strokeWidth=2;verticalAlign=top;align=center;spacing=0;shadow=0;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
      return { id, x, y, w, h };
    },
    node(id, label, x, y, w, h, kind = 'process') {
      const styles = {
        start: 'ellipse;fillColor=#166534;strokeColor=#4ade80;fontColor=#fff;',
        end: 'ellipse;fillColor=#991b1b;strokeColor=#f87171;fontColor=#fff;',
        decision: 'rhombus;fillColor=#78350f;strokeColor=#fbbf24;fontColor=#fff;',
        process: 'rounded=1;arcSize=8;fillColor=#172554;strokeColor=#60a5fa;fontColor=#fff;',
        admin: 'rounded=1;arcSize=8;fillColor=#3f1d2e;strokeColor=#fb7185;fontColor=#fff;',
        data: 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;fillColor=#164e63;strokeColor=#22d3ee;fontColor=#fff;',
      };
      cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${styles[kind]}whiteSpace=wrap;html=1;fontSize=12;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    },
    label(id, value, x, y, w, h, size = 18, color = '#f8fafc') {
      cells.push(`<mxCell id="${id}" value="${esc(value)}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontColor=${color};fontSize=${size};fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    },
    edge(id, from, to, label = '', dashed = false) {
      cells.push(`<mxCell id="${id}" value="${esc(label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#cbd5e1;strokeWidth=1.5;endArrow=block;endFill=1;fontColor=#fde047;fontSize=10;labelBackgroundColor=#0b1017;${dashed ? 'dashed=1;' : ''}" edge="1" parent="1" source="${from}" target="${to}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
    },
  };
  build(api);
  const xml = `<mxfile host="app.diagrams.net" agent="Codex" version="24.7.17"><diagram id="${name}" name="${name}"><mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" background="#0b1017" math="0" shadow="0"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`;
  fs.writeFileSync(path.join(OUT, `${name}.drawio`), xml);
}

diagram('diagrama-entidad-relacion-actual', 2100, 1420, (d) => {
  d.label('title', 'DIAGRAMA ENTIDAD-RELACION ACTUAL - TINKUS PUROS Y NATURALES', 330, 15, 1440, 35, 22, '#fbbf24');
  d.label('sub', 'MongoDB / Mongoose - construido desde backend/src/models', 560, 50, 980, 25, 12, '#94a3b8');

  d.box('rol', 'ROL', ['PK _id', 'UQ codigo', 'nombre', 'permisos[]', 'estado'], 30, 110, 210, '#ef4444');
  d.box('perfil', 'PERFIL_USUARIO', ['PK _id', 'FK roles[]', 'FK gestion[]', 'UQ ci / email', 'datos personales', 'tipoOrigen / tipoFraterno', 'estado / seguridad', 'credencialQrVersion'], 300, 100, 250, '#ef4444');
  d.box('doc', 'DOCUMENTO_USUARIO', ['PK _id', 'FK perfilUsuario', 'tipoDocumento', 'ruta', 'estado / observacion'], 610, 100, 230, '#ef4444');
  d.box('auth', 'AUTORIZACION_EDICION_PERFIL', ['PK _id', 'FK perfilUsuarioId', 'FK administradorId', 'campos[] / motivo', 'estado / vencimiento'], 610, 245, 250, '#ef4444');
  d.box('gestion', 'GESTION', ['PK _id', 'UQ anio (activa)', 'fechas / inscripciones', 'cupos H / M / total', 'estado'], 30, 300, 230, '#ef4444');

  d.box('pre', 'PREREGISTRO', ['PK _id', 'FK usuarioId', 'FK gestionId', 'UQ numeroPreRegistro', 'estado / reglamento', 'examen1..6 / promedio', 'puntajeTotal / aprobado'], 310, 410, 250, '#3b82f6');
  d.box('conf', 'CONFIGURACION_PAGO', ['PK _id', 'FK/UQ gestionId', 'QR total / cuotas', 'terminos / version', 'activo'], 30, 525, 230, '#84cc16');
  d.box('acep', 'ACEPTACION_TERMINOS_PAGO', ['PK _id', 'FK usuarioId', 'FK gestionId', 'versionTerminos', 'fechaAceptacion / ip'], 30, 680, 250, '#84cc16');
  d.box('cuota', 'CUOTA', ['PK _id', 'FK/UQ preregistroId', 'tarifa / montoTotal', 'montoPagado / saldo', 'estado / vencimiento'], 620, 430, 230, '#84cc16');
  d.box('detcuota', 'DETALLE_CUOTA', ['PK _id', 'FK cuotaId', 'UQ numeroPago por cuota', 'método / montos', 'baucher / pagador', 'estadoRevision'], 930, 420, 240, '#84cc16');
  d.box('traspaso', 'TRASPASO', ['PK _id', 'FK preregistroId', 'FK usuarioOrigenId', 'FK usuarioDestinoId', 'FK cuotaId (opcional)', 'montos / motivo / estado'], 930, 650, 240, '#3b82f6');

  d.box('post', 'POSTULANTE_GUIA', ['PK _id', 'FK/UQ preregistroId', 'estado / habilitado', 'puntajes', 'organización / evaluación'], 310, 710, 250, '#06b6d4');
  d.box('merito', 'MERITO_GUIA', ['PK _id', 'FK postulanteGuiaId', 'tipo / título', 'puntos / verificado'], 620, 730, 230, '#06b6d4');
  d.box('guia', 'GUIA', ['PK _id', 'FK/UQ postulanteGuiaId', 'FK/UQ preregistroId', 'FK usuarioId', 'FK gestionId', 'estado'], 310, 950, 250, '#06b6d4');
  d.box('fraterno', 'FRATERNO', ['PK _id', 'FK/UQ preregistroId', 'FK usuarioId', 'FK gestionId', 'UQ numeroFraterno', 'estado'], 620, 950, 230, '#06b6d4');
  d.box('bloque', 'BLOQUE', ['PK _id', 'FK guiaId principal', 'FK guiasIds[] (máx. 4)', 'FK gestionId', 'capacidad H / M', 'estado'], 310, 1170, 250, '#06b6d4');
  d.box('detallebloque', 'DETALLE_BLOQUE', ['PK _id', 'FK bloqueId', 'FK/UQ fraternoId', 'género / fila / columna'], 620, 1190, 230, '#06b6d4');

  d.box('asistencia', 'ASISTENCIA', ['PK _id', 'FK usuarioId / gestionId', 'FK fraternoId (opcional)', 'FK preregistroId (opcional)', 'FK postulanteGuiaId (opcional)', 'fechaClave / entrada / salida', 'estado / método'], 1230, 100, 260, '#a855f7');
  d.box('talla', 'TALLA_FRATERNO', ['PK _id', 'FK/UQ fraternoId', 'tallaPolera', 'tallaChamarra'], 1230, 390, 220, '#f59e0b');
  d.box('prenda', 'PRENDA_INDUMENTARIA', ['PK _id', 'UQ nombre', 'requiereTalla', 'activo'], 1230, 590, 220, '#f59e0b');
  d.box('entrega', 'ENTREGA_INDUMENTARIA', ['PK _id', 'FK fraternoId', 'FK prendaId', 'cantidad / talla', 'estadoEntrega / estado', 'responsables / fechas'], 1530, 460, 250, '#f59e0b');

  d.box('anuncio', 'ANUNCIO', ['PK _id', 'tipo / destinatario', 'publicado / afiche', 'evento / expiración', 'FK usuarioCreador/editor'], 1230, 830, 230, '#ec4899');
  d.box('notif', 'NOTIFICACION', ['PK _id', 'FK usuarioId', 'FK anuncioId (opcional)', 'mensaje / tipo', 'leída / enlace'], 1530, 830, 230, '#ec4899');
  d.box('video', 'PASO_VIDEO', ['PK _id', 'categoría PASO/CANCION', 'fuente archivo/YouTube', 'FK usuarioAutorId', 'publicado'], 1230, 1080, 230, '#ec4899');
  d.box('audit', 'AUDITORIA', ['PK _id', 'FK usuarioId (opcional)', 'acción / módulo / entidad', 'antes / después', 'ruta / IP / fecha'], 1530, 1080, 230, '#ec4899');

  const edges = [
    ['e1','rol','perfil','N : N (roles[])'], ['e2','gestion','perfil','N : N (gestion[])'], ['e3','perfil','doc','1 : N'], ['e4','perfil','auth','1 : N'],
    ['e5','perfil','pre','1 : N'], ['e6','gestion','pre','1 : N'], ['e7','gestion','conf','1 : 0..1'], ['e8','perfil','acep','1 : N'], ['e9','gestion','acep','1 : N'],
    ['e10','pre','cuota','1 : 0..1'], ['e11','cuota','detcuota','1 : N'], ['e12','pre','traspaso','1 : N'], ['e13','pre','post','1 : 0..1'],
    ['e14','post','merito','1 : N'], ['e15','post','guia','1 : 0..1'], ['e16','pre','guia','1 : 0..1'], ['e17','pre','fraterno','1 : 0..1'],
    ['e18','guia','bloque','1 : 0..1 / N:N guías'], ['e19','bloque','detallebloque','1 : N'], ['e20','fraterno','detallebloque','1 : 0..1'],
    ['e21','perfil','asistencia','1 : N'], ['e22','gestion','asistencia','1 : N'], ['e23','fraterno','asistencia','1 : N'], ['e24','post','asistencia','1 : N'],
    ['e25','fraterno','talla','1 : 0..1'], ['e26','fraterno','entrega','1 : N'], ['e27','prenda','entrega','1 : N'],
    ['e28','anuncio','notif','1 : N'], ['e29','perfil','notif','1 : N'], ['e30','perfil','anuncio','1 : N'], ['e31','perfil','video','1 : N'], ['e32','perfil','audit','1 : N'],
    ['e33','cuota','traspaso','0..1 : N']
  ];
  edges.forEach((e) => d.edge(...e));
  d.label('legend', 'PK = clave primaria | FK = referencia ObjectId | UQ = índice único | 0..1 = opcional', 1180, 1360, 700, 25, 11, '#fde047');
});

diagram('flujo-procesos-actual', 1900, 1280, (d) => {
  d.label('title', 'FLUJO DE PROCESOS ACTUAL - TINKUS PUROS Y NATURALES', 350, 15, 1200, 35, 22, '#fbbf24');
  d.label('u', 'POSTULANTE / FRATERNO', 30, 75, 500, 30, 15, '#60a5fa');
  d.label('a', 'ADMINISTRACION', 690, 75, 500, 30, 15, '#fb7185');
  d.label('g', 'GUIA Y OPERACION', 1350, 75, 500, 30, 15, '#22d3ee');
  d.node('inicio','Inicio',190,120,130,55,'start');
  d.node('cuenta','Crear cuenta\ny completar perfil',145,210,220,65);
  d.node('docs','Cargar foto, CI y RU\nsegún tipo de origen',145,315,220,65);
  d.node('login','Iniciar sesión\ny cambiar contraseña si corresponde',145,420,220,70);
  d.node('pre','Crear preregistro\nen gestión abierta',145,535,220,65);
  d.node('terminos','Aceptar términos de pago\ny consultar QR',145,640,220,65);
  d.node('pago','Registrar pago\n(efectivo, QR o mixto)',145,745,220,65);
  d.node('estado','Consultar estado, pagos,\nnotificaciones y comunicados',145,850,220,70);

  d.node('gestion','Configurar gestión, fechas,\ncupos, tarifas, QR y términos',800,120,260,75,'admin');
  d.node('validar','Validar perfil y documentos',800,245,260,65,'admin');
  d.node('revisarpre','Revisar preregistro, notas\ny disponibilidad de cupo',800,350,260,70,'admin');
  d.node('aprobado','¿Preregistro aprobado?',825,465,210,105,'decision');
  d.node('espera','Observar, rechazar o\nenviar a lista de espera',755,620,230,65,'admin');
  d.node('revisarpago','Revisar comprobante\ny verificar pago',1030,620,230,65,'admin');
  d.node('tipo','¿Designación final?',825,740,210,105,'decision');
  d.node('fraterno','Crear FRATERNO',720,900,210,60,'data');
  d.node('postguia','Habilitar POSTULANTE_GUIA\ny evaluar méritos',990,885,250,75,'admin');
  d.node('decisionguia','¿Elegido como guía?',1010,1010,210,105,'decision');
  d.node('guia','Crear GUIA',1045,1160,140,55,'data');

  d.node('bloque','Guía crea/configura bloque\ny agrega hasta 4 guías',1450,155,250,70);
  d.node('posiciones','Asignar fraternos a\nfila y columna por género',1450,270,250,70);
  d.node('asistencia','Registrar entrada/salida\npor portal, administración o QR',1450,390,250,75);
  d.node('indumentaria','Registrar tallas y entrega /\ndevolución de indumentaria',1450,515,250,75);
  d.node('contenido','Publicar pasos, canciones,\nanuncios y notificaciones',1450,640,250,75);
  d.node('traspaso','Solicitar/procesar traspaso\nde cupo y saldo',1450,765,250,70);
  d.node('reportes','Consultar reportes, facultades\ny auditoría de actividad',1450,885,250,75,'admin');
  d.node('fin','Operación y seguimiento\ndurante la gestión',1465,1040,220,70,'end');

  [
    ['e1','inicio','cuenta'],['e2','cuenta','docs'],['e3','docs','login'],['e4','login','pre'],['e5','pre','terminos'],['e6','terminos','pago'],['e7','pago','estado'],
    ['e8','gestion','validar'],['e9','docs','validar','envía datos'],['e10','validar','revisarpre'],['e11','pre','revisarpre'],['e12','revisarpre','aprobado'],
    ['e13','aprobado','espera','NO'],['e14','aprobado','revisarpago','SÍ'],['e15','pago','revisarpago'],['e16','revisarpago','tipo'],
    ['e17','tipo','fraterno','FRATERNO'],['e18','tipo','postguia','POSTULANTE A GUÍA'],['e19','postguia','decisionguia'],['e20','decisionguia','guia','SÍ'],['e21','decisionguia','fraterno','NO'],
    ['e22','guia','bloque'],['e23','fraterno','posiciones'],['e24','bloque','posiciones'],['e25','posiciones','asistencia'],['e26','asistencia','indumentaria'],
    ['e27','indumentaria','contenido'],['e28','contenido','traspaso'],['e29','traspaso','reportes'],['e30','reportes','fin'],['e31','estado','fin','seguimiento',true]
  ].forEach((e) => d.edge(...e));
  d.label('legend','Azul: usuario | Rosa: administración | Cian: guía/operación | Los estados pueden continuar en paralelo durante la gestión',360,1230,1180,25,11,'#cbd5e1');
});

console.log('Diagramas draw.io generados en', OUT);
