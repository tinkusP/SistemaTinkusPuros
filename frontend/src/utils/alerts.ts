import Swal from 'sweetalert2'

export function showSuccessAlert(message: string) {
  Swal.fire({
    icon: 'success',
    title: 'Éxito',
    text: message,
  })
}

export function showErrorAlert(message: string) {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
  })
}

export function showConfirmAlert(message: string): Promise<boolean> {
  return Swal.fire({
    title: '¿Estás seguro?',
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí',
    cancelButtonText: 'Cancelar'
  }).then(result => result.isConfirmed)
}
