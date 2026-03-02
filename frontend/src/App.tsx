import { Toaster } from 'react-hot-toast';
import AppRoutes from "./app/routes/AppRoutes";
import SyncBootstrap from "./offline/syncBootstrap";
import RealtimeBootstrap from "./offline/realtimeBootstrap";

export default function App() {
  return (
    <>
      <SyncBootstrap />
      <RealtimeBootstrap />
      <AppRoutes />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}
