import { useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/session';
import { PaymentScreen } from './PaymentScreen';

export function CheckoutPage() {
  const { listingId = '' } = useParams();
  const [params] = useSearchParams();
  const session = useSession();
  return (
    <Checkout
      key={`${session.identity?.user?.id}:${listingId}`}
      id={listingId}
      params={params}
      userId={session.identity?.user?.id || ''}
    />
  );
}

function Checkout({ id, params, userId }: { id: string; params: URLSearchParams; userId: string }) {
  return <PaymentScreen id={id} params={params} userId={userId} />;
}
