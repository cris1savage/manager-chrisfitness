import { redirect } from 'next/navigation';

export default function ClienteRootPage({ params }) {
  redirect(`/clientes/${params.id}/resumen`);
}
