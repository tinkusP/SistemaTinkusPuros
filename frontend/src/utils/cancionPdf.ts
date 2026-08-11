const cargarLogo = async () => {
  try {
    const respuesta = await fetch("/imagenes/tinkus-puros.png");
    const blob = await respuesta.blob();
    return await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(lector.error);
      lector.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
};

export async function descargarLetraPdf(titulo: string, letra: string) {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), cargarLogo()]);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const margen = 20;
  const agregarCabecera = () => {
    pdf.setFillColor(116, 18, 42);
    pdf.rect(0, 0, ancho, 34, "F");
    if (logo) pdf.addImage(logo, "PNG", margen, 5, 24, 24, undefined, "FAST");
    pdf.setTextColor(246, 240, 227);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("TINKUS PUROS Y NATURALES", logo ? 49 : margen, 15);
    pdf.setFontSize(8);
    pdf.setTextColor(233, 207, 145);
    pdf.text("CANCIONERO INSTITUCIONAL", logo ? 49 : margen, 22);
    pdf.setDrawColor(197, 154, 58);
    pdf.setLineWidth(1.2);
    pdf.line(margen, 36, ancho - margen, 36);
  };
  const agregarPie = (pagina: number) => {
    pdf.setDrawColor(197, 154, 58);
    pdf.setLineWidth(0.4);
    pdf.line(margen, alto - 14, ancho - margen, alto - 14);
    pdf.setTextColor(115, 95, 85);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Identidad, fuerza y tradición andina", margen, alto - 8);
    pdf.text(`Página ${pagina}`, ancho - margen, alto - 8, { align: "right" });
  };

  agregarCabecera();
  pdf.setTextColor(116, 18, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  const tituloLineas = pdf.splitTextToSize(titulo, ancho - margen * 2);
  pdf.text(tituloLineas, margen, 50);
  let y = 50 + tituloLineas.length * 8 + 5;
  pdf.setTextColor(38, 32, 34);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setLineHeightFactor(1.55);
  const lineas = pdf.splitTextToSize(letra.trim() || "Letra no disponible.", ancho - margen * 2);
  let pagina = 1;
  for (const linea of lineas) {
    if (y > alto - 24) {
      agregarPie(pagina++);
      pdf.addPage();
      agregarCabecera();
      y = 48;
      pdf.setTextColor(38, 32, 34);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
    }
    pdf.text(linea, margen, y);
    y += 6.2;
  }
  agregarPie(pagina);
  const nombre = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  pdf.save(`Cancion_${nombre || "Tinkus_Puros"}.pdf`);
}
