import { auth } from './auth'
import { api as localApi } from './db'
import { cloudApi } from './cloudApi'
import { cachedApi } from './cachedApi'

export function getApi() {
  if (auth.isLoggedIn.value) return cloudApi
  return localApi
}

export function getReadApi() {
  if (auth.isLoggedIn.value) return cachedApi
  return localApi
}
