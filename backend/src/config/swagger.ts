import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.2",

    info: {
      title: "REST API Node.js / Express / TypeScript",
      version: "1.0.0",
      description: "API Docs para el sistema de fraternidad",
    },

    servers: [
      {
        url: "http://localhost:4001",
        description: "Servidor local",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },

    tags: [
      {
        name: "Rol",
        description: "Operaciones relacionadas con roles",
      },
      {
        name: "PerfilUsuario",
        description: "Operaciones relacionadas con perfiles de usuario",
      },
       {
        name: "Gestiones",
        description: "Operaciones relacionadas con gestiones",
      },
      {
        name: "Inscripciones",
        description: "Operaciones relacionadas con inscripciones",
      },
    ],
  },

  apis: ["./src/routes/**/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;