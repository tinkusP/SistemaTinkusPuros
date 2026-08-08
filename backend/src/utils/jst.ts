// import jwt from 'jsonwebtoken'

// type UsuarioPayload = {
//   id: string
//   name: string
// }

// export const generateJWT = (payload: UsuarioPayload) => {
//   const jwtSecret = process.env.JWT_SECRET

//   if (!jwtSecret) {
//     throw new Error('JWT_SECRET no está definido')
//   }

//   const tokenjwt = jwt.sign(payload, jwtSecret, {
//     expiresIn: '180d'
//   })

//   return tokenjwt
// }
import jwt from "jsonwebtoken";

type UsuarioPayload = {
  id: string;
  name: string;
};

export const generateJWT = (
  payload: UsuarioPayload,
) => {
  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      "JWT_SECRET no está definido",
    );
  }

  const tokenjwt = jwt.sign(
    payload,
    jwtSecret,
    {
      expiresIn: "180d",
    },
  );

  return tokenjwt;
};