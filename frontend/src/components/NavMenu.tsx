import { Fragment } from 'react'
import { Popover, Transition } from '@headlessui/react'
import { Bars3Icon } from '@heroicons/react/20/solid'
import { Link } from 'react-router-dom'
import type { PerfilUsuarioType } from '@/types/PerfilUsuarioType'
import { useQueryClient } from '@tanstack/react-query'

type NavMenuProps={
  name: PerfilUsuarioType['nombres']
  id: PerfilUsuarioType['_id']
}
export default function NavMenu({name,id}: NavMenuProps) {
  const queryClient = useQueryClient()
const logout =()=>{
  localStorage.removeItem('AUTH_TOKEN')
 queryClient.invalidateQueries({queryKey:['usuario']})
}

  return (
    <Popover className="relative">
      <Popover.Button className="inline-flex items-center gap-x-1 text-sm font-semibold leading-6 p-1 rounded-lg bg-purple-400">
        <Bars3Icon className='w-8 h-8 text-white ' />
      </Popover.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <Popover.Panel className="absolute left-1/2 z-10 mt-5 flex w-screen lg:max-w-min -translate-x-1/2 lg:-translate-x-48">
          <div className="w-full lg:w-56 shrink rounded-xl bg-white p-4 text-sm font-semibold leading-6 text-gray-900 shadow-lg ring-1 ring-gray-900/5">
            <p className='text-center'>Hola: {name}</p>
            <Link
              to={`/perfil/${id}`}
              className='block p-2 hover:text-purple-950'
            >Mi Perfil </Link>
            <Link
              to='/'
              className='block p-2 hover:text-purple-950'
            >Inicio</Link>
            <button
              className='block p-2 hover:text-purple-950'
              type='button'
              onClick={logout}
            >
              Cerrar Sesión
            </button>
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  )
}

// import { Fragment } from 'react'
// import { Popover, Transition } from '@headlessui/react'
// import { Bars3Icon } from '@heroicons/react/20/solid'
// import { Link } from 'react-router-dom'
// import { useQueryClient } from '@tanstack/react-query'

// export default function NavMenu() {

//   const queryClient = useQueryClient()

//   const logout = () => {
//     localStorage.removeItem('AUTH_TOKEN')
//     queryClient.invalidateQueries({ queryKey: ['usuario'] })
//   }

//   return (
//     <Popover className="relative">

//       {/* BOTÓN */}
//       <Popover.Button className="
//         inline-flex items-center justify-center
//         p-2 rounded-lg bg-fuchsia-600
//         hover:bg-fuchsia-700
//         transition
//       ">
//         <Bars3Icon className='w-6 h-6 text-white' />
//       </Popover.Button>

//       {/* MENÚ */}
//       <Transition
//         as={Fragment}
//         enter="transition ease-out duration-200"
//         enterFrom="opacity-0 translate-y-2"
//         enterTo="opacity-100 translate-y-0"
//         leave="transition ease-in duration-150"
//         leaveFrom="opacity-100 translate-y-0"
//         leaveTo="opacity-0 translate-y-2"
//       >
//         <Popover.Panel className="
//           absolute right-0 mt-3
//           w-56
//           z-50
//         ">
//           <div className="
//             rounded-xl bg-white shadow-lg
//             ring-1 ring-gray-200
//             p-4
//           ">

//             {/* HEADER */}
//             <p className='text-center text-sm font-semibold text-gray-700 mb-3'>
//               Usuario Demo
//             </p>

//             {/* LINKS */}
//             <div className="flex flex-col gap-1">

//               <Link
//                 to="/perfil"
//                 className='p-2 rounded-md hover:bg-gray-100 transition'
//               >
//                 Mi Perfil
//               </Link>

//               <Link
//                 to="/"
//                 className='p-2 rounded-md hover:bg-gray-100 transition'
//               >
//                 Inicio
//               </Link>

//               <button
//                 className='p-2 text-left rounded-md hover:bg-red-50 text-red-600 transition'
//                 type='button'
//                 onClick={logout}
//               >
//                 Cerrar Sesión
//               </button>

//             </div>

//           </div>
//         </Popover.Panel>
//       </Transition>

//     </Popover>
//   )
// }