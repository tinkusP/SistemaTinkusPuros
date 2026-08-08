import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()
const config = () => {
   return{
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "2525"),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    };
    
}
export const transport = nodemailer.createTransport(config())