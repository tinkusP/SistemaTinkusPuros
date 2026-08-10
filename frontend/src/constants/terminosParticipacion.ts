export const TERMINOS_PARTICIPACION = `TÉRMINOS Y CONDICIONES DE PARTICIPACIÓN

Al registrarme y participar en las actividades de la Fraternidad Tinkus Puros y Naturales, declaro conocer y aceptar voluntariamente los siguientes términos y condiciones:

1. Asistencia a ensayos
Me comprometo a asistir regularmente a los ensayos programados por la Fraternidad, respetando los días, horarios y lugares establecidos por la organización.

2. Puntualidad y responsabilidad
Me comprometo a asistir puntualmente a los ensayos, reuniones, presentaciones y demás actividades convocadas por la Fraternidad, cumpliendo responsablemente las instrucciones proporcionadas por los guías y la Directiva.

3. Prohibición del consumo de bebidas alcohólicas
Me comprometo a no consumir bebidas alcohólicas durante los ensayos ni durante aquellas actividades en las que la Directiva determine que su consumo está prohibido, especialmente cuando pueda afectar la seguridad, disciplina, imagen o normal desarrollo de la actividad.

4. Participación en actividades de la Fraternidad
Me comprometo, dentro de mis posibilidades y de acuerdo con las convocatorias realizadas, a participar en las actividades oficiales, culturales, sociales, institucionales y demás eventos organizados por la Fraternidad.

5. Respeto y buena conducta
Me comprometo a mantener una conducta respetuosa y responsable con todos los integrantes. No se tolerarán agresiones físicas o verbales, faltas de respeto, discriminación, acoso, amenazas, violencia ni comportamientos que perjudiquen la convivencia o la imagen de la Fraternidad.

6. Respeto, puntualidad y tolerancia
Acepto mantener principios de respeto, puntualidad, tolerancia, compañerismo y disciplina durante los ensayos y actividades.

7. Cuotas y gastos realizados
Entiendo que las cuotas podrán destinarse a contratación de banda, vestimenta, materiales, transporte, refrigerios, espacios de ensayo, logística, trámites y demás gastos realizados o comprometidos.

8. Suspensión o no realización de la Entrada Universitaria
Si la Entrada Universitaria u otra actividad principal no pudiera realizarse por motivos ajenos a la Fraternidad, acepto que los gastos realizados, pagados o comprometidos sean descontados de las cuotas aportadas. Cualquier devolución o saldo estará sujeto al detalle de gastos y a las decisiones administrativas correspondientes.

9. Uso personal del código QR de pago
El QR es de uso personal y deberá utilizarse únicamente para pagos de personas previamente registradas y habilitadas en el sistema.

10. Prohibición de compartir el QR con personas no habilitadas
Me comprometo a no compartir el QR con personas no registradas o habilitadas. Realizar un pago no otorga automáticamente el derecho a participar, bailar o formar parte de la Fraternidad.

11. Pagos de personas no registradas o no autorizadas
Un pago realizado por una persona no registrada, habilitada o autorizada no será considerado inscripción, cuota ni autorización para participar. La persona no podrá exigir su participación por el solo hecho de haber pagado.

12. Destino de pagos no identificados o no autorizados
Estos pagos podrán considerarse aporte voluntario o donación a la Fraternidad, salvo obligación legal de devolución o determinación diferente de la administración.

13. Validación de pagos
Todo pago deberá identificarse, registrarse y validarse. Presentar un comprobante no reemplaza la inscripción, habilitación y validación correspondientes.

14. Cumplimiento de disposiciones internas
Me comprometo a cumplir las disposiciones, comunicados, reglamentos y decisiones de la Directiva.

15. Aceptación
Al seleccionar “Acepto los términos y condiciones”, declaro haber leído, comprendido y aceptado estas disposiciones durante mi participación en la Fraternidad Tinkus Puros y Naturales.`;

export const sonTerminosPredeterminadosAnteriores = (texto: string) => {
  const limpio = texto.trim();
  return limpio.startsWith("Al realizar el pago declaro") || limpio.startsWith("Al enviar un pago declaro") || limpio.startsWith("Al aceptar estos términos y condiciones");
};
