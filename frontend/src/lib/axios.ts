import axios from 'axios'
import { obtenerVistaCapacitacion } from '@/utils/modoCapacitacion'


const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL
})


api.interceptors.request.use(config =>{
    const token = localStorage.getItem('AUTH_TOKEN')
    if(token){
        config.headers.Authorization=`Bearer ${token}`
    }
    const vista = obtenerVistaCapacitacion()
    if(vista){
        config.headers['X-Modo-Capacitacion-Usuario']=vista.usuarioId
        config.headers['X-Modo-Capacitacion-Tipo']=vista.tipo
    }
    return config
})
export default api
