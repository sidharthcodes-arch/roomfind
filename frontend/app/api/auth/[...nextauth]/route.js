import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
            headers: { "Content-Type": "application/json" }
          });
          
          const data = await res.json();
          
          if (res.ok && data.user && data.token) {
            // Return user object including token so it can be saved in session
            return {
              id: data.user.id,
              email: data.user.email,
              role: data.user.role,
              full_name: data.user.full_name,
              profile_photo: data.user.profile_photo,
              accessToken: data.token
            };
          }
          return null;
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.accessToken = token.accessToken;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60 // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback_secret_for_development'
});

export { handler as GET, handler as POST };
