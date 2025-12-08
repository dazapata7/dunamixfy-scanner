import { useStore } from './store/useStore';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Toaster } from 'react-hot-toast';
import './App.css';

function App() {
  const operator = useStore((state) => state.operator);

  return (
    <>
      {!operator ? <Login /> : <Dashboard />}
      
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: '#1a1f2e',
            color: '#fff',
            border: '1px solid #00D9C0',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600'
          },
          success: {
            iconTheme: {
              primary: '#00D9C0',
              secondary: '#1a1f2e'
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1a1f2e'
            }
          }
        }}
      />
    </>
  );
}

export default App;
