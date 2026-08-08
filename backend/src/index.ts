import colors from 'colors' 
import server from'./server'
import https from "node:https"
import fs from "node:fs"

const port = process.env.PORT || 4001
const host = process.env.HOST || '0.0.0.0'

const cert=process.env.HTTPS_CERT_PATH,key=process.env.HTTPS_KEY_PATH
const ca=process.env.HTTPS_CA_PATH
if(ca&&fs.existsSync(ca))server.get("/certificado-local.crt",(_req,res)=>res.download(ca,"tinkus-ca.crt"))
if(cert&&key&&fs.existsSync(cert)&&fs.existsSync(key)){
    https.createServer({cert:fs.readFileSync(cert),key:fs.readFileSync(key)},server).listen(Number(port),host,()=>console.log(colors.cyan.bold(`Sistema local HTTPS funcionando en https://${host}:${port}`)))
}else server.listen(Number(port), host, ()=>{
    console.log(colors.cyan.bold(`REST API local funcionando en http://${host}:${port}`))
})
