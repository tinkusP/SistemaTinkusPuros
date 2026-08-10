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
Me comprometo a mantener una conducta respetuosa y responsable con todos los integrantes de la Fraternidad, especialmente con los guías, responsables, compañeros y miembros de la Directiva. No se tolerarán agresiones físicas o verbales, faltas de respeto, discriminación, acoso, amenazas, actos de violencia ni comportamientos que perjudiquen la convivencia o la imagen de la Fraternidad.

6. Respeto, puntualidad y tolerancia
Acepto mantener principios de respeto, puntualidad, tolerancia, compañerismo y disciplina durante los ensayos y actividades organizadas por la Fraternidad.

7. Cuotas y gastos realizados
Entiendo que las cuotas realizadas por los participantes podrán destinarse a cubrir gastos relacionados con la organización y participación de la Fraternidad, incluyendo contratación de banda, vestimenta, materiales, transporte, refrigerios, espacios de ensayo, logística, trámites y demás gastos previamente realizados o comprometidos.

8. Suspensión o no realización de la Entrada Universitaria
En caso de que la Entrada Universitaria u otra actividad principal no pudiera realizarse por motivos ajenos a la Fraternidad, entiendo y acepto que los gastos ya realizados, pagados o comprometidos serán descontados de las cuotas aportadas. Cualquier devolución, saldo disponible o determinación sobre los recursos restantes estará sujeta al detalle de los gastos efectivamente realizados y a las decisiones administrativas correspondientes de la Fraternidad.

9. Uso personal del código QR de pago
El código QR proporcionado para realizar pagos es de uso personal y deberá utilizarse únicamente para pagos correspondientes a personas previamente registradas y habilitadas en el sistema de la Fraternidad.

10. Prohibición de compartir el QR con personas no habilitadas
Me comprometo a no compartir el código QR de pago con personas que no se encuentren registradas o habilitadas en el sistema. Realizar un pago mediante el QR no otorga automáticamente el derecho a participar, bailar o formar parte de la Fraternidad.

11. Pagos realizados por personas no registradas o no autorizadas
Si una persona no registrada, habilitada o autorizada realiza un pago utilizando un QR compartido por otro participante, dicho pago no será considerado inscripción, cuota ni autorización para participar. La persona no podrá exigir su participación argumentando únicamente haber realizado un pago, pues previamente debía estar registrada y habilitada en el sistema.

12. Destino de pagos no identificados o no autorizados
Los pagos de personas no registradas, no habilitadas o que no puedan identificarse correctamente en el sistema podrán considerarse aporte voluntario o donación a favor de la Fraternidad, siempre que no exista una obligación legal de devolución o una determinación diferente de la administración.

13. Validación de pagos
Todo pago deberá ser correctamente identificado, registrado y posteriormente validado por los responsables designados por la Fraternidad. La presentación de un comprobante por sí sola no reemplaza el proceso de inscripción, habilitación y validación correspondiente.

14. Cumplimiento de disposiciones internas
Me comprometo a cumplir las disposiciones, comunicados, reglamentos y decisiones emitidas por la Directiva para garantizar una organización adecuada de los ensayos y actividades.

15. Aceptación
Al seleccionar la opción “Acepto los términos y condiciones”, declaro haber leído, comprendido y aceptado las disposiciones señaladas anteriormente, comprometiéndome a cumplirlas durante mi participación en la Fraternidad Tinkus Puros y Naturales.`;

export const sonTerminosPredeterminadosAnteriores = (texto: string) => {
  const limpio = texto.trim();
  return limpio.startsWith("Al realizar el pago declaro") ||
    limpio.startsWith("Al enviar un pago declaro") ||
    limpio.startsWith("Al aceptar estos términos y condiciones, declaro que:") ||
    limpio.startsWith("Al aceptar estos términos y condiciones, me comprometo a asistir");
};
