
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'

export interface AuthUser {
  id: string | number
  email: string
  firstName: string
  lastName: string
  role: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('accessToken'),
  )

  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem('user')

    if (!savedUser) return null

    try {
      return JSON.parse(savedUser) as AuthUser
    } catch {
      localStorage.removeItem('user')
      localStorage.removeItem('accessToken')
      return null
    }
  })

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('accessToken', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))

    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')

    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
