import { auth } from './auth'
import { api as localApi } from './db'
import { cloudApi } from './cloudApi'

export function getApi() {
  if (auth.isLoggedIn.value) return cloudApi
  return localApi
}
