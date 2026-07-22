import { WechatAuthService } from '../services/wechat-auth-service'
import { CloudWorkoutRepository } from './cloud-workout-repository'
import { LocalWorkoutRepository } from './local-workout-repository'
import { SyncWorkoutRepository } from './sync-workout-repository'

const authService = new WechatAuthService()
const workoutRepository = new SyncWorkoutRepository(
  new LocalWorkoutRepository(),
  new CloudWorkoutRepository(),
  () => authService.hasLocalSession(),
)

export function getWorkoutRepository(): SyncWorkoutRepository { return workoutRepository }
