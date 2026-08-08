
import { transport } from "../config/nodemailer"

interface IEmail {
    email: string
    name: string
    token: string
}
export class AuthEmail {
    static sendConfirmtionEmail = async (usuario: IEmail) => {
       const info= await transport.sendMail({
            from: 'Chelo <devdjcod@gmail.com>',
            to: usuario.email,
            subject: 'chelo - confirma tu cuenta',
            text: ' Chelo - confirma tu cuenta',
            html: `<p>Hola: ${usuario.name}, has creado tu ceunta en chelo</p>
            <p>Visita el siguiente enlace</p>
            <ahref="${process.env.FRONTEND_URL}/auth/confirmCuenta"> Confirmar cuenta</a>
            <p>E ingresa el codigo <b>${usuario.token}</b></p>
            <p>Este token expira en 10 minutos</p>
            
            
            `
        })
        console.log('Mensaje enviado ', info.messageId)
    }
}