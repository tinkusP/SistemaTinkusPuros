import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { cambiarEntrega, entregarRopa, obtenerEntregaRopaUsuario } from "@/api/IndumentariaApi";

export default function EntregaRopaTarjeta({usuarioId,puedeEntregar}:{usuarioId:string;puedeEntregar:boolean}) {
  const qc=useQueryClient(),q=useQuery({queryKey:["entrega-ropa",usuarioId],queryFn:()=>obtenerEntregaRopaUsuario(usuarioId)});
  const [ocupado,setOcupado]=useState(false),lock=useRef(false),p=q.data?.personas[0];
  const operar=async(articulo:"POLERA"|"CHAMARRA")=>{
    if(!p||lock.current)return;const estado=articulo==="POLERA"?p.polera:p.chamarra,talla=articulo==="POLERA"?p.tallaPolera:p.tallaChamarra;
    let motivo="";
    if(estado.entregaId){motivo=prompt(`Motivo de reversión de ${articulo} (mínimo 5 caracteres):`)??"";if(motivo.trim().length<5)return;}
    const falta=!talla||["SIN DEFINIR","SIN REGISTRO"].includes(talla);
    if(!confirm(`${estado.entregaId?"¿Revertir":"¿Confirmar"} entrega de ${articulo} a ${p.nombre}?\nTalla: ${falta?"SIN REGISTRAR — verifica físicamente antes de entregar":talla}${motivo?`\nMotivo: ${motivo}`:""}`))return;
    lock.current=true;setOcupado(true);
    try{const r=estado.entregaId?await cambiarEntrega(estado.entregaId,"DEVUELTO",motivo.trim()):await entregarRopa(p.fraternoId,articulo);toast.success(r.message);}
    catch(e:any){toast.error(e.response?.data?.error??"No se pudo actualizar la entrega");}
    finally{await Promise.all([qc.invalidateQueries({queryKey:["entrega-ropa",usuarioId]}),qc.invalidateQueries({queryKey:["reporte-entrega-ropa"]}),qc.invalidateQueries({queryKey:["mi-indumentaria"]}),qc.invalidateQueries({queryKey:["indumentaria"]})]);lock.current=false;setOcupado(false);}
  };
  return <section className="mt-5 rounded-2xl border bg-slate-50 p-4 text-left"><h3 className="font-black text-[#74122A]">ENTREGA DE INDUMENTARIA</h3>{q.isLoading?<p>Consultando entregas...</p>:q.isError?<p className="text-red-700">No se pudo consultar el estado de entrega.</p>:!p?<p className="mt-2 text-sm">No tiene perfil fraterno activo en la gestión actual. No se crea una inscripción automáticamente.</p>:<><p className="mt-2 text-sm font-bold">Estado financiero: {p.estadoFinanciero} · Plan: {p.plan??"sin plan"} · Pagos verificados: {p.pagosVerificados}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["POLERA","CHAMARRA"] as const).map(a=>{const e=a==="POLERA"?p.polera:p.chamarra,t=a==="POLERA"?p.tallaPolera:p.tallaChamarra,habilitado=a==="POLERA"?p.habilitadoPolera:p.habilitadoChamarra;return <article key={a} className="rounded-xl border bg-white p-3"><h4 className="font-black">{a}</h4><p>Talla: {t&&t!=="SIN DEFINIR"?t:"SIN REGISTRAR"}</p><p className="font-bold">{e.estado}</p>{e.fecha&&<p className="text-xs">{new Date(e.fecha).toLocaleString("es-BO")}<br/>Por: {e.responsable||"Sin registro"}</p>}{puedeEntregar&&<button disabled={ocupado||(!e.entregaId&&!habilitado)} onClick={()=>void operar(a)} className="mt-3 rounded-xl bg-[#74122A] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{e.entregaId?"REVERTIR ENTREGA":"MARCAR COMO ENTREGADA"}</button>}{!e.entregaId&&!habilitado&&<p className="mt-2 text-xs text-amber-800">No cumple los requisitos de entrega configurados o la cuenta está inactiva.</p>}</article>})}</div><p className="mt-3 font-black">ESTADO GENERAL: {p.estadoGeneral.replaceAll("_"," ")}</p></>}</section>;
}
