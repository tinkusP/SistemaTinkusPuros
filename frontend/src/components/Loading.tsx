// src/components/Loading.tsx

import {
  LoaderCircle,
} from "lucide-react";

export default function Loading() {

  return (

    <div
      className="
        flex
        min-h-screen
        items-center
        justify-center
        bg-slate-50
      "
    >

      <div
        className="
          flex
          flex-col
          items-center
          gap-4
        "
      >

        <div
          className="
            flex
            h-24
            w-24
            items-center
            justify-center
            rounded-full
            bg-white
            shadow-xl
          "
        >

          <LoaderCircle
            className="
              h-12
              w-12
              animate-spin
              text-fuchsia-600
            "
          />

        </div>

        <div className="text-center">

          <h2
            className="
              text-xl
              font-bold
              text-slate-800
            "
          >

            Cargando...

          </h2>

          <p className="mt-1 text-slate-500">

            Espere un momento

          </p>

        </div>

      </div>

    </div>

  );

}