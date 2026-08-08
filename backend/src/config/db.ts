import mongoose from "mongoose";
import colors from 'colors'
import { exit } from 'node:process'

export const connectDB = async () => {
    try {
        const connection = await mongoose.connect(process.env.DATABASE_URL, {
            maxPoolSize: 50,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 10000,
            maxIdleTimeMS: 60000,
        })
        const url = `${connection.connection.host}:${connection.connection.port}`
        console.log(colors.cyan.magenta(`MongoDb connnectado en:${url}` ))
    } catch (error) {
        console.log(colors.red.bold(`Error al conectar la BD ${error.message}`))
        exit(1)
    }
}
