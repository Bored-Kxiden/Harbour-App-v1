import { HarborApp } from '@/components/harbor/app'
import { AuthGate } from '@/components/harbour/auth-gate'

/** Nothing renders until Harbour knows whose phone this is: every screen reads
    a meadow that belongs to an account, so there is no signed-out version of
    the app to show behind the gate. */
export default function Page() {
  return (
    <AuthGate>
      <HarborApp/>
    </AuthGate>
  )
}
