import CrmSection from '@/components/CrmSection';
import { CRM_CONFIG } from '@/lib/config';

export default function Page() {
  return <CrmSection config={CRM_CONFIG['conversaciones']} />;
}
