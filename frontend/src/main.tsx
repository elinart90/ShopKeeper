// // src/main.tsx
// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import { ClerkProvider } from '@clerk/clerk-react'
// import { BrowserRouter } from 'react-router-dom'
// import './index.css'
// import App from './App.tsx'

// const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// if (!PUBLISHABLE_KEY) {
//   throw new Error('Missing Clerk Publishable Key')
// }

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <BrowserRouter>
//       <ClerkProvider
//         publishableKey={PUBLISHABLE_KEY}
//         signInUrl="/sign-in"
//         signUpUrl="/sign-up"
//         afterSignInUrl="/dashboard" // Where to go after sign in
//         afterSignUpUrl="/verify-email" // Where to go after sign up
//         signInFallbackRedirectUrl="/sign-in" // Fallback if error
//         signUpFallbackRedirectUrl="/sign-up" // Fallback if error
//         // appearance={{
//         //   baseTheme: undefined,
//         //   elements: {
//         //     rootBox: {
//         //       display: 'contents'
//         //     },
//         //     card: {
//         //       display: 'none'
//         //     }
//         //   }
//         // }}
//       >
//         <App />
//       </ClerkProvider>
//     </BrowserRouter>
//   </StrictMode>
// )



// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { ShopProvider } from './contexts/ShopContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ShopProvider>
          <App />
        </ShopProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);