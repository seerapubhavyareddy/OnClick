// types/multiple-calendar.d.ts
export interface GoogleAccountData {
  email: string
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  name?: string
  image?: string
  accountId: string
}

export interface GoogleAccountInfo {
  id: string
  email: string
  name?: string | null
  image?: string | null
  isPrimary: boolean
  createdAt: Date
}