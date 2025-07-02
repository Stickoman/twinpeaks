import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function signToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret)
  return payload
}

export function getRole(token: string): string | null {
  try {
    const parts = token.split('.')
    const payload = JSON.parse(atob(parts[1]))
    return payload.role ?? null
  } catch {
    return null
  }
}
