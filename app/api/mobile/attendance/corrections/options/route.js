import { handleMobileHistory } from '@/lib/attendance-points/mobile-history';

export async function GET(request) {
  return handleMobileHistory(request,'options');
}
